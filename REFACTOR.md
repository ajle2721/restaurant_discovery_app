# Refactor Plan

This document proposes a cleanup path for this restaurant discovery app, using
`/home/jason9075/data/side-projects/drone-control` as the reference project.

## Execution Status (2026-07-18)

The planned phases have been implemented in order and validated against the
production GitHub Pages base path.

- Phase 1 complete: Vite, npm scripts, lockfile, `dist/`, and a dist-only Pages
  workflow are in place.
- Phase 2 complete: manifest, icon, and service worker live under `public/`; PWA
  registration uses Vite's deployment base path.
- Phase 3 complete: restaurant analyses, curated rules, generated catalog data,
  reports, and scratch files now have separate directories.
- Phase 4 complete for the low-risk extraction pass: state/storage, analytics,
  restaurant attributes/pricing/presentation, distance helpers, and PWA install
  behavior became ES modules. The DOM-heavy controllers intentionally left at
  that stage were subsequently extracted in Phases 7 and 8.
- Phase 5 complete: the original stylesheet was split into seven ordered files;
  their concatenated content was verified against the pre-refactor stylesheet.
- Phase 6 complete: the build uses shared path/catalog modules, active refresh
  tools are under `scripts/data-pipeline/`, historical repair tools are under
  `scripts/archive/`, and `just verify-data` performs no-credential validation.
- Phase 7 complete: feedback, shortlist, and Leaflet map behavior now live in
  feature controllers with callback-based integration from `src/main.js`.
- Phase 8 complete for the planned behavior-preserving pass: autocomplete,
  geocoding, price/cuisine matching, scoring, card rendering, and detail
  rendering have explicit module boundaries and focused tests.
- Phase 9 complete for synchronous payload separation: Rollup emits the catalog
  as an independent cacheable chunk without changing startup behavior.
- Phase 10 complete: feature controllers now own their event registration;
  result orchestration and URL state moved out of `src/main.js`; confirmed stale
  globals, imports, DOM bindings, selectors, and an unreachable fallback branch
  were removed.

The implemented source layout is:

```text
src/
├── analytics/
├── data/
├── feedback/
├── map/
├── navigation/
├── pwa/
├── restaurants/
├── search/
├── shortlist/
├── state/
├── styles/
└── main.js

data/
├── ai_review/
├── curated/
└── generated/

scripts/
├── archive/
├── data-pipeline/
├── lib/
├── build-ai-review-index.mjs
└── verify-data.mjs
```

Validation completed after the refactor:

- 2,225 analysis JSON files parsed successfully.
- 2,393 catalog records and 2,393 generated browser records validated.
- 25 Node unit tests passed.
- Python data-pipeline files passed bytecode compilation.
- A production build with `/restaurant_discovery_app/` base completed.
- Playwright desktop (1440x1000) and mobile (390x844) smoke tests covered home
  feedback, compound filters, single- and multi-location autocomplete, full-city
  results, map markers and popup focus, shortlist comparison, restaurant cards,
  detail navigation, detail feedback, tooltip interactions, URL restoration,
  browser history, and shared shortlist restoration.

The original production JavaScript bundle was approximately 2.17 MB (414 KB
gzip). It is now split into a 165.5 KB application chunk (47.4 KB gzip) and a
2.00 MB catalog chunk (363.7 KB gzip). The latest application chunk is 164.1 KB
(48.0 KB gzip). Total initial transfer remains similar,
but application code and generated data can now be cached independently.

## Continued Refactor Results

The first pass established build and ownership boundaries but intentionally left
DOM-heavy controllers in `src/main.js`. The continuation used small,
behavior-preserving commits on the `refactor` branch.

### Phase 7: Extract Runtime Controllers

Status: complete.

Extract controllers in this order because it follows increasing coupling:

1. `src/feedback/feedback-controller.js`
   - Own feedback and contribution modal state.
   - Own Web3Forms request construction and submission.
   - Receive toast and location-context callbacks from the app bootstrap.

2. `src/shortlist/shortlist-controller.js`
   - Own favorite persistence, drawer tabs, list rendering, and comparison UI.
   - Receive restaurant status and display helpers as dependencies.

3. `src/map/leaflet-map.js`
   - Own Leaflet initialization, marker lifecycle, map bounds, and popup markup.
   - Receive recommendation status and display-price callbacks as dependencies.

Phase 7 acceptance criteria:

- `src/main.js` is 2,463 lines, down from approximately 6,300 lines originally.
- Feature modules do not import `src/main.js` or create circular imports.
- Existing global handlers used by inline markup remain available through a
  narrow compatibility layer.
- Feedback, shortlist, full-city search, map markers, and detail navigation pass
  desktop and mobile smoke tests.

### Phase 8: Separate Search And Rendering

Status: complete for the behavior-preserving extraction pass.

