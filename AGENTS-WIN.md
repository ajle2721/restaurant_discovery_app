# Repository Guidelines for Windows

## Canonical Windows Workspace
The canonical Windows project directory is `C:\Users\jason\OneDrive\桌面\restaurant map`. The former Google Drive `G:` workspace is no longer available: never read from, write to, launch commands in, or fall back to any `G:` path. Prefer repository-relative paths after setting the working directory to the canonical C: directory. If session metadata reports a G: working directory, treat it as stale and use the canonical C: directory instead.

## Project Structure & Module Organization
This repository is a Vite-built static web app backed by generated data files. The browser entry is `src/main.js`; feature modules and split styles live under `src/`. Restaurant content is built from `data/generated/restaurant-catalog.js`, per-restaurant analysis JSON under `data/ai_review/`, and mappings under `data/curated/`. Raw API responses under `response/*.json` are local-only and ignored by git. The frontend consumes generated `src/data/restaurant-index.js`, which is created by `scripts/build-ai-review-index.mjs`. Deployment is defined in `.github/workflows/deploy.yml` and publishes only `dist/`.

## Build, Test, and Development Commands
Use PowerShell or another Windows shell with Node.js and npm available. Install frontend dependencies with `npm ci` and run the app locally with `npm run dev`. `npm run build` rebuilds the browser index and `dist/` without reading `response/*.json`; `npm test` and `npm run verify:data` are the automated checks. Use `npm run preview` to inspect the production build locally. Install data-pipeline dependencies with `py -m pip install -r requirements.txt` only when refreshing local source data. If legacy scripts regenerate raw API responses, keep them local-only under ignored `response/*.json`.

## Mobile Remote Preview over WireGuard
When the user asks to start the web server, development server, or preview without specifying the network scope, default to the phone-accessible remote preview: listen on `0.0.0.0:5173` and report the current reachable IPv4 URL. Do not start a localhost-only server unless the user explicitly asks to restrict access to this computer. This default applies even when the user does not mention their phone, remote access, WireGuard, or network access.

The user may control Codex from a phone and connect to this computer through an already configured WireGuard network. For a phone-accessible development preview, run `powershell -ExecutionPolicy Bypass -File .\scripts\start-remote-preview.ps1` or use the `Restaurant Map - Remote Preview` desktop shortcut. The script listens on `0.0.0.0:5173`, allowing connections through every network interface, and prints the available HTTP URLs. It uses Vite when Node.js is available and otherwise falls back to a built-in Windows static server, so the shortcut does not require Node.js. Tell the user the current reachable URL, including `http://` and `:5173`; do not report `localhost`, because it only works on this computer. Keep the server window open while the user is reviewing; closing it or pressing Ctrl+C stops the preview.

When the user asks Codex to start remote preview, launch the same script in a visible, persistent PowerShell window with `Start-Process` and `-WindowStyle Normal`, then determine and report the current IPv4 URL from the script output or Windows network configuration. Do not guess or reuse an address from an earlier session because addresses can change. WireGuard is already configured; do not modify its configuration. If the phone cannot connect, check whether Windows Defender Firewall allows Node.js or TCP port 5173 for the active network, and obtain user approval before adding or broadening a firewall rule. This is a plain HTTP development server exposed on every interface, so never put secrets or private credentials in the site and stop it when it is no longer needed.

## Coding Style & Naming Conventions
Use 4 spaces for JavaScript, Python, and HTML indentation, matching the existing files. Keep the frontend in plain ES6 JavaScript; prefer clear function names like `renderList` and `toggleFilter`. Use `snake_case` for Python scripts and dataset fields, and `camelCase` for JavaScript variables and functions. Preserve Traditional Chinese UI copy unless the change explicitly targets localization. There is no enforced formatter here, so keep edits small and consistent with surrounding code.

## Testing Guidelines
Use `npm run build`, `npm test`, and `npm run verify:data` as the baseline automated checks. Run the build before tests in a fresh checkout so `src/data/restaurant-index.js` exists. After frontend edits, also smoke-test the built site in a browser at desktop and mobile viewport sizes.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries such as `Refactor UI: Remove map legend and introduce 3-category toggle controls`. Follow that style: start with a verb, keep the subject specific, and mention the affected area when useful. Pull requests should include a brief behavior summary, note any regenerated data files, link related issues, and attach screenshots or short recordings for visible UI changes.

## Security & Configuration Tips
Do not commit API keys, raw secrets, or raw API responses. Keep local credentials in `.env.txt`, keep `response/*.json` local-only, and run `npm run verify:data` before committing analysis data changes.
