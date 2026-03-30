import os
import base64
import requests
import time

# REPLACE THIS with your actual Lightning Studio URL + /predict
API_URL = "https://8000-01kmx90vykhw2qvba2b96x6273.cloudspaces.litng.ai/predict"
FILE_PATH = "test_scan.nii.gz" # Try swapping this with a .jpg or .png to test the 2D route

def test_inference():
    print(f"Reading {FILE_PATH}...")
    
    # Extract the file extension safely so the server knows how to handle it
    _, file_extension = os.path.splitext(FILE_PATH)
    if FILE_PATH.lower().endswith('.nii.gz'):
        file_extension = '.nii.gz'
        
    with open(FILE_PATH, "rb") as f:
        encoded_string = base64.b64encode(f.read()).decode('utf-8')
        
    payload = {
        "file_data": encoded_string,
        "file_ext": file_extension.lower(),
        "patient_context": "65yo male, presenting with chronic cough and shortness of breath."
    }
    
    print(f"Sending request to {API_URL}...")
    start_time = time.time()
    
    try:
        response = requests.post(API_URL, json=payload)
        response.raise_for_status() 
        
        result = response.json()
        print(f"\n✅ Success! Response received in {time.time() - start_time:.2f} seconds.")
        print("\n--- AI Medical Report ---")
        print(result.get("report", "No text generated."))
        
    except requests.exceptions.RequestException as e:
        print(f"\n❌ API Call Failed: {e}")
        if hasattr(e, 'response') and e.response is not None and e.response.text:
            print(f"Server Error Log: {e.response.text}")

if __name__ == "__main__":
    test_inference()