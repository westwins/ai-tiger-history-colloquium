import {PRESENTATION_CUES,cueTime,presentationShortcut} from './lecture-config.mjs?v=20261117.311';
import {archiveMapShell,mountArchiveMap,archiveRecordHTML} from './archive-map.mjs?v=20261117.311';
import {LEXICON, escapeHtml as E, countLiteral, splitLecture, analyzeText, temporalCounts, paragraphExcerpt} from './research-engine.mjs?v=20261117.311';
import {SCENARIOS, comparePolicies, formatForecastMonth} from './simulation.mjs?v=20261117.311';

const $ = (selector, parent=document) => parent.querySelector(selector);
const $$ = (selector,parent=document) => [...parent.querySelectorAll(selector)];
const fmt = n => Number(n).toLocaleString('ko-KR');
const main = $('#main');
const SOURCE_URL = 'https://blog.soohwalee.com/2026/10/29/latin-america-trc-transitional-justice-korea/';
const DATASET_URL = 'https://github.com/danilofreire/pinochet';
const DOJ_URL = 'https://www.justice.gov.za/trc/amntrans/index.htm';
const APP_VERSION = '3.1.1';
const API_BASE = location.pathname.includes('/preview-v2/') ? '/preview-v2/api' : '/api';
let lecture, photos=[], stats=null, incidentsCache={}, map=null, mapTimer=null, simTimer=null, toastTimer=null;
let generation=0, mapController=null;
const state = {mapOptions:{source:'chile-pinochet-2019'}, timelineSource:'chile-pinochet-2019', step:0, case:'amnesty', graph:'all', node:'question', evidenceMode:'graph', term:'조사', scope:'all', textMode:'lecture', mapCountry:'CHL', year:1990, cumulative:true, precision:'all', phase:0, scenario:'A', simConfig:{excluded:87,barrier:78,capacity:28}, seed:20261118, week:0, sim:null, photo:0, audience:'public', logLevel:4, cueOpen:false};
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
  return `<div class="step-lens-banner ${cls}"><div><span class="field-chip">${E(m.field)}</span> <b>${phase} 테제:</b> ${E(m.cue)}</div><button class="btn outline small" data-step="0">00 전체 매핑 ↗</button></div><div class="section-head"><div><div class="eyebrow">${phase} / ${String(step).padStart(2,'0')} · ${E(m.field)}</div><h1>${title}</h1><p>${description}</p></div><span class="source-pill ${basis==='model'?'model':basis==='demo'?'demo':''}">${basis==='model'?'가상 집단 · 교육용 모형':basis==='demo'?'연구자 편집 구조도':basis==='dataset'?'출처별 연구 자료 · 집계와 환산 구별':'공개 채록본 · 출처 연결'}</span></div>`;
}
function segmented(items,active,name) { return `<div class="segmented" role="group" aria-label="${E(name)}">${items.map(([id,label])=>`<button class="${String(id)===String(active)?'active':''}" data-${name}="${id}" aria-pressed="${String(id)===String(active)}">${label}</button>`).join('')}</div>`; }
function loading(message='연구 데이터를 불러오고 있습니다…') { return `<div class="loading">${message}</div>`; }
function failure(message) { return `<div class="error-panel"><b>자료를 불러오지 못했습니다</b>${E(message)}<p class="note">예시 데이터로 대신 채우지 않습니다. 연결을 확인한 뒤 새로고침해 주세요.</p></div>`; }
async function getJSON(url) { const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error(`자료 서버 응답 ${res.status}`); return res.json(); }
async function getIncidents(country,source=country==='CHL'?'chile-pinochet-2019':'jeju43-comprehensive') { const key=country+':'+source;if(!incidentsCache[key])incidentsCache[key]=getJSON(`${API_BASE}/research/incidents?country=${country}&source=${encodeURIComponent(source)}`).catch(e=>{delete incidentsCache[key];throw e;});return incidentsCache[key]; }
function download(text,name,type='text/plain;charset=utf-8') { const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast(`${name} 파일을 저장했습니다.`); }


const STEP_META = {
  0: {axis:'총괄 테제', field:'서사 채널 → 오토마타 채널', time:'발표 12:00–12:10 · 12:45–13:00 | 토론 13:00–13:50', slide:'제1막(1–3) · 공론장 진단(11–13) · 결어(14–19) · 에필로그(20)', cue:'인문학은 학자 머릿속의 시선과 모델입니다. 짚인간(AI)으로 서사 단일 채널을 넘어 0비용 오토마타 다중 채널로 직결됩니다.'},
  1: {axis:'심화', field:'필드 ① 디지털 아카이빙 · 전산문헌학', time:'발표 12:10–12:16 (시연 ②-A)', slide:'제2막 · 슬라이드 4–5 [심화 01]', cue:'[심화·시선 보정] 구술 원문(4개 국어 개념어)은 100% 보존하고, 공식 통계 대조(7,112 신청 vs 849 허가)와 5+5 판단을 스탠드오프로 분리합니다.'},
  2: {axis:'심화', field:'필드 ② 데이터 모델링 · 프로소포그래피', time:'발표 12:16–12:22 (시연 ②-B)', slide:'제2막 · 슬라이드 6 [심화 02]', cue:'[심화·모델 견고화] 강연 본문(자원 제약)과 정지석 동문 반론(개별 입증 병목)을 하나로 뭉개지 않고 병렬 논증 지도로 세웁니다.'},
  3: {axis:'확대', field:'필드 ③ 계산 텍스트 역사학 (멀리읽기)', time:'발표 12:22–12:27 (시연 ③-A)', slide:'제3막 · 슬라이드 7 [확대 03]', cue:'[확대·오토마타 질의] 본문(198문단) 대 질의응답(18문단) 빈도, 칠레 인물별 날짜 집계, 제주 시기 비율 환산을 살펴보고 원문(p212)으로 회귀합니다.'},
  4: {axis:'확대', field:'필드 ④ 공간역사학 · 3D HGIS', time:'발표 12:27–12:34 (시연 ③-B)', slide:'제3막 · 슬라이드 8 [확대 04]', cue:'[확대·오토마타 시각화] 네온 KDE 히트맵·3D 공간 프리즘·본토 형무소 이송 아크로 칠레(2,398·3,216)와 제주 4·3(15,218명·수형 2,530명)을 펼칩니다.'},
  5: {axis:'확대', field:'필드 ⑤ 실측 튜닝 시뮬레이션 (ABM)', time:'발표 12:34–12:40 (시연 ③-C)', slide:'제3막 · 슬라이드 9 & 11–12 [확대 05]', cue:'[확대·오토마타 실험] 칠레·한국 관측 총계에 보정한 규칙을 비교하고, 90% 목표와 반복 결과의 변동 범위를 읽습니다.'},
  6: {axis:'산학화', field:'필드 ⑥ 멀티모달 사료 읽기 · 공공역사', time:'발표 12:40–12:45 (시연 ④)', slide:'제4막 · 슬라이드 10 [산학화 06]', cue:'[산학화·다중 채널 공급] 데이터 침묵 속 선동을 막기 위해 원문 출처·판정 유보가 봉인된 카드·고증시트·리빙랩 교안을 현장에 직접 공급합니다.'}
};

