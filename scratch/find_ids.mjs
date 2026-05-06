import fs from 'fs';
const content = fs.readFileSync('ai_review/index.js', 'utf8');
const dataStr = content.replace(/^const restaurantData = /, '').trim().replace(/;$/, '');
const data = JSON.parse(dataStr);
const names = ['Ho\'me廚房', '大樹先生', '農人餐桌', '淘憩時光', '媽妳講', '象園咖啡', '小倉庫', '甲蟲秘境', 'Skylark'];
data.forEach(r => {
    if (names.some(n => r.name.includes(n))) {
        console.log(`${r.name} | ${r.place_id}`);
    }
});
