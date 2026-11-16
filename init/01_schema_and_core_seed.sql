SET NAMES utf8mb4;
USE trc_archive;

CREATE TABLE IF NOT EXISTS trc_lecture_discourse (
    discourse_id INT AUTO_INCREMENT PRIMARY KEY,
    section_no INT NOT NULL,
    slide_label VARCHAR(80),
    speaker VARCHAR(100) NOT NULL,
    speaker_role ENUM('LECTURER_SLIDE', 'LECTURER_ORAL', 'FLOOR_REBUTTAL', 'EDITOR_CRITIQUE') NOT NULL,
    foreign_terms JSON NULL,
    content_html TEXT NOT NULL,
    epistemic_layer VARCHAR(40) NOT NULL,
    silence_layer VARCHAR(40) DEFAULT '0_DOCUMENTED',
    verification_badge VARCHAR(255) NULL,
    verification_detail TEXT NULL,
    linked_app_target INT DEFAULT 3,
    resp_tag VARCHAR(50) DEFAULT '@soohwa_ai',
    cert_score DECIMAL(3,2) DEFAULT 0.95
);

INSERT INTO trc_lecture_discourse
(section_no, slide_label, speaker, speaker_role, foreign_terms, content_html, epistemic_layer, silence_layer, verification_badge, verification_detail, linked_app_target, resp_tag, cert_score)
VALUES
(2, 'Slide 3 · 과거사 정리와 이행기 정의', '박구병 교수 (서양사 85 / 진실화해위원)', 'LECTURER_ORAL',
 '["épuration (숙청/정화)", "реабилитация / reabilitatsiya (재활/복권)", "Vergangenheitsbewältigung (과거사 극복)", "enfrentamiento (대면/도전)"]',
 '소련/러시아권에서는 오랜 인고의 시간을 겪은 뒤 복권되는 과정을 <b class="text-sky-300">재활(реабилитация, reabilitatsiya)</b>이라 불렀고, 독일어권에서는 영어의 overcoming에 가까운 <b class="text-sky-300">페어강엔하이츠베벨티궁(Vergangenheitsbewältigung, 과거사 극복)</b>을 씁니다. 에스파냐어권에서는 과거와 마주한다는 <b class="text-sky-300">엔프렌타미엔토(enfrentamiento, 대면/도전)</b>를 쓰며, 2005년 안병직 선생님(서양사 74) 연구팀의 『세계의 과거사 청산』에서는 이를 <b class="text-amber-300">과거사 정리(규명 + 성찰)</b>로 종합했습니다.',
 '3_SPECIFIC_THEORY', '0_DOCUMENTED',
 '다국어 원어 100% 정밀 복원', '비전문가 속기사가 채록 불가능한 독·불·노·서 4개 국어 개념어를 AI 문맥 추론으로 원어 괄호 병기 완료.', 3, '@park_kb', 0.98),

(2, 'Slide 4 · 늦게 태어난 세대의 은총인가, 부담인가', '박구병 교수 (서양사 85)', 'LECTURER_ORAL',
 '["Aufarbeitung (처리/해결/복구)", "asunción del pasado (책임을 떠맡음/채무 인수)", "Helmut Kohl & Jürgen Habermas"]',
 '독일의 헬무트 콜이나 위르겐 하버마스는 과거사 정리를 일컬어 <b>“늦게 태어난 세대가 누리는 은총(행운)”</b>이라 불렀지만, 라틴아메리카의 <b class="text-sky-300">아순시온 델 파사도(asunción del pasado, 과거의 책임을 떠맡음)</b>처럼 제가 생각할수록 사실은 <b class="text-amber-300">“늦게 태어난 세대의 부담”</b>입니다. 앞으로 나이를 먹어갈 젊은 후속 세대에게 이 짐을 어떻게 덜어줄지 고민해야 합니다.',
 '2_SCHOLAR_INFERENCE', '0_DOCUMENTED',
 '공공역사·적응형 LMS 핵심 테제', '박구병 교수가 메일 답신에서 강조한 진화위의 대국민 홍보 및 교육적 설득 과제와 직결.', 6, '@park_kb', 0.95),

(6, 'Slide 12 · 남아프리카공화국 TRC 사면 비교', '박구병 교수 발화 ⇄ 이수화 사료비판 레이어', 'EDITOR_CRITIQUE',
 '["South African TRC", "DOJ Official Amnesty Table (7,112)"]',
 '[강연 발화 보존]: “남아공 진실화해위원회에서는 가해자가 진실을 고백하면 사면하는 방식을 취해 약 7천 명 정도가 사면을 받았고...”',
 '1_PRIMARY_FACT', '0_DOCUMENTED',
 '⚠️ 사료비판 교차검증 (신청 vs 허가 분리)', '남아공 법무부(DOJ, 2000.11.1) 공식 표 대조 결과: 7,112건은 사면 신청 총수(Total Applications)이며 실제 허가(Granted)는 별도 집계됨. 원음 발화는 보존하되 사실 검증 레이어를 스탠드오프 마크업으로 분리함.', 2, '@soohwa_critique', 1.00),

