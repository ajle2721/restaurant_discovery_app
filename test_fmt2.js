const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// replace DOM manipulations with dummy functions to safely eval
code = code.replace(/document\./g, 'dummy.');
code = code.replace(/window\./g, 'dummy.');

eval(`
    const dummy = { getElementById: () => ({}), addEventListener: () => {} };
    ${code}
    
    console.log("大叔:", formatRestaurantName('大叔食事unclefoodday'));
    console.log("Twin:", formatRestaurantName('Twin Brothers Coffee'));
    console.log("雪球:", formatRestaurantName('雪球咖啡 (公館店)'));
    console.log("波赫士:", formatRestaurantName('波赫士領地精品咖啡館 明水店 提拉米蘇 千層蛋糕'));
`);
