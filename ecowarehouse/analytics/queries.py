"""
EcoWarehouse — Analytics Layer
All analytical queries run against the star schema via SQL.
Returns dict of {query_name: list_of_row_dicts} for the dashboard.
"""

import duckdb
import json

QUERIES: dict[str, str] = {

    # ── Q1: Top 10 African GDP (latest year with data) ────────────────────────
    "top10_africa_gdp": """
        SELECT
            c.country_name,
            c.intermediate_region                       AS sub_region,
            t.year,
            ROUND(f.value / 1e9, 2)                    AS gdp_billion_usd
        FROM fact_economic  f
        JOIN dim_country    c  ON f.country_key   = c.country_key
        JOIN dim_time       t  ON f.time_key       = t.time_key
        JOIN dim_indicator  i  ON f.indicator_key  = i.indicator_key
        WHERE c.region = 'Africa'
          AND i.indicator_code = 'GDP'
          AND t.year = (
              SELECT MAX(t2.year)
              FROM fact_economic f2
              JOIN dim_time t2 ON f2.time_key = t2.time_key
              JOIN dim_indicator i2 ON f2.indicator_key = i2.indicator_key
              WHERE i2.indicator_code = 'GDP'
          )
        ORDER BY f.value DESC
        LIMIT 10
    """,

    # ── Q2: East Africa GDP trend 2000–2022 ───────────────────────────────────
    "east_africa_gdp_trend": """
        SELECT
            c.country_name,
            t.year,
            ROUND(f.value / 1e9, 3) AS gdp_billion_usd
        FROM fact_economic  f
        JOIN dim_country    c  ON f.country_key   = c.country_key
        JOIN dim_time       t  ON f.time_key       = t.time_key
        JOIN dim_indicator  i  ON f.indicator_key  = i.indicator_key
        WHERE c.intermediate_region = 'Eastern Africa'
          AND c.country_name IN ('Uganda','Kenya','Tanzania','Rwanda','Ethiopia','Burundi')
          AND i.indicator_code = 'GDP'
          AND t.year BETWEEN 2000 AND 2022
        ORDER BY c.country_name, t.year
    """,

    # ── Q3: EAC GDP per capita 2022 ───────────────────────────────────────────
    "eac_gdp_per_capita": """
        SELECT
            c.country_name,
            ROUND(f.value, 0) AS gdp_per_capita_usd
        FROM fact_economic  f
        JOIN dim_country    c  ON f.country_key   = c.country_key
        JOIN dim_time       t  ON f.time_key       = t.time_key
        JOIN dim_indicator  i  ON f.indicator_key  = i.indicator_key
        WHERE c.country_name IN (
            'Uganda','Kenya','Tanzania','Rwanda',
            'Ethiopia','Burundi','South Sudan'
        )
          AND i.indicator_code = 'GDP_Per_Capita'
          AND t.year = 2022
        ORDER BY f.value DESC
    """,

    # ── Q4: Africa's share of world GDP by era ────────────────────────────────
    "africa_world_gdp_share": """
        SELECT
            t.era,
            ROUND(
                SUM(CASE WHEN c.region = 'Africa' THEN f.value ELSE 0 END)
                / SUM(f.value) * 100,
            2) AS africa_share_pct,
            ROUND(SUM(f.value) / 1e12, 2) AS world_gdp_trillion_usd
        FROM fact_economic  f
        JOIN dim_country    c  ON f.country_key   = c.country_key
        JOIN dim_time       t  ON f.time_key       = t.time_key
        JOIN dim_indicator  i  ON f.indicator_key  = i.indicator_key
        WHERE i.indicator_code = 'GDP'
        GROUP BY t.era
        ORDER BY t.era
    """,

    # ── Q5: Fastest-growing African economies CAGR 2010→2022 ─────────────────
    "fastest_growing_africa": """
        WITH pivoted AS (
            SELECT
                c.country_name,
                MAX(CASE WHEN t.year = 2010 THEN f.value END) AS gdp_2010,
                MAX(CASE WHEN t.year = 2022 THEN f.value END) AS gdp_2022
            FROM fact_economic  f
            JOIN dim_country    c ON f.country_key   = c.country_key
            JOIN dim_time       t ON f.time_key       = t.time_key
            JOIN dim_indicator  i ON f.indicator_key  = i.indicator_key
            WHERE c.region = 'Africa'
              AND i.indicator_code = 'GDP'
            GROUP BY c.country_name
        )
        SELECT
            country_name,
            ROUND(gdp_2010 / 1e9, 2)                               AS gdp_2010_bn,
            ROUND(gdp_2022 / 1e9, 2)                               AS gdp_2022_bn,
            ROUND((POWER(gdp_2022 / gdp_2010, 1.0 / 12) - 1) * 100, 2) AS cagr_pct
        FROM pivoted
        WHERE gdp_2010 > 1e8 AND gdp_2022 > 1e8
        ORDER BY cagr_pct DESC
        LIMIT 10
    """,

    # ── Q6: Uganda economic profile over time ─────────────────────────────────
    "uganda_profile": """
        SELECT
            t.year,
            MAX(CASE WHEN i.indicator_code = 'GDP'           THEN ROUND(f.value / 1e9, 3)  END) AS gdp_billion_usd,
            MAX(CASE WHEN i.indicator_code = 'Population'    THEN ROUND(f.value / 1e6, 3)  END) AS population_millions,
            MAX(CASE WHEN i.indicator_code = 'GDP_Per_Capita'THEN ROUND(f.value, 0)         END) AS gdp_per_capita_usd
        FROM fact_economic  f
        JOIN dim_country    c  ON f.country_key   = c.country_key
        JOIN dim_time       t  ON f.time_key       = t.time_key
        JOIN dim_indicator  i  ON f.indicator_key  = i.indicator_key
        WHERE c.iso3 = 'UGA'
          AND t.year BETWEEN 2000 AND 2022
        GROUP BY t.year
        ORDER BY t.year
    """,

    # ── Q7: Warehouse summary stats ───────────────────────────────────────────
    "warehouse_summary": """
        SELECT
            (SELECT COUNT(DISTINCT c.country_key) FROM fact_economic f
             JOIN dim_country c ON f.country_key=c.country_key)                AS total_countries,
            (SELECT COUNT(DISTINCT c.country_key) FROM fact_economic f
             JOIN dim_country c ON f.country_key=c.country_key
             WHERE c.region='Africa')                                           AS african_countries,
            (SELECT MIN(t.year) FROM dim_time t)                               AS min_year,
            (SELECT MAX(t.year) FROM dim_time t)                               AS max_year,
            (SELECT COUNT(*) FROM fact_economic)                               AS total_facts,
            (SELECT COUNT(DISTINCT i.indicator_key) FROM dim_indicator i)      AS indicators
    """,
}


def run_all(con: duckdb.DuckDBPyConnection) -> dict:
    results = {}
    for name, sql in QUERIES.items():
        df  = con.execute(sql).df()
        results[name] = df.to_dict(orient="records")
        print(f"  ✓ {name:<35} {len(df):>4} rows returned")
    return results


def save_results(results: dict, path: str) -> None:
    with open(path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"  ✓ Saved → {path}")
