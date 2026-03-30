"""
═══════════════════════════════════════════════════════════════════════════════
 MEDICAL AI SERVICE — MedGemma via Lightning.ai
 Primary diagnostic engine using MONAI preprocessing + MedGemma inference.
 Falls back to legacy Gemini-based ai_service.py if Lightning server is down.
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import json
import base64
import time
import requests
import re
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(DOTENV_PATH)

# Lightning.ai endpoint — set in .env or defaults to the cloud studio URL
LIGHTNING_API_URL = os.getenv(
    "LIGHTNING_API_URL",
    "https://8000-01kmx90vykhw2qvba2b96x6273.cloudspaces.litng.ai/predict"
)

# Timeout for the Lightning.ai request (seconds)
LIGHTNING_TIMEOUT = int(os.getenv("LIGHTNING_TIMEOUT", "120"))

# Temporary in-memory cache to prevent redundant GPU calls
_medgemma_cache = {}


# ─── LEGACY FALLBACK ─────────────────────────────────────────────────────────
# Import the old Gemini-based functions so we can use them as a safety net
from backend.ai_service import analyze_scan as legacy_analyze_scan
from backend.ai_service import generate_report as legacy_generate_report


def _get_file_extension(file_path: str) -> str:
    """
    Safely extract the file extension, handling compound extensions like .nii.gz
    """
    if file_path.lower().endswith('.nii.gz'):
        return '.nii.gz'
    _, ext = os.path.splitext(file_path)
    return ext.lower()


def _encode_file(file_path: str) -> str:
    """
    Read a file from disk and return its base64-encoded string.
    """
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')


def _build_patient_context(patient_info: dict) -> str:
    """
    Convert the patient_info dict into a concise clinical context string
    that the MedGemma model can reason with.
    """
    if not patient_info:
        return "No patient context available."

    parts = []
    if patient_info.get("age"):
        parts.append(f"{patient_info['age']}yo")
    if patient_info.get("gender"):
        parts.append(patient_info["gender"].lower())
    if patient_info.get("scan_type"):
        parts.append(f"scan type: {patient_info['scan_type']}")
    if patient_info.get("patient_id"):
        parts.append(f"ID: {patient_info['patient_id']}")
    if patient_info.get("previous_condition"):
        parts.append(f"Previous condition: {patient_info['previous_condition']}")

    return ", ".join(parts) if parts else "No patient context available."


def _call_lightning(file_path: str, patient_context: str) -> dict:
    """
    Core function: sends the scan to the Lightning.ai MedGemma endpoint.
    Returns the raw JSON response from the server.
    Raises on any failure (timeout, network error, HTTP error, bad JSON).
    """
    encoded_data = _encode_file(file_path)
    file_ext = _get_file_extension(file_path)

    payload = {
        "file_data": encoded_data,
        "file_ext": file_ext,
        "patient_context": patient_context
    }

    print(f"[MedGemma] Sending request to Lightning.ai ({file_ext})...")
    start = time.time()

    response = requests.post(
        LIGHTNING_API_URL,
        json=payload,
        timeout=LIGHTNING_TIMEOUT
    )
    response.raise_for_status()

    elapsed = time.time() - start
    print(f"[MedGemma] ✅ Response received in {elapsed:.2f}s")

    return response.json()


def _parse_report_into_findings(report_text: str) -> list:
    """
    Parse the MedGemma free-text report into structured findings
    compatible with the frontend schema.
    """
    if not report_text or not report_text.strip():
        return [{
            "level": "success",
            "priority_label": "Normal",
            "confidence_percentage": 85,
            "title": "No Significant Findings",
            "description": "The AI model did not detect notable abnormalities.",
            "bounding_box": [0, 0, 1, 1]
        }]

    report_lower = report_text.lower()
    
    danger_keywords = [
        "malignant", "tumor", "mass", "cancer", "metastas", "fracture",
        "hemorrhage", "embolism", "infarct", "critical", "severe",
        "pneumothorax", "effusion", "obstruction"
    ]
    warning_keywords = [
        "abnormal", "opacity", "consolidation", "nodule", "lesion",
        "inflammation", "edema", "mild", "moderate", "cardiomegaly",
        "atelectasis", "pneumonia", "thickening", "displacement"
    ]

    level = "success"
    priority = "Normal"
    confidence = 88

    for kw in danger_keywords:
        if kw in report_lower:
            level = "danger"
            priority = "High Priority"
            confidence = 92
            break

    if level == "success":
        for kw in warning_keywords:
            if kw in report_lower:
                level = "warning"
                priority = "Review Needed"
                confidence = 85
                break

    # Extract coordinates via Regex
    bounding_box = [0, 0, 1, 1]
    box_match = re.search(r'\[\s*(0\.\d+|0|1\.0|1)\s*,\s*(0\.\d+|0|1\.0|1)\s*,\s*(0\.\d+|0|1\.0|1)\s*,\s*(0\.\d+|0|1\.0|1)\s*\]', report_text)
    if box_match:
        bounding_box = [float(box_match.group(1)), float(box_match.group(2)), float(box_match.group(3)), float(box_match.group(4))]

    # Clean the UI text by separating Findings and Impression
    clean_report = report_text.replace("FINDINGS:", "").strip()
    
    if "IMPRESSION:" in report_text:
        # Use the Impression as the short title
        raw_impression = report_text.split("IMPRESSION:")[1].split("BOUNDING BOX:")[0].strip()
        title = raw_impression[:60] + ("..." if len(raw_impression) > 60 else "")
        
        # Use the detailed Findings as the description
        description_text = report_text.split("FINDINGS:")[1].split("IMPRESSION:")[0].strip()
        description = description_text[:147] + "..." if len(description_text) > 150 else description_text
    else:
        # Fallback if the AI messes up the formatting
        first_sentence = clean_report.split('.')[0].strip()
        title = first_sentence[:60] + ("..." if len(first_sentence) > 60 else "")
        description = clean_report.split('\n')[0].strip()
        description = description[:147] + "..." if len(description) > 150 else description

    # Failsafe clean up for UI presentation
    title = title.replace("BOUNDING BOX:", "").strip()
    description = description.replace("BOUNDING BOX:", "").strip()

    return [{
        "level": level,
        "priority_label": priority,
        "confidence_percentage": confidence,
        "title": title,
        "description": description,
        "bounding_box": bounding_box
    }]


def _parse_report_into_report_findings(report_text: str) -> list:
    """
    Parse the MedGemma free-text report into structured report findings
    compatible with the frontend schema for the full report page.
    """
    if not report_text or not report_text.strip():
        return [{
            "level": "success",
            "priority_label": "Normal",
            "confidence_percentage": 85,
            "title": "No Significant Findings",
            "detailed_description": "The MedGemma AI model analysis returned no notable abnormalities. The scan appears within normal limits. Clinical correlation is always recommended."
        }]

    report_lower = report_text.lower()

    danger_keywords = [
        "malignant", "tumor", "mass", "cancer", "metastas", "fracture",
        "hemorrhage", "embolism", "infarct", "critical", "severe",
        "pneumothorax", "effusion", "obstruction"
    ]
    warning_keywords = [
        "abnormal", "opacity", "consolidation", "nodule", "lesion",
        "inflammation", "edema", "mild", "moderate", "cardiomegaly",
        "atelectasis", "pneumonia", "thickening", "displacement"
    ]

    level = "success"
    priority = "Normal"
    confidence = 88

    for kw in danger_keywords:
        if kw in report_lower:
            level = "danger"
            priority = "High Priority"
            confidence = 92
            break

    if level == "success":
        for kw in warning_keywords:
            if kw in report_lower:
                level = "warning"
                priority = "Review Needed"
                confidence = 85
                break

    # Strip the raw bounding box out of the final narrative so it looks clean
    clean_text = re.sub(r'BOUNDING BOX:.*?\]', '', report_text, flags=re.DOTALL).strip()
    clean_text = re.sub(r'\[\s*(0\.\d+|0|1\.0|1)\s*,\s*(0\.\d+|0|1\.0|1)\s*,\s*(0\.\d+|0|1\.0|1)\s*,\s*(0\.\d+|0|1\.0|1)\s*\]', '', clean_text).strip()

    first_sentence = clean_text.strip().split('.')[0].strip()
    title = first_sentence[:60] + ("..." if len(first_sentence) > 60 else "")

    return [{
        "level": level,
        "priority_label": priority,
        "confidence_percentage": confidence,
        "title": title,
        "detailed_description": clean_text
    }]


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API — Drop-in replacements for the legacy ai_service functions.
# Same signatures, same return schemas. main.py doesn't need to change logic.
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_scan(image_path: str, patient_info: dict = None) -> dict:
    try:
        # Prompt logic is handled by the Lightning server, just build context
        patient_context = _build_patient_context(patient_info)
        
        result = _call_lightning(image_path, patient_context)
        report_text = result.get("report", "")

        # CACHE the raw text output using the file path as the key
        _medgemma_cache[image_path] = report_text

        findings = _parse_report_into_findings(report_text)
        return {"findings": findings}

    except Exception as e:
        print(f"[MedGemma] ❌ Lightning.ai failed: {e}")
        print("[MedGemma] ⚡ Falling back to legacy Gemini engine...")
        return legacy_analyze_scan(image_path)


def generate_report(image_path: str, diagnosis_data: dict, patient_info: dict) -> dict:
    try:
        # Check the cache first before doing anything else
        if image_path in _medgemma_cache:
            print(f"[MedGemma] ⚡ Retrieved report from local cache for {image_path}")
            report_text = _medgemma_cache[image_path]
        else:
            # Fallback network call only if the cache was somehow cleared
            print(f"[MedGemma] ⚠️ Cache miss. Calling Lightning.ai again...")
            patient_context = _build_patient_context(patient_info)
            result = _call_lightning(image_path, patient_context)
            report_text = result.get("report", "")

        report_findings = _parse_report_into_report_findings(report_text)
        return {"report_findings": report_findings}

    except Exception as e:
        print(f"[MedGemma] ❌ Lightning.ai failed for report: {e}")
        print("[MedGemma] ⚡ Falling back to legacy Gemini engine...")
        return legacy_generate_report(image_path, diagnosis_data, patient_info)