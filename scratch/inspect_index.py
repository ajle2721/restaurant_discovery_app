import os

base_dir = os.getcwd()
index_root = os.path.join(base_dir, "index.js")
index_ai = os.path.join(base_dir, "ai_review", "index.js")

print("Checking index.js paths:")
for path in [index_root, index_ai]:
    if os.path.exists(path):
        size = os.path.getsize(path)
        print(f"{path}: Exists, size={size} bytes")
        with open(path, "r", encoding="utf-8") as f:
            head = f.read(200)
            print(f"  Head: {head[:150]}...")
    else:
        print(f"{path}: Does not exist")
