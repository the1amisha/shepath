import math
import os
import re
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from .pilot_ranchi import router as pilot_ranchi_router
from .route_evidence import EvidenceBodyLimit, router as route_evidence_router

app = FastAPI()
app.add_middleware(EvidenceBodyLimit)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(pilot_ranchi_router)
app.include_router(route_evidence_router)

HEIGIT_PELIAS_URL = "https://api.heigit.org/pelias/v1/search"
HEIGIT_DIRECTIONS_URL = "https://api.heigit.org/openrouteservice/v2/directions"
TRAVEL_MODE_PROFILES = {
    "walk": "foot-walking",
    "cycle": "cycling-regular",
    "drive": "driving-car",
}
REQUEST_TIMEOUT_SECONDS = 15.0
UPSTREAM_ERROR_TEXT_LIMIT = 300
GEOCODING_CANDIDATE_COUNT = 10
CITY_SANITY_DISTANCE_METERS = 100000.0
CITY_ALIASES = {
    "bengaluru": "bangalore",
    "bangalore": "bangalore",
}
COUNTRY_ALIASES = {
    "india": "india",
    "in": "india",
    "ind": "india",
}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "shepath-backend"}


Coordinate = tuple[float, float]


class RouteRequest(BaseModel):
    origin: str
    destination: str
    originPoint: Coordinate | None = None
    destinationPoint: Coordinate | None = None
    via: str | None = None
    travelMode: Literal["walk", "cycle", "drive"]

    @field_validator("originPoint", "destinationPoint", mode="before")
    @classmethod
    def validate_point(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, (list, tuple)) or len(value) != 2:
            raise ValueError("point must be [latitude, longitude]")
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in value):
            raise ValueError("point coordinates must be finite numbers")
        if not -90 <= value[0] <= 90 or not -180 <= value[1] <= 180:
            raise ValueError("point coordinates are out of range")
        return value

    @field_validator("via")
    @classmethod
    def normalize_via(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        if len(value.strip()) > 300:
            raise ValueError("via must be at most 300 characters")
        return value.strip()

    @field_validator("origin", "destination")
    @classmethod
    def must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be empty")
        return value


class Route(BaseModel):
    id: str
    distanceMeters: float
    durationSeconds: float
    coordinates: list[Coordinate]
    startPoint: Coordinate
    endPoint: Coordinate


class RouteResponse(BaseModel):
    routes: list[Route]


def load_local_env() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        key = key.strip()
        if not key or key.startswith("#"):
            continue
        if separator and key and key not in os.environ:
            os.environ[key] = value.strip().strip("\"'")


def get_heigit_api_key() -> str:
    load_local_env()
    api_key = os.getenv("HEIGIT_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Server configuration error: HEIGIT_API_KEY is not configured.",
        )
    return api_key


def normalize_text(value: Any) -> str:
    if value is None:
        return ""

    normalized = str(value).lower().strip()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    words = [CITY_ALIASES.get(word, COUNTRY_ALIASES.get(word, word)) for word in normalized.split()]
    return " ".join(words)


def split_query_parts(query: str) -> list[str]:
    return [part.strip() for part in query.split(",") if part.strip()]


def extract_query_hints(query: str) -> dict[str, Any]:
    parts = split_query_parts(query)
    normalized_parts = [normalize_text(part) for part in parts]
    all_text = normalize_text(query)

    city_hints = {
        CITY_ALIASES[word]
        for part in normalized_parts
        for word in part.split()
        if word in CITY_ALIASES
    }
    country_hints = {
        COUNTRY_ALIASES[word]
        for part in normalized_parts
        for word in part.split()
        if word in COUNTRY_ALIASES
    }

    # A known Indian city in the query is a useful country hint for Pelias ranking.
    if "bangalore" in city_hints:
        country_hints.add("india")

    main_text = normalize_text(parts[0]) if parts else all_text
    return {
        "parts": normalized_parts,
        "all_text": all_text,
        "main_text": main_text,
        "main_tokens": {token for token in main_text.split() if len(token) > 1},
        "city_hints": city_hints,
        "country_hints": country_hints,
    }


def build_geocode_queries(query: str, hints: dict[str, Any]) -> list[str]:
    queries = [query]
    normalized_query = normalize_text(query)

    if "bengaluru" in query.lower():
        queries.append(re.sub("bengaluru", "Bangalore", query, flags=re.IGNORECASE))
    if "bangalore" in normalized_query and "bangalore" not in query.lower():
        queries.append(normalized_query)

    unique_queries: list[str] = []
    seen: set[str] = set()
    for candidate_query in queries:
        candidate_key = candidate_query.lower().strip()
        if candidate_key and candidate_key not in seen:
            unique_queries.append(candidate_query)
            seen.add(candidate_key)
    return unique_queries


def get_candidate_key(feature: dict[str, Any]) -> str:
    properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    geometry = feature.get("geometry") if isinstance(feature.get("geometry"), dict) else {}
    return "|".join(
        [
            str(properties.get("gid") or ""),
            str(properties.get("label") or ""),
            str(geometry.get("coordinates") or ""),
        ]
    )


async def fetch_geocode_candidates(
    client: httpx.AsyncClient,
    api_key: str,
    query: str,
    label: str,
) -> list[dict[str, Any]]:
    hints = extract_query_hints(query)
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    for geocode_query in build_geocode_queries(query, hints):
        params: dict[str, Any] = {
            "text": geocode_query,
            "size": GEOCODING_CANDIDATE_COUNT,
        }
        if "india" in hints["country_hints"]:
            params["boundary.country"] = "IND"

        try:
            response = await client.get(
                HEIGIT_PELIAS_URL,
                params=params,
                headers={"Authorization": api_key},
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in {400, 404}:
                raise HTTPException(status_code=404, detail=f"{label} could not be geocoded.")
            raise HTTPException(
                status_code=502,
                detail=f"HeiGIT geocoding request failed for {label.lower()}.",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"HeiGIT geocoding request failed for {label.lower()}.",
            ) from exc

        features = response.json().get("features")
        if not isinstance(features, list):
            continue

        for feature in features:
            if not isinstance(feature, dict):
                continue
            candidate_key = get_candidate_key(feature)
            if candidate_key in seen:
                continue
            candidates.append(feature)
            seen.add(candidate_key)

    if not candidates:
        raise HTTPException(status_code=404, detail=f"{label} could not be geocoded.")
    return candidates


def normalize_country(value: Any) -> str:
    normalized = normalize_text(value)
    return COUNTRY_ALIASES.get(normalized, normalized)


def get_feature_coordinate(feature: dict[str, Any], label: str) -> Coordinate:
    geometry = feature.get("geometry")
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if (
        not isinstance(coordinates, list)
        or len(coordinates) < 2
        or not all(isinstance(value, (int, float)) for value in coordinates[:2])
    ):
        raise HTTPException(status_code=404, detail=f"{label} could not be geocoded.")

    longitude, latitude = coordinates[:2]
    return (float(latitude), float(longitude))


def score_geocode_candidate(feature: dict[str, Any], hints: dict[str, Any]) -> int:
    properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    name = normalize_text(properties.get("name"))
    label = normalize_text(properties.get("label"))
    locality = normalize_text(properties.get("locality"))
    localadmin = normalize_text(properties.get("localadmin"))
    region = normalize_text(properties.get("region"))
    country = normalize_country(properties.get("country"))
    country_code = normalize_country(properties.get("country_a"))

    score = 0
    location_text = " ".join([label, locality, localadmin, region, country, country_code])
    name_label_text = " ".join([name, label])

    for city in hints["city_hints"]:
        if city in {locality, localadmin}:
            score += 1000
        elif city in location_text:
            score += 800
        else:
            score -= 1000

    for country_hint in hints["country_hints"]:
        if country_hint in {country, country_code} or country_hint in label:
            score += 300
        else:
            score -= 500

    for token in hints["main_tokens"]:
        if token in name.split():
            score += 80
        elif token in label.split():
            score += 50
        elif token in name_label_text:
            score += 20

    if hints["main_text"] and hints["main_text"] in name_label_text:
        score += 150

    confidence = properties.get("confidence")
    if isinstance(confidence, (int, float)):
        score += int(confidence * 20)

    return score


def select_best_geocode_candidate(
    candidates: list[dict[str, Any]],
    query: str,
    label: str,
) -> dict[str, Any]:
    hints = extract_query_hints(query)
    scored_candidates = [
        (score_geocode_candidate(candidate, hints), candidate) for candidate in candidates
    ]
    scored_candidates.sort(key=lambda item: item[0], reverse=True)

    best_score, best_feature = scored_candidates[0]
    if hints["city_hints"] and best_score < 0:
        raise HTTPException(
            status_code=422,
            detail=f"{label} could not be confidently resolved to the requested city.",
        )

    return best_feature


def calculate_straight_line_distance_meters(
    origin: Coordinate,
    destination: Coordinate,
) -> float:
    origin_latitude, origin_longitude = origin
    destination_latitude, destination_longitude = destination
    radius_meters = 6371000.0

    delta_latitude = math.radians(destination_latitude - origin_latitude)
    delta_longitude = math.radians(destination_longitude - origin_longitude)
    origin_latitude_radians = math.radians(origin_latitude)
    destination_latitude_radians = math.radians(destination_latitude)

    a = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(origin_latitude_radians)
        * math.cos(destination_latitude_radians)
        * math.sin(delta_longitude / 2) ** 2
    )
    return radius_meters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_shared_city_hints(origin_query: str, destination_query: str) -> set[str]:
    origin_hints = extract_query_hints(origin_query)["city_hints"]
    destination_hints = extract_query_hints(destination_query)["city_hints"]
    return origin_hints.intersection(destination_hints)


def reject_implausible_same_city_geocoding(
    origin_query: str,
    destination_query: str,
    straight_line_distance_meters: float,
) -> None:
    shared_city_hints = get_shared_city_hints(origin_query, destination_query)
    if (
        shared_city_hints
        and straight_line_distance_meters > CITY_SANITY_DISTANCE_METERS
    ):
        raise HTTPException(
            status_code=422,
            detail="Location could not be confidently resolved within the requested city.",
        )


async def geocode_location(
    client: httpx.AsyncClient,
    api_key: str,
    query: str,
    label: str,
) -> Coordinate:
    # Geocoding turns a place name or address into Pelias longitude/latitude coordinates.
    candidates = await fetch_geocode_candidates(client, api_key, query, label)
    feature = select_best_geocode_candidate(candidates, query, label)
    return get_feature_coordinate(feature, label)


def to_directions_coordinate(coordinate: Coordinate) -> list[float]:
    latitude, longitude = coordinate
    # SHEPATH uses [latitude, longitude], while ORS Directions expects [longitude, latitude].
    return [longitude, latitude]


def sanitize_upstream_text(text: str, api_key: str) -> str:
    sanitized = text.replace(api_key, "[redacted]") if api_key else text
    sanitized = " ".join(sanitized.split())
    if len(sanitized) > UPSTREAM_ERROR_TEXT_LIMIT:
        return f"{sanitized[:UPSTREAM_ERROR_TEXT_LIMIT]}..."
    return sanitized


async def fetch_directions(
    client: httpx.AsyncClient,
    api_key: str,
    profile: str,
    start_point: Coordinate,
    end_point: Coordinate,
    request_alternatives: bool = True,
    via_point: Coordinate | None = None,
) -> dict[str, Any]:
    # Directions request asks HeiGIT/openrouteservice for GeoJSON route geometry.
    request_body = {
        "coordinates": [
            to_directions_coordinate(start_point),
            *([to_directions_coordinate(via_point)] if via_point is not None else []),
            to_directions_coordinate(end_point),
        ],
        "instructions": False,
    }

    if request_alternatives and via_point is None:
        request_body["alternative_routes"] = {
            "target_count": 3,
            "share_factor": 0.6,
            "weight_factor": 1.4,
        }

    try:
        response = await client.post(
            f"{HEIGIT_DIRECTIONS_URL}/{profile}/geojson",
            headers={"Authorization": api_key},
            json=request_body,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        content_type = exc.response.headers.get("content-type", "unknown")
        sanitized_response_text = sanitize_upstream_text(exc.response.text, api_key)
        raise HTTPException(
            status_code=502,
            detail={
                "message": "HeiGIT directions request failed.",
                "upstreamStatus": exc.response.status_code,
                "upstreamContentType": content_type,
                "upstreamError": sanitized_response_text,
            },
        ) from exc
    except httpx.HTTPError as exc:
        sanitized_response_text = sanitize_upstream_text(str(exc), api_key)
        raise HTTPException(
            status_code=502,
            detail={
                "message": "HeiGIT directions request failed.",
                "upstreamStatus": None,
                "upstreamContentType": None,
                "upstreamError": sanitized_response_text,
            },
        ) from exc


def map_geojson_route(
    feature: dict[str, Any],
    profile: str,
    index: int,
    fallback_start: Coordinate,
    fallback_end: Coordinate,
) -> Route:
    geometry = feature.get("geometry")
    raw_coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if not isinstance(raw_coordinates, list) or not raw_coordinates:
        raise HTTPException(status_code=502, detail="HeiGIT directions response was invalid.")

    coordinates: list[Coordinate] = []
    for coordinate in raw_coordinates:
        if (
            isinstance(coordinate, list)
            and len(coordinate) >= 2
            and all(isinstance(value, (int, float)) for value in coordinate[:2])
        ):
            longitude, latitude = coordinate[:2]
            # Response mapping converts GeoJSON [longitude, latitude] back to SHEPATH [latitude, longitude].
            coordinates.append((float(latitude), float(longitude)))

    if not coordinates:
        raise HTTPException(status_code=502, detail="HeiGIT directions response was invalid.")

    properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    summary = properties.get("summary") if isinstance(properties.get("summary"), dict) else {}

    return Route(
        id=str(feature.get("id") or f"heigit-{profile}-route-{index + 1}"),
        distanceMeters=float(summary.get("distance", 0.0)),
        durationSeconds=float(summary.get("duration", 0.0)),
        coordinates=coordinates,
        startPoint=coordinates[0] if coordinates else fallback_start,
        endPoint=coordinates[-1] if coordinates else fallback_end,
    )


def map_directions_response(
    data: dict[str, Any],
    profile: str,
    start_point: Coordinate,
    end_point: Coordinate,
) -> RouteResponse:
    features = data.get("features")
    if not isinstance(features, list) or not features:
        raise HTTPException(status_code=502, detail="HeiGIT directions response contained no routes.")

    routes = [
        map_geojson_route(feature, profile, index, start_point, end_point)
        for index, feature in enumerate(features)
        if isinstance(feature, dict)
    ]
    if not routes:
        raise HTTPException(status_code=502, detail="HeiGIT directions response contained no valid routes.")

    return RouteResponse(routes=routes)


@app.post("/route", response_model=RouteResponse)
async def create_route(route_request: RouteRequest) -> RouteResponse:
    api_key = get_heigit_api_key()
    profile = TRAVEL_MODE_PROFILES[route_request.travelMode]

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        start_point = route_request.originPoint or await geocode_location(
            client,
            api_key,
            route_request.origin,
            "Origin",
        )
        end_point = route_request.destinationPoint or await geocode_location(
            client,
            api_key,
            route_request.destination,
            "Destination",
        )
        straight_line_distance_meters = calculate_straight_line_distance_meters(
            start_point,
            end_point,
        )
        reject_implausible_same_city_geocoding(
            "" if route_request.originPoint else route_request.origin,
            "" if route_request.destinationPoint else route_request.destination,
            straight_line_distance_meters,
        )
        via_point = None
        if route_request.via:
            via_point = await geocode_location(client, api_key, route_request.via, "Via location")
            for label, point in (("" if route_request.originPoint else route_request.origin, start_point), ("" if route_request.destinationPoint else route_request.destination, end_point)):
                reject_implausible_same_city_geocoding(
                    label, route_request.via, calculate_straight_line_distance_meters(point, via_point)
                )
        directions = await fetch_directions(
            client,
            api_key,
            profile,
            start_point,
            end_point,
            **({"via_point": via_point, "request_alternatives": False} if via_point is not None else {}),
        )

    return map_directions_response(directions, profile, start_point, end_point)

