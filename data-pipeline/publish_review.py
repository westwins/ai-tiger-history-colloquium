"""Publish the aggregate-only review appendix on the existing Oracle web service."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from urllib.request import urlopen

HERE=Path(__file__).resolve().parent
APP=Path('/home/ubuntu/trc')
source=HERE/'output/coverage-review.html'
body=source.read_bytes()
if not all(token in body for token in (b'3216',b'2398',b'TRC',b'jeju43-sites')):
    raise RuntimeError('Unexpected review artifact')
dest=APP/'frontend/coverage-review.html'
if dest.exists() and dest.read_bytes()!=body:
    old_hash=hashlib.sha256(dest.read_bytes()).hexdigest()[:12]
    shutil.copy2(dest,HERE/('coverage-review-before-'+old_hash+'.html'))
shutil.copyfile(source,dest)
dest.chmod(0o644)
dockerfile=APP/'frontend/Dockerfile'
text=dockerfile.read_text()
line='COPY coverage-review.html /usr/share/nginx/html/coverage-review.html'
if line not in text:
    backup=HERE/'frontend-Dockerfile-before-review'
    if not backup.exists():
        shutil.copy2(dockerfile,backup)
    text=text.replace('EXPOSE 80',line+'\nEXPOSE 80')
    if line not in text:
        raise RuntimeError('Unrecognized Dockerfile; review before changing')
    dockerfile.write_text(text)
subprocess.run(['docker','cp',str(dest),'trc-web:/usr/share/nginx/html/coverage-review.html'],check=True)
with urlopen('http://127.0.0.1:8090/coverage-review.html',timeout=10) as response:
    deployed=response.read()
if hashlib.sha256(deployed).digest()!=hashlib.sha256(body).digest():
    raise RuntimeError('Served artifact does not match reviewed source')
with urlopen('http://127.0.0.1:8090/api/health',timeout=10) as response:
    health=json.load(response)
if health.get('status')!='ok':
    raise RuntimeError('Application health check failed')
result={'url':'https://trc.soohwalee.com/coverage-review.html','sha256':hashlib.sha256(body).hexdigest(),'health':health['status'],'production_data_replaced':False}
(HERE/'output/review-publication.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
