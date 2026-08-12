#!/usr/bin/env python3
"""Validate sranko place-catalog.json (source of truth under resources/)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "spring_backend/src/main/resources/sranko/place-catalog.json"


def main() -> None:
    data = json.loads(OUT.read_text(encoding="utf-8"))
    assert isinstance(data, list) and data, "catalog empty"
    for i, row in enumerate(data):
        for key in ("name", "region", "country", "lat", "lon", "aliases"):
            assert key in row, f"row {i} missing {key}"
        assert isinstance(row["aliases"], list) and row["aliases"]
    print(f"ok: {len(data)} places in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
