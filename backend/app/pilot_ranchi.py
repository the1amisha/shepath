"""Read-only adapter for the reviewed Ranchi snapshot. No provider/analysis imports."""
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, ValidationError

DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "ranchi_safety"
COMPARISON_RUN = "route_comparison_runs/20261010T060453_649409Z"
COMPARISON_SHA256 = "b7f6241c246b7fd4bb7322dff21dd32f545e2895a3ccb2c504101f6f9f490236"
SAVED_ROUTES = "route_coverage_runs/20261008T140112_006152Z/routes.json"
JOURNEY_ID = "ranchi-albert-ekka-chowk-doranda-walk-20261008"
EXPECTED_JOURNEY = {"origin": "Albert Ekka Chowk, Ranchi", "destination": "Doranda, Ranchi", "travelMode": "walk"}
MAX_JSON_BYTES = 8 * 1024 * 1024


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ComparisonRoute(StrictModel):
    route_id: str
    geodesic_distance_metres: FiniteFloat = Field(gt=0)
    backend_distance_metres: FiniteFloat = Field(gt=0)
    distance_denominator_km: FiniteFloat = Field(gt=0)
    criteria: dict[str, Any]
    context: dict[str, Any]
    availability: dict[str, Any]
    correlation_audit: dict[str, Any]


class PreferenceProfile(StrictModel):
    priorities: list[str]
    method: str
    preference_fronts: list[list[str]]
    first_front_candidates: list[str]
    pairwise: list[dict[str, Any]]
    within_front_order: str
    interpretation: str


class ComparisonArtifact(StrictModel):
    schema_version: Literal["SHEPATH.phase5b.v1"]
    interpretation: str
    source_feature_manifest: dict[str, Any]
    source_provenance: dict[str, Any]
    comparison_code_sha256: dict[str, str]
    versions: dict[str, str]
    normalization: dict[str, Any]
    routes: list[ComparisonRoute] = Field(min_length=3, max_length=3)
    profiles: dict[str, PreferenceProfile]
    dimension_comparisons: dict[str, Any]


class SavedJourney(StrictModel):
    id: str
    origin: str
    destination: str
    travelMode: Literal["walk"]
    routeIds: list[str]
    retrievedAtUtc: str
    savedRoutesSha256: str
    geometrySha256ByRoute: dict[str, str]
    geometryHashConvention: str


class Applicability(StrictModel):
    scope: Literal["fixed_saved_journey_only"] = "fixed_saved_journey_only"
    appliesToNewRoutes: Literal[False] = False
    routeIdsAreSnapshotLocal: Literal[True] = True
    actualWalkedStreetAttribution: Literal["unverified"] = "unverified"
    liveObservations: Literal[False] = False
    personalSafetyRecommendation: Literal[False] = False
    message: str = "Saved mapped-context preference comparison only. Matching route IDs or place names do not validate newly generated geometry, accessibility, operating status or personal safety."


class Integrity(StrictModel):
    status: Literal["verified"] = "verified"
    comparisonRun: str
    comparisonSha256: str
    featureDatasetSha256: str
    verification: str = "Pinned comparison SHA-256; linked Phase 5A artifact hashes; saved-route hash and route/profile consistency."


class PilotComparisonResponse(StrictModel):
    status: Literal["available"] = "available"
    journey: SavedJourney
    applicability: Applicability
    integrity: Integrity
    comparison: ComparisonArtifact


class ErrorDetail(StrictModel):
    status: Literal["unavailable", "not_applicable", "invalid_request"]
    code: str
    message: str


class ErrorResponse(StrictModel):
    detail: ErrorDetail


@dataclass(frozen=True)
class SnapshotFiles:
    root: Path = DATA_ROOT
    comparison_run: str = COMPARISON_RUN
    comparison_sha256: str = COMPARISON_SHA256
    saved_routes: str = SAVED_ROUTES


def get_snapshot_files() -> SnapshotFiles:
    return SnapshotFiles()


def require(condition: bool) -> None:
    if not condition:
        raise ValueError("Invalid saved comparison artifact")


def child(root: Path, relative: str) -> Path:
    path = (root / relative.replace("\\", "/")).resolve()
    require(path.is_relative_to(root.resolve()))
    return path


def read_json(path: Path, expected_hash: str | None = None) -> dict[str, Any]:
    with path.open("rb") as handle:
        raw = handle.read(MAX_JSON_BYTES + 1)
    require(len(raw) <= MAX_JSON_BYTES)
    if expected_hash is not None:
        require(hashlib.sha256(raw).hexdigest() == expected_hash)
    def reject_constant(value: str) -> None:
        raise ValueError("Nonfinite JSON number")
    def unique_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result = {}
        for key, value in pairs:
            require(key not in result)
            result[key] = value
        return result
    result = json.loads(raw, parse_constant=reject_constant, object_pairs_hook=unique_keys)
    require(isinstance(result, dict))
    return result


