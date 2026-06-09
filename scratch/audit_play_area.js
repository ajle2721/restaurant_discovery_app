const fs = require('fs');
const path = require('path');

const aiDir = 'ai_review';
const responseDir = 'response';

const files = fs.readdirSync(aiDir).filter(f => f.endsWith('.json'));
console.log(`Auditing ${files.length} files...`);

let found = [];
for (const file of files) {
    try {
        const content = fs.readFileSync(path.join(aiDir, file), 'utf8');
        const data = JSON.parse(content.replace(/^\uFEFF/, ""));
        
        const pa = data.has_play_area;
        if (pa && pa.result === 'Yes') {
            const ev = pa.evidence || '';
            const isGoogle = ev.includes('Google') || ev.includes('官方') || ev.includes('Attributes');
            
            let name = '';
            const respPath = path.join(responseDir, file);
            if (fs.existsSync(respPath)) {
                const respContent = fs.readFileSync(respPath, 'utf8');
                const respData = JSON.parse(respContent.replace(/^\uFEFF/, ""));
                name = respData.displayName?.text || '';
            }
            
            found.push({
                file,
                name,
                evidence: ev,
                isGoogle
            });
        }
    } catch (err) {
        console.error(`Error reading ${file}:`, err.message);
    }
}

console.log(`\nFound ${found.length} restaurants with Play Area = Yes:`);
for (const item of found) {
    console.log(`- File: ${item.file} | Name: ${item.name} | GoogleEvidence: ${item.isGoogle} | Evidence: ${item.evidence}`);
}
