# SHEPATH frontend prototype

## Build
- Create one responsive, app-like journey at `/` covering Welcome, Route Search, Safety Preferences, Route Results, Route Details, and Safety Report.
- Use polished mock Bengaluru journey data and local UI state only; no backend, accounts, emergency features, AI, or live tracking.
- Make the route-results screen the centerpiece: a large interactive Leaflet map, three route choices, a highlighted recommendation, travel time, safety score, safety factors, and a clear route rationale.

## Visual direction
- Establish a warm ivory and lavender design system with deep plum typography, rounded surfaces, pill controls, generous spacing, and restrained motion.
- Keep the tone friendly, premium, trustworthy, and feminine without becoming childish.
- Support compact mobile navigation and a spacious desktop map-and-details layout.

## Technical details
- Keep the existing TanStack Start/Vite structure and implement the requested React experience in the index route.
- Load Leaflet only in the browser for SSR safety and use OpenStreetMap tiles.
- Add route-specific metadata and verify the central flow and layouts in the running preview.
