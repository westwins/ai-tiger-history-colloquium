"""Published source observations from additive hist_* tables. No identity merging."""
from collections import Counter,defaultdict
from datetime import date,datetime
import json
from pathlib import Path
import time

CONFIG={
 'chile-pinochet-2019':{'country':'CHL','title':'칠레 · Freire 연구 자료','kind':'person_record','mode':'points','url':'https://github.com/danilofreire/pinochet','note':'레티그 보고서를 재부호화한 인물 기록 전체입니다. 최대 6개 장소와 날짜 정밀도를 보존합니다.'},
 'chile-mmdh-victims':{'country':'CHL','title':'칠레 · MMDH 박물관 명부','kind':'person_catalog','mode':'regions','url':'https://interactivos.museodelamemoria.cl/victims/?page_id=7836','note':'사망·강제실종 공개 명부입니다. 원자료에 위경도가 없어 지역별 건수로 표시합니다. Freire 자료와 겹치므로 합산하지 않습니다.'},
 'jeju43-history':{'country':'KOR','title':'제주 · 공식 아카이브 지역별 유적','kind':'site_catalog','mode':'sites','url':'http://43archives.or.kr/events/history/history.do','note':'공식 지역별 유적 목록의 수집 결과입니다. 유적 건수이며 희생자 수가 아닙니다. 원문에 사건일·위경도가 없는 항목은 추정해 채우지 않습니다.'},
 'jeju43-sites':{'country':'KOR','title':'제주 · 평화재단 소개 유적 25곳','kind':'site_catalog','mode':'sites','url':'https://jeju43peace.or.kr/kor/ruins/list.do','note':'평화재단이 소개한 유적 목록입니다. 공식 아카이브 목록과 일부 겹치며 제주 전체 유적의 전수 명부가 아닙니다.'}
}
DEFAULT={'CHL':'chile-pinochet-2019','KOR':'jeju43-history'}
GEO_FILE=Path(__file__).with_name('geography.json')
GEO=json.loads(GEO_FILE.read_text(encoding='utf8')) if GEO_FILE.exists() else {'groups':{},'sites':{}}
CACHE={}

def text(v):
    return None if v is None or str(v).strip() in ('','NA','N/A') else str(v).strip()

def iso(v):
    return v.isoformat()[:10] if isinstance(v,(date,datetime)) else text(v)

def date_label(row):
    lower=iso(row.get('date_lower'));precision=row.get('date_precision')
    return lower if precision=='day' else lower[:7]+' (월 단위)' if lower and precision=='month' else lower[:4]+' (연 단위)' if lower and precision=='year' else '원자료 날짜 미상'

def region_key(raw):
    original=text(raw.get('Región'))
    if not original:return None
    return GEO.get('chile_region_aliases',{}).get(original.casefold())

