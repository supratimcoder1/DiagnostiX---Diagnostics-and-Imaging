import os
import json
from dotenv import load_dotenv
import typing_extensions as typing
from typing import List
from google import genai
from google.genai import types

# Load environment variables from the .env file in the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(DOTENV_PATH)

# We load both keys
KEY_1 = os.getenv("GEMINI_API_KEY_1")
KEY_2 = os.getenv("GEMINI_API_KEY_2")

def get_client(api_key: str):
    # Debug: print if key is missing (optional, but helpful for user)
    if not api_key:
        # Check if they are in the environment at all
        all_keys = [k for k in os.environ.keys() if "GEMINI" in k]
        raise ValueError(f"API Key is missing or invalid. Found env keys: {all_keys}. Checked path: {DOTENV_PATH}")
    return genai.Client(api_key=api_key)

# ─── DETECTION ENGINE SCHEMA ─────────────────────────────────────────────────
class Finding(typing.TypedDict):
    level: str
    priority_label: str
    confidence_percentage: int
    title: str
    description: str
    bounding_box: List[float]  # [x_min, y_min, x_max, y_max] normalized 0–1

class AnalysisResponse(typing.TypedDict):
    findings: List[Finding]

# ─── EXPLANATION ENGINE SCHEMA ────────────────────────────────────────────────
class ReportFinding(typing.TypedDict):
    level: str
    priority_label: str
    confidence_percentage: int
    title: str
    detailed_description: str

class ReportResponse(typing.TypedDict):
    report_findings: List[ReportFinding]


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — DETECTION ENGINE
# Analyzes the medical image to DETECT and LOCALIZE abnormalities.
# Returns concise, structured findings with bounding boxes.
# ═══════════════════════════════════════════════════════════════════════════════
def analyze_scan(image_path: str) -> dict:
    """
    Uses KEY_1 to analyze the medical scan.
    Acts as a DETECTION ENGINE — identifies and localizes abnormalities.
    Returns a JSON dictionary of concise findings with bounding boxes.
    """
    client = get_client(KEY_1)
    
    import PIL.Image
    img = PIL.Image.open(image_path)
    
    prompt = """
    You are a medical imaging AI specialized in abnormality detection.

    Your ONLY task is to DETECT and LOCALIZE abnormalities in the provided medical scan.
    Do NOT generate a full report. Do NOT write long explanations.

    STRICT RULES:
    - Be concise — 1 line description max per finding
    - Focus only on actionable, clinically significant findings
    - Detect abnormalities and specify their LOCATION via bounding boxes
    - If multiple findings → return multiple entries
    - If the scan is normal → return ONE "success" finding with bounding_box [0, 0, 1, 1]

    For each finding, return:
    - level: strictly one of "danger", "warning", or "success"
    - priority_label: "High Priority", "Review Needed", or "Normal"
    - confidence_percentage: integer (0–100) representing diagnostic certainty
    - title: short diagnosis label (e.g., "Pneumonia", "Fracture", "Cardiomegaly")
    - description: short (1 line max) — what it is and where
    - bounding_box: [x_min, y_min, x_max, y_max] — normalized coordinates (0–1) indicating the region of the abnormality on the image

    BOUNDING BOX RULES:
    - Coordinates are normalized: (0,0) = top-left, (1,1) = bottom-right
    - Be as precise as possible in localizing the abnormality
    - For diffuse/bilateral findings, use a box that covers the affected region
    - For normal scans, use [0, 0, 1, 1]

    OUTPUT: JSON only — an object with a "findings" array.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AnalysisResponse,
            )
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        return {
            "findings": [
                {
                    "level": "warning",
                    "priority_label": "Review Needed",
                    "confidence_percentage": 50,
                    "title": "Model Error",
                    "description": f"Encountered an error: {str(e)}",
                    "bounding_box": [0, 0, 1, 1]
                }
            ]
        }


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — EXPLANATION ENGINE
# Takes the detected findings and generates clinical explanations.
# Does NOT re-interpret the image — reasons purely from structured findings.
# ═══════════════════════════════════════════════════════════════════════════════
def generate_report(image_path: str, diagnosis_data: dict, patient_info: dict) -> dict:
    """
    Uses KEY_2 to generate a comprehensive clinical explanation report.
    Acts as an EXPLANATION ENGINE — expands on detected findings.
    Does NOT re-analyze the image; reasons from the structured findings only.
    """
    client = get_client(KEY_2)
    
    # NOTE: We intentionally do NOT send the image to this model.
    # The report generator should EXPLAIN the findings, not re-detect.
    
    prompt = f"""
    You are a senior medical consultant and diagnostician.

    You are given:
    1. Detected findings from an AI imaging analysis (with locations and confidence levels)
    2. Patient information (if available)

    Your job is to EXPLAIN — not detect. Do NOT re-detect or reinterpret any imaging.
    Use ONLY the provided findings below.

    Detected Findings:
    {json.dumps(diagnosis_data, indent=2)}

    Patient Info:
    {json.dumps(patient_info, indent=2)}

    STRICT RULES:
    - Do NOT invent new findings or conditions not present in the detected findings
    - For each finding, expand into a clinically useful explanation:
      • What the finding means pathophysiologically
      • Possible causes / differential diagnosis
      • Clinical significance and severity assessment
      • Suggested next steps or recommendations (e.g., "HRCT recommended", "clinical correlation required")
    - If a finding has level "success" (normal):
      • Explain why the relevant anatomy appears healthy
      • Briefly rule out common acute abnormalities
    - Use standard medical terminology, structured clearly for a referring physician
    - Maintain an objective, professional, and empathetic clinical tone

    OUTPUT: JSON only — an object with a "report_findings" array.
    Each report finding must have: level, priority_label, confidence_percentage, title, detailed_description.
    The detailed_description should be a thorough clinical explanation (2-4 sentences minimum per finding).
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],  # No image — explanation only
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ReportResponse,
            )
        )
        data = json.loads(response.text)
        return dict(
            report_findings=data.get("report_findings", [])
        )
    except Exception as e:
        return {
            "report_findings": [
                {
                    "level": "warning",
                    "priority_label": "Error",
                    "confidence_percentage": 0,
                    "title": "Report Generation Failed",
                    "detailed_description": str(e)
                }
            ]
        }
