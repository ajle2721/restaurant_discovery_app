import os
import urllib.request
import urllib.error
import json
import time

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

# Loop 25 times
success_count = 0
for i in range(1, 26):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={API_KEY}"
    payload = {
        "contents": [{
            "parts": [{
                "text": f"Hello {i}, write a 3-word welcoming message in Traditional Chinese."
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
            success_count += 1
            print(f"Call {i} Success: {text_content.strip()}")
        # Sleep slightly to stay within RPM limit if any
        time.sleep(1.0)
    except urllib.error.HTTPError as e:
        print(f"Call {i} Failed: HTTP Error {e.code}")
        print(e.read().decode("utf-8"))
        break
    except Exception as e:
        print(f"Call {i} Failed: {e}")
        break

print(f"\nTotal successful calls: {success_count}/25")
