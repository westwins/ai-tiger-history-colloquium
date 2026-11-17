# 역사연구의 심화 확대 산학화 워크벤치

서울대 역사연구소 제136차 월례집담회 「AI라는 호랑이 등에 올라타기」의 시연 앱입니다. 기존 Oracle Ubuntu의 Nginx·FastAPI·MariaDB 구성을 유지합니다. 데이터베이스를 초기화하거나 기존 레코드를 수정하지 않습니다.

## 여섯 단계

1. 사료비판: 공개 편집 채록본과 공식 통계를 대조하고 5+5 분류와 판단 메모를 브라우저에 저장합니다.
2. 증거 연결: 편집한 논증 지도에서 주장·출처·미수집 검증 자료를 확인합니다. 칠레 인물 기록은 DB에서 검색합니다.
3. 멀리읽기: 강연록 문단의 실제 문자열 빈도·동시 등장과 칠레 데이터의 실제 연도 분포를 계산합니다. 본문과 질의응답을 분리합니다.
4. 시공간 지도: 칠레 연구 자료·MMDH 명부·제주 공식 유적·소개 유적을 출처별로 불러옵니다. 연도·누적·정확도·장소 선택, 겹침 묶음, 지역별 집계와 원자료 목록·CSV·GeoJSON을 제공합니다.
5. 조사 실험: 동일한 가상 기록 200건에 두 조사 규칙을 적용합니다. 주별 접수·증거 대기·처리 한도를 계산하고 난수 씨앗을 보존합니다.
6. 공공역사 제작: 원본 PPTX 사진을 확대하고 관찰을 남깁니다. 대국민 카드·전시 고증 시트·활동지를 HTML·Markdown·JSON·PNG로 저장합니다.

## 자료의 근거

- 강연: 박구병 교수의 2026년 10월 29일 공개 편집 채록본, 216개 문단. 음원은 연결되지 않았습니다.
- 사진: 사용자가 제공한 원본 강연 PPTX에서 추출했습니다. 16개 이미지 중 브라우저가 지원하는 사진 15개를 표시합니다. 원본 파일의 화소 크기와 슬라이드 번호를 보존합니다.
- 칠레: Freire 외(2019)의 2,398명 전체를 보존합니다. 첫 장소 좌표 2,109명·어느 장소든 좌표 보유 2,226명입니다. 일 단위 2,232건·월 단위 57건·미상 109건을 구별합니다. MMDH 공개 명부 3,216건은 지역 정보로 집계하며 개인의 위경도를 만들지 않습니다.
- 남아공 사면: 법무부 2000년 11월 1일 집계에서 신청 전체 7,112건·허가 849건·거절 5,392건·기타 상태 871건을 구별합니다.
- 제주 7건과 기존 코퍼스 9건: 기존 앱의 편집 시드로, 실제 원문 수집이나 전수 분석 결과로 취급하지 않습니다.
- 조사 모형: 교육용 가상 집단입니다. 실제 희생자 수·정책 효과·통계적 MSE 추정이 아닙니다. 계수는 실증 추정치가 아닙니다.

원문 채록본: https://blog.soohwalee.com/2026/10/29/latin-america-trc-transitional-justice-korea/

연구 데이터: https://github.com/danilofreire/pinochet

사면 집계표: https://www.justice.gov.za/trc/amntrans/index.htm

## 파일과 실행

- `frontend/index.html`, `workbench.js`, `workbench.css`: 브라우저 화면과 조작.
- `frontend/research-engine.mjs`: 문자열 집계·문단 분리·시간 집계.
- `frontend/simulation.mjs`: 고정 난수와 주별 과정 모형.
- `frontend/data`: 공개 채록본과 원본 사진 목록.
- `backend/research_api.py`: 읽기 전용 API. 기존 DB 연결 환경변수를 사용합니다.
- `backend/source_metadata.json`: 원자료 날짜·좌표 정확도 대조용 메타데이터.
- `tools/prepare_sources.py`, `extract_pptx_media.py`: 출처 자료 준비. PPTX 경로는 사용자 제공 파일을 가리킵니다.
- `tools/check.mjs`: 출처 연결, 자료 범위, 모형 재현성·기록 보존·처리 한도 검사.

