"""Synthetic fixtures only. Every test file stays under data/ranchi_safety/."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from xml.sax.saxutils import quoteattr

import osmium
import offline_pbf_extract as pipeline

BBOX = json.loads(pipeline.BOUNDARY.read_text(encoding="utf-8"))["bbox_south_west_north_east"]
S, W, N, E = BBOX
X, Y = (W+E)/2, (S+N)/2
META = 'version="3" timestamp="2026-01-02T03:04:05Z" changeset="42" uid="7" user="fixture"'


def tags(values):
    return "".join(f'<tag k={quoteattr(k)} v={quoteattr(v)}/>' for k, v in values.items())


def node(ident, x=X, y=Y, **values):
    return f'<node id="{ident}" lon="{x:.7f}" lat="{y:.7f}" {META}>{tags(values)}</node>'


def way(ident, refs, **values):
    return f'<way id="{ident}" {META}>' + "".join(f'<nd ref="{n}"/>' for n in refs) + tags(values) + '</way>'


def relation(ident, members, **values):
    return f'<relation id="{ident}" {META}>' + ''.join(f'<member type="{t}" ref="{i}" role="{r}"/>' for t, i, r in members) + tags(values) + '</relation>'


class OfflineTests(unittest.TestCase):
    def setUp(self):
        parent = pipeline.ROOT / "offline_test_work"
        parent.mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=parent)
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def source(self, parts, pbf=True):
        xml = self.root / "fixture.osm"
        xml.write_text('<osm version="0.6" generator="SHEPATH synthetic fixture">' + ''.join(parts) + '</osm>', encoding="utf-8")
        if not pbf: return xml
        dest = self.root / "fixture.osm.pbf"
        writer = osmium.SimpleWriter(str(dest))
        class Copier(osmium.SimpleHandler):
            def node(self, o): writer.add_node(o)
            def way(self, o): writer.add_way(o)
            def relation(self, o): writer.add_relation(o)
        try: Copier().apply_file(str(xml))
        finally: writer.close()
        return dest

    def extract(self, parts, pbf=True, **kwargs):
        result = pipeline.run(self.source(parts, pbf), self.root / "run", **kwargs)
        folder = self.root / "run" / result["output_folder"]
        features = json.loads((folder / "features.geojson").read_text(encoding="utf-8"))["features"]
        objects = [json.loads(line) for line in (folder / "objects.jsonl").read_text(encoding="utf-8").splitlines()]
        return result, features, objects

    def test_crossing_without_interior_vertex_preserves_full_geometry_metadata(self):
        result, features, objects = self.extract([node(1,W-.01,Y), node(2,E+.01,Y), way(10,[1,2],highway="residential",lit="no",sidewalk="both")])
        self.assertEqual(result["status"], "complete")
        self.assertEqual(len(features), 1)
        self.assertAlmostEqual(features[0]["geometry"]["coordinates"][0][0], W-.01)
        self.assertEqual(features[0]["properties"]["version"], 3)
        self.assertEqual(features[0]["properties"]["timestamp"], "2026-01-02 03:04:05+00:00")
        self.assertEqual(features[0]["properties"]["uid"], 7)
        self.assertEqual(sum(o["extraction_role"] == "geometry_support" for o in objects), 2)

    def test_inside_outside_and_boundary_following(self):
        result, features, _ = self.extract([node(1,W,S),node(2,E,S),node(3,X,Y),node(4,X+.001,Y),node(5,W-.02,S-.01),node(6,W-.01,S-.01),
            way(10,[1,2],highway="footway"),way(11,[3,4],highway="path"),way(12,[5,6],highway="residential")])
        self.assertEqual({f["id"] for f in features}, {"way/10","way/11"})
        self.assertEqual(result["quality"]["lighting"]["missing_percent"],100)

    def test_business_without_hours_and_unknown_lighting(self):
        result, _, _ = self.extract([node(1,shop="convenience"),node(2,X+.001,Y),node(3,X+.002,Y),
            way(10,[1,2],highway="residential"),way(11,[2,3],highway="footway",lit="no")])
        self.assertEqual(result["quality"]["opening_hours_nonblank"]["missing"],1)
        self.assertEqual(result["quality"]["lighting_values"], {"<absent>":1,"no":1})

    def test_category_overlap_typed_ids_and_complete_tags(self):
        result, features, _ = self.extract([node(1,amenity="pharmacy",opening_hours="24/7"),node(2,X+.001,Y),way(1,[1,2],highway="footway",surface="paved")])
        self.assertEqual(result["quality"]["unique_features"],2)
        self.assertEqual({f["id"] for f in features},{"node/1","way/1"})
        self.assertEqual(result["quality"]["category_memberships"]["pharmacies"],1)

    def polygon(self, hole=False, broken=False):
        pts = [(W-.01,S-.01),(E+.01,S-.01),(E+.01,N+.01),(W-.01,N+.01)]
        parts = [node(i+1,*p) for i,p in enumerate(pts)]
        refs = [1,2,3,4] if broken else [1,2,3,4,1]
        members = [("way",10,"outer")]
        if hole:
            pts2 = [(W-.005,S-.005),(E+.005,S-.005),(E+.005,N+.005),(W-.005,N+.005)]
            parts += [node(i+5,*p) for i,p in enumerate(pts2)]
        parts += [way(10,refs)]
        if hole:
            parts += [way(11,[5,6,7,8,5])]
            members.append(("way",11,"inner"))
        return parts + [relation(20,members,type="multipolygon",amenity="hospital")]

    def test_enclosing_multipolygon_and_closure(self):
        result, features, objects = self.extract(self.polygon())
        self.assertEqual([f["id"] for f in features],["relation/20"])
        self.assertEqual(len(objects),6)
        self.assertEqual(result["status"],"complete")

    def test_multipolygon_hole_excludes_pilot(self):
        result, features, objects = self.extract(self.polygon(hole=True))
        self.assertEqual(features,[])
        self.assertEqual(objects,[])
        self.assertEqual(result["status"],"complete")

    def test_split_outer_ring_assembled(self):
        parts = self.polygon()[:-2]
        parts += [way(10,[1,2,3]),way(11,[3,4,1]),relation(20,[("way",10,"outer"),("way",11,"outer")],type="multipolygon",amenity="hospital")]
        result, features, objects = self.extract(parts)
        self.assertEqual(result["status"],"complete")
        self.assertEqual(features[0]["geometry"]["type"],"Polygon")
        self.assertEqual(len(objects),7)

    def test_unsupported_nested_multipolygon_explicitly_partial(self):
        result, _, _ = self.extract([node(1),relation(10,[("node",1,"")],type="site"),relation(20,[("relation",10,"outer")],type="multipolygon",amenity="hospital")])
        self.assertEqual(result["status"],"partial")

    def test_potential_duplicates_retained(self):
        result, features, _ = self.extract([node(1,amenity="police",name="Pilot Police"),node(2,X+.00001,Y,amenity="police",name="pilot police")])
        self.assertEqual(len(features),2)
        self.assertEqual(result["quality"]["potential_facility_duplicate_pairs"],1)

    def test_broken_ring_partial(self):
        result, _, _ = self.extract(self.polygon(broken=True))
        self.assertEqual(result["status"],"partial")

    def test_missing_way_node_partial(self):
        result, features, _ = self.extract([node(1),way(10,[1,999],highway="residential")])
        self.assertEqual(result["status"],"partial")
        self.assertEqual(features,[])

    def test_missing_relation_member_partial(self):
        result, _, _ = self.extract([relation(20,[("way",999,"outer")],type="multipolygon",amenity="hospital")])
        self.assertEqual(result["status"],"partial")

    def test_nested_relation_closure(self):
        result, features, objects = self.extract([node(1),relation(10,[("node",1,"")],type="site"),relation(20,[("relation",10,"")],type="site",amenity="police")])
        self.assertEqual(result["status"],"complete")
        self.assertEqual(len(features),1)
        self.assertEqual(len(objects),3)

    def test_relation_cycle_and_depth_limit(self):
        result, _, _ = self.extract([relation(10,[("relation",10,"")],type="site",amenity="police")])
        self.assertEqual(result["status"],"partial")

    def test_depth_exhaustion(self):
        result, _, _ = self.extract([node(1),relation(10,[("node",1,"")],type="site"),relation(20,[("relation",10,"")],type="site",amenity="police")],max_depth=1)
        self.assertEqual(result["status"],"partial")

    def test_identical_duplicates_deduplicated(self):
        result, features, _ = self.extract([node(1,shop="bakery"),node(1,shop="bakery")],pbf=False)
        self.assertEqual(result["status"],"complete")
        self.assertEqual(len(features),1)
        self.assertEqual(result["quality"]["duplicate_records"]["identical_duplicates"],1)

    def test_conflicting_duplicates_never_complete(self):
        result, _, _ = self.extract([node(1,shop="bakery"),node(1,shop="florist")],pbf=False)
        self.assertEqual(result["status"],"partial")

    def test_degenerate_way_partial(self):
        result, _, _ = self.extract([node(1),way(10,[1,1],highway="footway")])
        self.assertEqual(result["status"],"partial")

    def test_invalid_coordinate_not_invented(self):
        result, features, _ = self.extract([node(1,200,100,shop="bakery")],pbf=False)
        self.assertEqual(result["status"],"partial")
        self.assertEqual(features,[])

    def test_interrupted_stage_resume_and_completed_idempotence(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        with self.assertRaises(InterruptedError): pipeline.run(source,output,stop_after="index")
        result = pipeline.run(source,output,resume=True)
        repeated = pipeline.run(source,output,resume=True)
        self.assertEqual(result,repeated)
        self.assertEqual(len(result["attempts"]),1)

    def test_interrupted_index_rebuild(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        real = pipeline.Indexer.add
        def interrupt(handler,o,kind):
            real(handler,o,kind)
            handler.db.commit()
            raise InterruptedError("Synthetic interruption inside index")
        with patch.object(pipeline.Indexer,"add",interrupt):
            with self.assertRaises(InterruptedError): pipeline.run(source,output)
        result = pipeline.run(source,output,resume=True)
        self.assertEqual(result["quality"]["unique_features"],1)
        self.assertEqual(result["quality"]["duplicate_records"],{})

    def test_interrupted_selection_rebuild(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        real = pipeline.select
        def interrupt(*args):
            real(*args)
            raise InterruptedError("Synthetic selection interruption")
        with patch.object(pipeline,"select",interrupt):
            with self.assertRaises(InterruptedError): pipeline.run(source,output)
        result = pipeline.run(source,output,resume=True)
        self.assertEqual(result["quality"]["unique_features"],1)

    def test_missing_checkpoint_index_rejected(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        with self.assertRaises(InterruptedError): pipeline.run(source,output,stop_after="index")
        (output/"index.sqlite").rename(output/"index.saved.sqlite")
        with self.assertRaisesRegex(ValueError,"Missing completed"): pipeline.run(source,output,resume=True)

    def test_lock_and_existing_folder_preserved(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        output.mkdir()
        evidence = output/"prior.txt"
        evidence.write_text("keep")
        with self.assertRaisesRegex(ValueError,"contains files"): pipeline.run(source,output)
        self.assertEqual(evidence.read_text(),"keep")

    def test_empty_source_rejected(self):
        source = self.source([],pbf=False)
        with self.assertRaisesRegex(ValueError,"Empty OSM"): pipeline.run(source,self.root/"run")

    def test_interrupted_export_preserves_attempt_and_resumes(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        def interrupt(db,source,folder):
            (folder/"interrupted.txt").write_text("retained")
            raise InterruptedError("Synthetic export interruption")
        with patch.object(pipeline,"export",interrupt):
            with self.assertRaises(InterruptedError): pipeline.run(source,output)
        result = pipeline.run(source,output,resume=True)
        self.assertEqual(len(result["attempts"]),2)
        self.assertTrue((output/result["attempts"][0]/"interrupted.txt").exists())

    def test_changed_source_and_wrong_checksum_rejected(self):
        source = self.source([node(1,shop="bakery")],pbf=False)
        with self.assertRaisesRegex(ValueError,"checksum"): pipeline.run(source,self.root/"bad",expected_sha256="0"*64)
        with self.assertRaises(InterruptedError): pipeline.run(source,self.root/"run",stop_after="index")
        source.write_text(source.read_text()+"\n")
        with self.assertRaisesRegex(ValueError,"changed"): pipeline.run(source,self.root/"run",resume=True)

    def test_truncated_pbf_failed_manifest(self):
        source = self.source([node(1,shop="bakery")])
        raw = source.read_bytes()
        source.write_bytes(raw[:len(raw)//2])
        with self.assertRaises(Exception): pipeline.run(source,self.root/"run")
        manifest = json.loads((self.root/"run/manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["status"],"failed")

    def test_changed_completed_artifact_rejected(self):
        source = self.source([node(1,shop="bakery")])
        output = self.root/"run"
        result = pipeline.run(source,output)
        (output/result["output_folder"]/"features.geojson").write_text("bad")
        with self.assertRaisesRegex(ValueError,"Artifact changed"): pipeline.run(source,output,resume=True)


if __name__ == "__main__": unittest.main(verbosity=2)
