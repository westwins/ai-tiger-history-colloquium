import {escapeHtml as E} from './research-engine.mjs?v=20261117.311';
import {knownYear,filterRecords,recordPoints,clusterPoints,groupRecords,csvRecords} from './map-engine.mjs?v=20261117.311';

const $ = s => document.querySelector(s);
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const PRECISION = {
  exact: '원자료·현장 정확 좌표',
  approximate: '권역·행정지명 근사 참조 위치',
  unknown: '좌표 정확도 미상',
  unlocated: '원자료에 좌표 없음',
  osm_site_reference: '현대 유적·기념시설 OSM 참조 위치'
};
const LAYER_LABELS = {
  eup_myeon_stat: '2003 정부보고서 읍·면 공식 인명피해 집계',
  massacre_village: '2020 추가조사 주요 집단학살·초토화 마을',
  mainland_prison: '불법 군법회의 수형인(2,530명) 본토 형무소 이송망',
  archive_site: '공식 4·3 아카이브·평화재단 유적 목록',
  memory_sublimation: '🌈 선흘1리 그림할망 · 기억과 예술 승화'
};

// Precomputed 256-stop Neon KDE Lookup Table matching NotebookLM Slide 8 (deep cobalt -> cyan -> violet -> magenta -> white)
const NEON_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  const stops = [
    [0,   [6, 14, 28, 0]],
    [14,  [20, 48, 130, 0]],
    [45,  [29, 78, 216, 115]],
    [95,  [6, 182, 212, 185]],
    [145, [103, 232, 249, 222]],
    [190, [168, 85, 247, 238]],
    [228, [244, 63, 94, 248]],
    [255, [255, 255, 255, 255]]
  ];
  for (let i = 0; i < 256; i++) {
    let s0 = stops[0], s1 = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (i >= stops[k][0] && i <= stops[k + 1][0]) { s0 = stops[k]; s1 = stops[k + 1]; break; }
    }
    const t = (i - s0[0]) / Math.max(1, s1[0] - s0[0]);
    for (let c = 0; c < 4; c++) lut[i * 4 + c] = Math.round(s0[1][c] + (s1[1][c] - s0[1][c]) * t);
  }
  return lut;
})();

// Grounded geographic reference wireframes for 3D Prism stage (derived from OSM / geoBoundaries / Time-Ok coordinates)
const JEJU_LOOP = [
  [33.513,126.521],[33.546,126.688],[33.517,126.811],[33.465,126.915],[33.405,126.882],
  [33.328,126.834],[33.275,126.718],[33.245,126.571],[33.238,126.425],[33.205,126.281],
  [33.233,126.215],[33.304,126.175],[33.393,126.245],[33.451,126.355],[33.498,126.455],[33.513,126.521]
];
const HALLASAN_RING = [
  [33.392,126.495],[33.402,126.545],[33.382,126.585],[33.345,126.575],[33.332,126.525],[33.352,126.482],[33.392,126.495]
];
const KOREA_SOUTH_COAST = [
  [37.57,126.96],[37.46,126.71],[36.60,126.52],[35.82,126.65],[34.81,126.39],[34.76,127.66],
  [35.10,129.04],[35.84,129.22],[36.57,129.40],[37.55,129.11]
];
const CHILE_SPINE = [
  [-18.48,-70.30],[-20.22,-70.15],[-23.65,-70.40],[-27.36,-70.33],[-29.95,-71.34],[-33.04,-71.62],
  [-33.45,-70.66],[-35.43,-71.66],[-36.82,-73.05],[-38.74,-72.60],[-39.81,-73.24],[-41.47,-72.94],
  [-45.57,-72.07],[-53.16,-70.91]
];

