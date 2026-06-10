const fs = require('fs');

function fixFile(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Fix mapRestaurants prominence sort
    const t1 = 'const sorted = [...state.mapRestaurants].sort((a, b) => {\r\n            const scoreA = (a.user_ratings_total || 0) * (parseFloat(a.rating) || 0) + (parseFloat(a.rating) || 0);\r\n            const scoreB = (b.user_ratings_total || 0) * (parseFloat(b.rating) || 0) + (parseFloat(b.rating) || 0);\r\n            return scoreB - scoreA;\r\n        });';
    const r1 = 'const sorted = [...state.mapRestaurants].sort((a, b) => {\r\n            const rA = parseFloat(a.rating);\r\n            const rB = parseFloat(b.rating);\r\n            const valA = isNaN(rA) ? 0 : rA;\r\n            const valB = isNaN(rB) ? 0 : rB;\r\n            const scoreA = (a.user_ratings_total || 0) * valA + valA;\r\n            const scoreB = (b.user_ratings_total || 0) * valB + valB;\r\n            const diff = scoreB - scoreA;\r\n            return isNaN(diff) ? 0 : diff;\r\n        });';
    
    if (code.includes('const scoreA = (a.user_ratings_total || 0) * (parseFloat(a.rating) || 0) + (parseFloat(a.rating) || 0);')) {
        let newCode = code;
        newCode = newCode.replace(/const scoreA = [^\n]+;\s*const scoreB = [^\n]+;\s*return scoreB - scoreA;/g, 
            'const rA = parseFloat(a.rating); const rB = parseFloat(b.rating); const valA = isNaN(rA) ? 0 : rA; const valB = isNaN(rB) ? 0 : rB; const scoreA = (a.user_ratings_total || 0) * valA + valA; const scoreB = (b.user_ratings_total || 0) * valB + valB; const diff = scoreB - scoreA; if (isNaN(diff)) return 0; return diff;');
        
        newCode = newCode.replace(/const rankA = prominenceRanks.has\(a.place_id\)[^\n]+;\s*const rankB = prominenceRanks.has\(b.place_id\)[^\n]+;\s*return rankA - rankB;/g, 
            'const rankA = prominenceRanks.has(a.place_id) ? prominenceRanks.get(a.place_id) : 999999; const rankB = prominenceRanks.has(b.place_id) ? prominenceRanks.get(b.place_id) : 999999; const diff = rankA - rankB; if (isNaN(diff)) return 0; return diff;');
            
        newCode = newCode.replace(/mapData\.sort\(\(a, b\) => a\._distance - b\._distance\);/g, 
            'mapData.sort((a, b) => { const diff = a._distance - b._distance; return isNaN(diff) ? 0 : diff; });');
            
        fs.writeFileSync(filePath, newCode, 'utf8');
        console.log('Fixed file:', filePath);
    } else {
        console.log('Target not found in', filePath);
    }
}

fixFile('app.js');
