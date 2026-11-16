export function knownYear(row){
  if(Number.isInteger(row.event_year))return row.event_year;
  return /^\d{4}-\d{2}-\d{2}$/.test(row.event_date||'')?Number(row.event_date.slice(0,4)):null;
}
export function filterRecords(rows,options){
  const term=(options.search||'').trim().toLocaleLowerCase();
  return rows.filter(r=>{
    const year=knownYear(r);
    if(!options.allDates){if(year===null){if(!options.includeUnknown)return false;}else if(options.cumulative?year>options.year:year!==options.year)return false;}
    else if(!options.includeUnknown&&year===null)return false;
    return !term||[r.victim_or_site_name,r.location_start,r.location_end,r.region_label,r.incident_type].some(s=>String(s||'').toLocaleLowerCase().includes(term));
  });
}
export function recordPoints(row,options){
  let points=[];
  if(options.locationMode==='all')points=(row.places||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)).map(p=>({lat:p.latitude,lng:p.longitude,precision:p.coordinate_precision,label:p.place_label,ordinal:p.ordinal}));
  else if(Number.isFinite(row.lat_start)&&Number.isFinite(row.lng_start))points=[{lat:row.lat_start,lng:row.lng_start,precision:row.coordinate_precision,label:row.location_start,ordinal:1}];
  if(options.siteReferences&&row.display_location){const p=row.display_location;points.push({lat:p.latitude,lng:p.longitude,precision:p.precision,label:p.label,source_url:p.source_url,ordinal:null});}
  return points.filter(p=>options.precision==='all'||p.precision===options.precision).map(p=>({...p,record:row}));
}
export function clusterPoints(points,project,cellSize=44){
  const bins=new Map();
  for(const point of points){const pixel=project(point),key=`${Math.floor(pixel.x/cellSize)},${Math.floor(pixel.y/cellSize)}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(point);}
  return [...bins.values()].map(items=>({items,lat:items.reduce((s,p)=>s+p.lat,0)/items.length,lng:items.reduce((s,p)=>s+p.lng,0)/items.length,records:[...new Map(items.map(p=>[p.record.incident_id,p.record])).values()]}));
}
export function groupRecords(rows,groups){
  const bins=new Map();
  for(const row of rows){if(!groups[row.region_key])continue;if(!bins.has(row.region_key))bins.set(row.region_key,[]);bins.get(row.region_key).push(row);}
  return [...bins].map(([key,records])=>({...groups[key],records}));
}
export function csvRecords(rows){
  const header=['source_id','source_record_id','record_kind','name_or_site','date_lower','date_upper','date_precision','region_in_source','place_in_source','source_latitude_1','source_longitude_1','coordinate_precision','source_locator','source_url','snapshot_id'];
  const cell=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\ufeff'+[header,...rows.map(r=>[r.source_id,r.source_record_id,r.record_kind,r.victim_or_site_name,r.date_lower,r.date_upper,r.date_precision,r.region_label,r.location_start,r.lat_start,r.lng_start,r.coordinate_precision,r.source_page,r.source_url,r.snapshot_id])].map(row=>row.map(cell).join(',')).join('\r\n');
}
