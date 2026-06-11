import json

log_path = r'C:\Users\aou\.gemini\antigravity\brain\973eca96-7195-45cc-99ac-babef94fe98d\.system_generated\logs\transcript.jsonl'

diff_output = ""
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if '@@ -630,984 +630,6 @@' in line:
            data = json.loads(line)
            # Find the output string in the json structure
            def find_diff(d):
                if isinstance(d, dict):
                    if 'output' in d and isinstance(d['output'], str) and '@@ -630,984 +630,6 @@' in d['output']:
                        return d['output']
                    for k, v in d.items():
                        res = find_diff(v)
                        if res: return res
                elif isinstance(d, list):
                    for v in d:
                        res = find_diff(v)
                        if res: return res
                return None
            diff_output = find_diff(data)
            if diff_output:
                break

if diff_output:
    lines = diff_output.split('\n')
    extracted = []
    in_block = False
    for line in lines:
        if line.startswith('@@ -630,984 +630,6 @@'):
            in_block = True
            continue
        if in_block:
            if line.startswith('@@'):
                break
            # If line is deleted, we want to keep it
            if line.startswith('-'):
                extracted.append(line[1:]) # remove the '-'
            elif line.startswith(' '):
                # Context line, do not include in our extracted block because they weren't deleted
                pass

    with open('recovered.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(extracted))
    print(f"Recovered {len(extracted)} lines into recovered.txt")
else:
    print("Could not find the diff output.")
