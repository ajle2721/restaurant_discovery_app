const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// evaluate the formatRestaurantName function
const fnMatch = code.match(/function formatRestaurantName\(name\) \{([\s\S]*?)\}/);
if (fnMatch) {
    eval('function formatRestaurantName(name) {' + fnMatch[1] + '}');
    console.log("大叔:", formatRestaurantName('大叔食事unclefoodday'));
    console.log("Twin:", formatRestaurantName('Twin Brothers Coffee'));
    console.log("雪球:", formatRestaurantName('雪球咖啡 (公館店)'));
    console.log("波赫士:", formatRestaurantName('波赫士領地精品咖啡館 明水店 提拉米蘇 千層蛋糕'));
} else {
    console.log('function not found');
}
