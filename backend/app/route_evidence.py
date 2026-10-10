"""Bounded HTTP adapter for the unchanged offline Stage 1 engine."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import importlib
import json
import logging
import math
from pathlib import Path
import sys
import threading
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.responses import JSONResponse

PATH = '/pilot/ranchi/route-evidence'
MAX_BODY_BYTES = 1024 * 1024
BODY_TIMEOUT_SECONDS = 10
ANALYSIS_TIMEOUT_SECONDS = 60
DATA_ROOT = Path(__file__).resolve().parents[2] / 'data' / 'ranchi_safety'
logger = logging.getLogger(__name__)


def error(status, code, message):
    return HTTPException(status, detail={'status': 'service_error' if status >= 500 else 'invalid_request',
                                        'code': code, 'message': message},
                         headers={'Cache-Control': 'no-store', **({'Retry-After': '5'} if code == 'analysis_busy' else {})})


class EvidenceBodyLimit:
    """Limit streamed bytes before FastAPI JSON parsing; only this new endpoint."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] != 'POST' or scope['path'].rstrip('/') != PATH:
            return await self.app(scope, receive, send)
        async def reject(status, code, message):
            exc = error(status, code, message)
            await JSONResponse({'detail': exc.detail}, status_code=status, headers=exc.headers)(scope, receive, send)
        headers = dict(scope['headers'])
        if headers.get(b'content-encoding', b'identity') != b'identity':
            return await reject(415, 'unsupported_encoding', 'Send uncompressed JSON.')
        try:
            length = int(headers.get(b'content-length', b'0'))
            if length < 0:
                raise ValueError()
        except ValueError:
            return await reject(400, 'invalid_content_length', 'Invalid Content-Length.')
        if length > MAX_BODY_BYTES:
            return await reject(413, 'request_too_large', 'Request exceeds 1 MiB.')
        body = bytearray()
        async def read():
            while True:
                message = await receive()
                if message['type'] == 'http.disconnect':
                    return False
                chunk = message.get('body', b'')
                if len(body) + len(chunk) > MAX_BODY_BYTES:
                    raise ValueError('too_large')
                body.extend(chunk)
                if not message.get('more_body', False):
                    return True
        try:
            if not await asyncio.wait_for(read(), BODY_TIMEOUT_SECONDS):
                return
        except TimeoutError:
            return await reject(408, 'body_timeout', 'Request body must arrive within 10 seconds.')
        except ValueError:
            return await reject(413, 'request_too_large', 'Request exceeds 1 MiB.')
        def finite_float(value):
            number = float(value)
            if not math.isfinite(number):
                raise ValueError('Nonfinite JSON number')
            return number
        def reject_constant(value):
            raise ValueError('Nonstandard JSON number')
        try:
            json.loads(body, parse_float=finite_float, parse_constant=reject_constant)
        except (ValueError, UnicodeError, RecursionError):
            return await reject(422, 'invalid_json', 'Send valid JSON containing finite numbers.')
        consumed = False
        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)


Number = Annotated[float, Field(strict=True, allow_inf_nan=False, ge=0)]


class EvidenceRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    route_id: Annotated[str, Field(strict=True, min_length=1, max_length=256)]
    coordinates: Annotated[list[list[float]], Field(min_length=2, max_length=10000)]
    distance_metres: Number | None = None
    duration_seconds: Number | None = None

    @field_validator('route_id')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Nonblank route_id required')
        return value

    @field_validator('coordinates', mode='before')
    @classmethod
    def valid_coordinates(cls, value):
        if not isinstance(value, list) or not 2 <= len(value) <= 10000:
            raise ValueError('Expected 2..10000 coordinate pairs')
        for point in value:
            if (not isinstance(point, list) or len(point) != 2
                    or any(type(v) not in (int, float) for v in point)
                    or not -90 <= point[0] <= 90 or not -180 <= point[1] <= 180
                    or not all(math.isfinite(v) for v in point)):
                raise ValueError('Expected finite [latitude, longitude] within coordinate ranges')
        if all(p == value[0] for p in value):
            raise ValueError('Nonzero route geometry required')
        return value


