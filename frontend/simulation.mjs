/* Empirically calibrated stochastic process & Monte Carlo ensemble ABM (v3.0).
 * Anchored to real commission outcomes (Korea DSC roster 370 / 2,922 & 2,550 ex-officio;
 * Chile Rettig 2,398 / 3,400 over 39 weeks; Jeju 4.3 14,028 -> 15,218 / 30,000)
 * while keeping cohort micro-mechanics explicit and auditable. */

export const SCENARIOS = {
  A: {
    id: 'A',
    country: 'KOR',
    name: '한국 보안사 명단 (직권조사 완료 예측)',
    shortName: '한국 보안사 2,922명',
    topic: '개별 신청주의 실측치(370명) 대 2026.11 직권조사(미조사 2,550명) 완료 시점 예측',
    excludedLabel: '미신청·절손·사찰모름 장벽',
    barrierLabel: '개별 입증·군기록 접근 장벽',
    capacityLabel: '주당 조사·심의 역량(명)',
    capacityMax: 65,
    capacityMin: 8,
    default: [87, 78, 28],
    tunedNote: '보안사 존안문서 2,417철 교차검증 2,922명 중 1·2기 신청주의 인정 370명(12.7%) 실측치에 보정됨',
    universe: 2922,
    horizonWeeks: 180,
    milestoneWeeks: [0, 26, 52, 78, 104, 130, 156, 180],
    statutoryWeek: 156,
    statutoryLabel: '3기 진화위 법정 조사기한 3년 (156주 · 2029.07)',
    extendedWeek: 260,
    startYearMonth: [2026, 11],
    baseline: '개별 신청주의 (1·2기 실측 재현)',
    alternative: '보안사 명단 직권조사 (2,550명 일괄 입건)',
    proactiveLinkRate: 0.955,
    empiricalAnchor: {
      arm: 'baseline',
      week: 104,
      count: 370,
      label: '★ 한국 실측치: 1·2기 신청주의 370명 (12.7%)',
      sourceTitle: '오마이뉴스·인천투데이 (보안사 2,417철·2,922명 중 미조사 2,550명 첫 직권조사 의결, 2026.11)',
      sourceUrl: 'https://www.ohmynews.com/NWS_Web/View/at_pg.aspx?CNTN_CD=A0003281570',
      secondaryUrl: 'https://www.incheontoday.com/news/articleView.html?idxno=224040'
    },
    secondaryAnchor: {
      arm: 'alternative',
      week: 156,
      count: 2922,
      label: '전수 대상 상한: 2,922명 (기인정 370 + 직권 2,550)'
    },
    context: '보안사가 직접 작성해 국가기록원에 이관한 2,417철(113,768쪽) 명단이 존재함에도 개별 신청주의 아래서는 수십 년간 약 370명(12.7%)만 규명되었습니다. 2026년 11월 3일 제3기 진화위가 의결한 미조사자 약 2,550명 직권조사가 주당 처리 역량에 따라 언제 전수 완료되는지(3년 임기 156주 내 달성 여부) 예측합니다.'
  },
  B: {
    id: 'B',
    country: 'CHL',
    name: '칠레 레티그 위원회 (신청주의 반사실 실험)',
    shortName: '칠레 레티그 3,400건',
    topic: '칠레 직권·아카이브 통합 실측치(39주 2,398명) 대 한국식 신청주의 적용 시 반사실 시뮬레이션',
    excludedLabel: '신청주의 시 고립·보복우려 배제율',
    barrierLabel: '군부 은폐·개별 입증 장벽',
    capacityLabel: '주당 조사·심의 역량(건)',
    capacityMax: 120,
    capacityMin: 15,
    default: [69, 68, 66],
    tunedNote: '1990~1991 레티그 위원회 9개월(39주) 심사 약 3,400건 중 2,398명 확정(Freire DB 기준) 실측치에 보정됨',
    universe: 3400,
    horizonWeeks: 52,
    milestoneWeeks: [0, 13, 26, 39, 52],
    statutoryWeek: 39,
    statutoryLabel: '레티그 위원회 실제 활동 기한 9개월 (39주 · 1991.02)',
    extendedWeek: 52,
    startYearMonth: [1990, 5],
    baseline: '반사실: 개별 신청·입증만 허용 시',
    alternative: '실제 칠레: 연대대리구 DB 통합·직권조사',
    proactiveLinkRate: 0.86,
    empiricalAnchor: {
      arm: 'alternative',
      week: 39,
      count: 2398,
      label: '★ 칠레 실측치: 39주 2,398명 확정 (Freire DB)',
      sourceTitle: 'Freire et al. (2019) Pinochet DB & Rettig Commission 9-Month Mandate',
      sourceUrl: 'https://github.com/danilofreire/pinochet',
      secondaryUrl: 'https://www.beyondintractability.org/casestudy/brahm-chilean'
    },
    secondaryAnchor: {
      arm: 'alternative',
      week: 52,
      count: 3216,
      label: '후속 CNRR·MMDH 누적 명부: 3,216명'
    },
    context: '칠레 레티그 위원회는 가톨릭 연대대리구(Vicariate)가 독재 기간 수작업으로 축적한 인권 기록을 즉시 통합하고 60명 조사단이 직권·전국 순회 조사를 수행해 단 9개월(39주) 만에 2,398명(후속 3,216명)을 규명했습니다. 만약 칠레가 한국처럼 개별 신청과 유족 입증 책임에만 의존했다면 얼마나 많은 희생자가 누락되었을지 반사실적으로 실험합니다.'
  },
  C: {
    id: 'C',
    country: 'KOR',
    name: '제주 4·3 진상조사 (추가조사·직권재심 확장)',
    shortName: '제주 4·3 추산 30,000명',
    topic: '유족 신고 중심 결과치(14,028→15,218명) 대 마을 전수조사·수형인 직권재심 결합 효과',
    excludedLabel: '일가 절멸(절손)·연좌제 미신고 비율',
    barrierLabel: '호적·수형기록 멸실 장벽',
    capacityLabel: '분기환산 심의 역량(명)',
    capacityMax: 800,
    capacityMin: 100,
    default: [52, 62, 420],
    tunedNote: '추정 인명피해 30,000명 대비 2003 정부보고서 14,028명(46.8%) · 2026 평화재단 15,218명(50.7%)에 보정됨',
    universe: 30000,
    horizonWeeks: 104,
    milestoneWeeks: [0, 26, 52, 78, 104],
    statutoryWeek: 52,
    statutoryLabel: '2003 정부 진상조사보고서 확정 시점 (14,028명)',
    extendedWeek: 104,
    startYearMonth: [2000, 6],
    baseline: '개별 유족 신고 중심 (실측 정체 재현)',
    alternative: '165개 마을 전수조사·수형인 직권재심 결합',
    proactiveLinkRate: 0.84,
    empiricalAnchor: {
      arm: 'baseline',
      week: 52,
      count: 14028,
      label: '★ 2003 보고서 실측치: 14,028명 (2026년 15,218명)',
      sourceTitle: '제주4·3평화재단 피해실태 (2026.04 공식 결정 15,218명 · 추산 2.5~3만명)',
      sourceUrl: 'https://jeju43peace.or.kr/kor/sub01_01_02.do',
      secondaryUrl: 'https://www.headlinejeju.co.kr/news/articleView.html?idxno=411863'
    },
    secondaryAnchor: {
      arm: 'baseline',
      week: 104,
      count: 15218,
      label: '★ 2026.04 공식 결정: 15,218명'
    },
    context: '제주 4·3은 추정 희생자 2만5천~3만 명 중 일가 전멸(절손)과 연좌제 공포로 인해 개별 신고만으로는 약 1만4천~1만5천 명 선에서 정체되었습니다. 2020 추가진상조사(165개 마을 조사·미신고 1,200여 명 확인)와 군법회의 수형인 2,530명 직권재심 같은 능동적 국가 조사가 왜 필수적인지 보여줍니다.'
  }
};

