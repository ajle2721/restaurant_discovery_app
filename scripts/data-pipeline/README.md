# Data Pipeline

Run these scripts from the repository root. They may require local files under
`response/`, credentials from ignored environment files, or the Python packages
listed in `requirements.txt`.

The supported no-credential workflow is:

```sh
just build-data
just verify-data
```

The Python and Node scripts in this directory are retained for explicit data
refresh tasks. Their outputs belong under `data/ai_review/`, `data/curated/`, or
`data/generated/`; raw API responses stay under ignored `response/`.
