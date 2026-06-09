const fs = require('fs');

// Read app.js to extract patchAiSummary
let appJs = fs.readFileSync('app.js', 'utf8');
const patchStart = appJs.indexOf('function patchAiSummary');
let patchLogic = appJs.slice(patchStart);
const patchEnd = patchLogic.indexOf('\n    \n    // --- Generic template summary');
patchLogic = patchLogic.slice(0, patchEnd);

// Mock the environment to load the function
const scriptCode = `
    let isKidsMenuNo = false;
    let restaurant = {};
    ${patchLogic}
    return patchAiSummary;
`;
const patchAiSummaryFn = new Function(scriptCode)();

// Load ai_review data
let data = fs.readFileSync('ai_review/index.js', 'utf8');
data = data.replace('const aiReviewData = ', '').replace(/;$/, '');
let restaurants = JSON.parse(data);

let suspicious = [];
let count = 0;

Object.keys(restaurants).forEach(key => {
    let res = restaurants[key];
    res.attributes = res.attributes || {}; // mock for logic
    if (res.ai_summary) {
        let patched = patchAiSummaryFn(res, res.ai_summary);
        // Look for awkward transitions before "應備有" or other weird patterns
        if (/(不過|需注意|但|且)[，。、\s]*應備有/.test(patched) || /(不過|需注意|但|且)[，。、\s]*官方/.test(patched)) {
            suspicious.push(`[${res.name}] AI: ${patched}`);
        }
        count++;
    }
});

console.log(`Checked ${count} summaries.`);
if (suspicious.length > 0) {
    console.log("Found suspicious summaries:");
    suspicious.forEach(s => console.log(s));
} else {
    console.log("No suspicious awkward transitions found!");
}