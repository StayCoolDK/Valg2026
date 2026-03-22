#!/usr/bin/env python3
"""
Fetches the latest Danish opinion polls from Wikipedia and merges them into
src/data/polls.json.

Exit codes:
  0 = no changes made (nothing to commit)
  1 = new polls were added (workflow should commit)
"""

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag

# ─── Constants ───────────────────────────────────────────────────────────────

WIKIPEDIA_API_URL = "https://da.wikipedia.org/w/api.php"

# Try these article titles in order until one works
CANDIDATE_TITLES = [
    "Meningsmålinger_forud_for_Folketingsvalget_2026",
    "Meningsmålinger_forud_for_Folketingsvalget_2025",
    "Meningsmålinger_forud_for_det_næste_Folketing",
]

POLLS_FILE = Path(__file__).parent.parent / "src" / "data" / "polls.json"

KNOWN_INSTITUTES: dict[str, str] = {
    "voxmeter":       "Voxmeter",
    "yougov":         "YouGov",
    "you gov":        "YouGov",
    "epinion":        "Epinion",
    "megafon":        "Megafon",
    "verian":         "Verian",
    "norstat":        "Norstat",
    "gallup":         "Gallup",
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

# Maps header cell text (lowercase) → PartyLetter
PARTY_HEADER_MAP: dict[str, str] = {
    "a": "A", "socialdemokratiet": "A",
    "b": "B", "radikale venstre": "B", "radikale": "B",
    "c": "C", "konservative": "C", "det konservative folkeparti": "C",
    "f": "F", "sf": "F", "socialistisk folkeparti": "F",
    "h": "H", "borgernes parti": "H",
    "i": "I", "liberal alliance": "I", "la": "I",
    "m": "M", "moderaterne": "M",
    "o": "O", "dansk folkeparti": "O", "df": "O",
    "v": "V", "venstre": "V",
    "æ": "Æ", "danmarksdemokraterne": "Æ", "dd": "Æ",
    "ø": "Ø", "enhedslisten": "Ø",
    "å": "Å", "alternativet": "Å",
}

# Minimum number of party results a row must have to be considered valid
MIN_PARTY_RESULTS = 6

# ─── Fetch ────────────────────────────────────────────────────────────────────

def fetch_wikipedia_html() -> str | None:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Valg2026PollBot/1.0 "
            "(https://github.com/StayCoolDK/Valg2026; educational election tracker)"
        )
    })
    for title in CANDIDATE_TITLES:
        print(f"  Trying article: {title}")
        params = {
            "action":        "parse",
            "page":          title,
            "prop":          "text",
            "format":        "json",
            "formatversion": "2",
        }
        try:
            resp = session.get(WIKIPEDIA_API_URL, params=params, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"  HTTP error: {e}", file=sys.stderr)
            continue

        data = resp.json()
        if "error" in data:
            print(f"  Article not found: {data['error'].get('info', '')}")
            continue

        html = data.get("parse", {}).get("text")
        if html:
            print(f"  Found article: {title}")
            return html

    return None


# ─── Table detection ─────────────────────────────────────────────────────────

def find_poll_table(soup: BeautifulSoup) -> Tag | None:
    """
    Returns the first wikitable whose header row contains ≥6 known party letters.
    This is robust against page restructuring and unrelated tables.
    """
    for table in soup.find_all("table", class_=lambda c: c and "wikitable" in c):
        header_row = table.find("tr")
        if not header_row:
            continue
        headers = [th.get_text(strip=True).lower() for th in header_row.find_all("th")]
        matched = sum(1 for h in headers if h in PARTY_HEADER_MAP)
        if matched >= MIN_PARTY_RESULTS:
            return table
    return None


# ─── Header parsing ──────────────────────────────────────────────────────────

def parse_headers(table: Tag) -> dict[int, str]:
    """
    Returns a mapping of column_index → field_name.
    Field names are party letters ("A".."Å") or named fields
    ("date", "institute", "source", "sampleSize").
    """
    header_row = table.find("tr")
    col_map: dict[int, str] = {}
    col_idx = 0
    for th in header_row.find_all("th"):
        text = th.get_text(strip=True).lower()
        span = int(th.get("colspan", 1))
        if text in PARTY_HEADER_MAP:
            col_map[col_idx] = PARTY_HEADER_MAP[text]
        elif any(kw in text for kw in ("dato", "date", "felt", "periode")):
            col_map[col_idx] = "date"
        elif any(kw in text for kw in ("institut", "pollster", "firma")):
            col_map[col_idx] = "institute"
        elif any(kw in text for kw in ("opdrag", "client", "kilde", "source", "medie")):
            col_map[col_idx] = "source"
        elif any(kw in text for kw in ("størrelse", "stikprøve", "n ", "sample", "antal")):
            col_map[col_idx] = "sampleSize"
        col_idx += span
    return col_map


# ─── Date parsing ─────────────────────────────────────────────────────────────

