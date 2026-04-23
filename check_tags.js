const fs = require('fs');

const content = fs.readFileSync('data.js', 'utf8');
// The file is "const restaurantData = [ ... ];"
// We can just eval it or extract the JSON.
const dataMatch = content.match(/const restaurantData = (\[[\s\S]*?\]);/);
if (!dataMatch) {
    console.error("Could not find restaurantData");
    process.exit(1);
}

const data = JSON.parse(dataMatch[1]);

const noTags = data.filter(res => {
    const attrs = res.attributes;
    return !attrs.high_chair_available && 
           !attrs.kids_menu && 
           !attrs.spacious_seating && 
           !attrs.kid_noise_tolerant;
});

console.log(`Found ${noTags.length} restaurants:`);
noTags.forEach(res => {
    console.log(`- ${res.name}`);
});
