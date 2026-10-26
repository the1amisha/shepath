# SHEPATH Phase 7C Stage 2C — Geographic Artifact Portability

Date: October 12, 2026. Repository: `D:\shepath`.
Baseline HEAD: `215c6717d942fd609a49e833c31a4c82926a6cfd`. Working tree was clean at entry.

## Outcome

Fixed the Windows-separator defect in the shared geographic artifact verifier. Manifest names using backslashes, forward slashes or mixed separators now become host-native relative paths. Directory containment and exact SHA-256 validation remain mandatory; absolute, drive-relative, UNC, traversal and alternate-stream paths are rejected.

**127 tests passed on Windows: 40 backend and 87 geographic, including seven new portability tests. No tests were skipped.** All three saved-route dynamic responses retain exact historical geometry, calculations, coverage, feature selection, disclosures and data provenance, with only the edited verifier's code hash and the resulting evidence identity changed. The saved comparison remains unchanged.

This removes the identified source-level POSIX lookup blocker. **Linux compatibility is not yet verified:** POSIX path checks used `PurePosixPath` on Windows. No Linux process, container, WSL installation, fresh clone, deployment or browser session was tested.

## Reviewed instructions and prior evidence

Reviewed the Stage 1 startup audit, Stage 2A report, Stage 2B report, Windows startup guide, backend evidence adapter and geographic loader/verifier chain. Repository instruction discovery found `frontend/AGENTS.md`; no root or backend/data nested `AGENTS.md` was found. Frontend files were not changed.

Stage 2B's installation, server-on-8012 and saved-geometry HTTP success are user-supplied historical manual results. This report's test results and hash inventory were independently executed by Codex using the existing `backend/.venv-demo`; no installation was performed. Its observed runtime is CPython 3.11.9, Shapely 2.1.2, pyproj 3.7.2, osmium 4.3.1, FastAPI 0.143.0 and httpx 0.28.1. The FastAPI version differs from the older Stage 2A baseline; dependencies were not changed during this task.

## Path audit and implementation

| Location | Finding and disposition |
|---|---|
| `backend/app/route_evidence.py:22,143` | Resolves the data directory from `__file__` and imports the trusted sibling engine. No hardcoded `D:` runtime root; unchanged. The repository hierarchy must still be packaged together. |
| `data/ranchi_safety/dynamic_route_evidence.py:106–134` | Verifies the pinned extraction manifest, delegates artifact verification, verifies the boundary and reconstructs/validates geometries from exported objects. Unchanged. |
| `data/ranchi_safety/verify_post_extraction.py:43–60` | Original `run / relative` treated historical backslashes as literal characters on POSIX. All six extraction artifact keys use backslashes. Added `artifact_parts()` and joined validated components with native `Path.joinpath()`. This is the sole production-source change. |
| `data/ranchi_safety/offline_pbf_extract.py:19–21` | Boundary and saved-route constants use file-relative roots and slash-delimited paths supported by pathlib on both platforms. No correction needed. |
| Extraction manifest `source_path` | Contains historical Windows separators, but the dynamic loader does not reopen the regional source PBF through this field. It remains historical provenance, unchanged. The six verified exports include the small pilot PBF; no regional extraction/index is required for requests. |
| `backend/app/pilot_ranchi.py:123–125,206–235` | Saved comparison already normalizes backslashes, resolves containment and validates linked hashes/route identities. Left unchanged. Saved input-run paths remain separate from new live evidence. |
| `data/ranchi_safety/compare_routes.py:23–40` | Offline comparison bundle reader reuses the corrected verifier. Its existing regression suite passes. No extraction or report-generation CLI was run. |
| `data/ranchi_safety/verify_route_coverage.py:12–21` | File-relative optional `.route_coverage_deps` import location is a legacy setup assumption, not a Windows absolute path. Left unchanged. A clean target still needs compatible native packages; local import success is not a Linux dependency test. |
| Case-sensitive lookup | New tests inspect exact directory-entry spelling for all six extraction artifact paths. Independent inventory also matches all 13 extraction/feature/comparison artifact paths against exact Git-tracked names and verifies their hashes. No case correction or artifact rename was necessary. A real case-sensitive OS remains untested. |
| `data/ranchi_safety/.gitattributes` | Existing byte-preservation rules and explicit CRLF rules for historical dynamic fixtures remain untouched. Preserving checkout bytes remains necessary for hashes. |

