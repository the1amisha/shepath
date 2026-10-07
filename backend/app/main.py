from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, field_validator

app = FastAPI()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "shepath-backend"}


Coordinate = tuple[float, float]


class RouteRequest(BaseModel):
    origin: str
    destination: str
    travelMode: Literal["walk", "cycle", "drive"]

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


@app.post("/route", response_model=RouteResponse)
def create_route(route_request: RouteRequest) -> RouteResponse:
    mock_coordinates: list[Coordinate] = [
        (28.6139, 77.2090),
        (28.6147, 77.2124),
        (28.6161, 77.2167),
    ]

    return RouteResponse(
        routes=[
            Route(
                id=f"mock-{route_request.travelMode}-route-1",
                distanceMeters=850.0,
                durationSeconds=620.0,
                coordinates=mock_coordinates,
                startPoint=mock_coordinates[0],
                endPoint=mock_coordinates[-1],
            )
        ]
    )