def route_map(routes: list[dict[str, Any]], field: str) -> dict[str, dict[str, Any]]:
    ids = [route[field] for route in routes]
    require(len(ids) == len(set(ids)) == 3 and all(isinstance(i, str) for i in ids))
    return dict(zip(ids, routes))


def validate_links(comparison: dict[str, Any], feature_data: dict[str, Any], saved: dict[str, Any]) -> list[str]:
    require(saved["request"] == EXPECTED_JOURNEY)
    require(saved["coordinate_order"] == "latitude, longitude")
    require(feature_data["schema_version"] == "SHEPATH.phase5a.v1")
    require(comparison["source_provenance"] == feature_data["provenance"])
    cr = route_map(comparison["routes"], "route_id")
    fr = route_map(feature_data["routes"], "route_id")
    sr = route_map(saved["routes"], "id")
    require(set(cr) == set(fr) == set(sr))
    for ident, route in cr.items():
        feature = fr[ident]
        require(route["geodesic_distance_metres"] == feature["route_length_geodesic_metres"])
        require(route["backend_distance_metres"] == feature["backend_distance_metres"] == sr[ident]["distanceMeters"])
        require(route["distance_denominator_km"] == feature["route_length_geodesic_metres"] / 1000)
        require(route["criteria"]["distance_metres"]["value"] == route["geodesic_distance_metres"])
        for name, original in (("evidence_indicators", "evidence_confidence"), ("lighting", "lighting"),
                               ("sidewalk", "sidewalk"), ("opening_hours", "opening_hours"),
                               ("verified_on_walked_street", "verified_on_walked_street")):
            require(route["availability"][name] == feature[original])
        require(route["availability"]["opening_hours"]["currently_open"] is None)
        require(route["availability"]["verified_on_walked_street"]["status"] == "not_performed")
        for category, context in route["context"].items():
            category_source = feature["categories"][category]
            require(context["raw_count"] == category_source["count"])
            require(context["ids"] == category_source["ids"])
            require(context["raw_route_proximity"] == category_source["route_proximity"])
    ids = set(cr)
    require({"distance_first", "support_first", "pedestrian_first", "pareto_tradeoffs"} <= comparison["profiles"].keys())
    for profile in comparison["profiles"].values():
        fronts = profile["preference_fronts"]
        require(bool(fronts) and all(front for front in fronts))
        flattened = [i for front in fronts for i in front]
        require(len(flattened) == 3 and set(flattened) == ids)
        require(profile["first_front_candidates"] == fronts[0])
        seen = set()
        for pair in profile["pairwise"]:
            pair_ids = {pair["first"], pair["second"]}
            require(len(pair_ids) == 2 and pair_ids <= ids)
            require(pair["preferred"] is None or pair["preferred"] in pair_ids)
            require(isinstance(pair["explanation"], str) and bool(pair["explanation"]))
            seen.add(frozenset(pair_ids))
            for trace in pair["trace"]:
                require(all(set(values) == pair_ids for values in trace["measurements"].values()))
        require(len(seen) == len(profile["pairwise"]) == 3)
    for dimension in comparison["dimension_comparisons"].values():
        require(set(dimension["robust_leaders"]) <= ids)
        for pair in dimension["pairwise"]:
            require({pair["first"], pair["second"]} <= ids)
    return sorted(ids)


