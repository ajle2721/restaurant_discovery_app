# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Commands

```bash
nix develop          # Enter dev shell (Node 22, Python 3.12, live-server, jq, ripgrep, just)
just build           # Regenerate ai_review/index.js
just serve           # Start live-server at http://localhost:8000
just serve-open      # Same, plus auto-open browser
```

Normal build flow:

```bash
just build           # Rebuild ai_review/index.js from existing catalog + ai_review/*.json
just serve           # Smoke-test in browser
```

Legacy Google/raw-data refresh scripts have been moved out of the repository.
Normal builds should not depend on raw API responses.

No automated test suite. Validation = `just build` + manual browser check.

## Architecture

This is a static PWA with no backend. Restaurant data is pre-built into a JS
bundle at deploy time.

### Data Flow

```text
ai_review/index.js                (existing restaurant catalog)
  + ai_review/{place_id}.json      (AI analysis: attributes, summaries, signals)
  -> ai_review/index.js            (rebuilt frontend bundle)
  -> app.js restaurantData[]       (consumed at runtime)
```

`build-ai-review-index.mjs` rebuilds `ai_review/index.js` from the existing
`ai_review/index.js` catalog plus per-restaurant `ai_review/*.json` analysis
files. It intentionally does not read `response/*.json`; raw API responses are
local-only and ignored by git.

### Frontend

All UI logic lives in `app.js`. Key entry point is `init()`.

State object (global `state`):

- `filters: Set` - active facility filter tags
- `searchLocation` - selected location (name, lat, lng, type, district)
- `userLocation` - browser geolocation
- `selectedRestaurant` - currently viewed restaurant
- `view: 'home' | 'detail'` - UI mode
- `currentResults[]` - filtered restaurant list
- `favorites: Set` - bookmarked place IDs

Major subsystems:

- Search & filter - `executeSearch()`, `renderResults()`, `calculatePersonalizedScore()`
- Rendering - `renderList()`, `renderCard()`, `renderDetail()`
- Map - `initMap()`, `renderMap()`, `refreshMapMarkers()` (Leaflet.js)
- URL state sync - `updateUrl()`, `syncStateFromUrl()`
- PWA install prompt - platform detection (iOS Safari vs Android Chrome)

View routing is manual: two views (`home`, `detail`) switched via `switchView()`.

### Data Schemas

`ai_review/{place_id}.json` attributes:

- `child_seat available`, `Spacious seating`, `Kids menu available`,
  `has_tableware`, `has_diaper_table` - each `{ result, evidence, confidence }`
- `generated_summary`, `card_summary`, `parent_friendly_level`,
  `generated_signals[]`

`restaurantData[]` entry (from `ai_review/index.js`):

- `place_id`, `name`, `address`, `district`, `price_level`, `cuisine`
- `latitude`, `longitude`, `url`
- `attributes: { high_chair_available, kids_menu, spacious_seating,
  kid_noise_tolerant, has_play_area, has_private_room, has_tableware,
  has_diaper_table }`
- `ai_summary`, `card_summary`, `parent_friendly_level`

## Coding Style

- JS/HTML: 4-space indentation, camelCase functions/variables
- Python: 4-space indentation, snake_case
- Preserve Traditional Chinese UI copy unless the change explicitly targets localization
- No formatter enforced; keep edits consistent with surrounding code

## Security

Credentials go in `.env.txt` (git-ignored). Never commit `GOOGLE_MAP_KEY`, API
keys, or raw API responses. `response/*.json` is ignored and should stay
local-only. Review `ai_review/index.js` before committing when analysis data
changes.
