"""Safe non-destructive deployment for TRC Colloquium v2.2.0 (2026-11-18).
Updates only trc-frontend and trc-backend while leaving trc-mariadb untouched."""
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
from urllib.request import urlopen

ROOT = Path('/home/ubuntu/trc').resolve()
STAGE = Path(__file__).resolve().parents[1]
STAMP = time.strftime('%Y%m%d-%H%M%S')
BACKUP = Path(f'/home/ubuntu/trc-backups/colloquium-v22-{STAMP}')
BACKUP.mkdir(parents=True, exist_ok=True)

# 1. Backup existing frontend & backend files and container images
with tarfile.open(BACKUP / 'source-before-v22.tar.gz', 'w:gz') as tar:
    for folder in ('frontend', 'backend'):
        if (ROOT / folder).exists():
            tar.add(ROOT / folder, arcname=folder)

snapshots = []
for container in ('trc-api', 'trc-web'):
    info = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
    tag = f'{container}:before-v22-{STAMP}'
    subprocess.run(['docker', 'tag', info['Image'], tag], check=True)
    snapshots.append({'container': container, 'image': info['Config']['Image'], 'backup': tag})
(BACKUP / 'images.json').write_text(json.dumps(snapshots, indent=2), encoding='utf-8')

# 2. Copy updated frontend & backend files
for folder in ('frontend', 'backend'):
    for src in (STAGE / folder).rglob('*'):
        if '__pycache__' in src.parts or src.is_dir():
            continue
        rel = src.relative_to(STAGE)
        dst = ROOT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        dst.chmod(0o644)

# 3. Rebuild & restart only backend + frontend (MariaDB untouched)
subprocess.run(['docker', 'compose', 'up', '-d', '--build', '--no-deps', 'trc-backend', 'trc-frontend'], cwd=ROOT, check=True)

for _ in range(35):
    try:
        with urlopen('http://127.0.0.1:8090/', timeout=3) as resp:
            html = resp.read().decode('utf-8')
        if '20261116.22' in html:
            print(json.dumps({'deployed': True, 'version': '2.2.0', 'backup': str(BACKUP), 'url': 'https://trc.soohwalee.com/'}, ensure_ascii=False))
            break
    except Exception:
        time.sleep(0.5)
else:
    raise RuntimeError('Frontend verification timed out; check docker logs trc-web')
