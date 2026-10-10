"""Offline Phase 5D route evidence. See DYNAMIC_ROUTE_EVIDENCE_REPORT.md.

Load PilotDataset once per worker; analyze_route performs no file or network I/O.
Invalid arguments raise ValueError. Valid unsupported geometry returns
coverage_unavailable, with route_context=None (never fabricated zero counts).
"""
from copy import deepcopy
from functools import lru_cache
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
from typing import Literal, TypedDict

from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import transform, unary_union

import route_feature_metrics as metrics
import verify_post_extraction as verify

ROOT = Path(__file__).resolve().parent
SCHEMA_VERSION = 'SHEPATH.dynamic_route_evidence.v1'
MANIFEST_SHA256 = 'ae9d1e9134b276c4ca20297b02dacf38320e2ed98e001a4419788f310e9a1d0b'
HASH_CONVENTION = ('sha256 of UTF-8 compact JSON ordered [latitude,longitude] arrays; '
                   'finite binary64 numbers converted with float.hex(), signed zero normalized; '
                   'no rounding, sorting, simplification or removal of repeated vertices')
MAX_COORDINATES = 10000
MAX_DENSE_COORDINATES = 50000


class RouteEvidence(TypedDict):
    schema_version: str
    status: Literal['available', 'coverage_unavailable']
    route: dict
    analysis: dict
    coverage: dict
    route_context: dict | None
    evidence_completeness: dict
    uncertainty_flags: list[str]
    source_provenance: dict
    evidence_identity_sha256: str


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False, allow_nan=False).encode('utf-8')).hexdigest()


def validate_coordinates(coordinates):
    if not isinstance(coordinates, (list, tuple)) or not 2 <= len(coordinates) <= MAX_COORDINATES:
        raise ValueError(f'Expected 2..{MAX_COORDINATES} ordered [latitude, longitude] pairs')
    normalized = []
    for point in coordinates:
        if (not isinstance(point, (list, tuple)) or len(point) != 2
                or not all(verify.coverage.finite(v) for v in point)
                or not -90 <= point[0] <= 90 or not -180 <= point[1] <= 180):
            raise ValueError('Invalid finite [latitude, longitude] coordinate')
        normalized.append([0.0 if v == 0 else float(v) for v in point])
    if all(p == normalized[0] for p in normalized):
        raise ValueError('Route must have nonzero geometric length')
    return normalized


def geometry_identity(coordinates):
    return digest([[v.hex() for v in p] for p in validate_coordinates(coordinates)])


