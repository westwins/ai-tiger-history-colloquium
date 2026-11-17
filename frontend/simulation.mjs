/* Empirically calibrated stochastic process & Monte Carlo ensemble ABM (v3.1.1).
 * Anchored to real commission outcomes (Korea DSC roster 370 / 2,922 & 2,550 ex-officio;
 * Chile Rettig 2,398 / 3,400 over 39 weeks; Jeju 4.3 14,028 -> 15,218 / 30,000)
 * while keeping cohort micro-mechanics explicit and auditable. */

export const SCENARIOS = {
  A: {
    id: 'A',
    country: 'KOR',
    name: '한국 보안사 명단 (90% 목표 도달 비교)',
    shortName: '한국 보안사 2,922명',
    topic: '누적 인정 총계 370명에 보정한 두 조사 규칙의 조건부 비교',
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
    comparisonWeek: 156,
    comparisonLabel: '비교 기준 156모형주 (공식 법정기한 아님)',
    extendedWeek: 260,
    startYearMonth: [2026, 11],
    baseline: '개별 신청 규칙 모형',
    alternative: '명단 연계·직권조사 규칙 모형',
    proactiveLinkRate: 0.955,
    empiricalAnchor: {
      arm: 'baseline',
      week: 104,
      count: 370,
      label: '★ 한국 누적 인정 총계 370명 (모형 104주에 보정)',
      sourceTitle: '오마이뉴스·인천투데이 (보안사 2,417철·2,922명 중 미조사 2,550명 첫 직권조사 의결, 2026.11)',
      sourceUrl: 'https://www.ohmynews.com/NWS_Web/View/at_pg.aspx?CNTN_CD=A0003281570',
      secondaryUrl: 'https://www.incheontoday.com/news/articleView.html?idxno=224040'
    },
    secondaryAnchor: {
      arm: 'alternative',
      week: 156,
      count: 2922,
      label: '명단 규모 2,922명 (미조사 약 2,550명과 구별)'
    },
    context: '2,922명 명단과 누적 인정 약 370명, 2026년 11월 미조사 약 2,550명 직권조사 결정이 배경입니다. 누적 총계를 모형 104주에 배치해 보정했으며 실제 104주 처리 이력을 재현한 것은 아닙니다. 가상 집단 전체의 90% 목표를 비교하며, 남은 2,550명 전원 완료일이나 법정기한을 예측하지 않습니다.'
  },
  B: {
    id: 'B',
    country: 'CHL',
    name: '칠레 레티그 위원회 (신청주의 반사실 실험)',
    shortName: '칠레 레티그 3,400건',
    topic: 'Freire 자료 2,398건에 보정한 통합·직권 규칙과 개별 신청 가정의 비교',
    excludedLabel: '신청주의 시 고립·보복우려 배제율',
    barrierLabel: '군부 은폐·개별 입증 장벽',
    capacityLabel: '주당 조사·심의 역량(건)',
    capacityMax: 120,
    capacityMin: 15,
    default: [69, 68, 66],
    tunedNote: 'Freire 연구 자료 2,398건을 39모형주 기준값으로 사용함. 위원회 전체 접수·결정 통계와 데이터셋 범위는 별도 대조가 필요함',
    universe: 3400,
    horizonWeeks: 52,
    milestoneWeeks: [0, 13, 26, 39, 52],
    comparisonWeek: 39,
    comparisonLabel: '비교 기준 39모형주 (활동 기간 9개월 참고)',
    extendedWeek: 52,
    startYearMonth: [1990, 5],
    baseline: '반사실: 개별 신청·입증만 허용 시',
    alternative: '통합·직권조사 규칙 모형',
    proactiveLinkRate: 0.86,
    empiricalAnchor: {
      arm: 'alternative',
      week: 39,
      count: 2398,
      label: '★ Freire 자료 2,398건 (39모형주 보정 기준)',
      sourceTitle: 'Freire et al. (2019) Pinochet DB & Rettig Commission 9-Month Mandate',
      sourceUrl: 'https://github.com/danilofreire/pinochet',
      secondaryUrl: 'https://www.beyondintractability.org/casestudy/brahm-chilean'
    },
    secondaryAnchor: {
      arm: 'alternative',
      week: 52,
      count: 3216,
      label: 'MMDH 명부 규모 3,216건 (다른 집계 범위)'
    },
    context: '레티그 보고서에서 구축한 Freire 데이터셋 2,398건과 위원회의 약 9개월 활동 기간을 기준으로 삼았습니다. 두 경로 모두 가상 규칙의 산출값입니다. 그 차이는 관측된 역사적 손실이나 검증된 인과 효과가 아닙니다. MMDH 3,216건은 범위가 다른 명부입니다.'
  },
  C: {
    id: 'C',
    country: 'KOR',
    name: '제주 4·3 진상조사 (추가조사·직권재심 확장)',
    shortName: '제주 4·3 추산 30,000명',
    topic: '과거·현재 집계 총계를 참고한 신고·명단 연계 규칙의 탐색 모형',
    excludedLabel: '일가 절멸(절손)·연좌제 미신고 비율',
    barrierLabel: '호적·수형기록 멸실 장벽',
    capacityLabel: '모형 주당 처리 역량(명)',
    capacityMax: 800,
    capacityMin: 100,
    default: [52, 62, 420],
    tunedNote: '추정 범위 상단 30,000명을 모형 규모로 택하고 14,028명을 52모형주 기준값으로 사용함. 15,218명은 다른 시점의 참고 총계이며 두 총계 모두에 동시에 보정한 결과가 아님',
    universe: 30000,
    horizonWeeks: 104,
    milestoneWeeks: [0, 26, 52, 78, 104],
    comparisonWeek: 52,
    comparisonLabel: '비교 기준 52모형주 (2003년 총계 보정)',
    extendedWeek: 104,
    startYearMonth: null,
    baseline: '개별 유족 신고 규칙 모형',
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
    context: '추정 범위 25,000~30,000명, 2003년 총계 14,028명, 2026년 공식 결정 15,218명은 시점·범위가 다릅니다. 이 모형은 총계들을 압축한 가상 시간에 배치합니다. 모형 주차는 실제 역사 연도나 행정 처리 기간을 뜻하지 않으며, 신고·명단 연계 규칙의 조건부 차이를 탐색합니다.'
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
  if (!Number.isFinite(weeksToAdd)) return '계산 범위 내 목표 미도달';
  if (!startYearMonth) return `${weeksToAdd}모형주차 (실제 달력과 대응하지 않음)`;
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

  const targetCount = Math.ceil(sc.universe * 0.90);
  const targetNode = alternative.find(d => d.mean >= targetCount);
  const target = {
    criterion: 'ensemble_mean_at_least_90_percent_of_universe',
    fraction: 0.9, count: targetCount, reached: Boolean(targetNode),
    week: targetNode?.week ?? null, horizonWeeks: weeks,
    label: targetNode ? `${targetNode.week}모형주차` : `${weeks}모형주까지 목표 미도달`,
    withinComparison: Boolean(targetNode && targetNode.week <= sc.comparisonWeek)
  };

  // Sensitivity analysis (1-at-a-time around current config on primary cohort at comparisonWeek)
  const evalWeek = Math.min(weeks, sc.comparisonWeek || weeks);
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
    target,
    uncertainty: {kind:'conditional_simulation_quantiles',outer:[0.05,0.95],outerCoverage:0.90,inner:[0.25,0.75],innerCoverage:0.50,errorBars:'sample_standard_deviation_across_runs'},
    time: {unit:'model_week',startYearMonth:sc.startYearMonth,calendarIsAssumed:Boolean(sc.startYearMonth),comparisonWeek:sc.comparisonWeek},
    calibration: {
      anchorLabel: anchor.label,
      anchorWeek,
      empiricalValue: anchor.count,
      modelMean: modelAtAnchor,
      modelSd: Math.round((anchor.arm === 'baseline' ? baseline : alternative)[anchorWeek].sd),
      errorPct: Number(calibrationErrorPct.toFixed(1))
    },
    sensitivity: [
      { label: '모형 처리역량 +25% (직권)', delta: deltaCapPlus },
      { label: '모형 처리역량 -25% (직권)', delta: deltaCapMinus },
      { label: '군·정보기관 기록장벽 -15%p 완화', delta: deltaBarMinus },
      { label: '신청주의 미접수 장벽 -15%p 완화', delta: deltaExcMinusBase }
    ]
  };
}