- Autocomplete and geocoding moved to `src/search/`; Nominatim behavior accepts
  an injected fetch implementation for deterministic tests.
- Cuisine, price, attribute matching, and recommendation scoring are pure search
  modules with fixture-based tests.
- Restaurant card and detail rendering moved to `src/restaurants/` controllers
  with their cross-feature actions supplied as callbacks.
- URL synchronization and top-level event wiring remained in `src/main.js` at
  the end of this phase and were subsequently separated in Phase 10.

Phase 8 acceptance criteria:

- Pure filter/scoring behavior has fixture-based unit tests.
- `src/main.js` now contains bootstrap, result orchestration, URL state, view
  transitions, and cross-feature event wiring rather than feature templates.
- Search results and recommendation ordering match the pre-extraction behavior.

### Phase 9: Split The Catalog Payload

Status: synchronous catalog split complete; asynchronous loading deferred.

- The catalog measured 2.04 MB as generated source and 368 KB with gzip.
- A Rollup manual chunk now separates generated catalog data from application
  code while preserving direct GitHub Pages hosting and eager module loading.
- Asynchronous JSON or dynamic-import loading was not adopted because it would
  not reduce the required catalog transfer for the first search and would add a
  new loading/error lifecycle across multiple controllers.
- If future measurements justify asynchronous loading, add a visible loading and
  error state before changing the restaurant data contract.

The catalog split remains its own commit because its rollback and caching
characteristics differ from source-only modularization.

### Phase 10: Reduce Main To Application Coordination

Status: complete.

- Feedback, shortlist, search, and map controllers now register the events they
  own. `setupEventListeners()` only coordinates cross-view application events.
- `src/search/results-controller.js` owns location filtering, recommendation
  sorting, result pagination, filter indicators, fallback hints, map result
  selection, and empty-result suggestions.
- The duplicate preview-count location filtering path now reuses the results
  controller instead of maintaining a second implementation in `src/main.js`.
- `src/navigation/url-state-controller.js` owns URL/history restoration and
  shared shortlist handling. Pure URL serialization and comparison live in
  `src/navigation/url-state.js` with focused tests.
- `src/restaurants/summary-tags.js` isolates the remaining restaurant summary
  formatting logic and has focused tests.
- Removed confirmed dead code: unused imports and DOM bindings, obsolete window
  globals, a stale map-popup selector, an ineffective `window.map` check, and an
  unreachable result fallback branch.

Phase 10 acceptance criteria:

- `src/main.js` is 820 physical lines (713 nonblank), down approximately 87%
  from the original 6,300-line file.
- Every remaining named function in `src/main.js` has at least one runtime
  reference; no unused top-level function was found in the final symbol audit.
- Unit tests, root-base and GitHub Pages-base production builds, desktop/mobile
  smoke tests, browser history, and shared shortlist URL restoration pass.

## Current Line Distribution

Generated data is excluded from runtime source comparisons. The generated
`src/data/restaurant-index.js` is 2.04 MB but only 27 serialized lines, so line
count is not a useful complexity measure for that file.

| Area | Size | Notes |
| --- | ---: | --- |
| `src/main.js` | 820 | Bootstrap, app coordination, location/detail transitions |
| Runtime JavaScript excluding generated catalog | 8,005 | Includes 1,508-line location dataset |
| Runtime JavaScript excluding both data files | 6,497 | Application and feature modules |
| Stylesheets | 4,104 | Seven ordered style modules plus entry file |
| Node unit tests | 25 tests | Presentation, filters, geocode, scoring, summaries, URL state |

The largest extracted runtime modules are now bounded by responsibility:
`shortlist-controller.js` (629 lines), `feedback-controller.js` (588),
`presentation.js` (528), `leaflet-map.js` (494), `detail-controller.js` (487),
and `results-controller.js` (464).

## Commit Strategy

- Keep the completed Phase 1-6 migration as the structural baseline commit.
- Each Phase 7 controller was committed after unit/build/browser validation.
- Phase 8 was committed by domain boundary rather than arbitrary line ranges.
- Phase 10 was split into dead-code cleanup, event ownership, result rendering,
  summary formatting, and URL-state commits, each validated before commit.
- Do not push the `refactor` branch until it is reviewed locally.

## Original State

Before this refactor, the repository was a static root-level app:

- `index.html` directly loads `locations.js`, `ai_review/index.js`, and `app.js`.
- `style.css` is a single global stylesheet.
- `app.js` contains most runtime behavior in one file, currently about 6,300 lines.
- `build-ai-review-index.mjs` builds the generated browser data bundle from
  `ai_review/*.json`.
- GitHub Actions runs `node build-ai-review-index.mjs`, then uploads the whole
  repository root `.` to GitHub Pages.
- Raw local API responses are ignored under `response/*.json`, but many other
  pipeline scratch files and reports live at the repository root.

