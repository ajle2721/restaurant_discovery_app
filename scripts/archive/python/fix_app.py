import json

log_file = r'C:\Users\aou\.gemini\antigravity\brain\973eca96-7195-45cc-99ac-babef94fe98d\.system_generated\logs\transcript.jsonl'
target = []

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['tool_name'] == 'default_api:multi_replace_file_content':
                        args = call['tool_args']
                        if 'app.js' in args.get('TargetFile', ''):
                            chunks = args.get('ReplacementChunks', [])
                            for chunk in chunks:
                                if 'safeScrollIntoView(searchResultsView)' in chunk.get('TargetContent', ''):
                                    target = chunk['TargetContent']
        except:
            pass

if not target:
    print('Could not find TargetContent in logs')
    exit(1)

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the corrupted part.
# The corrupted part is from             } else { down to                 fallbackHint.classList.remove('hidden');
bad_part = content[content.find('            } else {'):content.find('fallbackHint.classList.remove(\\'hidden\\');') + 42]

print('Found bad part length:', len(bad_part))
content = content.replace(bad_part, target)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Restored successfully.')