const LOG_LEVELS = {
  1: {label:'1단계 · 서사 단독', linear:25, log:6, ratio:'1× 기준 (단일 언어 채널)', desc:'인문학자의 시선과 모델을 논문·단행본·강연이라는 단일 서사 채널로만 전달하는 상태입니다. 사료 대조와 독자 확산에 높은 물리적 마찰이 작동합니다.'},
  2: {label:'2단계 · 심화 (시선 보정)', linear:50, log:22, ratio:'10¹× 도약 (2차 사이버네틱스)', desc:'구술 채록·스탠드오프 사료비판(01)과 병렬 논증 지도(02)로 내 머릿속 모델의 빈틈·통계 착오·침묵 층위를 스스로 재점검하고 견고화합니다.'},
  3: {label:'3단계 · 확대 (오토마타 서비스)', linear:75, log:55, ratio:'10²× 도약 (질의·지도·실험)', desc:'시선이 살아 움직이는 오토마타가 되어 어휘 동시등장 계량(03), 단위를 구별한 다중 출처 시공간 지도(04), 조사 규칙 시뮬레이션(05)을 즉시 수행합니다.'},
  4: {label:'4단계 · 산학화 & 강심장 리더십', linear:100, log:100, ratio:'10³× 도약 (무한 접속 · 0비용화)', desc:'AI 안경 시대 기능지식 시험이 종언을 고할 때, 출처·판정 유보가 봉인된 다중 채널 패키지(06)로 세상을 직접 이끄는 N+1차원 인문학 지휘자가 됩니다.'}
};

function renderPresenterBar() {
  const bar = $('#presenter-bar');
  if (!bar) return;
  const on = document.body.classList.contains('presenting') || state.cueOpen;
  bar.hidden = !on;
  if (!on) return;
  const m = STEP_META[state.step] || STEP_META[0];
  bar.innerHTML = `<div class="presenter-cue-main"><span class="cue-time">${m.time}</span><span class="cue-slide">${m.slide} · ${m.field}</span><span class="cue-line">${E(m.cue)}</span></div><div class="presenter-jumps"><button class="poster-jump" id="bar-poster-btn">⚡ 포스터</button><button class="poster-jump" id="bar-epilogue-btn">🌈 무지개</button>${[0,1,2,3,4,5,6].map(n=>`<button data-step="${n}" class="${state.step===n?'active':''}">${n===0?'00 테제':'0'+n}</button>`).join('')}</div>`;
  const pb = $('#bar-poster-btn');
  if (pb) pb.onclick = showPosterModal; const eb = $("#bar-epilogue-btn"); if (eb) eb.onclick = showRainbowEpilogue;
}

