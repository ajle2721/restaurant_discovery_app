import re

def get_existing_ids(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract place_id from "query_place_id=..."
    ids = re.findall(r'query_place_id=([a-zA-Z0-9_-]+)', content)
    return set(ids)

if __name__ == "__main__":
    ids = get_existing_ids(r'c:\Users\jason\OneDrive\桌面\restaurant map\data.js')
    print(f"Total existing IDs found: {len(ids)}")
    with open('existing_ids.txt', 'w') as f:
        for i in ids:
            f.write(i + '\n')
