# SHEPATH Phase 6 — Stage 1: Frontend UI/UX and Responsible Presentation Audit

Date: 2026-10-11 (Asia/Calcutta). Repository: `D:\shepath`. Audited HEAD: `8fdfed2`.

## Assessment and scope

The existing interface is a usable foundation for a bounded college project demonstration, but its presentation is not yet ready for an unqualified live demo. The primary blockers are misleading legacy safety promises, mock scores on the live application's landing page, a mandatory preference step that does not affect routes, and unresolved browser acceptance. Preserve the current visual identity and five-step journey while correcting these issues.

This is a **source-code audit only**. No browser was opened, no screenshots were inspected, and no visual, mobile, keyboard, screen-reader, contrast, network, or live-provider testing was performed. Layout outcomes below are either explicit source facts or labeled browser-verification risks. No app servers were started and no tests/builds were rerun. The 178 passing tests and successful build belong to the earlier `PHASE_5D_FINAL_VALIDATION_REPORT.md`; they are historical evidence, not results from this audit. Existing test names and source were inspected to understand coverage; mocked map tests do not establish actual Leaflet rendering.

The working tree was clean at audit start. This report is the sole intended addition. Application code, backend, datasets, routing logic, tests and environment files were not modified; no commit or push was performed. `frontend/AGENTS.md` was read. Its historical mock-only architecture instruction is inconsistent with the explicitly supplied Phase 5D context; this audit reviews the integrated implementation without changing either architecture or that instruction.

Reviewed: `frontend/src/routes/index.tsx`, `routes/__root.tsx`, `components/ShePathMap.tsx`, `components/RouteEvidencePanel.tsx`, `components/SavedRanchiPilot.tsx`, `components/ui/button.tsx`, `styles.css`, `hooks/useRouteEvidence.ts`, routing clients/types/mock provider, relevant frontend test coverage, and the Phase 5D report. Paths in findings are relative to the repository root; line anchors refer to the audited source.

Severity: **Critical** = demonstrated fundamental evidence/safety misrepresentation or unusable core flow; **High** = substantial misleading presentation or major access/demo risk; **Medium** = meaningful comprehension, navigation or usability issue; **Low** = polish or maintainability concern. No Critical issue was established by this source audit. Severity does not imply browser reproduction.

## Preserve what works

- Retain the cream/lavender palette, rounded cards, display/body font pairing, restrained shadows, existing page frames and responsive breakpoints. Source shows a coherent design system; rendered quality still needs verification.
- Live route presentation does not inject mock scores. “Fastest” is derived from minimum provider duration, not a safety ranking. Route/evidence identity checks and stale-response guards must remain intact.
- Dynamic evidence distinguishes loading, errors and coverage-unavailable from counts. It explains the 100 m buffer, unknown tags, OSM object counts, possible duplicates, overlapping categories and lack of personal-safety validation.
- Saved comparison clearly states it is historical and separate from live routes, exposes timestamps and integrity details, preserves unknown values, and describes scenario ranges as something other than confidence intervals. Do not attach it to a live map by matching names or IDs.
- Preserve text input labels, named back buttons, loading/status and error regions, saved-view retry, native disclosure controls, root document language/viewport, and the reduced-motion guard on the route pulse.

## Findings

Each issue includes exact source/component, observed behavior, impact, improvement and backend feasibility. **Source** means established by code; **Browser pending** means the actual rendered or assistive-technology effect has not been verified.

### F01 — Safety promises exceed supported functionality

- **Severity:** High. **Evidence:** Source.
- **File/component:** `frontend/src/routes/index.tsx:30`, `Route.head`; `:135`, `ShePathApp` welcome; `frontend/src/routes/__root.tsx`, root `Route.head`.
- **Current:** Title/OG title say “Safer routes, made for you”; descriptions promise “safety-aware routes with clear scores”; CTA says “Plan a safer route”. Root metadata says “Safety-aware navigation, designed around you.” Landing copy promises lighting, activity and visibility comparisons.
- **Problem:** Live routing and historical mapped context do not establish personal safety, current activity or visibility. Metadata can circulate without the page's disclaimers.
- **Improvement:** Use “Compare walking routes” and “Explore mapped geographic context in the Ranchi pilot.” Explain that live route geometry is paired with historical OSM evidence and no safety ranking. Align page and social metadata.
- **Without backend changes:** Yes; copy and metadata only.

