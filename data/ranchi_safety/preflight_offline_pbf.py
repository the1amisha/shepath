"""Read-only local preparation checks. Never launches extraction or uses network."""
import ctypes
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
PBF = ROOT / 'pbf_sources/eastern_261008/eastern-zone-261008.osm.pbf'
EXPECTED_SIZE = 247225365
EXPECTED_MD5 = '13f2313594d4ebca894a0447c1121854'


def git(*args):
    return subprocess.run(['git', *args], cwd=REPO, capture_output=True, check=True).stdout


def main():
    md5, sha256 = hashlib.md5(), hashlib.sha256()
    with PBF.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            md5.update(chunk)
            sha256.update(chunk)
    sidecar = PBF.with_suffix(PBF.suffix + '.md5')
    sidecar_md5 = sidecar.read_text(encoding='utf-8').split()[0].lower()
    class MemoryStatus(ctypes.Structure):
        _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [
            (name, ctypes.c_ulonglong) for name in ('total_physical','available_physical','total_pagefile',
                'available_pagefile','total_virtual','available_virtual','available_extended_virtual')]
    mem = MemoryStatus()
    mem.length = ctypes.sizeof(mem)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)):
        raise OSError('Cannot read Windows memory status')

    indexed = git('ls-files', '-z').decode().split('\0')
    indexed = [p for p in indexed if p]
    staged = [p for p in git('diff', '--cached', '--name-only', '-z').decode().split('\0') if p]
    env_paths = [p for p in indexed if Path(p).name == '.env' or Path(p).name.startswith('.env.')]
    # Read secret values locally only for exact comparisons; never log values or matching lines.
    known_values = []
    env = REPO / 'backend/.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                name, value = line.split('=',1)
                value = value.strip().strip('"\'')
                if re.search(r'KEY|TOKEN|SECRET|PASSWORD', name, re.I) and len(value) >= 8:
                    known_values.append(value.encode())
    matches = []
    literal = re.compile(rb'(?:api[_-]?key|secret|token|password)\s*[:=]\s*[\'"]([A-Za-z0-9_./+=-]{16,})[\'"]',re.I)
    for p in indexed:
        content = git('show', ':' + p)
        if any(v in content for v in known_values) or literal.search(content) or b'-----BEGIN PRIVATE KEY-----' in content:
            matches.append(p)
    ignore_paths = [str(PBF.relative_to(REPO)).replace('\\','/'), str(sidecar.relative_to(REPO)).replace('\\','/'),
        'backend/.env','data/ranchi_safety/.pbf_venv/pyvenv.cfg',
        'data/ranchi_safety/offline_runs/example/index.sqlite',
        'data/ranchi_safety/offline_runs/example/index.sqlite-journal',
        'data/ranchi_safety/offline_runs/example/file.part',
        'data/ranchi_safety/offline_runs/example/attempt/features.geojson',
        'data/ranchi_safety/offline_runs/example/attempt/objects.jsonl',
        'data/ranchi_safety/.env', 'data/ranchi_safety/offline_pbf_extract.py',
        'data/ranchi_safety/test_offline_pbf_extract.py', 'data/ranchi_safety/OFFLINE_PBF_README.md',
        'data/ranchi_safety/offline_runs/example/manifest.json',
        'data/ranchi_safety/offline_runs/example/attempt/REPORT.md']
    ignored = {}
    for p in ignore_paths:
        proc = subprocess.run(['git','check-ignore','-v','--',p],cwd=REPO,capture_output=True)
        if proc.returncode not in (0,1): raise RuntimeError('git check-ignore failed')
        ignored[p] = dict(ignored=proc.returncode==0, rule=proc.stdout.decode().strip())
    # Container framing validation seeks over payloads; not a real extraction smoke test.
    import offline_pbf_extract as extractor
    extractor.validate_pbf_framing(PBF)
    output = ROOT / 'offline_runs/eastern_261008_ranchi_v1'
    result = dict(checked_at_utc=datetime.now(timezone.utc).isoformat(),
        pbf=dict(path=str(PBF), bytes=PBF.stat().st_size, md5=md5.hexdigest(),sha256=sha256.hexdigest(),
                 supplied_publisher_md5=EXPECTED_MD5,local_sidecar_md5=sidecar_md5,
                 valid_size_and_md5=PBF.stat().st_size==EXPECTED_SIZE and md5.hexdigest()==EXPECTED_MD5==sidecar_md5,
                 container_framing_valid=True, full_semantic_parse_performed=False),
        resources=dict(disk_free_bytes=shutil.disk_usage(ROOT).free,total_ram_bytes=mem.total_physical,
                       available_ram_bytes=mem.available_physical),
        git=dict(indexed_files=len(indexed),staged_paths=staged,indexed_env_paths=env_paths,
                 possible_secret_match_paths=matches,ignore_checks=ignored,
                 scan_scope='Current Git index, including staged blobs; exact local backend secret matches plus limited literal patterns. No history scan; not a universal secret detector.'),
        full_output_path=str(output),full_output_exists=output.exists(),
        bounded_extractor_smoke_test_supported=False,
        smoke_test_note='No CLI record/time bound. max-members/depth only limit individual feature resolution; stop_after index still scans the whole regional file. Full extraction not launched.')
    folder = ROOT / 'preflight_runs' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S_%fZ')
    folder.mkdir(parents=True)
    (folder/'checks.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
    print('Evidence:',folder)
    return 0 if result['pbf']['valid_size_and_md5'] and not matches and not env_paths else 1


if __name__ == '__main__': raise SystemExit(main())