(9, 'Q&A 제9절 · 왜 한국의 과거사 정리는 지연되는가?', '정지석 동문 (피해 당사자·기구 활동가) ⇄ 박구병 교수', 'FLOOR_REBUTTAL',
 '["Individual Application Bottleneck (개인별 신청·입증 병목)", "기존재 명단 (수형인·학적부)", "침묵 층위 3 (절손·고령 사망)"]',
 '<b class="text-amber-300">[정지석 동문 질문]:</b> “교수님께서는 자료 접근 제약과 인력 부족을 설명하셨지만, 실제 지연을 부르는 핵심 원인은 <b>이미 존재하는 명단(수형인·예비검속 등)에도 피해자 개인별로 신청과 입증을 무한 반복시키는 조사 방식 자체</b>에 있는 것 아닙니까?”<br><b class="text-sky-300">[박구병 교수 응답]:</b> “정 선생님의 문제 제기에 공감하며, 사건 전체의 구조보다 개인별 조사로 해석하는 관행이 한계를 낳고 있음을 인정합니다.”',
 '4_CONTESTED_CLAIM', '3_VOICELESS_GROUP',
 '🔥 정상-반론 병렬 증거망 & ABM 핵심 가설', '본문 요약형 AI는 누락하기 쉬운 현장 저항. 개인별 입증 요구가 고령 유족 사망 및 절손 가구의 침묵(층위 3)을 어떻게 증폭시키는지 App 3와 App 5에서 정량 검증.', 5, '@jung_js', 0.96);

CREATE TABLE IF NOT EXISTS trc_evidence_nodes (
    node_id VARCHAR(50) PRIMARY KEY,
    node_type VARCHAR(40) NOT NULL,
    label_ko VARCHAR(200) NOT NULL,
    epistemic_tag VARCHAR(50),
    confidence DECIMAL(3,2),
    source_ref VARCHAR(255)
);

INSERT INTO trc_evidence_nodes VALUES
('N_DELAY', 'PHENOMENON', '한국 과거사 정리 및 진실규명의 구조적 지연', '1_PRIMARY_FACT', 0.99, '박구병 강연록 제5~9절'),
('H_PARK', 'HYPOTHESIS_MAIN', '[가설 A: 제도·자원 한계론] 한시적 기구 제약 + 국정원·군 비공개 사료 + 조사 인력 부족', '2_SCHOLAR_INFERENCE', 0.85, '박구병 본문 발표'),
('H_JUNG', 'HYPOTHESIS_COUNTER', '[가설 B: 절차적 병목론] 명단 존재 사건조차 개인별 신청·입증을 반복 요구하는 관료적 조사 관행', '4_CONTESTED_CLAIM', 0.92, '정지석 동문 Q&A 반론'),
('S_ROSTER', 'PRIMARY_SOURCE', '기확보 집단 명단 (4·3 수형인 명부 2,530명 / 예비검속 명단 / 칠레 레티그 2,398명)', '1_PRIMARY_FACT', 0.98, '국가기록원·4·3평화기념관'),
('S_SECRET', 'SILENCE_GAP', '[침묵 층위 4] 군·정보기관 비공개 및 파기 기록 (발포·암매장 명령 계통)', '4_INTENTIONAL_ERASURE', 0.35, '이동원 소장 침묵 분류 4'),
('S_EXTINCT', 'SILENCE_GAP', '[침묵 층위 3] 중산간 일가족 몰살(절손·무후) 및 고령 유족 사망으로 인한 미신청 암수', '3_VOICELESS_GROUP', 0.90, '이동원 소장 침묵 분류 3');