### F02 — Mock safety scores dominate the landing preview

- **Severity:** High. **Evidence:** Source; visual prominence needs browser confirmation.
- **File/component:** `frontend/src/routes/index.tsx:51`, `routePresentation`; `:80`, `SafetyScore`; `:157`, welcome preview; `:256–273`, mock details/report and `Factor` at `:296`.
- **Current:** Welcome always uses `mockPreviewRoutes`, even in API mode, with “Best balance”, 92/100, “92 mock safety score”, and “86% of demo route”. Mock details/report add fixed lighting, activity, open-business claims and factors 94/91/88/90.
- **Problem:** Explicit mock labels are present, but precision, green score rings and “Best” styling still resemble validated assessment. The landing disclaimer also describes the whole product as illustrative despite live functionality.
- **Improvement:** Preserve the preview card/map arrangement but replace safety numerals with neutral route-preview content. Scope “illustrative preview” to that card. If mock mode is retained, prominently label the mode and remove unsupported safety-ranking semantics throughout it.
- **Without backend changes:** Yes; presentation only. Do not replace these scores with invented OSM-derived scores.

### F03 — Required preference choices have no routing effect

- **Severity:** High. **Evidence:** Source.
- **File/component:** `frontend/src/routes/index.tsx:92,113–125,207–225`, `ShePathApp` search/preferences and `findRoutes`.
- **Current:** Three preferences are initially active; cards promise “Prioritise consistently lit roads”, “Prefer streets with more people around”, and “Avoid long isolated segments”. Only origin, destination and walking mode are submitted. API-mode description correctly discloses that preferences do not affect routing.
- **Problem:** A required, interactive step with action-oriented promises conflicts with its disclaimer. Mock routing ignores preferences too.
- **Improvement:** Keep step 2 but label it a prototype preference preview, explain the limitation beside the controls, and provide a clear continue/skip path. Avoid implying filtering, weighting, current-open status or observed crowds.
- **Without backend changes:** Yes for honest labeling/optional interaction. Actually implementing these route preferences requires new validated capabilities and is outside this audit.

### F04 — Details and report labels promise absent content

- **Severity:** High. **Evidence:** Source.
- **File/component:** `frontend/src/routes/index.tsx:253–275`, `ShePathApp` details/report, `Stat`.
- **Current:** “Step by step” has no turn instructions; “View full safety report” opens “Safety analysis not available yet”. A Safety statistic says “Not available yet”.
- **Problem:** These imply navigation instructions, an assessment, or an imminent safety feature. The available geographic evidence is more useful than the repeated unavailable message.
- **Improvement:** Keep steps 4 and 5, naming them “Route overview” and “Geographic evidence”. Rename the CTA and replace the empty Safety statistic with a supported descriptor, such as walking mode. State “No personal-safety assessment” without a release promise.
- **Without backend changes:** Yes. Real turn-by-turn guidance would require additional route data and functionality.

### F05 — Selection is not exposed programmatically

- **Severity:** High. **Evidence:** Source; screen-reader behavior pending.
- **File/component:** `frontend/src/routes/index.tsx:222`, preference buttons; `:290`, `RouteOption`.
- **Current:** Active preferences and selected route are represented by color, borders, rings and an icon. Buttons have no `aria-pressed`, radio/checkbox checked state, or explicit selected text.
- **Problem:** Keyboard activation is available through native buttons, but assistive technology lacks a reliable selection state; route selection is also visually color-dependent.
- **Improvement:** Use toggle/checkbox semantics for preferences and a labeled radio group or pressed-state buttons for route selection. Add a visible selected indicator and consistent focus-visible treatment.
- **Without backend changes:** Yes.

