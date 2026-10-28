"""Preserve selected facility schedules for offline departure-time presentation."""
SCHEMA_VERSION = 'SHEPATH.facility_hours.v1'


def facility_hours(features):
    records = []
    for feature in sorted(features, key=lambda f: f['id']):
        properties = feature['properties']
        categories = properties['categories']
        business = 'shops_and_businesses' in categories
        healthcare = 'healthcare_facilities' in categories
        if not (business or healthcare):
            continue
        tags = properties['tags']
        records.append({'osm_id': feature['id'], 'name': tags.get('name'),
                        'business': business, 'healthcare': healthcare,
                        'opening_hours': tags.get('opening_hours')})
    return {'schema_version': SCHEMA_VERSION, 'records': records}
