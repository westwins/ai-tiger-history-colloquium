"""Deploy the reviewed v3.1.1 files, preserving compose configuration and the DB.

Run on the Oracle host from an extracted staging directory, never from ROOT.
Supports --check-only. Refuses to overwrite source changed since review.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from urllib.request import urlopen

ROOT = Path('/home/ubuntu/trc').resolve()
STAGE = Path(__file__).resolve().parents[1]
BEFORE = {
    'frontend/workbench.js': '2fbc7d4d325d0e806059f110427f0edad18b5302d48fca8c8a7eb5d5c6bf5a88',
    'frontend/simulation.mjs': '591f3db6f4596c86eceabae1eecc025846570e142429f81a6e165158a7ed2422',
    'frontend/archive-map.mjs': '8cb50eae59f4906477acb5f21d378c62e87cbc9aa04dbc94c78b8ec3671dcea6',
    'frontend/index.html': 'cd5cae845b6b31a34f214e3c789bc4e2503e413a913db7b438ed786558ae73b4',
    'frontend/Dockerfile': '0be20cc0ed9acc41207dbbea73ac3850ac6f63b4f4ea1a8ecb68016a53632d6b',
    'frontend/data/jeju43_comprehensive.json': 'e588d93059f015733a77c5003eaac560380ce9d61a49289e2f9b7df97c0b7d89',
    'backend/jeju43_comprehensive.json': '8f6f3d465ad89b6a4637e375e28dd618f24b2cfae09e5ac0cf4d07608cd0d5aa',
    'backend/research_api.py': '3764a567e3dfbbe7a76d542c6af3d235a1ef5b3f871d38adba3892f3b128ec67',
    'frontend/lecture-config.mjs': None,
}
SERVICES = ['trc-backend', 'trc-frontend']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def command(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def inspect(container, field):
    return subprocess.check_output(['docker', 'inspect', '--format', '{{'+field+'}}', container], text=True).strip()


def compose_ids():
    ids = subprocess.check_output(['docker', 'compose', 'ps', '-q'], cwd=ROOT, text=True).split()
    return {inspect(c, '.Name'): c for c in ids if inspect(c, '.Name') not in ('/trc-api', '/trc-web')}


def read_url(path):
    with urlopen('http://127.0.0.1:8090'+path, timeout=5) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    if ROOT == STAGE or not (ROOT/'docker-compose.yml').is_file():
        raise RuntimeError('Expected a separate staging directory and existing compose installation')
    for relative, expected in BEFORE.items():
        destination = (ROOT/relative).resolve()
        if not destination.is_relative_to(ROOT) or not (STAGE/relative).is_file():
            raise RuntimeError(f'Invalid/missing staged file: {relative}')
        if digest(destination) != expected:
            raise RuntimeError(f'Source changed since review: {relative}; inspect before deploying')
        writable = destination if destination.exists() else destination.parent
        if not os.access(writable, os.W_OK):
            raise RuntimeError(f'Cannot write {relative}; run with the installation owner or sudo before changing any files')
    expected_hashes = {rel: digest(STAGE/rel) for rel in BEFORE}
    if args.check_only:
        print(json.dumps({'preflight':'passed','files':len(BEFORE)}))
        return
    unchanged = compose_ids()
    db_before = inspect('trc-mariadb', '.Id')
    stamp = time.strftime('%Y%m%d-%H%M%S')
    backup = Path('/home/ubuntu/trc-backups')/f'colloquium-v311-{stamp}'
    backup.mkdir(parents=True, exist_ok=False)
    snapshots = []
    for container in ('trc-api', 'trc-web'):
        original = inspect(container, '.Config.Image')
        tag = f'{container}:before-v311-{stamp}'
        command('docker', 'tag', inspect(container, '.Image'), tag)
        snapshots.append({'container':container,'image':original,'backup':tag})
    for relative, expected in BEFORE.items():
        if expected is not None:
            saved = backup/'source'/relative
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT/relative, saved)
    (backup/'images.json').write_text(json.dumps(snapshots, indent=2), encoding='utf-8')
    (backup/'before-hashes.json').write_text(json.dumps(BEFORE, indent=2), encoding='utf-8')
    try:
        for relative in BEFORE:
            shutil.copy2(STAGE/relative, ROOT/relative)
            (ROOT/relative).chmod(0o644)
        command('docker', 'compose', 'build', *SERVICES)
        command('docker', 'compose', 'up', '-d', '--no-deps', *SERVICES)
        health = {}
        for _ in range(40):
            try:
                health = json.loads(read_url('/api/health'))
                if health.get('status') == 'ok' and health.get('version') == '3.1.1':
                    break
            except Exception:
                pass
            time.sleep(0.5)
        else:
            raise RuntimeError('API health/version verification timed out')
        data = json.loads(read_url('/api/research/incidents?country=KOR&source=jeju43-comprehensive'))
        if data['count'] != 109 or data['official_summary']['eup_myeon_reconciliation']['difference'] != 87:
            raise RuntimeError('Jeju interpretation metadata verification failed')
        if '20261117.311' not in read_url('/').decode('utf-8'):
            raise RuntimeError('Wrong frontend cache revision')
        for relative, expected in expected_hashes.items():
            if digest(ROOT/relative) != expected:
                raise RuntimeError(f'Installed source hash mismatch: {relative}')
            if relative.startswith('frontend/') and not relative.endswith('Dockerfile'):
                if hashlib.sha256(read_url('/'+relative.removeprefix('frontend/'))).hexdigest() != expected:
                    raise RuntimeError(f'Served file hash mismatch: {relative}')
        if inspect('trc-mariadb', '.Id') != db_before or compose_ids() != unchanged:
            raise RuntimeError('An unrelated container changed during deployment')
        revision = (STAGE/'revision.txt').read_text().strip() if (STAGE/'revision.txt').exists() else 'not supplied'
        result = {'deployed':True,'version':'3.1.1','revision':revision,'files':expected_hashes,
                  'database_recreated':False,'other_containers_unchanged':True,'backup_dir':str(backup)}
        (backup/'verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2), flush=True)
    except Exception:
        print('Deployment verification failed; restoring source and images.', flush=True)
        for relative, expected in BEFORE.items():
            if expected is None:
                (ROOT/relative).unlink(missing_ok=True)
            else:
                shutil.copy2(backup/'source'/relative, ROOT/relative)
        for item in snapshots:
            command('docker', 'tag', item['backup'], item['image'])
        command('docker', 'compose', 'up', '-d', '--no-deps', *SERVICES)
        raise


if __name__ == '__main__':
    main()
