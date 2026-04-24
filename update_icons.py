import os

filepath = 'app.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

eye_show = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
eye_hide = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'

content = content.replace("${state.showHighLevel ? '▲' : '▼'}", f"${{state.showHighLevel ? '{eye_show}' : '{eye_hide}'}}")
content = content.replace("${state.showMidLevel ? '▲' : '▼'}", f"${{state.showMidLevel ? '{eye_show}' : '{eye_hide}'}}")
content = content.replace("${state.showLowLevel ? '▲' : '▼'}", f"${{state.showLowLevel ? '{eye_show}' : '{eye_hide}'}}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Icons updated.")