function renderOverview() {
  const heroPhoto=photos.find(p=>p.src.includes('image19.')) || photos.find(p=>p.slide===21) || photos[0];
  const lv=LOG_LEVELS[state.logLevel] || LOG_LEVELS[4];
  const cards=[
    ['심화 · 필드 ① 전산문헌학','사료비판','100% 다국어 구술 채록을 보존한 채 공식 통계 대조(7,112 vs 849)와 5+5 판단을 분리합니다.'],
    ['심화 · 필드 ② 프로소포그래피','증거 연결','자원 제약 가설과 정지석 동문의 개별 입증 병목 반론을 병렬 논증 지도로 구조화합니다.'],
    ['확대 · 필드 ③ 계산 텍스트학','멀리읽기','본문과 질의응답의 어휘 연결·칠레 연도 분포를 직접 세고 원문 문단으로 돌아갑니다.'],
    ['확대 · 필드 ④ 공간역사학·HGIS','시공간 지도','칠레(2,398·3,216건)와 제주 종합 109개 거점·집계 기록을 정밀도·결측 그대로 탐색합니다.'],
    ['확대 · 필드 ⑤ 시뮬레이션 역사학','조사 실험','동일한 가상 집단 200건에 개별 신청 대 명단 연계 조사 규칙을 적용해 동학을 시험합니다.'],
    ['산학화 · 필드 ⑥ 멀티모달·공공역사','공공역사 제작','서사 원고를 넘어 출처·판정 유보가 봉인된 카드·고증시트·리빙랩 교안을 직접 공급합니다.']
  ];
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow">서울대 역사연구소 제136차 월례집담회 · 2026.11.18 · 발표 60분(12:00–13:00) + 토론 30~50분</div><h1>AI라는 호랑이<br>등에 <em>올라타기</em></h1><div class="hero-thesis-box"><strong>인문학의 정의 — 인문학자들 머릿속의 ‘시선과 모델’</strong><p>인문학은 역사가·문학가·철학자가 세상을 바라보는 고유한 시선과 모델을 만들고 가르치며 세상을 이끄는 학문입니다. 이제 AI 에이전트(짚인간)가 <b>서사 단일 채널</b>을 넘어 <b>0비용·무한 접속의 소프트웨어(오토마타) 채널</b>을 열어줍니다.</p></div><div class="hero-actions"><button class="btn gold" data-step="1">01 심화 · 사료 한 문장에서 시작하기 <span>↗</span></button><button class="btn outline" id="hero-poster-btn">⚡ 짚인간 양방향 회로 포스터</button><button class="btn outline" id="hero-epilogue-btn" style="border-color:#fbbf2488;color:#fde68a">🌈 선흘리 무지개 에필로그</button><button class="btn outline" id="tour-map">6대 필드 매핑 보기</button></div></div><figure class="hero-image">${heroPhoto?`<img src="${heroPhoto.src}" alt="박구병 강연자료에 담긴 칠레 기억과 인권 박물관의 사진 전시">`:''}<figcaption>단일 씨앗(Seed): 박구병 교수 진실·화해 강연 채록본(216문단) &amp; 원본 시각사료<br>라틴아메리카 + 한국 과거사 담론으로 펼친 디지털 역사학 6대 필드</figcaption></figure></section>
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
    `<div class="toolbar">${segmented([['lecture','강연록의 어휘 관계'],['timeline','출처별 시간 분포']],state.textMode,'text-mode')}<span class="note">인물별 날짜 집계와 시기 비율 환산을 구별합니다.</span></div><div id="analysis-workspace">${state.textMode==='lecture'?renderTextAnalysis():loading()}</div>`+
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
  return `<svg viewBox="0 0 ${width} ${height}" aria-label="선택한 출처의 시간 분포">${[0,.25,.5,.75,1].map(t=>`<line class="chart-grid" x1="${left}" y1="${top+plotH*(1-t)}" x2="${width-right}" y2="${top+plotH*(1-t)}"/><text class="chart-label" x="${left-10}" y="${top+plotH*(1-t)+4}" text-anchor="end">${fmt(Math.round(max*t))}</text>`).join('')}${entries.map((d,i)=>{const x=left+i*slot+slot*.15,y=top+plotH*(1-d.count/max),h=d.count/max*plotH;return `<g data-time-year="${d.year}" role="button" tabindex="0" aria-label="${d.year}년 ${d.count}건"><rect class="chart-bar ${d.year===selected?'selected':''}" x="${x}" y="${y}" width="${slot*.7}" height="${Math.max(h,2)}" rx="2"/><text class="chart-label" x="${x+slot*.35}" y="${height-30}" text-anchor="middle">${String(d.year).slice(2)}</text>${d.count===max?`<text class="chart-annotation" x="${x+slot*.35}" y="${Math.max(y-10,18)}" text-anchor="middle">${fmt(d.count)}</text>`:''}</g>`;}).join('')}<text class="chart-label" x="${width-right}" y="${height-6}" text-anchor="end">연도 (${entries[0]?.year||1973}–${entries.at(-1)?.year||1990})</text></svg>`;
}
async function renderTemporal(){
 const gen=generation,source=state.timelineSource;
 const country=source.startsWith('jeju')?'KOR':'CHL';
 try{const data=await getIncidents(country,source);if(gen!==generation||state.textMode!=='timeline'||source!==state.timelineSource)return;
 const summary=data.official_summary;
 const entries=summary?.temporal_phases?summary.temporal_phases.map(p=>({year:p.year,count:p.count,phase:p.phase,note:p.share_note})):temporalCounts(data.rows).entries;
 const totalCount=summary?summary.recognized_victims_2026:data.count;
 const datedCount=summary?summary.recognized_victims_2026:temporalCounts(data.rows).dated;
 const unknownCount=summary?0:temporalCounts(data.rows).unknown;
 const peak=[...entries].sort((a,b)=>b.count-a.count)[0];if(!entries.some(x=>x.year===state.timeYear))state.timeYear=peak?.year||(country==='KOR'?1948:1973);
 const eupBars=summary?data.rows.filter(r=>r.record_layer==='eup_myeon_stat').sort((a,b)=>b.victim_count-a.victim_count):[];
 $('#analysis-workspace').innerHTML=`<div class="archive-source-row"><label class="archive-source-label">집계할 출처 <select id="timeline-source" aria-label="연도 집계 자료 출처"><option value="chile-pinochet-2019">칠레 · Freire 연구 자료 (2,398명)</option><option value="chile-mmdh-victims">칠레 · MMDH 박물관 명부 (3,216명)</option><option value="jeju43-comprehensive">제주 4·3 · 시기 비율 환산 / 거점·집계 기록</option></select></label></div>
 ${summary?`<div class="jeju-stat-cards"><div class="jeju-stat-card"><small>2026.04 공식 확정 희생자</small><strong>${fmt(summary.recognized_victims_2026)}명</strong><span class="note" style="display:block">유족 ${fmt(summary.recognized_bereaved_2026)}명</span></div><div class="jeju-stat-card"><small>사망 / 행방불명 / 수형·후유</small><strong>10,753 / 3,796</strong><span class="note" style="display:block">수형 445 · 후유장애 224명</span></div><div class="jeju-stat-card"><small>가해주체 (2003 보고서)</small><strong>토벌대 78.1%</strong><span class="note" style="display:block">공란 제외 86.1% · 무장대 12.6%</span></div><div class="jeju-stat-card"><small>중산간 초토화 · 본토 수형</small><strong>가옥 39,285동</strong><span class="note" style="display:block">잃어버린 마을 84곳 · 군법회의 2,530명</span></div></div>`:''}
 <div class="chart-layout"><div class="viz-panel"><div class="chart-title">${E(data.source)} · ${summary?'시기 비율 환산 (개인별 날짜 집계 아님)':'개인별 연도 집계'}</div><p class="note">막대를 누르면 상세 시기 맥락을 확인하고 04 시공간 지도로 즉시 연동합니다.</p><div id="time-chart"></div>
 ${eupBars.length?`<div style="margin-top:20px;border-top:1px solid var(--line);padding-top:14px"><div class="chart-title">12개 읍·면 입력 집계: ${fmt(eupBars.reduce((n,r)=>n+r.victim_count,0))}명 / 보고서 총계 ${fmt(summary.report_2003_total)}명</div><p class="note">차이 ${fmt(summary.report_2003_total-eupBars.reduce((n,r)=>n+r.victim_count,0))}명의 원인은 추가 확인이 필요합니다. 지역별 값을 임의로 보정하지 않았습니다.</p><div class="tornado-list">${eupBars.map(r=>`<div class="tornado-row"><b>${E(r.region_label)}</b><div class="tornado-track"><div class="tornado-bar pos" style="width:${(r.victim_count/3890*100).toFixed(1)}%"></div></div><span class="mono">${fmt(r.victim_count)}명</span></div>`).join('')}</div></div>`:''}
 </div><aside class="panel dark" id="time-detail"></aside></div><p class="note" style="margin-top:16px">${summary?`공식 결정 총계 ${fmt(totalCount)}명과 별도로 입력한 시기 비율 환산값입니다. 개인별 날짜 확인 여부·날짜 미상 인원을 뜻하지 않습니다. 지도는 ${fmt(data.rows.length)}개 거점·집계 기록을 필터링하므로 막대 인원과 지도 점 수는 다릅니다.`:`기준 규모 ${fmt(totalCount)} · 시기 확인 ${fmt(datedCount)}${unknownCount?` · 연도 미상 ${fmt(unknownCount)}`:''}.`} <a href="${E(data.source_url)}" target="_blank" rel="noopener">공식 출처 확인 ↗</a></p>`;
 $('#timeline-source').value=source;$('#timeline-source').onchange=e=>{state.timelineSource=e.target.value;state.timeYear=null;renderTemporal();};
 const bindYears=()=>$$('[data-time-year]').forEach(b=>{b.onclick=()=>detail(b.dataset.timeYear);b.onkeydown=e=>{if(e.key==='Enter')detail(b.dataset.timeYear);};});
 const detail=year=>{state.timeYear=Number(year);const entry=entries.find(x=>x.year===Number(year))||entries[0];$('#time-detail').innerHTML=`<div class="panel-title"><b>${entry.year}년 집중 분석</b><span>${summary?'시기 비율 환산값 (실측 날짜 아님)':'출처별 실제 집계'}</span></div><div class="stat-display">${fmt(entry.count)}<small style="font-size:16px;margin-left:8px">${summary?'명':'건'}</small></div><p class="stat-caption">${E(entry.phase||data.source)}</p><div class="timeline-insight" style="font-size:16px">${E(entry.note||'같은 시기 기록을 시공간 지도에서 확인합니다.')}</div><button class="btn gold small" id="year-to-map" style="margin-top:22px">${entry.year}년 시공간 지도 열기 ↗</button>`;$('#time-chart').innerHTML=barsSVG(entries,Number(entry.year));bindYears();$('#year-to-map').onclick=()=>{state.mapOptions={source,year:Number(entry.year),allDates:false,includeUnknown:false,cumulative:false,view:'auto',hgisMode:'heatmap'};go(4);};};detail(state.timeYear);
 }catch(e){if(gen===generation)$('#analysis-workspace').innerHTML=failure(e.message);}
}
function bindStep3(){$$('[data-text-mode]').forEach(b=>b.onclick=()=>{state.textMode=b.dataset.textMode;renderCurrent(false);});if(state.textMode==='lecture')bindTextAnalysis();else renderTemporal();}

function recordHTML(r){return archiveRecordHTML(r);}
function showRecord(r){if(r)openDialog('원자료 기록의 근거',`<div class="map-detail">${recordHTML(r)}</div>`);}
function renderStep4(){return head('확대',4,'자료의 범위까지 함께 보는 역사 지도','출처를 선택하고, 연도·지역·좌표의 정밀도를 바꾸며 원자료를 확인하세요.','dataset')+archiveMapShell()+nextStep(5,'기록에 남은 분포와 기록 밖으로 빠지는 과정을 함께 질문합니다.');}
function bindStep4(){mapController=mountArchiveMap({options:state.mapOptions,getData:getIncidents,getJSON,apiBase:API_BASE,onMap:m=>{map=m;},onState:s=>{state.mapEvidence=s;}});}

