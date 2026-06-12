# Taipei Kids-Friendly Restaurant Map

A static web app for finding parent-friendly restaurants in Taipei.

## Current Build Flow

The frontend is served from static files:

- `index.html`
- `app.js`
- `style.css`
- `locations.js`
- `ai_review/index.js`

Restaurant data is bundled in `ai_review/index.js`. Rebuild it with:

```bash
just build
```

The build uses the existing generated catalog plus `ai_review/*.json` analysis
files. It does not require raw API responses.

## Local Development

```bash
nix develop
just build
just serve
```

## Data Notes

Raw API response files are intentionally not stored in this repository.
If any `response/*.json` files are regenerated locally, keep them local-only.

## Deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`.
