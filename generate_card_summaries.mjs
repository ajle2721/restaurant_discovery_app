import fs from 'fs';
import path from 'path';

const aiReviewDir = 'ai_review';
const responseDir = 'response';

const files = fs.readdirSync(aiReviewDir).filter(f => f.endsWith('.json') && f !== 'index.js');

console.log(`Generating card_summaries for ${files.length} files...`);

files.forEach(file => {
    try {
        const aiPath = path.join(aiReviewDir, file);
        const respPath = path.join(responseDir, file);
        
        const aiData = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
        let reviewsText = '';
        
        if (fs.existsSync(respPath)) {
            const respData = JSON.parse(fs.readFileSync(respPath, 'utf8'));
            if (respData.reviews) {
                respData.reviews.forEach(r => {
                    reviewsText += (r.originalText?.text || r.text?.text || '');
                });
            }
        }

        const level = aiData.parent_friendly_level;
        const aiSummary = aiData.generated_summary || '';
        
        const features = [];
        if (/主題/.test(reviewsText)) features.push("主題特色餐廳");
        if (/遊戲區|遊戲室|溜滑梯|球池/.test(reviewsText)) features.push("設有兒童遊戲區");
        if (/聚餐|聚會|家族/.test(reviewsText)) features.push("適合大家庭聚餐");
        if (/慶生|生日/.test(reviewsText)) features.push("適合舉辦慶生活動");
        if (/戶外|庭院|草地|草皮/.test(reviewsText)) features.push("具備戶外活動空間");
        if (/熱鬧|吵雜/.test(reviewsText)) features.push("氣氛熱鬧自在");
        if (/寵物|貓|狗|動物/.test(reviewsText)) features.push("有可愛動物陪伴");
        if (/甜點|下午茶/.test(reviewsText)) features.push("適合帶小孩吃下午茶");
        if (/景觀|風景/.test(reviewsText)) features.push("擁有極佳景觀視野");

        let cardSummary = "";
        if (level === "高" || level === "High") {
            if (features.length > 0) {
                cardSummary = `${features[0]}，用餐氛圍輕鬆熱鬧，非常推薦家庭聚餐。`;
            } else {
                cardSummary = "氣氛輕鬆熱鬧，適合帶小孩一同前來用餐體驗。";
            }
        } else if (level === "中" || level === "Medium") {
            if (features.length > 0) {
                cardSummary = `${features[0]}，空間尚算舒適，適合作為親子用餐備選。`;
            } else {
                cardSummary = "空間舒適，適合家庭用餐，但建議前往前再確認設施。";
            }
        } else if (level === "需留意" || level === "Needs Attention") {
            if (/空間/.test(aiSummary) && /小/.test(aiSummary)) {
                cardSummary = "店內空間較小且座位有限，帶小孩前往需多加留意。";
            } else if (/安靜/.test(aiSummary)) {
                cardSummary = "環境氛圍較為安靜，帶小孩用餐建議先評估情境。";
            } else {
                cardSummary = "部分用餐條件較受限，建議查看詳情後再做決定。";
            }
        } else {
            cardSummary = "目前親子友善資訊較有限，建議前往前可先向店家確認。";
        }

        // Truncate to safety
        if (cardSummary.length > 45) {
            cardSummary = cardSummary.substring(0, 42) + "...";
        }

        aiData.card_summary = cardSummary;
        
        fs.writeFileSync(aiPath, JSON.stringify(aiData, null, 4), 'utf8');
    } catch (err) {
        console.error(`Error processing ${file}: ${err.message}`);
    }
});

console.log("Done!");
