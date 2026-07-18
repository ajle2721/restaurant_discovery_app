import fs from 'fs';
import path from 'path';

const p = fs.readFileSync('fetch_missing_response.py', 'utf8');
const match = p.match(/MISSING_PLACE_IDS\s*=\s*\[([\s\S]*?)\]/);
if (match) {
    const ids = match[1].match(/[\"']([^\"']+)[\"']/g).map(id => id.replace(/[\"']/g, ''));
    const names = ids.map(id => {
        try {
            const d = JSON.parse(fs.readFileSync('response/' + id + '.json', 'utf8'));
            return d.displayName && d.displayName.text ? d.displayName.text : '未知';
        } catch (e) {
            return '未知';
        }
    });
    fs.writeFileSync('new_restaurants.txt', names.join('\n'));
    console.log('Done writing new_restaurants.txt');
}