기능 검사:

```sh
node tools/check.mjs
node --check frontend/workbench.js
python3 -m py_compile backend/research_api.py
```

운영 서버에서는 기존 `/home/ubuntu/trc/docker-compose.yml`을 사용합니다. 이 폴더의 frontend·backend 변경분만 반영한 뒤 다음을 실행합니다.

```sh
docker compose up -d --build --no-deps trc-backend trc-frontend
```

DB·수집기 서비스는 재생성하지 않습니다. 기존 연결 환경변수와 데이터 볼륨을 유지합니다. 프런트엔드의 `.mjs` MIME 형식과 정적 자료 폴더 읽기 권한을 확인해야 합니다.

수정 전 서버 백업: `/home/ubuntu/trc-backups/before-colloquium-20261106-070304.tar.gz`.

브라우저 조작 검증 결과와 내려받은 샘플은 `qa/`에 보관합니다. 배포 이미지에는 포함하지 않습니다.

## 아카이브 수집·SQL 파일럿 (2026-11-06)

`data-pipeline/README.md`에 수집 대상과 실행법을 정리했습니다. 칠레 연구 자료 2,398건, MMDH 공개 명부 3,216건, 제주 공개 유적 소개 25곳을 출처별로 보존하여 Oracle의 별도 `trc_research_staging` DB에서 시험 적재·반복 실행을 검증했습니다. 서로 겹치는 출처의 기록을 고유 희생자 수로 합산하지 않습니다. 운영 앱의 기존 DB는 유지했습니다.

대화형 범위 점검 화면: https://trc.soohwalee.com/coverage-review.html

`frontend/coverage-review.html`은 `data-pipeline/build_review.py`로 생성한 검토용 집계 화면입니다. 운영 지도 연결을 완료했습니다. 제주 희생자 전수 명부 및 보고서 전체 OCR은 별도 확보·검수가 필요한 범위입니다.

## 운영 지도 2.1.0

https://trc.soohwalee.com/#step-4 에 네 출처 5,686개 출처별 기록을 연결했습니다. 구성은 Freire 2,398건, MMDH 3,216건, 제주 공식 지역별 유적 47곳, 평화재단 소개 유적 25곳입니다. 서로 겹치는 목록의 합계를 고유 희생자 수로 사용하지 않습니다. 기존 `trc_incidents` 2,116건은 보존하고 `hist_*` 테이블을 추가했습니다.

`backend/archive_api.py`, `geography.json`, `frontend/archive-map.mjs`, `map-engine.mjs`, `archive-map.css`가 새 지도 구현입니다. 날짜 구간·좌표 결측을 보존하고, 점 묶음은 구성 기록 목록으로 연결합니다. MMDH와 제주 유적은 원문 지역 집계로 전체 범위를 보여줍니다. 지역 대표점은 사건 좌표와 다르며, 현대 유적 참고 위치는 OSM을 수동 대조한 출처별 5곳에만 사용합니다.

03단계의 출처별 연도 집계도 동일 API를 읽고 지도에 같은 연도를 전달합니다. 지도 선택의 출처·필터·자료 버전은 06단계 근거 JSON에 포함합니다. `tools/check-map.mjs`, `backend/test_archive_api.py`와 실제 브라우저 내려받기를 검증했습니다. 롤백 이미지·소스·원본 DB 백업은 `/home/ubuntu/trc-backups/map-v21-20261106`에 있습니다.

## 집담회 발표 에디션 업데이트 (v2.2.0 · 2026-11-18)

- **핵심 철학 프레임워크 탑재**: 인문학 = `<인문학자들 머릿속의 시선과 모델>`, 단일 `<서사 채널>`에서 0비용·무한 접속 `<소프트웨어(오토마타) 채널>`로의 확장, `심화(01-02) · 확대(03-05) · 산학화(06) × 디지털 역사학 6대 필드` 명시적 매핑, 체화된 인지·필멸성·AI 안경 시대 **로그스케일 강심장 리더십** 인터랙티브 패널 추가.
- **포스터 양방향 회로 및 60분 발표 연동 큐 바**: 상단 `⚡ 포스터 회로`(단축키 `P`), `🧭 60분 큐시트`, `⛶ 발표 모드`(슬라이드 파트·시간·핵심 한 줄 메시지 상단 고정, 숫자키 `0`~`6` 즉시 전환) 추가.
- **무중단 반영 방법 (MariaDB 변경 없음)**:
  ```sh
  # 압축 해제 폴더에서 안전 배포 스크립트 실행 (자동 백업 포함)
  python3 tools/deploy_colloquium_v22.py
  ```

