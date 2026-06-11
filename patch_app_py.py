with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = ""        const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) {
            hideMarkersToggle.checked = state.hideLowQualityMarkers;
        }
    } catch (err) {"""

replacement = ""        const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) {
            hideMarkersToggle.checked = state.hideLowQualityMarkers;
        }

        setTimeout(() => {
            const wrapper = document.querySelector('.results-content-wrapper');
            const mapContainer = document.getElementById('map-container');
            if (wrapper) wrapper.classList.remove('results-refreshing');
            if (mapContainer) mapContainer.classList.remove('results-refreshing');
            
            if (showUpdateToast && typeof sorted !== 'undefined') {
                const resultsCount = sorted.length;
                if (resultsCount > 0 && document.querySelector('.main-header').style.display === 'none') {
                    showToast(已更新  + '' +  筆結果, 2000);
                } else if (resultsCount > 0) {
                    showToast(已為您找到  + '' +  筆結果, 2000);
                }
            }
        }, 120);
    } catch (err) {"""

target2 = "                renderResults();\n                updateUrl();\n            }, 20);"
replacement2 = "                renderResults(true);\n                updateUrl();\n            }, 20);"

target_norm = target.replace('\r', '')
replacement_norm = replacement.replace('\r', '')
content_norm = content.replace('\r', '')

if target_norm in content_norm:
    content_norm = content_norm.replace(target_norm, replacement_norm)
    content_norm = content_norm.replace(target2, replacement2)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content_norm)
    print('Patched successfully!')
else:
    print('Could not find target block!')
