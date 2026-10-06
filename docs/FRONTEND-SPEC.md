# SHEPATH — Frontend Specification

**Project:** SHEPATH  
**Team:** She Builds  
**Project Type:** MCA Mini Project  
**Version:** 1.0  
**Status:** Frontend Specification

---

# 1. Purpose

This document defines the frontend design, user experience, screens, interactions and visual system for SHEPATH.

The frontend must follow:

- `SHEPATH-MASTER-SPEC.md`
- `ARCHITECTURE.md`

The frontend must not introduce features outside the Version 1 MVP defined in the Master Specification.

The frontend is responsible for:

- displaying the SHEPATH interface,
- accepting user input,
- displaying maps and routes,
- displaying route comparisons,
- displaying safety information,
- displaying the recommended route,
- displaying route explanations,
- allowing safety preferences to be adjusted,
- allowing safety-related reports to be submitted.

The frontend must not contain:

- machine-learning logic,
- route-ranking logic,
- database credentials,
- private API keys,
- backend business logic.

---

# 2. Frontend Technology

The frontend will use:

- React
- Vite
- Tailwind CSS
- Leaflet

The implementation should use reusable React components.

The UI should be responsive and work on:

- desktop,
- tablet,
- mobile.

---

# 3. Visual Direction

## Overall Design

SHEPATH should have a:

> Cute + modern + premium + trustworthy + slightly feminine technology aesthetic.

The design should be inspired by the supplied visual reference.

The reference uses:

- warm ivory backgrounds,
- lavender/purple accents,
- large bold typography,
- rounded UI elements,
- thick visual boundaries,
- generous whitespace,
- simple illustrations,
- playful but polished layouts.

SHEPATH should use the same design language without copying the reference application's branding, logo, mascot or exact interface.

---

# 4. Brand Personality

SHEPATH should feel:

- calm,
- confident,
- friendly,
- modern,
- approachable,
- intelligent,
- empowering.

It should NOT feel:

- alarming,
- overly security-focused,
- childish,
- clinical,
- corporate,
- excessively pink,
- cluttered.

The application should communicate confidence rather than fear.

---

# 5. Color System

Use the following color palette.

## Primary Colors

```text
Warm Ivory:
#FAF8F2

Lavender:
#B79AE8

Deep Lavender:
#8E6BC7

Near Black:
#17151A

Muted Purple Gray:
#6F6975

White:
#FFFFFF
