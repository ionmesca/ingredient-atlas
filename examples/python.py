import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / "data" / "manifest.compact.json"

with manifest_path.open("r", encoding="utf-8") as handle:
    manifest = json.load(handle)

slug = sorted(manifest["recordsBySlug"])[0]
record = manifest["recordsBySlug"][slug]
image = record["images"]["webp512"]

print(record["slug"], image["path"], record["license"]["status"])
