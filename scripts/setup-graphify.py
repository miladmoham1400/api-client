"""Install pinned developer tooling locally. Network is needed only for setup."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent


def main():
    uv = shutil.which('uv')
    if not uv:
        raise SystemExit('Install uv first; see docs/graphify.md.')
    env = {**os.environ, 'UV_CACHE_DIR': str(ROOT / '.tools' / 'uv-cache')}
    target = ROOT / '.tools' / 'graphify'
    python = target / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        subprocess.run([uv, 'venv', str(target), '--python', '3.12', '--no-python-downloads'], cwd=ROOT, env=env, check=True)
    version = subprocess.check_output([str(python), '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], text=True).strip()
    if version != '3.12':
        raise SystemExit('This tooling lock uses Python 3.12. Recreate only .tools/graphify with Python 3.12.')
    subprocess.run([uv, 'pip', 'sync', str(ROOT / 'tools/graphify/requirements.lock'), '--python', str(python), '--require-hashes', '--only-binary', ':all:', '--default-index', 'https://pypi.org/simple'], cwd=ROOT, env=env, check=True)
    spec = json.loads((ROOT / 'tools/graphify/assets.json').read_text())
    with urllib.request.urlopen(spec['url'], timeout=60) as response:
        data = response.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise SystemExit('Visualization archive exceeds expected size.')
    digest = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if digest != spec['integrity']:
        raise SystemExit('Visualization integrity check failed.')
    assets = ROOT / '.tools' / 'graphify-assets'
    assets.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for source, destination in spec['files'].items():
            member = archive.extractfile(source)
            if member is None:
                raise SystemExit('Visualization asset missing.')
            (assets / destination).write_bytes(member.read())
    # The official package installs its skill and reference sidecars as one unit.
    # The generic project target is discovered by Codex, without global config/hooks.
    subprocess.run([str(python), '-m', 'graphify', 'install', '--project', '--platform', 'agents'], cwd=ROOT, check=True)
    print('Graphify ready. Run: python3 scripts/graphify.py build')


if __name__ == '__main__':
    main()