### F06 — Details map has conflicting heights

- **Severity:** High. **Evidence:** Source conflict; actual overlap/clipping is Browser pending.
- **File/component:** `frontend/src/routes/index.tsx:255`, details map wrapper; `frontend/src/components/ShePathMap.tsx:34`, map root.
- **Current:** Wrapper is `h-72` (normally 288 px), while the map imposes `min-h-[360px]` with `h-full`. Statistics follow the shorter wrapper inside an overflow-hidden card.
- **Problem:** The map cannot fit the allotted wrapper height; it can extend into the statistics area, with potential control/attribution clipping or overlap.
- **Improvement:** Give each map instance an explicit compatible height/min-height contract. Verify map sizing after layout changes and retain visible controls and attribution.
- **Without backend changes:** Yes; frontend layout only.

### F07 — Step changes lack focus and scroll management

- **Severity:** High. **Evidence:** Source omission; browser effects pending.
- **File/component:** `frontend/src/routes/index.tsx:88–133,181–276`, `ShePathApp`; `:282`, `PageFrame`; `SavedRanchiPilot` entry/exit.
- **Current:** Conditional screens change through local state without focus transfer, step announcement, explicit scroll reset/restore or a skip link. Step dots are decorative spans.
- **Problem:** A user may remain at an inappropriate scroll position or lose their focus context when controls unmount, especially after long evidence/saved pages.
- **Improvement:** Focus the new page heading on forward navigation, restore the initiating control on saved-view return where possible, manage scroll deliberately, and expose the current named step with accessible navigation semantics. Add a skip-to-content link.
- **Without backend changes:** Yes.

### F08 — In-app navigation is disconnected from browser history

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/routes/index.tsx:44,64,88–90,127–133,275`, `Screen`, `steps`, `ShePathApp`.
- **Current:** All five steps and saved view live at `/` in React state. Back uses the preceding array entry; reload starts at welcome. “Plan another journey” only changes the screen and retains previous inputs/preferences/routes in state.
- **Problem:** Browser Back/Forward cannot reproduce the five-step path; refresh loses the active step. “Another journey” does not clearly distinguish reuse from reset.
- **Improvement:** Define back, reload and restart behavior explicitly; consider URL-backed steps with valid-state guards, and a deliberate choice to reuse or clear inputs. Do not restore stale evidence as current.
- **Without backend changes:** Yes. Avoid exposing journey locations in URLs without a considered privacy decision.

### F09 — Input progression permits whitespace and lacks form submission

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/routes/index.tsx:197–225,286`, search/preferences and `LocationField`.
- **Current:** Search Continue checks `!from || !to`, whereas Find checks trimmed values. Inputs are not in a submitted form; Enter has no explicit progression handler. No inline validation explanation accompanies disabled Find.
- **Problem:** Whitespace can advance to a dead-end preference page. Keyboard users cannot rely on standard Enter submission.
- **Improvement:** Use trimmed validation consistently, field-specific messages and a form submit action. Keep the existing correctly wrapped labels.
- **Without backend changes:** Yes. Search suggestions/autocomplete beyond existing presets are a separate feature.

### F10 — Pilot coverage is explained only after route analysis

- **Severity:** Medium. **Evidence:** Source; actual default/preset coverage not verified here.
- **File/component:** `frontend/src/routes/index.tsx:93–94,198–205`, search/defaults/presets; `frontend/src/components/RouteEvidencePanel.tsx:10–13`.
- **Current:** Search offers Ranchi places but does not explain the bounded evidence area. Failure later says the entire route and its 100 m buffer must fit inside the pilot.
- **Problem:** A Ranchi place name is not a coverage guarantee. Presenters can unexpectedly encounter unavailable evidence despite a valid live route.
- **Improvement:** Add a concise pre-search explanation of the limited pilot and preserve routes when evidence is unavailable. Rehearse a currently supported route; never guarantee coverage from a place label or saved route ID.
- **Without backend changes:** Yes for explanation and verified demo guidance. A synchronized coverage visualization may need a dedicated metadata contract; do not invent bounds from UI inputs.

