#!/usr/bin/env python3
"""
Fetches the latest Danish opinion polls from Wikipedia and merges them into
src/data/polls.json.

The Wikipedia article organises polls in multiple tables, one per quarter.
Section headings like "Januar-marts 2026" carry the year context for each table.

Exit codes:
  0 = no changes made (nothing to commit)
  1 = new polls were added (workflow should commit)
"""

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ─── Constants ───────────────────────────────────────────────────────────────

WIKIPEDIA_API_URL = "https://da.wikipedia.org/w/api.php"

CANDIDATE_TITLES = [
    "Meningsmålinger_forud_for_folketingsvalget_2026",
    "Meningsmålinger_forud_for_Folketingsvalget_2026",
    "Meningsmålinger_forud_for_folketingsvalget_2025",
    "Meningsmålinger_forud_for_det_næste_Folketing",
]

POLLS_FILE = Path(__file__).parent.parent / "src" / "data" / "polls.json"

KNOWN_INSTITUTES: dict[str, str] = {
    "voxmeter":        "Voxmeter",
    "yougov":          "YouGov",
    "epinion":         "Epinion",
    "megafon":         "Megafon",
    "verian":          "Verian",
    "norstat":         "Norstat",
    "gallup":          "Gallup",
}

INSTITUTE_TO_SOURCE: dict[str, str] = {
    "Voxmeter": "Ritzau",
    "YouGov":   "B.T.",
    "Epinion":  "DR",
    "Megafon":  "TV 2",
    "Verian":   "Berlingske",
    "Norstat":  "Altinget",
    "Gallup":   "Berlingske",
}

DANISH_MONTHS: dict[str, int] = {
    "januar": 1,    "februar": 2,  "marts": 3,    "april": 4,
    "maj": 5,       "juni": 6,     "juli": 7,     "august": 8,
    "september": 9, "oktober": 10, "november": 11, "december": 12,
}

# Party letter columns (lowercase header text → party letter)
PARTY_COLS: dict[str, str] = {
    "a": "A", "b": "B", "c": "C", "f": "F", "h": "H",
    "i": "I", "m": "M", "o": "O", "v": "V", "æ": "Æ",
    "ø": "Ø", "å": "Å",
}

MIN_PARTY_RESULTS = 6

# ─── Fetch ────────────────────────────────────────────────────────────────────

