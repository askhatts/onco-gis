"""
FastAPI backend — serves pre-processed JSON from frontend/public/.
Accepts file uploads via admin panel (requires SHA-256 password hash header).
All heavy aggregation is done by scripts/process_*.py after upload.
"""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

_default_public = pathlib.Path(__file__).parent.parent / "frontend" / "public"
PUBLIC  = pathlib.Path(os.environ.get("PUBLIC_DIR", str(_default_public)))
RAWS    = PUBLIC.parent.parent / "raws"
SCRIPTS = PUBLIC.parent.parent / "scripts"

# Admin password: SHA-256 hex of the plain-text password.
# Default = SHA-256("admin2024"). Override via ADMIN_PASSWORD_HASH env var.
_DEFAULT_HASH = hashlib.sha256(b"admin2024").hexdigest()
ADMIN_HASH = os.environ.get("ADMIN_PASSWORD_HASH", _DEFAULT_HASH)
if ADMIN_HASH == _DEFAULT_HASH:
    print("WARNING: Using default admin password 'admin2024'. "
          "Set ADMIN_PASSWORD_HASH env var to override.")

app = FastAPI(title="Онко-ГИС API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ──────────────────────────────────────────────────────────────────

def load_json(name: str):
    path = PUBLIC / name
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{name} not found — run scripts first")
    return json.loads(path.read_text(encoding="utf-8"))


def check_auth(x_admin_hash: str | None):
    if not x_admin_hash or x_admin_hash != ADMIN_HASH:
        raise HTTPException(status_code=401, detail="Unauthorized")


def run_script(script_name: str):
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / script_name)],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Script error: {result.stderr[-500:]}")


# ── read endpoints ────────────────────────────────────────────────────────────

@app.get("/api/districts/geojson")
def districts_geojson():
    return load_json("abay_districts.geojson")


@app.get("/api/mos")
def mos():
    return load_json("mos.json")


@app.get("/api/meta")
def meta():
    try:
        return load_json("meta.json")
    except HTTPException:
        return {"years": [], "quarters": [1, 2, 3, 4]}


@app.get("/api/epidemiology")
def epidemiology():
    try:
        return load_json("epidemiology.json")
    except HTTPException:
        return {"indicators": [], "data": []}


@app.get("/api/screening/{screen_type}")
def screening(screen_type: str):
    mapping = {"РМЖ": "screening_rmzh.json", "КРР": "screening_krr.json", "РШМ": "screening_rshm.json"}
    filename = mapping.get(screen_type)
    if not filename:
        raise HTTPException(status_code=400, detail=f"Unknown screening type: {screen_type}")
    return load_json(filename)


@app.get("/api/dashboard/summary")
def dashboard_summary():
    try:
        rmzh = load_json("screening_rmzh.json")
        krr  = load_json("screening_krr.json")
        rshm = load_json("screening_rshm.json")
    except HTTPException:
        return {"error": "screening data not yet processed"}

    all_mo = {m["mo_name"] for m in rmzh} | {m["mo_name"] for m in krr} | {m["mo_name"] for m in rshm}

    def avg_coverage(data):
        valid = [r for r in data if r["completed"] > 0]
        return round(sum(r["coverage_pct"] for r in valid) / len(valid), 1) if valid else 0

    return {
        "mo_count": len(all_mo),
        "rmzh_coverage_pct": avg_coverage(rmzh),
        "krr_coverage_pct": avg_coverage(krr),
        "rshm_coverage_pct": avg_coverage(rshm),
        "rmzh_zno": sum(r["zno"] for r in rmzh),
        "krr_zno":  sum(r["zno"] for r in krr),
        "rshm_zno": sum(r["zno"] for r in rshm),
    }


# ── admin endpoints ───────────────────────────────────────────────────────────

@app.post("/api/admin/auth")
async def admin_auth(body: dict = Body(...)):
    pwd_hash = body.get("hash", "")
    if pwd_hash != ADMIN_HASH:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"ok": True}


@app.post("/api/admin/process-all")
async def process_all(x_admin_hash: str | None = Header(None)):
    check_auth(x_admin_hash)
    for script in ["process_screening.py", "process_epidemiology.py"]:
        run_script(script)
    return {"ok": True}


@app.post("/api/upload/epidemiology")
async def upload_epidemiology(
    file: UploadFile = File(...),
    x_admin_hash: str | None = Header(None),
):
    check_auth(x_admin_hash)
    RAWS.mkdir(parents=True, exist_ok=True)
    dest = RAWS / "template_epidemiology-2.xlsx"
    dest.write_bytes(await file.read())
    run_script("process_epidemiology.py")
    return {"ok": True, "records_file": "epidemiology.json"}


@app.post("/api/upload/screening/{screen_type}")
async def upload_screening(
    screen_type: str,
    file: UploadFile = File(...),
    x_admin_hash: str | None = Header(None),
):
    check_auth(x_admin_hash)
    file_map = {
        "РМЖ": "РМЖ (1)бн.xlsx",
        "КРР": "КРР (1)бн.xlsx",
        "РШМ": "РШМ (1)бн.xlsx",
    }
    if screen_type not in file_map:
        raise HTTPException(status_code=400, detail=f"Unknown type: {screen_type}")
    RAWS.mkdir(parents=True, exist_ok=True)
    dest = RAWS / file_map[screen_type]
    dest.write_bytes(await file.read())
    run_script("process_screening.py")
    return {"ok": True, "type": screen_type}


@app.get("/api/template/epidemiology")
async def template_epidemiology():
    path = RAWS / "template_epidemiology.xlsx"
    if not path.exists():
        run_script("process_epidemiology.py")
    if not path.exists():
        raise HTTPException(404, "Template not found")
    return FileResponse(str(path), filename="template_epidemiology.xlsx",
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ── frontend serving ──────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return RedirectResponse(url="/app.html")


# Serve everything from frontend/public (geojson, screening_*.json, app.html, etc.)
if PUBLIC.exists():
    app.mount("/", StaticFiles(directory=str(PUBLIC)), name="public")
