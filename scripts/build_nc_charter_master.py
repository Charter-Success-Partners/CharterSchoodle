from __future__ import annotations

import json
import re
import zipfile
import difflib
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
KML_PATH = ROOT / "nc_charter_map.kml"
SRC_ZIP_PATH = ROOT / "src_dataset.zip"
MASTER_OUTPUT_PATH = ROOT / "data" / "nc-charter-master-list.json"
SCHOOLS_OUTPUT_PATH = ROOT / "data" / "schools.json"
CLUE_OUTPUT_PATH = ROOT / "data" / "clue-bank-statewide-baseline.json"
GEOCODE_CACHE_PATH = ROOT / "data" / "geocoded-school-addresses.json"

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}
XLSX_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

LOCATION_NAME_ALIASES = {
    "Washington Montessori": "Washington Montessori Public Charter School",
    "Francine Delany New School": "Francine Delany New School for Children",
    "New Dimensions": "New Dimensions: A Public Charter School",
    "Davidson Charter Academy": "Davidson Charter Academy Inc.",
    "Community School of Digital & Visual Art": "Community School of Digital and Visual Arts",
    "Research Triangle Charter": "Research Triangle Charter Academy",
    "The Institute Development Young Leaders": "The Institute for the Development of Young Leaders",
    "Excelsior Classical Academy": "Excelsior Classical Academy CFA",
    "Discovery Charter": "Discovery Charter School",
    "North East Carolina Prep": "North East Carolina Preparatory",
    "Mountain Island Charter School": "Mountain Island Charter School Inc",
    "Oxford Preparatory": "Oxford Preparatory School",
    "College Prep and Leadership Academy": "The College Preparatory and Leadership Academy of High Point",
    "Gate City Charter": "Gate City Charter Academy",
    "FernLeaf": "FernLeaf Community Charter School",
    "Success Institute Charter": "Success Institute Charter School",
    "Pine Lake Preparatory": "Pine Lake Preparatory, Inc.",
    "Summit Charter": "Summit Charter School",
    "Metrolina Reg Scholars Academy": "Metrolina Regional Scholars Academy",
    "Charlotte Secondary": "Charlotte Secondary School",
    "Commonwealth High": "Commonwealth High School",
    "Stewart Creek High": "Stewart Creek High School",
    "Aspire Trade High": "Aspire Trade High School",
    "Rocky Mount Preparatory": "Rocky Mount Preparatory School, Inc.",
    "Roxboro Community School": "Roxboro Community School, Inc.",
    "Thomas Jefferson Classical Academy": "Thomas Jefferson Classical Academy: A Challenge Foundation A",
    "Gray Stone Day": "Gray Stone Day School",
    "Mountain Discovery": "Mountain Discovery Charter School",
    "Union Prep Academy at Indian Trail": "Union Preparatory Academy at Indian Trail",
    "Magellan Charter": "The Magellan Charter School",
    "PreEminent Charter": "PreEminent Charter School",
    "Raleigh Oak Charter": "Raleigh Oak Charter School",
    "Cardinal Charter Acad at Wendell Falls": "Cardinal Charter Academy at Wendell Falls",
    "Dillard Academy": "Dillard Academy Charter School",
    "Sallie B Howard School": "Sallie B Howard School of Arts and Science",
    "Faith Academy Charter School": "Faith Academy",
    "Union Academy": "Union Academy Charter School",
}

ID_OVERRIDES = {
    "Francine Delany New School": "francine-delany-new-school-for-children",
}


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"&", " and ", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value


def normalize_name(value: str) -> str:
    value = value.lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def hostname_from_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return parsed.netloc.lower().removeprefix("www.")


def street_only(address: str) -> str:
    if not address:
        return ""
    return address.split(",")[0].strip()


