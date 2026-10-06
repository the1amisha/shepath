# SHEPATH — System Architecture

**Project:** SHEPATH  
**Team:** She Builds  
**Project Type:** MCA Mini Project  
**Version:** 1.0  
**Status:** Architecture Specification

---

# 1. Purpose

This document defines the technical architecture of SHEPATH.

The architecture must remain consistent with `SHEPATH-MASTER-SPEC.md`.

The system is designed as a modular web application that:

1. Accepts a source location.
2. Accepts a destination.
3. Accepts a departure time.
4. Generates multiple possible routes.
5. Evaluates routes using safety-related factors.
6. Compares route distance, travel time and safety.
7. Recommends one route.
8. Explains the recommendation.
9. Allows users to adjust safety preferences.
10. Allows users to submit safety-related reports.

SHEPATH estimates relative route risk using available data. It does not guarantee personal safety.

---

# 2. Architecture Style

SHEPATH will use a:

## Modular Monolith Architecture

The project will have:

- One frontend application.
- One FastAPI backend.
- One PostgreSQL database.
- One ML module integrated into the backend.
- External mapping/routing services where required.

We will NOT use microservices for Version 1.

### Reason

The team has two members and this is an MCA mini project.

A modular monolith keeps the system:

- easier to develop,
- easier to debug,
- easier to deploy,
- easier to explain in a viva,
- easier for AI coding agents to modify consistently.

The internal modules will still have clear responsibilities so they can be separated later if the project grows.

---

# 3. High-Level Architecture

```text
                         USER
                           |
                           v
                  +------------------+
                  |    SHEPATH UI    |
                  | React + Vite     |
                  | Tailwind CSS     |
                  | Leaflet          |
                  +--------+---------+
                           |
                           | HTTPS / REST API
                           v
                  +------------------+
                  |     FastAPI      |
                  |     Backend      |
                  +--------+---------+
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
 +----------------+ +-------------+ +----------------+
 | Route Service  | | ML Service  | | Report Service |
 +-------+--------+ +------+------+ +----------------+
         |                 |                 |
         |                 |                 |
         v                 v                 v
 +---------------+   +-----------+    +-------------+
 | OSRM Routing  |   | Risk Model|    | PostgreSQL  |
 +-------+-------+   +-----------+    +-------------+
         |
         v
 +---------------+
 | OpenStreetMap |
 +---------------+

                    +----------------+
                    | Explanation    |
                    | Engine         |
                    +----------------+
                           |
                           v
                   Route explanation
