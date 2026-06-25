#!/usr/bin/env python3
"""
EcoWarehouse — Main Pipeline Orchestrator
=========================================
Real-data DW project using World Bank economic data.

Star Schema:
    dim_country ─┐
    dim_time    ─┤──► fact_economic
    dim_indicator┘

Run:
    python main.py
"""

import json
from pathlib import Path

from ecowarehouse.etl.extract   import download_all
from ecowarehouse.etl.transform import build_dim_country, build_dim_time, build_dim_indicator, build_fact_table
from ecowarehouse.etl.load      import load_warehouse
from ecowarehouse.analytics.queries import run_all, save_results

PROJECT_ROOT = Path(__file__).parent.parent


def main():
    print()
    print("╔══════════════════════════════════════════════╗")
    print("║        EcoWarehouse  ETL Pipeline            ║")
    print("║  World Bank Economic Data → DuckDB Star DW  ║")
    print("╚══════════════════════════════════════════════╝")

    # ── 1. EXTRACT ────────────────────────────────────────────────────────────
    print("\n[1/4] EXTRACT  — Downloading real data from GitHub")
    print("─" * 50) 
    frames = download_all()

    # ── 2. TRANSFORM ──────────────────────────────────────────────────────────
    print("\n[2/4] TRANSFORM  — Building star schema dimensions")
    print("─" * 50)

    dim_country   = build_dim_country(frames["country_codes"])
    dim_time      = build_dim_time(min_year=1990, max_year=2023)
    dim_indicator = build_dim_indicator()

    print(f"  ✓ dim_country:   {len(dim_country):,} countries  "
          f"({len(dim_country[dim_country.region=='Africa'])} African)")
    print(f"  ✓ dim_time:      {len(dim_time)} years  ({dim_time.year.min()}–{dim_time.year.max()})")
    print(f"  ✓ dim_indicator: {len(dim_indicator)} indicators")

    fact = build_fact_table(
        frames["gdp"], frames["population"],
        dim_country, dim_time, dim_indicator
    )
    print(f"  ✓ fact_economic: {len(fact):,} rows  "
          f"(GDP + Population + GDP/Capita, 1990–2023)")

    # ── 3. LOAD ───────────────────────────────────────────────────────────────
    print("\n[3/4] LOAD  — Writing to DuckDB warehouse")
    print("─" * 50)
    con = load_warehouse(dim_country, dim_time, dim_indicator, fact, PROJECT_ROOT)

    # ── 4. ANALYTICS ──────────────────────────────────────────────────────────
    print("\n[4/4] ANALYTICS  — Running BI queries")
    print("─" * 50)
    results = run_all(con)
    con.close()
    
    out = PROJECT_ROOT / "outputs/analytics_results.json"
    out.parent.mkdir(exist_ok=True)
    save_results(results, str(out))

    # ── SUMMARY ───────────────────────────────────────────────────────────────
    s = results["warehouse_summary"][0]
    print()
    print("╔══════════════════════════════════════════════╗")
    print("║              WAREHOUSE SUMMARY               ║")
    print("╠══════════════════════════════════════════════╣")
    print(f"║  Total countries in DW  : {s['total_countries']:>6}               ║")
    print(f"║  African countries      : {s['african_countries']:>6}               ║")
    print(f"║  Years covered          : {s['min_year']}–{s['max_year']}            ║")
    print(f"║  Indicators tracked     : {s['indicators']:>6}               ║")
    print(f"║  Total fact rows        : {s['total_facts']:>6,}               ║")
    print("╚══════════════════════════════════════════════╝")
    print("\n✅  Pipeline complete!\n")

    return results


if __name__ == "__main__":
    results = main()

    # Quick print for Uganda
    print("Uganda GDP Profile (2000–2022):")
    print(f"{'Year':<6} {'GDP (B $)':<12} {'Pop (M)':<10} {'GDP/Cap $':<10}")
    print("─" * 40)
    for row in results["uganda_profile"]:
        print(f"{row['year']:<6} {str(row['gdp_billion_usd']):<12} "
              f"{str(row['population_millions']):<10} {str(row['gdp_per_capita_usd'])}")
