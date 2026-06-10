const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/window\.addEventListener\('popstate', \(\) => \{\s*console\.log\('Popstate detected, syncing view with URL\.\.\.'\);\s*const useAnimation = state\.isUiNavigation;\s*state\.isUiNavigation = false;\s*syncStateFromUrl\(false, useAnimation\);\s*\}\);/, `window.addEventListener('popstate', (e) => {
    console.log('Popstate detected, syncing view with URL...');
    const useAnimation = state.isUiNavigation;
    state.isUiNavigation = false;
    
    if (e.state && e.state.view) {
        if (state.view !== e.state.view) {
            switchView(e.state.view, useAnimation);
        }
    } else if (state.view === 'detail') {
        switchView('home', useAnimation);
    }
    
    syncStateFromUrl(false, useAnimation);
});`);

code = code.replace(/function updateUrl\(push = false\) \{\s*const newUrl = getShareUrl\(\);\s*if \(push\) \{\s*window\.history\.pushState\(\{ view: state\.view \}, '', newUrl\);\s*\} else \{\s*window\.history\.replaceState\(\{ view: state\.view \}, '', newUrl\);\s*\}\s*\}/, `function updateUrl(push = false) {
    const newUrl = getShareUrl();
    if (push) {
        if (window.location.href === newUrl && window.history.state && window.history.state.view === state.view) {
            return;
        }
        window.history.pushState({ view: state.view }, '', newUrl);
    } else {
        window.history.replaceState({ view: state.view }, '', newUrl);
    }
}`);

// We need to carefully replace patchAiSummary without matching too much or too little.
const lines = code.split('\n');
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function patchAiSummary(restaurant, summary) {')) {
        start = i;
    }
    if (start !== -1 && lines[i].startsWith('}')) {
        if (i > start + 10) {
            end = i;
            break;
        }
    }
}
if (start !== -1 && end !== -1) {
    lines.splice(start, end - start + 1, 'function patchAiSummary(restaurant, summary) {\n    return summary || "";\n}');
    code = lines.join('\n');
} else {
    console.log('Failed to find patchAiSummary bounds', start, end);
}

fs.writeFileSync('app_v2.js', code, 'utf8');
console.log('Successfully written to app_v2.js');