class EvidenceResponse(BaseModel):
    schema_version: Literal['SHEPATH.dynamic_route_evidence.v1']
    status: Literal['available', 'coverage_unavailable']
    route: dict[str, Any]
    analysis: dict[str, Any]
    coverage: dict[str, Any]
    route_context: dict[str, Any] | None
    evidence_completeness: dict[str, Any]
    uncertainty_flags: list[str]
    source_provenance: dict[str, Any]
    evidence_identity_sha256: str


def load_engine():
    # Stage 1 uses sibling absolute imports. Resolve only the trusted repository directory.
    path = str(DATA_ROOT)
    if path not in sys.path:
        sys.path.insert(0, path)
    return importlib.import_module('dynamic_route_evidence')


class EvidenceService:
    """One admitted job per worker, no executor backlog. Timeout does not free a busy slot."""
    def __init__(self, loader=load_engine, timeout=ANALYSIS_TIMEOUT_SECONDS):
        self.loader = loader
        self.timeout = timeout
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='ranchi-evidence')
        self.gate = threading.Lock()
        self.engine = self.dataset = None
        self.initialization_error = None

    def _run(self, payload):
        if self.initialization_error:
            raise error(503, 'dataset_unavailable', 'Verified pilot dataset unavailable; repair installation and restart worker.')
        if self.dataset is None:
            try:
                self.engine = self.loader()
                self.dataset = self.engine.PilotDataset.load()
            except (Exception, SystemExit):
                self.initialization_error = True
                logger.exception('Ranchi evidence dataset initialization failed')
                raise error(503, 'dataset_unavailable', 'Verified pilot dataset or required dependencies unavailable.') from None
        try:
            result = self.engine.analyze_route(**payload.model_dump(), buffer_metres=100, dataset=self.dataset)
        except ValueError as exc:
            raise error(422, 'invalid_route_geometry', str(exc)) from None
        except Exception:
            logger.exception('Ranchi route evidence analysis failed')
            raise error(503, 'analysis_failed', 'Route evidence analysis unavailable.') from None
        # Keep validation and potentially large response encoding off the event loop too.
        try:
            EvidenceResponse.model_validate(result)
            return json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf-8')
        except Exception:
            logger.exception('Ranchi evidence result encoding failed')
            raise error(503, 'analysis_failed', 'Route evidence result unavailable.') from None

    async def analyze(self, payload):
        if not self.gate.acquire(blocking=False):
            raise error(503, 'analysis_busy', 'One analysis is already running in this worker. Retry later.')
        try:
            future = self.executor.submit(self._run, payload)
        except RuntimeError:
            self.gate.release()
            raise error(503, 'service_stopping', 'Evidence worker is stopping.') from None
        future.add_done_callback(lambda _: self.gate.release())
        wrapped = asyncio.wrap_future(future)
        # Retrieve background failures even if the client timeout/cancellation has already occurred.
        wrapped.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
        try:
            return await asyncio.wait_for(asyncio.shield(wrapped), self.timeout)
        except TimeoutError:
            raise error(504, 'analysis_timeout', 'Evidence analysis exceeded 60 seconds; work may still be finishing.') from None

    def close(self):
        self.executor.shutdown(wait=False, cancel_futures=True)


@asynccontextmanager
async def lifespan(app):
    app.state.route_evidence_service = EvidenceService()
    try:
        yield
    finally:
        app.state.route_evidence_service.close()


async def get_service(request: Request):
    service = getattr(request.app.state, 'route_evidence_service', None)
    if service is None:
        raise error(503, 'service_not_initialized', 'Start the application with ASGI lifespan enabled.')
    return service


router = APIRouter(tags=['Dynamic Ranchi pilot'], lifespan=lifespan)


@router.post(PATH, response_model=EvidenceResponse,
             summary='Analyze supplied route geometry against the verified Ranchi pilot',
             responses={413: {'description': 'Body exceeds 1 MiB'}, 408: {'description': 'Body read timeout'},
                        503: {'description': 'Dataset unavailable or analysis capacity busy'},
                        504: {'description': 'Analysis response timeout'}})
async def route_evidence(payload: EvidenceRequest, service: EvidenceService = Depends(get_service)):
    encoded = await service.analyze(payload)
    return Response(encoded, media_type='application/json', headers={'Cache-Control': 'no-store'})