### F11 — Route comparison omits distance and has ambiguous tied labels

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/routes/index.tsx:57–61,122,290–291`, `toRouteOptions`, `findRoutes`, `RouteOption`.
- **Current:** Cards show minutes but not the already calculated `distanceKm`. All equal minimum-duration routes are named “Fastest”. Initial selection is the first returned route, which need not be fastest. Duration rounds to whole minutes, including potentially zero for short routes.
- **Problem:** Users cannot compare basic distance/time tradeoffs at a glance, and tied names also make evidence/map labels ambiguous. Initial selection may be mistaken for a recommendation.
- **Improvement:** Give every option a stable visible ordinal and distance; use “Fastest estimate” as a badge that can reflect ties. Clearly mark “Selected”; clarify that initial selection is not a safety recommendation. Format sub-minute times explicitly.
- **Without backend changes:** Yes; use existing values and preserve provider geometry/order unless intentionally changing selection behavior.

### F12 — Map selection rebuilds the map and is one-way

- **Severity:** Medium. **Evidence:** Source; visible jump/flicker and clipping pending.
- **File/component:** `frontend/src/components/ShePathMap.tsx:6–33`, `ShePathMap` effect/draw/fitBounds.
- **Current:** Every selected-ID change removes and recreates Leaflet and fits only the active route. Polylines have no selection handler; route cards are the way to choose an alternative. Map labels identify endpoints only as A/B.
- **Problem:** Selection discards user pan/zoom, may hide portions of alternatives and does not support an expected click-on-route interaction. A/B lacks a visible explanation of place identity within the map.
- **Improvement:** Update layers within a stable map instance, add explicit recenter/show-all controls and optional clickable route selection. Keep accessible cards as an equivalent control and describe A/start and B/destination in text.
- **Without backend changes:** Yes.

### F13 — Map has no explicit loading/error presentation

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/components/ShePathMap.tsx:8–34`; results map in `frontend/src/routes/index.tsx:243`.
- **Current:** No active route leaves an empty map container. Dynamic import/mount has no local error UI, and tile failures have no listener or notice. `aria-label` is attached to a generic div without an explicit map-region role or textual route summary.
- **Problem:** Loading, no route and failed external tiles can look alike; external tile availability is a live demo dependency.
- **Improvement:** Show distinct loading/empty/map-unavailable messages, handle import/tile failures and retain route summaries/selection. Name a map region and provide equivalent route information outside the interactive map.
- **Without backend changes:** Yes. Do not silently display mock geometry as a failure fallback.

### F14 — Expanded evidence makes comparison and the next action distant

- **Severity:** Medium. **Evidence:** Source; scrolling burden Browser pending.
- **File/component:** `frontend/src/routes/index.tsx:235–247`, results layout; `frontend/src/components/RouteEvidencePanel.tsx:8–32`.
- **Current:** Every route renders a full evidence panel inside a 390 px desktop sidebar with its own viewport-relative scroll limit. On mobile, a map at least 52vh precedes all cards; Details is after the last evidence panel. CSS order differs from DOM order.
- **Problem:** Later routes/actions require substantial reading/scrolling; nested desktop scrolling and mobile map gestures may interfere with navigation. Keyboard traversal order may differ from the visual order.
- **Improvement:** Keep concise evidence status and essential caveats with each card; use disclosure for detailed counts/methodology. Keep the selected route and next action easy to reach, and reconcile DOM/visual order. Verify gestures and nested scroll rather than assuming they fail.
- **Without backend changes:** Yes; do not hide unknown-data or no-safety-ranking qualifiers behind disclosure alone.