class PilotDataset:
    """In-memory immutable-by-convention snapshot; construct production data via load().

    Constructor supports explicit synthetic fixtures. Production provenance is only
    assigned by load(), after pinned manifest and exported geometry verification.
    """
    def __init__(self, bbox, features, pairs, provenance=None):
        if (len(bbox) != 4 or not all(verify.coverage.finite(v) for v in bbox)
                or not 22 < bbox[0] < bbox[2] < 25 or not 84 < bbox[1] < bbox[3] < 87):
            raise ValueError('Expected a valid local Ranchi bounding box')
        self.bbox = tuple(bbox)
        self._features = deepcopy(features)
        self._pairs = deepcopy(pairs)
        self._provenance = deepcopy(provenance or {'integrity': 'synthetic_unverified_fixture'})
        ids = [f['id'] for f in self._features]
        verify.require(len(ids) == len(set(ids)), 'Duplicate typed OSM feature IDs')
        for f in self._features:
            p = f['properties']
            verify.require(f['id'] == f"{p['type']}/{p['id']}", 'Inconsistent OSM identity')
            verify.require(isinstance(p['categories'], list) and set(p['categories']) <= set(metrics.GROUPS) | {'recorded_highway_lighting'},
                           'Missing or unknown category membership')
            verify.require(isinstance(p['tags'], dict) and all(isinstance(v, str) for v in p['tags'].values()),
                           'Invalid OSM tags')
        verify.require(all(p['first'] in ids and p['second'] in ids for p in pairs), 'Unknown duplicate member')
        self._projected = [(f, transform(verify.coverage.TO_METRES.transform, shape(f['geometry'])))
                           for f in sorted(self._features, key=lambda f: f['id'])]
        verify.require(all(not g.is_empty and g.is_valid for f, g in self._projected), 'Invalid feature geometry')
        south, west, north, east = bbox
        self._boundary = box(west, south, east, north)
        ring = verify.coverage.densify([(west, south), (east, south), (east, north), (west, north), (west, south)])
        self._metric_boundary = transform(verify.coverage.TO_METRES.transform, Polygon(ring))
        self._provenance['dataset_content_sha256'] = digest({'bbox': bbox, 'features': self._features, 'pairs': pairs})
        self._provenance['code_sha256'] = {p.name: verify.extract.sha(p) for p in
            (Path(__file__), Path(metrics.__file__), Path(verify.__file__),
             Path(verify.coverage.__file__), Path(verify.extract.__file__))}
        self._provenance['versions'] = {p: importlib.metadata.version(p) for p in ('shapely', 'pyproj', 'osmium')}

    @classmethod
    def load(cls):
        """Verify small local exports once; never open regional index/PBF or saved routes."""
        manifest_path = verify.RUN / 'manifest.json'
        verify.require(verify.extract.sha(manifest_path) == MANIFEST_SHA256, 'Unrecognized pilot manifest')
        manifest = verify.load(manifest_path)
        verify.require(manifest['status'] == 'complete' and manifest['quality']['unresolved_issues'] == 0,
                       'Incomplete pilot extraction')
        paths = verify.checked_artifacts(verify.RUN, manifest)
        by_name = {p.name: p for p in paths}
        verify.require(by_name['issues.jsonl'].stat().st_size == 0, 'Unresolved extraction issues')
        verify.require(verify.extract.sha(verify.extract.BOUNDARY) == manifest['fingerprint']['boundary_sha256'],
                       'Boundary hash mismatch')
        bbox = verify.load(verify.extract.BOUNDARY)['bbox_south_west_north_east']
        verify.require(bbox == manifest['bbox_south_west_north_east'], 'Boundary mismatch')
        features = verify.load(by_name['features.geojson'])['features']
        with by_name['objects.jsonl'].open(encoding='utf-8') as stream:
            records = verify.unique_records(json.loads(row) for row in stream if row.strip())
        verify.validate_geometries(features, records, box(bbox[1], bbox[0], bbox[3], bbox[2]))
        summary = verify.summarize(features)
        verify.require(summary['unique_features'] == manifest['quality']['unique_features']
                       and summary['category_types'] == manifest['quality']['category_types'], 'Inventory mismatch')
        pairs = [json.loads(row) for row in by_name['potential_duplicates.jsonl'].read_text(encoding='utf-8').splitlines() if row.strip()]
        verify.require(len(pairs) == manifest['quality']['potential_facility_duplicate_pairs'], 'Duplicate inventory mismatch')
        return cls(bbox, features, pairs, {
            'integrity': 'pinned_manifest_export_hashes_and_reconstructed_geometries_verified',
            'manifest_sha256': MANIFEST_SHA256, 'source_snapshot_timestamp': manifest['pbf_header']['osmosis_replication_timestamp'],
            'source_pbf_sha256': manifest['fingerprint']['source_sha256'], 'source_url': manifest['source_url'],
            'boundary_sha256': manifest['fingerprint']['boundary_sha256'], 'artifact_hashes': manifest['artifacts'],
            'geometry_provenance': 'Full original WGS84 feature geometry rebuilt from objects.jsonl node/way/relation references; no centroid substitution or clipping',
            'attribution': manifest['attribution'], 'license': manifest['license'],
            'loaded_export_bytes': sum(p.stat().st_size for p in paths), 'feature_count': len(features)})


@lru_cache(maxsize=1)
def default_dataset():
    return PilotDataset.load()


