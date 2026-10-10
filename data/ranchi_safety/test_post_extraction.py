"""Metric synthetic geometries validate corridor analysis without network calls."""
import tempfile
from pathlib import Path
import unittest

from shapely.geometry import LineString, Point, Polygon, mapping
import verify_post_extraction as post


def feature(ident, kind, geometry, **tags):
    props = dict(type=kind,id=ident,tags=tags)
    props['categories'] = post.extract.categories(props)
    return dict(type='Feature',id=f'{kind}/{ident}',properties=props,geometry=mapping(geometry))


class PostExtractionTests(unittest.TestCase):
    def setUp(self):
        self.line = LineString([(0,0),(1000,0)])

    def test_point_inside_outside_and_touching(self):
        geoms = [Point(500,0),Point(500,100),Point(500,101)]
        selected = [(feature(i,'node',g,shop='bakery'),g) for i,g in enumerate(geoms,1)]
        result = post.analyze_corridor(self.line,selected)
        self.assertEqual(result['unique_features'],2)
        self.assertEqual(result['ids'],['node/1','node/2'])
        self.assertAlmostEqual(result['route_length_within_100m_of_category']['shops_and_businesses']['route_length_percent'],20,places=6)

    def test_crossing_way_no_inside_vertices_and_clipped_length(self):
        g = LineString([(500,-300),(500,300)])
        result = post.analyze_corridor(self.line,[(feature(1,'way',g,highway='footway',lit='no'),g)])
        self.assertEqual(result['counts']['roads_and_pedestrian_ways'],1)
        self.assertAlmostEqual(result['road_length_in_buffer_metres'],200)
        self.assertAlmostEqual(result['lit_tagged_road_length_in_buffer_metres'],200)
        self.assertEqual(result['lighting_values'],{'no':1})

    def test_proximity_union_does_not_double_count_overlap(self):
        geoms = [Point(450,0),Point(550,0)]
        result = post.analyze_corridor(self.line,[(feature(i,'node',g,shop='bakery'),g) for i,g in enumerate(geoms,1)])
        self.assertAlmostEqual(result['route_length_within_100m_of_category']['shops_and_businesses']['length_metres'],300)

    def test_backtracking_route_preserves_travelled_distance(self):
        line = LineString([(0,0),(1000,0),(0,0)])
        point = Point(500,0)
        result = post.analyze_corridor(line,[(feature(1,'node',point,shop='bakery'),point)])
        self.assertAlmostEqual(result['route_length_within_100m_of_category']['shops_and_businesses']['length_metres'],400)
        self.assertAlmostEqual(result['route_length_within_100m_of_category']['shops_and_businesses']['route_length_percent'],20)

    def test_enclosing_polygon_geometry_not_centroid_selection(self):
        g = Polygon([(-1000,-1000),(2000,-1000),(2000,1000),(-1000,1000)])
        result = post.analyze_corridor(self.line,[(feature(1,'way',g,amenity='hospital'),g)])
        self.assertEqual(result['counts']['hospitals'],1)
        self.assertAlmostEqual(result['route_length_within_100m_of_category']['healthcare_facilities']['route_length_percent'],100)

    def test_empty_category_denominator_unknown(self):
        result = post.analyze_corridor(self.line,[])
        self.assertIsNone(result['lighting']['missing_percent'])
        self.assertEqual(result['route_length_within_100m_of_category']['police_stations']['length_metres'],0)

    def test_missing_tag_is_not_no_and_category_overlap(self):
        g = LineString([(0,0),(1000,0)])
        fs = [feature(1,'way',g,highway='residential'),feature(2,'way',g,highway='residential',lit='no'),
              feature(1,'node',Point(500,0),amenity='pharmacy')]
        result = post.summarize(fs)
        self.assertEqual(result['unique_features'],3)
        self.assertEqual(result['lighting_values'],{'<absent>':1,'no':1})
        self.assertEqual(result['lighting']['missing_percent'],50)
        self.assertEqual(result['counts']['pharmacies'],1)
        self.assertEqual(result['counts']['shops_and_businesses'],1)
        self.assertEqual(result['opening_hours']['missing'],1)

    def test_typed_ids_and_duplicate_rejection(self):
        records = [dict(type='node',id=1),dict(type='way',id=1)]
        self.assertEqual(len(post.unique_records(records)),2)
        with self.assertRaisesRegex(ValueError,'Duplicate'): post.unique_records(records+[records[0]])

    def test_artifact_hash_mismatch_stops(self):
        with tempfile.TemporaryDirectory(dir=post.ROOT) as directory:
            folder = Path(directory)
            p = folder/'data.json'
            p.write_text('{}')
            manifest = {'artifacts':{'data.json':post.extract.sha(p)}}
            self.assertEqual(post.checked_artifacts(folder,manifest),[p])
            p.write_text('changed')
            with self.assertRaisesRegex(ValueError,'hash mismatch'): post.checked_artifacts(folder,manifest)

    def test_missing_geometry_reference_stops(self):
        records = {'way/1':dict(type='way',id=1,nodes=[123,456],tags={'highway':'footway'},extraction_role='feature')}
        with self.assertRaisesRegex(ValueError,'Unresolved references'):
            post.validate_geometries([],records,post.box(0,0,1,1))

    def test_coordinate_range_rejection(self):
        records = {'node/1':dict(type='node',id=1,coordinates=[85,123],tags={},extraction_role='geometry_support')}
        with self.assertRaisesRegex(ValueError,'Invalid node'):
            post.validate_geometries([],records,post.box(0,0,1,1))


if __name__=='__main__': unittest.main(verbosity=2)