### F15 — Evidence progress and recovery are too generic

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/hooks/useRouteEvidence.ts`, `useRouteEvidence`; `frontend/src/lib/routing/routeEvidence.ts:98`, `fetchRouteEvidence`; `frontend/src/components/RouteEvidencePanel.tsx:10–13`.
- **Current:** Queued routes say “Waiting for analysis”; active requests and busy-retry backoff share “Analyzing mapped context”. Busy retries are bounded, but there is no visible retry state, batch progress or evidence-only retry action. Hook retains only an error message.
- **Problem:** Sequential work can look stalled; recovering evidence is not discoverable and restarting a journey can unnecessarily request new geometry. Each panel's status message lacks the route name in the message itself.
- **Improvement:** Expose queue position/completed count and actual retry status, route-identify announcements, preserve error codes for actionable messages, and offer deliberate evidence-only retry where appropriate. Maintain serialization, cancellation and identity checks; do not parallelize requests or add unlimited retries.
- **Without backend changes:** Yes; requires frontend hook/client UI work using current endpoints.

### F16 — Error text exposes implementation details before user actions

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/lib/routing/apiRoutingService.ts`, `ApiRoutingService.getRoutes`; `lib/routing/routeEvidence.ts`, `requestEvidence`; `lib/routing/savedPilot.ts:174`, `fetchSavedPilot`; consuming error panels.
- **Current:** Public messages mention CORS/backend configuration, `VITE_API_BASE_URL`, HTTP statuses and raw backend detail. Routing timeout is caught as an unreachable-backend message; saved loading similarly merges timeout/connectivity failures.
- **Problem:** Students/presenters need an understandable outcome and recovery action; diagnostic text can obscure whether routes or only evidence failed.
- **Improvement:** Lead with “Routes could not be loaded” or “Mapped evidence is unavailable; your route remains available”, add relevant retry/edit guidance, and put technical details in a disclosure. Distinguish timeout from connectivity where the client can do so; do not claim to distinguish network from CORS when fetch cannot.
- **Without backend changes:** Yes for the presentation and existing error categories.

### F17 — Report content appears before its page heading

- **Severity:** Medium. **Evidence:** Source ordering.
- **File/component:** `frontend/src/routes/index.tsx:261–275`, shared selected `RouteEvidencePanel` and report `PageFrame`; panel heading at `components/RouteEvidencePanel.tsx:9`.
- **Current:** On report, evidence renders before the report's H1. On details it renders after the whole page frame. The panel always uses H4, including contexts without an intervening H2/H3.
- **Problem:** The report's most useful content precedes its introduction, while details places it after the next-step CTA. Heading hierarchy and page composition are inconsistent.
- **Improvement:** Put each selected evidence panel inside its corresponding page frame after its introduction; use heading levels appropriate to the enclosing structure. Preserve selected-route binding.
- **Without backend changes:** Yes.

### F18 — Historical source context is present but too easy to miss

- **Severity:** Medium. **Evidence:** Source.
- **File/component:** `frontend/src/components/RouteEvidencePanel.tsx:9,32`; `frontend/src/components/SavedRanchiPilot.tsx:99–125`.
- **Current:** Dynamic panel begins “Mapped geographic evidence” and places raw snapshot timestamp/attribution/license at the end. Saved sources explicitly label UTC and separate route, OSM and feature timestamps, but display raw strings.
- **Problem:** A fresh analysis of live geometry can be confused with current observations. Machine timestamps slow explanation during a demo.
- **Improvement:** Near the dynamic heading state “Historical OSM snapshot; analyzed for this route”. Format existing timestamps legibly with explicit timezone and retain exact values in details. Keep saved route retrieval, OSM snapshot and feature creation distinct; never relabel them all as “updated”.
- **Without backend changes:** Yes using supplied timestamps. A new analysis time must not be invented if unavailable.

### F19 — Attribution lacks links and map credit is intentionally tiny

- **Severity:** Medium. **Evidence:** Source; rendered legibility pending. This is not a legal-compliance determination.
- **File/component:** `frontend/src/components/ShePathMap.tsx:15`, tile attribution; `frontend/src/styles.css`, `.leaflet-control-attribution`; `RouteEvidencePanel.tsx:32`; `SavedRanchiPilot.tsx:122–125`.
- **Current:** Map attribution is plain “© OpenStreetMap”; CSS forces 9 px at 0.7 opacity. Evidence and saved panels print supplied attribution/license as text without source/license links.
- **Problem:** Sources are credited, but difficult to inspect or follow; map credit is especially hard to read and may also be affected by F06.
- **Improvement:** Provide readable, discoverable OpenStreetMap contributors/source and ODbL references; preserve source text and verify credit remains visible at all map sizes. Verify appropriate source/license link targets during implementation.
- **Without backend changes:** Yes; fixed verified links plus current metadata suffice.

