# Taipei Kids-Friendly Restaurant Map

A Vite-built static web app for finding parent-friendly restaurants in Taipei.

## Project Layout

- `src/`: browser modules and split styles.
- `public/`: manifest, icon, and service worker copied to the deploy artifact.
- `data/ai_review/`: committed per-restaurant analysis JSON.
- `data/curated/`: manually maintained mappings and rules.
- `data/generated/restaurant-catalog.js`: committed reproducible catalog input.
- `scripts/build-ai-review-index.mjs`: generates the browser data module.
- `scripts/data-pipeline/`: optional refresh tools that may need local responses or credentials.
- `dist/`: ignored production output uploaded to GitHub Pages.

## Local Development

```sh
nix develop
just install
just dev
```

`just dev` runs the HMR development server. To inspect the same loading path as
the deployed site, build and serve the production output:

```sh
just build
just serve
```

This workstation stores the repository on a `noexec` volume. If `npm install`
reports an esbuild `EACCES` error, install executable dependencies under `/tmp`:

```sh
just install-tmp
just dev
```

## Build And Verification

```sh
just build-data
just verify-data
just test
just build
just preview
```

`just build` regenerates `src/data/restaurant-index.js` and creates `dist/`.
`just serve` and `just preview` both serve that production output.
Neither step reads ignored `response/*.json`. `just verify-data` parses all
committed analysis files, checks curated inputs, validates catalog loading, and
checks generated records for required fields and duplicate IDs.

## Deployment

GitHub Actions installs dependencies with `npm ci`, builds with the project-page
base path `/restaurant_discovery_app/`, and uploads only `dist/` to GitHub Pages.