This works, but the deploy artifact is broad and the source tree does not clearly
separate app source, generated public output, data inputs, scripts, and local
scratch files.

## Reference Pattern From `drone-control`

The `drone-control` project uses a cleaner frontend shape:

- Runtime source lives under `src/`.
- Static and large assets live under `assets/`.
- `index.html` is an app entry point that imports `src/main.js` as an ES module.
- Vite builds a production output into `dist/`.
- GitHub Pages uploads only `dist/`, not the whole repo.
- Build/dev/preview commands are centralized in `package.json` and `Justfile`.
- Source files are split by responsibility, for example `main.js`, `input.js`,
  `hud.js`, `settings.js`, `world.js`, and feature-specific modules.

The main idea worth copying is not the 3D/game-specific code. It is the boundary:
source code and input data stay in the repository, while deployment publishes a
small generated `dist/` directory.

## Target Direction

Move this project toward a build-output model:

```text
.
├── index.html                  # Vite/static app entry
├── package.json                # frontend build/dev scripts
├── vite.config.js              # GitHub Pages base + build config
├── src/
│   ├── main.js                 # bootstrap and event wiring
│   ├── state.js                # global state and persistence wrappers
│   ├── analytics.js            # gtag/event helpers
│   ├── search/
│   │   ├── autocomplete.js
│   │   ├── geocode.js
│   │   ├── filters.js
│   │   └── scoring.js
│   ├── restaurants/
│   │   ├── cards.js
│   │   ├── detail.js
│   │   ├── summaries.js
│   │   └── actions.js
│   ├── map/
│   │   └── leaflet-map.js
│   ├── shortlist/
│   │   └── shortlist.js
│   ├── feedback/
│   │   └── feedback.js
│   ├── pwa/
│   │   ├── install-prompt.js
│   │   └── sw.js
│   ├── data/
│   │   ├── locations.js
│   │   └── restaurant-index.js  # generated or copied at build time
│   └── styles/
│       ├── main.css
│       ├── layout.css
│       ├── components.css
│       └── map.css
├── data/
│   ├── ai_review/              # source JSON records
│   ├── curated/                # brand rules, manual branches, mapping files
│   └── generated/              # generated intermediate catalog files
├── scripts/
│   ├── build-ai-review-index.mjs
│   ├── unpack-ai-review-index.mjs
│   └── data-pipeline/
├── public/
│   ├── manifest.json
│   └── site-icon-v5.png
└── dist/                       # production output, ignored by git
```

This target can be reached gradually. Do not start by moving everything at once.

## Recommended Phases

### Phase 1: Narrow The Deploy Artifact

Goal: publish only built output to GitHub Pages.

Recommended changes:

- Add `package.json` with `dev`, `build`, and `preview` scripts.
- Add Vite only as a dev/build dependency.
- Add `vite.config.js` with a GitHub Pages `base` value matching the repository
  name if this is a project page.
- Change GitHub Actions to build into `dist/` and upload `dist/`.
- Keep `build-ai-review-index.mjs` behavior intact at first, but run it before
  `vite build`.
- Add `dist/` to `.gitignore`.

Why this first:

- It matches the proven deployment model in `drone-control`.
- It reduces accidental publication of root-level scratch files.
- It creates a safe destination for generated browser assets before source files
  are rearranged.

### Phase 2: Move Static Public Assets

Goal: make the public surface explicit.

Recommended changes:

- Move `manifest.json`, `site-icon-v5.png`, and similar pass-through assets into
  `public/`.
- Move `sw.js` to `public/sw.js` initially, or later to `src/pwa/sw.js` if it is
  bundled by a service-worker plugin.
- Keep external Leaflet CDN links unchanged until the module migration is stable.
- Verify PWA registration still resolves to the correct scope after deployment.

Notes:

- The current service worker does not precache app assets. If Vite is introduced,
  either keep it as a simple pass-through service worker or adopt a real precache
  strategy later. Do not mix the two in the same step.

### Phase 3: Move Data Inputs Out Of The Root

Goal: separate deployable app files from source data and local pipeline files.

Recommended changes:

- Move committed restaurant source JSON from `ai_review/*.json` to
  `data/ai_review/*.json`.
- Move curated support files such as `brand_rules.json`,
  `ai_review/cuisines_mapping.json`, `ai_review/contact_links.json`, and
  `ai_review/manual_chain_branches.json` to `data/curated/`.
- Keep raw local API responses ignored under `response/*.json`, or move them to
  `local/response/*.json` and ignore `local/`.
- Move audit reports, batch result files, temporary text files, and one-off CSVs
  under `reports/`, `scratch/`, or `data/generated/` depending on whether they
  are intentional source artifacts.
- Update `build-ai-review-index.mjs` paths only after the new directories are in
  place.

