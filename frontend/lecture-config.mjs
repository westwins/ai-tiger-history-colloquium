// Final 20-slide speaker notes, 2026-11-18. Minute offsets from 12:00.
export const PRESENTATION_CUES = [
  {start:0,end:10,slides:[1,3],title:'인문학의 시선과 모델',screen:'시연 ① 포스터 회로 (P)',message:'시선과 모델 → 서사·오토마타 채널 → 파란 지휘·주황 반추 회로',action:'poster',button:'포스터'},
  {start:10,end:22,slides:[4,6],title:'단일 씨앗과 연구의 심화',screen:'시연 ② 01 사료비판 · 02 증거 연결',message:'216문단 → 발화·공식 집계 대조 → 가설·반론과 추가 증거',action:'1',button:'01 열기'},
  {start:22,end:40,slides:[7,9],title:'계량·지도·조사 규칙 비교',screen:'시연 ③ 03 멀리읽기 · 04 지도 · 05 ABM',message:'문단으로 돌아가는 계량 → 자료 단위를 구별한 지도 → 관측 총계 보정과 조건부 모형 비교',action:'4',button:'04 지도'},
  {start:40,end:45,slides:[10,10],title:'공공역사 제작',screen:'시연 ④ 06 공공역사 제작',message:'사진 관찰 → 고증 시트·수업 교안 → 출처·판단·가정 함께 저장',action:'6',button:'06 열기'},
  {start:45,end:51,slides:[11,13],title:'국제 비교와 디지털 공론장',screen:'칠레 GitHub · 예일 CGDB/LUX · 한국 데이터 공유',message:'사료 개방의 검증 경로 → 한국 직권조사와 공개 데이터의 차이 → 공론장의 책임',action:'5',button:'05 실험'},
  {start:51,end:57,slides:[14,19],title:'인간의 책임과 강심장 리더십',screen:'00 테제 · 시선의 확장',message:'필멸성 → 교육과 시선 → 역사적 책임 → 워크벤치 안내',action:'log',button:'00 테제'},
  {start:57,end:60,slides:[20,20],title:'데이터 너머의 무지개',screen:'무지개 에필로그 (R)',message:'선흘리 고순자 작가의 그림과 〈국토종단〉 → 인간 역사가의 시선 → 토론 전환',action:'rainbow',button:'🌈 에필로그'}
];
export function cueTime(minute) { return `${12+Math.floor(minute/60)}:${String(minute%60).padStart(2,'0')}`; }

export function presentationShortcut(event, step=0) {
  const target=event.target;
  if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing||event.repeat) return null;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')||target?.isContentEditable||target?.closest?.('[role="textbox"]')) return null;
  const key=event.key.toLowerCase();
  if(/^[0-6]$/.test(key)) return {kind:'step',value:Number(key)};
  if(key==='arrowright'&&step<6) return {kind:'step',value:step+1};
  if(key==='arrowleft'&&step>0) return {kind:'step',value:step-1};
  return {p:{kind:'poster'},r:{kind:'rainbow'},c:{kind:'cue'}}[key]||null;
}
