"""Portable manifest lookup tests; PurePosixPath checks are not Linux execution."""
from copy import deepcopy
from pathlib import Path, PurePosixPath, PureWindowsPath
import tempfile
import unittest
from unittest.mock import patch

import verify_post_extraction as post


class ArtifactPathTests(unittest.TestCase):
    def test_separator_styles_preserve_bytes_hashes_and_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            artifact = root / 'attempt' / 'nested' / 'objects.jsonl'
            artifact.parent.mkdir(parents=True)
            raw = b'{"id":1}\r\n'
            artifact.write_bytes(raw)
            for name in ('attempt/nested/objects.jsonl',
                         r'attempt\nested\objects.jsonl',
                         r'attempt/nested\objects.jsonl'):
                with self.subTest(name=name):
                    manifest = {'artifacts': {name: post.extract.sha(artifact)}}
                    before = deepcopy(manifest)
                    self.assertEqual(post.checked_artifacts(root, manifest), [artifact])
                    self.assertEqual(manifest, before)
                    self.assertEqual(artifact.read_bytes(), raw)

    def test_pure_posix_and_windows_join_simulation(self):
        for name in ('attempt/Features.geojson', r'attempt\Features.geojson'):
            with self.subTest(name=name):
                parts = post.artifact_parts(name)
                self.assertEqual(parts, ('attempt', 'Features.geojson'))
                self.assertEqual(PurePosixPath('/pilot').joinpath(*parts),
                                 PurePosixPath('/pilot/attempt/Features.geojson'))
                self.assertEqual(PureWindowsPath('D:/pilot').joinpath(*parts),
                                 PureWindowsPath('D:/pilot/attempt/Features.geojson'))
        # Demonstrate the original POSIX failure without a POSIX filesystem.
        self.assertEqual(len(PurePosixPath(r'attempt\Features.geojson').parts), 1)

    def test_unsafe_paths_rejected_before_hash_read(self):
        names = ('../outside', r'..\outside', 'attempt/../../outside',
                 r'attempt\..\outside', '/absolute/file', r'\rooted\file',
                 'C:/absolute/file', r'C:\absolute\file', 'C:relative',
                 r'\\server\share\file', '//server/share/file',
                 r'\\?\C:\file', 'attempt/file:stream', '', '.', None,
                 'attempt/\0file')
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(post.extract, 'sha') as sha:
                for name in names:
                    with self.subTest(name=name), self.assertRaises(ValueError):
                        post.checked_artifacts(Path(directory), {'artifacts': {name: '0' * 64}})
                sha.assert_not_called()

    def test_resolved_escape_rejected_before_hash_read(self):
        # Simulate an external symlink/junction target even on restricted Windows.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / 'run'
            outside = root.parent / 'outside'
            with patch.object(Path, 'resolve', side_effect=[outside, root]), \
                    patch.object(post.extract, 'sha') as sha:
                with self.assertRaisesRegex(ValueError, 'escapes extraction run'):
                    post.checked_artifacts(root, {'artifacts': {'link/file': '0' * 64}})
                sha.assert_not_called()

    def test_real_symlink_escape_if_supported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / 'run'
            root.mkdir()
            outside = root.parent / 'outside'
            outside.write_bytes(b'outside')
            try:
                (root / 'link').symlink_to(outside)
            except OSError as exc:
                self.skipTest(f'Symlink creation unavailable: {exc.__class__.__name__}')
            with self.assertRaisesRegex(ValueError, 'escapes extraction run'):
                post.checked_artifacts(root, {'artifacts': {'link': post.extract.sha(outside)}})

    def test_missing_and_corrupt_artifacts_fail_for_both_styles(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'attempt').mkdir()
            for name in ('attempt/file', r'attempt\file'):
                with self.subTest(name=name):
                    artifact = root / 'attempt/file'
                    artifact.unlink(missing_ok=True)
                    manifest = {'artifacts': {name: '0' * 64}}
                    with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                        post.checked_artifacts(root, manifest)
                    artifact.write_bytes(b'corrupt')
                    with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                        post.checked_artifacts(root, manifest)

    def test_pinned_manifest_both_styles_and_exact_case(self):
        manifest = post.load(post.RUN / 'manifest.json')
        before = deepcopy(manifest)
        original_paths = post.checked_artifacts(post.RUN, manifest)
        portable = deepcopy(manifest)
        portable['artifacts'] = {name.replace('\\', '/'): sha
                                 for name, sha in manifest['artifacts'].items()}
        self.assertEqual(post.checked_artifacts(post.RUN, portable), original_paths)
        self.assertEqual(len(original_paths), 6)
        self.assertEqual(manifest, before)
        for name in manifest['artifacts']:
            parent = post.RUN
            for component in post.artifact_parts(name):
                # Windows lookup alone would mask a wrong-case component.
                self.assertIn(component, [entry.name for entry in parent.iterdir()])
                parent = parent / component


if __name__ == '__main__':
    unittest.main()
