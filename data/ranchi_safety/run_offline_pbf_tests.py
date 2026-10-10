"""Run local offline regression tests and retain a clearly synthetic PBF demo."""
from datetime import datetime, timezone
import importlib.metadata
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest

import offline_pbf_extract as pipeline


def main():
    run = pipeline.ROOT / "offline_validation_runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    run.mkdir(parents=True)
    temp = run / "test_temp"
    temp.mkdir()
    tempfile.tempdir = str(temp)
    start = time.perf_counter()
    with (run / "tests.log").open("w", encoding="utf-8") as log:
        suite = unittest.defaultTestLoader.discover(str(pipeline.ROOT), pattern="test_*.py")
        result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    summary = dict(tests=result.testsRun, failures=len(result.failures), errors=len(result.errors),
                   skipped=len(result.skipped), successful=result.wasSuccessful(), seconds=time.perf_counter()-start,
                   python=sys.version, versions={p: importlib.metadata.version(p) for p in ("osmium","shapely","pyproj")},
                   script_sha256=pipeline.sha(Path(pipeline.__file__)),
                   regional_pbf_downloaded=False)
    if result.wasSuccessful():
        # Fixture uses real bbox coordinates but every OSM ID and feature below is invented test data.
        from test_offline_pbf_extract import node, way, W, E, Y, META
        source = run / "SYNTHETIC_ONLY.osm"
        source.write_text('<osm version="0.6" generator="SHEPATH SYNTHETIC TEST ONLY">' +
                          node(1,W-.001,Y) + node(2,E+.001,Y) + node(3,shop="bakery",name="Synthetic Bakery") +
                          way(10,[1,2],highway="footway",lit="no",sidewalk="both") + '</osm>', encoding="utf-8")
        extraction = pipeline.run(source, run / "synthetic_extraction")
        summary["synthetic_demo"] = dict(status=extraction["status"], quality=extraction["quality"])
    pipeline.write_json(run/"summary.json",summary)
    print(json.dumps(summary,indent=2))
    print("Evidence:",run)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__": raise SystemExit(main())