def normalize(row,places):
    raw=row.get('raw_json')
    raw=json.loads(raw) if isinstance(raw,str) else raw
    source=row['source_id'];cfg=CONFIG[source]
    lower,upper=iso(row.get('date_lower')),iso(row.get('date_upper'))
    first=next((p for p in places if p['ordinal']==1),{})
    item={'incident_id':source+':'+row['record_key'],'source_record_id':row['record_key'],'source_id':source,'source_title':cfg['title'],
          'country_code':row['country_code'],'record_kind':row['record_kind'],'record_basis':'source_catalog' if cfg['mode']!='points' else 'research_dataset',
          'victim_or_site_name':row['title'],'source_page':row.get('source_locator'),'source_url':cfg['url'],'snapshot_id':row['snapshot_id'],'source_sha256':row['sha256'],
          'event_date':lower if row['date_precision']=='day' else None,'event_year':row.get('event_year'),'date_lower':lower,'date_upper':upper,
          'date_precision':row['date_precision'],'date_display':date_label(row),'date_basis':row.get('date_basis'),'incident_type':row.get('violence'),
          'lat_start':first.get('latitude'),'lng_start':first.get('longitude'),'lat_end':None,'lng_end':None,'location_start':first.get('place_label'),
          'coordinate_precision':first.get('coordinate_precision','unlocated'),'places':places,'age':None,'occupation':None,'affiliation':None,'perpetrator':None,
          'date_original':raw.get('start_date_daily') if source=='chile-pinochet-2019' else raw.get('Fecha Detención/Muerte'),
          'quality_notes':[],
          'region_key':None,'region_label':None,'display_location':None,'silence_note':'출처의 좌표·날짜 정밀도를 그대로 구분합니다. 기록 수를 사건 수나 전체 희생자 수로 바꾸지 않습니다.'}
    if source=='chile-pinochet-2019':
        item.update(age=text(raw.get('age')),occupation=text(raw.get('occupation')),affiliation=text(raw.get('victim_affiliation')),perpetrator=text(raw.get('perpetrator_affiliation')))
        second=next((p for p in places if p['ordinal']==2),{})
        item.update(lat_end=second.get('latitude'),lng_end=second.get('longitude'),location_end=second.get('place_label'))
    elif source=='chile-mmdh-victims':
        item.update(age=text(raw.get('Edad')),occupation=text(raw.get('Ocupación')),affiliation=text(raw.get('Militancia')),region_key=region_key(raw),region_label=text(raw.get('Región')),location_start=' / '.join(dict.fromkeys(filter(None,[text(raw.get(k)) for k in ('Comuna','Ciudad','Región')]))))
        if item['region_label'] in ('XV Los Lagos','XIV Arica-Parinacota'):item['quality_notes'].append('지역 번호와 이름이 충돌하여 지역 좌표를 자동 배정하지 않았습니다.')
        if item['event_year'] and item['event_year']>1990:item['quality_notes'].append('원문 날짜가 1990년 이후입니다. 재검토 대상으로 보존합니다.')
        if item['date_precision']=='unknown':item['quality_notes'].append('원문 날짜 표기를 해석하지 못하여 미상으로 남겼습니다.')
    else:
        key=raw.get('past_address2') if source=='jeju43-history' else GEO.get('jeju_category_aliases',{}).get(raw.get('category'))
        item.update(region_key=key,region_label=raw.get('past_address2_name') or raw.get('category'),location_start=raw.get('current_address') or raw.get('category'))
        site=GEO.get('sites',{}).get(source+':'+row['record_key'])
        if site:item['display_location']=site
        if source=='jeju43-history':item['source_url']=cfg['url']+'?siteCode='+str(raw.get('past_address2') or '')
    item['is_exact_coord']=item['coordinate_precision']=='exact'
    return item

def source_dataset(query,source):
    cached=CACHE.get(source)
    if cached and time.monotonic()-cached[0]<30:return cached[1]
    cfg=CONFIG[source]
    snapshot,_=query('SELECT snapshot_id,sha256,fetched_at FROM hist_snapshot WHERE source_id=%s ORDER BY imported_at DESC,snapshot_id DESC LIMIT 1',(source,))
    if not snapshot:raise RuntimeError('Published source snapshot is missing: '+source)
    snap=snapshot[0]
    rows,elapsed=query('SELECT * FROM hist_record WHERE snapshot_id=%s ORDER BY event_year,record_key',(snap['snapshot_id'],))
    points,_=query('SELECT * FROM hist_place WHERE snapshot_id=%s ORDER BY record_key,ordinal',(snap['snapshot_id'],))
    grouped=defaultdict(list)
    for place in points:
        for k in ('latitude','longitude'):place[k]=float(place[k]) if place[k] is not None else None
        grouped[place['record_key']].append({k:place[k] for k in ('ordinal','place_label','place_type','latitude','longitude','coordinate_precision','coordinate_basis','role')})
    result=[normalize({**row,'source_id':source,'sha256':snap['sha256']},grouped[row['record_key']]) for row in rows]
    first=sum(r['lat_start'] is not None and r['lng_start'] is not None for r in result)
    any_location=sum(any(p['latitude'] is not None and p['longitude'] is not None for p in r['places']) for r in result)
    coverage={'first_location_mappable':first,'any_location_mappable':any_location,'osm_site_references':sum(bool(r['display_location']) for r in result),
              'region_assigned':sum(bool(r['region_key'] in GEO.get('groups',{})) for r in result),'date_precision':dict(Counter(r['date_precision'] for r in result))}
    data={'rows':result,'count':len(result),'truncated':False,'source_id':source,'source':cfg['title'],'source_url':cfg['url'],'country':cfg['country'],
          'mode':cfg['mode'],'record_kind':cfg['kind'],'record_unit':'유적' if cfg['kind']=='site_catalog' else '출처 내 인물 기록','basis':'source_observations',
          'coverage_note':cfg['note'],'coverage':coverage,'snapshot_id':snap['snapshot_id'],'source_sha256':snap['sha256'],'fetched_at':snap['fetched_at'],'elapsed_ms':elapsed}
    CACHE[source]=(time.monotonic(),data)
    return data

def source_index(query):
    result=[]
    for source,cfg in CONFIG.items():
        data=source_dataset(query,source)
        result.append({'id':source,**cfg,'count':data['count'],'coverage':data['coverage'],'snapshot_id':data['snapshot_id']})
    return result