def fetch_wikipedia_html() -> str | None:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Valg2026PollBot/1.0 (https://github.com/StayCoolDK/Valg2026)"
    })
    for title in CANDIDATE_TITLES:
        print(f"  Trying: {title}")
        params = {
            "action": "parse", "page": title,
            "prop": "text", "format": "json", "formatversion": "2",
        }
        try:
            resp = session.get(WIKIPEDIA_API_URL, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                print(f"  Not found: {data['error'].get('info', '')}")
                continue
            html = data.get("parse", {}).get("text")
            if html:
                print(f"  ✓ Found article: {title}")
                return html
        except requests.RequestException as e:
            print(f"  HTTP error: {e}")
    return None


# ─── Date parsing (day + month only; year comes from section heading) ─────────

def parse_day_month(raw: str) -> tuple[int, int] | None:
    """Returns (day, month) or None. Strips leading range like '14.–'."""
    s = re.sub(r"^\d{1,2}\.?\s*[–\-]\s*", "", raw.strip())
    m = re.match(r"(\d{1,2})\.?\s+(\w+)", s)
    if not m:
        return None
    month = DANISH_MONTHS.get(m.group(2).lower())
    if not month:
        return None
    return int(m.group(1)), month


# ─── Column map from header row ───────────────────────────────────────────────

def build_col_map(table) -> dict[int, str]:
    """Maps column index → field name ('date','institute','sampleSize', or party letter)."""
    header_row = table.find("tr")
    if not header_row:
        return {}
    col_map: dict[int, str] = {}
    idx = 0
    for th in header_row.find_all(["th", "td"]):
        text = th.get_text(strip=True).lower()
        span = int(th.get("colspan", 1))
        if text in PARTY_COLS:
            col_map[idx] = PARTY_COLS[text]
        elif any(kw in text for kw in ("publiceret", "dato", "date", "felt", "periode", "offentliggjort")):
            col_map[idx] = "date"
        elif any(kw in text for kw in ("analyseinstitut", "institut", "pollster", "firma")):
            col_map[idx] = "institute"
        elif any(kw in text for kw in ("størrelse", "stikprøve", "sample", "antal")):
            col_map[idx] = "sampleSize"
        idx += span
    return col_map


# ─── Parse a single table ─────────────────────────────────────────────────────

def parse_table(table, year: int) -> list[dict]:
    col_map = build_col_map(table)
    party_count = sum(1 for v in col_map.values() if len(v) <= 2)
    if party_count < MIN_PARTY_RESULTS:
        return []

    polls = []
    for row in table.find_all("tr")[1:]:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue
        if all(c.name == "th" for c in cells):
            continue  # sub-header row

        # Build col_index → text map, respecting colspan
        cell_vals: dict[int, str] = {}
        ci = 0
        for cell in cells:
            span = int(cell.get("colspan", 1))
            text = re.sub(r"\[\d+\]", "", cell.get_text(strip=True)).strip()
            for s in range(span):
                cell_vals[ci + s] = text
            ci += span

        poll: dict = {"results": {}}
        has_date = False
        has_institute = False

        for col_idx, field in col_map.items():
            val = cell_vals.get(col_idx, "").strip()
            if not val or val in ("–", "-", "—", ""):
                continue

            if field == "date":
                dm = parse_day_month(val)
                if dm:
                    day, month = dm
                    poll["date"] = f"{year}-{month:02d}-{day:02d}"
                    has_date = True

            elif field == "institute":
                canonical = KNOWN_INSTITUTES.get(val.lower().strip())
                if canonical:
                    poll["institute"] = canonical
                    poll["source"] = INSTITUTE_TO_SOURCE.get(canonical, "")
                    has_institute = True

            elif field == "source":
                if not poll.get("source"):
                    poll["source"] = val

            elif field == "sampleSize":
                try:
                    poll["sampleSize"] = int(val.replace(".", "").replace(",", "").replace(" ", ""))
                except ValueError:
                    pass

            elif len(field) <= 2:  # party letter
                try:
                    poll["results"][field] = float(val.replace(",", ".").strip("%"))
                except ValueError:
                    pass

        if not has_date or not has_institute or len(poll["results"]) < MIN_PARTY_RESULTS:
            continue

        poll["id"] = f"{poll['date']}-{poll['institute'].lower().replace(' ', '')}"
        polls.append(poll)

    return polls


# ─── Walk DOM in order: headings set year context, tables consume it ──────────

def parse_all_polls(soup) -> list[dict]:
    """
    Iterates the page elements in document order.
    Heading elements (h2/h3/h4) that contain a 4-digit year update the current year.
    wikitable elements are parsed using that year as context.
    """
    current_year = 2022  # Article starts after the 2022 election
    all_polls: list[dict] = []

    for el in soup.find_all(["h2", "h3", "h4", "table"]):
        if el.name in ("h2", "h3", "h4"):
            m = re.search(r"\b(20\d{2})\b", el.get_text())
            if m:
                current_year = int(m.group(1))
        elif el.name == "table" and "wikitable" in " ".join(el.get("class", [])):
            polls = parse_table(el, current_year)
            all_polls.extend(polls)

    return all_polls


# ─── File I/O & merge ─────────────────────────────────────────────────────────

def load_existing() -> list[dict]:
    if not POLLS_FILE.exists():
        return []
    try:
        with open(POLLS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_polls(polls: list[dict]) -> None:
    with open(POLLS_FILE, "w", encoding="utf-8") as f:
        json.dump(polls, f, ensure_ascii=False, indent=2)
        f.write("\n")


def merge(existing: list[dict], incoming: list[dict]) -> tuple[list[dict], int]:
    existing_ids = {p["id"] for p in existing}
    new = [p for p in incoming if p["id"] not in existing_ids]
    if not new:
        return existing, 0
    merged = sorted(existing + new, key=lambda p: p["date"], reverse=True)
    return merged, len(new)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Fetching Wikipedia article...")
    html = fetch_wikipedia_html()
    if not html:
        print("No article found — exiting without changes.")
        sys.exit(0)

    soup = BeautifulSoup(html, "lxml")
    incoming = parse_all_polls(soup)
    print(f"Parsed {len(incoming)} polls from Wikipedia")

    if not incoming:
        print("No parseable polls.")
        sys.exit(0)

    existing = load_existing()
    print(f"Existing polls in file: {len(existing)}")

    merged, new_count = merge(existing, incoming)
    print(f"New polls added: {new_count}")

    if new_count == 0:
        print("Already up to date.")
        sys.exit(0)

    save_polls(merged)
    print(f"Saved {len(merged)} total polls.")
    sys.exit(1)  # Signal to workflow: please commit


if __name__ == "__main__":
    main()
