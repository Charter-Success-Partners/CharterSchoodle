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
  targetClueDifficulties: [8, 7, 5, 4, 2],
  seed: "CharterSchoodle-v1",
  excludedStatuses: [],
  weakCategories: ["official-record", "research-note"],
  scheduleWindow: 14,
  wrapWindow: 6,
};

const SCHEDULE_TOKEN_STOPWORDS = new Set([
  "the",
  "of",
  "and",
  "for",
  "at",
  "in",
  "school",
  "academy",
  "charter",
  "public",
  "community",
  "prep",
  "preparatory",
]);

const CLUE_CATEGORY_WEIGHTS = {
  mission: 9,
  vision: 8,
  program: 8,
  model: 8,
  "school-model": 8,
  "instructional-model": 8,
  curriculum: 8,
  academics: 7,
  specialty: 7,
  focus: 6,
  values: 6,
  "school-culture": 6,
  recognition: 6,
  history: 6,
  identity: 5,
  leadership: 4,
  "school-leader": 4,
  governance: 3,
  "board-member": 3,
  admissions: 3,
  campus: 3,
  philosophy: 4,
  community: 5,
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

function stableFraction(seed) {
  const hash = hashValue(seed);
  return Number.parseInt(hash.slice(0, 12), 16) / 0xffffffffffff;
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

function getUsableClues(school) {
  return school.clues.filter((clue) => clue.text && !clueMentionsGameplayFeedback(clue.text));
}

function getStrongClues(school) {
  return getUsableClues(school).filter(
    (clue) => !CONFIG.weakCategories.includes(clue.category),
  );
}

function clueCategoryWeight(category) {
  return CLUE_CATEGORY_WEIGHTS[category] || 4;
}

function clueSlotScore(entry, targetDifficulty, chosenCategories) {
  const difficulty = Number(entry.clue.difficulty || 0);
  const categoryRepeatPenalty = (chosenCategories.get(entry.clue.category) || 0) * 1.4;
  const difficultyGapPenalty = Math.abs(difficulty - targetDifficulty) * 2.6;
  return (
    clueCategoryWeight(entry.clue.category) * 3 +
    difficulty * 2.2 -
    difficultyGapPenalty -
    categoryRepeatPenalty +
    entry.randomness
  );
}

function selectCuratedClues(school, date) {
  const strong = getStrongClues(school);
  const usable = getUsableClues(school);
  const pool = strong.length >= CONFIG.requiredCuratedClues ? strong : usable;

  if (pool.length < CONFIG.requiredCuratedClues) {
    return [];
  }

  const decorated = pool.map((clue) => {
    const randomness = stableFraction(
      `${CONFIG.seed}:${school.schoolId}:${date}:${clue.category}:${clue.text}`,
    );
    return {
      clue,
      randomness,
      baseScore:
        clueCategoryWeight(clue.category) * 100 + (Number(clue.difficulty || 0) * 10) + randomness,
    };
  });

  const chosen = [];
  const chosenCategories = new Map();
  const remaining = [...decorated];
  const targetSlots = CONFIG.targetClueDifficulties.slice(0, CONFIG.requiredCuratedClues);

  for (const targetDifficulty of targetSlots) {
    if (remaining.length === 0) {
      break;
    }

    remaining.sort((left, right) => {
      const leftScore = clueSlotScore(left, targetDifficulty, chosenCategories);
      const rightScore = clueSlotScore(right, targetDifficulty, chosenCategories);
      return (
        rightScore - leftScore ||
        right.baseScore - left.baseScore ||
        right.randomness - left.randomness ||
        left.clue.text.localeCompare(right.clue.text)
      );
    });

    const next = remaining.shift();
    chosen.push(next.clue);
    chosenCategories.set(next.clue.category, (chosenCategories.get(next.clue.category) || 0) + 1);
  }

  if (chosen.length < CONFIG.requiredCuratedClues) {
    return [];
  }

  return chosen.map((clue) => ({
      text: clue.text,
      difficulty: clue.difficulty,
    }));
}

function countStrongClues(school) {
  return getStrongClues(school).length;
}

function buildLetterClue(officialName) {
  const initial = officialName.trim().charAt(0).toUpperCase();
  return {
    difficulty: 1,
    text: `The answer begins with the letter ${initial}.`,
  };
}

function normalizedName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildTrigrams(value) {
  const padded = `  ${value}  `;
  const grams = new Set();
  for (let index = 0; index < padded.length - 2; index += 1) {
    grams.add(padded.slice(index, index + 3));
  }
  return grams;
}

function tokenizeForSchedule(name) {
  return normalizedName(name)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SCHEDULE_TOKEN_STOPWORDS.has(token));
}

function jaccardSimilarity(left, right) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function arrayJaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return jaccardSimilarity(leftSet, rightSet);
}

function tokenOverlapCount(left, right) {
  const leftSet = new Set(left);
  let count = 0;
  for (const token of right) {
    if (leftSet.has(token)) {
      count += 1;
    }
  }
  return count;
}

function buildSchoolProfile(school) {
  const strongClues = getStrongClues(school);
  const categories = new Set(strongClues.map((clue) => clue.category));
  const sourceRefs = new Set(
    strongClues.flatMap((clue) => clue.sourceRefs || []).filter(Boolean),
  );
  const averageDifficulty =
    strongClues.reduce((sum, clue) => sum + Number(clue.difficulty || 0), 0) /
      Math.max(strongClues.length, 1);
  const normalized = normalizedName(school.officialName);

  return {
    ...school,
    strongClues,
    qualityScore:
      strongClues.length * 8 +
      categories.size * 12 +
      sourceRefs.size * 5 +
      averageDifficulty * 4,
    categoryCount: categories.size,
    averageDifficulty,
    normalizedName: normalized,
    scheduleTokens: tokenizeForSchedule(school.officialName),
    nameTrigrams: buildTrigrams(normalized),
  };
}

