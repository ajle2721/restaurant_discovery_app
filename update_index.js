const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/app\.js\?v=\d+/, 'app.js?v=20260610160800');
html = html.replace(/ai_review\/index\.js\?v=\d+/, 'ai_review/index.js?v=20260610160800');
fs.writeFileSync('index.html', html);
console.log('updated index.html');
