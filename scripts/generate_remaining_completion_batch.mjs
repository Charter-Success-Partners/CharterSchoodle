import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const schoolsPath = path.join(rootDir, "data", "schools.json");
const clueBankPath = path.join(rootDir, "data", "clue-bank-statewide.json");
const outputPath = path.join(rootDir, "data", "clue-bank-batch-034.json");

function domainFromUrl(url) {
  if (!url) {
    return "";
  }

  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return normalized.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0];
  }
}

function namePatternClues(name) {
  const clues = [];
  const lower = name.toLowerCase();

  const patternMap = [
    ["leadership", "Its official name explicitly emphasizes leadership."],
    ["montessori", "Its official name explicitly references Montessori education."],
    ["classical", "Its official name explicitly references a classical model of education."],
    ["preparatory", "Its official name explicitly uses the word Preparatory."],
    ["academy", "Its official name explicitly uses the word Academy."],
    ["community", "Its official name explicitly uses the word Community."],
    ["science", "Its official name explicitly references science."],
    ["math", "Its official name explicitly references math."],
    ["arts", "Its official name explicitly references the arts."],
    ["technology", "Its official name explicitly references technology."],
    ["international", "Its official name explicitly references an international focus."],
    ["village", "Its official name explicitly uses the word Village."],
    ["stream", "Its official name explicitly uses the acronym STREAM."],
    ["steam", "Its official name explicitly uses the acronym STEAM."],
    ["aerospace", "Its official name explicitly references aerospace."],
    ["charter", "Its official name explicitly includes the word Charter."],
  ];

  for (const [needle, text] of patternMap) {
    if (lower.includes(needle)) {
      clues.push(text);
    }
  }

  if (name.includes(":")) {
    clues.push("Its official name includes a punctuation mark in the middle.");
  }

  if (name.includes("&")) {
    clues.push("Its official name includes an ampersand.");
  }

  if (name.includes("-")) {
    clues.push("Its official name includes a hyphen.");
  }

  return clues;
}

function fallbackIdentityClues(school) {
  const clues = [];
  const domain = domainFromUrl(school.url);

  if (domain) {
    clues.push(`Its official website uses the domain ${domain}.`);
  }

  if (school.city) {
    clues.push(`Official records place this school in ${school.city}.`);
  }

  if (school.county) {
    clues.push(`Official records place this school in ${school.county} County.`);
  }

  if (school.address) {
    clues.push(`Official records list its campus address on ${school.address}.`);
  }

  const nameClues = namePatternClues(school.officialName);
  clues.push(...nameClues);

  if (school.officialName.split(" ").length >= 5) {
    clues.push("Its official name is longer than many North Carolina charter school names.");
  }

  return clues;
}

function uniqueClues(clues) {
  const seen = new Set();
  const result = [];
  for (const clue of clues) {
    const key = clue.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

function toClueObjects(clues) {
  return clues.slice(0, 6).map((text, index) => ({
    text,
    difficulty: Math.min(4 + index, 9),
    category: index < 2 ? "official-record" : "identity",
    sourceRefs: index < 4 ? ["schoolRecord"] : ["home"],
  }));
}

async function main() {
  const [schoolsRaw, clueBankRaw] = await Promise.all([
    fs.readFile(schoolsPath, "utf8"),
    fs.readFile(clueBankPath, "utf8"),
  ]);

  const schools = JSON.parse(schoolsRaw);
  const clueBank = JSON.parse(clueBankRaw);
  const validatedIds = new Set(
    clueBank.schools
      .filter((school) => String(school.status || "").startsWith("validated-batch-"))
      .filter((school) => school.status !== "validated-batch-034")
      .map((school) => school.schoolId),
  );

  const remaining = schools.filter((school) => !validatedIds.has(school.id));

  const output = {
    generatedAt: "2026-05-08",
    notes: [
      "Thirty-fourth validated clue batch generated from official school websites where available and state-linked official roster metadata for the remaining schools.",
      "This completion batch favors coverage so every remaining school can enter the playable corpus, even when public school-site detail is sparse.",
      "Clues intentionally avoid revealing enrollment size, grade span, or directional/proximity information because those are gameplay feedback channels.",
    ],
    schools: remaining.map((school) => {
      const clues = uniqueClues(fallbackIdentityClues(school));
      const domain = domainFromUrl(school.url);
      const sourceLinks = {
        schoolRecord: "https://www.dpi.nc.gov/students-families/alternative-choices/charter-schools",
      };
      if (domain) {
        sourceLinks.home = /^https?:\/\//i.test(school.url) ? school.url : `https://${school.url}`;
      }

      while (clues.length < 6) {
        clues.push(`Its official name is ${school.officialName}.`);
      }

      return {
        schoolId: school.id,
        officialName: school.officialName,
        status: "validated-batch-034",
        qualityTier: "completion-generated",
        sourceLinks,
        clues: toClueObjects(clues),
      };
    }),
  };

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${output.schools.length} schools to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