function modelChart(){
  const sc=SCENARIOS[state.scenario]||SCENARIOS.A, sim=state.sim, maxW=sim.weeks, maxY=sim.universe;
  const w=760,h=300,l=56,r=22,t=24,b=42,pw=w-l-r,ph=h-t-b;
  const xOf=wk=>l+(wk/maxW)*pw, yOf=val=>t+ph-Math.min(1,Math.max(0,val/maxY))*ph;
  const band=(arr,lo,hi)=>{
    const fwd=arr.map(d=>`${xOf(d.week).toFixed(1)},${yOf(d[hi]).toFixed(1)}`).join(' L');
    const rev=[...arr].reverse().map(d=>`${xOf(d.week).toFixed(1)},${yOf(d[lo]).toFixed(1)}`).join(' L');
    return `M${fwd} L${rev} Z`;
  };
  const line=(arr, upto)=>arr.slice(0,upto+1).map((d,i)=>`${i?'L':'M'}${xOf(d.week).toFixed(1)},${yOf(d.realRecorded).toFixed(1)}`).join(' ');
  const fullGhost=arr=>arr.map((d,i)=>`${i?'L':'M'}${xOf(d.week).toFixed(1)},${yOf(d.realRecorded).toFixed(1)}`).join(' ');
  const errBars=(arr,color)=>sc.milestoneWeeks.filter(wk=>wk>0&&wk<=state.week&&arr[wk]).map(wk=>{
    const d=arr[wk], x=xOf(wk), yTop=yOf(d.mean+d.sd), yBot=yOf(Math.max(0,d.mean-d.sd));
    return `<g stroke="${color}" stroke-width="1.5" opacity="0.88"><line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}"/><line x1="${x-4}" y1="${yTop}" x2="${x+4}" y2="${yTop}"/><line x1="${x-4}" y1="${yBot}" x2="${x+4}" y2="${yBot}"/></g>`;
  }).join('');
  const anc=sc.empiricalAnchor, ancX=xOf(Math.min(maxW,anc.week)), ancY=yOf(anc.count);
  const statX=xOf(Math.min(maxW,sc.comparisonWeek));
  const yTicks=[0,0.25,0.5,0.75,1].map(f=>Math.round(maxY*f));
  return `<svg viewBox="0 0 ${w} ${h}" aria-label="몬테카를로 앙상블 시뮬레이션 팬 차트 및 에러바">
    ${yTicks.map(v=>`<line class="chart-grid" x1="${l}" x2="${w-r}" y1="${yOf(v)}" y2="${yOf(v)}"/><text class="chart-label" x="${l-8}" y="${yOf(v)+4}" text-anchor="end">${fmt(v)}</text>`).join('')}
    <path d="${band(sim.baseline,'p05','p95')}" fill="#bd7f3018"/>
    <path d="${band(sim.baseline,'p25','p75')}" fill="#bd7f3030"/>
    <path d="${band(sim.alternative,'p05','p95')}" fill="#117d761c"/>
    <path d="${band(sim.alternative,'p25','p75')}" fill="#117d7638"/>
    <path d="${fullGhost(sim.baseline)}" stroke="#bd7f3055" stroke-width="1.3" stroke-dasharray="4 4" fill="none"/>
    <path d="${fullGhost(sim.alternative)}" stroke="#117d7655" stroke-width="1.3" stroke-dasharray="4 4" fill="none"/>
    <path d="${line(sim.baseline,state.week)}" stroke="#d97706" stroke-width="3" fill="none"/>
    <path d="${line(sim.alternative,state.week)}" stroke="#0f766e" stroke-width="3.2" fill="none"/>
    ${errBars(sim.baseline,'#b45309')}${errBars(sim.alternative,'#0f766e')}
    <line x1="${statX}" x2="${statX}" y1="${t}" y2="${h-b}" stroke="#e11d48" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="${Math.min(w-r-4,statX+5)}" y="${t+12}" fill="#be123c" font-size="10.5" font-weight="700" text-anchor="${statX>w-180?'end':'start'}">${E(sc.comparisonLabel)}</text>
    <g transform="translate(${ancX},${ancY})">
      <polygon points="0,-8 8,0 0,8 -8,0" fill="#fbbf24" stroke="#0c1b2a" stroke-width="1.8"/>
      <text x="${ancX>w-220?-11:11}" y="4" fill="#0c1b2a" font-size="11" font-weight="800" text-anchor="${ancX>w-220?'end':'start'}">${E(anc.label)}</text>
    </g>
    ${sc.milestoneWeeks.map(v=>`<text class="chart-label" x="${xOf(v)}" y="${h-12}" text-anchor="middle">${v}주</text>`).join('')}
    <line x1="${xOf(state.week)}" x2="${xOf(state.week)}" y1="${t}" y2="${h-b}" stroke="#0c1b2a" stroke-width="1.4" stroke-dasharray="2 3"/>
  </svg>`;
}
function renderStep5(){
  const sc=SCENARIOS[state.scenario]||SCENARIOS.A;
  if(!state.sim||state.sim.scenario!==state.scenario){
    state.sim=comparePolicies(state.simConfig,state.seed,200,state.scenario,28);
    state.week=sc.comparisonWeek||39;
  }
  return head('확대',5,'관측 총계로 보정한 조사 규칙 비교 실험','관측 총계를 기준으로 보정한 가상 집단을 28회 반복 실행합니다. 두 조사 규칙의 결과와 모집단 90% 목표 도달 시점을 같은 가정 아래 비교합니다. 실제 정책 효과나 전원 완료일의 예측은 아닙니다.','model')+
  `<div class="toolbar">${segmented(Object.entries(SCENARIOS).map(([id,s])=>[id,`${id} · ${s.shortName}`]),state.scenario,'scenario')}<button type="button" class="btn outline small" id="sim-reset-tuned">🎯 실측 튜닝값 복원</button></div>
  <div class="abm-calib-banner">
    <div class="abm-calib-item"><small>관측 총계 기준점 (보정용)</small><strong id="abm-anchor-readout">${E(sc.empiricalAnchor.label)}</strong><span>모집단 ${fmt(sc.universe)}명 · <a href="${E(sc.empiricalAnchor.sourceUrl)}" target="_blank" rel="noopener" style="color:#67e8f9">근거 사료 ↗</a></span></div>
    <div class="abm-calib-item forecast"><small>${state.scenario==='B'?'39모형주 두 경로의 차이':'모집단 90% 목표 도달 (앙상블 평균)'}</small><strong id="abm-forecast-readout" class="ok">—</strong><span id="abm-calib-err">기준 총계와 모형 차이 계산 중</span></div>
    <div><span class="preview-badge">Monte Carlo N=28 · ±1 SD 에러바</span></div>
  </div>
  <div style="margin-bottom:14px"><b>${E(sc.topic)}</b><p class="note">${E(sc.context)}</p></div>
  <div class="simulation-workspace">
    <div class="abm-controls">
      <div><label for="sim-excluded">${E(sc.excludedLabel)}<output id="sim-excluded-value">${state.simConfig.excluded}%</output></label><input id="sim-excluded" type="range" min="10" max="95" value="${state.simConfig.excluded}"><small>절손·고령·사찰모름·보복우려로 개별 신청을 못하는 비율</small></div>
      <div><label for="sim-barrier">${E(sc.barrierLabel)}<output id="sim-barrier-value">${state.simConfig.barrier}%</output></label><input id="sim-barrier" type="range" min="10" max="95" value="${state.simConfig.barrier}"><small>자료 은폐·개별 입증 요구로 심의까지 지연되는 강도</small></div>
      <div><label for="sim-capacity">${E(sc.capacityLabel)}<output id="sim-capacity-value">${state.simConfig.capacity}</output></label><input id="sim-capacity" type="range" min="${sc.capacityMin}" max="${sc.capacityMax}" value="${state.simConfig.capacity}"><small>모형 한 주당 처리 한도 (실제 조사관 생산성 추정치 아님)</small></div>
    </div>
    <div class="sim-visual">
      <div class="sim-toolbar"><div class="week"><b id="sim-week">${state.week}</b> <span>/ ${sc.horizonWeeks}모형주</span></div><div class="row-actions"><button type="button" class="btn" id="sim-play" aria-pressed="false">▶ 처음부터 재생</button><button type="button" class="btn outline small" id="sim-end">${sc.comparisonWeek}주 기준점</button><button type="button" class="btn outline small" id="sim-new-cohort">다른 난수 앙상블</button></div></div>
      <div class="sim-scrubber-row"><span>주차 탐색</span><input type="range" id="sim-week-slider" min="0" max="${sc.horizonWeeks}" value="${state.week}"><span class="mono" id="sim-calendar-label"></span></div>
      <div class="sim-pair">${[['baseline',sc.baseline],['alternative',sc.alternative]].map(([id,label])=>`<section class="sim-board ${id==='alternative'?'compare':''}"><div class="sim-board-head"><h2>${E(label)}</h2><span class="source-label" style="color:#a7c6c7">모집단 ${fmt(sc.universe)}명 (200격자 투영)</span></div><div class="sim-count"><span id="${id}-count">0</span><small>명 규명 (중앙 90% 범위 <span id="${id}-ci">—</span>)</small></div><div class="agent-grid" id="${id}-grid" role="img">${Array.from({length:200},(_,i)=>`<i class="agent state-0" data-agent="${i}"></i>`).join('')}</div><div class="sim-legend"><span><i style="background:var(--mint)"></i>규명 <b id="${id}-recorded">0</b></span><span><i style="background:var(--gold)"></i>심의대기 <b id="${id}-waiting">0</b></span><span><i style="background:#4c636c"></i>접수밖 <b id="${id}-outside">0</b></span></div></section>`).join('')}</div>
    </div>
  </div>
  <div class="sim-comparison">
    <div class="sim-insight">
      <div class="eyebrow">같은 가정 아래 두 규칙의 모형 결과 차이</div>
      <strong id="sim-difference"></strong>
      <p id="sim-interpretation"></p>
      <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:12px">
        <div class="chart-title" style="font-size:12.5px">대표 코호트 민감도 (${sc.comparisonWeek}모형주차 변화 Δ)</div>
        <div class="tornado-list" id="sim-tornado"></div>
      </div>
      <button type="button" class="btn outline small" id="sim-export" style="margin-top:14px">보정 모수·앙상블 결과 JSON 저장 ↓</button>
    </div>
    <div class="viz-panel">
      <div class="chart-title">몬테카를로 28회 앙상블 궤적 (중앙 90%·50% 변동 범위 · ±1 SD 에러바 · ★ 실측치)</div>
      <div id="sim-chart"></div>
      <div class="legend" style="margin-top:8px"><span><i style="background:#d97706"></i>${E(sc.baseline)} (평균·분위수 범위)</span><span><i style="background:#0f766e"></i>${E(sc.alternative)} (평균·분위수 범위)</span><span><i style="background:#fbbf24"></i>★ 역사적 실측 기준점</span></div>
    </div>
  </div>
  <details class="method-details"><summary>모수 보정(Calibration) 근거와 해석 유의사항</summary><p>${E(sc.tunedNote)}. 28개 독립 난수 씨앗 코호트(각 200 에이전트 → 시나리오 규모 ${fmt(sc.universe)}명 비례 스케일링)를 구동하여 평균, 표준편차(±1 SD 에러바), 중앙 50%·90% 분위수 밴드를 산출합니다. 개인의 실제 신원 데이터는 사용하지 않으며, 정한 가정 안에서 난수에 따른 변동을 보여줍니다. 관측 총계에 가까워도 예측력·인과 효과가 검증된 것은 아닙니다. 목표는 모집단 90%이며 미도달 시 낮은 목표로 대체하지 않습니다. 토네이도는 대표 코호트의 한 모수씩 비교이며 28회 앙상블 민감도가 아닙니다. 현재 기준 씨앗: <span id="sim-seed">${state.seed}</span>.</p></details>`+nextStep(6,'사료의 근거와 시뮬레이션 가정을 보존한 채 교육·전시 다중 채널 자료로 옮깁니다.');
}
function drawSimulation(){
  const sc=SCENARIOS[state.scenario]||SCENARIOS.A, sim=state.sim;
  state.week=Math.max(0,Math.min(sim.weeks,state.week));
  $('#sim-week').textContent=state.week;
  if($('#sim-week-slider'))$('#sim-week-slider').value=state.week;
  if($('#sim-calendar-label'))$('#sim-calendar-label').textContent=sc.startYearMonth ? '가정한 시작월 기준: '+formatForecastMonth(sc.startYearMonth,state.week) : `${state.week}모형주차 · 실제 달력과 대응하지 않음`;
  for(const key of ['baseline','alternative']){
    const snap=sim[key][state.week];
    $(`#${key}-count`).textContent=fmt(snap.realRecorded);
    if($(`#${key}-ci`))$(`#${key}-ci`).textContent=`${fmt(snap.p05)}~${fmt(snap.p95)}`;
    $(`#${key}-recorded`).textContent=fmt(snap.realRecorded);
    $(`#${key}-waiting`).textContent=fmt(snap.realWaiting);
    $(`#${key}-outside`).textContent=fmt(snap.realOutside);
    $$('.agent',$(`#${key}-grid`)).forEach((dot,i)=>{dot.className=`agent state-${snap.states[i]}`;dot.title=`코호트 #${i+1}: ${['접수 밖','심의 대기','규명 완료'][snap.states[i]]}`;});
  }
  const bRec=sim.baseline[state.week].realRecorded, aRec=sim.alternative[state.week].realRecorded, delta=aRec-bRec;
  $('#sim-difference').textContent=`+${fmt(delta)}명 격차 (${state.week}주차)`;
  const fEl=$('#abm-forecast-readout'), eEl=$('#abm-calib-err');
  if(state.scenario==='B'){
    const loss39=sim.alternative[39].realRecorded-sim.baseline[39].realRecorded;
    if(fEl){fEl.textContent=`통합·직권 모형 − 신청 모형: ${fmt(loss39)}명 (39모형주)`;fEl.className='warn';}
  }else{
    if(fEl){
      fEl.textContent=`${sim.target.label} · 목표 ${fmt(sim.target.count)}명 / ${fmt(sim.universe)}명${sim.target.reached?` · 비교 기준 ${sc.comparisonWeek}모형주 ${sim.target.withinComparison?'이내':'이후'}`:''}`;
      fEl.className=sim.target.withinComparison?'ok':'warn';
    }
  }
  if(eEl)eEl.textContent=`실측치(${fmt(sim.calibration.empiricalValue)}명) 대비 현재 모형 평균 ${fmt(sim.calibration.modelMean)}±${fmt(sim.calibration.modelSd)}명 (오차 ${sim.calibration.errorPct}%)`;
  $('#sim-interpretation').textContent=`${state.week}모형주차: 신청 규칙 ${fmt(bRec)}명, 통합·직권 규칙 ${fmt(aRec)}명. 관측 총계와 별개인 두 모형의 조건부 결과입니다. 90% 목표 ${fmt(sim.target.count)}명은 ${sim.target.label}. 보정 오차는 정책 효과나 미래 예측의 검증 지표가 아닙니다.`;
  $('#sim-chart').innerHTML=modelChart();
  const maxSens=Math.max(10,...sim.sensitivity.map(s=>Math.abs(s.delta)));
  if($('#sim-tornado'))$('#sim-tornado').innerHTML=sim.sensitivity.map(s=>`<div class="tornado-row"><span>${E(s.label)}</span><div class="tornado-track"><div class="tornado-bar ${s.delta>=0?'pos':'neg'}" style="width:${(Math.abs(s.delta)/maxSens*100).toFixed(1)}%"></div></div><b class="mono" style="color:${s.delta>=0?'var(--teal)':'var(--rose)'}">${s.delta>=0?'+':''}${fmt(s.delta)}명</b></div>`).join('');
}
function stopSimulation(){if(simTimer){clearInterval(simTimer);simTimer=null;}if($('#sim-play')){$('#sim-play').textContent='▶ 처음부터 재생';$('#sim-play').setAttribute('aria-pressed','false');}}
function bindStep5(){
  drawSimulation();
  $$('[data-scenario]').forEach(b=>b.onclick=()=>{
    stopSimulation(); state.scenario=b.dataset.scenario; const sc=SCENARIOS[state.scenario];
    state.simConfig={excluded:sc.default[0],barrier:sc.default[1],capacity:sc.default[2]};
    state.sim=comparePolicies(state.simConfig,state.seed,200,state.scenario,28);
    state.week=sc.comparisonWeek||39; renderCurrent(false);
  });
  if($('#sim-reset-tuned'))$('#sim-reset-tuned').onclick=()=>{
    stopSimulation(); const sc=SCENARIOS[state.scenario];
    state.simConfig={excluded:sc.default[0],barrier:sc.default[1],capacity:sc.default[2]};
    state.sim=comparePolicies(state.simConfig,state.seed,200,state.scenario,28);
    state.week=sc.comparisonWeek||39; renderCurrent(false);
    toast('실측 데이터 수렴 튜닝 모수로 복원했습니다.');
  };
  for(const key of ['excluded','barrier','capacity'])$(`#sim-${key}`).oninput=e=>{
    stopSimulation(); state.simConfig[key]=Number(e.target.value);
    $(`#sim-${key}-value`).textContent=e.target.value+(key==='capacity'?'':'%');
    state.sim=comparePolicies(state.simConfig,state.seed,200,state.scenario,28);
    drawSimulation();
  };
  if($('#sim-week-slider'))$('#sim-week-slider').oninput=e=>{stopSimulation();state.week=Number(e.target.value);drawSimulation();};
  $('#sim-play').onclick=()=>{
    if(simTimer){stopSimulation();return;}
    state.week=0;drawSimulation();$('#sim-play').textContent='Ⅱ 재생 멈춤';$('#sim-play').setAttribute('aria-pressed','true');
    simTimer=setInterval(()=>{state.week+=2;if(state.week>=state.sim.weeks){state.week=state.sim.weeks;drawSimulation();stopSimulation();return;}drawSimulation();},95);
  };
  $('#sim-end').onclick=()=>{stopSimulation();state.week=SCENARIOS[state.scenario].comparisonWeek||state.sim.weeks;drawSimulation();};
  $('#sim-new-cohort').onclick=()=>{stopSimulation();state.seed++;state.sim=comparePolicies(state.simConfig,state.seed,200,state.scenario,28);if($('#sim-seed'))$('#sim-seed').textContent=state.seed;drawSimulation();toast('새 28개 난수 코호트 앙상블로 재검증했습니다.');};
  $('#sim-export').onclick=()=>download(JSON.stringify(simulationRecord(),null,2),'trc-calibrated-abm-v3.json','application/json');
}
function simulationRecord(){return {type:'calibrated_monte_carlo_process_abm',version:APP_VERSION,scenario:state.scenario,seed:state.seed,ensemble_runs:state.sim?.runs,universe:state.sim?.universe,week:state.week,assumptions:state.simConfig,calibration:state.sim?.calibration,target:state.sim?.target,uncertainty:state.sim?.uncertainty,time:state.sim?.time,sensitivity:{basis:'one_at_a_time_primary_cohort',results:state.sim?.sensitivity},interpretation:'가정에 따른 모형 비교. 전원 완료일·법정기한·검증된 정책 효과 아님.',baseline:state.sim?.baseline[state.week],alternative:state.sim?.alternative[state.week]};}

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

