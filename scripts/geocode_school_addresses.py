from __future__ import annotations

import csv
import io
import json
import mimetypes
import time
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
SCHOOLS_PATH = ROOT / "data" / "schools.json"
OUTPUT_PATH = ROOT / "data" / "geocoded-school-addresses.json"

CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
ARCGIS_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
USER_AGENT = "CharterSchoodle geocode cache generator"


def clean(value: object) -> str:
    return " ".join(str(value or "").split())


def formatted_address(school: dict) -> str:
    return ", ".join(
        part
        for part in [
            clean(school.get("address")),
            clean(school.get("city")),
            "NC",
            clean(school.get("zip")),
        ]
        if part
    )


def build_census_batch(schools: list[dict]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    for school in schools:
        writer.writerow(
            [
                school["id"],
                clean(school.get("address")),
                clean(school.get("city")),
                "NC",
                clean(school.get("zip")),
            ]
        )
    return buffer.getvalue().encode("utf-8")


def multipart_form(fields: dict[str, str], files: dict[str, tuple[str, bytes]]) -> tuple[bytes, str]:
    boundary = "----CharterSchoodleGeocodeBoundary"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                value.encode(),
                b"\r\n",
            ]
        )

    for name, (filename, content) in files.items():
        content_type = mimetypes.guess_type(filename)[0] or "text/csv"
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                (
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{filename}"\r\n'
                ).encode(),
                f"Content-Type: {content_type}\r\n\r\n".encode(),
                content,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def fetch_census_batch(schools: list[dict]) -> list[list[str]]:
    body, boundary = multipart_form(
        {"benchmark": "Public_AR_Current"},
        {"addressFile": ("charter-school-addresses.csv", build_census_batch(schools))},
    )
    request = Request(
        CENSUS_BATCH_URL,
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=60) as response:
        text = response.read().decode("utf-8")
    return list(csv.reader(io.StringIO(text)))


def fetch_arcgis_candidate(address: str) -> dict | None:
    query = urlencode(
        {
            "SingleLine": address,
            "f": "json",
            "outFields": "Match_addr,Addr_type",
            "maxLocations": "1",
        }
    )
    request = Request(f"{ARCGIS_URL}?{query}", headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    candidates = payload.get("candidates") or []
    return candidates[0] if candidates else None


def main() -> None:
    schools = json.loads(SCHOOLS_PATH.read_text())
    school_by_id = {school["id"]: school for school in schools}
    cache: dict[str, dict] = {}
    fallback_ids: list[str] = []

    for row in fetch_census_batch(schools):
        if len(row) >= 6 and row[2] == "Match":
            lng, lat = [float(part) for part in row[5].split(",")]
            cache[row[0]] = {
                "lat": lat,
                "lng": lng,
                "source": "US Census Geocoder",
                "matchType": row[3],
                "inputAddress": row[1],
                "matchedAddress": row[4],
            }
        elif row and row[0] in school_by_id:
            fallback_ids.append(row[0])
        elif row:
            raise RuntimeError(f"Unexpected Census geocoder response row: {row}")

    for school_id in fallback_ids:
        school = school_by_id[school_id]
        input_address = formatted_address(school)
        candidate = fetch_arcgis_candidate(input_address)
        if candidate and candidate.get("location"):
            cache[school_id] = {
                "lat": candidate["location"]["y"],
                "lng": candidate["location"]["x"],
                "source": "ArcGIS World Geocoding Service",
                "matchType": candidate.get("attributes", {}).get("Addr_type", "Candidate"),
                "score": candidate.get("score"),
                "inputAddress": input_address,
                "matchedAddress": candidate.get("address"),
            }
        else:
            print(f"No fallback geocode for {school_id}: {input_address}")
        time.sleep(0.15)

    missing = [school["id"] for school in schools if school["id"] not in cache]
    payload = {
        "generatedAt": str(date.today()),
        "notes": [
            "Coordinates are generated from official NC DPI school addresses for gameplay direction hints.",
            "US Census Geocoder Public_AR_Current is used first; ArcGIS World Geocoding Service is used only for Census no-match addresses.",
        ],
        "stats": {
            "schoolCount": len(schools),
            "geocodedCount": len(cache),
            "censusCount": sum(1 for entry in cache.values() if entry["source"] == "US Census Geocoder"),
            "arcgisCount": sum(
                1 for entry in cache.values() if entry["source"] == "ArcGIS World Geocoding Service"
            ),
            "missingCount": len(missing),
            "missingSchoolIds": missing,
        },
        "schools": dict(sorted(cache.items())),
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload["stats"], indent=2))


if __name__ == "__main__":
    main()
