"""Promote reviewed source observations and deploy web/API only, with rollback images."""
import hashlib,json
from pathlib import Path
import shutil,subprocess,tarfile,time
from urllib.request import urlopen

ROOT=Path('/home/ubuntu/trc')
STAGE=Path('/home/ubuntu/trc-map-v21')
BACKUP=Path('/home/ubuntu/trc-backups/map-v21-20261106')
EXPECTED={'backend/research_api.py':'fdbd14d64ce2b68d65a8836f437a426750adf3ac349c6c5b72e73cc5efc36665','frontend/workbench.js':'8133689a5b83e1c695eb81efdf7ad90707dbbd86b693e9b4aefc15a2b4502925'}
for name,digest in EXPECTED.items():
 if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise RuntimeError('Operating source changed; inspect before deployment: '+name)
if BACKUP.exists():raise RuntimeError('Release backup already exists; inspect previous attempt')
BACKUP.mkdir(parents=True)
client=['docker','exec','-i','trc-mariadb','sh','-c','MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec mariadb --user=root --default-character-set=utf8mb4 --batch --skip-column-names trc_archive']
def sql(text):return subprocess.check_output(client,input=text.encode()).decode().strip()
before=int(sql('SELECT COUNT(*) FROM trc_incidents;'))
db_created=json.loads(subprocess.check_output(['docker','inspect','trc-mariadb']))[0]['Created']
dump=['docker','exec','trc-mariadb','sh','-c','MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec mariadb-dump --user=root --single-transaction trc_archive']
with (BACKUP/'trc_archive.sql').open('wb') as stream:subprocess.run(dump,stdout=stream,check=True)
files=[p for directory in ('frontend','backend') for p in (STAGE/directory).rglob('*') if p.is_file()]
with tarfile.open(BACKUP/'source.tar.gz','w:gz') as archive:
 for file in files:
  rel=file.relative_to(STAGE)
  if (ROOT/rel).is_file():archive.add(ROOT/rel,arcname=rel.as_posix())
images=[]
for container in ('trc-api','trc-web'):
 info=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
 backup=container+':before-map-v21-20261106'
 subprocess.run(['docker','tag',info['Image'],backup],check=True)
 images.append({'container':container,'image':info['Config']['Image'],'backup':backup})
(BACKUP/'images.json').write_text(json.dumps(images,indent=2))
for name in ('chile-import.mariadb.sql','mmdh-import.mariadb.sql','jeju-sites-import.mariadb.sql','jeju-history-import.mariadb.sql'):
 sql((STAGE/'sql'/name).read_text(encoding='utf8'))
counts=sql('SELECT s.source_id,COUNT(*) FROM hist_record r JOIN hist_snapshot s USING(snapshot_id) GROUP BY s.source_id ORDER BY s.source_id;')
expected={'chile-mmdh-victims':3216,'chile-pinochet-2019':2398,'jeju43-history':47,'jeju43-sites':25}
if dict((line.split('\t')[0],int(line.split('\t')[1])) for line in counts.splitlines())!=expected:raise RuntimeError('Promoted source counts differ')
if int(sql('SELECT COUNT(*) FROM trc_incidents;'))!=before:raise RuntimeError('Legacy incident count changed')
for source in files:
 dest=ROOT/source.relative_to(STAGE);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest);dest.chmod(0o644)
for directory in ('frontend','backend'):
 for path in (ROOT/directory).rglob('*'):
  if path.is_dir():path.chmod(0o755)
try:
 subprocess.run(['docker','compose','build','trc-backend','trc-frontend'],cwd=ROOT,check=True)
 subprocess.run(['docker','compose','up','-d','--no-deps','trc-backend','trc-frontend'],cwd=ROOT,check=True)
 healthy=False
 for _ in range(40):
  try:
   with urlopen('http://127.0.0.1:8090/api/health',timeout=3) as response:health=json.load(response)
   if health.get('version')=='2.1.0':healthy=True;break
  except Exception:pass
  time.sleep(.5)
 if not healthy:raise RuntimeError('Health check failed')
 api_counts={}
 for source,count in expected.items():
  country='CHL' if source.startswith('chile') else 'KOR'
  with urlopen(f'http://127.0.0.1:8090/api/research/incidents?country={country}&source={source}',timeout=20) as response:data=json.load(response)
  if data['count']!=count or data['truncated']:raise RuntimeError('API source coverage differs: '+source)
  api_counts[source]={'count':count,'coverage':data['coverage']}
 if json.loads(subprocess.check_output(['docker','inspect','trc-mariadb']))[0]['Created']!=db_created:raise RuntimeError('Database container was recreated')
 result={'version':'2.1.0','url':'https://trc.soohwalee.com/#step-4','sources':api_counts,'legacy_incidents_preserved':before,'database_recreated':False,'backup':str(BACKUP)}
 (BACKUP/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True)
except Exception:
 for item in images:subprocess.run(['docker','tag',item['backup'],item['image']],check=True)
 with tarfile.open(BACKUP/'source.tar.gz') as archive:archive.extractall(ROOT,filter='data')
 subprocess.run(['docker','compose','up','-d','--no-deps','trc-backend','trc-frontend'],cwd=ROOT,check=True)
 raise
