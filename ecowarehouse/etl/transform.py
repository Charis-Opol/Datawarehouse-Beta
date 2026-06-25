"""
EcoWarehouse — Transform Layer
Cleans raw data and builds a proper star schema:

  dim_country   — who (country metadata)
  dim_time      — when (year / decade / era)
  dim_indicator — what (GDP, Population, GDP per Capita)
  fact_economic — measurements (the facts)
"""

import pandas as pd
import numpy as np


# ─── DIMENSION: COUNTRY ───────────────────────────────────────────────────────

def build_dim_country(country_codes_df: pd.DataFrame) -> pd.DataFrame:
    """
    Build dim_country using the ISO country codes reference dataset.
    Intermediate Region Name gives East Africa / Western Africa etc.
    """
    df = country_codes_df[[
        "ISO3166-1-Alpha-3",
        "CLDR display name",
        "Region Name",
        "Sub-region Name",
        "Intermediate Region Name",
        "Least Developed Countries (LDC)",
        "Land Locked Developing Countries (LLDC)",
        "Capital",
    ]].copy()

    df.columns = [
        "iso3", "country_name", "region", "sub_region",
        "intermediate_region", "is_ldc", "is_lldc", "capital",
    ]

    # Clean
    df["iso3"]         = df["iso3"].str.strip().str.upper()
    df["country_name"] = df["country_name"].str.strip()
    df["is_ldc"]       = df["is_ldc"].fillna("").str.strip().str.lower() == "x"
    df["is_lldc"]      = df["is_lldc"].fillna("").str.strip().str.lower() == "x"

    df = df.dropna(subset=["iso3", "country_name"])
    df = df.reset_index(drop=True)
    df.insert(0, "country_key", range(1, len(df) + 1))

    return df


# ─── DIMENSION: TIME ──────────────────────────────────────────────────────────

def build_dim_time(min_year: int = 1990, max_year: int = 2023) -> pd.DataFrame:
    """Build a simple annual time dimension."""
    years = list(range(min_year, max_year + 1))
    return pd.DataFrame({
        "time_key":  range(1, len(years) + 1),
        "year":      years,
        "decade":    [f"{(y // 10) * 10}s" for y in years],
        "era":       ["Pre-2000" if y < 2000 else "2000s" if y < 2010 else "2010s" if y < 2020 else "2020s" for y in years],
        "is_recent": [y >= 2015 for y in years],
    })


# ─── DIMENSION: INDICATOR ─────────────────────────────────────────────────────

def build_dim_indicator() -> pd.DataFrame:
    """Static indicator dimension — three metrics."""
    return pd.DataFrame([
        (1, "GDP",           "Gross Domestic Product (current USD)",     "USD",        "Economic"),
        (2, "Population",    "Total Population",                         "Persons",    "Demographic"),
        (3, "GDP_Per_Capita","GDP Per Capita (derived: GDP / Pop)",       "USD/Person", "Economic"),
    ], columns=["indicator_key", "indicator_code", "indicator_name", "unit", "category"])


# ─── FACT TABLE ───────────────────────────────────────────────────────────────

def build_fact_table(
    gdp_df: pd.DataFrame,
    pop_df: pd.DataFrame,
    dim_country: pd.DataFrame,
    dim_time: pd.DataFrame,
    dim_indicator: pd.DataFrame,
) -> pd.DataFrame:

    # Build lookup maps (iso3 → key, year → key, code → key)
    country_map   = dim_country.set_index("iso3")["country_key"].to_dict()
    time_map      = dim_time.set_index("year")["time_key"].to_dict()
    indicator_map = dim_indicator.set_index("indicator_code")["indicator_key"].to_dict()

    def prep(df, code):
        out = df.rename(columns={"Country Code": "iso3", "Year": "year", "Value": "value"})[
            ["iso3", "year", "value"]
        ].copy()
        out["iso3"]           = out["iso3"].str.strip().str.upper()
        out["value"]          = pd.to_numeric(out["value"], errors="coerce")
        out["indicator_code"] = code
        return out.dropna(subset=["value"])

    gdp = prep(gdp_df, "GDP")
    pop = prep(pop_df, "Population")

    # GDP per capita (derived from aligned data)
    merged = gdp.merge(pop, on=["iso3", "year"], suffixes=("_gdp", "_pop"))
    gpc             = merged[["iso3", "year"]].copy()
    gpc["value"]    = merged["value_gdp"] / merged["value_pop"]
    gpc["indicator_code"] = "GDP_Per_Capita"
    gpc = gpc.dropna(subset=["value"])

    combined = pd.concat([gdp, pop, gpc], ignore_index=True)

    # Filter to time window
    combined = combined[
        (combined["year"] >= 1990) &
        (combined["year"] <= 2023)
    ]

    # Resolve surrogate keys
    combined["country_key"]   = combined["iso3"].map(country_map)
    combined["time_key"]      = combined["year"].map(time_map)
    combined["indicator_key"] = combined["indicator_code"].map(indicator_map)

    # Drop rows where we couldn't resolve a key (e.g. regional aggregates)
    fact = combined.dropna(subset=["country_key", "time_key", "indicator_key"]).copy()
    fact[["country_key", "time_key", "indicator_key"]] = (
        fact[["country_key", "time_key", "indicator_key"]].astype(int)
    )

    fact = fact.reset_index(drop=True)
    fact.insert(0, "fact_key", range(1, len(fact) + 1))

    return fact[["fact_key", "country_key", "time_key", "indicator_key", "value"]]
