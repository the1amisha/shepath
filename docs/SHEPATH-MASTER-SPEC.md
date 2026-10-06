# SHEPATH-MASTER-SPEC

**Navigate with confidence.**

This is the frozen Step 1 reference document. Everything built afterward — architecture, frontend spec, backend spec, database, ML, integration — must trace back to this spec. Do not add features, tables, endpoints, or algorithms here; those come in later steps.

## 1. Project Identity

| Field | Value |
| --- | --- |
| Project Name | SHEPATH |
| Team Name | She Builds |
| Team Size | 2 |
| Project Type | MCA Mini Project |
| Tagline | Navigate with confidence. |

> "She doesn't need a shorter route. She needs a route that understands her."
> 

## 2. What Problem Are We Solving?

Traditional navigation systems primarily optimize for distance, travel time, or traffic.

SHEPATH aims to recommend a route that considers safety-related environmental and contextual factors — especially for women travelling alone — by combining signals such as lighting, pedestrian activity, incident history, walkability, and help availability. The system also explains *why* a particular route was recommended.

<aside>
⚠️

**SHEPATH is NOT** "an app that guarantees a woman is safe."

**SHEPATH IS** a decision-support / navigation system that estimates relative route risk using available data, and explains its reasoning.

</aside>

This distinction matters for documentation and viva: SHEPATH predicts and explains relative risk — it does not promise safety.

## 3. MVP Scope (Version 1)

Frozen for v1 — do not expand beyond this list:

1. User enters starting location.
2. User enters destination.
3. User selects departure time.
4. System generates multiple possible routes.
5. Each route receives a safety/risk score.
6. System compares travel time, distance, and safety factors.
7. SHEPATH recommends one route.
8. System explains why that route was recommended.
9. User can adjust safety preferences.
10. User can submit a safety-related report.

<aside>
🛑

**Explicitly out of scope for v1:** SOS/emergency calling, continuous live tracking, trusted-contact/guardian networks, computer vision on street imagery, chatbot, wearables. These are Phase 2+ ideas only.

</aside>

## 4. AI-Assisted Development Strategy

AI builds the software — AI is not required to be a visible feature everywhere in the product itself.

**Lovable**

- Generate frontend UI
- Generate React components
- Build responsive layouts

**Codex**

- Build backend
- Implement APIs
- Implement database integration
- Implement routing logic
- Implement ML integration
- Write tests

**Claude**

- Review architecture
- Review code
- Identify bugs
- Suggest improvements

**ChatGPT**

- Product architecture
- Documentation
- Prompt design
- Debugging support
- Project planning

## 5. Technology Stack (Frozen for now — do not install yet)

| Layer | Choice |
| --- | --- |
| Frontend | React + Vite, Tailwind CSS, Leaflet |
| Backend | Python, FastAPI |
| Database | PostgreSQL / Supabase |
| Maps | OpenStreetMap |
| Routing | OSRM (initial) |
| Machine Learning | Python, scikit-learn |
| Version Control | GitHub |
| Deployment | Vercel + backend hosting |
| AI Development Tools | Lovable, Codex, Claude |

## 6. Definition of Success

SHEPATH will be considered successful when:

1. A user can enter a source and destination.
2. The application can generate routes.
3. Routes can be evaluated using safety-related factors.
4. The system can recommend a route.
5. The recommendation can be explained.
6. Users can modify safety preferences.
7. The complete application works through a browser.

## 7. First Demo Script

<aside>
🎬

User opens SHEPATH → enters **College → Home** → chooses departure time **10:00 PM** → SHEPATH generates routes:

- Route A — 18 min — Safety 61
- **Route B — 21 min — Safety 87 ⭐ (Recommended)**
- Route C — 19 min — Safety 73

**Why Route B?**
✅ Better lighting
✅ Lower incident risk
✅ More active road
✅ Better access to help

</aside>

This demo story is the north star for every later build decision — if a feature doesn't help tell this story better, it doesn't belong in v1.

---

## What comes after this spec

This document is Step 1 only. Do not start on these yet:

```
STEP 1  →  Master Specification (this document) ✅
STEP 2  →  Project/GitHub structure
STEP 3  →  Frontend specification (for Lovable)
STEP 4  →  Backend specification (for Codex)
STEP 5  →  Database design
STEP 6  →  ML design
STEP 7  →  Integration
STEP 8  →  Testing
STEP 9  →  Deployment
```

**Competitive note for later positioning work:** Safetipin is the closest existing competitor (safety scores, audits, safest routes, community data, multi-city). The pitch can't be "we show safe routes" — it needs to be about time-aware safety prediction, explainable recommendations, and personalized risk priorities, since those are harder to copy than UI alone.