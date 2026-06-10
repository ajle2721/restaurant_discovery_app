const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

// Fix the suggestion sort
code = code.replace(
    /\.sort\(\(a, b\) => calculateDistance\(center\.lat, center\.lng, a\.lat, a\.lng\) - calculateDistance\(center\.lat, center\.lng, b\.lat, b\.lng\)\)/g,
    `.sort((a, b) => {
          const dA = calculateDistance(center.lat, center.lng, a.lat, a.lng);
          const dB = calculateDistance(center.lat, center.lng, b.lat, b.lng);
          const diff = dA - dB;
          return isNaN(diff) ? 0 : diff;
      })`
);

// Fix the priority sort
code = code.replace(
    /return \(a\.distance \|\| 0\) - \(b\.distance \|\| 0\); \/\/ Tertiarily sort by distance \(nearest first\)/g,
    `const diff = (a.distance || 0) - (b.distance || 0); return isNaN(diff) ? 0 : diff; // Tertiarily sort by distance`
);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Fixed additional sorts');
