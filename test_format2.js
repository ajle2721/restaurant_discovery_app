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
console.log(formatRestaurantName('波波早午餐 民生總店'));
