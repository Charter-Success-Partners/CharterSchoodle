from __future__ import annotations

import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BASELINE_PATH = ROOT / "data" / "clue-bank-statewide-baseline.json"
MANUAL_BATCH_PATHS = sorted((ROOT / "data").glob("clue-bank-batch-*.json"))
OUTPUT_PATH = ROOT / "data" / "clue-bank-statewide.json"


def main() -> None:
    baseline = json.loads(BASELINE_PATH.read_text())
    school_map = {school["schoolId"]: school for school in baseline["schools"]}

    notes = list(baseline.get("notes", []))
    for batch_path in MANUAL_BATCH_PATHS:
        batch = json.loads(batch_path.read_text())
        notes.append(f"Merged manual clue batch: {batch_path.name}")
        for school in batch["schools"]:
            current = school_map.get(school["schoolId"], {})
            merged = {
                **current,
                **school,
            }
            merged["sourceLinks"] = {
                **current.get("sourceLinks", {}),
                **school.get("sourceLinks", {}),
            }
            school_map[school["schoolId"]] = merged

    output = {
        "generatedAt": str(date.today()),
        "notes": notes,
        "schools": sorted(school_map.values(), key=lambda item: item["officialName"]),
    }

    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote merged clue bank to {OUTPUT_PATH}")
    print(f"School entries: {len(output['schools'])}")


if __name__ == "__main__":
    main()