## 집담회 최종 에디션 업데이트 (v3.0.0 – v3.1.0 · 2026-11-18)

[서울대학교 인문학연구원 역사연구소 제136차 월례집담회](https://www.snu.ac.kr/snunow/events?md=v&bbsidx=178955) 발표용 최종 운영 버전(`v3.1.0`)을 반영했습니다.

- **04 시공간 지도(HGIS) 다중 시각화 엔진 (`v3.0–v3.1`)**:
  - 슬라이드 8 스타일 **네온 KDE 밀도 히트맵**, **대화형 3D 시공간 프리즘(회전·피치·고도 배율 제어)**, **강제 연행·본토 형무소 이송 아크**, **한·칠레 듀얼 비교 뷰**, **결측(Missing Data) X-Ray** 모드를 지원합니다.
  - [Freire et al. (2019) 칠레 피노체트 DB](https://github.com/danilofreire/pinochet)(2,398건), [칠레 기억과 인권 박물관(MMDH) 공개 명부](https://interactivos.museodelamemoria.cl/victims/?page_id=7836)(3,216건)와 함께 **제주 4·3 다층 통합 데이터셋(`jeju43_comprehensive.json`, 109개 공간 레코드)**을 계층 분리 원칙으로 연결했습니다.
  - 제주 4·3 계층은 [제주4·3평화재단 공식 결정 현황(2026.04 기준 희생자 15,218명·유족 94,262명)](https://jeju43peace.or.kr/kor/sub01_01_02.do), [2003 정부 진상조사보고서 12개 읍·면 분포(14,028명)](https://www.jejunews.com/news/articleView.html?idxno=22937), [2020 추가진상조사보고서 Ⅰ 주요 집단학살 마을](https://www.headlinejeju.co.kr/news/articleView.html?idxno=411863), [불법 군법회의 본토 형무소 이송망(2,530명)](https://www.jejunews.com/news/articleView.html?idxno=2223333)을 비합산 독립 레이어로 구분합니다.
- **05 실측 보정 몬테카를로 ABM 시뮬레이터 (`N=28`)**:
  - [칠레 레티그 위원회 9개월(39주) 조사](https://www.beyondintractability.org/casestudy/brahm-chilean)(실측 2,398명 → 신청주의 전환 반사실 시뮬레이션)와 [한국 보안사 강제징집 녹화·선도 공작 명부](https://www.incheontoday.com/news/articleView.html?idxno=224040)(개별 신청 인정 약 370명 → [3기 진화위 약 2,550명 직권조사](https://www.ohmynews.com/NWS_Web/View/at_pg.aspx?CNTN_CD=A0003281570) 완료 주차 예측)를 95%·50% 신뢰구간 밴드, `±1 SD` 에러바, 민감도 토네이도 차트로 검증합니다.
- **무지개 기억·승화 마커 및 에필로그 모달 (`v3.1.0`)**:
  - 제주시 조천읍 선흘1리 [올레미술관 ‘무지개할망’ 고순자 작가](https://www.socialmuseum.net/artists/7)([제주의소리 보도](https://www.jejusori.net/news/articleView.html?idxno=433158))의 2024년작 〈아빠가 나를 사랑해〉와 임진강 민통선을 잇는 〈국토종단〉 에필로그를 HGIS 지도(`HEAL-SEONHEUL-RAINBOW`) 및 전체화면 에필로그 모달(단축키 `R`)에 탑재했습니다.
- **90~110분 집담회 큐시트**: 발표 60분(`12:00–13:00`) + 플로어 심층 질의응답 30~50분(`13:00–13:30 ~ 13:50`) 타임테이블을 연동했습니다.
- **오라클 서버 무중단 반영 (MariaDB 변경 없음)**:
  ```sh
  sudo python3 tools/deploy_colloquium_v31.py
  ```
