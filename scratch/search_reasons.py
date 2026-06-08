import os

search_strings = ["Google 官方親子標籤與評論", "AI語意綜合與連鎖/商場規則評估", "AI語意綜合與連鎖/商場與評論語意分析"]
for root, dirs, files in os.walk("."):
    if ".git" in root or "ai_review" in root or "response" in root:
        continue
    for file in files:
        if file.endswith((".py", ".ps1", ".js", ".mjs")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for i, line in enumerate(f, 1):
                        for s in search_strings:
                            if s in line:
                                print(f"{path}:{i}: ({s}) -> {line.strip()}")
            except Exception:
                pass
