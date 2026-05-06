import os

def remove_bom(directory):
    count = 0
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            path = os.path.join(directory, filename)
            try:
                with open(path, 'rb') as f:
                    content = f.read()
                if content.startswith(b'\xef\xbb\xbf'):
                    with open(path, 'wb') as f:
                        f.write(content[3:])
                    count += 1
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    return count

dir1 = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\ai_review'
dir2 = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\response'

c1 = remove_bom(dir1)
c2 = remove_bom(dir2)

print(f"Removed BOM from {c1} files in ai_review")
print(f"Removed BOM from {c2} files in response")
