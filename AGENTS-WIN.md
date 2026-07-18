# Repository Guidelines for Windows

## Project Structure & Module Organization
This repository is a Vite-built static web app backed by generated data files. The browser entry is `src/main.js`; feature modules and split styles live under `src/`. Restaurant content is built from `data/generated/restaurant-catalog.js`, per-restaurant analysis JSON under `data/ai_review/`, and mappings under `data/curated/`. Raw API responses under `response/*.json` are local-only and ignored by git. The frontend consumes generated `src/data/restaurant-index.js`, which is created by `scripts/build-ai-review-index.mjs`. Deployment is defined in `.github/workflows/deploy.yml` and publishes only `dist/`.

## Build, Test, and Development Commands
Use PowerShell or another Windows shell with Node.js and npm available. Install frontend dependencies with `npm ci` and run the app locally with `npm run dev`. `npm run build` rebuilds the browser index and `dist/` without reading `response/*.json`; `npm test` and `npm run verify:data` are the automated checks. Use `npm run preview` to inspect the production build locally. Install data-pipeline dependencies with `py -m pip install -r requirements.txt` only when refreshing local source data. If legacy scripts regenerate raw API responses, keep them local-only under ignored `response/*.json`.

## Coding Style & Naming Conventions
Use 4 spaces for JavaScript, Python, and HTML indentation, matching the existing files. Keep the frontend in plain ES6 JavaScript; prefer clear function names like `renderList` and `toggleFilter`. Use `snake_case` for Python scripts and dataset fields, and `camelCase` for JavaScript variables and functions. Preserve Traditional Chinese UI copy unless the change explicitly targets localization. There is no enforced formatter here, so keep edits small and consistent with surrounding code.

## Testing Guidelines
Use `npm run build`, `npm test`, and `npm run verify:data` as the baseline automated checks. Run the build before tests in a fresh checkout so `src/data/restaurant-index.js` exists. After frontend edits, also smoke-test the built site in a browser at desktop and mobile viewport sizes.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries such as `Refactor UI: Remove map legend and introduce 3-category toggle controls`. Follow that style: start with a verb, keep the subject specific, and mention the affected area when useful. Pull requests should include a brief behavior summary, note any regenerated data files, link related issues, and attach screenshots or short recordings for visible UI changes.

## Security & Configuration Tips
Do not commit API keys, raw secrets, or raw API responses. Keep local credentials in `.env.txt`, keep `response/*.json` local-only, and run `npm run verify:data` before committing analysis data changes.
