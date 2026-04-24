# Repository Guidelines

## Project Structure & Module Organization
This repository is a static web app backed by generated data files. The main UI lives in `index.html`, `app.js`, and `style.css`. Restaurant content is shipped as static datasets such as `data.js`, CSV snapshots, and JSON outputs under `response/` and `ai_review/`. Data refresh and cleanup logic lives in root-level Python and PowerShell scripts such as `fetch_details.py`, `generate_summaries.py`, and `run_update4.ps1`. Deployment is defined in `.github/workflows/deploy.yml`.

## Build, Test, and Development Commands
Run the app locally by opening `index.html` in a browser. For a cleaner local server, use `python -m http.server 8000` from the repo root and visit `http://localhost:8000`. Install data-pipeline dependencies with `pip install -r requirements.txt`. Regenerate restaurant data with `python fetch_details.py` and `python generate_summaries.py` after setting `GOOGLE_MAP_KEY` in `.env.txt`. Use focused verification scripts when changing data transforms, for example `python verify_final.py` or `python verify_import.py`.

## Coding Style & Naming Conventions
Use 4 spaces for JavaScript, Python, and HTML indentation, matching the existing files. Keep the frontend in plain ES6 JavaScript; prefer clear function names like `renderList` and `toggleFilter`. Use `snake_case` for Python scripts and dataset fields, and `camelCase` for JavaScript variables and functions. Preserve Traditional Chinese UI copy unless the change explicitly targets localization. There is no enforced formatter here, so keep edits small and consistent with surrounding code.

## Testing Guidelines
There is no dedicated automated test suite yet. Treat validation as script-based regression checking: run the relevant Python verifier after data changes and manually smoke-test the UI in a browser after frontend edits. Name new verification helpers with a `verify_*.py` pattern so their purpose is obvious.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries such as `Refactor UI: Remove map legend and introduce 3-category toggle controls`. Follow that style: start with a verb, keep the subject specific, and mention the affected area when useful. Pull requests should include a brief behavior summary, note any regenerated data files, link related issues, and attach screenshots or short recordings for visible UI changes.

## Security & Configuration Tips
Do not commit API keys or raw secrets. Keep local credentials in `.env.txt`, review generated data before committing, and avoid checking in temporary machine-specific paths like the one currently hardcoded in `verify_final.py`.
