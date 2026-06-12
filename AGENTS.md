# Repository Guidelines

## Project Structure & Module Organization
This repository is a static web app backed by generated data files. The main UI lives in `index.html`, `app.js`, and `style.css`. Restaurant content is built from the existing generated catalog `ai_review/index.js` plus per-restaurant analysis JSON under `ai_review/`. Raw API responses under `response/*.json` are local-only and ignored by git. The frontend consumes the generated bundle `ai_review/index.js`, which is created by `build-ai-review-index.mjs`. Deployment is defined in `.github/workflows/deploy.yml`.

## Build, Test, and Development Commands
Run the app locally with `nix develop`, `just build`, and `just serve`. `just build` rebuilds `ai_review/index.js` without reading `response/*.json`. Install data-pipeline dependencies with `pip install -r requirements.txt` only when refreshing local source data. If legacy scripts regenerate raw API responses, keep them local-only under ignored `response/*.json`.

## Coding Style & Naming Conventions
Use 4 spaces for JavaScript, Python, and HTML indentation, matching the existing files. Keep the frontend in plain ES6 JavaScript; prefer clear function names like `renderList` and `toggleFilter`. Use `snake_case` for Python scripts and dataset fields, and `camelCase` for JavaScript variables and functions. Preserve Traditional Chinese UI copy unless the change explicitly targets localization. There is no enforced formatter here, so keep edits small and consistent with surrounding code.

## Testing Guidelines
There is no dedicated automated test suite yet. Treat validation as build-plus-smoke-test: run `just build` after data changes and manually verify the UI in a browser after frontend edits. Add narrowly scoped verification helpers only when they support an active workflow.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries such as `Refactor UI: Remove map legend and introduce 3-category toggle controls`. Follow that style: start with a verb, keep the subject specific, and mention the affected area when useful. Pull requests should include a brief behavior summary, note any regenerated data files, link related issues, and attach screenshots or short recordings for visible UI changes.

## Security & Configuration Tips
Do not commit API keys, raw secrets, or raw API responses. Keep local credentials in `.env.txt`, keep `response/*.json` local-only, and review generated `ai_review/index.js` before committing when analysis data changes.
