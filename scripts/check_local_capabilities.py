"""Bounded, read-only Windows demo preflight. Never calls a routing provider.

Run using the interpreter/environment intended for Uvicorn. Child probes have
hard deadlines; imports, HTTP responses and private values are never echoed.
"""
import argparse
import importlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PROBES = ("health", "saved", "dependencies", "routing")
LIMIT = 2 * 1024 * 1024


def local_url(value):
    try:
        url = urlsplit(value)
        if (url.scheme != "http" or url.hostname not in ("127.0.0.1", "localhost", "::1")
                or url.username or url.password or url.query or url.fragment
                or url.path not in ("", "/") or not url.port):
            raise ValueError()
    except ValueError:
        raise argparse.ArgumentTypeError("Use an HTTP loopback URL with an explicit port, e.g. http://127.0.0.1:8011") from None
    return value.rstrip("/")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_json(base, path):
    # Do not send local checks through an inherited external HTTP proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(base + path, timeout=4) as response:
        body = response.read(LIMIT + 1)
        if len(body) > LIMIT:
            raise ValueError("Response exceeds local check bound")
        return json.loads(body)


def credential_present(environ, path):
    # Mirror the backend's precedence without loading variables into os.environ.
    if "HEIGIT_API_KEY" in environ:
        return bool(environ["HEIGIT_API_KEY"].strip())
    if path.exists():
        if path.stat().st_size > 65536:
            raise ValueError("Environment file exceeds check bound")
        for line in path.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if separator and key.strip() == "HEIGIT_API_KEY":
                return bool(value.strip().strip("\"'"))
    return False


def probe(name, base):
    if name == "health":
        data = read_json(base, "/health")
        ok = data.get("status") == "ok" and data.get("service") == "shepath-backend"
        return ok, "PASS" if ok else "FAIL: unexpected health contract"
    if name == "saved":
        data = read_json(base, "/pilot/ranchi/comparison")
        ok = data.get("status") == "available" and len(data.get("comparison", {}).get("routes", [])) == 3
        return ok, "PASS: three saved routes available" if ok else "FAIL: saved comparison unavailable or unexpected contract"
    if name == "dependencies":
        for module, version in (("shapely", "2.1.2"), ("pyproj", "3.7.2"), ("osmium", "4.3.1")):
            try:
                importlib.import_module(module)
                if importlib.metadata.version(module) != version:
                    return False, "FAIL: geographic package version differs from backend/requirements.txt"
            except Exception:
                return False, "FAIL: geographic imports unavailable; use a self-contained backend environment (see Windows guide)"
        return True, "PASS: pinned geographic imports in checker interpreter; dataset/server readiness NOT tested"
    present = credential_present(os.environ, ROOT / "backend/.env")
    return present, ("CONFIGURED, NOT LIVE-VERIFIED: credential present; no provider request made" if present else
                     "FAIL: credential absent/empty; no provider request made")


def run_check(name, base):
    try:
        result = subprocess.run([sys.executable, "-B", str(Path(__file__).resolve()),
                                 "--probe", name, "--base-url", base],
                                capture_output=True, text=True, timeout=12, cwd=ROOT)
        data = json.loads(result.stdout)
        if result.returncode != 0 or not isinstance(data, dict) or not isinstance(data.get("ok"), bool):
            raise ValueError()
        return data["ok"], data["message"]
    except subprocess.TimeoutExpired:
        return False, "FAIL: probe exceeded 12-second deadline"
    except Exception:
        return False, "FAIL: probe failed; inspect the Windows startup guide (raw output suppressed)"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", type=local_url, default="http://127.0.0.1:8011")
    parser.add_argument("--probe", choices=PROBES, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.probe:
        try:
            ok, message = probe(args.probe, args.base_url)
        except Exception:
            ok, message = False, "FAIL: connection, contract or local configuration check failed (details suppressed)"
        print(json.dumps({"ok": ok, "message": message}))
        return 0
    print("Local preflight: <=48 seconds of probe deadlines plus process overhead. No routing/evidence POSTs.")
    results = []
    for name in PROBES:
        ok, message = run_check(name, args.base_url)
        results.append(ok)
        print(f"{name}: {message}")
    print("Exit 0 means these prerequisite checks passed, NOT live-provider, dataset or browser acceptance.")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
