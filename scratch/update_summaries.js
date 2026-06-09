const fs = require('fs');
const path = require('path');

const aiDir = 'ai_review';
const files = fs.readdirSync(aiDir).filter(f => f.endsWith('.json'));
console.log(`Auditing ${files.length} files...`);

let count = 0;
for (const file of files) {
    try {
        const filePath = path.join(aiDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content.replace(/^\uFEFF/, ""));
        
        let summary = data.generated_summary || '';
        const isFallback = summary.includes('較少提及與親子用餐相關') || 
                           summary.includes('較少提及其他與親子用餐相關') || 
                           summary === '目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。';
                           
        if (isFallback) {
            let parts = [];
            
            const cs = data[' child_seat available'] || data['child_seat available'];
            if (cs && cs.result === 'Yes') {
                parts.push('兒童座椅');
            }
            if (data.has_tableware && data.has_tableware.result === 'Yes') {
                parts.push('兒童餐具');
            }
            if (data['Kids menu available'] && data['Kids menu available'].result === 'Yes') {
                parts.push('兒童餐點');
            }
            if (data.has_diaper_table && data.has_diaper_table.result === 'Yes') {
                const ev = data.has_diaper_table.evidence || '';
                if (ev.includes('百貨') || ev.includes('商場') || ev.includes('大樓')) {
                    parts.push('可使用商場附設之尿布台');
                } else {
                    parts.push('尿布台');
                }
            }
            if (data.has_play_area && data.has_play_area.result === 'Yes') {
                parts.push('遊戲區');
            }
            if (data.kid_noise_tolerant && data.kid_noise_tolerant.result === 'Yes') {
                parts.push('環境氣氛適合帶小孩');
            }
            
            if (parts.length > 0) {
                const facilityStr = parts.join('、');
                const newSummary = `這家餐廳提供${facilityStr}。目前評論中較少提及其他親子用餐的具體細節，建議前往前可先向店家確認。`;
                
                data.generated_summary = newSummary;
                
                // Write back
                fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
                console.log(`Updated ${file}: ${newSummary}`);
                count++;
            }
        }
    } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
    }
}

console.log(`Successfully updated summaries for ${count} files.`);
