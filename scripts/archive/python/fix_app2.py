import json
import re

log_file = r'C:\Users\aou\.gemini\antigravity\brain\973eca96-7195-45cc-99ac-babef94fe98d\.system_generated\logs\transcript.jsonl'
output = ""

with open(log_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in reversed(lines):
    if 'multi_replace_file_content' in line and '[diff_block_start]' in line:
        data = json.loads(line)
        if 'content' in data:
            content = data['content']
            match = re.search(r'\[diff_block_start\](.*?)\[diff_block_end\]', content, re.DOTALL)
            if match:
                diff = match.group(1)
                # extract deleted lines
                deleted = []
                for d_line in diff.split('\n'):
                    if d_line.startswith('-'):
                        deleted.append(d_line[1:]) # remove '-'
                output = '\n'.join(deleted)
                break

if not output:
    print('Failed to find diff block')
    exit(1)

# Now we find where to insert it in app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

bad_part = app_js[app_js.find('            const searchCard = document.querySelector(\\'.main-search-card\\');'):app_js.find('fallbackHint.classList.remove(\\'hidden\\');') + 42]

# wait, the bad part starts with             const searchCard = document.querySelector('.main-search-card');
# Actually, the diff shows the deleted lines start with:
# -            const searchCard = document.querySelector('.main-search-card');

app_js = app_js.replace(bad_part, output)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print('Extracted', len(output), 'chars')
