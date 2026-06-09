const fs = require('fs');
const path = require('path');

const responseDir = 'response';
const aiReviewDir = 'ai_review';

const files = fs.readdirSync(responseDir).filter(f => f.endsWith('.json'));

let found = null;
for (const file of files) {
    try {
        const content = fs.readFileSync(path.join(responseDir, file), 'utf8');
        const data = JSON.parse(content.replace(/^\uFEFF/, ""));
        const name = data.displayName?.text || '';
        if (name.includes('吾餓得食')) {
            found = {
                file,
                name,
                response: data
            };
            break;
        }
    } catch (err) {
        // ignore
    }
}

if (found) {
    console.log(`Found restaurant response file: ${found.file}`);
    console.log(`Name: ${found.name}`);
    console.log(`goodForChildren: ${found.response.goodForChildren}`);
    console.log(`menuForChildren: ${found.response.menuForChildren}`);
    console.log(`Reviews count: ${found.response.reviews ? found.response.reviews.length : 0}`);
    
    const aiPath = path.join(aiReviewDir, found.file);
    if (fs.existsSync(aiPath)) {
        const aiContent = fs.readFileSync(aiPath, 'utf8');
        const aiData = JSON.parse(aiContent.replace(/^\uFEFF/, ""));
        console.log('\nAI Review Data:');
        console.log(JSON.stringify(aiData, null, 2));
    } else {
        console.log('\nNo AI review JSON file found.');
    }
} else {
    console.log('Restaurant "吾餓得食" not found.');
}
