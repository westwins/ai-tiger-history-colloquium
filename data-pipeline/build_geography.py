"""Reference display positions, kept separate from the source's historical coordinates."""
import json
from pathlib import Path
import unicodedata
import pipeline as p

geo=json.loads((p.ROOT/'raw/chile-regions.geojson').read_text(encoding='utf8'))
def repair(s):
    try:return s.encode('latin1').decode('utf8') if 'Ã' in s else s
    except UnicodeError:return s
for feature in geo['features']:feature['properties']['shapeName']=repair(feature['properties']['shapeName'])
(p.ROOT.parent/'frontend/data/chile-regions.geojson').write_text(json.dumps(geo,ensure_ascii=False),encoding='utf8')
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s).lower() if not unicodedata.combining(c))
def representative(feature):
    polygons=feature['geometry']['coordinates'] if feature['geometry']['type']=='MultiPolygon' else [feature['geometry']['coordinates']]
    def area(ring):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))/2)
    ring=max((poly[0] for poly in polygons),key=area)
    # Center of largest exterior's bounding box: a reference display point, not an event site.
    xs=[x[0] for x in ring];ys=[x[1] for x in ring]
    return (min(ys)+max(ys))/2,(min(xs)+max(xs))/2

specs=[('CL-01','I Tarapacá',['tarapaca','arica']),('CL-02','II Antofagasta',['antofagasta']),('CL-03','III Atacama',['atacama']),('CL-04','IV Coquimbo',['coquimbo']),('CL-05','V Valparaíso',['valparaiso']),('CL-06','VI O`Higgins',["o'higgins"]),('CL-07','VII Maule',['maule']),('CL-08','VIII Biobío',['bio-bio','nuble']),('CL-09','IX Araucanía',['araucania']),('CL-10','X Los Lagos',['los lagos','los rios']),('CL-11','XI Aysén',['aysen']),('CL-12','XII Magallanes',['magallanes']),('CL-13','RM Metropolitana',['metropolitana']),('CL-15','Región de Arica y Parinacota',['arica'])]
groups={};aliases={}
boundary_meta=json.loads((p.ROOT/'output/chile-boundaries-metadata.json').read_text(encoding='utf8'))
for key,label,parts in specs:
    features=[f for f in geo['features'] if any(part in norm(f['properties']['shapeName']) for part in parts)]
    lat,lon=representative(features[0])
    groups[key]={'key':key,'label':label,'country':'CHL','latitude':lat,'longitude':lon,'precision':'region_reference','source_url':'https://www.geoboundaries.org/api/current/gbOpen/CHL/ADM1/','feature_ids':[f['properties']['shapeID'] for f in features],
                 'note':'명부의 지역을 보여주는 참고 위치입니다. 개인의 사건 좌표가 아닙니다. 옛 지역 구분은 현행 경계를 묶어 참고하며 당시 경계를 복원한 지도가 아닙니다.'}
    aliases[label.casefold()]=key
aliases['rm metropolitana']='CL-13'
# Numeral/name conflicts XIV Arica-Parinacota and XV Los Lagos are deliberately not auto-corrected.
osm=json.loads((p.ROOT/'raw/jeju-osm-context.json').read_text(encoding='utf8'))
nodes={x['tags']['name']:x for x in osm['elements'] if x['type']=='node' and x.get('tags',{}).get('place') and x.get('tags',{}).get('name')}
districts=[('CO-ADR-NTH-A03','제주읍','제주시'),('CO-ADR-NTH-A02','애월면','애월읍'),('CO-ADR-NTH-A06','한림면','한림읍'),('CO-ADR-NTH-A05','한경면','한경면'),('CO-ADR-STH-A02','대정면','대정읍'),('CO-ADR-STH-A05','안덕면','안덕면'),('CO-ADR-STH-A06','중문면','중문동'),('CO-ADR-STH-A03','서귀면','서귀포시'),('CO-ADR-STH-A01','남원면','남원읍'),('CO-ADR-STH-A07','표선면','표선면'),('CO-ADR-STH-A04','성산면','성산읍'),('CO-ADR-NTH-A01','구좌면','구좌읍'),('CO-ADR-NTH-A04','조천면','조천읍')]
cat={}
for key,old,current in districts:
    node=nodes[current]
    groups[key]={'key':key,'label':old,'country':'KOR','latitude':node['lat'],'longitude':node['lon'],'precision':'region_reference','source_url':'https://www.openstreetmap.org/node/'+str(node['id']),'note':'원문의 옛 지역 분류를 현대 행정지명의 대표 위치에 모아 표시합니다. 유적 개별 위치나 당시 행정경계가 아닙니다.'}
    cat[current]=key
cat.update({'서귀포':'CO-ADR-STH-A03','제주시':'CO-ADR-NTH-A03'})
elements={x['id']:x for x in osm['elements']}
rules=[('관덕정',288746175),('너븐숭이',375505979),('평화공원',370329624),('정방폭포',3739756346),('섯알오름',1437044338)]
sites={}
for filename in ('jeju-history.json','jeju-sites.json'):
    source='jeju43-history' if filename=='jeju-history.json' else 'jeju43-sites'
    for row in json.loads((p.ROOT/'output'/filename).read_text(encoding='utf8'))['records']:
        for term,oid in rules:
            if term not in row['title']:continue
            e=elements[oid];center=e.get('center',e)
            sites[source+':'+row['record_key']]={'latitude':center['lat'],'longitude':center['lon'],'label':e['tags']['name'],'precision':'osm_site_reference','source_url':f"https://www.openstreetmap.org/{e['type']}/{e['id']}",'note':'동일 명칭의 현대 유적·시설을 수동 대조한 참고 위치입니다. 사건 발생의 정확한 지점으로 검증한 좌표가 아닙니다.'}
            break
result={'groups':groups,'chile_region_aliases':aliases,'jeju_category_aliases':cat,'sites':sites,'boundary_attribution':{'title':'geoBoundaries / BCN / OCHA ROLAC','year':boundary_meta['boundaryYearRepresented'],'license':boundary_meta['boundaryLicense'],'url':'https://www.geoboundaries.org/api/current/gbOpen/CHL/ADM1/'},'site_attribution':{'title':'© OpenStreetMap contributors','license':'ODbL','url':'https://www.openstreetmap.org/copyright'}}
p.dump(p.ROOT.parent/'backend/geography.json',result)
print(json.dumps({'reference_groups':len(groups),'modern_site_references':len(sites)},ensure_ascii=False))