def load_snapshot(files: SnapshotFiles) -> PilotComparisonResponse:
    """Reads and checks each request; no stale success cache and no fallback computation."""
    run = child(files.root, files.comparison_run)
    manifest = read_json(run / "run_manifest.json")
    require(manifest["status"] == "complete")
    require(manifest["artifacts"]["comparison.json"] == files.comparison_sha256)
    comparison = read_json(run / "comparison.json", files.comparison_sha256)
    parsed = ComparisonArtifact.model_validate(comparison)
    feature_run = child(files.root, manifest["input_run"])
    feature_manifest = read_json(feature_run / "run_manifest.json")
    require(feature_manifest == comparison["source_feature_manifest"])
    require(feature_manifest["status"] == "complete")
    artifacts = feature_manifest["artifacts"]
    require({"route_features.json", "feature_evidence.json", "duplicate_review.json"} <= artifacts.keys())
    # Read each artifact once; verification and parsing use the same bytes.
    feature_data = None
    for relative, digest in artifacts.items():
        path = child(feature_run, relative)
        # Duplicate review is a JSON array: verify bytes without pretending it is a dict.
        if relative == "duplicate_review.json":
            with path.open("rb") as handle:
                raw = handle.read(MAX_JSON_BYTES + 1)
            require(len(raw) <= MAX_JSON_BYTES and hashlib.sha256(raw).hexdigest() == digest)
            require(isinstance(json.loads(raw), list))
        else:
            value = read_json(path, digest)
            if relative == "route_features.json": feature_data = value
    require(feature_data is not None)
    saved = read_json(child(files.root, files.saved_routes), comparison["source_provenance"]["saved_routes_sha256"])
    ids = validate_links(comparison, feature_data, saved)
    geometry_hashes = {r["id"]: hashlib.sha256(json.dumps(r["coordinates"], separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest() for r in saved["routes"]}
    return PilotComparisonResponse(
        journey=SavedJourney(id=JOURNEY_ID, **EXPECTED_JOURNEY, routeIds=ids,
            retrievedAtUtc=saved["retrieved_at_utc"], savedRoutesSha256=comparison["source_provenance"]["saved_routes_sha256"],
            geometrySha256ByRoute=geometry_hashes,
            geometryHashConvention="SHA-256 of compact UTF-8 JSON of ordered saved [latitude,longitude] coordinates; no spaces, no newline; number formatting must match."),
        applicability=Applicability(),
        integrity=Integrity(comparisonRun=files.comparison_run, comparisonSha256=files.comparison_sha256,
                            featureDatasetSha256=artifacts["route_features.json"]),
        comparison=parsed,
    )


def error(status_code: int, status: str, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"status": status, "code": code, "message": message},
                         headers={"Cache-Control": "no-store"})


def normalize_name(value: str) -> str:
    return " ".join(value.casefold().split())


router = APIRouter(prefix="/pilot/ranchi", tags=["Saved Ranchi pilot"])


@router.get("/comparison", response_model=PilotComparisonResponse,
    summary="Read the fixed saved Ranchi journey comparison",
    description="Read-only Phase 5B snapshot for Albert Ekka Chowk to Doranda, walk. Optional query values are applicability assertions, not new routing inputs or filters. All three saved routes and profiles are returned. No provider request or analysis is run.",
    responses={409: {"model": ErrorResponse, "description": "Requested journey, route or saved-route fingerprint does not match"},
               422: {"model": ErrorResponse, "description": "Incomplete or unsupported applicability assertions"},
               503: {"model": ErrorResponse, "description": "Saved artifacts missing, corrupt or inconsistent"}})
def get_comparison(request: Request, response: Response, origin: str | None = None,
                   destination: str | None = None, travelMode: str | None = None,
                   routeId: str | None = None, journeyId: str | None = None,
                   savedRoutesSha256: str | None = None,
                   files: SnapshotFiles = Depends(get_snapshot_files)) -> PilotComparisonResponse:
    allowed = {"origin", "destination", "travelMode", "routeId", "journeyId", "savedRoutesSha256"}
    if any(k not in allowed or len(request.query_params.getlist(k)) != 1 for k in request.query_params):
        raise error(422, "invalid_request", "unsupported_parameters", "Use only the documented, single-value saved-journey assertions.")
    if (origin is None) != (destination is None):
        raise error(422, "invalid_request", "incomplete_journey", "Supply both origin and destination, or omit both to read the saved journey.")
    mismatch = (origin is not None and (normalize_name(origin) != normalize_name(EXPECTED_JOURNEY["origin"])
                or normalize_name(destination) != normalize_name(EXPECTED_JOURNEY["destination"])))
    mismatch = mismatch or (travelMode is not None and travelMode != "walk") or (journeyId is not None and journeyId != JOURNEY_ID)
    if mismatch:
        raise error(409, "not_applicable", "journey_mismatch", "Comparison applies only to the saved Albert Ekka Chowk, Ranchi to Doranda, Ranchi walking journey, in that direction.")
    try:
        snapshot = load_snapshot(files)
    except FileNotFoundError:
        raise error(503, "unavailable", "artifact_missing", "The verified pilot comparison bundle is not installed completely.") from None
    except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError, ValidationError):
        raise error(503, "unavailable", "artifact_invalid", "The saved comparison bundle failed integrity or consistency checks.") from None
    if routeId is not None and routeId not in snapshot.journey.routeIds:
        raise error(409, "not_applicable", "route_mismatch", "The requested route ID is not part of this saved comparison.")
    if savedRoutesSha256 is not None and savedRoutesSha256 != snapshot.journey.savedRoutesSha256:
        raise error(409, "not_applicable", "geometry_snapshot_mismatch", "The requested saved-route fingerprint does not match this comparison.")
    response.headers["Cache-Control"] = "no-store"
    return snapshot
