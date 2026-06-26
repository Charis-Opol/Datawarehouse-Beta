"""
EcoWarehouse — FastAPI Backend
================================
Run from the project root (Datawarehouse-Beta/):

    uvicorn ecowarehouse.api.server:app --reload --port 8000

Development:  React Vite dev server runs on :5173 and proxies /api → :8000
Production:   Run `npm run build`, then FastAPI serves the dist/ folder directly.
"""

import numpy as np
import duckdb
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ecowarehouse.analytics.queries import QUERIES

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent.parent   # Datawarehouse-Beta/
DB_PATH      = PROJECT_ROOT / "warehouse.duckdb"
DIST_PATH    = PROJECT_ROOT / "dist"                 # Vite production build output

# ── DB connection shared across requests ──────────────────────────────────────
db_connection: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Open DuckDB on startup, close on shutdown."""
    print(f"[EcoWarehouse] Connecting to DuckDB → {DB_PATH}")
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}.\n"
            "Run the ETL pipeline first:  python -m ecowarehouse.main"
        )
    db_connection["con"] = duckdb.connect(database=str(DB_PATH), read_only=True)
    print("[EcoWarehouse] DB connection ready ✓")
    yield
    print("[EcoWarehouse] Closing DB connection.")
    db_connection["con"].close()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="EcoWarehouse API", version="1.0.0", lifespan=lifespan)

# CORS — allow the Vite dev server (port 5173) to call the API (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── API routes ────────────────────────────────────────────────────────────────

@app.get("/api/queries")
async def list_queries():
    """Return the list of available query IDs."""
    return list(QUERIES.keys())


@app.get("/api/sql/{query_id}")
async def get_query_sql(query_id: str):
    """Return the raw SQL text for a given query ID (powers the SQL editor)."""
    if query_id not in QUERIES:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found.")
    return {"query_id": query_id, "sql": QUERIES[query_id].strip()}


@app.get("/api/data/{query_id}")
async def get_query_data(query_id: str):
    """Execute a predefined DuckDB query and return results as JSON."""
    if "con" not in db_connection:
        raise HTTPException(status_code=503, detail="Database not available.")
    if query_id not in QUERIES:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found.")
    try:
        df = db_connection["con"].execute(QUERIES[query_id]).df()
        # Replace NaN / ±Inf with None so they serialise as JSON null
        df_cleaned = df.replace([np.inf, -np.inf], np.nan).where(df.notna(), other=None)
        return df_cleaned.to_dict(orient="records")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query failed: {exc}")


# ── Production static-file serving ───────────────────────────────────────────
# After `npm run build`, serve the Vite output so FastAPI is the single process.

if DIST_PATH.exists():
    assets_path = DIST_PATH / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        """Catch-all: return index.html so React Router works on refresh."""
        index = DIST_PATH / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"detail": "Run `npm run build` first to generate the dist/ folder."}
