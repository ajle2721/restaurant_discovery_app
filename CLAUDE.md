# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
nix develop          # Enter dev shell (Node 22, Python 3.12, live-server, jq, ripgrep, just)
just build           # Regenerate ai_review/index.js from ai_review/*.json
just serve           # Start live-server at http://localhost:8000
just serve-open      # Same, plus auto-open browser
```

Data pipeline (run manually when refreshing restaurant data):
```bash
# Set GOOGLE_MAP_KEY in .env.txt first
python fetch_details.py          # Pull from Google Places API → response/*.json
python populate_ai_reviews.py    # Keyword-based analysis → ai_review/*.json
python evaluate_reviews_llm.py   # LLM-based evaluation → ai_review/*.json
python generate_card_summaries.py
just build                       # Bundle → ai_review/index.js
just serve                       # Smoke-test in browser
```

No automated test suite. Validation = `just build` + manual browser check.

## Architecture

This is a **static PWA** with no backend. Restaurant data is pre-built into a JS bundle at deploy time.

### Data Flow

```
Google Places API
  → response/{place_id}.json       (raw API response, ~2,200 files)
  → ai_review/{place_id}.json      (AI analysis: attributes, summaries, signals)
  → ai_review/index.js             (frontend bundle, built by build-ai-review-index.mjs)
  → app.js restaurantData[]        (consumed at runtime)
```

`build-ai-review-index.mjs` merges `response/` and `ai_review/` into a single `restaurantData` array with lazy getters to minimize parse overhead (bundle is ~1.7 MB).

### Frontend (app.js ~3,960 lines — vanilla ES6, no framework)

All UI logic lives in `app.js`. Key entry point is `init()`.

**State object** (global `state`):
- `filters: Set` — active facility filter tags
- `searchLocation` — selected location (name, lat, lng, type, district)
- `userLocation` — browser geolocation
- `selectedRestaurant` — currently viewed restaurant
- `view: 'home' | 'detail'` — UI mode
- `currentResults[]` — filtered restaurant list
- `favorites: Set` — bookmarked place IDs

**Major subsystems:**
- Search & filter — `executeSearch()`, `renderResults()`, `calculatePersonalizedScore()`
- Rendering — `renderList()`, `renderCard()`, `renderDetail()`
- Map — `initMap()`, `renderMap()`, `refreshMapMarkers()` (Leaflet.js)
- URL state sync — `updateUrl()`, `syncStateFromUrl()` (full state in `URLSearchParams`)
- PWA install prompt — platform detection (iOS Safari vs Android Chrome)

**View routing** is manual: two views (`home`, `detail`) switched via `switchView()`.

### Data Schemas

`ai_review/{place_id}.json` attributes:
- `child_seat available`, `Spacious seating`, `Kids menu available`, `has_tableware`, `has_diaper_table` — each `{ result, evidence, confidence }`
- `generated_summary`, `card_summary`, `parent_friendly_level` (高/中/低/資訊不足), `generated_signals[]`

`restaurantData[]` entry (from index.js):
- `place_id`, `name`, `address`, `district`, `rating`, `user_ratings_total`, `price_level`, `cuisine`
- `latitude`, `longitude`, `url`
- `attributes: { high_chair_available, kids_menu, spacious_seating, kid_noise_tolerant, has_play_area, has_private_room, has_tableware, has_diaper_table }` — values `"yes" | "no" | "unknown"`
- `ai_summary`, `card_summary`, `parent_friendly_level`

## Coding Style

- **JS/HTML**: 4-space indentation, camelCase functions/variables
- **Python**: 4-space indentation, snake_case
- Preserve Traditional Chinese UI copy unless the change explicitly targets localization
- No formatter enforced — keep edits consistent with surrounding code

## Security

Credentials go in `.env.txt` (git-ignored). Never commit `GOOGLE_MAP_KEY` or any API key. Review `ai_review/index.js` before committing when analysis data changes.
