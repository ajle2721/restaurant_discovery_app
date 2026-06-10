const fs = require('fs');
const path = require('path');

const baseDir = process.cwd();
const skippedNames = JSON.parse(fs.readFileSync(path.join(baseDir, 'scratch/skipped_names.json'), 'utf8'));
const skippedIds = skippedNames.map(x => x.place_id);

console.log('Scanning repo files for references to the 72 skipped place IDs...');

// We will scan recursively, ignoring .git, node_modules, response, ai_review
function scanDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file === '.git' || file === 'node_modules' || file === 'response' || file === 'ai_review' || file === '.gemini') {
        continue;
      }
      results = results.concat(scanDir(filePath));
    } else {
      if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.csv') || file.endsWith('.txt') || file.endsWith('.md')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const allFiles = scanDir(baseDir);
console.log(`Found ${allFiles.length} files to scan.`);

const idReferences = {};
for (const id of skippedIds) {
  idReferences[id] = [];
}

for (const file of allFiles) {
  // skip the output file itself
  if (file.includes('scratch/skipped_names.json') || file.includes('scratch/scan_repo_for_ids.js')) continue;
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    for (const id of skippedIds) {
      if (content.includes(id)) {
        // Find lines containing it
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(id)) {
            idReferences[id].push({
              file: path.relative(baseDir, file),
              lineNum: idx + 1,
              content: line.trim().substring(0, 150)
            });
          }
        });
      }
    }
  } catch (err) {}
}

// Update the skipped_names.json with the found references
const updatedResults = skippedNames.map(item => {
  const refs = idReferences[item.place_id] || [];
  let name = item.name;
  
  // Try to extract name from references
  if (name === '未知餐廳名稱' && refs.length > 0) {
    // Look for name-like patterns in CSV/JSON lines
    for (const ref of refs) {
      if (ref.file.endsWith('.csv')) {
        // e.g. place_id,name,address...
        const parts = ref.content.split(',');
        for (const p of parts) {
          // If a part is Chinese text and doesn't contain the place_id or coordinates, it might be the name!
          const cleanPart = p.replace(/"/g, '').trim();
          if (cleanPart && /[\u4e00-\u9fa5]/.test(cleanPart) && cleanPart.length > 1 && cleanPart.length < 15 && !cleanPart.includes('區') && !cleanPart.includes('路')) {
            name = cleanPart;
            break;
          }
        }
      } else if (ref.file.endsWith('.json')) {
        try {
          const match = ref.content.match(/"name":\s*"([^"]+)"/);
          if (match) {
            name = match[1];
            break;
          }
        } catch (e) {}
      }
    }
  }
  
  return {
    place_id: item.place_id,
    name: name,
    referencesCount: refs.length,
    firstReference: refs.length > 0 ? `${refs[0].file}:L${refs[0].lineNum}` : '無引用',
    refSample: refs.length > 0 ? refs[0].content : ''
  };
});

fs.writeFileSync(path.join(baseDir, 'scratch/skipped_names_resolved.json'), JSON.stringify(updatedResults, null, 2), 'utf8');
console.log('Scan completed. Resolved names saved to scratch/skipped_names_resolved.json');