`PureWindowsPath` is used only as a platform-independent parser: it understands both stored separator styles without requiring Windows filesystem calls. Its components preserve case. Empty names, rooted paths, drive paths (including `C:relative`), UNC/device paths, `..` components, colons and NULs fail before hash reads. The resolved native path must still be inside the resolved run directory, so an external symlink/junction target cannot bypass containment. File presence and SHA-256 checks are unchanged.

Normalization occurs only while locating files. No manifest key, stored path, provenance field, JSON artifact or data byte is rewritten. Parent traversal is rejected even if it would eventually return inside the run. There are no new dependencies.

## Geographic and identity preservation

The dynamic engine and geometric algorithms were not edited. Ordered coordinates, binary64 geometry hashing, fixed nominal 100 m buffer, EPSG:32645 projection, densification, feature selection, duplicate treatment and safety limitations remain unchanged.

Evidence identity includes code provenance (`dynamic_route_evidence.py:101–104,182–183`). Correctly recording the new verifier therefore necessarily produces a different evidence identity. Retaining the historical evidence digest after a source edit would misrepresent provenance. Neither the identity formula nor the pinned historical responses were changed.

| Identity | Observed value |
|---|---|
| Previous verifier SHA-256, from baseline Git bytes | `d3a89e93eb454260b48d830dde094ea6bcf52671fb83db7bfd4da50f8bd1acf4` |
| Current verifier SHA-256 | `02ece77ea20f0cd2ffb392dbebb7d88e68bff1fa7dc48cdb80bb44b6544b5cd6` |
| Route 1 geometry SHA-256, unchanged | `d9f3307bcc18af2403eac7851006d58ec874faa3c249f9cccb6d203c41f4b460` |
| Historical Route 1 evidence SHA-256, artifact unchanged | `d28750b4d8a3b99a3dc7abe7ef36f905d321bb28c12182d2432d3fdc50c00e2b` |
| Newly computed Route 1 evidence SHA-256 | `2269c0f269cae87e259054f92e1ce21cfbdbc4534b33339ecfa0ae015e182b1e` |
| Newly computed Route 2 evidence SHA-256 | `cfe8e8e6829e0ea8a8c0fd017d295249019e4551fa5d54b98ace0bffa8785e53` |
| Newly computed Route 3 evidence SHA-256 | `e0f91f1f116408f5f3a55611a4e984caa1be61ab2ac5b2af075c63e4b9038761` |

The backend parity test now changes only the expected verifier hash in an in-memory copy of each historical response, derives the expected digest using the existing formula, and compares the entire actual response to that expectation. It does not strip provenance, ignore arbitrary response fields, rewrite fixtures or relax production pins. All other code hashes and package-version provenance must still match the historical response for this test to pass. Route IDs, full coordinate arrays, estimates, analysis, coverage, selected OSM identities/counts, dataset-content hash, source artifact hashes, attribution and uncertainty disclosures remain exactly equal.

Independent hash inventory verified all **13** extraction/feature/comparison artifacts against their existing manifests and Git paths. Boundary and saved-route files are also tracked; the successful loader/backend tests validate their required integrity links. The extraction manifest pin remains `ae9d1e9134b276c4ca20297b02dacf38320e2ed98e001a4419788f310e9a1d0b`. The 2,720-feature historical snapshot timestamp remains `2026-10-08T20:21:06Z`. Git diff shows no dataset, manifest or historical artifact edits.

## Independently executed validation

Commands, using the existing environment without activation or environment-variable changes:

```powershell
Set-Location D:\shepath
.\backend\.venv-demo\Scripts\python.exe -B -m unittest discover -s backend/tests -v
Set-Location D:\shepath\data\ranchi_safety
..\..\backend\.venv-demo\Scripts\python.exe -B -m unittest test_artifact_paths test_dynamic_route_evidence test_route_features test_route_comparison test_route_coverage test_post_extraction -v
```

