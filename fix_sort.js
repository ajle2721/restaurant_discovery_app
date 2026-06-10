const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const targetSort = `          const sorted = [...state.mapRestaurants].sort((a, b) => {
              const scoreA = (a.user_ratings_total || 0) * (parseFloat(a.rating) || 0) + (parseFloat(a.rating) || 0);
              const scoreB = (b.user_ratings_total || 0) * (parseFloat(b.rating) || 0) + (parseFloat(b.rating) || 0);
              return scoreB - scoreA;
          });`;

const fixedSort = `          const sorted = [...state.mapRestaurants].sort((a, b) => {
              const rA = parseFloat(a.rating);
              const rB = parseFloat(b.rating);
              const valA = isNaN(rA) ? 0 : rA;
              const valB = isNaN(rB) ? 0 : rB;
              const scoreA = (a.user_ratings_total || 0) * valA + valA;
              const scoreB = (b.user_ratings_total || 0) * valB + valB;
              
              const diff = scoreB - scoreA;
              if (isNaN(diff)) return 0;
              return diff;
          });`;

code = code.replace(targetSort, fixedSort);

// Also fix inViewport sort just in case
const targetViewportSort = `              inViewport.sort((a, b) => {
                  const rankA = prominenceRanks.has(a.place_id) ? prominenceRanks.get(a.place_id) : Infinity;
                  const rankB = prominenceRanks.has(b.place_id) ? prominenceRanks.get(b.place_id) : Infinity;
                  return rankA - rankB;
              });`;

const fixedViewportSort = `              inViewport.sort((a, b) => {
                  const rankA = prominenceRanks.has(a.place_id) ? prominenceRanks.get(a.place_id) : 999999;
                  const rankB = prominenceRanks.has(b.place_id) ? prominenceRanks.get(b.place_id) : 999999;
                  const diff = rankA - rankB;
                  if (isNaN(diff)) return 0;
                  return diff;
              });`;

code = code.replace(targetViewportSort, fixedViewportSort);

// Also fix mapData sort in renderResults just in case
const targetMapDataSort = `mapData.sort((a, b) => a._distance - b._distance);`;
const fixedMapDataSort = `mapData.sort((a, b) => {
                    const diff = a._distance - b._distance;
                    return isNaN(diff) ? 0 : diff;
                });`;

code = code.replace(targetMapDataSort, fixedMapDataSort);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Fixed sorting comparators in app.js');
