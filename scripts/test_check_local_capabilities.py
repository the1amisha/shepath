import argparse
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import check_local_capabilities as check


class CapabilityTests(unittest.TestCase):
    def test_rejects_external_or_credential_urls(self):
        for url in ["https://example.com:443", "http://127.0.0.1:8011@evil.test:80", "http://localhost:8011/?key=x", "file:///tmp"]:
            with self.assertRaises(argparse.ArgumentTypeError):
                check.local_url(url)

    def test_credential_precedence_and_no_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("HEIGIT_API_KEY='synthetic-private-value'\n")
            env = {"HEIGIT_API_KEY": ""}
            self.assertFalse(check.credential_present(env, path))
            self.assertEqual(env, {"HEIGIT_API_KEY": ""})
            self.assertTrue(check.credential_present({}, path))
            with patch.object(check, "ROOT", Path(directory)), patch.object(check, "credential_present", return_value=True), patch.object(check, "read_json") as http:
                ok, message = check.probe("routing", "http://127.0.0.1:8011")
                self.assertTrue(ok)
                self.assertIn("NOT LIVE-VERIFIED", message)
                self.assertNotIn("synthetic-private-value", message)
                http.assert_not_called()

    def test_only_get_capabilities_and_contract_failure(self):
        with patch.object(check, "read_json", return_value={"status": "ok", "service": "wrong"}) as http:
            self.assertFalse(check.probe("health", "base")[0])
            http.assert_called_once_with("base", "/health")
        with patch.object(check, "read_json", return_value={"status": "available", "comparison": {"routes": [1, 2, 3]}}) as http:
            self.assertTrue(check.probe("saved", "base")[0])
            http.assert_called_once_with("base", "/pilot/ranchi/comparison")

    def test_native_import_failure_is_safe(self):
        with patch.object(check.importlib, "import_module", side_effect=ImportError("sensitive-path")):
            ok, message = check.probe("dependencies", "base")
            self.assertFalse(ok)
            self.assertNotIn("sensitive-path", message)

    def test_deadline_and_output_redaction(self):
        with patch.object(check.subprocess, "run", side_effect=subprocess.TimeoutExpired("probe", 12)):
            self.assertIn("deadline", check.run_check("health", "base")[1])
        with patch.object(check.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "secret", "secret")):
            ok, message = check.run_check("health", "base")
            self.assertFalse(ok)
            self.assertNotIn("secret", message)


if __name__ == "__main__":
    unittest.main()
