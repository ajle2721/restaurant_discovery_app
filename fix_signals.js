const fs = require('fs');
const dataPath = 'data.js';
let content = fs.readFileSync(dataPath, 'utf8');

content = content.replace(
  /(\place_id\:\s*\ChIJjfzEsLCrQjQRVcQNcIk94A8\[\s\S]*?\signals\:\s*\[\s*)\動線安排不擁擠\(\s*\])/,
  '\動線安排不擁擠\, \有專為孩子打造的兒童專區，對家庭客加分\, \整體環境對親子家庭友善\$2'
);

// Fallback if the first replace with backticks failed (it's actually quotes)
content = content.replace(
  /(\x22place_id\x22:\s*\x22ChIJjfzEsLCrQjQRVcQNcIk94A8\x22[\s\S]*?\x22signals\x22:\s*\[\s*)\x22動線安排不擁擠\x22(\s*\])/,
  '\x22動線安排不擁擠\x22, \x22有專為孩子打造的兒童專區，對家庭客加分\x22, \x22整體環境對親子家庭友善\x22'
);

fs.writeFileSync(dataPath, content, 'utf8');
console.log('data.js updated');

const aiReviewPath = 'ai_review/ChIJjfzEsLCrQjQRVcQNcIk94A8.json';
if (fs.existsSync(aiReviewPath)) {
  let aiContent = fs.readFileSync(aiReviewPath, 'utf8');
  aiContent = aiContent.replace(
    /\x22evidence\x22:\s*\x22動線安排不擁擠\x22/,
    '\x22evidence\x22: \x22動線安排不擁擠，有專為孩子打造的兒童專區\x22'
  );
  fs.writeFileSync(aiReviewPath, aiContent, 'utf8');
  console.log('ai_review updated');
}

