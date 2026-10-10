# Deployment and operational notes

The local demo is complete; public hosting is a separate operational step. No cloud resources or public endpoint are created by the demo commands.

## Single origin

Install `backend/requirements.txt`, run `npm ci` and `npm run build` in `frontend/`, and package both `backend/` (including data/metadata) and `frontend/dist/` in their repository-relative locations. Run:

```bash
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

Use your hosting platform's HTTPS ingress. Build with a blank `VITE_API_BASE_URL` and `VITE_USE_MOCK=false`. FastAPI serves `/`, `/favicon.svg`, and `/assets`; the frontend uses hash navigation. API errors remain JSON and are not replaced by a catch-all HTML page. Readiness is `/api/health`; successful startup requires the validated cache. This is a small research service with no authentication, persistence, or trading functionality.

## Separate frontend and API

Build React with `VITE_API_BASE_URL=https://your-api.example` and `VITE_USE_MOCK=false`. Serve `frontend/dist/` as static assets. Set the backend's `CORS_ORIGINS` to the exact HTTPS frontend origin(s), comma-separated. Configure HTTPS on both services and verify browser reachability. No secrets belong in Vite variables. The Vite development proxy is not part of the production build.

## Cache lifecycle and reproducibility

Use the checked-in cache for a reproducible presentation. Refresh explicitly while the service is stopped; restart every worker after replacing files. Prices and metadata have individually atomic replacements and matching hashes; interruption between replacements yields visible unknown-provenance notes rather than falsely attributing a different cache. Research is precomputed once per worker. Each response includes the loaded data version.

Record the Python/Node versions, dependency installs, data hash, and build artifacts used for a release. Direct Python dependencies are pinned, and frontend transitive dependencies are locked in package-lock.json. Python transitive dependencies are not fully locked. Review data-provider redistribution terms before public redistribution or commercial use. Configure platform logs, restart policy, storage, and any institutional access controls before operational use.

## Release checks

Run backend tests, frontend lint/build, and browser tests. Check all presets and both research plots. For a separate-origin deployment, repeat a browser simulation against the deployed URLs and inspect metadata. Rehearse the demo without downloading prices. The full Plotly bundle remains a large lazy-loaded asset; a purpose-built smaller bundle can improve first-chart load time.
