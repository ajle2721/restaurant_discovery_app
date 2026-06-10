function formatRestaurantName(name) {
    if (!name) return '';
    const parts = name.split(/([\(\[【（].*?[\)\]】）]|[ \-－—:：\/／\|｜])/g).filter(p => p !== '');
    let html = '';
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (/^[ \-－—:：\/／\|｜]$/.test(part)) return part;
        if (/^[\(\[【（].*?[\)\]】）]$/.test(part)) {
            html += `<span class="res-branch-tag">${part}</span>`;
        } else {
            html += `<span>${part}</span>`;
        }
    }
    return html;
}
console.log(formatRestaurantName('波赫士領地精品咖啡館 明水店 提拉米蘇 千層蛋糕'));
console.log(formatRestaurantName('雪球咖啡 (公館店)'));