export function renderKDEOnCanvas(canvas, pts, radiusPx = 28, intensity = 1.15) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!pts.length || w < 4 || h < 4) return;

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  const r = Math.max(8, radiusPx);

  for (const p of pts) {
    if (p.x < -r || p.x > w + r || p.y < -r || p.y > h + r) continue;
    const alpha = Math.min(0.88, Math.max(0.08, (p.weight || 1) * 0.14 * intensity));
    const grad = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.42, `rgba(255,255,255,${alpha * 0.52})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    octx.fillStyle = grad;
    octx.beginPath();
    octx.arc(p.x, p.y, r, 0, Math.PI * 2);
    octx.fill();
  }

  const img = octx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 8) { d[i + 3] = 0; continue; }
    const base = a * 4;
    d[i] = NEON_LUT[base];
    d[i + 1] = NEON_LUT[base + 1];
    d[i + 2] = NEON_LUT[base + 2];
    d[i + 3] = NEON_LUT[base + 3];
  }
  ctx.putImageData(img, 0, 0);
}

export function archiveRecordHTML(r) {
  const layerLabel = LAYER_LABELS[r.record_layer] || (r.record_kind === 'site_catalog' ? '공개 유적 목록' : '출처 내 인물 기록');
  return `<div class="source-pill">${E(layerLabel)}</div>
    <h2>${E(r.victim_or_site_name)}</h2>
    ${r.artwork_src ? `<div class="artwork-card"><img src="${E(r.artwork_src)}" alt="고순자 할머니 무지개 그림" onclick="window.openRainbowEpilogue&&window.openRainbowEpilogue()"><div class="artwork-verse">${E(r.artwork_inscription||"")}</div><small style="display:block;margin-top:6px;color:#cbd5e1">클릭하면 〈국토종단 · 무지개 에필로그〉 전체화면이 열립니다 ↗</small></div>` : ""}
    ${r.victim_count ? `<div style="background:#0c1b2a;color:#67e8f9;padding:10px 13px;border-radius:6px;margin:10px 0;font-size:13px">이 기록의 출처별 집계 규모: <strong style="font-size:20px;color:#edbf73">${fmt(r.victim_count)}명</strong></div>` : ''}
    <dl>
      <dt>출처</dt><dd>${E(r.source_title)}</dd>
      <dt>시기·일자</dt><dd>${E(r.date_display || r.event_date || '미상')}</dd>
      <dt>원문 장소·지역</dt><dd>${E(r.location_start || '미상')}${r.location_end ? `<br>→ 이송·최종 기록지: <b>${E(r.location_end)}</b>` : ''}</dd>
      <dt>좌표 성격</dt><dd>${E(PRECISION[r.coordinate_precision] || r.coordinate_precision)}</dd>
      <dt>사건 유형 / 가해주체</dt><dd>${E(r.incident_type || '미상')}${r.perpetrator ? ` · ${E(r.perpetrator)}` : ''}</dd>
      <dt>원자료 내 근거 위치</dt><dd>${E(r.source_page || '미상')}</dd>
    </dl>
    <p class="note">${E(r.silence_note || '')}</p>
    <a class="btn outline small" style="margin-top:10px" href="${E(r.source_url)}" target="_blank" rel="noopener">원자료 출처 확인 ↗</a>`;
}

export function archiveMapShell() {
  return `
  <div class="archive-source-row">
    <div class="segmented" role="group" aria-label="지도 국가">
      <button type="button" data-archive-country="CHL">칠레 (2,398·3,216건)</button>
      <button type="button" data-archive-country="KOR">제주 4·3 종합 (확정 15,218명)</button>
    </div>
    <label class="archive-source-label">자료 출처 <select id="archive-source" aria-label="지도 자료 출처"></select></label>
  </div>
  <p class="archive-source-note" id="archive-source-note"></p>
  <div class="hgis-mode-bar" role="region" aria-label="HGIS 시각화 엔진 선택">
    <div class="hgis-mode-tabs">
      <button type="button" data-hgis-mode="heatmap" class="active">🔥 네온 히트맵 (Slide 8 KDE)</button>
      <button type="button" data-hgis-mode="pillars3d">🧊 3D 공간 프리즘 (규모 높이)</button>
      <button type="button" data-hgis-mode="arcs">🏹 강제이송·실종 아크</button>
      <button type="button" data-hgis-mode="dual">🖼️ 슬라이드 8 듀얼 비교</button>
      <button type="button" data-hgis-mode="clusters">💠 정밀도 클러스터</button>
      <button type="button" data-hgis-mode="missing">🕳️ 결측·침묵 X-Ray</button>
    </div>
    <div class="hgis-subcontrols" id="hgis-subcontrols">
      <label>반경 <input type="range" id="hgis-radius" min="14" max="48" value="28"></label>
      <label>가중치 <select id="hgis-weight"><option value="victims">피해규모(로그)</option><option value="count">기록 건수</option></select></label>
    </div>
  </div>
  <div class="jeju-layer-bar" id="jeju-layer-bar" hidden>
    <span>제주 4·3 조사 계층:</span>
    <button type="button" data-jeju-layer="all" class="active">전체 계층 (합산 금지)</button>
    <button type="button" data-jeju-layer="massacre_village">주요 학살터·마을 (27곳)</button>
    <button type="button" data-jeju-layer="eup_myeon_stat">12개 읍·면 입력 집계</button>
    <button type="button" data-jeju-layer="mainland_prison">본토 9대 형무소 이송 (2,530명)</button>
    <button type="button" data-jeju-layer="archive_site">공식 유적 (60곳)</button>
    <button type="button" class="rainbow-chip" data-jeju-layer="memory_sublimation">🌈 선흘리 무지개할망</button>
  </div>
  <p class="note" id="hgis-reading-note">KDE 반경은 화면 픽셀, 3D 높이는 공간별 규모의 로그값입니다. 전체 계층의 규모는 중복될 수 있어 고유 인원으로 합산하지 않습니다. 이송 아크는 출발·도착 연결이며 실제 이동 경로·속도가 아닙니다. 듀얼 뷰의 색·높이는 국가 간 절대 피해 규모 비교용이 아닙니다.</p><div id="archive-time-controls"></div>
  <div class="archive-map-toolbar">
    <form id="archive-search" class="search-form"><input id="archive-search-input" aria-label="지도 기록 검색" placeholder="이름·마을·학살터·형무소 검색"><button class="btn small" type="submit">검색</button></form>
    <label id="archive-view-wrap">집계 <select id="archive-view" aria-label="지도 표시 방식"></select></label>
    <label id="archive-location-label">장소 <select id="archive-locations" aria-label="기록 장소 선택"><option value="first">첫 장소</option><option value="all">모든 기록 장소</option></select></label>
    <label id="archive-precision-label">좌표 <select id="archive-precision" aria-label="지도 좌표 정확도"><option value="all">전체 정확도</option><option value="exact">정확 좌표</option><option value="approximate">근사·참조 위치</option></select></label>
    <button type="button" class="btn outline small" id="archive-fit">전체 범위</button>
  </div>
  <div class="archive-summary" id="archive-summary" aria-live="polite"></div>
  <div class="map-layout">
    <div class="map-wrap dark-neon" id="hgis-map-wrap">
      <div id="research-map" aria-label="출처별 역사 자료 지도"></div>
      <canvas class="hgis-overlay-canvas" id="hgis-kde-canvas"></canvas>
      <div class="hgis-stage-panel" id="hgis-stage-panel"></div>
      <div class="slide8-callout" id="slide8-callout"></div>
      <div class="slide8-inset" id="slide8-inset" title="클릭하여 반대편 지역(칠레 ↔ 제주 4·3) 본지도로 즉시 전환">
        <canvas id="slide8-inset-canvas" width="205" height="128"></canvas>
        <div class="slide8-inset-label"><span id="slide8-inset-title">제주 4·3 인셋</span><span>전환 ↗</span></div>
      </div>
      <div class="map-readout"><strong id="archive-map-count">—</strong><span id="archive-map-label"></span></div>
      <div class="map-caption" id="archive-map-caption"></div>
    </div>
    <aside class="panel map-detail" id="archive-map-detail"></aside>
  </div>
  <div class="archive-map-help" id="archive-map-help"></div>
  <div id="archive-year-chart"></div>
  <section class="archive-results">
    <div class="archive-results-top">
      <div><h2>지도와 함께 읽는 원자료·조사 기록 목록</h2><p id="archive-list-summary" class="note" aria-live="polite"></p></div>
      <div class="row-actions">
        <button type="button" class="btn outline small" id="archive-clear-selection">묶음 선택 해제</button>
        <button type="button" class="btn outline small" id="archive-export-csv">현재 목록 CSV ↓</button>
        <button type="button" class="btn outline small" id="archive-export-geo">현재 지도 GeoJSON ↓</button>
      </div>
    </div>
    <div id="archive-record-list"></div>
    <div class="archive-pagination" id="archive-pagination"></div>
  </section>`;
}

export function mountArchiveMap({ options, getData, getJSON, apiBase, onMap, onState }) {
  const defaults = {
    source: 'chile-pinochet-2019', year: 1990, allDates: true, includeUnknown: true, cumulative: true,
    search: '', locationMode: 'first', precision: 'all', view: 'auto',
    hgisMode: 'heatmap', kdeRadius: 28, weightMode: 'victims', jejuLayer: 'all'
  };
  for (const [k, v] of Object.entries(defaults)) if (options[k] === undefined) options[k] = v;

  let currentRecord = null, active = true, data = null, counterpartData = null, geography = null, sources = [], filtered = [], selection = null, page = 0;
  let layer = null, selectedLayer = null, features = [], timer = null, animRaf = null, orbitRaf = null, loadId = 0;
  let orbit = { yaw: -24, pitch: 52, zoom: 1.08, auto: true, dragging: false, lx: 0, ly: 0, hitBoxes: [] };

  const map = window.L.map('research-map', { preferCanvas: true, scrollWheelZoom: false });
  const darkLayer = window.L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles © Esri' });
  const satLayer = window.L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, attribution: 'Tiles © Esri, Maxar' });
  const lightLayer = window.L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles © Esri' });
  darkLayer.addTo(map);
  window.L.control.layers({ '다크 네이비 캔버스 (Slide 8)': darkLayer, '위성 지형도 (Esri)': satLayer, '학예 라이트 그레이': lightLayer }, null, { position: 'topleft' }).addTo(map);
  map.on('baselayerchange', e => {
    const wrap = $('#hgis-map-wrap');
    if (!wrap) return;
    wrap.classList.toggle('sat-active', e.name.includes('위성'));
    wrap.classList.toggle('light-active', e.name.includes('라이트'));
  });
  map.setView([-33.8, -70.8], 4);
  layer = window.L.layerGroup().addTo(map);
  onMap?.(map);

  const stopAnim = () => { if (animRaf) { cancelAnimationFrame(animRaf); animRaf = null; } if (orbitRaf) { cancelAnimationFrame(orbitRaf); orbitRaf = null; } };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } const b = $('#archive-play'); if (b) { b.textContent = '▶ 시간 재생'; b.setAttribute('aria-pressed', 'false'); } };
  const chosenRows = () => selection ? filtered.filter(r => selection.ids.has(r.incident_id)) : filtered;

  function pointWeight(r) {
    if (options.weightMode === 'count' || !r.victim_count) return 1;
    return Math.max(1.3, Math.log10(r.victim_count + 1) * 3.4);
  }

  function applyLayerFilter(rows) {
    if (data?.source_id !== 'jeju43-comprehensive' || options.jejuLayer === 'all') return rows;
    return rows.filter(r => r.record_layer === options.jejuLayer);
  }

  function save() {
    onState?.({
      source_id: data?.source_id, source_sha256: data?.source_sha256, snapshot_id: data?.snapshot_id,
      filters: { ...options }, filtered_records: filtered.length, map_feature_count: features.length
    });
  }

  function exportFile(content, name, type) {
    const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function overview() {
    if (!data) return;
    const s = data.official_summary;
    $('#archive-map-detail').innerHTML = s ? `
      <div class="eyebrow">제주 4·3 정부 공식 조사 종합</div>
      <h2>공식 결정 희생자 ${fmt(s.recognized_victims_2026)}명</h2>
      <p class="note">추정 인명피해 ${E(s.estimated_total_toll)} · 확정 유족 ${fmt(s.recognized_bereaved_2026)}명 · 소실 가옥 ${fmt(s.material_damage.burned_buildings)}동 (잃어버린 마을 ${s.material_damage.lost_villages_unrecovered}곳)</p>
      <dl>
        <dt>유형별 공식 결정 (2026.04)</dt>
        <dd>사망 ${fmt(10753)} · 행방불명 ${fmt(3796)} · 수형인 ${fmt(445)} · 후유장애 ${fmt(224)}</dd>
        <dt>읍·면 입력값과 보고서 총계</dt><dd>${fmt(data.rows.filter(r=>r.record_layer==='eup_myeon_stat').reduce((n,r)=>n+r.victim_count,0))}명 / ${fmt(s.report_2003_total)}명 · 차이 87명 원인 확인 중</dd><dt>가해주체 비율 (2003 보고서 14,028명)</dt>
        <dd>토벌대 78.1%(공란 제외 86.1%) · 무장대 12.6% · 미상 9.3%</dd>
        <dt>불법 군법회의 수형인 (2,530명)</dt>
        <dd>사형 384 · 옥중사망 310 · 전쟁 직후 본토 형무소 행불 1,763명</dd>
      </dl>
      <a class="btn outline small" href="${E(data.source_url)}" target="_blank" rel="noopener">제주4·3평화재단 공식 통계 ↗</a>`
      : `<div class="eyebrow">현재 자료</div><h2>${E(data.source)}</h2><p>${E(data.coverage_note)}</p><dl><dt>수집 범위</dt><dd>${fmt(data.count)}개 ${E(data.record_unit)}</dd></dl><a class="btn outline small" href="${E(data.source_url)}" target="_blank" rel="noopener">자료 출처 ↗</a>`;
  }

  function selectedRecord(row, pan = false) {
    currentRecord = row;
    if (selectedLayer) map.removeLayer(selectedLayer);
    selectedLayer = window.L.layerGroup().addTo(map);
    $('#archive-map-detail').innerHTML = archiveRecordHTML(row);
    if (Number.isFinite(row.lat_start) && Number.isFinite(row.lng_start)) {
      window.L.circleMarker([row.lat_start, row.lng_start], { radius: 11, color: '#ffffff', weight: 2.5, fillColor: '#f43f5e', fillOpacity: 0.85 }).addTo(selectedLayer);
      if (pan && options.hgisMode !== 'pillars3d') map.setView([row.lat_start, row.lng_start], Math.max(map.getZoom(), data.country === 'KOR' ? 11 : 7), { animate: false });
    }
    save();
  }

  function bindRecordButtons() {
    document.querySelectorAll('[data-archive-record]').forEach(b => b.onclick = () => {
      const row = data.rows.find(r => r.incident_id === b.dataset.archiveRecord);
      if (row) selectedRecord(row, true);
    });
  }

  function drawList() {
    const rows = chosenRows(), pages = Math.max(1, Math.ceil(rows.length / 24));
    page = Math.min(page, pages - 1);
    $('#archive-list-summary').textContent = `${selection ? '선택한 묶음 · ' : ''}${fmt(rows.length)}개 항목 중 ${rows.length ? fmt(page * 24 + 1) : 0}–${fmt(Math.min((page + 1) * 24, rows.length))} 표시 (좌표 없는 기록도 누락 없이 보존)`;
    $('#archive-record-list').innerHTML = rows.length ? `<div class="archive-record-grid">${rows.slice(page * 24, (page + 1) * 24).map(r => `<button type="button" class="archive-record" data-archive-record="${E(r.incident_id)}"><b>${E(r.victim_or_site_name)}</b><span>${E(r.date_display)} · ${E(r.region_label || r.location_start || '장소 미상')}</span><small>${r.victim_count ? `피해규모 ${fmt(r.victim_count)}명 · ` : ''}${E(r.incident_type || '기록')} · ${r.lat_start !== null ? '좌표 보유' : '좌표 결측 보존'}</small></button>`).join('')}</div>` : '<div class="empty-state">현재 조건에 일치하는 기록이 없습니다.</div>';
    $('#archive-pagination').innerHTML = `<button type="button" class="btn outline small" id="archive-page-prev" ${page === 0 ? 'disabled' : ''}>이전</button><span>${page + 1} / ${pages}</span><button type="button" class="btn outline small" id="archive-page-next" ${page === pages - 1 ? 'disabled' : ''}>다음</button>`;
    $('#archive-page-prev').onclick = () => { page--; drawList(); };
    $('#archive-page-next').onclick = () => { page++; drawList(); };
    bindRecordButtons();
    $('#archive-clear-selection').disabled = !selection;
  }

  function drawInset() {
    const insetBox = $('#slide8-inset'), cvs = $('#slide8-inset-canvas'), titleEl = $('#slide8-inset-title');
    if (!insetBox || !cvs || !data) return;
    if (options.hgisMode !== 'heatmap' && options.hgisMode !== 'arcs') { insetBox.style.display = 'none'; return; }
    insetBox.style.display = 'block';
    const isCHL = data.country === 'CHL';
    titleEl.textContent = isCHL ? '제주 4·3 밀도 인셋 (15,218명)' : '칠레 레티그 인셋 (2,398명)';
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const srcRows = counterpartData?.rows || [];
    if (!srcRows.length) return;

    if (isCHL) {
      // Draw Jeju outline + KDE
      const proj = (lat, lng) => ({ x: 18 + (lng - 126.14) / 0.84 * (cvs.width - 36), y: cvs.height - 16 - (lat - 33.17) / 0.43 * (cvs.height - 32) });
      ctx.strokeStyle = '#1e4976'; ctx.lineWidth = 1.2; ctx.beginPath();
      JEJU_LOOP.forEach(([la, ln], i) => { const p = proj(la, ln); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.closePath(); ctx.stroke();
      const kpts = srcRows.filter(r => r.lat_start && r.lat_start < 34.1 && r.record_layer !== 'eup_myeon_stat').map(r => ({ ...proj(r.lat_start, r.lng_start), weight: r.victim_count ? Math.log10(r.victim_count + 1) * 2.6 : 0.9 }));
      const tmp = document.createElement('canvas'); tmp.width = cvs.width; tmp.height = cvs.height;
      renderKDEOnCanvas(tmp, kpts, 14, 1.35);
      ctx.drawImage(tmp, 0, 0);
    } else {
      const proj = (lat, lng) => ({ x: 35 + (lng - (-76)) / 12 * (cvs.width - 70), y: 10 + (-17 - lat) / 38 * (cvs.height - 20) });
      const kpts = srcRows.filter(r => Number.isFinite(r.lat_start)).map(r => ({ ...proj(r.lat_start, r.lng_start), weight: 0.75 }));
      const tmp = document.createElement('canvas'); tmp.width = cvs.width; tmp.height = cvs.height;
      renderKDEOnCanvas(tmp, kpts, 12, 1.1);
      ctx.drawImage(tmp, 0, 0);
    }
  }

  function render3DStage(stage) {
    const isCHL = data.country === 'CHL';
    const showMainland = !isCHL && (options.jejuLayer === 'all' || options.jejuLayer === 'mainland_prison');
    stage.innerHTML = `
      <div class="hgis-3d-hud">
        <button type="button" id="orbit-auto" class="${orbit.auto ? 'active' : ''}">⟳ 자동 공전</button>
        <button type="button" id="orbit-reset">정면 시점 초기화</button>
        ${!isCHL ? `<button type="button" id="orbit-jeju-focus" class="${!showMainland ? 'active' : ''}">제주 본섬 집중</button><button type="button" id="orbit-mainland-focus" class="${showMainland ? 'active' : ''}">제주→본토 형무소 이송망</button>` : ''}
      </div>
      <canvas id="hgis-3d-canvas"></canvas>
      <div class="hgis-3d-hint">🖱️ 마우스 드래그: 360° 회전·기울기 조절 · 휠: 확대/축소 · 기둥 클릭: 원자료 · 높이: log10(규모+1), 연도축 아님</div>`;
    const cvs = $('#hgis-3d-canvas');
    const rect = stage.getBoundingClientRect();
    cvs.width = Math.max(600, Math.floor(rect.width));
    cvs.height = Math.max(420, Math.floor(rect.height));

    // Aggregate filtered records into spatial 3D bins so pillars are crisp and legible
    let latMin = isCHL ? -54 : 33.16, latMax = isCHL ? -17.5 : (showMainland ? 37.8 : 33.58);
    let lngMin = isCHL ? -75.5 : 126.12, lngMax = isCHL ? -66.5 : (showMainland ? 129.3 : 126.96);

    const binMap = new Map();
    const arcs3D = [];
    const cellLat = (latMax - latMin) / 28, cellLng = (lngMax - lngMin) / 24;
    for (const r of filtered) {
      const la = r.lat_start, ln = r.lng_start;
      if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
      if (la < latMin - 1 || la > latMax + 1) continue;
      const key = `${Math.round(la / cellLat)},${Math.round(ln / cellLng)}`;
      if (!binMap.has(key)) binMap.set(key, { lat: la, lng: ln, weight: 0, count: 0, topRecord: r, maxV: r.victim_count || 1 });
      const b = binMap.get(key);
      const v = r.victim_count || 1;
      b.weight += v;
      b.count += 1;
      if (v >= b.maxV) { b.maxV = v; b.topRecord = r; b.lat = la; b.lng = ln; }
      if (Number.isFinite(r.lat_end) && Number.isFinite(r.lng_end) && (Math.abs(r.lat_end - la) > 0.04 || Math.abs(r.lng_end - ln) > 0.04)) {
        arcs3D.push({ la1: la, ln1: ln, la2: r.lat_end, ln2: r.lng_end, weight: v, rec: r });
      }
    }
    // Also place mainland prison destination pillars when showMainland
    if (showMainland) {
      for (const r of filtered.filter(x => x.record_layer === 'mainland_prison' && Number.isFinite(x.lat_end))) {
        binMap.set('PRI-' + r.incident_id, { lat: r.lat_end, lng: r.lng_end, weight: r.victim_count || 200, count: 1, topRecord: r, isPrison: true });
      }
    }
    const pillars = [...binMap.values()];
    const maxLog = Math.max(1, ...pillars.map(p => Math.log10(p.weight + 1)));

    const toWorld = (lat, lng, z = 0) => {
      const nx = ((lng - (lngMin + lngMax) / 2) / Math.max(0.001, lngMax - lngMin)) * 2.2;
      const ny = (((latMin + latMax) / 2 - lat) / Math.max(0.001, latMax - latMin)) * 2.2;
      return [nx, ny, z];
    };
    const project3D = (wx, wy, wz) => {
      const radY = orbit.yaw * Math.PI / 180, radP = orbit.pitch * Math.PI / 180;
      const rx = wx * Math.cos(radY) - wy * Math.sin(radY);
      const ry = wx * Math.sin(radY) + wy * Math.cos(radY);
      const py = ry * Math.sin(radP) - wz * Math.cos(radP);
      const pz = ry * Math.cos(radP) + wz * Math.sin(radP) + 4.2;
      const scale = (Math.min(cvs.width, cvs.height) * 0.78 * orbit.zoom) / Math.max(1.2, pz);
      return { x: cvs.width * 0.5 + rx * scale, y: cvs.height * 0.56 + py * scale, depth: pz, scale };
    };

    let tick = 0;
    const ctx = cvs.getContext('2d');
    function frame() {
      if (!active || options.hgisMode !== 'pillars3d') return;
      tick += 0.014;
      if (orbit.auto && !orbit.dragging) orbit.yaw = ((orbit.yaw + 0.18 + 180) % 360) - 180;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Floor grid
      ctx.strokeStyle = 'rgba(30, 64, 110, 0.36)';
      ctx.lineWidth = 1;
      for (let g = -1.2; g <= 1.21; g += 0.3) {
        const a = project3D(g, -1.2, 0), b = project3D(g, 1.2, 0);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const c = project3D(-1.2, g, 0), d = project3D(1.2, g, 0);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }

      // Geographic wireframe
      const drawPoly = (poly, stroke, fill) => {
        ctx.beginPath();
        poly.forEach(([la, ln], i) => {
          const [wx, wy] = toWorld(la, ln, 0);
          const p = project3D(wx, wy, 0);
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        });
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke();
      };
      if (isCHL) drawPoly(CHILE_SPINE, '#38bdf8', null);
      else {
        drawPoly(JEJU_LOOP, '#22d3ee', 'rgba(14, 116, 144, 0.16)');
        drawPoly(HALLASAN_RING, 'rgba(103, 232, 249, 0.45)', null);
        if (showMainland) drawPoly(KOREA_SOUTH_COAST, 'rgba(244, 114, 182, 0.55)', null);
      }

      // Sort pillars back-to-front
      const projectedPillars = pillars.map(p => {
        const hWorld = 0.08 + (Math.log10(p.weight + 1) / maxLog) * 0.95;
        const [wx, wy] = toWorld(p.lat, p.lng, 0);
        const base = project3D(wx, wy, 0);
        const top = project3D(wx, wy, hWorld);
        return { ...p, wx, wy, hWorld, base, top };
      }).sort((a, b) => b.base.depth - a.base.depth);

      orbit.hitBoxes = [];
      for (const p of projectedPillars) {
        const wPx = Math.max(4, Math.min(16, p.base.scale * 0.035));
        const ratio = Math.log10(p.weight + 1) / maxLog;
        const colTop = p.isPrison ? '#fb7185' : ratio > 0.72 ? '#f43f5e' : ratio > 0.42 ? '#c084fc' : '#22d3ee';
        const colSide = p.isPrison ? 'rgba(225,29,72,0.72)' : ratio > 0.72 ? 'rgba(244,63,94,0.75)' : ratio > 0.42 ? 'rgba(139,92,246,0.7)' : 'rgba(6,182,212,0.68)';

        // Base glow halo
        const glow = ctx.createRadialGradient(p.base.x, p.base.y, 0, p.base.x, p.base.y, wPx * 2.6);
        glow.addColorStop(0, colSide);
        glow.addColorStop(1, 'rgba(6,182,212,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.base.x, p.base.y, wPx * 2.6, 0, Math.PI * 2); ctx.fill();

        // Extruded 3D prism shaft
        const grad = ctx.createLinearGradient(p.base.x, p.base.y, p.top.x, p.top.y);
        grad.addColorStop(0, 'rgba(15, 35, 66, 0.55)');
        grad.addColorStop(1, colSide);
        ctx.fillStyle = grad;
        ctx.strokeStyle = colTop;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.base.x - wPx * 0.5, p.base.y);
        ctx.lineTo(p.base.x + wPx * 0.5, p.base.y);
        ctx.lineTo(p.top.x + wPx * 0.5, p.top.y);
        ctx.lineTo(p.top.x - wPx * 0.5, p.top.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top glowing cap
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(p.top.x, p.top.y, wPx * 0.58, wPx * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (ratio > 0.62 || p.isPrison) {
          ctx.fillStyle = '#e0f2fe';
          ctx.font = '700 10.5px Pretendard, sans-serif';
          ctx.textAlign = 'center';
          const shortTitle = p.topRecord.victim_or_site_name.split(' (')[0].replace('[공식유적] ', '').slice(0, 9);
          ctx.fillText(`${shortTitle} (${fmt(p.weight)})`, p.top.x, p.top.y - 7);
        }
        orbit.hitBoxes.push({ x1: Math.min(p.base.x, p.top.x) - wPx, x2: Math.max(p.base.x, p.top.x) + wPx, y1: p.top.y - 10, y2: p.base.y + 6, rec: p.topRecord });
      }

      // Animated 3D parabolic displacement / prison transfer arcs (cap to top 80 for silky 60fps)
      const sampleArcs = arcs3D.slice(0, 80);
      sampleArcs.forEach((a, idx) => {
        const [wx1, wy1] = toWorld(a.la1, a.ln1, 0.05);
        const [wx2, wy2] = toWorld(a.la2, a.ln2, 0.05);
        const dist = Math.hypot(wx2 - wx1, wy2 - wy1);
        const apex = Math.min(1.15, 0.22 + dist * 0.45);
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const t = s / 16;
          const x = wx1 + (wx2 - wx1) * t, y = wy1 + (wy2 - wy1) * t, z = 4 * apex * t * (1 - t);
          const pt = project3D(x, y, z);
          s ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y);
        }
        ctx.strokeStyle = isCHL ? 'rgba(56,189,248,0.28)' : 'rgba(251,113,133,0.58)';
        ctx.lineWidth = isCHL ? 1.1 : 1.8;
        ctx.stroke();

        // Moving photon along arc
        const ptT = (tick + idx * 0.13) % 1;
        const px = wx1 + (wx2 - wx1) * ptT, py = wy1 + (wy2 - wy1) * ptT, pz = 4 * apex * ptT * (1 - ptT);
        const phot = project3D(px, py, pz);
        ctx.fillStyle = '#fde047';
        ctx.beginPath(); ctx.arc(phot.x, phot.y, isCHL ? 2.1 : 3.2, 0, Math.PI * 2); ctx.fill();
      });

      orbitRaf = requestAnimationFrame(frame);
    }
    frame();

    cvs.onmousedown = e => { orbit.dragging = true; orbit.lx = e.clientX; orbit.ly = e.clientY; };
    window.addEventListener('mouseup', () => { orbit.dragging = false; }, { passive: true });
    cvs.onmousemove = e => {
      if (!orbit.dragging) return;
      orbit.yaw += (e.clientX - orbit.lx) * 0.45;
      orbit.pitch = Math.max(20, Math.min(78, orbit.pitch + (e.clientY - orbit.ly) * 0.35));
      orbit.lx = e.clientX; orbit.ly = e.clientY;
    };
    cvs.onwheel = e => { e.preventDefault(); orbit.zoom = Math.max(0.68, Math.min(2.3, orbit.zoom - e.deltaY * 0.001)); };
    cvs.onclick = e => {
      const r = cvs.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const hit = [...orbit.hitBoxes].reverse().find(b => mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2);
      if (hit) selectedRecord(hit.rec, false);
    };
    $('#orbit-auto').onclick = () => { orbit.auto = !orbit.auto; $('#orbit-auto').classList.toggle('active', orbit.auto); };
    $('#orbit-reset').onclick = () => { orbit.yaw = -24; orbit.pitch = 52; orbit.zoom = 1.08; };
    if ($('#orbit-jeju-focus')) $('#orbit-jeju-focus').onclick = () => { options.jejuLayer = 'massacre_village'; syncLayerButtons(); draw(); };
    if ($('#orbit-mainland-focus')) $('#orbit-mainland-focus').onclick = () => { options.jejuLayer = 'all'; syncLayerButtons(); draw(); };
  }

  function renderDualStage(stage) {
    const chlRows = data.country === 'CHL' ? data.rows : (counterpartData?.rows || []);
    const korRows = data.country === 'KOR' ? data.rows : (counterpartData?.rows || []);
    stage.innerHTML = `
      <div class="dual-stage">
        <div class="dual-pane"><canvas id="dual-chl"></canvas><div class="dual-pane-head"><strong>칠레 피노체트 정권 희생자 시공간 밀도</strong>Freire 2,398명(좌표 2,109 · 결측 289) · MMDH 3,216명</div></div>
        <div class="dual-pane"><canvas id="dual-kor"></canvas><div class="dual-pane-head"><strong>제주 4·3 진상조사 피해 밀도 (Slide 8 확장)</strong>2026 공식 결정 15,218명 · 읍면 입력합 13,941 (총계와 87 차이) · 주요 학살터·본토 형무소(2,530명)</div></div>
      </div>`;
    const c1 = $('#dual-chl'), c2 = $('#dual-kor');
    const r1 = c1.parentElement.getBoundingClientRect(), r2 = c2.parentElement.getBoundingClientRect();
    c1.width = Math.max(300, Math.floor(r1.width)); c1.height = Math.max(380, Math.floor(r1.height));
    c2.width = Math.max(300, Math.floor(r2.width)); c2.height = Math.max(380, Math.floor(r2.height));

    const pChl = (la, ln) => ({ x: c1.width * 0.25 + (ln - (-75.5)) / 9.5 * (c1.width * 0.5), y: 28 + (-17.5 - la) / 37.5 * (c1.height - 48) });
    const pts1 = chlRows.filter(r => Number.isFinite(r.lat_start)).map(r => ({ ...pChl(r.lat_start, r.lng_start), weight: 0.9 }));
    renderKDEOnCanvas(c1, pts1, 20, 1.2);

    const ctx2 = c2.getContext('2d');
    const pKor = (la, ln) => ({ x: 34 + (ln - 126.13) / 0.84 * (c2.width - 68), y: c2.height - 45 - (la - 33.17) / 0.43 * (c2.height - 110) });
    const pts2 = korRows.filter(r => r.lat_start && r.lat_start < 34.0 && r.record_layer !== 'eup_myeon_stat').map(r => ({ ...pKor(r.lat_start, r.lng_start), weight: r.victim_count ? Math.log10(r.victim_count + 1) * 3.1 : 1.0 }));
    renderKDEOnCanvas(c2, pts2, 26, 1.35);
    ctx2.strokeStyle = 'rgba(103,232,249,0.5)'; ctx2.lineWidth = 1.4; ctx2.beginPath();
    JEJU_LOOP.forEach(([la, ln], i) => { const p = pKor(la, ln); i ? ctx2.lineTo(p.x, p.y) : ctx2.moveTo(p.x, p.y); });
    ctx2.closePath(); ctx2.stroke();
  }

  function renderMissingXRay(stage) {
    const total = data.rows.length;
    const withCoord = data.rows.filter(r => Number.isFinite(r.lat_start)).length;
    const noCoord = total - withCoord;
    const knownDate = data.rows.filter(r => r.date_precision !== 'unknown').length;
    const noDate = total - knownDate;
    const isKOR = data.country === 'KOR';
    stage.innerHTML = `
      <div class="xray-stage">
        <div class="eyebrow" style="color:#67e8f9">Missing Data as Historical Evidence · 결측(침묵) 구조 해부</div>
        <h2 style="color:#fff;font-size:22px;margin-bottom:6px">${isKOR ? '제주 4·3 기록의 계층별 공백과 본토 행방불명 구조' : '칠레 레티그·MMDH 사료의 좌표·일자 결측 프로파일'}</h2>
        <p style="font-size:12.5px;color:#cbd5e1">결측치를 임의 추정으로 메우거나 삭제하지 않고, <b>좌표·날짜의 결측 규모</b>를 표시합니다. 결측 원인은 추가 사료비판의 대상이며 자동으로 판정하지 않습니다.</p>
        <div class="xray-bar">
          <span style="width:${(withCoord / Math.max(1, total) * 100).toFixed(1)}%;background:#06b6d4" title="좌표 확인"></span>
          <span style="width:${(noCoord / Math.max(1, total) * 100).toFixed(1)}%;background:#f43f5e" title="좌표 결측"></span>
        </div>
        <div class="xray-grid">
          ${isKOR ? `
            <div class="xray-card"><strong>3,796명 (24.9%)</strong><span>공식 결정 15,218명 중 행방불명 희생자 (정뜨르·섯알오름·본토 형무소 암매장·해상 수장)</span></div>
            <div class="xray-card"><strong>1,763명 / 2,530명</strong><span>불법 군법회의 수형인 중 한국전쟁 발발 직후 본토 15개 형무소에서 행방불명된 인원 (69.7%)</span></div>
            <div class="xray-card"><strong>14,782명 산술 차이</strong><span>추정 범위 상단 30,000 − 공식 결정 15,218. 별도로 확인된 미신고자 명단이 아니며 공백의 원인은 추가 검증 대상입니다.</span></div>
            <div class="xray-card"><strong>84개 잃어버린 마을</strong><span>중산간 초토화(1948.11~1949.02)로 가옥 39,285동이 소실되어 끝내 복구되지 못한 자연마을</span></div>
          ` : `
            <div class="xray-card"><strong>289건 (12.1%)</strong><span>Freire 2,398건 중 첫 사건 위경도 결측 기록. 좌표 결측만으로 비밀 구금·납치 등의 원인을 판정하지 않습니다.</span></div>
            <div class="xray-card"><strong>109건 (4.5%)</strong><span>사건 발생 연·월·일 미상 기록. 날짜 결측과 강제실종 여부는 서로 다른 속성입니다.</span></div>
            <div class="xray-card"><strong>1,239건 (51.7%)</strong><span>체포 장소(Place 1)와 최종 구금·사망 장소(Place 2)가 분리된 공간 이동·이송 기록</span></div>
            <div class="xray-card"><strong>818건 범위 차이</strong><span>Freire 2,398건과 MMDH 3,216건의 규모 차이. 중복·범위 대조 없이 818명의 추가 희생자로 해석하지 않습니다.</span></div>
          `}
        </div>
      </div>`;
  }

  function drawSpatial() {
    if (!active || !data || !geography) return;
    stopAnim();
    layer.clearLayers();
    features = [];
    const kdeCanvas = $('#hgis-kde-canvas'), stage = $('#hgis-stage-panel'), callout = $('#slide8-callout');
    const size = map.getSize();
    if (kdeCanvas) { kdeCanvas.width = size.x; kdeCanvas.height = size.y; kdeCanvas.getContext('2d').clearRect(0, 0, size.x, size.y); }

    const mode = options.hgisMode;
    const inStage = mode === 'pillars3d' || mode === 'dual' || mode === 'missing';
    if (stage) stage.classList.toggle('active', inStage);
    if (callout) callout.style.display = (mode === 'heatmap' || mode === 'arcs') ? 'block' : 'none';

    let shown = new Set();
    const points = filtered.flatMap(r => recordPoints(r, { ...options, siteReferences: data.mode === 'sites' }));
    for (const p of points) shown.add(p.record.incident_id);

    if (mode === 'pillars3d') { render3DStage(stage); }
    else if (mode === 'dual') { renderDualStage(stage); }
    else if (mode === 'missing') { renderMissingXRay(stage); }
    else if (options.view === 'regions' || data.mode === 'regions') {
      const groups = groupRecords(filtered, geography.groups).sort((a, b) => b.latitude - a.latitude);
      const top = size.y < 480 ? 96 : 110, step = Math.min(28, (size.y - top - 20) / Math.max(groups.length - 1, 1));
      groups.forEach((group, idx) => {
        group.records.forEach(r => shown.add(r.incident_id));
        const lp = map.containerPointToLatLng(window.L.point(size.x - 98, top + idx * step));
        window.L.polyline([[group.latitude, group.longitude], [lp.lat, lp.lng]], { color: '#38bdf8', weight: 1, opacity: 0.5, interactive: false }).addTo(layer);
        window.L.circleMarker([group.latitude, group.longitude], { radius: 4, color: '#67e8f9', weight: 1.5, fillColor: '#ec4899', fillOpacity: 0.85 }).addTo(layer);
        const labelIcon = window.L.divIcon({ className: 'archive-region-label', html: `<span>${E(group.label)}</span><b>${fmt(group.records.length)}</b>`, iconSize: [178, 24], iconAnchor: [89, 12] });
        window.L.marker(lp, { icon: labelIcon }).addTo(layer).on('click', () => { selection = { label: group.label, ids: new Set(group.records.map(r => r.incident_id)) }; page = 0; drawList(); });
      });
    } else if (mode === 'heatmap') {
      const kpts = points.map(p => {
        const px = map.latLngToContainerPoint([p.lat, p.lng]);
        return { x: px.x, y: px.y, weight: pointWeight(p.record) };
      });
      renderKDEOnCanvas(kdeCanvas, kpts, Number(options.kdeRadius) || 28, data.country === 'KOR' ? 1.32 : 1.08);
      // Subtle clickable glowing micro-nodes on top so every hotspot is directly inspectable
      const bins = clusterPoints(points, p => map.project([p.lat, p.lng], map.getZoom()), 26);
      for (const bin of bins) {
        const topRec = bin.records.sort((a, b) => (b.victim_count || 1) - (a.victim_count || 1))[0];
        window.L.circleMarker([bin.lat, bin.lng], {
          radius: bin.records.length > 1 ? 5 : 3.5,
          color: '#ffffff', weight: 0.8, fillColor: '#67e8f9', fillOpacity: 0.45
        }).addTo(layer).on('click', () => selectedRecord(topRec, false));
      }
    } else if (mode === 'arcs') {
      const kpts = points.map(p => {
        const px = map.latLngToContainerPoint([p.lat, p.lng]);
        return { x: px.x, y: px.y, weight: pointWeight(p.record) * 0.7 };
      });
      const arcRecords = filtered.filter(r => Number.isFinite(r.lat_start) && Number.isFinite(r.lat_end) && (Math.abs(r.lat_end - r.lat_start) > 0.015 || Math.abs(r.lng_end - r.lng_start) > 0.015));
      for (const r of arcRecords.slice(0, 220)) {
        window.L.circleMarker([r.lat_end, r.lng_end], { radius: data.country === 'KOR' ? 7 : 3.5, color: '#fda4af', weight: 1.5, fillColor: '#f43f5e', fillOpacity: 0.85 })
          .addTo(layer).on('click', () => selectedRecord(r, false));
      }
      let phase = 0;
      const renderArcsFrame = () => {
        if (!active || options.hgisMode !== 'arcs') return;
        phase = (phase + 0.012) % 1;
        renderKDEOnCanvas(kdeCanvas, kpts, 22, 0.85);
        const ctx = kdeCanvas.getContext('2d');
        arcRecords.slice(0, 160).forEach((r, idx) => {
          const p1 = map.latLngToContainerPoint([r.lat_start, r.lng_start]);
          const p2 = map.latLngToContainerPoint([r.lat_end, r.lng_end]);
          const mx = (p1.x + p2.x) / 2 - (p2.y - p1.y) * 0.22;
          const my = (p1.y + p2.y) / 2 + (p2.x - p1.x) * 0.22;
          ctx.strokeStyle = data.country === 'KOR' ? 'rgba(244, 114, 182, 0.72)' : 'rgba(56, 189, 248, 0.36)';
          ctx.lineWidth = data.country === 'KOR' ? 2.1 : 1.2;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(mx, my, p2.x, p2.y); ctx.stroke();
          const t = (phase + idx * 0.09) % 1, u = 1 - t;
          const gx = u * u * p1.x + 2 * u * t * mx + t * t * p2.x;
          const gy = u * u * p1.y + 2 * u * t * my + t * t * p2.y;
          ctx.fillStyle = '#fde047';
          ctx.beginPath(); ctx.arc(gx, gy, data.country === 'KOR' ? 3.4 : 2.2, 0, Math.PI * 2); ctx.fill();
        });
        animRaf = requestAnimationFrame(renderArcsFrame);
      };
      renderArcsFrame();
    } else {
      const bins = clusterPoints(points, p => map.project([p.lat, p.lng], map.getZoom()));
      for (const bin of bins) {
        if (bin.records.length === 1 && bin.items.length === 1) {
          const p = bin.items[0], exact = p.precision === 'exact';
          window.L.circleMarker([p.lat, p.lng], { radius: 6.5, color: exact ? '#67e8f9' : '#fbbf24', weight: 1.8, fillColor: exact ? '#06b6d4' : '#f59e0b', fillOpacity: exact ? 0.85 : 0.45 })
            .addTo(layer).on('click', () => selectedRecord(p.record));
        } else {
          const sz = Math.min(56, 28 + Math.log2(Math.max(bin.records.length, 1)) * 4);
          const ic = window.L.divIcon({ className: 'archive-cluster', html: `<span>${fmt(bin.records.length)}</span>`, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] });
          window.L.marker([bin.lat, bin.lng], { icon: ic }).addTo(layer).on('click', () => {
            selection = { label: '지도 클러스터 묶음', ids: new Set(bin.records.map(r => r.incident_id)) };
            page = 0; selectedRecord(bin.records[0], false); drawList();
          });
        }
      }
    }

    const rainbowRow = filtered.find(r => r.record_layer === 'memory_sublimation' && Number.isFinite(r.lat_start));
    if (rainbowRow && mode !== 'pillars3d' && mode !== 'dual' && mode !== 'missing') {
      const rIcon = window.L.divIcon({ className: 'rainbow-pin', html: '<span>🌈</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
      window.L.marker([rainbowRow.lat_start, rainbowRow.lng_start], { icon: rIcon, zIndexOffset: 900, title: rainbowRow.victim_or_site_name })
        .addTo(layer).on('click', () => selectedRecord(rainbowRow, true));
    }
    features = points.map(p => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { source_id: p.record.source_id, source_record_id: p.record.source_record_id, name: p.record.victim_or_site_name, victim_count: p.record.victim_count || null, coordinate_precision: p.precision, source_url: p.record.source_url }
    }));

    if (callout) {
      callout.innerHTML = `<b>교차 사료 총괄 (중복 합산 금지)</b>
        · 칠레 Freire DB: 2,398명 (이송궤적 1,239건)<br>
        · 칠레 MMDH 명부: 3,216명 (16개 주)<br>
        · 제주 4·3 공식 결정: 15,218명 (유족 94,262명)<br>
        · 본토 형무소 강제이송 수형인: 2,530명
        <div class="slide8-ramp"><span>저밀도</span><i></i><span>집단학살 코어</span></div>`;
    }
    drawInset();

    const unshown = filtered.length - shown.size;
    const totalHeadline = data.official_summary ? `${fmt(data.official_summary.recognized_victims_2026)}명` : fmt(data.count);
    $('#archive-summary').innerHTML = [
      [data.official_summary ? '2026.04 공식 확정 희생자' : '출처 전체 기록', totalHeadline, data.official_summary ? '유족 94,262명 · 추산 3만명' : data.record_unit],
      ['현재 필터 거점·기록', fmt(filtered.length), data.record_unit],
      ['시공간 좌표 투영', fmt(shown.size), '지도·3D 표시'],
      ['좌표 결측·보존 기록', fmt(unshown), '목록·X-Ray 보존']
    ].map(([l, c, u]) => `<div><small>${E(l)}</small><strong>${E(c)}</strong><span>${E(u)}</span></div>`).join('');

    $('#archive-map-count').textContent = fmt(shown.size);
    $('#archive-map-label').textContent = `${mode === 'pillars3d' ? '3D 프리즘 투영' : mode === 'arcs' ? '강제이송·실종 궤적' : '네온 밀도 투영'} 기록`;
    $('#archive-map-caption').textContent = '배경: Esri Dark Gray / World Imagery ({z}/{y}/{x}) · 출처별 명부와 계층(읍면·학살터·형무소)을 억지로 합산하지 않고 정밀도·결측 그대로 보존합니다.';
    save();
  }

  function syncLayerButtons() {
    const bar = $('#jeju-layer-bar');
    if (!bar) return;
    bar.hidden = data?.source_id !== 'jeju43-comprehensive';
    document.querySelectorAll('[data-jeju-layer]').forEach(b => b.classList.toggle('active', b.dataset.jejuLayer === options.jejuLayer));
  }

  function fit() {
    if (!data) return;
    if (data.country === 'KOR') {
      if (options.hgisMode === 'arcs' || options.jejuLayer === 'mainland_prison') {
        map.fitBounds([[33.15, 126.10], [37.75, 129.25]], { animate: false });
      } else {
        map.fitBounds([[33.18, 126.14], [33.57, 126.95]], { animate: false });
      }
      return;
    }
    if (!features.length) { map.setView([-33.8, -70.8], 4); return; }
    map.fitBounds(window.L.latLngBounds(features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]])).pad(0.1), { maxZoom: 11, animate: false });
  }

  function draw() {
    if (!data) return;
    selection = null; currentRecord = null; page = 0;
    if (selectedLayer) { map.removeLayer(selectedLayer); selectedLayer = null; }
    filtered = applyLayerFilter(filterRecords(data.rows, options));
    overview();
    drawSpatial();
    drawList();
    save();
  }

  function yearChart() {
    const entries = data.official_summary?.temporal_phases
      ? data.official_summary.temporal_phases.map(p => [p.year, p.count])
      : (() => {
          const counts = new Map();
          for (const r of data.rows) { const y = knownYear(r); if (y !== null) counts.set(y, (counts.get(y) || 0) + 1); }
          return [...counts].sort((a, b) => a[0] - b[0]);
        })();
    if (!entries.length) { $('#archive-year-chart').innerHTML = ''; return; }
    const max = Math.max(...entries.map(x => x[1]), 1);
    $('#archive-year-chart').innerHTML = `<div class="archive-mini-timeline"><span>${data.official_summary?.temporal_phases ? '제주 시기 비율 환산<br><small>개인별 날짜 실측 아님 · 지도는 거점 필터</small>' : '연도별 인물 기록<br><small>눌러서 지도 필터</small>'}</span><div>${entries.map(([year, n]) => `<button type="button" data-archive-year="${year}" title="${year}년 ${fmt(n)}"><i style="height:${Math.max(4, n / max * 62)}px"></i><small>${String(year).slice(2)}</small></button>`).join('')}</div></div>`;
    document.querySelectorAll('[data-archive-year]').forEach(b => b.onclick = () => {
      stop(); options.allDates = false; options.includeUnknown = false; options.cumulative = false; options.year = Number(b.dataset.archiveYear);
      timeControls(); draw();
    });
  }

  function timeControls() {
    const years = data.rows.map(knownYear).filter(y => y !== null);
    if (!years.length) { $('#archive-time-controls').innerHTML = ''; options.allDates = true; options.includeUnknown = true; return; }
    const min = Math.min(...years), max = Math.max(...years);
    options.year = Math.max(min, Math.min(max, options.year));
    $('#archive-time-controls').innerHTML = `<div class="map-control-row"><button type="button" class="btn small" id="archive-play" aria-pressed="false">▶ 시간 재생</button><label class="switch-label"><input id="archive-all-dates" type="checkbox" ${options.allDates ? 'checked' : ''}> 전체 기간</label><div class="map-time"><span>${min}</span><input id="archive-year" type="range" aria-label="지도 연도" min="${min}" max="${max}" value="${options.year}" ${options.allDates ? 'disabled' : ''}><output>${options.allDates ? '전체' : options.year}</output><span>${max}</span></div><label class="switch-label"><input id="archive-cumulative" type="checkbox" ${options.cumulative ? 'checked' : ''}> 누적</label><label class="switch-label"><input id="archive-unknown" type="checkbox" ${options.includeUnknown ? 'checked' : ''}> 연도 미상 포함</label></div>`;
    $('#archive-all-dates').onchange = e => { stop(); options.allDates = e.target.checked; options.includeUnknown = options.allDates; timeControls(); draw(); };
    $('#archive-year').oninput = e => { stop(); options.year = Number(e.target.value); $('#archive-year').nextElementSibling.textContent = options.year; draw(); };
    $('#archive-cumulative').onchange = e => { options.cumulative = e.target.checked; draw(); };
    $('#archive-unknown').onchange = e => { options.includeUnknown = e.target.checked; draw(); };
    $('#archive-play').onclick = () => {
      if (timer) { stop(); return; }
      options.allDates = false; options.includeUnknown = false; options.year = min; timeControls(); draw();
      const b = $('#archive-play'); b.textContent = 'Ⅱ 재생 멈춤'; b.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => {
        if (options.year >= max) { stop(); return; }
        options.year++; $('#archive-year').value = options.year; $('#archive-year').nextElementSibling.textContent = options.year; draw();
      }, 1500);
    };
  }

  async function load(source, reset = true) {
    const id = ++loadId; stop(); stopAnim(); layer.clearLayers(); features = [];
    const cfg = sources.find(s => s.id === source) || sources[0];
    if (!cfg) return;
    const response = await getData(cfg.country, cfg.id);
    if (!active || id !== loadId) return;
    data = response; options.source = cfg.id;
    // Preload counterpart in background for Slide-8 Inset & Dual View
    const otherSource = cfg.country === 'CHL' ? 'jeju43-comprehensive' : 'chile-pinochet-2019';
    const otherCountry = cfg.country === 'CHL' ? 'KOR' : 'CHL';
    getData(otherCountry, otherSource).then(res => { counterpartData = res; drawInset(); }).catch(() => {});

    if (reset) { options.allDates = true; options.includeUnknown = true; options.search = ''; options.precision = 'all'; options.jejuLayer = 'all'; }
    options.view = data.mode === 'regions' ? 'regions' : 'points';
    $('#archive-source').value = cfg.id;
    $('#archive-search-input').value = options.search;
    document.querySelectorAll('[data-archive-country]').forEach(b => {
      const on = b.dataset.archiveCountry === cfg.country;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
    $('#archive-source-note').textContent = data.coverage_note;
    $('#archive-view').innerHTML = data.mode === 'regions' ? '<option value="regions">원문 지역별 집계</option>' : '<option value="points">시공간 좌표 투영</option><option value="regions">권역·읍면별 대표 집계</option>';
    $('#archive-view').value = options.view;
    syncLayerButtons();
    timeControls(); yearChart(); fit(); draw();
  }

  let boundaries = null;
  const ready = (async () => {
    try {
      const [index, geo, boundary] = await Promise.all([
        getJSON(`${apiBase}/research/sources`),
        getJSON(`${apiBase}/research/geography`),
        getJSON('data/chile-regions.geojson').catch(() => null)
      ]);
      if (!active) return;
      sources = index.sources; geography = geo;
      if (boundary) boundaries = window.L.geoJSON(boundary, { style: { color: '#38bdf8', weight: 0.8, opacity: 0.35, fillOpacity: 0.02 } });
      $('#archive-source').innerHTML = sources.map(s => `<option value="${s.id}">${E(s.title)} · ${s.official_victims ? `확정 ${fmt(s.official_victims)}명` : `${fmt(s.count)}건`}</option>`).join('');
      $('#archive-source').onchange = e => load(e.target.value);
      document.querySelectorAll('[data-archive-country]').forEach(b => b.onclick = () => load(b.dataset.archiveCountry === 'CHL' ? 'chile-pinochet-2019' : 'jeju43-comprehensive'));
      document.querySelectorAll('[data-hgis-mode]').forEach(b => b.onclick = () => {
        options.hgisMode = b.dataset.hgisMode;
        document.querySelectorAll('[data-hgis-mode]').forEach(x => x.classList.toggle('active', x === b));
        if (options.hgisMode === 'arcs' && data?.country === 'KOR') fit();
        drawSpatial();
      });
      document.querySelectorAll('[data-jeju-layer]').forEach(b => b.onclick = () => { options.jejuLayer = b.dataset.jejuLayer; syncLayerButtons(); fit(); draw(); });
      $('#hgis-radius').oninput = e => { options.kdeRadius = Number(e.target.value); drawSpatial(); };
      $('#hgis-weight').onchange = e => { options.weightMode = e.target.value; drawSpatial(); };
      $('#slide8-inset').onclick = () => load(data?.country === 'CHL' ? 'jeju43-comprehensive' : 'chile-pinochet-2019');
      $('#archive-search').onsubmit = e => { e.preventDefault(); options.search = $('#archive-search-input').value; draw(); };
      $('#archive-view').onchange = e => { options.view = e.target.value; drawSpatial(); };
      $('#archive-locations').onchange = e => { options.locationMode = e.target.value; draw(); };
      $('#archive-precision').onchange = e => { options.precision = e.target.value; draw(); };
      $('#archive-fit').onclick = fit;
      $('#archive-clear-selection').onclick = () => { selection = null; page = 0; overview(); drawList(); };
      $('#archive-export-csv').onclick = () => exportFile(csvRecords(chosenRows()), data.source_id + '-records.csv', 'text/csv;charset=utf-8');
      $('#archive-export-geo').onclick = () => exportFile(JSON.stringify({ type: 'FeatureCollection', source_id: data.source_id, features }, null, 2), data.source_id + '-map.geojson', 'application/geo+json');
      await load(options.source, false);
      map.on('moveend zoomend', () => { if (options.hgisMode === 'heatmap' || options.hgisMode === 'clusters' || options.hgisMode === 'arcs') drawSpatial(); });
    } catch (e) {
      if (active) $('#archive-map-detail').innerHTML = `<div class="error-panel">자료를 불러오지 못했습니다.<br>${E(e.message)}</div>`;
    }
  })();

  return { map, ready, destroy() { active = false; stop(); stopAnim(); map.remove(); } };
}