function showMethods(){openDialog('자료와 방법',`<dl><dt>공개 강연 기록</dt><dd>박구병 교수의 2026.10.29 강연 편집 채록본 ${lecture.blocks.length}개 문단을 불러옵니다. 음원은 연결되어 있지 않습니다. <a href="${SOURCE_URL}" target="_blank" rel="noopener">원문</a></dd><dt>실제 연구 데이터</dt><dd>Freire 외(2019) 인물 기록 2,398건과 MMDH 공개 명부 3,216건, 제주 공식 지역별 유적 47곳·소개 유적 25곳 및 종합 DB 109개 거점·집계 기록을 출처별로 읽습니다. 제주 시기 분포는 비율 환산값이며 읍·면 입력합 13,941명과 총계 14,028명의 차이는 87명입니다. 명부와 유적 목록은 서로 겹치므로 합산한 수를 고유 희생자 수로 사용하지 않습니다. 좌표 없는 기록과 날짜 정밀도도 보존합니다. 지도 숫자 원은 화면상 묶음 또는 원문 지역 집계입니다. 지역 대표점·현대 유적 참고 위치를 원자료의 사건 좌표와 구별합니다. <a href="coverage-review.html" target="_blank" rel="noopener">수집 범위 점검</a> <a href="${DATASET_URL}" target="_blank" rel="noopener">자료 설명</a></dd><dt>공식 통계의 대조</dt><dd>남아공 법무부의 2000.11.01 집계에서 신청 총수 7,112건과 허가 849건을 구별합니다. 해당 날짜의 집계이며 모든 시점의 최종 수치를 뜻하지 않습니다. <a href="${DOJ_URL}" target="_blank" rel="noopener">집계표</a></dd><dt>사진</dt><dd>사용자가 제공한 박구병 강연 원본 PPTX에서 사진을 추출했습니다. 슬라이드 번호와 원본 해상도를 표시하며, 사진 관찰과 역사적 해석을 구별합니다.</dd><dt>편집 구조와 모형</dt><dd>논증 지도는 연구자의 편집 구조도입니다. 조사 실험은 200개 가상 에이전트를 시나리오 규모로 환산해 28회 반복한 과정 모형입니다. 중앙 90%·50% 분위수 범위와 ±1 SD는 모형 내 변동이며 정책 효과의 검증이나 신뢰구간이 아닙니다. 목표는 모집단 90%로 고정하고 미도달 시 그대로 표시합니다.</dd><dt>교정한 표시</dt><dd>기존 구성 예문의 발언 건수, 임베딩 좌표, 음성 휴지, 인물별 신뢰도 점수를 실제 분석 결과처럼 표시하지 않습니다. 좌표가 부정확하다고 의도적 은폐로 자동 분류하지 않습니다.</dd><dt>저장과 내보내기</dt><dd>연구자의 분류와 메모는 이 브라우저에 저장합니다. 내려받는 HTML·Markdown·JSON에는 출처, 판단, 모형의 가정이 포함됩니다. 워크벤치 ${APP_VERSION}.</dd></dl>`);}
function showRainbowEpilogue(){
  openDialog('에필로그 · 데이터 너머의 무지개 — 우리가 역사학을 공부하는 진정한 이유',`
    <div class="epilogue-modal-grid">
      <div class="epilogue-art-box">
        <img src="assets/gosunja-rainbow-2024.jpg" alt="선흘1리 무지개할망 고순자 할머니 2024년작 아빠가 나를 사랑해">
        <div class="epilogue-art-caption"><b>〈아빠가 나를 사랑해〉 (2024, 고순자 · 제주 조천읍 선흘1리 올레미술관)</b><br>“아빠가 나를 사랑해 / 순자야 열명이쩌 애기보잰허난 / 나 마음이 지꺼지주(‘기쁘고 대견하지’) / 아빠가 생각하난 / 2024 고순자”</div>
      </div>
      <div class="epilogue-story">
        <div>
          <div class="eyebrow" style="color:#fbbf24">Slide 20 · 에필로그 · 선흘리에서 임진강 민통선까지</div>
          <h3>통계 점 하나 너머에 살아 숨 쉬는 <em>사랑과 승화</em>,<br>그것이 인간이 역사학을 공부하는 이유입니다</h3>
        </div>
        <div class="epilogue-quote-box">〈국토종단〉
어제는 제주도, 오늘은 민통선. 느끼는 바가 많도다.
나가 8살 때 4·3으루 총 맞아 죽은 애비가 동생 돌본다고 칭찬한 아버지의 그림, 무지개.
할매가 인자 90살 때 그린 그림. 20년 전 죽은 엄니가 생각나서 엉엉 울었다.
민통선. 아무 관심 없던 고량포구, 칠중성, 호로고루, 경순왕릉.
내 비록 무식하다마는 배움은 끝이 없고 무식은 한이 없도다.</div>
        <div class="epilogue-pillars">
          <div class="epilogue-pillar"><b>1. 선흘1리 좌표(33.5146°N, 126.6935°E)의 두 얼굴 — 초토화와 무지개</b>낙선동 4·3성과 도틀굴의 비극이 서린 바로 그 마을에서, 여든 넘어 처음 붓을 잡은 고순자 할머니는 8살 때 총살당한 아버지의 다정한 칭찬을 80년 만에 찬란한 무지개로 승화시켰습니다.</div>
          <div class="epilogue-pillar"><b>2. 제주 중산간에서 임진강 민통선(고량포구·칠중성·호로고루·경순왕릉)까지</b>삼국과 고려의 경계부터 현대 분단의 최전선까지, 이 땅의 지리·풍토·이념의 대결이 남긴 상처를 발로 밟고 보듬는 일은 오토마타가 대신할 수 없는 인간 역사가의 소명입니다.</div>
        </div>
        <div class="row-actions" style="justify-content:space-between;margin-top:4px">
          <a href="https://www.socialmuseum.net/artists/7" target="_blank" rel="noopener" style="color:#67e8f9;font-size:12px">선흘 그림할망 ‘무지개할망 고순자’ 소개 ↗</a>
          <button type="button" class="btn gold small" id="epilogue-to-map">📍 04 지도에서 선흘1리 올레미술관 위치 열기 ↗</button>
        </div>
      </div>
    </div>`);
  const btn=$('#epilogue-to-map');
  if(btn)btn.onclick=()=>{
    $('#detail-dialog').close();
    state.mapOptions={source:'jeju43-comprehensive',allDates:true,includeUnknown:true,cumulative:true,search:'고순자',view:'points',hgisMode:'heatmap',jejuLayer:'all'};
    go(4);
  };
}
window.openRainbowEpilogue=showRainbowEpilogue;