export function randomFactory(seed) {
  let n = (seed >>> 0) || 1;
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

export function makeCohort(seed, count = 200) {
  const random = randomFactory(seed);
  return Array.from({ length: count }, (_, id) => ({
    id,
    group: Math.floor(id / 5),
    excludedScore: random(),
    archiveScore: random(),
    applicationWeek: 1 + Math.floor(random() * 22),
    evidenceScore: random(),
    outreachWeek: 1 + Math.floor(random() * 10),
    complexityJitter: 0.8 + random() * 0.45
  }));
}

export function runModel(cohort, config, proactive = false, weeks = 52, scenarioKey = 'A') {
  const sc = SCENARIOS[scenarioKey] || SCENARIOS.A;
  const universe = sc.universe || 200;
  const scale = universe / cohort.length;
  const excluded = Math.max(0, Math.min(0.98, Number(config.excluded) / 100));
  const barrier = Math.max(0, Math.min(1, Number(config.barrier) / 100));
  const realCap = Math.max(1, Number(config.capacity));
  const cohortCapFloat = realCap / scale;
  const linkRate = sc.proactiveLinkRate ?? 0.9;

  const agents = cohort.map(a => {
    const outside = a.excludedScore < excluded;
    const linked = proactive && a.archiveScore < linkRate;
    const arrival = (outside && !linked)
      ? Infinity
      : linked
        ? Math.max(1, Math.min(a.applicationWeek, a.outreachWeek))
        : a.applicationWeek + Math.floor(a.evidenceScore * barrier * 14);
    const delay = Math.ceil((2 + a.evidenceScore * barrier * (linked ? 6.5 : 24)) * a.complexityJitter);
    return { ...a, outside, linked, arrival, readyAt: arrival + delay, state: 0 };
  });

  const history = [];
  let capCarry = 0;
  for (let week = 0; week <= weeks; week++) {
    if (week > 0) {
      for (const a of agents) {
        if (a.state === 0 && a.arrival <= week) a.state = 1;
      }
      const ready = agents
        .filter(a => a.state === 1 && a.readyAt <= week)
        .sort((a, b) => a.readyAt - b.readyAt || a.arrival - b.arrival || a.id - b.id);
      capCarry += cohortCapFloat;
      const slots = Math.floor(capCarry + 1e-9);
      if (slots > 0) {
        const take = Math.min(slots, ready.length);
        for (let i = 0; i < take; i++) ready[i].state = 2;
        capCarry -= slots;
        if (capCarry < 0) capCarry = 0;
      }
    }
    const states = agents.map(a => a.state);
    const c0 = states.filter(s => s === 0).length;
    const c1 = states.filter(s => s === 1).length;
    const c2 = states.filter(s => s === 2).length;
    history.push({
      week,
      states,
      outside: c0,
      waiting: c1,
      recorded: c2,
      realOutside: Math.round(c0 * scale),
      realWaiting: Math.round(c1 * scale),
      realRecorded: Math.round(c2 * scale)
    });
  }
  return history;
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

export function formatForecastMonth(startYearMonth, weeksToAdd) {
  if (!Number.isFinite(weeksToAdd)) return '기한 내 도달 불가';
  const [y0, m0] = startYearMonth || [2026, 11];
  const totalMonths = (y0 * 12 + (m0 - 1)) + Math.round(weeksToAdd / 4.345);
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  return `${y}년 ${m}월경 (${weeksToAdd}주차)`;
}

export function comparePolicies(config, seed = 20261118, count = 200, scenarioKey = 'A', runs = 28) {
  const sc = SCENARIOS[scenarioKey] || SCENARIOS.A;
  const weeks = sc.horizonWeeks || 52;
  const primaryCohort = makeCohort(seed, count);
  const basePrimary = runModel(primaryCohort, config, false, weeks, sc.id);
  const altPrimary = runModel(primaryCohort, config, true, weeks, sc.id);

  const baseRuns = [basePrimary];
  const altRuns = [altPrimary];
  for (let r = 1; r < runs; r++) {
    const c = makeCohort(seed + r * 7919, count);
    baseRuns.push(runModel(c, config, false, weeks, sc.id));
    altRuns.push(runModel(c, config, true, weeks, sc.id));
  }

  const summarize = (allRuns, primary) => {
    const series = [];
    for (let w = 0; w <= weeks; w++) {
      const vals = allRuns.map(run => run[w].realRecorded).sort((a, b) => a - b);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1);
      series.push({
        week: w,
        states: primary[w].states,
        outside: primary[w].outside,
        waiting: primary[w].waiting,
        recorded: primary[w].recorded,
        realOutside: Math.round(allRuns.reduce((s, r) => s + r[w].realOutside, 0) / vals.length),
        realWaiting: Math.round(allRuns.reduce((s, r) => s + r[w].realWaiting, 0) / vals.length),
        realRecorded: Math.round(mean),
        mean,
        sd: Math.sqrt(variance),
        p05: Math.round(quantile(vals, 0.05)),
        p25: Math.round(quantile(vals, 0.25)),
        p50: Math.round(quantile(vals, 0.50)),
        p75: Math.round(quantile(vals, 0.75)),
        p95: Math.round(quantile(vals, 0.95))
      });
    }
    return series;
  };

  const baseline = summarize(baseRuns, basePrimary);
  const alternative = summarize(altRuns, altPrimary);

  // Target completion calculation (90% of reachable proactive target or 90% of universe)
  const target90 = Math.round(sc.universe * 0.90);
  const reachableTarget = Math.round(sc.universe * Math.max(1 - Number(config.excluded) / 100, sc.proactiveLinkRate || 0.9) * 0.96);
  const completion90Node = alternative.find(d => d.realRecorded >= target90);
  const completionReachableNode = alternative.find(d => d.realRecorded >= reachableTarget && reachableTarget > 0);
  const completionWeek = completion90Node ? completion90Node.week : (completionReachableNode ? completionReachableNode.week : Infinity);

  // Sensitivity analysis (1-at-a-time around current config on primary cohort at statutoryWeek)
  const evalWeek = Math.min(weeks, sc.statutoryWeek || weeks);
  const refAlt = altPrimary[evalWeek].realRecorded;
  const refBase = basePrimary[evalWeek].realRecorded;
  const deltaCapPlus = runModel(primaryCohort, { ...config, capacity: Number(config.capacity) * 1.25 }, true, weeks, sc.id)[evalWeek].realRecorded - refAlt;
  const deltaCapMinus = runModel(primaryCohort, { ...config, capacity: Math.max(1, Number(config.capacity) * 0.75) }, true, weeks, sc.id)[evalWeek].realRecorded - refAlt;
  const deltaBarMinus = runModel(primaryCohort, { ...config, barrier: Math.max(0, Number(config.barrier) - 15) }, true, weeks, sc.id)[evalWeek].realRecorded - refAlt;
  const deltaExcMinusBase = runModel(primaryCohort, { ...config, excluded: Math.max(0, Number(config.excluded) - 15) }, false, weeks, sc.id)[evalWeek].realRecorded - refBase;

  const anchor = sc.empiricalAnchor;
  const anchorWeek = Math.min(weeks, anchor.week);
  const modelAtAnchor = (anchor.arm === 'baseline' ? baseline : alternative)[anchorWeek].realRecorded;
  const calibrationErrorPct = Math.abs(modelAtAnchor - anchor.count) / Math.max(1, anchor.count) * 100;

  return {
    seed,
    count,
    runs,
    scenario: sc.id,
    universe: sc.universe,
    weeks,
    config: { ...config },
    baseline,
    alternative,
    completionWeek,
    completionLabel: formatForecastMonth(sc.startYearMonth, completionWeek),
    withinStatutory: completionWeek <= (sc.statutoryWeek || weeks),
    calibration: {
      anchorLabel: anchor.label,
      anchorWeek,
      empiricalValue: anchor.count,
      modelMean: modelAtAnchor,
      modelSd: Math.round((anchor.arm === 'baseline' ? baseline : alternative)[anchorWeek].sd),
      errorPct: Number(calibrationErrorPct.toFixed(1))
    },
    sensitivity: [
      { label: '주당 처리역량 +25% 확충 (직권)', delta: deltaCapPlus },
      { label: '주당 처리역량 -25% 축소 (직권)', delta: deltaCapMinus },
      { label: '군·정보기관 기록장벽 -15%p 완화', delta: deltaBarMinus },
      { label: '신청주의 미접수 장벽 -15%p 완화', delta: deltaExcMinusBase }
    ]
  };
}
