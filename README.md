# 小手找食 - 台北親子餐廳搜尋 (Taipei Kids-Friendly Restaurant Map)

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Vibrant-orange?style=flat-square&logo=github)](https://ajle2721.github.io/restaurant_discovery_app/)

「台北親子餐廳一鍵搜，爸媽輕鬆吃」

這是一個專為正在尋找台北親子友善餐廳的家長設計的網頁應用程式。整合了 Google 評論與 AI 評價摘要，提供精準的設施標籤與區域篩選功能。

## 📍 網頁連結
**[立即體驗：小手找食](https://ajle2721.github.io/restaurant_discovery_app/)**

---

## ✨ 核心特色

- **AI 智能評價摘要**：利用 AI 整理最新的 Google 評論，提供客觀的親子用餐資訊，幫您快速判斷環境是否適合帶小孩。
- **精準設施標籤**：
  - 🪑 嬰兒椅
  - 🥘 兒童餐
  - 🛋️ 寬敞空間
  - 🥳 不怕小孩吵
- **區域多選功能**：支援台北市 12 個行政區的複選功能，透過客製化的底部抽屜選單（Bottom Sheet）輕鬆切換。
- **評論線索分析**：從海量評論中提取關鍵線索，如「店員對小朋友友善」、「空間適合推車」、「常見家庭客人」等。
- **一鍵分享**：支援產生地圖資訊與篩選條件的分享連結，方便傳送給共同出遊的朋友。

---

## 🛠️ 技術架構

- **前端**：Vanilla HTML / CSS / JavaScript (ES6+)。
- **樣式設計**：採用現代化的 Glassmorphism 效果與流暢的 CSS 動畫。
- **數據管線**：
  - `fetch_details.py`: 使用 Google Places API (New) 抓取餐廳詳細資料與評論。
  - `generate_summaries.py`: Python 數據處理腳本，根據抓取的評論 JSON 生成 `data.js` 靜態數據。
- **部署**：透過 GitHub Actions 自動部署至 GitHub Pages。

---

## 🚀 如何本地執行

1. **複製專案**：
   ```bash
   git clone https://github.com/ajle2721/restaurant_discovery_app.git
   cd restaurant_discovery_app
   ```

2. **開啟網頁**：
   直接使用瀏覽器開啟 `index.html` 即可預覽。

3. **重新生成數據 (可選)**：
   若需更新餐廳資料，需安裝 Python 環境與相關套件：
   ```bash
   pip install -r requirements.txt
   # 需於 .env.txt 設定 GOOGLE_MAP_KEY
   python fetch_details.py
   python generate_summaries.py
   ```

---

## 📄 授權協議

本專案採用 MIT 授權協議。數據僅供參考，實際營業資訊請以餐廳公告為準。
