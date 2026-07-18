import os

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Replace the end of renderResults
search_end = "        const hideMarkersToggle = document.getElementById('hide-others-markers');\n        if (hideMarkersToggle) {\n            hideMarkersToggle.checked = state.hideLowQualityMarkers;\n        }\n    } catch (err) {"
replace_end = "        const hideMarkersToggle = document.getElementById('hide-others-markers');\n        if (hideMarkersToggle) {\n            hideMarkersToggle.checked = state.hideLowQualityMarkers;\n        }\n\n        setTimeout(() => {\n            const wrapper = document.querySelector('.results-content-wrapper');\n            const mapContainer = document.getElementById('map-container');\n            if (wrapper) wrapper.classList.remove('results-refreshing');\n            if (mapContainer) mapContainer.classList.remove('results-refreshing');\n            \n            if (showUpdateToast && typeof sorted !== 'undefined') {\n                const resultsCount = sorted.length;\n                if (resultsCount > 0 && document.querySelector('.main-header').style.display === 'none') {\n                    showToast(已更新  筆結果, 2000);\n                } else if (resultsCount > 0) {\n                    showToast(已為您找到  筆結果, 2000);\n                }\n            }\n        }, 120);\n    } catch (err) {"

# Replace toggleFilter 1
search_toggle_1 = "                renderResults();\n                updateUrl();\n            }, 20);"
replace_toggle_1 = "                renderResults(true);\n                updateUrl();\n            }, 20);"

if search_end in app_js.replace('\r\n', '\n'):
    print("Found end")
    app_js = app_js.replace('\r\n', '\n').replace(search_end, replace_end).replace(search_toggle_1, replace_toggle_1)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(app_js)
else:
    print("Not found")

