"""Project-local Graphify: code-only builds, bounded queries and local HTML assets."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
RUNNER = '''
import runpy, sys
def offline(event, args):
    if event in ('socket.connect', 'socket.connect_ex', 'socket.bind', 'socket.getaddrinfo'):
        raise RuntimeError('Project Graphify runs without Python socket networking')
sys.addaudithook(offline)
sys.argv = ['graphify', *sys.argv[1:]]
runpy.run_module('graphify', run_name='__main__')
'''


def main():
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print('Usage: python3 scripts/graphify.py build|update|version|query|path|explain|diagnose|tree [arguments]')
        return
    python = ROOT / '.tools/graphify' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        raise SystemExit('Run python3 scripts/setup-graphify.py first.')
    # Do not pick up provider keys or user-selected backend/model settings.
    env = {key: value for key, value in os.environ.items() if not key.endswith('_API_KEY') and not key.startswith(('GRAPHIFY_', 'GOOGLE_', 'AWS_', 'AZURE_'))}

    def run(command):
        subprocess.run([str(python), '-c', RUNNER, *command], cwd=ROOT, env=env, check=True)

    if args[0] in ('build', 'update'):
        if len(args) != 1:
            raise SystemExit('build/update take no arguments; the repository and local-only profile are fixed.')
        out = ROOT / 'graphify-out'
        out.mkdir(exist_ok=True)
        # Let the skill's interpreter guard find the pinned environment too.
        (out / '.graphify_python').write_text(str(python))
        run(['extract', '.', '--code-only', '--no-dedup', *(['--force'] if args[0] == 'build' else [])])
        graph = json.loads((out / 'graph.json').read_text())
        large = len(graph['nodes']) > 5000
        if large:
            print('Graph exceeds 5,000 nodes; skipping HTML. JSON and report remain available.', flush=True)
        run(['cluster-only', '.', '--no-label', *(['--no-viz'] if large else [])])
        if not large:
            html = out / 'graph.html'
            text = html.read_text()
            remote = 'https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js'
            if remote not in text:
                raise SystemExit('Graphify HTML dependency changed; review before using the visualization.')
            assets = out / 'assets'
            assets.mkdir(exist_ok=True)
            for name in ('vis-network.min.js', 'LICENSE-MIT', 'LICENSE-APACHE-2.0'):
                shutil.copyfile(ROOT / '.tools/graphify-assets' / name, assets / name)
            html.write_text(text.replace(remote, 'assets/vis-network.min.js'))
        print('Local graph refreshed; docs remain authoritative and are not semantically indexed.', flush=True)
    elif args[0] == 'version':
        run(['--version'])
    elif args[0] in ('query', 'path', 'explain', 'diagnose', 'tree'):
        run([*args, *(['--budget', '1500'] if args[0] == 'query' and '--budget' not in args else [])])
    else:
        raise SystemExit('Unsupported project command. See docs/graphify.md for the local-only profile.')


if __name__ == '__main__':
    main()
