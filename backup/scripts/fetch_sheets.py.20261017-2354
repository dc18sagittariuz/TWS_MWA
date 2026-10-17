"""Download each project's Google Sheet tab and save it as <out_dir>/data/<gid>.json.

Run by .github/workflows/sync-sheets.yml, which deploys the result to GitHub Pages
(the data is never committed to the repo). Usage: python fetch_sheets.py <out_dir>

SHEET_ID, each project's gid and its `col` header aliases are read from index.html,
so there is one source of truth. Only columns that the page's buildHeaderMap() would
pick for some project are kept; to show a new column on the site, add its header to
that project's `col` in index.html and this script will keep it automatically.
"""
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

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


OUT.mkdir(parents=True, exist_ok=True)
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

    keep = sorted(set().union(*(used_columns(rows[0], c) for c in col_defs)))
    slim = [[row[i] if i < len(row) else "" for i in keep] for row in rows]
    payload = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "rows": slim}
    (OUT / f"{gid}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"gid {gid}: {len(rows)} rows, kept {len(keep)}/{len(rows[0])} columns: {[rows[0][i] for i in keep]}")

sys.exit(1 if failed else 0)
