"""
EcoWarehouse — API Server
Serves the dashboard and provides data via FastAPI.

Run from project root (Datawarehouse-Beta):
  python -m uvicorn ecowarehouse.api.server:app --reload

Then open http://127.0.0.1:8000 in your browser.
"""

import duckdb
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
from pathlib import Path

from ecowarehouse.analytics.queries import QUERIES

# Assume the script is run from the project root (Datawarehouse-Beta)
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "warehouse.duckdb"
HTML_PATH = PROJECT_ROOT / "ecowarehouse_dashboard.html"

db_connection = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifespan. Connect to DB on startup, close on shutdown."""
    print(f"Connecting to DuckDB at {DB_PATH}...")
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. "
            "Please run the main ETL pipeline first."
        )
    db_connection["con"] = duckdb.connect(database=str(DB_PATH), read_only=True)
    print("DB connection established.")
    yield
    print("Closing DB connection.")
    db_connection["con"].close()

app = FastAPI(lifespan=lifespan)

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    """Serves the main HTML dashboard file."""
    if not HTML_PATH.exists():
        return "<html><body><h1>Error: Dashboard HTML not found.</h1></body></html>"
    return HTML_PATH.read_text()

@app.get("/api/data/{query_id}")
async def get_query_data(query_id: str):
    """Runs a predefined analytical query and returns the results as JSON."""
    if "con" not in db_connection:
        raise HTTPException(status_code=503, detail="Database not available.")

    if query_id not in QUERIES:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found.")

    try:
        con = db_connection["con"]
        df = con.execute(QUERIES[query_id]).df()
        # Replace numpy.nan with None for JSON compatibility
        df_cleaned = df.replace({np.nan: None})
        return df_cleaned.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {e}")