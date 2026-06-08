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

print(f"Loaded API Key length: {len(API_KEY)}")
# Mask the API key for security
print(f"Masked API Key: {API_KEY[:4]}...{API_KEY[-4:] if len(API_KEY) > 8 else ''}")

# Simple test call
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={API_KEY}"
payload = {
    "contents": [{
        "parts": [{
            "text": "Hello, write a 3-word welcoming message in Traditional Chinese."
        }]
    }],
    "generationConfig": {
        "temperature": 0.2
    }
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        resp_data = json.loads(response.read().decode("utf-8"))
        text_content = resp_data["candidates"][0]["content"]["parts"][0]["text"]
        print("API Call Success!")
        print(f"Response: {text_content.strip()}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"Error: {e}")
