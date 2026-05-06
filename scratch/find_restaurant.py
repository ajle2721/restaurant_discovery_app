import os
import json

directory = r'g:\其他電腦\我的電腦\Study\side project\restaurant map\response'
target = "農人餐桌"

for filename in os.listdir(directory):
    if filename.endswith('.json'):
        path = os.path.join(directory, filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                if target in content:
                    print(f"Found in {filename}")
        except:
            pass
