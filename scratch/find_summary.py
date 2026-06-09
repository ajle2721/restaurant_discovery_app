with open('app.js', 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if 'patchAiSummary' in line:
            print(f'{idx+1}: {line.strip()}')
