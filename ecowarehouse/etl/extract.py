"""
EcoWarehouse — Extract Layer
Downloads real World Bank economic data hosted on GitHub (datasets.org).
"""

import requests
import pandas as pd
from pathlib import Path

RAW_DIR = Path(__file__).parent.parent.parent / "data/raw"

SOURCES = {
    "gdp": "https://raw.githubusercontent.com/datasets/gdp/master/data/gdp.csv",
    "population": "https://raw.githubusercontent.com/datasets/population/master/data/population.csv",
    "country_codes": "https://raw.githubusercontent.com/datasets/country-codes/master/data/country-codes.csv",
}


def download_all(force=False) -> dict[str, pd.DataFrame]:
    """Download all source CSVs, cache locally, return DataFrames."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    frames = {}

    for name, url in SOURCES.items():
        path = RAW_DIR / f"{name}.csv"

        if path.exists() and not force:
            print(f"  ↑ {name}: using cached copy")
            frames[name] = pd.read_csv(path, low_memory=False)
        else:
            print(f"  ↓ {name}: downloading from {url}")
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            path.write_bytes(resp.content)
            frames[name] = pd.read_csv(path, low_memory=False)

        rows = len(frames[name])
        cols = list(frames[name].columns)
        print(f"     └─ {rows:,} rows  |  columns: {cols}")

    return frames
