const fs = require('fs');
const data = fs.readFileSync('ai_review/index.js', 'utf8');
const vm = require('vm');
const context = {};
vm.createContext(context);
vm.runInContext(data, context);
const res = [...context.restaurantData].find(r => r.name.includes('2號出口'));
console.log(res ? res.place_id : 'not found');