def parse_date(date_str: str) -> str | None:
    """
    Parses Danish date strings to ISO "YYYY-MM-DD".

    Handles:
      "20. marts 2026"         → "2026-03-20"
      "14.–20. marts 2026"     → "2026-03-20"  (uses end date)
      "14.-20. marts 2026"     → "2026-03-20"
    """
    date_str = date_str.strip()
    # Strip a leading range prefix like "14.–" or "14.-"
    date_str = re.sub(r"^\d{1,2}\.\s*[–\-]\s*", "", date_str)
    m = re.match(r"(\d{1,2})\.\s*(\w+)\s+(\d{4})", date_str)
    if not m:
        return None
    day_str, month_name, year = m.group(1), m.group(2).lower(), m.group(3)
    month = DANISH_MONTHS.get(month_name)
    if not month:
        return None
    return f"{year}-{month:02d}-{int(day_str):02d}"


# ─── Row parsing ──────────────────────────────────────────────────────────────

def parse_row(row: Tag, col_map: dict[int, str]) -> dict | None:
    cells = row.find_all(["td", "th"])
    if not cells:
        return None
    # Skip pure header/separator rows
    if all(c.name == "th" for c in cells):
        return None

    # Build col_index → cell text, respecting colspan
    cell_values: dict[int, str] = {}
    col_idx = 0
    for cell in cells:
        span = int(cell.get("colspan", 1))
        text = cell.get_text(strip=True)
        # Strip footnote superscripts like "[1]"
        text = re.sub(r"\[\d+\]", "", text).strip()
        for s in range(span):
            cell_values[col_idx + s] = text
        col_idx += span

    poll: dict = {"results": {}}
    has_date = False
    has_institute = False

    for idx, field in col_map.items():
        val = cell_values.get(idx, "").strip()
        if not val or val in ("–", "-", "—", ""):
            continue

        if field == "date":
            parsed = parse_date(val)
            if parsed:
                poll["date"] = parsed
                has_date = True

        elif field == "institute":
            canonical = KNOWN_INSTITUTES.get(val.lower().strip())
            if canonical:
                poll["institute"] = canonical
                # Derive source from institute; may be overridden by "source" column
                poll["source"] = INSTITUTE_TO_SOURCE.get(canonical, "")
                has_institute = True

        elif field == "source":
            if "source" not in poll or not poll["source"]:
                poll["source"] = val

        elif field == "sampleSize":
            try:
                poll["sampleSize"] = int(val.replace(".", "").replace(",", "").replace(" ", ""))
            except ValueError:
                pass  # sampleSize is optional

        elif len(field) <= 2:  # party letter
            try:
                poll["results"][field] = float(val.replace(",", ".").strip("%"))
            except ValueError:
                pass

    if not has_date or not has_institute or len(poll["results"]) < MIN_PARTY_RESULTS:
        return None

    poll["id"] = f"{poll['date']}-{poll['institute'].lower().replace(' ', '')}"
    return poll


# ─── Table parsing ────────────────────────────────────────────────────────────

def parse_table(table: Tag) -> list[dict]:
    col_map = parse_headers(table)
    party_cols = [v for v in col_map.values() if len(v) <= 2]
    print(f"  Column map: {col_map}")
    print(f"  Party columns detected: {party_cols}")

    polls = []
    for row in table.find_all("tr")[1:]:
        poll = parse_row(row, col_map)
        if poll:
            polls.append(poll)
    return polls


# ─── File I/O ─────────────────────────────────────────────────────────────────

def load_existing_polls() -> list[dict]:
    if not POLLS_FILE.exists():
        return []
    try:
        with open(POLLS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARNING: Could not load {POLLS_FILE}: {e}", file=sys.stderr)
        return []


def save_polls(polls: list[dict]) -> None:
    with open(POLLS_FILE, "w", encoding="utf-8") as f:
        json.dump(polls, f, ensure_ascii=False, indent=2)
        f.write("\n")  # trailing newline


# ─── Merge ────────────────────────────────────────────────────────────────────

def merge_polls(existing: list[dict], incoming: list[dict]) -> tuple[list[dict], int]:
    """
    Adds polls from `incoming` that don't already exist in `existing` (by id).
    Existing polls are never overwritten.
    Returns (merged_sorted_list, count_of_new_polls).
    """
    existing_ids = {p["id"] for p in existing}
    new_polls = [p for p in incoming if p["id"] not in existing_ids]
    if not new_polls:
        return existing, 0
    merged = existing + new_polls
    merged.sort(key=lambda p: p["date"], reverse=True)
    return merged, len(new_polls)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"Fetching Wikipedia article (trying {len(CANDIDATE_TITLES)} candidates)...")
    html = fetch_wikipedia_html()
    if html is None:
        print("No HTML retrieved — exiting without changes.")
        sys.exit(0)

    soup = BeautifulSoup(html, "lxml")
    table = find_poll_table(soup)
    if table is None:
        print("Could not find a poll table in the article — exiting without changes.")
        sys.exit(0)

    print("Poll table found. Parsing rows...")
    incoming = parse_table(table)
    print(f"Parsed {len(incoming)} valid polls from Wikipedia")

    if not incoming:
        print("No parseable polls — page structure may have changed.")
        sys.exit(0)

    existing = load_existing_polls()
    print(f"Loaded {len(existing)} existing polls from {POLLS_FILE}")

    merged, new_count = merge_polls(existing, incoming)
    print(f"New polls added: {new_count}")

    if new_count == 0:
        print("Already up to date.")
        sys.exit(0)

    save_polls(merged)
    print(f"Saved {len(merged)} polls to {POLLS_FILE}")

    # Exit 1 signals to the GitHub Actions workflow that changes were made
    sys.exit(1)


if __name__ == "__main__":
    main()
