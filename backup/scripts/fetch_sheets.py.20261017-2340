"""Download each project's Google Sheet tab as CSV and save it to data/<gid>.json.

Run by .github/workflows/sync-sheets.yml. Reads SHEET_ID and the gids from index.html
so the list stays in one place. Only rewrites a file when its rows changed.
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
html = (ROOT / "index.html").read_text(encoding="utf-8")
sheet_id = re.search(r'SHEET_ID\s*=\s*["\']([\w-]+)', html).group(1)
gids = sorted(set(re.findall(r"gid:\s*'(\d+)'", html)))

out_dir = ROOT / "data"
out_dir.mkdir(exist_ok=True)
failed = False

for gid in gids:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            text = r.read().decode("utf-8-sig")
    except Exception as e:
        print(f"gid {gid}: download failed: {e}", file=sys.stderr)
        failed = True
        continue

    rows = [row for row in csv.reader(io.StringIO(text)) if row]
    if len(rows) < 2:
        print(f"gid {gid}: fewer than 2 rows, keeping previous file", file=sys.stderr)
        failed = True
        continue

    path = out_dir / f"{gid}.json"
    if path.exists() and json.loads(path.read_text(encoding="utf-8")).get("rows") == rows:
        print(f"gid {gid}: unchanged ({len(rows)} rows)")
        continue

    payload = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "rows": rows}
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"gid {gid}: updated ({len(rows)} rows)")

sys.exit(1 if failed else 0)
