"""Collect observed public Jeju catalog pages and reference geography for the live map."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlencode
from urllib.request import Request,urlopen
import pipeline as p

OUT=p.ROOT/'output'

def public_download(url,target):
    if target.exists():return target.read_bytes()
    req=Request(url,headers={'User-Agent':p.UA})
    with urlopen(req,timeout=45) as response:body=response.read(20_000_001)
    if len(body)>20_000_000:raise ValueError('Reference geography exceeds byte budget')
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
    p.dump(target.with_suffix(target.suffix+'.provenance.json'),{'url':url,'fetched_at':p.utcnow(),'sha256':hashlib.sha256(body).hexdigest()})
    return body

def jeju():
    page=p.saved_path(json.loads((OUT/'jeju43-archive-download.json').read_text(encoding='utf8'))['local_path'])
    # The latest alias may point elsewhere; require the actual observed history page in fetch history.
    log=[json.loads(x) for x in (p.ROOT/'raw/fetch-log.jsonl').read_text(encoding='utf8').splitlines()]
    item=next(x for x in reversed(log) if x.get('url')=='http://43archives.or.kr/events/history/history.do' and x.get('sha256'))
    html=p.saved_path(item['local_path']).read_text(encoding='utf8')
    regions=dict(re.findall(r'data-target="(CO-ADR-[^"]+)">([^<]+)</a>',html))
    if len(regions)!=13:raise ValueError('Region selector schema changed')
    fetcher=p.Fetcher();rows={};pages=[];coverage=[]
    for code,label in regions.items():
        found=[];total=None
        for page_no in range(1,21):
            cache=OUT/'jeju-pages'/f'{code}-{page_no}.json'
            if cache.exists():saved=json.loads(cache.read_text(encoding='utf8'));data=saved['data'];meta=saved['meta']
            else:
                body,meta=fetcher.get('http://43archives.or.kr/events/history/getHistoricalSites.do',{'past_address2':code,'orderKey':'HISTORY_NO','orderMethod':'DESC','orderByName':'최신순','viewRowCnt':'80','viewRowCountName':'80개씩 보기','currPage':page_no})
                data=json.loads(body);p.dump(cache,{'meta':meta,'data':data})
            values=data['result']['list'];total=int(data['result']['count']);pages.append(meta['sha256'])
            if not values and len(found)<total:raise ValueError('Empty page before declared count')
            for row in values:
                key=str(row['history_no']);found.append(key)
                keep={k:row.get(k) for k in ('history_no','history_site_name','history_site_type_name','current_address','past_address1_name','past_address2_name','past_address3_name','past_address2','reg_date','mod_date')}
                rows[key]=keep
            if len(found)>=total:break
        if len(set(found))!=total:raise ValueError('Pagination count mismatch '+code)
        coverage.append({'code':code,'label':label,'count':total})
        print(label,total,flush=True)
    digest=hashlib.sha256(json.dumps(sorted(pages)).encode()).hexdigest();records=[];places=[]
    for key,raw in rows.items():
        records.append({'record_key':key,'source_id':'jeju43-history','country_code':'KOR','record_kind':'site_catalog','title':raw['history_site_name'].strip(),'source_locator':'제주4·3아카이브 history_no='+key,'source_line':None,'date_lower':None,'date_upper':None,'date_precision':'unknown','event_year':None,'date_basis':None,'violence':raw['history_site_type_name'],'raw_fields':raw})
        places.append({'record_key':key,'ordinal':1,'place_label':raw['current_address'],'place_type':raw['history_site_type_name'],'latitude':None,'longitude':None,'coordinate_precision':'unlocated','coordinate_basis':'archive_current_address_no_coordinates','role':'historical_site_catalog'})
    tables=p.make_tables(records,places,digest,p.utcnow(),'jeju43-history')
    p.insert_sqlite(tables,OUT/'research.sqlite3');p.export_mariadb(tables,OUT/'jeju-history-import.mariadb.sql')
    p.dump(OUT/'jeju-history.json',{'count':len(records),'regions':coverage,'pages':pages,'records':records,'sha256':digest,'unit':'site_catalog_not_victims'})
    print(json.dumps({'jeju_history_sites':len(records),'regions':len(regions)}))

def chile():
    meta=json.loads(public_download('https://www.geoboundaries.org/api/current/gbOpen/CHL/ADM1/',p.ROOT/'raw/chile-boundaries-metadata.json'))
    body=public_download(meta['simplifiedGeometryGeoJSON'],p.ROOT/'raw/chile-regions.geojson')
    geo=json.loads(body)
    if len(geo['features'])!=16:raise ValueError('Unexpected region count')
    p.dump(OUT/'chile-boundaries-metadata.json',meta)
    dest=p.ROOT.parent/'frontend/data/chile-regions.geojson';dest.write_bytes(body)
    print(json.dumps({'regions':len(geo['features']),'names':[f['properties'] for f in geo['features']]},ensure_ascii=False))

def osm():
    # One cached regional extract for specific historical sites and administrative context.
    path=p.ROOT/'raw/jeju-osm-context.json'
    if not path.exists():
        pattern='4[·.ㆍ]?[ ]?3|너븐숭이|곤을동|섯알오름|큰넓궤|관덕정|정방폭포|다랑쉬|무등이왓|만벵듸|백조일손|주정공장|현의합장|송령이골|진아영|낙선동'
        admins='^(제주시|서귀포시|애월읍|한림읍|한경면|대정읍|안덕면|중문동|남원읍|표선면|성산읍|구좌읍|조천읍)$'
        query=f'[out:json][timeout:40];(nwr["name"~"{pattern}"](33.1,126.1,33.7,127);nwr["place"]["name"~"{admins}"](33.1,126.1,33.7,127);relation["boundary"="administrative"]["name"~"{admins}"](33.1,126.1,33.7,127););out center tags;'
        url='https://overpass-api.de/api/interpreter?'+urlencode({'data':query})
        public_download(url,path)
    data=json.loads(path.read_text(encoding='utf8'))
    print(json.dumps({'elements':len(data['elements']),'names':[(x.get('tags',{}).get('name'),x.get('type'),x.get('id'),x.get('lat',x.get('center',{}).get('lat')),x.get('lon',x.get('center',{}).get('lon'))) for x in data['elements']]},ensure_ascii=False))

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf8')
    parser=argparse.ArgumentParser();parser.add_argument('kind',choices=['jeju','chile','osm']);args=parser.parse_args()
    {'jeju':jeju,'chile':chile,'osm':osm}[args.kind]()
