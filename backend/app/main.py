from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

print("PROJECT_ROOT added to sys.path:", PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse


from app.api.routes_scan import router as scan_router
from app.api.routes_core import router as core_router
from app.api.routes_execution import router as execution_router
from app.api.routes_cache import router as cache_router
from app.api.routes_ml import router as ml_router
from app.api.routes_ews import router as ews_router, start_ews_background, stop_ews_background
from app.api.routes_history import router as history_router
from app.api.routes_patterns import router as patterns_router
from app.api.routes_policy import router as policy_router
from app.api.routes_reputation import router as reputation_router
from app.api.routes_demo import router as demo_router
from app.scanning.scanner import _recompute_metrics
from app.storage.execution_history import init_execution_history

app = FastAPI(title="Alma System Detection Backend", version="0.2.0", description="Modular backend for scanning, compatibility evaluation, execution telemetry, remediation, and ML recommendations.")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False)

app.include_router(scan_router)
app.include_router(core_router)
app.include_router(execution_router)
app.include_router(cache_router)
app.include_router(ml_router)
app.include_router(ews_router)
app.include_router(history_router)
app.include_router(patterns_router)
app.include_router(policy_router)
app.include_router(reputation_router)
app.include_router(demo_router)

BASE_DIR = Path(__file__).resolve().parents[2]
UI_DIR = BASE_DIR / "webui"
index_path = UI_DIR / "index.html"

@app.on_event("startup")
async def startup_event():
    init_execution_history()
    start_ews_background()

@app.on_event("shutdown")
async def shutdown_event():
    stop_ews_background()

@app.get("/", include_in_schema=False)
async def root_redirect():
    if index_path.exists():
        return RedirectResponse(url="/app")
    return {"service": "Alma Backend", "status": "running", "version": "0.2.0"}

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    m = _recompute_metrics()
    return {"precision": m["precision"], "recall": m["recall"], "f1": m["f1"]}

@app.get("/favicon.ico", include_in_schema=False)
@app.head("/favicon.ico", include_in_schema=False)
def favicon():
    fav = UI_DIR / "favicon.ico"
    if fav.exists():
        return FileResponse(str(fav))
    return {"detail": "favicon not found"}

if UI_DIR.is_dir() and index_path.exists():
    static_dir = UI_DIR / "static"
    if static_dir.is_dir():
        app.mount("/app/static", StaticFiles(directory=str(static_dir)), name="app-static")

    @app.get("/app")
    async def app_root():
        return FileResponse(str(index_path))

    @app.get("/app/{path:path}")
    async def app_spa(path: str):
        return FileResponse(str(index_path))

@app.get("/__whoami__")
def __whoami__():
    import sys
    return {"file": __file__, "cwd": os.getcwd(), "python": sys.version, "executable": sys.executable, "ui_dir": str(UI_DIR) if UI_DIR.is_dir() else None, "routes": [getattr(r, "path", None) for r in app.routes]}
