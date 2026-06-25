"""
EcoWarehouse — Load Layer
Creates DuckDB tables with explicit schemas and foreign key declarations.
"""

import duckdb
import pandas as pd
from pathlib import Path

DDL = {
    "dim_country": """
        CREATE TABLE dim_country (
            country_key       INTEGER PRIMARY KEY,
            iso3              VARCHAR(3) NOT NULL,
            country_name      VARCHAR(100) NOT NULL,
            region            VARCHAR(50),
            sub_region        VARCHAR(50),
            intermediate_region VARCHAR(50),
            is_ldc            BOOLEAN,
            is_lldc           BOOLEAN,
            capital           VARCHAR(100)
        )
    """,

    "dim_time": """
        CREATE TABLE dim_time (
            time_key  INTEGER PRIMARY KEY,
            year      INTEGER NOT NULL,
            decade    VARCHAR(10),
            era       VARCHAR(10),
            is_recent BOOLEAN
        )
    """,

    "dim_indicator": """
        CREATE TABLE dim_indicator (
            indicator_key  INTEGER PRIMARY KEY,
            indicator_code VARCHAR(20) NOT NULL,
            indicator_name VARCHAR(200) NOT NULL,
            unit           VARCHAR(30),
            category       VARCHAR(30)
        )
    """,

    "fact_economic": """
        CREATE TABLE fact_economic (
            fact_key      INTEGER PRIMARY KEY,
            country_key   INTEGER NOT NULL REFERENCES dim_country(country_key),
            time_key      INTEGER NOT NULL REFERENCES dim_time(time_key),
            indicator_key INTEGER NOT NULL REFERENCES dim_indicator(indicator_key),
            value         DOUBLE NOT NULL
        )
    """,
}


def load_warehouse(
    dim_country: pd.DataFrame,
    dim_time: pd.DataFrame,
    dim_indicator: pd.DataFrame,
    fact: pd.DataFrame,
    project_root: Path,
) -> duckdb.DuckDBPyConnection:
    """Drop, recreate and populate the warehouse. Returns open connection."""

    db_path = project_root / "warehouse.duckdb"
    if db_path.exists():
        db_path.unlink()

    con = duckdb.connect(str(db_path))

    load_order = [
        ("dim_country",   dim_country),
        ("dim_time",      dim_time),
        ("dim_indicator", dim_indicator),
        ("fact_economic", fact),
    ]

    for table_name, df in load_order:
        con.execute(DDL[table_name])
        con.execute(f"INSERT INTO {table_name} SELECT * FROM df")
        count = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        print(f"  ✓ {table_name:<20} {count:>8,} rows")

    return con
