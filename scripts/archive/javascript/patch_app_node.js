const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

const searchStart = sync function renderResults() {
    try {
        const recommendedList = document.getElementById('recommended-list');;

const replaceStart = sync function renderResults(showUpdateToast = false) {
    try {
        const wrapper = document.querySelector('.results-content-wrapper');
        const mapContainer = document.getElementById('map-container');
        if (wrapper) wrapper.classList.add('results-refreshing');
        if (mapContainer) mapContainer.classList.add('results-refreshing');
        
        await new Promise(resolve => setTimeout(resolve, 80));

        const recommendedList = document.getElementById('recommended-list');;

const searchEnd =         const hideMarkersToggle = document.getElementById('hide-others-markers');
        if (hideMarkersToggle) {
            hideMarkersToggle.checked = state.hideLowQualityMarkers;
        }
    } catch (err) {;

const replaceEnd =         const hideMarkersToggle = document.getElementById('hide-others-markers');
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
                    showToast(\已更新 \ 筆結果\, 2000);
                } else if (resultsCount > 0) {
                    showToast(\已為您找到 \ 筆結果\, 2000);
                }
            }
        }, 120);
    } catch (err) {;

const searchToggle =                 renderResults();
                updateUrl();
            }, 20);;

const replaceToggle =                 renderResults(true);
                updateUrl();
            }, 20);;

// Normalize crlf
function norm(s) { return s.replace(/\r\n/g, '\n'); }

appJs = norm(appJs);

if (appJs.includes(norm(searchEnd))) {
    appJs = appJs.replace(norm(searchEnd), norm(replaceEnd));
    appJs = appJs.replace(norm(searchStart), norm(replaceStart));
    appJs = appJs.split(norm(searchToggle)).join(norm(replaceToggle));
    fs.writeFileSync('app.js', appJs, 'utf8');
    console.log("Successfully patched app.js!");
} else {
    console.log("Could not find searchEnd in app.js");
}