function showPosterModal(){
  openDialog('짚인간(AI 에이전트) 양방향 사이버네틱스 포스터 회로',`<iframe class="poster-frame" src="poster-anim.html" title="짚인간 양방향 회로 포스터 애니메이션"></iframe><p class="note"><b>파란선(정방향 지휘):</b> 인문학자 머릿속의 시선·모델을 0비용 소프트웨어(오토마타)로 육화해 시각화·질의·시뮬레이션·산학화로 확장 · <b>주황선(역방향 2차 사이버네틱스):</b> 오토마타 검증 결과를 되돌려 내 시선과 모델을 재점검·보정(심화). <a href="poster-anim.html" target="_blank" rel="noopener">새 창 전체화면으로 열기 ↗</a></p>`);
}
function showCueSheet(){
  const presRows=PRESENTATION_CUES.map(c=>[`${cueTime(c.start)}–${cueTime(c.end)} (${c.end-c.start}분)`,`${c.title} (슬라이드 ${c.slides[0]}${c.slides[0]===c.slides[1]?'':'–'+c.slides[1]})`,c.screen,c.message,c.action,c.button]);
  const qaRows=[
    ['13:00–13:15 (15분 · 기본 전반)','토론 트랙 ① 사료비판의 엄밀성과 AI 환각·번역 통제','01 사료비판 (p048 · 4개국어 개념어) · 02 논증지도','구술 원문 불변 보존 + 스탠드오프 마크업 구조 및 박구병 가설·정지석 반론 병렬 수용 방식 시연','1','01 근거'],
    ['13:15–13:30 (15분 · 30분 기준선)','토론 트랙 ② 제주 4·3 다층 DB 구축과 중복 배제·결측 해석','04 HGIS (결측 X-Ray · 본토 형무소 아크)','공식 결정 15,218명·읍면 입력합 13,941명(보고서 총계와 87명 차이)·수형인 2,530명 계층 분리 원칙 및 결측(Missing Data)의 사료적 의미 응답','4','04 X-Ray'],
    ['13:30–13:50 (+20분 탄력 확장 · 최대 50분)','토론 트랙 ③ 반사실 시뮬레이션(ABM) 정당성과 과거사 데이터 개방','05 실측튜닝 ABM (민감도·90% 목표) · 슬라이드 11–13','관측 총계(칠레 2,398·한국 370) 보정과 예측 검증의 차이 시연 및 보안사 명단 비식별 공개·디지털 공론장 복원 심층 토론','5','05 시연']
  ];
  openDialog('11월 18일 집담회 큐시트 · 본 발표 60분(12:00–13:00) + 심층 토론 30~50분(13:00–13:50)',
    `<p class="note">역사학부 월례집담회 진행 방식에 맞춰 <b>제1부 본 발표·라이브 시연 60분(12:00–13:00)</b>과 <b>제2부 심층 질의응답·종합토론 30~50분(13:00–13:30 기본, 토론 활성화 시 13:50까지 탄력 운영)</b>으로 구성했습니다. 단축키 <b>C</b>로 상단 프롬프터 바를 토글하고 <b>0~6</b>·<b>P</b>·<b>R</b>로 즉시 이동합니다.</p>
    <span class="cue-part-badge">제1부 · 본 발표 및 오토마타 라이브 시연 (12:00–13:00 · 60분 Full)</span>
    <table class="cue-table"><thead><tr><th>시간 (60분)</th><th>슬라이드 구간 (20장)</th><th>웹앱 시연 화면</th><th>핵심 전달 포인트</th><th>이동</th></tr></thead><tbody>${presRows.map(([t,s,w,m,act,btn])=>`<tr><td><b>${t}</b></td><td>${s}</td><td>${w}</td><td>${m}</td><td><button type="button" class="btn outline small" data-cue-go="${act}">${btn}</button></td></tr>`).join('')}</tbody></table>
    <span class="cue-part-badge qa">제2부 · 역사학자 심층 질의응답 및 종합토론 (13:00–13:30 기본 30분 ~ 13:50 최대 50분 · 사회: 허수 교수)</span>
    <table class="cue-table"><thead><tr><th>토론 시간 (30~50분)</th><th>예상 핵심 쟁점 트랙</th><th>즉시 호출 화면</th><th>방어 논거 및 실시간 조작 시연</th><th>호출</th></tr></thead><tbody>${qaRows.map(([t,s,w,m,act,btn])=>`<tr><td><b>${t}</b></td><td>${s}</td><td>${w}</td><td>${m}</td><td><button type="button" class="btn outline small" data-cue-go="${act}">${btn}</button></td></tr>`).join('')}</tbody></table>`);
  $$('[data-cue-go]',$('#dialog-body')).forEach(b=>b.onclick=()=>{
    const act=b.dataset.cueGo;
    $('#detail-dialog').close();
    if(act==='poster'){showPosterModal();return;}
    if(act==='rainbow'){showRainbowEpilogue();return;}
    if(act==='log'){go(0);setTimeout(()=>$('.ontology-section')?.scrollIntoView({behavior:'smooth'}),80);return;}
    go(Number(act));
  });
}
function showAbout(){openDialog('제136차 월례집담회 안내',`<div class="eyebrow">서울대학교 인문학연구원 역사연구소 · 국사학과 BK21 교육연구단</div><h3 style="font-size:27px">AI라는 호랑이 등에 올라타기</h3><p>소프트웨어를 매개로 한 역사연구의 심화·확대·산학화 (워크벤치 v3.1.1)</p><p><b>발표:</b> 이수화 (서울대 빅데이터혁신융합대학 연구교수)<br><b>사회:</b> 허수 (서울대 역사학부 한국사학전공 교수)</p><p><b>일시:</b> 2026년 11월 18일(수) 12:00–13:30~13:50<br>· 본 발표 및 라이브 시연: <b>12:00–13:00 (60분)</b><br>· 질의응답 및 심층 종합토론: <b>13:00–13:30 ~ 13:50 (30~50분 탄력 운영)</b><br><b>장소:</b> 서울대학교 인문대학 4동 302호</p>`);}
function cleanup(){stopSimulation();if(mapTimer){clearInterval(mapTimer);mapTimer=null;}if(mapController){mapController.destroy();mapController=null;map=null;}else if(map){map.remove();map=null;}}
function go(step){const next=Math.max(0,Math.min(6,Number(step)||0));state.step=next;history.replaceState(null,'',`#step-${next}`);renderCurrent(true);}
function renderCurrent(scroll=true){generation++;cleanup();const renderers=[renderOverview,renderStep1,renderStep2,renderStep3,renderStep4,renderStep5,renderStep6];main.innerHTML=renderers[state.step]();$$('.journey-nav [data-step]').forEach(b=>{const active=Number(b.dataset.step)===state.step;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});const binders=[()=>{
  if($('#tour-map'))$('#tour-map').onclick=()=>$('#overview-journey').scrollIntoView({behavior:'smooth'});
  if($('#hero-poster-btn'))$('#hero-poster-btn').onclick=showPosterModal;if($('#hero-epilogue-btn'))$('#hero-epilogue-btn').onclick=showRainbowEpilogue;
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
$('#method-button').onclick=showMethods;$('#about-button').onclick=showAbout;if($('#poster-button'))$('#poster-button').onclick=showPosterModal;if($('#epilogue-button'))$('#epilogue-button').onclick=showRainbowEpilogue;if($('#footer-poster-button'))$('#footer-poster-button').onclick=showPosterModal;if($('#cuesheet-button'))$('#cuesheet-button').onclick=showCueSheet;
$('#presentation-button').onclick=async()=>{const on=!document.body.classList.contains('presenting');document.body.classList.toggle('presenting',on);$('#presentation-button').setAttribute('aria-pressed',String(on));$('#presentation-button').textContent=on?'⛶ 발표 모드 종료':'⛶ 발표 모드';try{if(on&&!document.fullscreenElement)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen();}catch{}renderPresenterBar();map?.invalidateSize();};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){document.body.classList.remove('presenting');$('#presentation-button').setAttribute('aria-pressed','false');$('#presentation-button').textContent='⛶ 발표 모드';renderPresenterBar();}map?.invalidateSize();});
document.addEventListener('keydown',e=>{if($('#detail-dialog').open)return;const action=presentationShortcut(e,state.step);if(!action)return;e.preventDefault();if(action.kind==='step')go(action.value);if(action.kind==='poster')showPosterModal();if(action.kind==='rainbow')showRainbowEpilogue();if(action.kind==='cue'){state.cueOpen=!state.cueOpen;renderPresenterBar();}});
window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#step-([0-6])$/);if(m&&Number(m[1])!==state.step){state.step=Number(m[1]);renderCurrent();}});
window.addEventListener('resize',()=>map?.invalidateSize());
async function boot(){try{[lecture,photos]=await Promise.all([getJSON('data/lecture.json'),getJSON('data/photos.json')]);photos=photos.filter(p=>/\.(png|jpe?g|webp)$/i.test(p.src));state.photo=Math.max(0,photos.findIndex(p=>p.src.includes('image17.')));state.step=Number(location.hash.match(/^#step-([0-6])$/)?.[1]||0);renderCurrent(false);try{stats=await getJSON(`${API_BASE}/stats`);$('#data-status').innerHTML=`<i class="status-dot online"></i>연구 DB 연결 · 출처별 ${fmt(stats.total_source_records||stats.total_incidents)}개 기록`;}catch{$('#data-status').innerHTML='<i class="status-dot"></i>강연록 연결 · 연구 DB 연결 확인 필요';}}catch(e){main.innerHTML=failure(e.message);$('#data-status').textContent='필수 자료 연결 확인 필요';}}
boot();