function schoolSimilarity(left, right) {
  const trigramSimilarity = jaccardSimilarity(left.nameTrigrams, right.nameTrigrams);
  const tokenSimilarity = arrayJaccard(left.scheduleTokens, right.scheduleTokens);
  return Math.max(trigramSimilarity, tokenSimilarity);
}

function candidatePlacementScore(candidate, order, remainingCount) {
  const stableBonus = stableFraction(`${CONFIG.seed}:schedule:${candidate.schoolId}`);
  let score = candidate.qualityScore * 10 + stableBonus;
  const recent = order.slice(-CONFIG.scheduleWindow);

  recent.forEach((prior, index) => {
    const distance = recent.length - index;
    const similarity = schoolSimilarity(candidate, prior);
    const overlap = tokenOverlapCount(candidate.scheduleTokens, prior.scheduleTokens);
    if (similarity > 0) {
      score -= similarity * (160 / distance);
    }
    if (overlap > 0) {
      score -= overlap * (70 / distance);
      if (distance <= 7) {
        score -= overlap * 180;
      }
    }
  });

  if (remainingCount <= CONFIG.wrapWindow && order.length > 0) {
    const wrapTargets = order.slice(0, CONFIG.wrapWindow);
    wrapTargets.forEach((prior, index) => {
      const similarity = schoolSimilarity(candidate, prior);
      const overlap = tokenOverlapCount(candidate.scheduleTokens, prior.scheduleTokens);
      if (similarity > 0) {
        score -= similarity * (120 / (index + 1));
      }
      if (overlap > 0) {
        score -= overlap * (50 / (index + 1));
      }
    });
  }

  return score;
}

function hasShortRangeConflict(left, right) {
  return (
    tokenOverlapCount(left.scheduleTokens, right.scheduleTokens) > 0 &&
    schoolSimilarity(left, right) >= 0.5
  );
}

function localConflictCost(order, school, index, windowSize = 7) {
  let cost = 0;
  const start = Math.max(0, index - windowSize);
  const end = Math.min(order.length - 1, index + windowSize);

  for (let position = start; position <= end; position += 1) {
    if (position === index) {
      continue;
    }

    const other = order[position];
    const overlap = tokenOverlapCount(school.scheduleTokens, other.scheduleTokens);
    if (overlap === 0) {
      continue;
    }

    const distance = Math.abs(position - index);
    cost += overlap * (distance <= 7 ? 100 : 25);
    cost += schoolSimilarity(school, other) * (distance <= 7 ? 40 : 10);
  }

  return cost;
}

function repairScheduledOrder(order) {
  const repaired = [...order];

  for (let leftIndex = 0; leftIndex < repaired.length; leftIndex += 1) {
    const rightLimit = Math.min(repaired.length, leftIndex + 8);
    for (let rightIndex = leftIndex + 1; rightIndex < rightLimit; rightIndex += 1) {
      if (!hasShortRangeConflict(repaired[leftIndex], repaired[rightIndex])) {
        continue;
      }

      let bestSwapIndex = -1;
      let bestSwapScore = Number.POSITIVE_INFINITY;

      for (let swapIndex = rightIndex + 1; swapIndex < repaired.length; swapIndex += 1) {
        const candidate = repaired[swapIndex];
        const target = repaired[rightIndex];
        const candidateScore =
          localConflictCost(repaired, candidate, rightIndex) +
          localConflictCost(repaired, target, swapIndex);

        if (candidateScore < bestSwapScore) {
          bestSwapScore = candidateScore;
          bestSwapIndex = swapIndex;
        }
      }

      if (bestSwapIndex !== -1) {
        const temp = repaired[rightIndex];
        repaired[rightIndex] = repaired[bestSwapIndex];
        repaired[bestSwapIndex] = temp;
      }
    }
  }

  return repaired;
}

function buildScheduledOrder(playable) {
  const profiles = playable.map(buildSchoolProfile);
  const remaining = new Map(profiles.map((school) => [school.schoolId, school]));
  const order = [];

  while (remaining.size > 0) {
    const candidates = [...remaining.values()];
    candidates.sort((left, right) => {
      const leftScore = candidatePlacementScore(left, order, remaining.size);
      const rightScore = candidatePlacementScore(right, order, remaining.size);
      return (
        rightScore - leftScore ||
        right.qualityScore - left.qualityScore ||
        left.schoolId.localeCompare(right.schoolId)
      );
    });

    const next = candidates[0];
    order.push(next);
    remaining.delete(next.schoolId);
  }

  return repairScheduledOrder(order);
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

  const scheduledProfiles = buildScheduledOrder(playable);

  const launchDate = parseIsoDate(CONFIG.launchDate);
  const today = parseIsoDate(process.env.CHARTERSCHOODLE_TODAY || isoDate(new Date()));
  const endDate = addDays(today, CONFIG.futureHorizonDays);

  const puzzles = [];
  let cursor = new Date(launchDate);
  let offset = 0;

  while (cursor <= endDate) {
    const date = isoDate(cursor);
    const school = scheduledProfiles[offset % scheduledProfiles.length];
    const schoolId = school.schoolId;
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
    "Built from manually validated statewide clue-bank entries with a deterministic quality-weighted school rotation.",
    "The rotation prefers stronger clue pools earlier in the archive and spaces out similar school names when possible.",
    "Each puzzle uses five curated clues plus a final first-letter hint, with clue selection biased toward category diversity.",
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