### F20 — Zero-denominator explanations are inconsistent

- **Severity:** Low. **Evidence:** Source.
- **File/component:** `frontend/src/components/RouteEvidencePanel.tsx:24–29`, lighting/sidewalk/opening-hours paragraphs.
- **Current:** Sidewalk explicitly explains no nearby road records at denominator zero. Lighting and opening hours can show `0/0` without equivalent local wording, though general missing-data explanations are present.
- **Problem:** Readers may interpret `0/0` as measured absence or failed arithmetic.
- **Improvement:** For each zero denominator say “No mapped records available; completeness unknown”, preserving actual zeros and never creating percentages or safety conclusions.
- **Without backend changes:** Yes.

### F21 — Saved comparison's useful controls follow extensive technical content

- **Severity:** Medium. **Evidence:** Source; mobile scroll length pending.
- **File/component:** `frontend/src/components/SavedRanchiPilot.tsx:79–83,127–280`, saved route cards and preference comparison.
- **Current:** Initial caveat discusses API coordinates/identity; cards expose raw IDs and two distance measures; three tall cards precede the saved profile selector. Generic underscore replacement displays method/indicator names and backend-generated explanations.
- **Problem:** Important scientific caveats are valuable, but implementation terminology interrupts the reader's comparison task. Mobile users must pass all route cards before reaching profile choices.
- **Improvement:** Lead with a short plain-language separation notice; move raw identifiers/API/hash explanations into existing methodology disclosure. Explain geodesic versus saved provider distance. Add a “Compare saved profiles” jump link or summary near the top, with explicit labels explaining preference groups are not safety ranks. Keep exact methodology available.
- **Without backend changes:** Yes; format existing data only. Saved map geometry remains unavailable and must not be fabricated.

### F22 — Small text and fixed layouts need readability acceptance

- **Severity:** Medium. **Evidence:** Source styles; actual failures Browser pending.
- **File/component:** `frontend/src/routes/index.tsx`, `Brand`, `SafetyScore`, `LocationField`, `Stat`, `RouteOption`, welcome badge, results heading/legend; `frontend/src/styles.css`; `components/ui/button.tsx`.
- **Current:** Several labels use 8–10 px text; important evidence is 12 px. Results truncate the origin/destination H1, details keep three statistic columns on small screens, welcome uses an offset badge, and header has a fixed height. Primary buttons use light text on the lavender token.
- **Problem:** Small text, long place names, zoom and narrow layouts may impair reading or overflow. No measured contrast failure or actual clipping is asserted here.
- **Improvement:** Increase essential labels, expose full journey names through wrapping/secondary text, allow statistics/header to reflow, and check text/focus/non-text contrast using computed colors. Preserve palette and component shapes while adjusting only failing combinations. Audit touch-target spacing and focus visibility at actual sizes.
- **Without backend changes:** Yes.

### F23 — Reduced-motion support is incomplete

- **Severity:** Low. **Evidence:** Source; runtime effect pending.
- **File/component:** `frontend/src/styles.css`, global `html` and pulse media query; `frontend/src/components/ui/button.tsx`, button variants.
- **Current:** Route pulse respects reduced-motion preference, but global smooth scrolling and button hover transforms/transitions have no corresponding override.
- **Problem:** Motion-sensitive users can still receive unnecessary animation despite their preference.
- **Improvement:** Extend reduced-motion handling to smooth scrolling and nonessential transitions/transforms while retaining visible interaction feedback.
- **Without backend changes:** Yes.

### F24 — Demo startup and pending-route detours need explicit acceptance