def analyze_route(route_id, coordinates, distance_metres=None, duration_seconds=None,
                  buffer_metres=100, *, dataset=None) -> RouteEvidence:
    """Analyze ordered WGS84 [lat, lon] coordinates with an EPSG:32645 metre buffer.

    Optional supplied distance/duration are metadata, never geometric denominators.
    Use dataset=PilotDataset.load() for explicit worker lifetime; otherwise a lazy
    process cache is used. No result is cached by route ID.
    """
    if not isinstance(route_id, str) or not route_id.strip():
        raise ValueError('Nonblank string route ID required')
    coords = validate_coordinates(coordinates)
    for name, value in (('distance_metres', distance_metres), ('duration_seconds', duration_seconds)):
        if value is not None and (not verify.coverage.finite(value) or value < 0):
            raise ValueError(f'{name} must be null or finite and nonnegative')
    if not verify.coverage.finite(buffer_metres) or not 0 < buffer_metres <= 1000:
        raise ValueError('Analysis buffer must be finite and in (0, 1000] metres')
    data = default_dataset() if dataset is None else dataset
    geometry_hash = geometry_identity(coords)
    analysis = {'buffer_metres': float(buffer_metres), 'metric_crs': 'EPSG:32645',
                'route_densification_max_metres': 25, 'buffer_quadrant_segments': 64,
                'coverage_boundary_guard_metres': 0.01,
                'coverage_buffer_radius_metres': buffer_metres / math.cos(math.pi / 256) + 0.01,
                'selection': 'full_feature_geometry_intersects_closed_buffer',
                'geometry_hash_convention': HASH_CONVENTION,
                'proximity_denominator': 'projected traversed route length in metres',
                'coverage_method': 'entire centerline and conservative full buffer containment; no sampling-only or area-percentage threshold'}
    result = RouteEvidence(schema_version=SCHEMA_VERSION, status='coverage_unavailable',
        route={'id': route_id, 'coordinates': coords, 'coordinate_order': 'latitude,longitude',
               'geometry_sha256': geometry_hash, 'supplied_distance_metres': distance_metres,
               'supplied_duration_seconds': duration_seconds}, analysis=analysis,
        coverage={'bbox_south_west_north_east': list(data.bbox), 'centerline_fully_covered': False,
                  'full_buffer_covered': False, 'reason': 'centerline_outside_pilot'},
        route_context=None, evidence_completeness={'status': 'not_analyzed_coverage_unavailable'},
        uncertainty_flags=['OSM_real_world_completeness_unknown', 'walked_street_attribution_unverified',
                           'pedestrian_activity_unknown', 'current_operating_status_unknown',
                           'missing_tags_are_not_negative_safety_evidence'],
        source_provenance=deepcopy(data._provenance), evidence_identity_sha256='')
    result['evidence_identity_sha256'] = digest({'geometry_sha256': geometry_hash, 'analysis': analysis,
                                               'schema_version': SCHEMA_VERSION, 'source': data._provenance})
    geographic_line = LineString([(lon, lat) for lat, lon in coords])
    if not data._boundary.covers(geographic_line):
        return result  # Reject distant/outside coordinates before local projection/densification.
    dense_count = 1 + sum(max(1, math.ceil(verify.coverage.GEOD.inv(*a, *b)[2] / 25))
                          for a, b in zip(geographic_line.coords, list(geographic_line.coords)[1:]))
    if dense_count > MAX_DENSE_COORDINATES:
        raise ValueError(f'Route exceeds {MAX_DENSE_COORDINATES} densified vertices')
    dense = verify.coverage.densify(list(geographic_line.coords))
    line = transform(verify.coverage.TO_METRES.transform, LineString(dense))
    coverage, _, _ = verify.coverage.buffer_coverage(line, data._metric_boundary, buffer_metres)
    conservative = line.buffer(analysis['coverage_buffer_radius_metres'], quad_segs=64)
    supported = data._metric_boundary.buffer(-0.01).covers(conservative)
    result['coverage'].update(centerline_fully_covered=True, full_buffer_covered=supported,
        nominal_buffer=coverage, reason=None if supported else 'full_buffer_outside_pilot_or_boundary_guard')
    if not supported:
        return result
    context = deepcopy(metrics.engineer_metric_route(line, data._projected, data._pairs, buffer_metres))
    context['route_length_geodesic_metres'] = verify.coverage.clipped_lengths(dense, data._boundary)[0]
    selected = {row['osm_id'] for row in context['nearby_evidence']}
    context['source_features'] = deepcopy([f for f, g in data._projected if f['id'] in selected])
    context['duplicate_pairs'] = deepcopy([p for p in data._pairs if p['first'] in selected or p['second'] in selected])
    context['opening_hours']['all_selected_recorded_tags'] = [
        {'osm_id': f['id'], 'value': f['properties']['tags']['opening_hours']}
        for f, g in data._projected if f['id'] in selected and 'opening_hours' in f['properties']['tags']]
    # Phase 5A's clipped_road_length is an object-line sum, not unique coverage.
    # Preserve it for parity, and explicitly provide non-overlapping line coverage.
    roads = [g.intersection(line.buffer(buffer_metres, quad_segs=64)) for f, g in data._projected
             if f['id'] in selected and 'roads_and_pedestrian_ways' in f['properties']['categories']]
    parts = [part for g in roads for part in verify.coverage.line_parts(g)]
    context['nearby_road_geometry'] = {'unique_clipped_line_length_metres': unary_union(parts).length,
        'OSM_object_line_sum_metres': sum(p.length for p in parts),
        'interpretation': 'Unique length unions overlapping lines; lighting/sidewalk clipped_road_length retains Phase 5A object-line denominators, not unique geographic coverage.'}
    hours = context['opening_hours']['nonblank']
    result.update(status='available', route_context=context, evidence_completeness={
        'status': 'mapped_snapshot_analyzed', 'real_world_completeness': 'unknown',
        'lighting': context['lighting']['availability_indicator'],
        'sidewalk': context['sidewalk']['availability_indicator'],
        'business_opening_hours': ('no_business_records' if not hours['denominator'] else
            'absent' if not hours['numerator'] else 'complete_in_selected_records' if hours['percent'] == 100 else 'partial_in_selected_records')})
    for key in ('lighting', 'sidewalk'):
        if result['evidence_completeness'][key] != 'complete_in_selected_records':
            result['uncertainty_flags'].append(key + '_tags_incomplete')
    if hours['numerator'] != hours['denominator'] or not hours['denominator']:
        result['uncertainty_flags'].append('business_opening_hours_incomplete')
    if context['duplicate_pairs']:
        result['uncertainty_flags'].append('ambiguous_facility_duplicates_retained')
    return result
