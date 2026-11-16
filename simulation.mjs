/* A synthetic cohort, not historical victim estimates. One tick is one model week. */
export const SCENARIOS = {
  A: {name:'제주 4·3', topic:'신청할 사람이 없는 가구', excludedLabel:'신청 주체가 없는 비율', default:[25,55,6], baseline:'개별 신청 중심', alternative:'명단 연계·직권 조사',
      context:'절손·고령·미신청이 조사 진입에 미치는 영향을 질문합니다. 제주 희생자 수를 추정하는 모형이 아닙니다.'},
  B: {name:'칠레', topic:'조사 범위 밖의 사람들', excludedLabel:'기존 조사 범위 밖의 비율', default:[35,65,6], baseline:'기존 범위·개별 접수', alternative:'범위 확대·명단 연계',
      context:'조사 대상의 범위를 달리했을 때 어떤 가상 기록이 새로 진입하는지 비교합니다. 레티그·발레치 위원회의 실제 처리 실적을 재현하지 않습니다.'},
  C: {name:'페루·과테말라', topic:'언어와 거리가 만드는 장벽', excludedLabel:'언어·접근 장벽 집단 비율', default:[40,70,6], baseline:'중앙 접수 중심', alternative:'이동 조사·언어 지원',
      context:'접수 창구에 도달하기 어려운 집단을 찾아가는 조사의 효과를 가정합니다. 사망자 추정이나 다중시스템추정(MSE) 구현이 아닙니다.'}
};
function randomFactory(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(1664525,n) + 1013904223) >>> 0; return n / 4294967296; };
}
export function makeCohort(seed, count = 200) {
  const random = randomFactory(seed);
  return Array.from({length:count}, (_,id) => ({id, group:Math.floor(id/5), excludedScore:random(), archiveScore:random(), applicationWeek:1+Math.floor(random()*18), evidenceScore:random(), outreachWeek:1+Math.floor(random()*12)}));
}
export function runModel(cohort, config, proactive = false, weeks = 52) {
  const excluded = Math.max(0,Math.min(1,Number(config.excluded)/100));
  const barrier = Math.max(0,Math.min(1,Number(config.barrier)/100));
  const capacity = Math.max(1,Math.floor(Number(config.capacity)));
  const agents = cohort.map(a => {
    const outside = a.excludedScore < excluded;
    const linked = proactive && a.archiveScore > .2;
    const arrival = outside && !linked ? Infinity : linked ? Math.min(a.applicationWeek,a.outreachWeek) : a.applicationWeek;
    const delay = Math.ceil(2 + a.evidenceScore * barrier * (linked ? 8 : 24));
    return {...a, outside, linked, arrival, readyAt:arrival+delay, state:0};
  });
  const history = [];
  for (let week = 0; week <= weeks; week++) {
    if (week) {
      for (const a of agents) if (a.state === 0 && a.arrival <= week) a.state = 1;
      const ready = agents.filter(a => a.state === 1 && a.readyAt <= week).sort((a,b)=>a.arrival-b.arrival || a.id-b.id);
      for (const a of ready.slice(0,capacity)) a.state = 2;
    }
    const states = agents.map(a => a.state), count = status => states.filter(s=>s===status).length;
    history.push({week, states, outside:count(0), waiting:count(1), recorded:count(2)});
  }
  return history;
}
export function comparePolicies(config, seed = 20261118, count = 200) {
  const cohort = makeCohort(seed,count);
  return {seed, count, config:{...config}, baseline:runModel(cohort,config,false), alternative:runModel(cohort,config,true)};
}
