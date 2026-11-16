import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {countLiteral,analyzeText,splitLecture,temporalCounts} from '../frontend/research-engine.mjs';
import {makeCohort,runModel,comparePolicies} from '../frontend/simulation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lecture=JSON.parse(fs.readFileSync(path.join(root,'frontend/data/lecture.json'),'utf8'));
const photos=JSON.parse(fs.readFileSync(path.join(root,'frontend/data/photos.json'),'utf8'));
assert.equal(countLiteral('조사 조사관 조사는','조사'),3);
assert.equal(countLiteral('시험',''),0);
const fixture=[{id:'a',text:'명단 조사 조사'},{id:'b',text:'명단 신청'},{id:'c',text:'기억'}];
const a=analyzeText(fixture,'조사',['명단','신청','기억']);
assert.equal(a.occurrences,2);assert.equal(a.hits.length,1);assert.deepEqual(a.neighbors,[{word:'명단',count:1}]);
const parts=splitLecture(lecture.blocks);
assert.ok(parts.qa.some(b=>b.id==='p212'),'Actual Q&A source must be in Q&A scope');
assert.ok(!parts.body.some(b=>b.id==='p212'),'Q&A must not leak into lecture-body scope');
assert.equal(parts.qa.length+parts.body.length,lecture.blocks.length);
const times=temporalCounts([{event_date:'1973-09-11'},{event_date:'1973-10-01'},{event_date:null},{event_date:'1974-01-01'}]);
assert.deepEqual(times.entries,[{year:1973,count:2},{year:1974,count:1}]);assert.equal(times.unknown,1);
for(const config of [{excluded:25,barrier:55,capacity:6},{excluded:70,barrier:100,capacity:1},{excluded:0,barrier:0,capacity:20}]){
  const model=comparePolicies(config,20261118);
  assert.deepEqual(model,comparePolicies(config,20261118),'A saved seed must reproduce the experiment');
  for(const branch of ['baseline','alternative']){
    let previous=0, previousStates=Array(200).fill(0);
    for(const s of model[branch]){
      assert.equal(s.recorded+s.waiting+s.outside,200,'Every record must have exactly one state');
      assert.ok(s.recorded>=previous,'Accepted records must not disappear');
      assert.ok(s.recorded-previous<=config.capacity,'Weekly capacity must be respected');
      assert.ok(s.states.every((v,i)=>v>=previousStates[i]),'Record transitions must move forward');
      previous=s.recorded;previousStates=s.states;
    }
  }
}
const noBarrier=comparePolicies({excluded:0,barrier:0,capacity:20});
assert.equal(noBarrier.baseline[52].recorded,200);assert.equal(noBarrier.alternative[52].recorded,200);
const exclusion=comparePolicies({excluded:70,barrier:55,capacity:20});
assert.ok(exclusion.alternative[52].recorded>exclusion.baseline[52].recorded,'Outreach should reach some otherwise excluded synthetic records');
for(const p of photos)assert.ok(fs.existsSync(path.join(root,'frontend',p.src)),`Missing original photo: ${p.src}`);
for(const id of ['p048','p051','p058','p212','p213','p216'])assert.ok(lecture.blocks.find(b=>b.id===id),`Missing cited paragraph ${id}`);
for(const name of ['workbench.js','workbench.css','research-engine.mjs','simulation.mjs','assets/leaflet.js','assets/leaflet.css'])assert.ok(fs.statSync(path.join(root,'frontend',name)).size>0);
console.log(JSON.stringify({status:'passed',checks:'source provenance, corpus scope, literal counting, missing-date handling, reproducible paired model, mass conservation, weekly capacity, photo assets',lecture_blocks:lecture.blocks.length,body_blocks:parts.body.length,qa_blocks:parts.qa.length,pptx_images:photos.length}));
