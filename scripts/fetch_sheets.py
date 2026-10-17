"""Download each project's Google Sheet tab and save it as <out_dir>/data/<gid>.json.

Run by .github/workflows/sync-sheets.yml, which deploys the result to GitHub Pages
(the data is never committed to the repo). Usage: python fetch_sheets.py <out_dir>

SHEET_ID, each project's gid and its `col` header aliases are read from index.html,
so there is one source of truth. Only columns that the page's buildHeaderMap() would
pick for some project are kept; to show a new column on the site, add its header to
that project's `col` in index.html and this script will keep it automatically.

Large tabs are split by fiscal year so the page can render quickly:
  data/<gid>.json        header + rows of the last RECENT_FYS fiscal years (and undated rows)
  data/<gid>-older.json  header + all older rows (only written when there are any)
Both carry the same fetched_at so the page can tell they belong together.
The run fails (and nothing is deployed) if a project's name/date header is missing.
"""
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RECENT_FYS = 3      # current fiscal year + 2 previous
SPLIT_MIN_ROWS = 5000

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT) / "data"
html = (ROOT / "index.html").read_text(encoding="utf-8")
sheet_id = re.search(r'SHEET_ID\s*=\s*["\']([\w-]+)', html).group(1)

# Same order as buildHeaderMap() in index.html.
ORDER = ['code', 'placeCode', 'name', 'type', 'point', 'date', 'cl', 'turb', 'ph', 'cond', 'iron',
         'color', 'coliform', 'ecoli', 'quality', 'coord', 'branch', 'placeType', 'placeType2', 'province']

# gid -> list of col definitions (several projects can share one tab).
projects = {}
for m in re.finditer(r"gid:\s*'(\d+)'.*?col:\s*\{(.*?)\n\s*\}", html, re.S):
    col = {k: re.findall(r"'([^']*)'", v) for k, v in re.findall(r"(\w+):\[([^\]]*)\]", m.group(2))}
    projects.setdefault(m.group(1), []).append(col)


def norm(s):
    return re.sub(r"\s+", "", (s or "").strip()).lower()


def match_index(header, cols, key):
    """Column index buildHeaderMap() would pick for `key` (honours earlier keys' claims)."""
    normed = [norm(h) for h in header]
    claimed = {}
    for k in ORDER:
        for cand in cols.get(k, []):
            c = norm(cand)
            idx = next((i for i, h in enumerate(normed) if h and i not in claimed.values() and h.startswith(c)), None)
            if idx is not None:
                claimed[k] = idx
                break
    return claimed.get(key)


def used_columns(header, cols):
    """Mirror buildHeaderMap(): return the column indexes it would claim."""
    normed = [norm(h) for h in header]
    claimed = set()
    for key in ORDER:
        for cand in cols.get(key, []):
            c = norm(cand)
            idx = next((i for i, h in enumerate(normed) if h and i not in claimed and h.startswith(c)), None)
            if idx is not None:
                claimed.add(idx)
                break
    return claimed


MONTHS = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}


def fiscal_year(s):
    """Mirror normDate() + fyOf() in index.html. Returns a Buddhist-era FY or None."""
    s = s or ""
    if m := re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", s):
        y, mo = int(m[1]), int(m[2])
    elif m := re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s):
        y, mo = int(m[3]), int(m[2])
    elif (m := re.search(r"(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})", s)) and m[2].lower() in MONTHS:
        y, mo = int(m[3]), MONTHS[m[2].lower()]
        y += 2000 if y < 100 else 0
    else:
        return None
    return (y + 1 if mo >= 10 else y) + 543


def write(name, payload):
    (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


OUT.mkdir(parents=True, exist_ok=True)
fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
failed = False
for gid, col_defs in sorted(projects.items()):
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            text = r.read().decode("utf-8-sig")
    except Exception as e:
        print(f"gid {gid}: download failed: {e}", file=sys.stderr)
        failed = True
        continue

    rows = [row for row in csv.reader(io.StringIO(text)) if row]
    if len(rows) < 2:
        print(f"gid {gid}: fewer than 2 rows", file=sys.stderr)
        failed = True
        continue

    header = rows[0]
    claims = [used_columns(header, c) for c in col_defs]
    missing = [k for c in col_defs for k in ("name", "date") if match_index(header, c, k) is None]
    if missing:
        print(f"gid {gid}: header for {sorted(set(missing))} not found in sheet: {header}", file=sys.stderr)
        failed = True
        continue

    keep = sorted(set().union(*claims))
    slim = [[row[i] if i < len(row) else "" for i in keep] for row in rows]
    print(f"gid {gid}: {len(rows)} rows, kept {len(keep)}/{len(header)} columns: {[header[i] for i in keep]}")

    date_idx = keep.index(match_index(header, col_defs[0], "date"))
    fys = [fiscal_year(r[date_idx]) for r in slim[1:]]
    known = [f for f in fys if f is not None]
    if len(slim) > SPLIT_MIN_ROWS and known:
        # Cap at today's FY so a typo'd future date can't push real data into "older".
        now = datetime.now(timezone.utc)
        today_fy = (now.year + 1 if now.month >= 10 else now.year) + 543
        cutoff = min(max(known), today_fy) - RECENT_FYS + 1
        recent = [r for r, f in zip(slim[1:], fys) if f is None or f >= cutoff]
        older = [r for r, f in zip(slim[1:], fys) if f is not None and f < cutoff]
    else:
        cutoff, recent, older = None, slim[1:], []

    write(f"{gid}.json", {"fetched_at": fetched_at, "recent_from_fy": cutoff,
                          "has_older": bool(older), "rows": [slim[0]] + recent})
    if older:
        write(f"{gid}-older.json", {"fetched_at": fetched_at, "rows": [slim[0]] + older})
    print(f"  recent (FY >= {cutoff}): {len(recent)} rows, older: {len(older)} rows")

sys.exit(1 if failed else 0)