Data boundary to preserve:

- Source data: committed, reviewable, stable enough to reproduce builds.
- Generated browser data: produced by build, loaded by frontend.
- Local raw responses and credentials: ignored and never deployed.

### Phase 4: Split `app.js` By Runtime Responsibility

Goal: reduce the 6,300-line runtime file into modules without changing behavior.

Suggested extraction order:

1. Storage and state helpers:
   - `safeSession`, `safeLocal`, `state`
   - URL sync helpers
   - favorite/shortlist persistence

2. Pure formatting and summary helpers:
   - price normalization
   - address formatting
   - summary cleanup
   - facility labels and tag generation

3. Search and scoring:
   - autocomplete
   - location search and geocoding
   - filter matching
   - personalized score calculation

4. Rendering modules:
   - restaurant card rendering
   - detail page rendering
   - modal rendering
   - shortlist drawer rendering

5. Integrations:
   - Leaflet map integration
   - analytics tracking
   - Web3Forms feedback submission
   - PWA install prompt

Practical rule:

- First extract functions that only depend on arguments and constants.
- Then extract functions that need DOM references.
- Leave the bootstrap and event wiring in `src/main.js` until the final pass.

### Phase 5: Split `style.css`

Goal: make styles easier to maintain without changing visual design.

Suggested split:

- `src/styles/tokens.css`: colors, spacing, shared shadows, z-index values.
- `src/styles/base.css`: reset, typography, body, page shell.
- `src/styles/search.css`: home search UI and filters.
- `src/styles/cards.css`: list and restaurant cards.
- `src/styles/detail.css`: detail view and visit actions.
- `src/styles/map.css`: Leaflet container, markers, map controls.
- `src/styles/modals.css`: feedback, contribution, shortlist, PWA prompts.

Keep import order explicit from `src/styles/main.css`.

### Phase 6: Clean The Data Pipeline Scripts

Goal: make data generation reproducible and discoverable.

Recommended changes:

- Keep the active build script in `scripts/build-ai-review-index.mjs`.
- Move one-off repair scripts into `scripts/archive/` or remove them after
  confirming they are obsolete.
- Keep Python data refresh scripts under `scripts/data-pipeline/`.
- Replace scattered root-level PowerShell scripts with documented `just` recipes
  where the workflow is still active.
- Add `just verify-data` for checks that can run without API keys or raw
  responses.

The current `build-ai-review-index.mjs` is itself large. After paths are stable,
split it into:

- CSV parsing and file loading.
- brand and manual override rules.
- attribute normalization.
- summary sanitization.
- record assembly.
- output writer.

## Proposed Commands

After Phase 1, the command surface should look like:

```sh
just install     # install frontend build dependencies
just dev         # local Vite dev server
just build-data  # rebuild generated restaurant browser data
just build       # build data, then vite build to dist/
just preview     # serve production dist/
just clean       # remove dist/
```

GitHub Actions should become:

```text
checkout
setup node with npm cache
npm ci
npm run build
upload-pages-artifact path: dist
deploy-pages
```

## Deployment Notes

If this GitHub Pages site is served as a project page, Vite needs a `base` value:

```js
export default defineConfig({
    base: process.env.NODE_ENV === "production"
        ? "/restaurant_discovery_app/"
        : "/",
});
```

Use the actual GitHub repository name in the production base path. If the site is
served from a custom domain or user root page, use `/` instead.

Also replace manual query-string cache busting such as:

```html
<script src="app.js?v=20260629124500"></script>
```

with Vite output hashing. That makes stale-cache handling automatic.

## Risks And Guardrails

- The app currently relies on global variables from script load order. Moving to
  ES modules must explicitly export/import `restaurantData`, `locationData`, and
  bootstrap functions.
- Leaflet is loaded from CDN today. It can remain global during early phases; a
  later phase can install it as an npm dependency if desired.
- PWA scope can change if `sw.js` moves. Verify install behavior on GitHub Pages,
  not only locally.
- Data paths are easy to break because the build script reads many root-level
  files. Move data after the deploy artifact has been narrowed.
- Avoid converting all scripts and all directories in one PR. The safer unit is
  one boundary at a time: deploy output, public assets, data inputs, runtime
  modules, styles, then pipeline cleanup.

## Suggested First PR

Make the smallest structural change that improves GitHub deployment safety:

- Add Vite and `package.json`.
- Keep `index.html`, `app.js`, `style.css`, `locations.js`, and
  `ai_review/index.js` where they are for now.
- Configure `npm run build` to run `node build-ai-review-index.mjs` and then
  `vite build`.
- Upload only `dist/` in GitHub Actions.
- Add `dist/` to `.gitignore`.
- Run `just build` or `npm run build`, then preview the result.

After that lands, proceed with source-tree cleanup and module extraction.