CREATE TABLE IF NOT EXISTS trc_corpus_documents (
    doc_id INT AUTO_INCREMENT PRIMARY KEY,
    preset_group VARCHAR(40) NOT NULL,
    era_bucket VARCHAR(50) NOT NULL,
    doc_year INT NOT NULL,
    source_title VARCHAR(200) NOT NULL,
    speaker_type VARCHAR(40) NOT NULL,
    text_segment TEXT NOT NULL,
    keywords_json JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS trc_incidents (
    incident_id VARCHAR(64) PRIMARY KEY,
    country_code ENUM('CHL', 'KOR', 'ARG') NOT NULL,
    autoplay_phase TINYINT NOT NULL,
    victim_or_site_name VARCHAR(200) NOT NULL,
    age INT NULL,
    occupation VARCHAR(100) NULL,
    affiliation VARCHAR(100) NULL,
    incident_type VARCHAR(80) NOT NULL,
    perpetrator VARCHAR(150) NULL,
    event_date DATE NULL,
    lat_start DECIMAL(10,7) NOT NULL,
    lng_start DECIMAL(10,7) NOT NULL,
    lat_end DECIMAL(10,7) NULL,
    lng_end DECIMAL(10,7) NULL,
    is_exact_coord BOOLEAN DEFAULT TRUE,
    epistemic_layer VARCHAR(40) DEFAULT '1_PRIMARY_FACT',
    silence_layer VARCHAR(40) DEFAULT '0_DOCUMENTED',
    source_page VARCHAR(150) NULL,
    narrative_ko TEXT NULL
);

INSERT INTO trc_incidents VALUES
('KOR_J43_01', 'KOR', 1, '관덕정 광장 (3·1절 발포 사건 발단)', NULL, '도민 시위대', '제주도민', 'OPENING_FIRE', '미군정 경찰', '1947-03-01', 33.5134000, 126.5219000, 33.5134000, 126.5219000, TRUE, '1_PRIMARY_FACT', '0_DOCUMENTED', '제주4·3진상조사보고서 p.115', '1947년 3·1절 기념식 직후 기마경찰 말발굽 사건 항의 군중에 경찰 발포(6명 사망). 4·3의 역사적 기점.'),
('KOR_J43_02', 'KOR', 2, '무등이왓 (중산간 5km 소개령 & 잃어버린 마을)', NULL, '중산간 농민 (130호)', '안덕면 동광리', 'LOST_VILLAGE_MASSACRE', '제2연대 및 토벌대', '1948-11-15', 33.3182000, 126.3421000, 33.3145000, 126.3350000, TRUE, '1_PRIMARY_FACT', '3_VOICELESS_GROUP', '제주4·3평화기념관 잃어버린 마을 DB', '1948년 11월 중산간 소개령 직후 마을 전체 방화·초토화. 일가족 몰살(절손)로 전후 개인별 신고에서 누락된 대표적 침묵 공간.'),
('KOR_J43_03', 'KOR', 2, '북촌리 너븐숭이 (단일 최대 집단학살지)', NULL, '북촌리 주민 약 400명', '조천읍 북촌리', 'MASSACRE_SITE', '제2연대 3대대', '1949-01-17', 33.5461000, 126.6883000, 33.5461000, 126.6883000, TRUE, '1_PRIMARY_FACT', '0_DOCUMENTED', '제주4·3진상조사보고서 p.362', '군인 2명 피습 보복으로 북촌초교에 주민을 집결시킨 뒤 하루에 300~400여 명을 집단 총살.'),
('KOR_J43_04', 'KOR', 3, '큰넓궤 동굴 → 정방폭포 (은신 및 학살 궤적)', NULL, '동광리 피난 주민', '중산간 피난민', 'HIDE_AND_EXECUTION', '토벌대', '1948-12-15', 33.3210000, 126.3510000, 33.2447000, 126.5717000, FALSE, '1_PRIMARY_FACT', '4_INTENTIONAL_ERASURE', '제주4·3 아카이브 구술채록', '무등이왓 초토화 후 한라산 큰넓궤 동굴에서 50여 일간 은신하다 발각되어 서귀포 정방폭포에서 학살·바다 유기.'),
('KOR_J43_05', 'KOR', 3, '섯알오름 탄약고 터 (예비검속 252명 집단학살)', NULL, '모슬포·한림 예비검속자', '민간인', 'PREVENTIVE_MASSACRE', '해병대·경찰', '1950-08-20', 33.2045000, 126.2731000, 33.2045000, 126.2731000, TRUE, '1_PRIMARY_FACT', '4_INTENTIONAL_ERASURE', '진화위 결정서 & 4·3보고서', '한국전쟁 직후 예비검속된 주민들을 새벽에 집단 총살하고 유해 수습 금지. 5·16 군사정변 직후 백조일손지지 비석 파손.'),
('KOR_J43_06', 'KOR', 4, '제주국제공항 활주로 유해발굴지 (해원과 수복)', NULL, '행방불명 수형인·예비검속자', '제주도 전역', 'EXHUMATION_RECOVERY', '4·3평화재단·진화위 발굴단', '2007-08-01', 33.5104000, 126.4913000, 33.4511000, 126.6186000, TRUE, '1_PRIMARY_FACT', '0_DOCUMENTED', '4·3 유해발굴 보고서', '활주로 아래 암매장되어 침묵(층위 4) 속에 있던 수백 구의 유해를 발굴·감식하여 4·3평화공원 봉안관으로 모심.'),
('KOR_J43_07', 'KOR', 5, '제주 4·3 평화기념관 백비(白碑) & 3기 진화위 과제', NULL, '미규명 희생자 및 후속 세대', '대한민국', 'UNFINISHED_MEMORIAL', '국가폭력 전반', '2026-10-29', 33.4511000, 126.6186000, 33.4511000, 126.6186000, TRUE, '2_SCHOLAR_INFERENCE', '5_UNDIGITIZED', '박구병 강연록 제5절', '이름을 아직 새기지 못한 백비(白碑). 개인별 입증 병목을 넘어 직권조사와 공적 기억의 터로 나아가야 할 과제.');
