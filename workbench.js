import {archiveMapShell,mountArchiveMap,archiveRecordHTML} from './archive-map.mjs?v=20261116.22';
import {LEXICON, escapeHtml as E, countLiteral, splitLecture, analyzeText, temporalCounts, paragraphExcerpt} from './research-engine.mjs?v=20261116.22';
import {SCENARIOS, comparePolicies} from './simulation.mjs?v=20261116.22';

const $ = (selector, parent=document) => parent.querySelector(selector);
const $$ = (selector,parent=document) => [...parent.querySelectorAll(selector)];
const fmt = n => Number(n).toLocaleString('ko-KR');
const main = $('#main');
const SOURCE_URL = 'https://blog.soohwalee.com/2026/10/29/latin-america-trc-transitional-justice-korea/';
const DATASET_URL = 'https://github.com/danilofreire/pinochet';
const DOJ_URL = 'https://www.justice.gov.za/trc/amntrans/index.htm';
const APP_VERSION = '2.2.0';
const STATIC_GHPAGES = location.hostname.endsWith('github.io') || location.protocol === 'file:';
const API_BASE = location.pathname.includes('/preview-v2/') ? '/preview-v2/api' : './api';
let lecture, photos=[], stats=null, incidentsCache={}, map=null, mapTimer=null, simTimer=null, toastTimer=null;
let generation=0, mapController=null;
const state = {mapOptions:{source:'chile-pinochet-2019'}, timelineSource:'chile-pinochet-2019', step:0, case:'amnesty', graph:'all', node:'question', evidenceMode:'graph', term:'조사', scope:'all', textMode:'lecture', mapCountry:'CHL', year:1990, cumulative:true, precision:'all', phase:0, scenario:'A', simConfig:{excluded:25,barrier:55,capacity:6}, seed:20261118, week:0, sim:null, photo:0, audience:'public', logLevel:4, cueOpen:false};
let annotations={};
try { annotations=JSON.parse(localStorage.getItem('trc-research-judgements-v2') || '{}'); } catch {}

function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
function openDialog(title,content) { $('#dialog-title').textContent=title; $('#dialog-body').innerHTML=content; if(!$('#detail-dialog').open) $('#detail-dialog').showModal(); }
function sourceBlock(id) { return lecture.blocks.find(b=>b.id===id); }
function showSource(id) { const b=sourceBlock(id); if(!b) return; const i=lecture.blocks.indexOf(b), before=lecture.blocks[i-1], after=lecture.blocks[i+1]; openDialog('공개 강연 채록본 원문',`<div class="source-label">문단 ${E(id)} · 편집 채록본</div><div class="source-block-full">${before?`<p class="adjacent-source"><small>앞 문단 ${before.id}</small><br>${E(before.text)}</p>`:''}<p class="selected-source">${E(b.text)}</p>${after?`<p class="adjacent-source"><small>뒤 문단 ${after.id}</small><br>${E(after.text)}</p>`:''}</div><p class="note">선택한 문단을 앞뒤 문맥과 함께 표시합니다. 녹음 원본과의 대조 여부는 별도로 확인해야 합니다.</p><a href="${SOURCE_URL}" target="_blank" rel="noopener">공개 강연록 전체 열기 ↗</a>`); }
function nextStep(step,text) { return `<div class="next-section"><p>${text}</p><button class="btn outline" data-step="${step}">${step===6?'공공역사로 제작하기':`${String(step).padStart(2,'0')} 다음 연구 단계`} <span>↗</span></button></div>`; }
function head(phase,step,title,description,basis='public') {
  const m=STEP_META[step]||{field:'',cue:''};
  const cls=phase==='확대'?'widen':phase==='산학화'?'share':'deepen';
  return `<div class="step-lens-banner ${cls}"><div><span class="field-chip">${E(m.field)}</span> <b>${phase} 테제:</b> ${E(m.cue)}</div><button class="btn outline small" data-step="0">00 전체 매핑 ↗</button></div><div class="section-head"><div><div class="eyebrow">${phase} / ${String(step).padStart(2,'0')} · ${E(m.field)}</div><h1>${title}</h1><p>${description}</p></div><span class="source-pill ${basis==='model'?'model':basis==='demo'?'demo':''}">${basis==='model'?'가상 집단 · 교육용 모형':basis==='demo'?'연구자 편집 구조도':basis==='dataset'?'연구 데이터 · 실제 집계':'공개 채록본 · 출처 연결'}</span></div>`;
}
function segmented(items,active,name) { return `<div class="segmented" role="group" aria-label="${E(name)}">${items.map(([id,label])=>`<button class="${String(id)===String(active)?'active':''}" data-${name}="${id}" aria-pressed="${String(id)===String(active)}">${label}</button>`).join('')}</div>`; }
function loading(message='연구 데이터를 불러오고 있습니다…') { return `<div class="loading">${message}</div>`; }
function failure(message) { return `<div class="error-panel"><b>자료를 불러오지 못했습니다</b>${E(message)}<p class="note">예시 데이터로 대신 채우지 않습니다. 연결을 확인한 뒤 새로고침해 주세요.</p></div>`; }
async function getJSON(url) { const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error(`자료 서버 응답 ${res.status}`); return res.json(); }
async function getIncidents(country,source=country==='CHL'?'chile-pinochet-2019':'jeju43-history') {
  const key=country+':'+source;
  if(!incidentsCache[key]){
    const loader = STATIC_GHPAGES
      ? getJSON(`data/static-api/incidents-${encodeURIComponent(source)}.json`)
      : getJSON(`${API_BASE}/research/incidents?country=${country}&source=${encodeURIComponent(source)}`).catch(()=>getJSON(`data/static-api/incidents-${encodeURIComponent(source)}.json`));
    incidentsCache[key]=loader.catch(e=>{delete incidentsCache[key];throw e;});
  }
  return incidentsCache[key];
}
function download(text,name,type='text/plain;charset=utf-8') { const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast(`${name} 파일을 저장했습니다.`); }


const STEP_META = {
  0: {axis:'총괄 테제', field:'서사 채널 → 오토마타 채널', time:'12:00–12:14', slide:'Part 1 (슬라이드 1–5)', cue:'인문학은 학자 머릿속의 시선과 모델입니다. 이제 짚인간(AI)으로 서사 채널을 넘어 오토마타로 직결됩니다.'},
  1: {axis:'심화', field:'필드 ① 디지털 아카이빙 · 전산문헌학', time:'12:14–12:20', slide:'Part 2-A (슬라이드 6–7)', cue:'[심화·시선 보정] 구술 원문(4개 국어 개념어)은 그대로 보존하고, 공식 통계 대조(7,112 신청 vs 849 허가)와 5+5 판단을 스탠드오프로 분리합니다.'},
  2: {axis:'심화', field:'필드 ② 데이터 모델링 · 프로소포그래피', time:'12:20–12:25', slide:'Part 2-B (슬라이드 8)', cue:'[심화·모델 견고화] 강연 본문(자원 제약)과 정지석 동문 반론(개별 입증 병목)을 하나로 뭉개지 않고 병렬 논증 지도로 세웁니다.'},
  3: {axis:'확대', field:'필드 ③ 계산 텍스트 역사학 (멀리읽기)', time:'12:25–12:30', slide:'Part 3-A (슬라이드 9–10)', cue:'[확대·오토마타 질의] 읽은 인상을 본문 대 질의응답 빈도와 칠레 연도 분포로 즉시 계량하고 다시 원문 문단으로 회귀합니다.'},
  4: {axis:'확대', field:'필드 ④ 공간역사학 · 역사 GIS (HGIS)', time:'12:30–12:36', slide:'Part 3-B (슬라이드 11)', cue:'[확대·오토마타 시각화] 칠레 2,398건·MMDH 3,216건·제주 4·3 유적을 중복 합산 왜곡 없이 좌표 정밀도·결측 그대로 지도 위에 펼칩니다.'},
  5: {axis:'확대', field:'필드 ⑤ 계량 · 시뮬레이션 역사학', time:'12:36–12:42', slide:'Part 3-C (슬라이드 12)', cue:'[확대·오토마타 실험] 같은 가상 집단 200건에 개별 신청 대 명단 연계 규칙을 적용해 병목이 어디서 생기는지 작동 모형으로 시험합니다.'},
  6: {axis:'산학화', field:'필드 ⑥ 멀티모달 사료 읽기 · 공공역사', time:'12:42–12:47', slide:'Part 4 (슬라이드 13–16)', cue:'[산학화·다중 채널 공급] 원고 납품을 넘어 사료 출처·판정 유보가 동봉된 카드·고증시트·리빙랩 교안을 현장에 직접 공급합니다.'}
};

const LOG_LEVELS = {
  1: {label:'1단계 · 서사 단독', linear:25, log:6, ratio:'1× 기준 (단일 언어 채널)', desc:'인문학자의 시선과 모델을 논문·단행본·강연이라는 단일 서사 채널로만 전달하는 상태입니다. 사료 대조와 독자 확산에 높은 물리적 마찰이 작동합니다.'},
  2: {label:'2단계 · 심화 (시선 보정)', linear:50, log:22, ratio:'10¹× 도약 (2차 사이버네틱스)', desc:'구술 채록·스탠드오프 사료비판(01)과 병렬 논증 지도(02)로 내 머릿속 모델의 빈틈·통계 착오·침묵 층위를 스스로 재점검하고 견고화합니다.'},
  3: {label:'3단계 · 확대 (오토마타 서비스)', linear:75, log:55, ratio:'10²× 도약 (질의·지도·실험)', desc:'시선이 살아 움직이는 오토마타가 되어 어휘 동시등장 계량(03), 5,686건 다중 출처 시공간 지도(04), 조사 규칙 시뮬레이션(05)을 즉시 수행합니다.'},
  4: {label:'4단계 · 산학화 & 강심장 리더십', linear:100, log:100, ratio:'10³× 도약 (무한 접속 · 0비용화)', desc:'AI 안경 시대 기능지식 시험이 종언을 고할 때, 출처·판정 유보가 봉인된 다중 채널 패키지(06)로 세상을 직접 이끄는 N+1차원 인문학 지휘자가 됩니다.'}
};

function renderPresenterBar() {
  const bar = $('#presenter-bar');
  if (!bar) return;
  const on = document.body.classList.contains('presenting') || state.cueOpen;
  bar.hidden = !on;
  if (!on) return;
  const m = STEP_META[state.step] || STEP_META[0];
  bar.innerHTML = `<div class="presenter-cue-main"><span class="cue-time">${m.time}</span><span class="cue-slide">${m.slide} · ${m.field}</span><span class="cue-line">${E(m.cue)}</span></div><div class="presenter-jumps"><button class="poster-jump" id="bar-poster-btn">⚡ 포스터</button>${[0,1,2,3,4,5,6].map(n=>`<button data-step="${n}" class="${state.step===n?'active':''}">${n===0?'00 테제':'0'+n}</button>`).join('')}</div>`;
  const pb = $('#bar-poster-btn');
  if (pb) pb.onclick = showPosterModal;
}