- **Severity:** Medium. **Evidence:** Source lifecycle; live outcome Browser pending.
- **File/component:** `frontend/src/routes/index.tsx:100–125,133`, `ShePathApp`; `hooks/useRouteEvidence.ts`; `components/ShePathMap.tsx`; `routes/__root.tsx` font links; Phase 5D report.
- **Current:** Leaving results for saved view while routing is pending invalidates the response and clears loading. Returning has no automatic route restart, so an empty results view can remain with no error/retry button. Completed routes are retained, but evidence restarts after a saved-view detour. Tiles/fonts and APIs have external/runtime dependencies.
- **Problem:** A presenter using saved comparison during a wait can return to a confusing empty state. “Saved” describes historical data, not an offline cache: it still fetches an API.
- **Improvement:** Add an explicit resume/retry route action for this empty state, and explain evidence reload where necessary. Rehearse cold start and saved detours with services available; have a clearly labeled historical fallback/demo script rather than promising offline operation.
- **Without backend changes:** Yes for recovery UI and rehearsal; service availability/configuration remains an operational prerequisite, not a frontend guarantee.

## Five-step navigation review

Welcome is an entry screen, not one of the five counted steps. The source counter correctly maps Search=1, Preferences=2, Results=3, Details=4, Report=5. Saved comparison is a separate view and should stay separate.

| Screen | Current forward/back behavior | Audit outcome |
|---|---|---|
| Welcome/onboarding | Plan enters search; saved comparison can return to welcome | Clear entry choices; correct F01/F02 wording and preview framing |
| 1 — Search | Continue enters preferences; Back returns welcome; presets set destination only | Existing labels useful; fix whitespace/Enter behavior and explain walking/pilot scope (F09/F10) |
| 2 — Preferences | Find starts routing and immediately enters results; Back returns search | Keep layout but disclose inert choices without contradictory promises (F03/F05) |
| 3 — Results | Card selection; Details disabled without a selected route; Edit returns search; Back returns preferences | Preserve loading/error protections; fix comparison, map, scroll and pending-detour recovery (F06/F11–F16/F24) |
| 4 — Details | Full safety report opens report; Back returns results | Selection retained in state; correct map sizing, labels and evidence placement (F04/F06/F17) |
| 5 — Report | Back returns details; Plan another journey returns welcome without reset | Rename report, place introduction first, define restart semantics (F04/F08/F17) |
| Saved comparison | Entry offered on welcome and all counted steps; Back restores underlying screen | Preserve isolation; improve explanation and check pending/completed return paths (F21/F24) |

Across all screens, local-state transitions lack browser history and deliberate focus/scroll handling (F07/F08). No browser navigation path was executed in this audit.

## Prioritized implementation plan

These are proposed follow-up changes, not changes made in Stage 1. Preserve the design system and route/evidence contracts. No new safety scores, inferred current-open status, synthetic geography, or saved-to-live joins should be introduced.

### Quick fixes — before the next public demonstration

1. **Responsible copy:** F01–F04. Correct metadata/CTAs, neutralize safety scores in the landing preview, explain inert preferences and rename steps 4/5 without redesigning the flow. Acceptance: every visible claim distinguishes live route estimates, historical mapped evidence and illustrative content.
2. **Clear comparison and inputs:** F09–F11. Trim inputs consistently, support Enter, show distance and unique route names, label walking mode and pilot limitations. Acceptance: whitespace cannot strand the flow; tied fastest options remain distinguishable.
3. **Local layout/semantics:** F05/F06/F17. Expose selected states, reconcile map heights and put report heading before evidence. Acceptance requires real browser and keyboard checks, not source inspection alone.
4. **Evidence clarity:** F18–F20. Surface historical snapshot status, readable timestamps/source links and zero-denominator explanations. Keep provenance, unknowns and limitations intact.

### Usability improvements — next bounded frontend pass