def first_nonempty(data: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = (data.get(key) or "").strip()
        if value and value != "-":
            return value
    return ""


def parse_float(raw: str | int | float | None) -> float | None:
    if raw in {None, ""}:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def parse_grade_span(raw: str) -> list[int]:
    grades: list[int] = []
    if not raw:
        return grades

    parsed_tokens: list[int] = []
    for token in raw.split(":"):
        token = token.strip().upper()
        if not token:
            continue
        if token in {"PK", "0K", "KG", "K"}:
            parsed_tokens.append(0)
            continue
        if token.isdigit():
            parsed_tokens.append(int(token))

    if not parsed_tokens:
        return grades

    if len(parsed_tokens) >= 2:
        low = min(parsed_tokens)
        high = max(parsed_tokens)
        grades = list(range(low, high + 1))
    else:
        grades = parsed_tokens

    return sorted(set(grades))


def compute_grade_band(raw: str) -> str | None:
    grades = parse_grade_span(raw)
    if not grades:
        return None

    has_elem = any(grade <= 5 for grade in grades)
    has_mid = any(6 <= grade <= 8 for grade in grades)
    has_high = any(grade >= 9 for grade in grades)

    labels = []
    if has_elem:
        labels.append("Elementary")
    if has_mid:
        labels.append("Middle")
    if has_high:
        labels.append("High")
    return "+".join(labels) if labels else None


def compute_enrollment_band(adm_value: str | int | float | None) -> str | None:
    if adm_value in {None, ""}:
        return None
    count = float(adm_value)
    if count <= 400:
        return "0-400"
    if count <= 800:
        return "401-800"
    return "801+"


def parse_effective_year(raw: str) -> str | None:
    if not raw:
        return None
    match = re.search(r"(\d{4})", raw)
    return match.group(1) if match else None


def read_first_sheet_rows_from_xlsx_bytes(data: bytes) -> list[list[str]]:
    with zipfile.ZipFile(Path("/dev/null"), "w"):
        pass
    workbook_zip = zipfile.ZipFile(Path("/dev/null"), "w")
    workbook_zip.close()

    with zipfile.ZipFile(Path("/dev/null"), "w"):
        pass

    with zipfile.ZipFile(io := Path("/dev/null"), "w"):
        pass

    # The temporary context above is a no-op placeholder to keep type checkers quiet
    # when using stdlib zip/xml parsing without third-party dependencies.
    del workbook_zip, io

    with zipfile.ZipFile(Path("/dev/null"), "w"):
        pass

    # Actual parser
    import io as _io

    zf = zipfile.ZipFile(_io.BytesIO(data))
    shared_strings: list[str] = []
    if "xl/sharedStrings.xml" in zf.namelist():
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        for si in root.findall(f"{XLSX_NS}si"):
            texts = [node.text or "" for node in si.iter(f"{XLSX_NS}t")]
            shared_strings.append("".join(texts))

    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    first_sheet = workbook.find(f"{XLSX_NS}sheets/{XLSX_NS}sheet")
    rel_id = first_sheet.attrib[
        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    ]
    worksheet_path = "xl/" + rel_map[rel_id]
    worksheet = ET.fromstring(zf.read(worksheet_path))

    rows: list[list[str]] = []
    for row in worksheet.findall(f".//{XLSX_NS}sheetData/{XLSX_NS}row"):
        values: list[str] = []
        for cell in row.findall(f"{XLSX_NS}c"):
            ref = cell.attrib["r"]
            letters = re.match(r"([A-Z]+)", ref).group(1)
            index = 0
            for char in letters:
                index = index * 26 + ord(char) - 64
            index -= 1
            while len(values) <= index:
                values.append("")
            raw_value = ""
            value_node = cell.find(f"{XLSX_NS}v")
            if value_node is not None:
                raw_value = value_node.text or ""
                if cell.attrib.get("t") == "s":
                    raw_value = shared_strings[int(raw_value)]
            values[index] = raw_value
        rows.append(values)
    return rows


def load_location_records() -> list[dict[str, str]]:
    with zipfile.ZipFile(SRC_ZIP_PATH) as zf:
        rows = read_first_sheet_rows_from_xlsx_bytes(zf.read("rcd_location.xlsx"))
    header = rows[0]
    records = []
    for row in rows[1:]:
        padded = row + [""] * (len(header) - len(row))
        record = dict(zip(header, padded))
        if record.get("year") == "2024" and record.get("designation_Type") == "C":
            records.append(record)
    return records


def load_adm_map() -> dict[str, str]:
    with zipfile.ZipFile(SRC_ZIP_PATH) as zf:
        rows = read_first_sheet_rows_from_xlsx_bytes(zf.read("rcd_adm.xlsx"))
    header = rows[0]
    year_idx = header.index("year")
    agency_idx = header.index("agency_code")
    adm_idx = header.index("avg_student_num")
    adm_map: dict[str, str] = {}
    for row in rows[1:]:
        if len(row) <= adm_idx:
            continue
        if row[year_idx] == "2024":
            adm_map[row[agency_idx]] = row[adm_idx]
    return adm_map


def load_geocode_cache() -> dict[str, dict]:
    if not GEOCODE_CACHE_PATH.exists():
        return {}

    payload = json.loads(GEOCODE_CACHE_PATH.read_text())
    schools = payload.get("schools", {})
    if isinstance(schools, dict):
        return schools
    return {}


def load_current_kml_records() -> list[dict[str, str]]:
    root = ET.parse(KML_PATH).getroot()
    current_folder = None
    for folder in root.findall(".//kml:Folder", KML_NS):
        name_node = folder.find("kml:name", KML_NS)
        if name_node is not None and name_node.text == "Operating Charter Schools in NC 2025-2026":
            current_folder = folder
            break
    if current_folder is None:
        raise RuntimeError("Could not locate 2025-2026 charter folder in KML.")

    records = []
    for placemark in current_folder.findall("kml:Placemark", KML_NS):
        name = (placemark.findtext("kml:name", default="", namespaces=KML_NS) or "").strip()
        address = (placemark.findtext("kml:address", default="", namespaces=KML_NS) or "").strip()
        coords_raw = (
            placemark.findtext(".//kml:coordinates", default="", namespaces=KML_NS) or ""
        ).strip()
        lng, lat, *_ = [part.strip() for part in coords_raw.split(",")] if coords_raw else ("", "")

        data: dict[str, str] = {}
        for item in placemark.findall(".//kml:ExtendedData/kml:Data", KML_NS):
            key = item.attrib.get("name", "").strip()
            value = (item.findtext("kml:value", default="", namespaces=KML_NS) or "").strip()
            data[key] = value

        records.append(
            {
                "officialName": name,
                "address": address,
                "lat": lat,
                "lng": lng,
                "schoolCode": first_nonempty(data, "School Code", "LEA", "IPS Number"),
                "mailingAddress": first_nonempty(
                    data,
                    "School Mailing Address ----------",
                    "Mailing Address Line1 ---------------",
                ),
                "mailingCity": first_nonempty(data, "School Mailing City", "Mailing City"),
                "county": data.get("County Description", ""),
                "effectiveDate": first_nonempty(data, "School Effective Date", "Opening Effective Date"),
                "phone": data.get("School Office Phone", ""),
                "fax": data.get("School Office Fax", ""),
                "url": data.get("URL School Address", ""),
                "charterDirector": data.get("Charter Director --------------", ""),
                "boardChair": data.get("Board Chair ---------------", ""),
                "gradeLevelCurrent": first_nonempty(
                    data,
                    "Grade Level Current",
                    "Grade Level Current:",
                    "Grade Level Current: ",
                    "Grade Level Approved",
                ),
                "physicalStreet": first_nonempty(
                    data,
                    "School Physical Address ------------",
                    "Address Line1 -------------------",
                    "Address Line1",
                ),
                "physicalCity": first_nonempty(data, "School Physica Address City", "City"),
                "physicalZip": first_nonempty(data, "School Physical Address Zip", "Zip Code 5"),
            }
        )
    return records


def build_master_records() -> tuple[list[dict], dict]:
    kml_records = load_current_kml_records()
    location_records = load_location_records()
    adm_map = load_adm_map()
    geocode_cache = load_geocode_cache()

    location_by_name = {normalize_name(record["name"]): record for record in location_records}
    location_by_host = {
        hostname_from_url(record.get("url", "")): record
        for record in location_records
        if hostname_from_url(record.get("url", ""))
    }
    location_name_values = list(location_by_name.keys())

    master_records: list[dict] = []
    unmatched: list[str] = []

    for record in kml_records:
        location = location_by_name.get(normalize_name(record["officialName"]))
        if location is None:
            alias = LOCATION_NAME_ALIASES.get(record["officialName"])
            if alias:
                location = location_by_name.get(normalize_name(alias))
        if location is None:
            location = location_by_host.get(hostname_from_url(record["url"]))
        if location is None:
            close = difflib.get_close_matches(
                normalize_name(record["officialName"]),
                location_name_values,
                n=1,
                cutoff=0.93,
            )
            if close:
                location = location_by_name.get(close[0])

        if location is None:
            unmatched.append(record["officialName"])

        school_id = ID_OVERRIDES.get(record["officialName"], slugify(record["officialName"]))
        geocode = geocode_cache.get(school_id, {})
        record_lat = parse_float(record["lat"])
        record_lng = parse_float(record["lng"])
        geocode_lat = parse_float(geocode.get("lat"))
        geocode_lng = parse_float(geocode.get("lng"))

        agency_code = location.get("agency_code") if location else (
            f"{record['schoolCode']}000" if record["schoolCode"] else None
        )
        grade_span_raw = location.get("grade_span") if location else record.get("gradeLevelCurrent")
        adm_value = adm_map.get(agency_code or "")

        master_records.append(
            {
                "id": school_id,
                "officialName": record["officialName"],
                "schoolCode": record["schoolCode"],
                "agencyCode": agency_code,
                "city": (location.get("city") if location else "") or record["physicalCity"] or record["mailingCity"],
                "county": (location.get("county") if location else "") or record["county"],
                "address": (location.get("street_addr") if location else "") or record["physicalStreet"] or record["mailingAddress"] or record["address"],
                "zip": (location.get("zip") if location else "") or record["physicalZip"],
                "url": (location.get("url") if location else "") or record["url"],
                "charterDirector": record["charterDirector"],
                "boardChair": record["boardChair"],
                "effectiveDate": record["effectiveDate"],
                "effectiveYear": parse_effective_year(record["effectiveDate"]),
                "gradeSpanRaw": grade_span_raw,
                "gradeBand": compute_grade_band(grade_span_raw or ""),
                "adm2024": adm_value,
                "enrollmentBand": compute_enrollment_band(adm_value),
                "coordinates": {
                    "lat": record_lat if record_lat is not None else geocode_lat,
                    "lng": record_lng if record_lng is not None else geocode_lng,
                },
                "sourceLinks": {
                    "dpiCharterMap": "https://www.dpi.nc.gov/students-families/alternative-choices/charter-schools",
                    "schoolReportCardsZip": "https://www.dpi.nc.gov/data-reports/school-report-cards/school-report-card-resources-researchers",
                },
                "sourceSummary": {
                    "kmlYear": "2025-2026",
                    "locationYear": location.get("year") if location else None,
                    "admYear": "2024" if adm_value else None,
                    "geocodeSource": geocode.get("source")
                    if geocode_lat is not None and geocode_lng is not None
                    else None,
                },
            }
        )

    master_records.sort(key=lambda item: item["officialName"])
    stats = {
        "kmlCurrentCount": len(kml_records),
        "matchedToLocationCount": len(kml_records) - len(unmatched),
        "unmatchedCount": len(unmatched),
        "admCount": sum(1 for item in master_records if item["adm2024"] not in {None, ""}),
        "enrollmentBandCount": sum(
            1 for item in master_records if item["enrollmentBand"] not in {None, ""}
        ),
        "gradeBandCount": sum(1 for item in master_records if item["gradeBand"] not in {None, ""}),
        "coordinateCount": sum(
            1
            for item in master_records
            if item["coordinates"]["lat"] is not None and item["coordinates"]["lng"] is not None
        ),
        "unmatchedSchools": unmatched,
    }
    return master_records, stats


def build_baseline_clues(master_records: list[dict]) -> dict:
    schools = []
    for school in master_records:
        hostname = hostname_from_url(school["url"])
        street = street_only(school["address"])
        clues = []

        if school["effectiveYear"]:
            clues.append(
                {
                    "text": f"This charter school's DPI-linked record lists an effective year of {school['effectiveYear']}.",
                    "difficulty": 6,
                    "category": "history",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )
        if school["charterDirector"]:
            clues.append(
                {
                    "text": f"The DPI-linked charter map lists {school['charterDirector']} as this school's charter director.",
                    "difficulty": 7,
                    "category": "school-leader",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )
        if school["boardChair"]:
            clues.append(
                {
                    "text": f"The DPI-linked charter map lists {school['boardChair']} as this school's board chair.",
                    "difficulty": 8,
                    "category": "board-member",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )
        if school["city"]:
            clues.append(
                {
                    "text": f"The DPI-linked charter map places this school in {school['city']}.",
                    "difficulty": 5,
                    "category": "city",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )
        if school["county"]:
            clues.append(
                {
                    "text": f"The DPI-linked charter map places this school in {school['county']} County.",
                    "difficulty": 5,
                    "category": "county",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )
        if street:
            clues.append(
                {
                    "text": f"The DPI-linked charter map lists this school's physical address on {street}.",
                    "difficulty": 7,
                    "category": "campus",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )
        if hostname:
            clues.append(
                {
                    "text": f"Its official website uses the domain {hostname}.",
                    "difficulty": 8,
                    "category": "website",
                    "sourceRefs": ["dpiCharterMap", "schoolReportCardsZip"],
                }
            )
        if school["schoolCode"]:
            clues.append(
                {
                    "text": f"The DPI-linked charter map identifies this school with the code {school['schoolCode']}.",
                    "difficulty": 9,
                    "category": "school-code",
                    "sourceRefs": ["dpiCharterMap"],
                }
            )

        schools.append(
            {
                "schoolId": school["id"],
                "officialName": school["officialName"],
                "status": "baseline-generated",
                "qualityTier": "state-directory-generated",
                "sourceLinks": school["sourceLinks"],
                "clues": clues[:8],
            }
        )

    return {
        "generatedAt": str(date.today()),
        "notes": [
            "Statewide baseline clue bank generated from the DPI-linked charter map and official NC School Report Cards researcher dataset.",
            "These clues provide broad coverage for all current charter schools but many schools still need richer hand-authored school-website clues for production quality.",
            "Clues intentionally avoid enrollment size, grade span, and directional/proximity information because those are gameplay feedback channels.",
        ],
        "schools": schools,
    }


def main() -> None:
    master_records, stats = build_master_records()
    baseline_clues = build_baseline_clues(master_records)

    MASTER_OUTPUT_PATH.write_text(
        json.dumps(
            {
                "generatedAt": str(date.today()),
                "sourceSummary": {
                    "dpiCharterMapFolder": "Operating Charter Schools in NC 2025-2026",
                    "schoolReportCardsLocationYear": "2024",
                    "schoolReportCardsAdmYear": "2024",
                },
                "stats": stats,
                "schools": master_records,
            },
            indent=2,
        )
        + "\n"
    )

    SCHOOLS_OUTPUT_PATH.write_text(json.dumps(master_records, indent=2) + "\n")
    CLUE_OUTPUT_PATH.write_text(json.dumps(baseline_clues, indent=2) + "\n")

    print(f"Wrote {len(master_records)} schools to {MASTER_OUTPUT_PATH}")
    print(f"Wrote {len(master_records)} schools to {SCHOOLS_OUTPUT_PATH}")
    print(f"Wrote baseline clue bank to {CLUE_OUTPUT_PATH}")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