function renderOverview() {
  const heroPhoto=photos.find(p=>p.src.includes('image19.')) || photos.find(p=>p.slide===21) || photos[0];
  const lv=LOG_LEVELS[state.logLevel] || LOG_LEVELS[4];
  const cards=[
    ['심화 · 필드 ① 전산문헌학','사료비판','100% 다국어 구술 채록을 보존한 채 공식 통계 대조(7,112 vs 849)와 5+5 판단을 분리합니다.'],
    ['심화 · 필드 ② 프로소포그래피','증거 연결','자원 제약 가설과 정지석 동문의 개별 입증 병목 반론을 병렬 논증 지도로 구조화합니다.'],
    ['확대 · 필드 ③ 계산 텍스트학','멀리읽기','본문과 질의응답의 어휘 연결·칠레 연도 분포를 직접 세고 원문 문단으로 돌아갑니다.'],
    ['확대 · 필드 ④ 공간역사학·HGIS','시공간 지도','칠레(2,398·3,216건)와 제주 4·3(47·25곳) 기록을 정밀도·결측 그대로 탐색합니다.'],
    ['확대 · 필드 ⑤ 시뮬레이션 역사학','조사 실험','동일한 가상 집단 200건에 개별 신청 대 명단 연계 조사 규칙을 적용해 동학을 시험합니다.'],
    ['산학화 · 필드 ⑥ 멀티모달·공공역사','공공역사 제작','서사 원고를 넘어 출처·판정 유보가 봉인된 카드·고증시트·리빙랩 교안을 직접 공급합니다.']
  ];
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow">서울대 역사연구소 제136차 월례집담회 · 2026.11.18 (12:00–13:00)</div><h1>AI라는 호랑이<br>등에 <em>올라타기</em></h1><div class="hero-thesis-box"><strong>인문학의 정의 — 인문학자들 머릿속의 ‘시선과 모델’</strong><p>인문학은 역사가·문학가·철학자가 세상을 바라보는 고유한 시선과 모델을 만들고 가르치며 세상을 이끄는 학문입니다. 이제 AI 에이전트(짚인간)가 <b>서사 단일 채널</b>을 넘어 <b>0비용·무한 접속의 소프트웨어(오토마타) 채널</b>을 열어줍니다.</p></div><div class="hero-actions"><button class="btn gold" data-step="1">01 심화 · 사료 한 문장에서 시작하기 <span>↗</span></button><button class="btn outline" id="hero-poster-btn">⚡ 짚인간 양방향 회로 포스터</button><button class="btn outline" id="tour-map">6대 필드 매핑 보기</button></div></div><figure class="hero-image">${heroPhoto?`<img src="${heroPhoto.src}" alt="박구병 강연자료에 담긴 칠레 기억과 인권 박물관의 사진 전시">`:''}<figcaption>단일 씨앗(Seed): 박구병 교수 진실·화해 강연 채록본(216문단) &amp; 원본 시각사료<br>라틴아메리카 + 한국 과거사 담론으로 펼친 디지털 역사학 6대 필드</figcaption></figure></section>
  <section class="thesis-architecture" aria-label="서사 채널에서 소프트웨어 오토마타 채널로의 전환">
    <article class="channel-card">
      <span class="kicker">기존 인문학의 전달 경로</span>
      <h3>단일 ‘서사(언어·지식)’ 채널의 한계</h3>
      <p>지금까지 인문학자 머릿속의 시선과 모델을 검증하고 세상에 전달하는 통로는 논문·저서·강연이라는 <b>언어 서사 채널</b>뿐이었습니다. 사료 대조의 마찰 비용이 높고, 대중역사·문화 현장에도 정지된 원고만 건넬 수 있었습니다.</p>
    </article>
    <article class="channel-card automata">
      <span class="kicker">짚인간(AI 에이전트)이 여는 다중 경로</span>
      <h3>무한 · 0비용 ‘소프트웨어(오토마타)’ 채널</h3>
      <p>소프트웨어는 스스로 작동하는 오토마타입니다. 박구병 교수의 강연 채록본 한 편에서 출발해 시선을 보정(<b>심화</b>)하고, 질의·시각화·모의실험 서비스를 돌리며(<b>확대</b>), 검증 기준이 내장된 결과물을 사회에 직결(<b>산학화</b>)합니다.</p>
      <div class="circuit-badges">
        <div class="circuit-pill reverse"><b>🟠 역방향 회로 · 심화 (2차 사이버네틱스)</b>소프트웨어 스키마로 내 머릿속 시선과 모델을 재점검·증보·체크하여 견고화 (01~02)</div>
        <div class="circuit-pill"><b>🔵 정방향 회로 · 확대 &amp; 산학화 (오토마타 지휘)</b>시각화·질의·시뮬레이션 서비스(03~05) 및 다중 채널 공공역사 직접 제공 (06)</div>
      </div>
    </article>
  </section>
  <div class="intro-line" id="overview-journey"><h2>단 하나의 강연 채록본에서 뻗어나가는<br>심화 · 확대 · 산학화 × 디지털 역사학 6대 필드</h2><p>5월 22일 인문대 발표의 연장선에서, 박구병 교수의 진실·화해 강연 기록(<a href="${SOURCE_URL}" target="_blank" rel="noopener">블로그 채록본 ↗</a>)과 정지석 동문의 현장 질의를 디지털 역사학의 6개 필드로 매핑했습니다.</p></div>
  <div class="journey-overview">${cards.map(([field,title,desc],i)=>`<button class="journey-item" data-step="${i+1}"><span class="field-tag">${field}</span><span class="num">${String(i+1).padStart(2,'0')}</span><h3>${title}</h3><p>${desc}</p><span class="go">↗</span></button>`).join('')}</div>
  <div class="phase-summary"><span><b>심화 01—02 (시선 보정)</b>내 머릿속의 시선·사료 해석 모델을 코드와 스키마로 재점검·견고화</span><span><b>확대 03—05 (오토마타 서비스)</b>계량 질의·시공간 GIS·과정 시뮬레이션으로 질문의 반경을 확장</span><span><b>산학화 06 (다중 채널 공급)</b>서사 제공을 넘어 시각화·근거 데이터·인터랙션 패키지를 직접 제공</span></div>
  <section class="ontology-section" aria-label="체화된 인지, 필멸성, 로그스케일 강심장 리더십">
    <div>
      <div class="eyebrow" style="color:var(--gold)">현상학 · 체화된 인지 · 필멸성, 그리고 인문학의 골든타임</div>
      <h2 style="font-size:26px;color:#fff;letter-spacing:-.8px">접속 채널의 무한화·0비용화로<br>인문학의 시선이 펄펄 날아다니는 시대</h2>
      <div class="ontology-pillars">
        <div class="pillar-item"><strong>1. 체화된 인지(Embodied Cognition)와 구조적 접속</strong><p>현상학이 밝히듯 인문학자의 시선과 모델링은 박제된 지식이 아니라 살아있는 활동입니다. 산문을 작동물(오토마타)로 만들어 세상과 구조적 접속을 일으킬 때 질문이 역류하며 학문이 살아납니다.</p></div>
        <div class="pillar-item"><strong>2. 외롭고 유한한 인간의 ‘필멸성(Mortality)’과 지휘권</strong><p>AI는 틀려도 잃을 생명이 없습니다. 유한한 삶을 살아가는 인간을 대변하고 결단 앞에서 망설이며 책임을 감당하는 필멸성이야말로 인간 인문학자가 지휘봉을 쥐는 존재론적 근거입니다.</p></div>
        <div class="pillar-item"><strong>3. AI 안경 시대 기능지식 학문체계의 종언 → 강심장 리더십</strong><p>AI 안경으로 암기·시험 중심 기능지식 체계가 종언을 고하는 지금이 인문학이 리더십을 발휘할 바로 그 순간입니다. 하던 대로 머물지 말고 학생·연구자 개개인이 막강해져야 합니다.</p></div>
      </div>
    </div>
    <div class="logscale-box">
      <div class="eyebrow">두뇌 모델링의 스케일 법칙</div>
      <h3>머릿속의 시선은 미터법(합산)이 아니라<br><em>로그스케일(Log-scale)</em>로 작동합니다</h3>
      <p class="note" style="color:#b6cad0">단계를 눌러 선형 합산식 지식 축적과 로그스케일 시선·오토마타 증폭을 비교해 보세요.</p>
      <div class="logscale-levels" role="group" aria-label="로그스케일 단계 선택">
        ${[1,2,3,4].map(n=>`<button type="button" data-log-level="${n}" class="${state.logLevel===n?'active':''}">Lv.${n}</button>`).join('')}
      </div>
      <div class="scale-bars">
        <div class="scale-row"><div class="scale-row-top"><span>기존 기능지식 합산법 (미터법: +1씩 증가)</span><b id="linear-readout">${lv.linear}%</b></div><div class="scale-track"><div class="scale-fill linear" id="linear-bar" style="width:${lv.linear}%"></div></div></div>
        <div class="scale-row"><div class="scale-row-top"><span>시선·모델 + 0비용 오토마타 증폭 (로그스케일)</span><b style="color:var(--gold)" id="log-readout">${lv.ratio}</b></div><div class="scale-track"><div class="scale-fill log" id="log-bar" style="width:${lv.log}%"></div></div></div>
      </div>
      <div class="log-caption" id="log-caption"><b>${lv.label}</b> — ${lv.desc}</div>
    </div>
  </section>`;
}

const EPISTEMIC=['사료의 진술','연구자 종합 해석','특정 학설','논쟁 중인 주장','AI의 문맥 보충'];
const SILENCE=['판정하지 않음','사건의 미존재','기록 가치의 배제','기록 권한·주체의 부재','의도적 삭제·은폐','아직 디지털화하지 않음'];
const CASES={amnesty:{name:'신청과 허가의 차이',id:'p048',highlight:'7,000',defaultLayer:0},bottleneck:{name:'명단과 개별 입증',id:'p212',highlight:'개별 신청',defaultLayer:3},terms:{name:'개념어의 번역',find:'Vergangenheitsbewältigung',highlight:'Vergangenheitsbewältigung',defaultLayer:2}};
function selectedCase() { const c=CASES[state.case]; return {...c,block:c.id?sourceBlock(c.id):lecture.blocks.find(b=>b.text.includes(c.find))}; }
function highlight(text,term) { if(!term) return E(text); return E(text).split(E(term)).join(`<mark>${E(term)}</mark>`); }
function renderStep1() {
  const c=selectedCase(),saved=annotations[state.case] || {};
  return head('심화',1,'한 문장, 어디까지 믿을 수 있을까?','원문을 보존한 채 검증 근거와 연구자의 판단을 따로 붙입니다.')+
    `<div class="toolbar">${segmented(Object.entries(CASES).map(([id,c])=>[id,c.name]),state.case,'case')}<label class="switch-label"><input type="checkbox" id="critique-toggle" checked> 사료비판 겹쳐보기</label></div>
    <div class="work-grid"><article class="panel"><div class="panel-title"><b>01 · 남겨진 원문</b><span>공개 채록본 / ${E(c.block.id)}</span></div><div class="quote ${state.case==='bottleneck'?'small':''}" id="source-quote">${highlight(c.block.text,c.highlight)}</div><div class="quote-note">박구병 교수 강연 · ${state.case==='bottleneck'?'정지석 동문 질의응답':'슬라이드와 채록본'}<br><button class="btn outline small" data-source="${c.block.id}">앞뒤 문맥과 원문 보기 ↗</button></div><div class="annotation-form"><div class="field"><label for="epistemic-select">이 문장을 어떤 층위로 읽을까요?</label><select id="epistemic-select">${EPISTEMIC.map((x,i)=>`<option value="${i}" ${Number(saved.epistemic ?? c.defaultLayer)===i?'selected':''}>${i+1}. ${x}</option>`).join('')}</select></div><div class="field"><label for="silence-select">자료가 없을 때 그 이유는?</label><select id="silence-select">${SILENCE.map((x,i)=>`<option value="${i}" ${Number(saved.silence ?? 0)===i?'selected':''}>${i?i+'. ':''}${x}</option>`).join('')}</select></div><div class="field full"><label for="judgement-note">나의 판단 근거 <span class="muted">이 브라우저에 저장</span></label><input id="judgement-note" maxlength="500" placeholder="왜 그렇게 읽었는지 한 문장으로 남겨보세요." value="${E(saved.note || '')}"></div></div><div class="annotation-result" id="annotation-result">${saved.note?'저장한 판단이 있습니다. 06 제작 단계의 근거 기록에 포함합니다.':'분류는 편집자의 판단입니다. 자동 신뢰도 점수를 붙이지 않습니다.'}</div></article>
    <article class="panel dark" id="critique-panel">${critiqueContent()}</article></div>
    <details class="method-details"><summary>5+5 층위는 어떻게 쓰나요?</summary><p>위의 첫 분류는 문장이 사료의 진술인지, 연구자의 해석인지, 학설·논쟁·AI 보충인지 구분합니다. 두 번째 분류는 자료 부재의 이유를 기록합니다. 빈도가 낮거나 좌표가 부정확하다는 이유만으로 ‘의도적 은폐’를 자동 판정하지 않습니다. 여러 층위가 섞인 문장은 더 작은 주장 단위로 나누어 검토해야 합니다.</p></details>`+nextStep(2,'원문에 붙인 판단을 주장과 근거의 연결로 옮겨봅니다.');
}
function critiqueContent() {
  if(state.case==='amnesty') return `<div class="panel-title"><b>02 · 대조할 근거</b><span>남아공 법무부 · 2000.11.01</span></div><div class="finding">‘7천’은 어떤 숫자일까?<br><em>신청과 허가는 다릅니다.</em></div><div class="numeric-pair"><div><span>신청 전체</span><div class="big-number">7,112<small> 건</small></div></div><div><span>허가로 집계된 신청</span><div class="big-number">849<small> 건</small></div></div></div><div class="stacked-bar" aria-label="전체 7112건 중 허가 849건, 거절 5392건, 기타 상태 871건"><span style="width:11.94%;background:var(--mint)"></span><span style="width:75.82%;background:#678392"></span><span style="width:12.24%;background:var(--gold)"></span></div><div class="legend"><span><i style="background:var(--mint)"></i>허가 849</span><span><i style="background:#678392"></i>거절 5,392</span><span><i style="background:var(--gold)"></i>기타 상태 871</span></div><p class="inset-note">편집 판단 · 슬라이드의 표현과 공식 표의 집계 범주를 구별합니다. 기타에는 철회·혼합 결정·결정 대기 등이 포함되며, 이 표는 해당 날짜의 집계입니다.</p><p class="note" style="margin-top:18px">강연 채록의 다른 대목(${sourceBlock('p058')?.id})은 ‘사면을 조건으로 정보를 제공하는 제도’라고 설명합니다. 같은 강연 안의 표현 차이도 함께 읽어야 합니다.</p><a class="btn outline small" style="color:var(--gold);border-color:#ffffff30;margin-top:18px" href="${DOJ_URL}" target="_blank" rel="noopener">공식 집계표 열기 ↗</a>`;
  if(state.case==='bottleneck') return `<div class="panel-title"><b>02 · 현장에서 생긴 새로운 질문</b><span>질의응답 §9</span></div><div class="finding">명단이 있어도<br><em>다시 입증해야 할까?</em></div><div style="display:grid;grid-template-columns:1fr 30px 1fr;gap:15px;align-items:center;margin:35px 0"><div><div class="big-number" style="font-size:27px">명단</div><p class="note">이미 존재하는 기록</p></div><span style="color:var(--gold)">→</span><div><div class="big-number" style="font-size:27px">개별 신청</div><p class="note">반복되는 접수와 증명</p></div></div><p class="inset-note">연구 질문 · 명단 연계 조사와 개인별 입증은 처리 시간과 누락에 어떤 차이를 만드는가?</p><p class="note" style="margin-top:18px">질문자의 경험과 문제 제기는 중요한 사료입니다. 이것만으로 원인과 효과가 확정되지는 않습니다. 실제 조사 건수·대기 시간·누락률을 대조해야 합니다.</p><button class="btn outline small" style="color:var(--gold);border-color:#ffffff30;margin-top:20px" data-source="p216">응답자의 후속 발언 확인 ↗</button>`;
  return `<div class="panel-title"><b>02 · 번역에 남는 해석</b><span>개념사</span></div><div class="finding">한 단어의 번역에도<br><em>역사적 판단이 남습니다.</em></div><div class="mini-bars">${[['épuration','숙청·정화'],['reabilitatsiya','재활·복권'],['Vergangenheitsbewältigung','과거사 극복'],['enfrentamiento','대면·맞섬']].map(([a,b])=>`<div style="padding:13px 0;border-bottom:1px solid #ffffff20"><b style="color:var(--gold);font-size:16px">${a}</b><span style="float:right;font-size:12px">${b}</span></div>`).join('')}</div><p class="note" style="margin-top:20px">편집자의 번역 선택을 원어와 함께 남깁니다. 서로 다른 개념을 같은 뜻으로 합쳐 세기 전에 맥락을 확인합니다.</p>`;
}
function bindStep1() {
  $$('[data-case]').forEach(b=>b.onclick=()=>{state.case=b.dataset.case;renderCurrent(false);});
  $('#critique-toggle').onchange=e=>{ $('#critique-panel').style.visibility=e.target.checked?'visible':'hidden'; const c=selectedCase(); $('#source-quote').innerHTML=e.target.checked?highlight(c.block.text,c.highlight):E(c.block.text); };
  const save=()=>{annotations[state.case]={source:selectedCase().block.id,epistemic:Number($('#epistemic-select').value),silence:Number($('#silence-select').value),note:$('#judgement-note').value,updated:new Date().toISOString()};try{localStorage.setItem('trc-research-judgements-v2',JSON.stringify(annotations));$('#annotation-result').textContent='판단을 저장했습니다. 06 제작 단계의 근거 기록에 포함합니다.';}catch{$('#annotation-result').textContent='브라우저 저장 공간을 사용할 수 없습니다. 현재 세션에서만 유지합니다.';}};
  $('#epistemic-select').onchange=save;$('#silence-select').onchange=save;$('#judgement-note').oninput=save;
}

const GRAPH_NODES=[
  {id:'question',x:350,y:25,w:300,h:76,kind:'연구 질문',lines:['과거사 조사는','왜 지연되는가?'],cls:'central'},
  {id:'resources',x:95,y:190,w:310,h:80,kind:'가설 A · 강연 본문에서',lines:['자료 접근과 인력,','한시적 기구의 제약'],cls:'hyp'},
  {id:'procedure',x:595,y:190,w:310,h:80,kind:'가설 B · 현장 질의에서',lines:['기존 명단이 있어도','개별 입증을 반복하는 방식'],cls:'counter'},
  {id:'limits',x:30,y:365,w:210,h:80,kind:'추가 검증 자료',lines:['예산·인력·','자료 접근 기록']},
  {id:'timing',x:270,y:365,w:210,h:80,kind:'추가 검증 자료',lines:['사건별 실제','조사 기간']},
  {id:'roster',x:520,y:365,w:210,h:80,kind:'현장 발언의 근거',lines:['이미 존재하는','명단']},
  {id:'queue',x:760,y:365,w:210,h:80,kind:'추가 검증 자료',lines:['접수·대기·누락','기록']},
  {id:'response',x:345,y:490,w:310,h:66,kind:'강연자의 응답',lines:['조사 방식의 문제를 수용']}];
const GRAPH_DETAIL={
  question:{type:'경쟁하면서 함께 작동할 수 있는 설명',title:'원인을 하나로 닫지 않습니다',text:'자료·자원의 제약과 조사 절차의 병목은 동시에 존재할 수 있습니다. 아래 두 가설이 어떤 자료를 요구하는지 비교하세요.',sources:['p051','p212']},
  resources:{type:'가설 A · 연구자가 구성한 요약',title:'제도와 자원의 제약',text:'강연 본문은 한시적 위원회의 기간, 강제 조사 권한과 자료 접근의 제약을 설명합니다. 인력을 늘리거나 자료가 확보된 사례에서 실제 처리 속도가 달라지는지 확인해야 합니다.',sources:['p051','p053']},
  procedure:{type:'가설 B · 연구자가 구성한 요약',title:'조사 방식의 병목',text:'정지석 동문은 명단이 존재하는 사건에도 개별 신청과 입증을 반복하는 방식을 문제 삼았습니다. 명단 연계 여부에 따른 대기 시간과 누락의 차이를 검증할 수 있습니다.',sources:['p212','p213']},
  limits:{type:'미수집 · 검증 대기',title:'예산·인력·권한 자료',text:'채록본의 설명을 검증하려면 시기별 예산, 조사관 수, 사건 수, 자료 요청과 거부 기록이 필요합니다. 현재 워크벤치에는 이 비교 자료가 연결되어 있지 않습니다.',sources:['p051']},
  timing:{type:'미수집 · 검증 대기',title:'실제 조사 기간',text:'사건의 규모와 자료 확보 수준을 함께 기록하고, 접수부터 결정까지 걸린 시간을 비교해야 합니다. 기간의 차이만으로 원인을 단정할 수 없습니다.',sources:['p051','p216']},
  roster:{type:'채록본에서 확인한 발언',title:'‘이미 존재하는 명단’',text:'정지석 동문은 강제징집·녹화공작 관련 존안자료 명단을 언급합니다. 실제 명단 원본의 내용과 접근 조건은 추가 확인이 필요합니다. 이 발언을 제주 수형인 명부 원본과 동일한 자료로 취급하지 않습니다.',sources:['p212']},
  queue:{type:'미수집 · 검증 대기',title:'접수 밖의 기록과 대기열',text:'누가 신청하지 못했는지, 어떤 자료가 부족해 대기했는지, 사건 단위 연결로 무엇이 달라졌는지를 조사해야 합니다. 05 단계에서는 이 질문을 가상 집단에 적용해 봅니다.',sources:['p212','p216']},
  response:{type:'채록본의 후속 응답',title:'반론이 질문을 바꿉니다',text:'채록본에서 박구병 교수는 개인별 확인이 반복되는 관행을 언급하며 현장의 지적을 받아들입니다. 이 응답을 보존하면 강연의 첫 설명과 이후의 성찰을 함께 읽을 수 있습니다.',sources:['p216']}
};
function graphSVG() {
  const line=(d,dashed=false,group='all')=>`<path d="${d}" class="graph-edge ${dashed?'dashed':''}" data-edge="${group}"/>`;
  return `<svg viewBox="0 0 1000 590" role="group" aria-label="과거사 조사 지연에 대한 두 가설과 근거의 연결"><defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#628592"/></marker></defs>
  ${line('M250,190 C250,130 430,150 430,101',false,'a')}${line('M750,190 C750,130 570,150 570,101',false,'b')}${line('M135,365 C135,305 210,320 210,270',true,'a')}${line('M375,365 C375,320 290,320 290,270',true,'a')}${line('M625,365 C625,305 700,320 700,270',false,'b')}${line('M865,365 C865,310 790,320 790,270',true,'b')}${line('M750,270 C750,475 650,455 570,490',false,'b')}${line('M250,270 C250,475 350,455 430,490',true,'a')}
  <text x="500" y="146" text-anchor="middle" fill="#92aeb7" font-size="12">함께 검토하는 두 가설</text>
  ${GRAPH_NODES.map(n=>`<g class="graph-node ${n.cls||''} ${state.node===n.id?'selected':''}" data-node="${n.id}" role="button" tabindex="0" aria-label="${E(n.kind+' '+n.lines.join(' '))}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6"/><text class="node-kind" x="${n.x+n.w/2}" y="${n.y+20}" text-anchor="middle">${n.kind}</text><text x="${n.x+n.w/2}" y="${n.y+43}" text-anchor="middle">${n.lines.map((t,i)=>`<tspan x="${n.x+n.w/2}" dy="${i?21:0}">${t}</tspan>`).join('')}</text></g>`).join('')}</svg>`;
}
function renderStep2() {
  return head('심화',2,'주장과 근거를 연결하면 반론이 남습니다','연결된 노드를 눌러 원문, 해석, 추가로 필요한 자료를 구분해 보세요.','demo')+
  `<div class="toolbar">${segmented([['graph','논증 지도'],['people','기록 속 인물']],state.evidenceMode,'evidence-mode')}<span class="note">자동 추론 결과가 아닌, 출처를 연결한 연구자의 구조도</span></div><div id="evidence-workspace">${state.evidenceMode==='graph'?`<div class="graph-layout"><div class="graph-stage">${graphSVG()}<div class="graph-caption">실선: 채록본에 연결된 발언　 ·　 점선: 추가 검증이 필요한 연결</div></div><aside class="panel detail-card" id="graph-detail"></aside></div>`:loading('공개 연구 데이터의 인물 기록을 불러옵니다…')}</div>`+nextStep(3,'한 사람의 발언에서 기록 전체의 어휘와 분포로 시야를 넓힙니다.');
}
function showGraphDetail(id) {
  state.node=id;const d=GRAPH_DETAIL[id];if(!d||!$('#graph-detail'))return;
  $$('[data-node]').forEach(n=>n.classList.toggle('selected',n.dataset.node===id));
  $('#graph-detail').innerHTML=`<div class="detail-type">${d.type}</div><h2>${d.title}</h2><p>${d.text}</p><ul class="evidence-list">${d.sources.filter(id=>sourceBlock(id)).map(id=>`<li><b>공개 채록본 ${id}</b><button class="btn outline small" data-source="${id}">원문 문맥 확인 ↗</button></li>`).join('')}</ul><button class="btn small" data-step="5">조사 규칙으로 시험해 보기 ↗</button>`;
}
async function renderPeople() {
  const gen=generation;
  try{const data=await getIncidents('CHL');if(gen!==generation||state.evidenceMode!=='people')return;
    $('#evidence-workspace').innerHTML=`<div class="toolbar"><div><b>${fmt(data.count)}개의 인물·사건 기록</b><p class="note">Freire 외(2019)의 레티그 보고서 재부호화 인물 기록 전체 · 좌표 없는 기록 포함</p></div><form class="search-form" id="person-search"><input aria-label="기록 속 인물 이름 검색" placeholder="이름 검색"><button class="btn small">찾기</button></form></div><div class="person-grid" id="people-grid"></div><p class="note" id="people-count" style="margin-top:15px"></p>`;
    const draw=term=>{const rows=data.rows.filter(r=>!term||r.victim_or_site_name.toLowerCase().includes(term.toLowerCase()));$('#people-grid').innerHTML=rows.slice(0,12).map(r=>`<button class="person-card" data-record="${E(r.incident_id)}"><span class="source-label">${E(r.source_page||'쪽수 미상')}</span><span class="person-name">${E(r.victim_or_site_name)}</span><p>${E(r.date_display||r.event_date||'날짜 미상')} · ${r.age?`${r.age}세`:'나이 미상'}<br>${E(r.occupation||'직업 미상')}</p></button>`).join('') || '<div class="empty-state">검색 결과가 없습니다.</div>';$('#people-count').textContent=`검색 결과 ${fmt(rows.length)}건 중 ${Math.min(12,rows.length)}건 표시 · 이름을 누르면 원자료 정보를 확인합니다.`;$$('[data-record]').forEach(b=>b.onclick=()=>showRecord(data.rows.find(r=>r.incident_id===b.dataset.record)));};
    draw('');$('#person-search').onsubmit=e=>{e.preventDefault();draw($('input',e.currentTarget).value.trim());};
  }catch(e){if(gen===generation)$('#evidence-workspace').innerHTML=failure(e.message);}
}
function bindStep2(){ $$('[data-evidence-mode]').forEach(b=>b.onclick=()=>{state.evidenceMode=b.dataset.evidenceMode;renderCurrent(false);});if(state.evidenceMode==='graph'){showGraphDetail(state.node);$$('[data-node]').forEach(n=>{n.onclick=()=>showGraphDetail(n.dataset.node);n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showGraphDetail(n.dataset.node);}};});}else renderPeople(); }

function renderStep3(){
  return head('확대',3,'읽은 인상을 직접 세어봅니다','낱말과 사건을 세고, 숫자에서 다시 원문으로 돌아갑니다.','dataset')+
    `<div class="toolbar">${segmented([['lecture','강연록의 어휘 관계'],['timeline','칠레 사건의 시간 분포']],state.textMode,'text-mode')}<span class="note">실제 불러온 자료만 집계합니다.</span></div><div id="analysis-workspace">${state.textMode==='lecture'?renderTextAnalysis():loading()}</div>`+
    `<details class="method-details"><summary>기존 ‘국회회의록 78년 분석’은 어디에 있나요?</summary><p>기존 DB의 해당 코퍼스는 원문 수집 결과가 확인되지 않은 구성 예문 9건입니다. 따라서 발언 4,991건, 유사도, ‘26년 침묵’, AI 평가율을 실측 결과로 제시하지 않습니다. 여기서는 공개 강연 채록본의 문자열을 직접 세고, 칠레 연구 데이터의 날짜별 분포를 집계합니다. 새로운 원자료가 연결되면 같은 방법을 확장할 수 있습니다.</p></details>`+nextStep(4,'시간 분포에서 선택한 기록을 지도 위의 장소와 연결합니다.');
}
function activeBlocks(){const parts=splitLecture(lecture.blocks);return state.scope==='body'?parts.body:state.scope==='qa'?parts.qa:lecture.blocks;}
function termNetwork(analysis){
  if(!analysis.hits.length)return '<div class="empty-state"><b>이 범위에 해당 낱말이 없습니다.</b>검색어 또는 자료 범위를 바꿔보세요.</div>';
  const neighbors=analysis.neighbors.slice(0,8), max=Math.max(...neighbors.map(x=>x.count),1);
  return `<svg viewBox="0 0 760 440" aria-label="${E(state.term)}와 같은 문단에 등장한 낱말의 연결망"><defs><radialGradient id="network-fade"><stop stop-color="#117d7612"/><stop offset="1" stop-color="#117d7600"/></radialGradient></defs><circle cx="380" cy="200" r="190" fill="url(#network-fade)"/>
    ${neighbors.map((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/neighbors.length,x=380+Math.cos(a)*255,y=205+Math.sin(a)*145;return `<line x1="380" y1="205" x2="${x}" y2="${y}" stroke="#117d763a" stroke-width="${1+n.count/max*6}"/>`;}).join('')}
    <circle cx="380" cy="205" r="55" fill="#117d76"/><text x="380" y="202" text-anchor="middle" fill="white" font-size="23" font-weight="700">${E(state.term)}</text><text x="380" y="226" text-anchor="middle" fill="#c5f0de" font-size="11">${analysis.hits.length}개 문단</text>
    ${neighbors.map((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/neighbors.length,x=380+Math.cos(a)*255,y=205+Math.sin(a)*145,r=17+Math.sqrt(n.count/max)*14;return `<g role="button" tabindex="0" data-term="${E(n.word)}" aria-label="${E(n.word)} · 동시 등장 ${n.count}개 문단" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${r}" fill="#dbe9dd" stroke="#117d7640"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="#117d76" font-size="14" font-weight="700">${n.count}</text><text x="${x}" y="${y+r+23}" text-anchor="middle" fill="#1f3941" font-size="16" font-weight="650">${n.word}</text></g>`;}).join('')}</svg>`;
}
function renderTextAnalysis(){
  const analysis=analyzeText(activeBlocks(),state.term), parts=splitLecture(lecture.blocks), body=analyzeText(parts.body,state.term),qa=analyzeText(parts.qa,state.term),max=Math.max(body.hits.length/Math.max(body.documents,1),qa.hits.length/Math.max(qa.documents,1),0.001);
  return `<div class="toolbar">${segmented([['all','전체'],['body','강연 본문'],['qa','질의응답']],state.scope,'scope')}<form class="search-form" id="term-search"><input aria-label="분석할 낱말" placeholder="분석할 낱말" maxlength="16" value="${E(state.term)}"><button class="btn small">세어보기</button></form></div>
    <div class="chart-layout"><div class="viz-panel"><div class="chart-title">같은 문단에서 만나는 낱말</div><p class="note">선이 굵을수록 함께 나타나는 문단이 많습니다. 이웃 낱말을 눌러 탐색하세요.</p>${termNetwork(analysis)}<div class="term-pills">${['조사','명단','신청','사면','화해','기억'].map(t=>`<button data-term="${t}" class="${t===state.term?'active':''}">${t}</button>`).join('')}</div></div>
    <aside class="panel dark"><div class="panel-title"><b>‘${E(state.term)}’의 흔적</b><span>현재 선택 범위</span></div><div class="stat-display">${fmt(analysis.occurrences)}<small style="font-size:17px;margin-left:7px">회</small></div><div class="stat-caption">${analysis.documents}개 문단 중 ${analysis.hits.length}개 문단에서 등장</div><div class="mini-bars">${[['강연 본문',body],['질의응답',qa]].map(([label,d])=>`<div class="mini-bar-row"><div><span>${label}</span><b>${d.hits.length} / ${d.documents}개 문단 (${(d.hits.length/Math.max(d.documents,1)*100).toFixed(1)}%)</b></div><span><i style="width:${d.hits.length/Math.max(d.documents,1)/max*100}%"></i></span></div>`).join('')}</div><p class="inset-note">같은 낱말도 발화 맥락이 다를 수 있습니다. 아래 원문을 읽고, 이 연결이 같은 의미인지 판단해 보세요.</p><p class="note" style="margin-top:20px">방법 · 단순 문자열 포함 횟수와 문단 단위 동시 등장 수를 계산합니다. 형태소 분석·의미 벡터·인과 분석 결과가 아닙니다.</p></aside></div>
    <div class="hit-list"><div class="chart-title">숫자에서 원문으로 <span class="muted" style="font-weight:400;font-size:12px">· ${analysis.hits.length}개 일치 문단 중 ${Math.min(8,analysis.hits.length)}개 표시</span></div>${analysis.hits.slice(0,8).map(b=>`<button class="hit" data-source="${b.id}"><span class="source-label">${b.id} · ${b.occurrences}회 등장</span><p>${highlight(paragraphExcerpt(b.text,state.term),state.term)}</p></button>`).join('')}</div>`;
}
function bindTextAnalysis(){
  $$('[data-scope]').forEach(b=>b.onclick=()=>{state.scope=b.dataset.scope;drawText();});
  $$('[data-term]').forEach(b=>{const choose=()=>{state.term=b.dataset.term;drawText();};b.onclick=choose;b.onkeydown=e=>{if(e.key==='Enter'&&b.tagName.toLowerCase()==='g')choose();};});
  $('#term-search').onsubmit=e=>{e.preventDefault();const value=$('input',e.currentTarget).value.trim();if(!value){toast('낱말을 입력해 주세요.');return;}state.term=value;drawText();};
}
function drawText(){$('#analysis-workspace').innerHTML=renderTextAnalysis();bindTextAnalysis();}
function barsSVG(entries,selected){
  const width=900,height=380,left=55,right=20,top=30,bottom=55,max=Math.max(...entries.map(d=>d.count),1),plotW=width-left-right,plotH=height-top-bottom,slot=plotW/Math.max(entries.length,1);
  return `<svg viewBox="0 0 ${width} ${height}" aria-label="연도별 인물 기록 수">${[0,.25,.5,.75,1].map(t=>`<line class="chart-grid" x1="${left}" y1="${top+plotH*(1-t)}" x2="${width-right}" y2="${top+plotH*(1-t)}"/><text class="chart-label" x="${left-10}" y="${top+plotH*(1-t)+4}" text-anchor="end">${fmt(Math.round(max*t))}</text>`).join('')}${entries.map((d,i)=>{const x=left+i*slot+slot*.15,y=top+plotH*(1-d.count/max),h=d.count/max*plotH;return `<g data-time-year="${d.year}" role="button" tabindex="0" aria-label="${d.year}년 ${d.count}건"><rect class="chart-bar ${d.year===selected?'selected':''}" x="${x}" y="${y}" width="${slot*.7}" height="${Math.max(h,2)}" rx="2"/><text class="chart-label" x="${x+slot*.35}" y="${height-30}" text-anchor="middle">${String(d.year).slice(2)}</text>${d.count===max?`<text class="chart-annotation" x="${x+slot*.35}" y="${Math.max(y-10,18)}" text-anchor="middle">${fmt(d.count)}</text>`:''}</g>`;}).join('')}<text class="chart-label" x="${width-right}" y="${height-6}" text-anchor="end">연도 (${entries[0]?.year||1973}–${entries.at(-1)?.year||1990})</text></svg>`;
}
async function renderTemporal(){
 const gen=generation,source=state.timelineSource;
 try{const data=await getIncidents('CHL',source);if(gen!==generation||state.textMode!=='timeline'||source!==state.timelineSource)return;const result=temporalCounts(data.rows),peak=[...result.entries].sort((a,b)=>b.count-a.count)[0];if(!result.entries.some(x=>x.year===state.timeYear))state.timeYear=peak?.year||1973;
 $('#analysis-workspace').innerHTML=`<div class="archive-source-row"><label class="archive-source-label">집계할 출처 <select id="timeline-source" aria-label="연도 집계 자료 출처"><option value="chile-pinochet-2019">Freire 연구 자료</option><option value="chile-mmdh-victims">MMDH 박물관 명부</option></select></label><a class="note" href="coverage-review.html" target="_blank" rel="noopener">두 자료의 범위 비교 ↗</a></div><div class="chart-layout"><div class="viz-panel"><div class="chart-title">${E(data.source)} · 연도별 인물 기록</div><p class="note">일·월·연도 중 알려진 범위로 집계합니다. 막대를 누르면 같은 출처와 연도로 지도에 연결됩니다.</p><div id="time-chart"></div></div><aside class="panel dark" id="time-detail"></aside></div><p class="note" style="margin-top:18px">출처 전체 ${fmt(result.total)}건 · 연도 확인 ${fmt(result.dated)}건 · 연도 미상 ${fmt(result.unknown)}건. 좌표 없는 기록도 포함합니다. 두 명부는 겹치므로 더해서 고유 희생자 수로 사용하지 않습니다. <a href="${E(data.source_url)}" target="_blank" rel="noopener">원자료 ↗</a></p>`;
 $('#timeline-source').value=source;$('#timeline-source').onchange=e=>{state.timelineSource=e.target.value;state.timeYear=null;renderTemporal();};
 const bindYears=()=>$$('[data-time-year]').forEach(b=>{b.onclick=()=>detail(b.dataset.timeYear);b.onkeydown=e=>{if(e.key==='Enter')detail(b.dataset.timeYear);};});
 const detail=year=>{state.timeYear=Number(year);const rows=data.rows.filter(r=>r.event_year===Number(year));$('#time-detail').innerHTML=`<div class="panel-title"><b>${year}년의 기록</b><span>출처별 실제 집계</span></div><div class="stat-display">${fmt(rows.length)}<small style="font-size:16px;margin-left:8px">건</small></div><p class="stat-caption">${E(data.source)} 안의 인물 기록</p><div class="timeline-insight">같은 기록을<br>지도에서 확인합니다</div><p class="note">개별 사건 수나 새로운 피해자 수로 바꾸어 읽지 않습니다. 날짜와 장소의 정밀도를 함께 확인하세요.</p><button class="btn gold small" id="year-to-map" style="margin-top:25px">${year}년 지도에서 보기 ↗</button>`;$('#time-chart').innerHTML=barsSVG(result.entries,Number(year));bindYears();$('#year-to-map').onclick=()=>{state.mapOptions={source,year:Number(year),allDates:false,includeUnknown:false,cumulative:false,view:'auto'};go(4);};};detail(state.timeYear);
 }catch(e){if(gen===generation)$('#analysis-workspace').innerHTML=failure(e.message);}
}
function bindStep3(){$$('[data-text-mode]').forEach(b=>b.onclick=()=>{state.textMode=b.dataset.textMode;renderCurrent(false);});if(state.textMode==='lecture')bindTextAnalysis();else renderTemporal();}

function recordHTML(r){return archiveRecordHTML(r);}
function showRecord(r){if(r)openDialog('원자료 기록의 근거',`<div class="map-detail">${recordHTML(r)}</div>`);}
function renderStep4(){return head('확대',4,'자료의 범위까지 함께 보는 역사 지도','출처를 선택하고, 연도·지역·좌표의 정밀도를 바꾸며 원자료를 확인하세요.','dataset')+archiveMapShell()+nextStep(5,'기록에 남은 분포와 기록 밖으로 빠지는 과정을 함께 질문합니다.');}
function bindStep4(){mapController=mountArchiveMap({options:state.mapOptions,getData:getIncidents,getJSON,apiBase:API_BASE,onMap:m=>{map=m;},onState:s=>{state.mapEvidence=s;}});}

function renderStep5(){
  if(!state.sim){state.sim=comparePolicies(state.simConfig,state.seed);state.week=26;}
  const sc=SCENARIOS[state.scenario];
  return head('확대',5,'같은 가상 집단에 다른 조사 규칙을 적용합니다','가정을 바꾸고 두 과정을 함께 재생해 보세요. 점 하나는 가상 기록 한 건입니다.','model')+
  `<div class="toolbar">${segmented(Object.entries(SCENARIOS).map(([id,s])=>[id,`${id} · ${s.name}`]),state.scenario,'scenario')}<span class="note">가상 기록 200건 · 실제 희생자 수 추정 아님</span></div>
  <div style="margin-bottom:18px"><b>${sc.topic}</b><p class="note">${sc.context}</p></div>
  <div class="simulation-workspace"><div class="abm-controls"><div><label for="sim-excluded">${sc.excludedLabel}<output id="sim-excluded-value">${state.simConfig.excluded}%</output></label><input id="sim-excluded" type="range" min="0" max="70" value="${state.simConfig.excluded}" aria-label="${sc.excludedLabel}"><small>누가 접수 단계에 들어오기 어려운가</small></div><div><label for="sim-barrier">증거 접근 장벽<output id="sim-barrier-value">${state.simConfig.barrier}%</output></label><input id="sim-barrier" type="range" min="0" max="100" value="${state.simConfig.barrier}" aria-label="증거 접근 장벽"><small>개별 자료 수집에 드는 시간을 달리 가정</small></div><div><label for="sim-capacity">주당 처리 한도<output id="sim-capacity-value">${state.simConfig.capacity}건</output></label><input id="sim-capacity" type="range" min="1" max="20" value="${state.simConfig.capacity}" aria-label="주당 처리 한도"><small>두 조사 방식에 같은 처리 한도를 적용</small></div></div>
  <div class="sim-visual"><div class="sim-toolbar"><div class="week"><b id="sim-week">${state.week}</b> <span>/ 52주</span></div><div class="row-actions"><button class="btn" id="sim-play" aria-pressed="false">▶ 처음부터 재생</button><button class="btn outline small" id="sim-end">52주 결과</button><button class="btn outline small" id="sim-new-cohort">다른 가상 집단</button></div></div>
  <div class="sim-pair">${[['baseline',sc.baseline],['alternative',sc.alternative]].map(([id,label])=>`<section class="sim-board ${id==='alternative'?'compare':''}"><div class="sim-board-head"><h2>${label}</h2><span class="source-label" style="color:#a7c6c7">동일한 200건</span></div><div class="sim-count"><span id="${id}-count">0</span><small>건의 기록이 편입됨</small></div><div class="agent-grid" id="${id}-grid" role="img" aria-label="가상 기록의 상태">${Array.from({length:200},(_,i)=>`<i class="agent state-0" data-agent="${i}"></i>`).join('')}</div><div class="sim-legend"><span><i style="background:var(--mint)"></i>편입 <b id="${id}-recorded">0</b></span><span><i style="background:var(--gold)"></i>대기 <b id="${id}-waiting">0</b></span><span><i style="background:#4c636c"></i>접수 밖 <b id="${id}-outside">200</b></span></div></section>`).join('')}</div>
  </div></div><div class="sim-comparison"><div class="sim-insight"><div class="eyebrow">현재 가정에서의 차이</div><strong id="sim-difference"></strong><p id="sim-interpretation"></p><button class="btn outline small" id="sim-export" style="margin-top:15px">가정과 결과 JSON 저장 ↓</button></div><div class="viz-panel"><div class="chart-title">시간에 따라 기록에 들어오는 과정</div><div id="sim-chart"></div><div class="legend"><span><i style="background:var(--amber)"></i>${sc.baseline}</span><span><i style="background:var(--teal)"></i>${sc.alternative}</span></div></div></div>
  <details class="method-details"><summary>누가 만든 규칙이며, 무엇을 시험하나요?</summary><p>실제 사람이나 희생자 총수를 입력한 모형이 아닙니다. 고정된 난수 씨앗으로 가상 기록 200건을 만들고, 각 기록에 신청 가능 여부·자료 접근·신청 시점을 부여합니다. 매주 접수, 자료 대기, 한도 내 처리를 순서대로 진행합니다. 대안 방식에서는 명단 연계나 이동 조사가 접수와 증거 수집을 돕는다고 가정합니다. 두 방식의 집단과 주당 처리 한도는 같습니다. 계수는 실증 추정치가 아니며, 가정을 바꾸며 검증할 연구 질문을 찾기 위한 교육용 과정 모형입니다.</p><p>현재 난수 씨앗: <span id="sim-seed">${state.seed}</span>. 결과를 역사적 인과 효과나 실제 조사 성과로 해석할 수 없습니다.</p></details>`+nextStep(6,'사료의 근거와 모형의 가정을 보존한 채 교육·전시 자료로 옮깁니다.');
}
function modelChart(){const w=670,h=220,l=32,r=15,t=15,b=35,pw=w-l-r,ph=h-t-b;const path=history=>history.slice(0,state.week+1).map((d,i)=>`${i?'L':'M'}${l+d.week/52*pw},${t+ph-d.recorded/200*ph}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" aria-label="가상 조사 진행에 따른 기록 편입 수">${[0,100,200].map(v=>`<line class="chart-grid" x1="${l}" x2="${w-r}" y1="${t+ph-v/200*ph}" y2="${t+ph-v/200*ph}"/><text class="chart-label" x="${l-6}" y="${t+ph-v/200*ph+4}" text-anchor="end">${v}</text>`).join('')}<path d="${path(state.sim.baseline)}" stroke="#bd7f30" stroke-width="3" fill="none"/><path d="${path(state.sim.alternative)}" stroke="#117d76" stroke-width="3" fill="none"/>${[0,13,26,39,52].map(v=>`<text class="chart-label" x="${l+v/52*pw}" y="${h-10}" text-anchor="middle">${v}주</text>`).join('')}<line x1="${l+state.week/52*pw}" x2="${l+state.week/52*pw}" y1="${t}" y2="${h-b}" stroke="#708184" stroke-dasharray="3 5"/></svg>`;}
function drawSimulation(){
  $('#sim-week').textContent=state.week;
  for(const key of ['baseline','alternative']){const snap=state.sim[key][state.week];$(`#${key}-count`).textContent=snap.recorded;for(const field of ['recorded','waiting','outside'])$(`#${key}-${field}`).textContent=snap[field];$$('.agent',$(`#${key}-grid`)).forEach((dot,i)=>{dot.className=`agent state-${snap.states[i]}`;dot.title=`가상 기록 ${i+1}: ${['접수 밖','조사 대기','기록 편입'][snap.states[i]]}`;});$(`#${key}-grid`).setAttribute('aria-label',`가상 기록 200건 중 편입 ${snap.recorded}, 대기 ${snap.waiting}, 접수 밖 ${snap.outside}`);}
  const delta=state.sim.alternative[state.week].recorded-state.sim.baseline[state.week].recorded;
  $('#sim-difference').textContent=`${delta>=0?'+':''}${delta}건 · ${state.week}주차`;
  $('#sim-interpretation').textContent='이 차이는 현재 가정과 가상 집단에서 계산한 결과입니다. 현장에서는 어떤 명단과 자료, 절차가 이 차이를 만들지 검증해야 합니다.';
  $('#sim-chart').innerHTML=modelChart();
}
function stopSimulation(){if(simTimer){clearInterval(simTimer);simTimer=null;}if($('#sim-play')){$('#sim-play').textContent='▶ 처음부터 재생';$('#sim-play').setAttribute('aria-pressed','false');}}
function bindStep5(){drawSimulation();$$('[data-scenario]').forEach(b=>b.onclick=()=>{state.scenario=b.dataset.scenario;const sc=SCENARIOS[state.scenario];state.simConfig={excluded:sc.default[0],barrier:sc.default[1],capacity:sc.default[2]};state.sim=null;renderCurrent(false);});
  for(const key of ['excluded','barrier','capacity'])$(`#sim-${key}`).oninput=e=>{stopSimulation();state.simConfig[key]=Number(e.target.value);$(`#sim-${key}-value`).textContent=e.target.value+(key==='capacity'?'건':'%');state.sim=comparePolicies(state.simConfig,state.seed);state.week=26;drawSimulation();};
  $('#sim-play').onclick=()=>{if(simTimer){stopSimulation();return;}state.week=0;drawSimulation();$('#sim-play').textContent='Ⅱ 재생 멈춤';$('#sim-play').setAttribute('aria-pressed','true');simTimer=setInterval(()=>{state.week++;drawSimulation();if(state.week>=52)stopSimulation();},180);};
  $('#sim-end').onclick=()=>{stopSimulation();state.week=52;drawSimulation();};
  $('#sim-new-cohort').onclick=()=>{stopSimulation();state.seed++;state.sim=comparePolicies(state.simConfig,state.seed);state.week=26;$('#sim-seed').textContent=state.seed;drawSimulation();toast('같은 규칙을 다른 가상 집단에 적용했습니다.');};
  $('#sim-export').onclick=()=>download(JSON.stringify(simulationRecord(),null,2),'trc-investigation-model.json','application/json');
}
function simulationRecord(){return {type:'synthetic_educational_process_model',not_historical_estimate:true,scenario:state.scenario,seed:state.seed,cohort_size:200,week:state.week,assumptions:state.simConfig,baseline:state.sim?.baseline[state.week],alternative:state.sim?.alternative[state.week],rules:'주별 접수·자료 대기·동일 처리 한도. 대안의 명단 연계·지원 효과는 가정이며 실증 계수가 아님.'};}

const AUDIENCES={
  public:{name:'대국민 카드',headline:'명단은 있는데,\n왜 다시 입증해야 할까?',body:'과거사 조사 지연을 이해하려면 자료의 제약과 조사 방식의 병목을 함께 살펴야 합니다. 현장의 질문이 새로운 연구의 출발점이 됩니다.',format:'카드와 근거 기록'},
  curator:{name:'전시·다큐 고증 시트',headline:'기억의 전시와\n그 뒤에 남는 근거',body:'전시 사진, 강연의 원문, 연구자의 해석을 구분해 제작자가 다시 확인할 수 있도록 정리합니다.',format:'사진·출처·판정 유보를 담은 고증 시트'},
  teacher:{name:'수업·리빙랩 교안',headline:'같은 기록을,\n다른 규칙으로 조사한다면',body:'가설을 세우고 원문을 읽은 뒤, 조사 모형의 조건을 바꾸며 무엇을 더 확인해야 하는지 토론합니다.',format:'학생 활동지와 실험 조건'}
};
const PHOTO_CAPTIONS={'image17.png':'칠레 기억과 인권 박물관의 전시','image18.png':'희생자 사진을 모은 기억의 벽','image19.png':'기억과 인권 박물관 현장 사진','image20.png':'과거와 책임에 관한 박물관의 전시 문구','image15.png':'한국전쟁 전후 민간인 희생 유해발굴 전시 설명'};
function photoCaption(p){return Object.entries(PHOTO_CAPTIONS).find(([key])=>p.src.endsWith(key))?.[1] || `강연자료 ${p.slide}번 슬라이드의 시각자료`;}
function selectedPhoto(){return photos[state.photo] || photos[0];}
function photoIndex(id){return photos.findIndex(p=>p.id===id);}
function renderStep6(){
  if(!state.photoGroup)state.photoGroup=21;
  if(!selectedPhoto()||selectedPhoto().slide!==state.photoGroup)state.photo=Math.max(0,photos.findIndex(p=>p.slide===state.photoGroup));
  const p=selectedPhoto();
  return head('산학화',6,'연구의 근거를 교육과 전시로 가져갑니다','원본 사진을 읽고 설명을 붙인 뒤, 근거가 함께 남는 제작 자료를 내려받으세요.')+
  `<div class="toolbar">${segmented([[21,'칠레 · 기억의 전시'],[16,'한국 · 유해발굴'],[15,'한국 · 역사 사진'],[12,'칠레 · 시각자료']],state.photoGroup,'photo-group')}<span class="source-pill">사용자 제공 PPTX · 원본 사진</span></div>
  <div class="photo-layout"><div><figure class="photo-viewer"><button class="photo-button" id="photo-enlarge" aria-label="원본 사진 크게 보기"><img id="main-photo" src="${p.src}" alt="${E(photoCaption(p))}" decoding="async"></button><figcaption id="photo-caption">${photoCaption(p)}<small>박구병 강연자료 · 슬라이드 ${p.slide} · 원본 ${p.width} × ${p.height}px · 클릭하면 확대</small></figcaption></figure><div class="photo-thumbs" id="photo-thumbs">${photos.filter(x=>x.slide===state.photoGroup).map((x,i)=>`<button data-photo-id="${x.id}" class="${x.id===p.id?'active':''}" aria-label="${E(photoCaption(x))}, 사진 ${i+1}"><img src="${x.src}" alt="" loading="lazy"><small>사진 ${i+1}</small></button>`).join('')}</div></div>
  <aside class="panel"><div class="eyebrow">비문자 사료의 읽기</div><h2 style="font-size:27px;line-height:1.5">사진은 무엇을 보여주고,<br>무엇을 말해주지 않을까?</h2><p class="note" style="margin:18px 0">대상, 촬영 맥락, 사진 속 문구를 구별해 관찰해 보세요. 사진의 유사성만으로 같은 역사적 의미나 인과를 추정하지 않습니다.</p><div class="field"><label for="photo-note">사진을 읽으며 남기는 관찰과 질문</label><textarea id="photo-note" maxlength="1200" placeholder="예: 전시된 개인 사진은 사건 통계와 다른 무엇을 보여주는가?">${E(annotations['photo-'+p.id]?.note||'')}</textarea></div><p class="image-credit" id="photo-note-status">이 브라우저에 저장하며 제작 자료에 함께 포함합니다.</p><a class="btn outline small" id="photo-download" href="${p.src}" download style="margin-top:17px">원본 사진 저장 ↓</a><div class="credits-block"><b>자료의 경계</b><p class="note">이 사진은 제공된 강연 PPTX에서 추출했습니다. 원촬영자·촬영일 등 추가 메타데이터는 확인이 필요합니다. 음원은 연결되어 있지 않아, 가상의 파형이나 측정값을 표시하지 않습니다.</p></div></aside></div>
  <section class="publication-area"><h2>같은 연구를, 다른 독자에게</h2><p>연구자 판단과 출처를 남긴 편집 템플릿입니다. 실제로 사용할 파일을 생성합니다.</p><div class="toolbar">${segmented(Object.entries(AUDIENCES).map(([id,a])=>[id,a.name]),state.audience,'audience')}<span class="note">사실·해석·모형의 가정을 함께 전달</span></div><div class="publication-layout"><div class="panel"><div class="field"><label for="package-headline">제목 <span class="muted">직접 수정 · 60자 이내</span></label><textarea id="package-headline" maxlength="60" style="min-height:75px">${E((state.drafts?.[state.audience]||AUDIENCES[state.audience]).headline)}</textarea></div><div class="field" style="margin-top:15px"><label for="package-body">독자에게 전할 설명 (180자 이내)</label><textarea id="package-body" maxlength="180">${E((state.drafts?.[state.audience]||AUDIENCES[state.audience]).body)}</textarea></div><div class="credits-block"><b>함께 남기는 근거</b><ul class="rule-list"><li>공개 강연록의 정지석 질의와 박구병 응답</li><li>선택한 사진의 원본 PPTX 슬라이드 번호</li><li>이 세션에서 남긴 사료비판·사진 관찰 기록</li><li>조사 모형을 사용했다면 가정·난수 씨앗·결과</li></ul></div><div class="export-actions"><button class="btn" id="export-html">제작 자료 HTML ↓</button><button class="btn outline" id="export-md">Markdown ↓</button><button class="btn outline" id="export-json">근거 JSON ↓</button><button class="btn outline" id="export-png">카드 PNG ↓</button></div><p class="package-source">교육·전시·다큐 제작자가 사실을 다시 확인하고 수정할 수 있도록 출처를 동봉합니다. 실제 기관의 공식 승인이나 사업화 성과를 뜻하지 않습니다.</p></div><div class="publication-preview" id="publication-preview"></div></div></section>`;
}
function currentDraft(){return state.drafts?.[state.audience] || AUDIENCES[state.audience];}
function publicPreview(){const p=selectedPhoto(),d=currentDraft();if(state.audience==='curator')return `<div class="eyebrow">전시·다큐 고증 시트</div><h3 style="font-size:25px;margin-bottom:18px;white-space:pre-line">${E(d.headline)}</h3><img src="${p.src}" alt="선택한 원본 사진" style="max-height:230px;width:100%;object-fit:contain;background:#0c1b2a"><div class="credits-block"><b>${photoCaption(p)}</b><p class="note">${E(d.body)}</p></div><dl style="font-size:12px"><dt><b>원자료</b></dt><dd>박구병 강연 PPTX · 슬라이드 ${p.slide}</dd><dt><b>논쟁의 위치</b></dt><dd>공개 채록본 p212·p213·p216</dd><dt><b>추가 확인</b></dt><dd>원촬영자·촬영일·사진 속 개별 사료의 원출처</dd></dl>`;
  if(state.audience==='teacher')return `<div class="eyebrow">디지털 역사학 리빙랩</div><h3 style="font-size:26px;white-space:pre-line;margin-bottom:15px">${E(d.headline)}</h3><p class="note">${E(d.body)}</p><div class="credits-block"><b>01 · 원문을 읽기</b><p class="note">명단과 개별 입증에 관한 질의(p212)와 응답(p216)을 읽고, 발언과 자신의 해석을 구분하세요.</p></div><div class="credits-block"><b>02 · 가정을 시험하기</b><p class="note">가상 집단은 고정하고 접수 장벽이나 조사 역량 한 가지만 바꾸세요. 어떤 차이가 생겼나요?</p></div><div class="credits-block"><b>03 · 반증 자료 찾기</b><p class="note">이 모형의 예상이 현장에서도 맞는지 확인하려면 어떤 기록이 필요할까요? 두 가지를 제안하세요.</p></div><div style="height:50px;border-bottom:1px solid var(--line);margin-bottom:18px"></div><small class="muted">모형의 결과를 실제 역사적 효과와 구분해 논증합니다.</small>`;
  return `<div class="public-card"><img src="${p.src}" alt="${E(photoCaption(p))}"><div class="public-card-copy"><div class="eyebrow">진실·화해의 기록을 다시 읽기</div><h3>${E(d.headline)}</h3><p>${E(d.body)}</p><small>연구자 요약 · 박구병 강연 채록 §9<br>사진: 제공된 강연자료 슬라이드 ${p.slide}</small></div></div><div class="package-source"><b>근거가 함께 가는 카드</b><br>이 설명은 현장 질의에서 구성한 연구 질문입니다. 조사 지연의 원인이나 제도 변경의 효과가 확정됐다는 뜻이 아닙니다.<br><a href="${SOURCE_URL}" target="_blank" rel="noopener">공개 채록본 확인 ↗</a></div>`;
}
function updatePhoto(id){const idx=photoIndex(id);if(idx<0)return;state.photo=idx;const p=selectedPhoto();$('#main-photo').src=p.src;$('#main-photo').alt=photoCaption(p);$('#photo-caption').innerHTML=`${photoCaption(p)}<small>박구병 강연자료 · 슬라이드 ${p.slide} · 원본 ${p.width} × ${p.height}px · 클릭하면 확대</small>`;$$('[data-photo-id]').forEach(b=>b.classList.toggle('active',b.dataset.photoId===id));$('#photo-download').href=p.src;$('#photo-note').value=annotations['photo-'+p.id]?.note||'';$('#publication-preview').innerHTML=publicPreview();}
function bindStep6(){
  $('#publication-preview').innerHTML=publicPreview();
  $$('[data-photo-group]').forEach(b=>b.onclick=()=>{state.photoGroup=Number(b.dataset.photoGroup);renderCurrent(false);});
  $$('[data-photo-id]').forEach(b=>b.onclick=()=>updatePhoto(b.dataset.photoId));
  $('#photo-enlarge').onclick=()=>{const p=selectedPhoto();openDialog(`${photoCaption(p)} · 원본 사진`,`<img src="${p.src}" alt="${E(photoCaption(p))}"><p class="note">박구병 강연자료 슬라이드 ${p.slide}에서 추출 · ${p.width} × ${p.height}px<br>원본의 구도와 내용은 보존했습니다.</p>`);};
  $('#photo-note').oninput=e=>{annotations['photo-'+selectedPhoto().id]={note:e.target.value,photo:selectedPhoto(),updated:new Date().toISOString()};try{localStorage.setItem('trc-research-judgements-v2',JSON.stringify(annotations));$('#photo-note-status').textContent='관찰 기록을 저장했습니다.';}catch{$('#photo-note-status').textContent='현재 세션에서만 유지합니다.';}};
  $$('[data-audience]').forEach(b=>b.onclick=()=>{state.audience=b.dataset.audience;renderCurrent(false);});
  const edit=()=>{state.drafts ||= {};state.drafts[state.audience]={headline:$('#package-headline').value,body:$('#package-body').value};$('#publication-preview').innerHTML=publicPreview();};$('#package-headline').oninput=edit;$('#package-body').oninput=edit;
  $('#export-json').onclick=()=>download(JSON.stringify(makePackage(),null,2),`trc-${state.audience}-evidence.json`,'application/json');
  $('#export-md').onclick=()=>download(packageMarkdown(),`trc-${state.audience}.md`,'text/markdown;charset=utf-8');
  $('#export-html').onclick=exportHTML;$('#export-png').onclick=exportPNG;
}
const TEACHING_ACTIVITIES=[{title:'원문을 읽기',task:'명단과 개별 입증에 관한 질의(p212)와 응답(p216)을 읽고, 사료의 발언과 자신의 해석을 구분하세요.'},{title:'가정을 시험하기',task:'동일한 가상 집단에서 접수 장벽이나 조사 역량 한 가지만 바꾸세요. 어떤 차이가 생겼는지 가정과 결과를 기록하세요.'},{title:'반증 자료 찾기',task:'모형의 예상이 현장에서도 맞는지 확인하려면 어떤 기록이 필요할까요? 두 가지를 제안하세요. 모형의 결과와 실제 역사적 효과를 구분해 논증하세요.'}];
function makePackage(){const p=selectedPhoto(),draft=currentDraft();return {'@context':{'schema':'https://schema.org/'},'@type':'schema:CreativeWork',version:APP_VERSION,created:new Date().toISOString(),audience:state.audience,title:draft.headline,description:draft.body,teaching_activities:state.audience==='teacher'?TEACHING_ACTIVITIES:null,curation_sheet:state.audience==='curator'?{source_slide:p.slide,photo_observation:annotations['photo-'+p.id]?.note||'',pending_metadata:['원촬영자','촬영일','사진 속 개별 사료의 원출처']}:null,editorial_status:'연구자가 편집한 교육·제작 자료',photo:{...p,url:new URL(p.src,location.href).href,caption:photoCaption(p),original_metadata_status:'원촬영자·촬영일 확인 필요'},source_references:[{url:SOURCE_URL,paragraphs:['p212','p213','p216'],kind:'공개 강연 편집 채록본',text_is_edited_transcript:true},{url:DATASET_URL,kind:'공개 연구 데이터'},{url:DOJ_URL,kind:'남아공 법무부 2000-11-01 집계'}],judgements:annotations,map_selection:state.mapEvidence||null,simulation:state.sim?simulationRecord():null,reserved:'질의응답에서 제기한 가설의 인과 효과, 미수집 조사 기간·대기 기록, 사진의 원촬영 메타데이터는 추가 확인 필요. 모형의 결과는 실제 역사적 수치가 아닙니다.'};}
function packageMarkdown(){const p=makePackage();const tasks=p.teaching_activities?`## 학생 활동\n\n${p.teaching_activities.map((a,i)=>`${i+1}. ${a.title}: ${a.task}`).join('\n\n')}\n\n`:'';return `# ${p.title.replace(/\n/g,' ')}\n\n${p.description}\n\n${tasks}## 사진\n\n${p.photo.caption}\n\n박구병 강연자료 원본 PPTX, 슬라이드 ${p.photo.slide}. 원본 크기 ${p.photo.width} × ${p.photo.height}px.\n\n사진 파일: ${p.photo.url}\n\n## 근거\n\n- 공개 강연 편집 채록본: ${SOURCE_URL}\n- 확인할 문단: p212, p213, p216\n- 연구 데이터: ${DATASET_URL}\n- 남아공 사면 집계표 (2000.11.01): ${DOJ_URL}\n\n## 연구자 판단 기록\n\n${JSON.stringify(p.judgements,null,2)}\n\n## 조사 모형\n\n${p.simulation?JSON.stringify(p.simulation,null,2):'이 제작 세션에서는 조사 모형을 사용하지 않았습니다.'}\n\n## 지도 선택과 자료 범위\n\n${p.map_selection?JSON.stringify(p.map_selection,null,2):'이 제작 세션에서는 지도를 선택하지 않았습니다.'}\n\n## 판정 유보\n\n${p.reserved}\n\n워크벤치 ${APP_VERSION} / ${p.created}\n`;}
async function imageDataURL(src){const blob=await(await fetch(src)).blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
async function exportHTML(){const button=$('#export-html');button.disabled=true;try{const p=makePackage(),img=await imageDataURL(selectedPhoto().src),preview=document.createElement('div');preview.innerHTML=publicPreview();$$('img',preview).forEach(x=>x.src=img);const body=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(p.title.replace(/\n/g,' '))}</title><style>body{font-family:system-ui,'Malgun Gothic',sans-serif;background:#f4f1e9;color:#172c35;line-height:1.8;max-width:860px;margin:35px auto;padding:25px}h1,h2,h3{line-height:1.5;white-space:pre-line}img{max-width:100%;max-height:550px;object-fit:contain}a{color:#117d76}.eyebrow{font-size:12px;color:#96651d}.public-card{position:relative;background:#0c1b2a;color:#fff;padding:30px}.public-card>img{max-height:320px;width:100%;object-fit:cover}.public-card-copy h3{font-size:32px}.credits-block{border-top:1px solid #d8dcd5;padding-top:15px;margin-top:15px}.note,.package-source{font-size:13px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:#fff;padding:20px}dd{margin-left:0}.source-label{font-size:11px}@media print{body{margin:0;padding:0;background:white}.public-card{-webkit-print-color-adjust:exact;print-color-adjust:exact}pre{font-size:9px}}</style><main>${preview.innerHTML}<hr><h2>근거와 판단 기록</h2><p>공개 강연 편집 채록본: <a href="${SOURCE_URL}">${SOURCE_URL}</a><br>문단 p212·p213·p216 / 사진: 강연 PPTX 슬라이드 ${p.photo.slide}</p><p>${E(p.reserved)}</p><details><summary>기계 판독 가능한 근거 기록</summary><pre>${E(JSON.stringify(p,null,2))}</pre></details><p>워크벤치 ${APP_VERSION} / ${E(p.created)}</p></main></html>`;download(body,`trc-${state.audience}.html`,'text/html;charset=utf-8');}catch(e){toast('파일을 만들지 못했습니다: '+e.message);}finally{button.disabled=false;}}
function wrapCanvas(ctx,text,width){const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);}return lines;}
async function exportPNG(){
  const button=$('#export-png');button.disabled=true;
  try{
    await document.fonts.ready;
    const p=selectedPhoto(),d=currentDraft(),canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1400;
    const ctx=canvas.getContext('2d'),img=new Image();img.src=p.src;await img.decode();
    ctx.fillStyle='#0c1b2a';ctx.fillRect(0,0,1400,1400);
    const ratio=Math.max(1400/img.width,850/img.height);ctx.globalAlpha=.62;ctx.drawImage(img,(1400-img.width*ratio)/2,0,img.width*ratio,img.height*ratio);ctx.globalAlpha=1;
    const grad=ctx.createLinearGradient(0,200,0,1400);grad.addColorStop(0,'#0c1b2a00');grad.addColorStop(.5,'#0c1b2ae0');grad.addColorStop(1,'#0c1b2a');ctx.fillStyle=grad;ctx.fillRect(0,0,1400,1400);
    ctx.fillStyle='#edbf73';ctx.font='600 25px Pretendard, sans-serif';ctx.fillText('진실·화해의 기록을 다시 읽기',85,780);
    let titleSize=65,titleLines;do{ctx.font=`750 ${titleSize}px Pretendard, sans-serif`;titleLines=wrapCanvas(ctx,d.headline,1230);if(titleLines.length*titleSize*1.28<=240)break;titleSize-=2;}while(titleSize>30);
    if(titleLines.length*titleSize*1.28>240)titleLines=wrapCanvas(ctx,d.headline.replace(/\n/g,' '),1230);
    ctx.fillStyle='#fffefa';let y=875;for(const line of titleLines){ctx.fillText(line,85,y);y+=titleSize*1.28;}
    y+=28;let bodySize=30,bodyLines;do{ctx.font=`${bodySize}px Pretendard, sans-serif`;bodyLines=wrapCanvas(ctx,d.body,1230);if(y+bodyLines.length*bodySize*1.55<1280)break;bodySize--;}while(bodySize>14);
    ctx.fillStyle='#c3d3d5';for(const line of bodyLines){ctx.fillText(line,85,y);y+=bodySize*1.55;}
    ctx.fillStyle='#92abb4';ctx.font='21px Pretendard, sans-serif';ctx.fillText(`연구자 요약 · 박구병 강연 채록 §9 / 사진: 원본 PPTX 슬라이드 ${p.slide}`,85,1318);ctx.fillText('출처·판정 유보 기록: trc.soohwalee.com',85,1358);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG 변환 실패');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`trc-${state.audience}-card.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('원본 사진을 포함한 PNG 카드를 저장했습니다. 근거 JSON도 함께 보관하세요.');
  }catch(e){toast('PNG를 만들지 못했습니다: '+e.message);}finally{button.disabled=false;}
}

function showMethods(){openDialog('자료와 방법',`<dl><dt>공개 강연 기록</dt><dd>박구병 교수의 2026.10.29 강연 편집 채록본 ${lecture.blocks.length}개 문단을 불러옵니다. 음원은 연결되어 있지 않습니다. <a href="${SOURCE_URL}" target="_blank" rel="noopener">원문</a></dd><dt>실제 연구 데이터</dt><dd>Freire 외(2019) 인물 기록 2,398건과 MMDH 공개 명부 3,216건, 제주 공식 지역별 유적 47곳과 소개 유적 25곳을 출처별로 읽습니다. 명부와 유적 목록은 서로 겹치므로 합산한 수를 고유 희생자 수로 사용하지 않습니다. 좌표 없는 기록과 날짜 정밀도도 보존합니다. 지도 숫자 원은 화면상 묶음 또는 원문 지역 집계입니다. 지역 대표점·현대 유적 참고 위치를 원자료의 사건 좌표와 구별합니다. <a href="coverage-review.html" target="_blank" rel="noopener">수집 범위 점검</a> <a href="${DATASET_URL}" target="_blank" rel="noopener">자료 설명</a></dd><dt>공식 통계의 대조</dt><dd>남아공 법무부의 2000.11.01 집계에서 신청 총수 7,112건과 허가 849건을 구별합니다. 해당 날짜의 집계이며 모든 시점의 최종 수치를 뜻하지 않습니다. <a href="${DOJ_URL}" target="_blank" rel="noopener">집계표</a></dd><dt>사진</dt><dd>사용자가 제공한 박구병 강연 원본 PPTX에서 사진을 추출했습니다. 슬라이드 번호와 원본 해상도를 표시하며, 사진 관찰과 역사적 해석을 구별합니다.</dd><dt>편집 구조와 모형</dt><dd>논증 지도는 연구자의 편집 구조도입니다. 조사 실험은 가상 기록 200건에 적용한 과정 모형이며 역사적 희생자 수나 정책 효과의 추정치가 아닙니다.</dd><dt>교정한 표시</dt><dd>기존 구성 예문의 발언 건수, 임베딩 좌표, 음성 휴지, 인물별 신뢰도 점수를 실제 분석 결과처럼 표시하지 않습니다. 좌표가 부정확하다고 의도적 은폐로 자동 분류하지 않습니다.</dd><dt>저장과 내보내기</dt><dd>연구자의 분류와 메모는 이 브라우저에 저장합니다. 내려받는 HTML·Markdown·JSON에는 출처, 판단, 모형의 가정이 포함됩니다. 워크벤치 ${APP_VERSION}.</dd></dl>`);}
function showPosterModal(){
  openDialog('짚인간(AI 에이전트) 양방향 사이버네틱스 포스터 회로',`<iframe class="poster-frame" src="poster-anim.html" title="짚인간 양방향 회로 포스터 애니메이션"></iframe><p class="note"><b>파란선(정방향 지휘):</b> 인문학자 머릿속의 시선·모델을 0비용 소프트웨어(오토마타)로 육화해 시각화·질의·시뮬레이션·산학화로 확장 · <b>주황선(역방향 2차 사이버네틱스):</b> 오토마타 검증 결과를 되돌려 내 시선과 모델을 재점검·보정(심화). <a href="poster-anim.html" target="_blank" rel="noopener">새 창 전체화면으로 열기 ↗</a></p>`);
}
function showCueSheet(){
  const rows=[
    ['12:00–12:12 (12분)','Part 1 · 문제제기와 인문학 재정의 (슬라이드 1–5)','00 테제 & 포스터 회로','인문학 = 머릿속의 시선과 모델. 서사 단일 채널에서 0비용 오토마타 채널로의 도약 선언',0],
    ['12:12–12:22 (10분)','Part 2 · 심화: 시선의 자가 보정 (슬라이드 6–8)','01 사료비판 · 02 증거 연결','박구병 강연 100% 채록 + 남아공 통계(7,112 vs 849) 분리 + 정지석 반론 병렬 그래프 시연',1],
    ['12:22–12:37 (15분)','Part 3 · 확대: 오토마타 서비스 (슬라이드 9–12)','03 멀리읽기 · 04 지도 · 05 실험','어휘 동시등장 계량 → 칠레·제주 5,686건 시공간 지도 → 200건 조사 규칙 비교 실험 시연',4],
    ['12:37–12:45 (8분)','Part 4 · 산학화 & 로그스케일 리더십 (슬라이드 13–16)','06 공공역사 제작 & 00 로그스케일','출처·판정유보 동봉 패키지 생성 + 체화된 인지·필멸성·AI 안경 시대 강심장 리더십 결어',6],
    ['12:45–13:00 (15분)','종합 토론 및 질의응답 (사회: 허수 교수)','질문별 해당 탭 즉시 호출','역사학부 교수진·연구자 질의에 실제 원문 문단(p048, p212 등)과 지도로 즉시 응답',2]
  ];
  openDialog('11월 18일(12:00–13:00) 슬라이드 ↔ 웹앱 60분 통합 진행 큐시트',`<p class="note">발표 중 우측 상단 <b>⛶ 발표 모드</b>(또는 단축키 <b>C</b>)를 켜면 상단에 현재 단계의 한 줄 핵심 메시지와 점프 바가 고정됩니다. 숫자키 <b>0~6</b>으로 즉시 화면을 전환할 수 있습니다.</p><table class="cue-table"><thead><tr><th>시간 (60분)</th><th>슬라이드 파트</th><th>웹앱 시연 화면</th><th>청중(역사학부) 핵심 전달 메시지</th><th>이동</th></tr></thead><tbody>${rows.map(([t,s,w,m,step])=>`<tr><td><b>${t}</b></td><td>${s}</td><td>${w}</td><td>${m}</td><td><button class="btn outline small" data-cue-go="${step}">열기</button></td></tr>`).join('')}</tbody></table>`);
  $$('[data-cue-go]',$('#dialog-body')).forEach(b=>b.onclick=()=>{$('#detail-dialog').close();go(Number(b.dataset.cueGo));});
}
function showAbout(){openDialog('제136차 월례집담회',`<div class="eyebrow">인문학연구원 역사연구소 · 국사학과 BK21 교육연구단</div><h3 style="font-size:28px">AI라는 호랑이 등에 올라타기</h3><p>소프트웨어를 매개로 한 역사연구의 심화·확대·산학화</p><p>발표 이수화 (서울대 빅데이터혁신융합대학)<br>사회 허수 (서울대 역사학부 한국사학전공)</p><p>2026년 11월 18일 수요일 오후 12시<br>서울대 인문대학 4동 302호</p><p class="note">이 워크벤치는 강연 기록 하나에서 연구 질문과 제작 자료를 이어가는 발표용 실험 공간입니다.</p>`);}
function cleanup(){stopSimulation();if(mapTimer){clearInterval(mapTimer);mapTimer=null;}if(mapController){mapController.destroy();mapController=null;map=null;}else if(map){map.remove();map=null;}}
function go(step){const next=Math.max(0,Math.min(6,Number(step)||0));state.step=next;history.replaceState(null,'',`#step-${next}`);renderCurrent(true);}
function renderCurrent(scroll=true){generation++;cleanup();const renderers=[renderOverview,renderStep1,renderStep2,renderStep3,renderStep4,renderStep5,renderStep6];main.innerHTML=renderers[state.step]();$$('.journey-nav [data-step]').forEach(b=>{const active=Number(b.dataset.step)===state.step;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});const binders=[()=>{
  if($('#tour-map'))$('#tour-map').onclick=()=>$('#overview-journey').scrollIntoView({behavior:'smooth'});
  if($('#hero-poster-btn'))$('#hero-poster-btn').onclick=showPosterModal;
  $$('[data-log-level]').forEach(b=>b.onclick=()=>{
    state.logLevel=Number(b.dataset.logLevel);
    const lv=LOG_LEVELS[state.logLevel];
    $$('[data-log-level]').forEach(x=>x.classList.toggle('active',Number(x.dataset.logLevel)===state.logLevel));
    $('#linear-readout').textContent=lv.linear+'%';
    $('#linear-bar').style.width=lv.linear+'%';
    $('#log-readout').textContent=lv.ratio;
    $('#log-bar').style.width=lv.log+'%';
    $('#log-caption').innerHTML=`<b>${lv.label}</b> — ${lv.desc}`;
  });
},bindStep1,bindStep2,bindStep3,bindStep4,bindStep5,bindStep6];binders[state.step]();renderPresenterBar();if(scroll){window.scrollTo({top:0,behavior:'auto'});main.focus({preventScroll:true});}}
document.addEventListener('click',e=>{const step=e.target.closest('[data-step]'),source=e.target.closest('[data-source]');if(step){go(step.dataset.step);return;}if(source)showSource(source.dataset.source);});
$('#dialog-close').onclick=()=>$('#detail-dialog').close();$('#detail-dialog').addEventListener('click',e=>{if(e.target===$('#detail-dialog'))$('#detail-dialog').close();});
$('#method-button').onclick=showMethods;$('#about-button').onclick=showAbout;if($('#poster-button'))$('#poster-button').onclick=showPosterModal;if($('#footer-poster-button'))$('#footer-poster-button').onclick=showPosterModal;if($('#cuesheet-button'))$('#cuesheet-button').onclick=showCueSheet;
$('#presentation-button').onclick=async()=>{const on=!document.body.classList.contains('presenting');document.body.classList.toggle('presenting',on);$('#presentation-button').setAttribute('aria-pressed',String(on));$('#presentation-button').textContent=on?'⛶ 발표 모드 종료':'⛶ 발표 모드';try{if(on&&!document.fullscreenElement)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen();}catch{}renderPresenterBar();map?.invalidateSize();};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){document.body.classList.remove('presenting');$('#presentation-button').setAttribute('aria-pressed','false');$('#presentation-button').textContent='⛶ 발표 모드';renderPresenterBar();}map?.invalidateSize();});
document.addEventListener('keydown',e=>{if($('#detail-dialog').open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName||''))return;if(e.key==='ArrowRight'&&state.step<6){e.preventDefault();go(state.step+1);}if(e.key==='ArrowLeft'&&state.step>0){e.preventDefault();go(state.step-1);}if(/^[0-6]$/.test(e.key)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();go(Number(e.key));}if((e.key==='p'||e.key==='P')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();showPosterModal();}if((e.key==='c'||e.key==='C')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();state.cueOpen=!state.cueOpen;renderPresenterBar();}});
window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#step-([0-6])$/);if(m&&Number(m[1])!==state.step){state.step=Number(m[1]);renderCurrent();}});
window.addEventListener('resize',()=>map?.invalidateSize());
async function boot(){try{[lecture,photos]=await Promise.all([getJSON('data/lecture.json'),getJSON('data/photos.json')]);photos=photos.filter(p=>/\.(png|jpe?g|webp)$/i.test(p.src));state.photo=Math.max(0,photos.findIndex(p=>p.src.includes('image17.')));state.step=Number(location.hash.match(/^#step-([0-6])$/)?.[1]||0);renderCurrent(false);try{stats=STATIC_GHPAGES?await getJSON('data/static-api/stats.json'):await getJSON(`${API_BASE}/stats`).catch(()=>getJSON('data/static-api/stats.json'));$('#data-status').innerHTML=`<i class="status-dot online"></i>${STATIC_GHPAGES?'정적 아카이브 스냅샷':'연구 DB 연결'} · 출처별 ${fmt(stats.total_source_records||stats.total_incidents)}개 기록`;}catch{$('#data-status').innerHTML='<i class="status-dot"></i>강연록 연결 · 연구 DB 연결 확인 필요';}}catch(e){main.innerHTML=failure(e.message);$('#data-status').textContent='필수 자료 연결 확인 필요';}}
boot();
