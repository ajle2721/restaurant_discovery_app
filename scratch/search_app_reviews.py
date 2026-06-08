with open("app.js", "r", encoding="utf-8") as f:
    content = f.read()

keywords = ["reviews", ".reviews", "['reviews']", '["reviews"]']
for kw in keywords:
    if kw in content:
        print(f"Found keyword '{kw}' in app.js!")
