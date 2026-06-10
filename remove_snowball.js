const fs = require('fs');
const path = require('path');

const dirs = ['response', 'ai_review'];
const targets = ['雪球咖啡 (公館店)', '雪球咖啡 (市府店)'];

let deletedCount = 0;

dirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(f => {
            if (f.endsWith('.json')) {
                const filePath = path.join(dir, f);
                try {
                    let content = fs.readFileSync(filePath, 'utf8');
                    // Remove BOM if present
                    if (content.charCodeAt(0) === 0xFEFF) {
                        content = content.slice(1);
                    }
                    const data = JSON.parse(content);
                    if (data.name && (data.name.includes('雪球咖啡') || data.name.includes('snowballcafe'))) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted ${filePath} (${data.name})`);
                        deletedCount++;
                    }
                } catch (e) {
                    // Ignore parse errors for individual files
                }
            }
        });
    }
});

console.log(`Deleted ${deletedCount} files.`);
