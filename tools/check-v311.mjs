import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCENARIOS,comparePolicies,makeCohort,runModel,formatForecastMonth} from '../frontend/simulation.mjs';
import {PRESENTATION_CUES,presentationShortcut} from '../frontend/lecture-config.mjs';
const config=id=>Object.fromEntries(['excluded','barrier','capacity'].map((k,i)=>[k,SCENARIOS[id].default[i]]));
const a=comparePolicies(config('A'));
const slow=comparePolicies({...config('A'),capacity:15});
assert.equal(a.target.count,2630);
assert.equal(a.target.week,97);
assert.equal(slow.target.week,179);
assert.ok(a.target.withinComparison&&!slow.target.withinComparison);
assert.equal(a.calibration.modelMean,362,'Changing interpretation must not silently retune observations');
for(const id of ['A','B','C']){
 const result=comparePolicies(config(id),20261118,200,id);
 assert.deepEqual(result.uncertainty.outer,[.05,.95]);
 assert.equal(result.uncertainty.outerCoverage,.9);
 assert.equal(result.uncertainty.innerCoverage,.5);
 if(result.target.reached){
  assert.ok(result.alternative[result.target.week].mean>=result.target.count);
  assert.ok(result.target.week===0||result.alternative[result.target.week-1].mean<result.target.count);
 }else{
  assert.equal(result.target.week,null);
  assert.ok(result.alternative.every(s=>s.mean<result.target.count));
 }
 const json=JSON.parse(JSON.stringify(result));
 assert.deepEqual(json.target,result.target,'Unreached target must survive JSON export as null, not an Infinity-derived date');
}
const jeju=comparePolicies(config('C'),20261118,200,'C');
const unreachable=comparePolicies({...config('C'),excluded:98},20261118,200,'C');
assert.equal(unreachable.target.reached,false,'A reachable lower threshold must not masquerade as 90% completion');
assert.equal(unreachable.target.week,null);
assert.ok(unreachable.alternative.at(-1).mean<unreachable.target.count);
assert.ok(unreachable.alternative.at(-1).mean>20000,'This case reaches many records but cannot reach the fixed 90% target');
assert.equal(jeju.time.startYearMonth,null);
assert.match(formatForecastMonth(null,52),/실제 달력과 대응하지 않음/);
// Independent check against sorted, paired run outcomes for the displayed band and SD.
const values=Array.from({length:28},(_,i)=>runModel(makeCohort(20261118+i*7919),config('A'),false,104,'A')[104].realRecorded).sort((x,y)=>x-y);
const q05=Math.round(values[1]+.35*(values[2]-values[1]));
const q95=Math.round(values[25]+.65*(values[26]-values[25]));
assert.equal(a.baseline[104].p05,q05);assert.equal(a.baseline[104].p95,q95);
const mean=values.reduce((s,x)=>s+x,0)/28;
const sd=Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/27);
assert.ok(Math.abs(a.baseline[104].sd-sd)<1e-9);

let minute=0,slide=1;
for(const cue of PRESENTATION_CUES){assert.equal(cue.start,minute);assert.equal(cue.slides[0],slide);minute=cue.end;slide=cue.slides[1]+1;}
assert.equal(minute,60);assert.equal(slide,21);
assert.equal(PRESENTATION_CUES.at(-1).action,'rainbow');
assert.equal(PRESENTATION_CUES.at(-1).end-PRESENTATION_CUES.at(-1).start,3);
const event=(key,tag='BUTTON',extra={})=>({key,target:{tagName:tag},...extra});
assert.deepEqual(presentationShortcut(event('R')),{kind:'rainbow'});
assert.deepEqual(presentationShortcut(event('5')),{kind:'step',value:5});
for(const tag of ['INPUT','TEXTAREA','SELECT'])assert.equal(presentationShortcut(event('r',tag)),null);
assert.equal(presentationShortcut(event('r','DIV',{target:{tagName:'DIV',isContentEditable:true}})),null);
assert.equal(presentationShortcut(event('r','BUTTON',{ctrlKey:true})),null);
assert.equal(presentationShortcut(event('ArrowLeft','BUTTON',{altKey:true}),4),null);
assert.equal(presentationShortcut(event('Enter')),null,'Native button activation must remain available');

const front=JSON.parse(fs.readFileSync(new URL('../frontend/data/jeju43_comprehensive.json',import.meta.url)));
const back=JSON.parse(fs.readFileSync(new URL('../backend/jeju43_comprehensive.json',import.meta.url)));
assert.deepEqual(front,back,'API and static snapshot must carry identical interpretation metadata');
assert.equal(front.rows.length,109);assert.equal(front.count,109);
const regionSum=front.rows.filter(r=>r.record_layer==='eup_myeon_stat').reduce((s,r)=>s+r.victim_count,0);
assert.equal(regionSum,13941);assert.equal(front.official_summary.report_2003_total-regionSum,87);
assert.equal(front.official_summary.eup_myeon_reconciliation.difference,87);
assert.equal(front.official_summary.temporal_basis.individual_dates_verified,false);
assert.ok(front.rows.filter(r=>r.record_layer==='memory_sublimation').every(r=>r.victim_count===null));
assert.equal(Object.values(front.coverage.date_precision).reduce((s,n)=>s+n,0),109);
console.log('v3.1.1: target thresholds, unreached outcomes, quantiles/SD, scenario time, 20-slide schedule, keyboard editing guards and source reconciliation passed.');
