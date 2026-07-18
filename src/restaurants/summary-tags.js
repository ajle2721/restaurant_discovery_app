import { attributeLabels } from "./attributes.js";
import { getDynamicStatus } from "../search/scoring.js";

export function getPFSummaryTags(res, selectedFilters, overrideLevel, simpleFormat = false) {
    const attrs = res.attributes || {};

    // If filters are active, show match count
    if (selectedFilters && selectedFilters.size > 0) {
        const level = overrideLevel || getDynamicStatus(res, selectedFilters).level;

        const attributeDetails = {
            has_tableware: {
                yes: '兒童餐具',
                no: '無提供兒童餐具',
                unknown: '目前整理資料未提及餐具提供'
            },
            high_chair_available: {
                yes: '兒童椅',
                no: '無提供兒童椅',
                unknown: '目前整理資料未提及兒童椅'
            },
            has_diaper_table: {
                yes: '有尿布台',
                no: '無尿布台',
                unknown: '目前整理資料未提及尿布台'
            },
            kids_menu: {
                yes: '兒童餐',
                no: '無提供兒童餐',
                unknown: '目前整理資料未提及兒童餐'
            },
            kid_noise_tolerant: {
                yes: '不怕吵鬧',
                no: '氣氛較安靜',
                unknown: '目前整理資料未提及氣氛安靜度'
            },
            spacious_seating: {
                yes: '空間寬敞',
                no: '空間較為擁擠',
                unknown: '目前整理資料未提及空間大小'
            },
            has_play_area: {
                yes: '有遊樂區',
                no: '無遊樂區',
                unknown: '目前整理資料未提及遊戲設施'
            },
            has_private_room: {
                yes: '有包廂或可包場',
                no: '無提供包廂或包場',
                unknown: '目前整理資料未提及包廂或包場'
            }
        };

        if (level === 'Needs Attention' || level === '需留意') {
            const missAttrs = [];
            selectedFilters.forEach(f => {
                if (attrs[f] === 'no') {
                    missAttrs.push(attributeDetails[f].no);
                }
            });
            if (missAttrs.length > 0) {
                return `留意：${missAttrs.join('、')}`;
            }
        }

        if (level === 'Insufficient Info' || level === '資訊不足') {
            const unknownNouns = [];
            const nounMap = {
                has_tableware: '兒童餐具',
                high_chair_available: '兒童椅',
                has_diaper_table: '尿布台',
                kids_menu: '兒童餐',
                kid_noise_tolerant: '氣氛安靜度',
                spacious_seating: '空間大小',
                has_play_area: '遊樂區',
                has_private_room: '包廂或可包場'
            };
            selectedFilters.forEach(f => {
                if (!attrs[f] || attrs[f] === 'unknown') {
                    if (nounMap[f]) {
                        unknownNouns.push(nounMap[f]);
                    }
                }
            });
            if (unknownNouns.length > 0) {
                if (unknownNouns.length === 1) {
                    return `目前整理資料未提及${unknownNouns[0]}`;
                } else if (unknownNouns.length === 2) {
                    return `目前整理資料未提及${unknownNouns[0]}與${unknownNouns[1]}`;
                } else {
                    const lastNoun = unknownNouns.pop();
                    return `目前整理資料未提及${unknownNouns.join('、')}與${lastNoun}`;
                }
            }
        }

        if (level === 'Low Match' || level === '其他友善選擇') {
            const allKeys = ['has_tableware', 'high_chair_available', 'has_diaper_table', 'kids_menu', 'kid_noise_tolerant', 'spacious_seating', 'has_play_area', 'has_private_room'];
            const otherYesAttrs = [];
            allKeys.forEach(k => {
                const val = attrs[k];
                const isPositive = val === 'yes' || val === 'room' || val === 'venue' || val === 'likely' || val === 'likely_room' || val === 'likely_venue';
                const isLikely = String(val).startsWith('likely');
                if (!selectedFilters.has(k) && isPositive) {
                    otherYesAttrs.push(attributeDetails[k].yes + (isLikely ? '(估)' : ''));
                }
            });
            if (otherYesAttrs.length > 0) {
                return `具備其他特色：${otherYesAttrs.join('、')}`;
            }
        }

        let matchCount = 0;
        const matchedNames = [];
        selectedFilters.forEach(f => {
            const val = attrs[f];
            const isPositive = val === 'yes' || val === 'room' || val === 'venue' || val === 'likely' || val === 'likely_room' || val === 'likely_venue';
            if (isPositive) {
                matchCount++;
                const isLikely = String(val).startsWith('likely');
                matchedNames.push(attributeLabels[f] + (isLikely ? '(估)' : ''));
            }
        });
        if (matchCount > 0) {
            if (simpleFormat) {
                return `符合你勾選的 ${matchCount}/${selectedFilters.size} 項：${matchedNames.join('、')}`;
            }
            return `符合 ${matchCount}/${selectedFilters.size}：${matchedNames.join('、')}`;
        }
        return `符合 0/${selectedFilters.size} 項勾選條件`;
    }

    // Default view: list positive amenities
    const tags = [];
    if (attrs.has_tableware === 'yes' || attrs.has_tableware === 'likely') tags.push('兒童餐具' + (attrs.has_tableware === 'likely' ? '(估)' : ''));
    if (attrs.high_chair_available === 'yes' || attrs.high_chair_available === 'likely') tags.push('兒童椅' + (attrs.high_chair_available === 'likely' ? '(估)' : ''));
    if (attrs.has_diaper_table === 'yes' || attrs.has_diaper_table === 'likely') tags.push('尿布台' + (attrs.has_diaper_table === 'likely' ? '(估)' : ''));
    if (attrs.kids_menu === 'yes' || attrs.kids_menu === 'likely') tags.push('兒童餐' + (attrs.kids_menu === 'likely' ? '(估)' : ''));
    if (attrs.kid_noise_tolerant === 'yes' || attrs.kid_noise_tolerant === 'likely') tags.push('不怕吵' + (attrs.kid_noise_tolerant === 'likely' ? '(估)' : ''));
    if (attrs.spacious_seating === 'yes' || attrs.spacious_seating === 'likely') tags.push('空間寬敞' + (attrs.spacious_seating === 'likely' ? '(估)' : ''));
    if (attrs.has_play_area === 'yes' || attrs.has_play_area === 'likely') tags.push('有遊樂區' + (attrs.has_play_area === 'likely' ? '(估)' : ''));
    const pRoomVal = attrs.has_private_room;
    if (pRoomVal === 'yes' || pRoomVal === 'room' || pRoomVal === 'venue' || pRoomVal === 'likely' || pRoomVal === 'likely_room' || pRoomVal === 'likely_venue') {
        const isLikely = String(pRoomVal).startsWith('likely');
        tags.push('包廂或可包場' + (isLikely ? '(估)' : ''));
    }

    return tags.join('、');
}