| Check | Result |
|---|---|
| Backend suite | 40 passed, exit 0, 26.888 s. In-process FastAPI TestClient checks include saved comparison, three real saved geometries, invalid/missing/corrupt data, CORS and resource-bound/error behavior. Live provider responses are mocked; the real geographic parity test forbids socket connections. |
| Geographic suites | 87 passed, exit 0, 42.843 s. Covers new paths plus dynamic analysis, feature metrics, comparison, coverage and post-extraction verification. No skips. |
| New path regressions | Seven tests: both/mixed separators with byte/manifest preservation; Windows/POSIX pure-path simulation; unsafe inputs rejected before reads; simulated resolved escape; actual Windows symlink escape; missing/corrupt hashes for both styles; six real pinned paths, in-memory POSIX keys and exact case. |
| Independent artifact inventory | All 13 manifest artifact hashes match; exact Git paths exist. Read-only check. |
| Scope and whitespace | Required final Git checks passed as recorded below. New files also checked for trailing whitespace because ordinary Git diff omits untracked content. |

The suites ran concurrently; timings are observations, not startup/latency benchmarks. Intentional failure-injection tests logged expected exceptions. FastAPI/Starlette emitted a TestClient httpx deprecation warning; all backend tests passed and no dependency changes were made.

## Limitations and remaining work

1. Run the same suites on an actual Linux checkout with platform-native packages, preserved Git attributes and a case-sensitive filesystem. Confirm artifact hashes, saved comparison and all three route responses there before claiming Linux acceptance. No Linux installation or execution was attempted here.
2. Evidence identities depend on source bytes and geographic package versions. Different versions or altered line endings can change identities; do not patch historical pins to force agreement. Cross-platform numerical parity is still a target-platform acceptance item.
3. The containment check assumes trusted local artifacts are not concurrently replaced between resolution and opening. It is not a descriptor-based defense against hostile concurrent filesystem mutation. External resolved symlinks are rejected; a mocked resolution test additionally exercises the same gate without needing symlink privileges.
4. No fresh-clone installation, package installation, cold Uvicorn startup, running-server refresh, live routing-provider call, network integration, browser walkthrough, frontend build, mobile or accessibility acceptance was performed. Existing workers can retain a previously loaded dataset/code until deliberately restarted; this task did not restart servers.
5. Historical extraction/regeneration tools and their full platform matrix are outside this request-time artifact fix. No regional PBF/index download or regeneration was performed. Frontend, routing integration, credentials, environment settings and deployment configuration are unchanged.
6. Production readiness remains unverified. This fix supports the existing rehearsed desktop prototype but does not complete deployment, dependency locking or operational acceptance.

Historical mapped proximity and geographic coverage do not establish personal safety, current operating hours, lighting quality, sidewalk continuity or pedestrian activity. OSM attribution, snapshot provenance and responsible disclosures are preserved. No safety rankings were introduced.

## Changed files and final Git checks

Exactly four files changed or created:

- Modified `data/ranchi_safety/verify_post_extraction.py`: portable relative artifact lookup and validation.
- Modified `backend/tests/test_route_evidence.py`: full historical response parity with current verifier provenance.
- Created `data/ranchi_safety/test_artifact_paths.py`: seven focused regressions.
- Created `PHASE_7C_STAGE_2C_REPORT.md`: this report.

Final commands from the repository root:

```powershell
git diff --check
git status --short --untracked-files=all
```

`git diff --check` passed (exit 0; no whitespace errors). Git may emit its existing LF-to-CRLF advisory for the backend test file; geographic source/artifact byte-preservation attributes were not changed. The additional read-only whitespace check of both new files passed.

Expected final status, verified at completion:

```text
 M backend/tests/test_route_evidence.py
 M data/ranchi_safety/verify_post_extraction.py
?? PHASE_7C_STAGE_2C_REPORT.md
?? data/ranchi_safety/test_artifact_paths.py
```

No commits or pushes were made.
