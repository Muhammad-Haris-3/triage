"""Fetch and verify the Triage source data.

Reads data/MANIFEST.json, downloads each file, and fails loudly on a checksum
mismatch rather than continuing with different data (M0-T2).

Usage:  python analysis/fetch_data.py
Writes: analysis/data.csv, analysis/IDS_mapping.csv
"""
import hashlib, json, sys, zipfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "analysis"
MANIFEST = json.loads((ROOT / "data" / "MANIFEST.json").read_text(encoding="utf-8"))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(name, spec):
    dest = OUT / name
    if not dest.exists():
        print(f"downloading {name} ...")
        req = urllib.request.Request(spec["url"], headers={"User-Agent": "triage/0.1"})
        with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as fh:
            fh.write(r.read())
    got = sha256(dest)
    if got != spec["sha256"]:
        sys.exit(
            f"CHECKSUM MISMATCH for {name}\n"
            f"  expected {spec['sha256']}\n"
            f"  got      {got}\n"
            "The source has changed. Stop and investigate before running the analysis —\n"
            "every published number assumes the pinned input."
        )
    print(f"  {name}: {dest.stat().st_size:,} bytes, sha256 OK")
    return dest


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, spec in MANIFEST["files"].items():
        path = fetch(name, spec)
        if name.endswith(".zip"):
            with zipfile.ZipFile(path) as z:
                z.extract("IDS_mapping.csv", OUT)
            print("  extracted IDS_mapping.csv")
    print("\nready. now run:  python analysis/m0.py")
