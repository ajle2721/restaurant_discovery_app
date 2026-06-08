import os
import urllib.request
import urllib.error
import json

def load_env():
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()
    elif os.path.exists(".env.txt"):
        with open(".env.txt", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("Error: GEMINI_API_KEY not found in environment!")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
req = urllib.request.Request(url, method="GET")

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        resp_data = json.loads(response.read().decode("utf-8"))
        models = resp_data.get("models", [])
        print(f"Found {len(models)} models:")
        for m in models:
            name = m.get("name")
            display_name = m.get("displayName")
            supported_methods = m.get("supportedGenerationMethods", [])
            if "generateContent" in supported_methods:
                print(f"  - {name} ({display_name})")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"Error: {e}")
