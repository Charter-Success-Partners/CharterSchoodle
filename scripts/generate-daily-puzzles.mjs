import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const clueBankPath = path.join(rootDir, "data", "clue-bank-statewide.json");
const schoolsPath = path.join(rootDir, "data", "schools.json");
const sourcePath = path.join(rootDir, "data", "puzzle-source.json");
const outputPath = path.join(rootDir, "data", "puzzles.json");

const CONFIG = {
  launchDate: "2026-05-07",
  futureHorizonDays: 730,
  requiredCuratedClues: 5,
  seed: "CharterSchoodle-v1",
  excludedStatuses: [],
  weakCategories: ["official-record", "research-note"],
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  return new Date(`${value}T12:00:00.000Z`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function hashValue(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function sortByStableHash(values, seed) {
  return [...values].sort((left, right) => {
    const leftHash = hashValue(`${seed}:${left}`);
    const rightHash = hashValue(`${seed}:${right}`);
    return leftHash.localeCompare(rightHash) || String(left).localeCompare(String(right));
  });
}

function clueMentionsGameplayFeedback(text) {
  const normalized = text.toLowerCase();
  const blockedPatterns = [
    /\benrollment\b/,
    /\benrolled\b/,
    /\bstudent body\b/,
    /\bstudent count\b/,
    /\broughly\s+\d+\s+students\b/,
    /\bserves students from kindergarten through high school\b/,
    /\bgrades?\b/,
    /\bgrade\s+k\b/,
    /\bk-\d+/,
    /\bprek\b/,
    /\bkindergarten\b/,
    /\belementary\b/,
    /\bmiddle school\b/,
    /\bhigh school\b/,
    /\bnorth\b/,
    /\bsouth\b/,
    /\beast\b/,
    /\bwest\b/,
    /\bcoast\b/,
    /\bpiedmont\b/,
    /\bmountains?\b/,
  ];

  return blockedPatterns.some((pattern) => pattern.test(normalized));
}

function selectCuratedClues(school, date) {
  const usable = school.clues.filter(
    (clue) => clue.text && !clueMentionsGameplayFeedback(clue.text),
  );

  if (usable.length < CONFIG.requiredCuratedClues) {
    return [];
  }

  const chosen = sortByStableHash(
    usable.map((clue) => JSON.stringify(clue)),
    `${CONFIG.seed}:${school.schoolId}:${date}`,
  )
    .map((serialized) => JSON.parse(serialized))
    .slice(0, CONFIG.requiredCuratedClues)
    .sort((left, right) => right.difficulty - left.difficulty || left.text.localeCompare(right.text));

  return chosen.map((clue) => ({
    text: clue.text,
    difficulty: clue.difficulty,
  }));
}

function countStrongClues(school) {
  return school.clues.filter(
    (clue) =>
      clue.text &&
      !clueMentionsGameplayFeedback(clue.text) &&
      !CONFIG.weakCategories.includes(clue.category),
  ).length;
}

function buildLetterClue(officialName) {
  const initial = officialName.trim().charAt(0).toUpperCase();
  return {
    difficulty: 1,
    text: `The answer begins with the letter ${initial}.`,
  };
}

async function main() {
  const [schoolsRaw, clueBankRaw] = await Promise.all([
    fs.readFile(schoolsPath, "utf8"),
    fs.readFile(clueBankPath, "utf8"),
  ]);

  const schools = JSON.parse(schoolsRaw);
  const clueBank = JSON.parse(clueBankRaw);
  const schoolIds = new Set(schools.map((school) => school.id));

  const playable = clueBank.schools
    .filter((school) => schoolIds.has(school.schoolId))
    .filter((school) => String(school.status || "").startsWith("validated-batch-"))
    .filter((school) => !CONFIG.excludedStatuses.includes(String(school.status || "")))
    .filter((school) => {
      const usableClueCount = school.clues.filter(
        (clue) => clue.text && !clueMentionsGameplayFeedback(clue.text),
      ).length;
      return (
        usableClueCount >= CONFIG.requiredCuratedClues &&
        countStrongClues(school) >= CONFIG.requiredCuratedClues
      );
    });

  if (playable.length === 0) {
    throw new Error("No playable schools found for daily puzzle generation.");
  }

  const orderedSchoolIds = sortByStableHash(
    playable.map((school) => school.schoolId),
    CONFIG.seed,
  );
  const playableMap = new Map(playable.map((school) => [school.schoolId, school]));

  const launchDate = parseIsoDate(CONFIG.launchDate);
  const today = parseIsoDate(process.env.CHARTERSCHOODLE_TODAY || isoDate(new Date()));
  const endDate = addDays(today, CONFIG.futureHorizonDays);

  const puzzles = [];
  let cursor = new Date(launchDate);
  let offset = 0;

  while (cursor <= endDate) {
    const date = isoDate(cursor);
    const schoolId = orderedSchoolIds[offset % orderedSchoolIds.length];
    const school = playableMap.get(schoolId);
    const curatedClues = selectCuratedClues(school, date);

    if (curatedClues.length < CONFIG.requiredCuratedClues) {
      throw new Error(`School ${school.officialName} does not have enough usable clues.`);
    }

    puzzles.push({
      date,
      answerSchoolId: schoolId,
      clues: [...curatedClues, buildLetterClue(school.officialName)],
    });

    cursor = addDays(cursor, 1);
    offset += 1;
  }

  const notes = [
    "Automatically generated CharterSchoodle daily puzzle calendar.",
    "Built from manually validated statewide clue-bank entries with a deterministic school rotation.",
    "Each puzzle uses five curated clues plus a final first-letter hint.",
    "Automatic daily selection uses validated schools that meet the generator's strong-clue threshold.",
  ];

  const source = {
    generatedAt: isoDate(new Date()),
    notes,
    generatorConfig: CONFIG,
    stats: {
      playableSchools: playable.length,
      puzzleCount: puzzles.length,
      startDate: CONFIG.launchDate,
      endDate: isoDate(endDate),
    },
    puzzles,
  };

  const output = {
    generatedAt: isoDate(new Date()),
    notes,
    puzzles,
  };

  await Promise.all([
    fs.writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`),
    fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`),
  ]);

  console.log(`Playable schools: ${playable.length}`);
  console.log(`Generated puzzles: ${puzzles.length}`);
  console.log(`Wrote ${sourcePath}`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
