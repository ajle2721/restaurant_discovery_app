import os

filepath = 'app.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '    // Store results for map persistence',
    '    updateFilterSummary(eligibleData.length);\n\n    // Store results for map persistence'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("updateFilterSummary restored.")
