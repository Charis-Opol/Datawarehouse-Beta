# EcoWarehouse — Real-World Data Warehousing Project

A complete data warehouse built on **real World Bank economic data**,
demonstrating professional ETL, dimensional modelling, and analytical SQL.

---

## Architecture

```
SOURCE (GitHub/World Bank CSVs)
        │
        ▼ [EXTRACT]  etl/extract.py
  data/raw/*.csv
        │
        ▼ [TRANSFORM]  etl/transform.py
  Star Schema DataFrames
        │
        ▼ [LOAD]  etl/load.py
  warehouse.duckdb
        │
        ▼ [API]  api/server.py (FastAPI)
  /api/* endpoints
        │
        ▼ [FRONTEND]  (React/Vite)
  Browser UI
```

## Star Schema

```
              ┌──────────────┐
              │  dim_country │
              │ ─────────── │
              │ country_key  │◄──┐
              │ iso3         │   │
              │ country_name │   │
              │ region       │   │
              │ sub_region   │   │
              │ intermediate │   │
              └──────────────┘   │
                                 │
┌──────────────┐    ┌────────────┴─────┐    ┌──────────────┐
│   dim_time   │    │  fact_economic   │    │dim_indicator │
│ ──────────── │    │ ──────────────── │    │ ──────────── │
│ time_key     │◄───│ fact_key (PK)    │───►│indicator_key │
│ year         │    │ country_key (FK) │    │indicator_code│
│ decade       │    │ time_key   (FK)  │    │indicator_name│
│ era          │    │ indicator_key(FK)│    │ unit         │
│ is_recent    │    │ value            │    │ category     │
└──────────────┘    └──────────────────┘    └──────────────┘
```

## Data Sources (real, free, no auth required)

| Dataset     | URL                                                                 | Rows   |
|-------------|---------------------------------------------------------------------|--------|
| GDP         | github.com/datasets/gdp/master/data/gdp.csv                         | 13,979 |
| Population  | github.com/datasets/population/master/data/population.csv           | 17,195 |
| Country ISO | github.com/datasets/country-codes/master/data/country-codes.csv     | 249    |

All sourced from the [datasets.org](https://github.com/datasets) GitHub organisation
which mirrors World Bank Open Data.

## Warehouse Stats

- **21,136** fact rows
- **215** countries
- **54** African countries
- **34** years (1990–2023)
- **3** indicators (GDP, Population, GDP per Capita derived)

## Key Analytical Queries

1. Top 10 African economies by GDP (2023)
2. East Africa GDP trend 2000–2022 (Uganda, Kenya, Tanzania, Ethiopia, Rwanda, Burundi)
3. EAC GDP per capita comparison (2022)
4. Africa's share of world GDP by era
5. Fastest-growing African economies CAGR 2010–2022
6. Uganda economic profile (full time series)

## Running the Project

```bash
# Install dependencies
pip install duckdb pandas requests

# Run full ETL pipeline
python main.py

# The warehouse is written to warehouse.duckdb
# Query it directly with DuckDB
python -c "
import duckdb
con = duckdb.connect('warehouse.duckdb')
print(con.execute('''
    SELECT c.country_name, t.year, ROUND(f.value/1e9,2) AS gdp_bn
    FROM fact_economic f
    JOIN dim_country c ON f.country_key = c.country_key
    JOIN dim_time t ON f.time_key = t.time_key
    JOIN dim_indicator i ON f.indicator_key = i.indicator_key
    WHERE c.iso3 = 'UGA' AND i.indicator_code = 'GDP'
    ORDER BY t.year
''').df())
"

How to run it
Step 1 — Install Python deps (once):
bashpip install -r requirements.txt

Step 2 — Run the ETL pipeline (if warehouse.duckdb doesn't exist yet):
bashpython -m ecowarehouse.main

Step 3 — Start FastAPI:
bashuvicorn ecowarehouse.api.server:app --reload --port 8000

Step 4 — Install JS deps and start Vite (new terminal):
bashnpm install
npm run dev

Open http://localhost:5173 — Vite proxies all /api/* requests to FastAPI automatically.

For production — build React and let FastAPI serve everything from a single process:
bashnpm run build
uvicorn ecowarehouse.api.server:app --port 8000
```

## Project Structure

```
ecowarehouse/
├── main.py                   # Pipeline orchestrator
├── etl/
│   ├── extract.py            # Download & cache raw CSVs
│   ├── transform.py          # Build star schema DataFrames
│   └── load.py               # Write to DuckDB with DDL
├── analytics/
│   └── queries.py            # BI SQL queries
├── data/
│   └── raw/                  # Cached source CSVs
├── outputs/
│   └── analytics_results.json
└── warehouse.duckdb          # The warehouse (auto-generated)
```

## Concepts Demonstrated

- **Dimensional modelling** — star schema with 3 dimensions + 1 fact table
- **Surrogate keys** — integer PKs decoupled from business keys (iso3, year)
- **ETL pipeline** — extract → transform → load in separate modules
- **Derived facts** — GDP per Capita computed during transform
- **Analytical SQL** — CAGR, era pivots, sub-query filtering, aggregate window
- **OLAP engine** — DuckDB chosen for columnar, in-process analytics

---

Built with Python · DuckDB · pandas · World Bank Open Data
