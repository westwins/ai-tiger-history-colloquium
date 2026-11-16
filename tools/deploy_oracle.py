"""Deploy only TRC web/API, retaining DB and ingestor and preserving rollback images."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time
from urllib.request import urlopen

ROOT = Path('/home/ubuntu/trc').resolve()
STAGE = Path('/home/ubuntu/trc-review-v2').resolve()
EXPECTED = {
    'frontend/index.html': '7a9f320bd8e0ebe107a0dc5d5ff6869c1a0362d77ae382c8067431943b95f2ad',
    'backend/main.py': '61d3ba4617172ea4ac03f8a9c5e6e1776bae7ab8cb2833fe172a55194f2c6dba',
}


def run(args, **kwargs):
    return subprocess.run(args, check=True, cwd=ROOT, **kwargs)


for name, expected in EXPECTED.items():
    path = (ROOT/name).resolve()
    if ROOT not in path.parents or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Source changed since review; refusing to overwrite: ' + name)

snapshots = []
for container, backup in [('trc-api', 'trc-api:before-colloquium-20261106'), ('trc-web', 'trc-web:before-colloquium-20261106')]:
    inspect = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
    existing = subprocess.run(['docker','image','inspect',backup],capture_output=True)
    if existing.returncode:
        run(['docker','tag',inspect['Image'],backup])
    snapshots.append({'container':container,'image':inspect['Config']['Image'],'backup':backup})
(Path('/home/ubuntu/trc-backups')/'deployment-20261106.json').write_text(json.dumps(snapshots,indent=2))

for folder in ('frontend','backend'):
    for source in (STAGE/folder).iterdir():
        if source.name in ('__pycache__',):
            continue
        dest = ROOT/folder/source.name
        if source.is_dir():
            shutil.copytree(source,dest,dirs_exist_ok=True)
        else:
            shutil.copy2(source,dest)
    for path in (ROOT/folder).rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)
if (STAGE/'README.md').exists():
    shutil.copy2(STAGE/'README.md',ROOT/'README.md')

try:
    run(['docker','compose','build','trc-backend','trc-frontend'])
    run(['docker','compose','up','-d','--no-deps','trc-backend','trc-frontend'])
    verified = False
    for _ in range(35):
        try:
            with urlopen('http://127.0.0.1:8090/api/health',timeout=3) as response:
                result = json.load(response)
            if result.get('version') == '2.0.0' and result.get('status') == 'ok':
                verified = True
                break
        except Exception:
            time.sleep(.5)
    if not verified:
        raise RuntimeError('Health check failed')
    with urlopen('http://127.0.0.1:8090/api/research/incidents?country=CHL',timeout=15) as response:
        data=json.load(response)
    if data['count'] != 2109 or data['truncated']:
        raise RuntimeError('Unexpected record coverage')
    with urlopen('http://127.0.0.1:8090/',timeout=5) as response:
        html=response.read().decode('utf-8')
    if 'workbench.js?v=20261106.4' not in html:
        raise RuntimeError('Frontend version mismatch')
    print(json.dumps({'deployed':True,'url':'https://trc.soohwalee.com/','version':result['version'],'chile_records':data['count'],'database_recreated':False,'rollback_images':snapshots},ensure_ascii=False),flush=True)
except Exception:
    print('Deployment failed; restoring previous images.',flush=True)
    for item in snapshots:
        run(['docker','tag',item['backup'],item['image']])
    run(['docker','compose','up','-d','--no-deps','trc-backend','trc-frontend'])
    raise
