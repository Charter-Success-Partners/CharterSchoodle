import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const schoolsPath = path.join(rootDir, "data", "schools.json");
const sourcePath = path.join(rootDir, "data", "puzzle-source.json");
const outputPath = path.join(rootDir, "data", "puzzles.json");

async function main() {
  const [schoolsRaw, sourceRaw] = await Promise.all([
    fs.readFile(schoolsPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
  ]);

  const schools = JSON.parse(schoolsRaw);
  const source = JSON.parse(sourceRaw);
  const schoolIds = new Set(schools.map((school) => school.id));

  for (const puzzle of source.puzzles) {
    if (!schoolIds.has(puzzle.answerSchoolId)) {
      throw new Error(`Unknown school id in puzzle source: ${puzzle.answerSchoolId}`);
    }

    if (puzzle.clues.length < 6) {
      throw new Error(`Puzzle ${puzzle.date} needs at least 6 clues.`);
    }
  }

  const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    notes: source.notes,
    puzzles: source.puzzles,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${output.puzzles.length} puzzles to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
