# ShePath

Five-step walking-route comparison prototype with historical mapped geographic evidence. No personal-safety assessment.

## Development

Use the authoritative [Windows startup guide](../docs/WINDOWS_STARTUP.md) for installation and private backend configuration. In this directory, copy `.env.example` to `.env.local` only if it does not exist; keep `VITE_API_BASE_URL=http://127.0.0.1:8011` and `VITE_ROUTING_PROVIDER=api` for the local demo. No API URL fallback is used. Restart Vite after configuration changes.

With dependencies installed, run `npm.cmd run dev -- --host 127.0.0.1 --port 8080 --strictPort`. The guide documents the tested Node/npm versions, fresh-clone limitations and capability checks. Do not reinstall dependencies into a working environment merely to rehearse.

## Saved Ranchi pilot comparison

Set `VITE_API_BASE_URL` in `.env.local` (see `.env.example`). The **Saved Ranchi Pilot Comparison** button opens a separate view of `GET /pilot/ranchi/comparison` for Albert Ekka Chowk to Doranda, walking. It loads only when opened; failures can be retried. `VITE_ROUTING_PROVIDER=api` continues to use `POST /route` independently for arbitrary journeys.

The client validates the response schema, route/profile references, geometry fingerprint coverage and linked snapshot/feature hashes. These checks confirm internal consistency of the API response, not independent cryptographic verification of artifacts. The comparison endpoint supplies geometry fingerprints but no coordinates; live routes supply coordinates but no saved-snapshot identity. Consequently the client never attaches saved observations to live routes, even when route IDs and place names match. A future overlay would require verification of both saved-snapshot identity and the exact ordered geometry using the API's hash convention.

Distances and OSM proximity measurements are geographic context, not personal-safety scores or recommendations. Missing tags remain unknown; mapped records do not establish lighting, sidewalk continuity, business opening, accessibility or conditions on the walked street. Saved preference profiles do not change live routing.

Validation: `npx tsc --noEmit`, `npm test`, and `npm run build`. The test fixture in `src/test/fixtures/ranchi-comparison.json` is the complete response captured from the local comparison API for this integration; it is test-only and never used as runtime fallback data.
