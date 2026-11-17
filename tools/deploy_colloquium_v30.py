"""Safe non-destructive deployment + auto-rollback for TRC Colloquium v3.0.0 (2026-11-18).
Updates only trc-backend and trc-frontend while leaving trc-mariadb 100% untouched."""
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
BACKUP = Path(f'/home/ubuntu/trc-backups/colloquium-v30-{STAMP}')
BACKUP.mkdir(parents=True, exist_ok=True)

if not (ROOT / 'docker-compose.yml').exists() and not (ROOT / 'compose.yaml').exists():
    raise RuntimeError(f'Cannot find docker compose file in {ROOT}')

db_created_before = json.loads(subprocess.check_output(['docker', 'inspect', 'trc-mariadb']))[0]['Created']

# 1. Backup existing frontend & backend source files + running container images
with tarfile.open(BACKUP / 'source-before-v30.tar.gz', 'w:gz') as tar:
    for folder in ('frontend', 'backend'):
        if (ROOT / folder).exists():
            tar.add(ROOT / folder, arcname=folder)

snapshots = []
for container in ('trc-api', 'trc-web'):
    info = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
    tag = f'{container}:before-v30-{STAMP}'
    subprocess.run(['docker', 'tag', info['Image'], tag], check=True)
    snapshots.append({'container': container, 'image': info['Config']['Image'], 'backup': tag})
(BACKUP / 'images.json').write_text(json.dumps(snapshots, indent=2), encoding='utf-8')

# 2. Overlay updated frontend & backend files with clean permissions
for folder in ('frontend', 'backend'):
    src_dir = STAGE / folder
    if not src_dir.exists():
        continue
    for src in src_dir.rglob('*'):
        if '__pycache__' in src.parts or src.is_dir():
            continue
        rel = src.relative_to(STAGE)
        dst = ROOT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        dst.chmod(0o644)
    for d in (ROOT / folder).rglob('*'):
        if d.is_dir():
            d.chmod(0o755)

# 3. Rebuild & restart ONLY backend + frontend (MariaDB untouched), then verify health & APIs
try:
    subprocess.run(['docker', 'compose', 'build', 'trc-backend', 'trc-frontend'], cwd=ROOT, check=True)
    subprocess.run(['docker', 'compose', 'up', '-d', '--no-deps', 'trc-backend', 'trc-frontend'], cwd=ROOT, check=True)

    health_ok = False
    for _ in range(40):
        try:
            with urlopen('http://127.0.0.1:8090/api/health', timeout=3) as resp:
                h = json.load(resp)
            if h.get('status') == 'ok' and h.get('version') == '3.0.0':
                health_ok = True
                break
        except Exception:
            pass
        time.sleep(0.5)
    if not health_ok:
        raise RuntimeError('Backend /api/health v3.0.0 verification timed out')

    with urlopen('http://127.0.0.1:8090/api/research/incidents?country=KOR', timeout=10) as resp:
        kor = json.load(resp)
    if kor.get('source_id') != 'jeju43-comprehensive' or kor.get('count', 0) < 100:
        raise RuntimeError('Jeju 4.3 comprehensive dataset check failed')

    with urlopen('http://127.0.0.1:8090/', timeout=5) as resp:
        html = resp.read().decode('utf-8')
    if '20261117.30' not in html:
        raise RuntimeError('Frontend cache version 20261117.30 not served')

    db_created_after = json.loads(subprocess.check_output(['docker', 'inspect', 'trc-mariadb']))[0]['Created']
    if db_created_after != db_created_before:
        raise RuntimeError('trc-mariadb container timestamp changed unexpectedly')

    summary = {
        'deployed': True,
        'version': '3.0.0',
        'jeju_comprehensive_records': kor['count'],
        'jeju_official_victims': kor.get('official_summary', {}).get('recognized_victims_2026'),
        'database_recreated': False,
        'backup_dir': str(BACKUP),
        'url': 'https://trc.soohwalee.com/'
    }
    (BACKUP / 'verification.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
except Exception as exc:
    print(f'ERROR during v3.0 deploy ({exc}); rolling back automatically...', flush=True)
    for item in snapshots:
        subprocess.run(['docker', 'tag', item['backup'], item['image']], check=False)
    with tarfile.open(BACKUP / 'source-before-v30.tar.gz', 'r:gz') as tar:
        tar.extractall(ROOT)
    subprocess.run(['docker', 'compose', 'up', '-d', '--no-deps', 'trc-backend', 'trc-frontend'], cwd=ROOT, check=False)
    raise
