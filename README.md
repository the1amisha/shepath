# SHEPATH

SHEPATH helps users compare walking routes in Ranchi using journey estimates and historical OpenStreetMap evidence. It shows what is mapped nearby and where information is missing. It does not assess or guarantee personal safety.

## Current features

- A responsive five-step journey: search, evidence preferences, route comparison, overview and evidence.
- Live walking routes with distance, duration and an interactive map.
- [Segment-level evidence](docs/SEGMENT_EVIDENCE.md): roughly 150 m stretches, nearby facility coverage, longest facility gap and missing-tag percentages.
- Route-specific mapped businesses, healthcare, police and pedestrian infrastructure within a 100 m buffer.
- Lighting, sidewalk and opening-hours tag availability, with unknown data shown explicitly.
- A separate saved Albert Ekka Chowk → Doranda pilot comparison.
- Source provenance and geometry identity checks for geographic evidence.

[Evidence-match weights](docs/EVIDENCE_MATCH.md) reorder supported live routes using tag coverage and mapped business density, with contribution explanations and sensitivity examples. Street activity is unavailable and excluded. Mapped facilities and tags are historical records, not verified street conditions.

## Run locally

Follow the [Windows startup guide](docs/WINDOWS_STARTUP.md) for dependencies, private configuration and startup commands.

| Component | Stack | Local address |
| --- | --- | --- |
| Frontend | React, TypeScript, TanStack Start, Vite, Tailwind CSS, Leaflet | http://127.0.0.1:8080 |
| Backend | Python, FastAPI, HeiGIT routing | http://127.0.0.1:8011 |
| Geographic evidence | Local OSM artifacts, Shapely and pyproj | Served by the backend |

Keep API credentials in the local backend environment. The committed example files contain configuration templates only.

## Repository layout

- `frontend/` — interface, map components and frontend tests.
- `backend/` — API, routing integration and backend tests.
- `data/ranchi_safety/` — pinned pilot data, extraction scripts and provenance records.
- `scripts/` — local capability checks.
- `docs/` — setup, specifications and documentation index.

## Development

See the [frontend guide](frontend/README.md), [contribution guide](CONTRIBUTING.md) and [documentation index](docs/README.md).

The UI has been reviewed on Windows with live routing and in responsive browser layouts. Fresh-clone installation, Linux startup, production deployment and a full accessibility review remain separate validation tasks. Historical validation reports document their own scope and limitations.

## Data and limitations

OpenStreetMap data is © OpenStreetMap contributors and subject to the ODbL; see [OpenStreetMap copyright](https://www.openstreetmap.org/copyright). Preserve the tracked data, source dates, hashes and attribution.

Missing information means unknown. Record counts do not establish continuous footpaths, working lights, open businesses or personal safety. Departure-time analysis, measured street activity and community reports are planned work.

