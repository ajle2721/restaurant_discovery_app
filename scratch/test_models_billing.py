import os
import urllib.request
import json

def load_key():
    for f in ['.env', '.env.txt']:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as file:
                for line in file:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        if k.strip() == 'GEMINI_API_KEY':
                            return v.strip()
    return None

api_key = load_key()
if not api_key:
    print("API Key not found.")
    exit(1)

test_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]

for model in test_models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": "Hello"}]}]
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            resp = json.loads(response.read().decode("utf-8"))
            print(f"Model '{model}': SUCCESS")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"Model '{model}': FAILED (HTTP {e.code}) - {err_body}")
    except Exception as e:
        print(f"Model '{model}': FAILED - {e}")
