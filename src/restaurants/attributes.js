export const filterMap = {
    has_tableware: "has_tableware",
    high_chair_available: "child_seat_available",
    has_diaper_table: "has_diaper_table",
    kids_menu: "kids_menu_available",
    kid_noise_tolerant: "kid_noise_tolerant",
    spacious_seating: "spacious_seating",
    has_play_area: "has_play_area",
    has_private_room: "has_private_room",
};

export const attributeIcons = {
    has_tableware: "🍽️",
    high_chair_available: "🪑",
    has_diaper_table: "🍼",
    kids_menu: "🥘",
    kid_noise_tolerant: "🥳",
    spacious_seating: "🛋️",
    has_play_area: "🧸",
    has_private_room: "🚪",
};

export const attributeLabels = {
    has_tableware: "兒童餐具",
    high_chair_available: "兒童椅",
    has_diaper_table: "尿布台",
    kids_menu: "兒童餐",
    kid_noise_tolerant: "不怕吵",
    spacious_seating: "空間寬敞",
    has_play_area: "有遊樂區",
    has_private_room: "包廂或可包場",
};

export const ESTIMATED_ATTRIBUTE_TOOLTIP = "依公開地點資訊推估，尚未由店家或使用者明確確認，建議出發前再確認。";

export const levelLabels = {
    High: "👍 適合帶小孩",
    Medium: "🙂 可以考慮",
    "Needs Attention": "⚠️ 需留意",
    "Insufficient Info": "❓ 資訊較少",
    高: "👍 適合帶小孩",
    中: "🙂 可以考慮",
    需留意: "⚠️ 需留意",
    資訊不足: "❓ 資訊較少",
};

export function isPositiveAttributeValue(value) {
    return ["yes", "likely", "room", "venue", "likely_room", "likely_venue"].includes(value);
}
