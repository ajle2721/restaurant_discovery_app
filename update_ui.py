import os

filepath = 'app.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update state object
content = content.replace(
    'showLowLevel: false,',
    'showHighLevel: true,\n    showMidLevel: true,\n    showLowLevel: false,'
)

# 2. Add window.toggleCategory function
toggle_func = """
window.toggleCategory = function(level) {
    if (level === 'high') state.showHighLevel = !state.showHighLevel;
    if (level === 'mid') state.showMidLevel = !state.showMidLevel;
    if (level === 'low') state.showLowLevel = !state.showLowLevel;
    renderList();
};
"""
content = content.replace('// Initialization', toggle_func + '\n// Initialization')

# 3. Update handleGeolocation (nearby functionality)
content = content.replace(
    'state.showLowLevel = true; // Show all restaurants within 3km immediately',
    'state.showHighLevel = true;\n            state.showMidLevel = true;\n            state.showLowLevel = true; // Show all restaurants within 3km immediately'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("State and toggles updated.")
