"""Offline profile selection and fail-closed manifest checks."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import dynamic_route_evidence as dynamic

class DatasetSelectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for context in (patch.object(dynamic, 'ROOT', self.root),
                        patch.dict(os.environ, {}, clear=True),
                        patch('socket.socket.connect', side_effect=AssertionError('No network'))):
            context.start()
            self.addCleanup(context.stop)

    def test_default_selects_original(self):
        with patch.object(dynamic.verify.extract, 'sha', return_value='bad') as sha:
            with self.assertRaisesRegex(ValueError, 'manifest'):
                dynamic.PilotDataset.load()
        sha.assert_called_once_with(dynamic.verify.RUN / 'manifest.json')

    def test_explicit_original_overrides_environment(self):
        with patch.dict(os.environ, SHEPATH_EVIDENCE_DATASET='hatia-mahilong'):
            self.test_default_selects_original_explicit()

    def test_default_selects_original_explicit(self):
        with patch.object(dynamic.verify.extract, 'sha', return_value='bad') as sha:
            with self.assertRaisesRegex(ValueError, 'manifest'):
                dynamic.PilotDataset.load('original')
        sha.assert_called_once_with(dynamic.verify.RUN / 'manifest.json')

    def test_missing_expanded_never_falls_back(self):
        original = (dynamic.verify.RUN, dynamic.verify.extract.BOUNDARY)
        with patch.dict(os.environ, SHEPATH_EVIDENCE_DATASET='hatia-mahilong'):
            with self.assertRaises(FileNotFoundError) as caught:
                dynamic.PilotDataset.load()
        self.assertIn('eastern_261008_hatia_mahilong_v1', str(caught.exception))
        self.assertEqual(original, (dynamic.verify.RUN, dynamic.verify.extract.BOUNDARY))

    def test_expanded_rejects_wrong_manifest(self):
        run = self.root / 'offline_runs/eastern_261008_hatia_mahilong_v1'
        run.mkdir(parents=True)
        (run / 'manifest.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'manifest'):
            dynamic.PilotDataset.load('hatia-mahilong')

    def test_unknown_profile_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown SHEPATH_EVIDENCE_DATASET'):
            dynamic.PilotDataset.load('typo')

    def test_verified_manifest_still_requires_successful_stages(self):
        manifest = {'status': 'complete', 'quality': {'unresolved_issues': 0},
                    'stages': {'index': 'successful', 'selection': 'successful', 'export': 'pending'}}
        with patch.object(dynamic.verify.extract, 'sha', return_value=dynamic.MANIFEST_SHA256), \
                patch.object(dynamic.verify, 'load', return_value=manifest), \
                patch.object(dynamic.verify, 'checked_artifacts') as artifacts:
            with self.assertRaisesRegex(ValueError, 'Incomplete extraction stages'):
                dynamic.PilotDataset.load('original')
            artifacts.assert_not_called()
