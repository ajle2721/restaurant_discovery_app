import fs from 'fs';
import https from 'https';

function callGemini(prompt, apiKey) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        });

        const req = https.request(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            },
            (res) => {
                let responseBody = '';
                res.on('data', (chunk) => responseBody += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const result = JSON.parse(responseBody);
                            const text = result.candidates[0].content.parts[0].text.trim();
                            resolve(text);
                        } catch (e) {
                            reject(new Error(`Parse error: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`HTTP Error ${res.statusCode}: ${responseBody}`));
                    }
                });
            }
        );

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    let apiKey = null;
    if (fs.existsSync('.env')) {
        const lines = fs.readFileSync('.env', 'utf8').split('\n');
        for (const line of lines) {
            if (line.startsWith('GEMINI_API_KEY=')) {
                apiKey = line.split('=')[1].trim();
                break;
            }
        }
    }

    if (!apiKey) return;

    const pyScript = fs.readFileSync('fetch_missing_response.py', 'utf8');
    const match = pyScript.match(/MISSING_PLACE_IDS\s*=\s*\[([\s\S]*?)\]/);
    if (!match) return;

    const ids = match[1].match(/[\"']([^\"']+)[\"']/g).map(id => id.replace(/[\"']/g, ''));
    const mallKeywords = [
        "新光三越", "sogo", "遠東百貨", "遠百", "微風", "breeze", 
        "統一時代", "京站", "qsquare", "美麗華", "誠品", "att 4 fun", 
        "環球", "global mall", "大葉高島屋", "大葉髙島屋", "bellavita", 
        "兒童新樂園", "101", "citylink", "明曜百貨", "忠泰樂生活", 
        "台北車站", "南港車站", "松山車站", "科教館", "天文館", "動物園"
    ];

    const tasks = [];

    for (const placeId of ids) {
        const respPath = `response/${placeId}.json`;
        const revPath = `ai_review/${placeId}.json`;

        if (!fs.existsSync(respPath) || !fs.existsSync(revPath)) continue;

        const responseData = JSON.parse(fs.readFileSync(respPath, 'utf8').replace(/^\uFEFF/, ''));
        const reviewData = JSON.parse(fs.readFileSync(revPath, 'utf8').replace(/^\uFEFF/, ''));

        const oldSummary = reviewData.generated_summary || '';

        const extras = [];
        if (responseData.goodForChildren) extras.push("官方標示適合兒童，預期有提供兒童椅及兒童餐具");
        if (responseData.menuForChildren) extras.push("官方標示有提供兒童餐");

        const addr = (responseData.formattedAddress || "").toLowerCase();
        const name = (responseData.displayName?.text || "").toLowerCase();
        if (mallKeywords.some(kw => addr.includes(kw) || name.includes(kw))) {
            extras.push("位於商場或園區內，周邊通常設有尿布台等便利設施");
        }

        if (extras.length === 0) continue;
        if (oldSummary.includes("官方標示") || oldSummary.includes("預期有提供")) continue;

        tasks.push({
            id: placeId,
            oldSummary,
            officialInfo: extras.join("、") + "。"
        });
    }

    if (tasks.length === 0) return;
    console.log(`Found ${tasks.length} summaries to rewrite.`);

    const BATCH_SIZE = 20;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const batch = tasks.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} (${batch.length} items)...`);

        const promptText = batch.map((t, idx) => `
[Item ${idx}]
Old Summary: ${t.oldSummary}
Official Info: ${t.officialInfo}
`).join('\n');

        const prompt = `I have a list of restaurant summaries that need to be rewritten. For each item, merge the 'Old Summary' and 'Official Info' into a single, natural, and fluent paragraph of about 50-80 words in Traditional Chinese. Do not use bullet points or awkward conjunctions like "此外" or "另外" to just append the info. Weave them naturally.
        
Return the result strictly as a valid JSON array of strings in the EXACT same order as the items provided. Do not include IDs or markdown formatting like \`\`\`json. Just [ "summary0", "summary1", ... ].

Items to rewrite:
${promptText}
`;

        try {
            let resultText = await callGemini(prompt, apiKey);
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const results = JSON.parse(resultText);

            for (let j = 0; j < results.length; j++) {
                if (!results[j] || !batch[j]) continue;
                const revPath = `ai_review/${batch[j].id}.json`;
                const reviewData = JSON.parse(fs.readFileSync(revPath, 'utf8').replace(/^\uFEFF/, ''));
                reviewData.generated_summary = results[j];
                reviewData.card_summary = results[j];
                fs.writeFileSync(revPath, JSON.stringify(reviewData, null, 4));
                console.log(`Updated ${batch[j].id}`);
            }
        } catch (e) {
            console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, e.message);
        }

        if (i + BATCH_SIZE < tasks.length) {
            console.log("Waiting 15 seconds for rate limit...");
            await new Promise(r => setTimeout(r, 15000));
        }
    }
    console.log("Done!");
}

main().catch(console.error);
