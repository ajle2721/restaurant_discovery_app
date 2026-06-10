const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/ai_review\/index\.js\?v=\d+/, 'ai_review/index.js?v=20260610162800');
fs.writeFileSync('index.html', html, 'utf8');
console.log('updated index.html');
