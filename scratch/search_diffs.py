import os

search_str = "AI語意綜合與連鎖/商場規則評估"
for file in ["changes.diff", "changes_utf8.diff"]:
    if os.path.exists(file):
        for enc in ["utf-8-sig", "utf-16", "utf-16le", "utf-16be", "big5"]:
            try:
                with open(file, "r", encoding=enc) as f:
                    for i, line in enumerate(f, 1):
                        if search_str in line:
                            print(f"{file}({enc}):{i}: {line.strip()}")
                break
            except Exception as e:
                pass
