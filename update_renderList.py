import re

filepath = 'app.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the section from "    // Group into Primary (高+中) and Secondary (資訊不足)" 
# to the end of the `renderList()` function with our new logic.

start_marker = "    // Group into Primary"
end_marker = "    // Store results for map persistence"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_logic = """    // Group into High, Mid, Low
    const highData = eligibleData.filter(r => r.parent_friendly_level === '高');
    const midData = eligibleData.filter(r => r.parent_friendly_level === '中');
    const lowData = eligibleData.filter(r => r.parent_friendly_level === '資訊不足');

    if (highData.length === 0 && midData.length === 0 && lowData.length === 0) {
        renderEmptyState();
        resultsCount.innerHTML = `
            <div style="background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.5rem; font-weight: 600; line-height: 1.6;">
                <div style="display: flex; align-items: center;"><div style="display:inline-block; width:10px; height:10px; background:#4FB3AA; border-radius:50%; margin-right:0.5rem;"></div>適合帶小孩：0 間</div>
                <div style="display: flex; align-items: center;"><div style="display:inline-block; width:10px; height:10px; background:#FFB347; border-radius:50%; margin-right:0.5rem;"></div>可能適合：0 間</div>
                <div style="display: flex; align-items: center;"><div style="display:inline-block; width:10px; height:10px; background:#CBD5E1; border-radius:50%; margin-right:0.5rem;"></div>資訊較少：0 間</div>
            </div>
        `;
        renderMap([]);
        return;
    }

    resultsCount.innerHTML = `
        <div style="background: var(--card-bg); padding: 0.5rem; border-radius: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.5rem; font-weight: 600; line-height: 1.6;">
            <div onclick="toggleCategory('high')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                <div style="display: flex; align-items: center;"><div style="display:inline-block; width:10px; height:10px; background:#4FB3AA; border-radius:50%; margin-right:0.5rem;"></div>適合帶小孩：${highData.length} 間</div>
                <div style="color: var(--text-muted);">${state.showHighLevel ? '▲' : '▼'}</div>
            </div>
            <div onclick="toggleCategory('mid')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                <div style="display: flex; align-items: center;"><div style="display:inline-block; width:10px; height:10px; background:#FFB347; border-radius:50%; margin-right:0.5rem;"></div>可能適合：${midData.length} 間</div>
                <div style="color: var(--text-muted);">${state.showMidLevel ? '▲' : '▼'}</div>
            </div>
            <div onclick="toggleCategory('low')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                <div style="display: flex; align-items: center;"><div style="display:inline-block; width:10px; height:10px; background:#CBD5E1; border-radius:50%; margin-right:0.5rem;"></div>資訊較少：${lowData.length} 間</div>
                <div style="color: var(--text-muted);">${state.showLowLevel ? '▲' : '▼'}</div>
            </div>
        </div>
    `;

    // Render Data based on toggles
    if (state.showHighLevel && highData.length > 0) {
        highData.forEach(res => renderCard(res));
    }
    if (state.showMidLevel && midData.length > 0) {
        midData.forEach(res => renderCard(res));
    }
    if (state.showLowLevel && lowData.length > 0) {
        lowData.forEach(res => renderCard(res));
    }

"""
    content = content[:start_idx] + new_logic + content[end_idx:]
    
    # Also update lastFilteredResults to only include what's currently shown
    content = content.replace(
        "state.lastFilteredResults = state.showLowLevel ? eligibleData : primaryData;",
        "let mapData = [];\n    if (state.showHighLevel) mapData = mapData.concat(highData);\n    if (state.showMidLevel) mapData = mapData.concat(midData);\n    if (state.showLowLevel) mapData = mapData.concat(lowData);\n    state.lastFilteredResults = mapData;"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Render list updated.")
else:
    print("Could not find markers.")
