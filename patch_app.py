import os
import re

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# 1. Modify sync function renderResults() {
new_render_start = r'''async function renderResults() {
    try {
        const wrapper = document.querySelector('.results-content-wrapper');
        const mapContainer = document.getElementById('map-container');
        if (wrapper) wrapper.classList.add('results-refreshing');
        if (mapContainer) mapContainer.classList.add('results-refreshing');
        
        await new Promise(resolve => setTimeout(resolve, 80));

        const recommendedList = document.getElementById('recommended-list');'''

app_js = app_js.replace("async function renderResults() {\n    try {\n        const recommendedList = document.getElementById('recommended-list');", new_render_start)
app_js = app_js.replace("async function renderResults() {\r\n    try {\r\n        const recommendedList = document.getElementById('recommended-list');", new_render_start)

# 2. Modify the end of renderResults
end_target = r'''                if (!isWholeCity) {
                    if (!state.expandedRadius) {
                        expandHtml = 或者，您可以嘗試 <a href="#" id="btn-expand-search" style="color: #2563eb; text-decoration: underline; cursor: pointer; font-weight: 700; margin-left: 2px;">擴大搜尋範圍</a>。;
                    } else {
                        expandHtml = （已擴大搜尋範圍）;
                    }
                }
                fallbackHint.innerHTML = ${msg};
                fallbackHint.classList.remove('hidden');
            }
        }
    } catch (e) {'''

new_end = r'''                if (!isWholeCity) {
                    if (!state.expandedRadius) {
                        expandHtml = 或者，您可以嘗試 <a href="#" id="btn-expand-search" style="color: #2563eb; text-decoration: underline; cursor: pointer; font-weight: 700; margin-left: 2px;">擴大搜尋範圍</a>。;
                    } else {
                        expandHtml = （已擴大搜尋範圍）;
                    }
                }
                fallbackHint.innerHTML = ${msg};
                fallbackHint.classList.remove('hidden');
            }
        }

        setTimeout(() => {
            const wrapper = document.querySelector('.results-content-wrapper');
            const mapContainer = document.getElementById('map-container');
            if (wrapper) wrapper.classList.remove('results-refreshing');
            if (mapContainer) mapContainer.classList.remove('results-refreshing');
            
            // Show toast
            const resultsCount = state.currentResults ? state.currentResults.length : 0;
            if (resultsCount > 0 && document.querySelector('.main-header').style.display === 'none') {
                // only show toast if we are already in results view
                showToast(已更新  筆結果, 2000);
            } else if (resultsCount > 0) {
                 showToast(已為您找到  筆結果, 2000);
            }
        }, 120);

    } catch (e) {'''

# replace ignoring newlines
def normalize(s):
    return s.replace('\r\n', '\n')

app_norm = normalize(app_js)
end_norm = normalize(end_target)

if end_norm in app_norm:
    app_norm = app_norm.replace(end_norm, normalize(new_end))
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(app_norm)
    print("Successfully patched renderResults end")
else:
    print("Could not find end of renderResults")
