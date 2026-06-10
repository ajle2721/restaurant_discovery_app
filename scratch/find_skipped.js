const fs = require('fs');
const path = require('path');

const baseDir = process.cwd();
const aiReviewDir = path.join(baseDir, "ai_review");
const responseDir = path.join(baseDir, "response");

const aiReviewFiles = fs
  .readdirSync(aiReviewDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

const skippedIds = [];
for (const file of aiReviewFiles) {
  const placeId = path.basename(file, ".json");
  const responsePath = path.join(responseDir, `${placeId}.json`);
  if (!fs.existsSync(responsePath)) {
    skippedIds.push(placeId);
  }
}

console.log('Total skipped place IDs:', skippedIds.length);
console.log('Skipped IDs list:', skippedIds.slice(0, 10));

// Let's see if we can find their names in other files in the repository
// We will look in expanded_restaurants.json or expanded_restaurants_enriched.json
const otherFiles = [
  'expanded_restaurants_enriched.json',
  'expanded_restaurants.json',
  'expanded_restaurants.csv',
  'annotated_v5_signals_final.csv'
];

const nameMap = {};

for (const file of otherFiles) {
  const filePath = path.join(baseDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  console.log('Searching in', file, '...');
  try {
    if (file.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const items = Array.isArray(data) ? data : (data.restaurants || data.records || []);
      for (const item of items) {
        const id = item.place_id || item.placeId;
        const name = item.name || (item.displayName && item.displayName.text);
        if (id && name) {
          nameMap[id] = name;
        }
      }
    } else if (file.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          // simple regex or index find
          const idMatch = line.match(/ChI[a-zA-Z0-9_-]{24}/);
          if (idMatch) {
            const id = idMatch[0];
            // Name is usually the first or second column, let's just grab parts[1] or parts[0]
            // We can do cleaner matching if needed
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading', file, ':', err.message);
  }
}

// Let's also check if the name can be found in the ai_review json itself (e.g. from generated_summary)
const results = [];
for (const id of skippedIds) {
  const aiPath = path.join(aiReviewDir, `${id}.json`);
  let name = nameMap[id] || null;
  let summary = '';
  try {
    const aiData = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
    summary = aiData.generated_summary || '';
    // Let's guess name from summary if name not found
    if (!name && summary) {
      // e.g. "根據評論分析，[Name]是一間..." or "[Name]官方標記..."
      const match = summary.match(/^([^，。]+?)(?:官方標記|是一間|在官方|的用餐環境|環境舒適)/);
      if (match) {
        name = match[1].replace(/根據評論分析[，\s]*/, '').trim();
      }
    }
  } catch (err) {}
  
  results.push({
    place_id: id,
    name: name || '未知餐廳名稱',
    summary_preview: summary ? summary.substring(0, 40) + '...' : '無摘要'
  });
}

fs.writeFileSync(path.join(baseDir, 'scratch/skipped_names.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('Skipped names saved to scratch/skipped_names.json');