1. **Navigation/access:** F07/F08/F22/F23. Add focus/scroll restoration, named progress and skip navigation, agree restart/history behavior, and resolve measured readability/contrast/reflow issues while preserving visual identity.
2. **Comparison density:** F14/F21. Summarize route evidence and disclose details, improve access to Details/profile choices, and simplify saved technical terminology without removing scientific limitations.
3. **Progress and recovery:** F13/F15/F16/F24. Distinguish map states and evidence queue/retry states, add appropriate evidence-only retry and pending-route resume, and separate user guidance from diagnostics. Preserve sequential requests, bounded retries and exact-geometry binding.
4. **Map interaction:** F12. Preserve pan/zoom appropriately, add recenter/show-all and optional route clicks while retaining accessible non-map selection.

### Later enhancements — separate scope and validation

1. F08: robust refresh/deep-link behavior after deciding journey retention/privacy rules; frontend changes suffice for a bounded implementation.
2. F10/F12: an authoritative pilot-coverage overlay and richer source/methodology exploration. Confirm an appropriate metadata source/contract before promising synchronization; frontend-only is not assured for new metadata.
3. F03/F04: real preference-aware routing or turn instructions only as separately specified features with backend/provider support and validation. Historical OSM tags are insufficient to claim personal-safety ranking.
4. F13/F22/F24: measured performance/font resilience and an explicitly designed offline demonstration package if needed. Current saved comparison is API-dependent; do not call it offline-ready.

## Required browser acceptance before declaring demo readiness

All items below are **not performed**. Record browser/version, viewport, mode, service state, actual result and screenshots where relevant in a follow-up report. A failing item should become a reproduced issue rather than being retroactively claimed as tested here.

| Check | Required result |
|---|---|
| Desktop at 1280×800 and 1440×900 | All five steps readable; sidebar and document scroll predictable; map controls/credit visible; no overlap with statistics |
| Mobile at 320, 375/390 and 768 px widths; portrait/landscape | No unintended horizontal scroll; header/CTA/legend wrap; full route names available; map gestures do not prevent reaching cards; details/profile actions reachable |
| 200% zoom and narrow reflow up to 400% | Labels, statistics, source timestamps and long IDs remain usable; sticky header does not hide focus or content |
| Keyboard-only complete journey and saved detour | Logical tab order; visible focus; announced selected states; native controls usable; heading focus on new screens; return focus restored |
| Screen reader | Page/step context, route selection and named loading/error updates understandable; map has an equivalent text route summary; evidence headings correctly nested |
| Contrast and reduced motion | Measure computed text/UI/focus colors; check thin route colors against tiles; test reduced-motion behavior and touch-target spacing without assuming class names guarantee compliance |
| Live route then evidence | Selected geometry and corresponding panel agree; supported Ranchi route completes; alternative selection works; one-route result remains usable; no mock score appears as live evidence |
| Missing/unsupported evidence | Outside-pilot route remains usable with no fabricated zero counts; zero denominators read as unknown; dataset failure, timeout/busy/network and invalid response have distinct useful recovery |
| Route loading/error | No fake fallback routes; Enter and whitespace handling; Edit/Back during pending request; saved detour before routing completes; stale response never repopulates another journey |
| Saved snapshot | Historical labels/timestamps visible; profiles explained without safety rankings; loading/error/retry work; completed-live and pending-live return paths behave intentionally; no live-map attachment |
| Map/network resilience | Import/tile failure is understandable; route card information remains available; map selections/recentering work; fonts failing to load do not break layout |
| Navigation restart/history | Search through report and back; repeated journey; browser Back/Forward and reload behavior match the chosen design; scroll does not strand the next screen |

For a college presentation, introduce SHEPATH as a walking-route comparison prototype with historical mapped geographic evidence for a bounded Ranchi pilot. Demonstrate a rehearsed covered route, explicitly show unknown data and the separate saved snapshot, and explain that mapped facilities do not verify personal safety. Do not claim visual acceptance, live conditions, safety validation or offline readiness from Phase 5D's automated tests.

## Completion record

Stage 1 produces this audit and an implementation plan only. There are 24 findings: 7 High, 15 Medium and 2 Low; no Critical finding established. Browser acceptance and all proposed implementation work remain outstanding. No redesign or application changes were made.
