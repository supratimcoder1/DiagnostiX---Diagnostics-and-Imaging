from fastapi import FastAPI, Request, File, UploadFile
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import uuid
import shutil
from typing import Dict
from backend.medical_ai_service import analyze_scan, generate_report
import json

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
STATIC_DIR = os.path.join(FRONTEND_DIR, "static")
TEMPLATES_DIR = os.path.join(FRONTEND_DIR, "templates")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
DB_FILE = os.path.join(BASE_DIR, "db.json")

app = FastAPI(title="DiagnostiX")

# Disk-backed Memory DB
def load_db() -> Dict[str, dict]:
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_db(data: Dict[str, dict]):
    with open(DB_FILE, "w") as f:
        json.dump(data, f)

db: Dict[str, dict] = load_db()

# Ensure static directories exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Templates setup
templates = Jinja2Templates(directory=TEMPLATES_DIR)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(
        request=request, name="index.html", context={}
    )

@app.get("/diagnostics", response_class=HTMLResponse)
async def view_diagnostics(request: Request):
    return templates.TemplateResponse(
        request=request, name="diagnostics.html", context={}
    )

@app.get("/report", response_class=HTMLResponse)
async def view_report(request: Request):
    return templates.TemplateResponse(
        request=request, name="report.html", context={}
    )

def clear_uploads():
    """Delete all files in the uploads directory and clear the database."""
    global db
    if os.path.exists(UPLOADS_DIR):
        for filename in os.listdir(UPLOADS_DIR):
            file_path = os.path.join(UPLOADS_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f'Failed to delete {file_path}. Reason: {e}')
    db = {}
    save_db(db)

@app.post("/api/upload")
def upload_image(file: UploadFile = File(...)):
    clear_uploads()
    scan_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    file_path = os.path.join(UPLOADS_DIR, f"{scan_id}.{ext}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db[scan_id] = {
        "file_path": file_path,
        "file_ext": ext.upper(),
        "patient_info": {},
        "diagnosis": None,
        "report": None
    }
    save_db(db)
    return {"scan_id": scan_id, "status": "success"}

@app.get("/api/scan_info/{scan_id}")
def scan_info_api(scan_id: str):
    record = db.get(scan_id)
    if not record:
        return {"error": "Scan not found"}
    return {
        "file_ext": record.get("file_ext", "UNKNOWN"),
        "has_patient_info": bool(record.get("patient_info"))
    }

from pydantic import BaseModel

class PatientInfo(BaseModel):
    patient_id: str = ""
    age: str = ""
    gender: str = ""
    scan_type: str = ""
    previous_condition: str = ""

@app.post("/api/save_patient_info/{scan_id}")
def save_patient_info(scan_id: str, info: PatientInfo):
    record = db.get(scan_id)
    if not record:
        return {"error": "Scan not found"}
    # Save the patient info to the db record
    record["patient_info"] = info.dict()
    save_db(db)
    return {"status": "success"}

@app.get("/api/analyze/{scan_id}")
def analyze_api(scan_id: str):
    record = db.get(scan_id)
    if not record:
        return {"error": "Scan not found"}
    if not record["diagnosis"]:
        try:
            diagnosis_data = analyze_scan(record["file_path"])
            record["diagnosis"] = diagnosis_data
            save_db(db)
        except Exception as e:
            return {"error": str(e)}
    return record["diagnosis"]

@app.get("/api/report_data/{scan_id}")
def report_api(scan_id: str):
    record = db.get(scan_id)
    if not record:
        return {"error": "Scan not found"}
    if not record["report"]:
        try:
            # Pass the saved patient_info to generate_report
            patient_info = record.get("patient_info", {})
            report_data = generate_report(record["file_path"], record.get("diagnosis", {}), patient_info)
            record["report"] = report_data
            save_db(db)
        except Exception as e:
            return {"error": str(e)}
    
    # Return both report and the patient info so frontend can render it
    return {
        "report_findings": record["report"].get("report_findings", []),
        "patient_info": record.get("patient_info", {})
    }

@app.get("/api/image/{scan_id}")
def serve_image(scan_id: str):
    record = db.get(scan_id)
    if not record or not os.path.exists(record["file_path"]):
        return {"error": "Image not found"}
    return FileResponse(record["file_path"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True, reload_excludes=["backend/uploads/*", "backend/db.json", "*/db.json", "*/uploads/*"])
