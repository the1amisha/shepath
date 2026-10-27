"""Ordered route stretches and proximity gaps; no street matching or safety scoring."""
import math

from pyproj import Transformer
from shapely.geometry import GeometryCollection, LineString, Point
from shapely.ops import substring, unary_union

import route_feature_metrics as metrics

TO_WGS84 = Transformer.from_crs('EPSG:32645', 'EPSG:4326', always_xy=True)
MAX_SEGMENTS = 2000


def intersection_parts(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type in ('LineString', 'Point'):
        yield geometry
    elif hasattr(geometry, 'geoms'):
        for part in geometry.geoms:
            yield from intersection_parts(part)


def covered_intervals(line, area):
    """Linear-reference each edge separately so loops and retracing retain distance."""
    intervals = []
    offset = 0.0
    for a, b in zip(line.coords, list(line.coords)[1:]):
        edge = LineString([a, b])
        if not edge.length:
            continue
        for part in intersection_parts(edge.intersection(area)):
            positions = [edge.project(Point(p)) for p in part.coords]
            intervals.append((offset + min(positions), offset + max(positions)))
        offset += edge.length
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1] + 1e-7:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def covered_length(intervals, start, end):
    return min(end - start, sum(max(0, min(end, b) - max(start, a)) for a, b in intervals))


def summarize_segments(line, nearby, radius):
    """~150 m stretches (100–200 m except routes shorter than 100 m).

    Counts are distinct OSM objects per stretch, not additive route totals.
    Tag coverage is proximity to usable tags on nearby roads, never matched-street coverage.
    """
    length = line.length
    n = max(1, math.ceil(length / 200), round(length / 150))
    if n > MAX_SEGMENTS:
        raise ValueError('Route exceeds segment-analysis limit')
    facilities = [(f, g) for f, g in nearby if set(f['properties']['categories']) &
                  {'shops_and_businesses', 'healthcare_facilities'}]
    roads = [(f, g) for f, g in nearby if 'roads_and_pedestrian_ways' in f['properties']['categories']]
    groups = {'facilities': facilities,
              'lighting': [(f, g) for f, g in roads if metrics.lighting_state(f['properties']['tags']) != 'unknown'],
              'sidewalk': [(f, g) for f, g in roads if metrics.sidewalk_state(f['properties']['tags']) != 'unknown']}
    intervals = {}
    for key, members in groups.items():
        area = unary_union([g.buffer(radius, quad_segs=64) for _, g in members]) if members else GeometryCollection()
        intervals[key] = covered_intervals(line, area)
    gaps = []
    cursor = 0.0
    for start, end in intervals['facilities']:
        if start > cursor:
            gaps.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < length:
        gaps.append((cursor, length))
    longest = max(gaps, key=lambda p: p[1] - p[0], default=(0.0, 0.0))
    segments = []
    for i in range(n):
        start, end = length * i / n, length * (i + 1) / n
        part = substring(line, start, end)
        corridor = part.buffer(radius, quad_segs=64)
        members = [f for f, g in facilities if g.intersects(corridor)]
        covered = covered_length(intervals['facilities'], start, end)
        status = 'none' if covered <= 1e-7 else 'continuous' if end - start - covered <= 1e-7 else 'partial'
        segments.append({'index': i + 1, 'start_metres': start, 'end_metres': end,
            'length_metres': end - start,
            'coordinates': [[lat, lon] for lon, lat in (TO_WGS84.transform(x, y) for x, y in part.coords)],
            'facility_coverage': status, 'facility_coverage_percent': 100 * covered / (end - start),
            'business_count': sum('shops_and_businesses' in f['properties']['categories'] for f in members),
            'healthcare_count': sum('healthcare_facilities' in f['properties']['categories'] for f in members),
            'lighting_unknown_percent': 100 * (1 - covered_length(intervals['lighting'], start, end) / (end - start)),
            'sidewalk_unknown_percent': 100 * (1 - covered_length(intervals['sidewalk'], start, end) / (end - start))})
    return {'schema_version': 'SHEPATH.segment_evidence.v1', 'target_length_metres': 150,
        'route_length_metres': length, 'buffer_metres': radius,
        'method': 'ordered_projected_route_proximity_not_matched_street',
        'longest_facility_gap': {'start_metres': longest[0], 'end_metres': longest[1],
                                 'length_metres': longest[1] - longest[0]},
        'lighting_unknown_percent': 100 * (1 - covered_length(intervals['lighting'], 0, length) / length),
        'sidewalk_unknown_percent': 100 * (1 - covered_length(intervals['sidewalk'], 0, length) / length),
        'segments': segments}
