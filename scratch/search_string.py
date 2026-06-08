import os

search_str = "AI語意綜合與連鎖/商場規則評估"
for root, dirs, files in os.walk("."):
    if ".git" in root or "ai_review" in root or "response" in root:
        continue
    for file in files:
        if file.endswith((".py", ".ps1", ".js", ".mjs")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for i, line in enumerate(f, 1):
                        if search_str in line:
                            print(f"{path}:{i}: {line.strip()}")
            except Exception:
                pass
