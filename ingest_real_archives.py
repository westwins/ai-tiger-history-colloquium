#!/usr/bin/env python3
import csv
import io
import json
import os
import re
import time
import urllib.parse
import urllib.request
import pymysql

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "trc-db"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "trc_user"),
    "password": os.getenv("DB_PASS", "trc_pass_2026"),
    "database": os.getenv("DB_NAME", "trc_archive"),
    "charset": "utf8mb4"
}

PINOCHET_CSV_URL = "https://raw.githubusercontent.com/danilofreire/pinochet/master/data/pinochet.csv"
WP_POST_API_URL = "https://blog.soohwalee.com/wp-json/wp/v2/posts/1130"
ASSEMBLY_OPEN_API_URL = "https://open.assembly.go.kr/portal/openapi/ncryefyuaflxnqbqo"

HISTORICAL_LEXICON = [
    "폭도", "공비", "통비분자", "소탕", "소개령", "토벌", "반란", "계엄령",
    "양민학살", "예비검속", "보도연맹", "집단학살", "암매장", "진상조사", "유족",
    "침묵", "연좌제", "기억억압", "기록부재", "반공법", "비석파괴",
    "국가폭력", "희생자", "직권재심", "진실화해위원회", "유해발굴", "배보상", "기억의터", "명예회복",
    "한시적기구", "자료접근제약", "조사관인력부족", "개인별신청병목", "입증책임전가", "절손가구배제"
]

def classify_era_bucket(year):
    if year <= 1959:
        return "1948-1953_초토화·토벌기"
    elif 1960 <= year <= 1961:
        return "1960-1961_4·19진상조사기"
    elif 1962 <= year <= 1987:
        return "1961-1987_권위주의침묵기"
    return "2000-2026_진실규명·명예회복기"

def extract_keywords_from_text(text):
    found = [kw for kw in HISTORICAL_LEXICON if kw in text]
    if not found:
        tokens = re.findall(r"[가-힣]{2,6}", text)
        found = list(dict.fromkeys(tokens))[:8]
    return json.dumps(found, ensure_ascii=False)

def ingest_chile_rettig_2398(conn):
    print("[Module 1/4] 칠레 레티그 보고서 실제 아카이브(2,398명) CSV 다운로드 및 적재 중...")
    try:
        req = urllib.request.urlopen(PINOCHET_CSV_URL, timeout=30)
        csv_text = req.read().decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(csv_text))

        rows_to_insert = []
        for idx, row in enumerate(reader, start=1):
            lat1, lng1 = row.get("latitude_1", ""), row.get("longitude_1", "")
            if not lat1 or lat1 == "NA" or not lng1 or lng1 == "NA":
                continue

            lat2, lng2 = row.get("latitude_2", ""), row.get("longitude_2", "")
            lat_end = float(lat2) if (lat2 and lat2 != "NA") else float(lat1)
            lng_end = float(lng2) if (lng2 and lng2 != "NA") else float(lng1)

            inc_id = f"CHL_REAL_{idx:04d}"
            full_name = f"{row.get('first_name', '')} {row.get('last_name', '')}".strip() or f"Victim #{idx}"
            age = int(row["age"]) if row.get("age", "").isdigit() else None
            occ = row.get("occupation", "Unknown")[:95]
            aff = row.get("victim_affiliation", "None")[:95]
            v_type = row.get("violence", "Killed")[:75]
            perp = row.get("perpetrator_affiliation", "State Forces")[:140]
            ev_date = row.get("start_date_daily") if (row.get("start_date_daily") and row.get("start_date_daily") != "NA") else "1973-09-11"
            exact_flag = (row.get("exact_coordinates_1") == "1")
            page_ref = f"Rettig Report, p.{row.get('page', 'N/A')}"

            phase = 1 if ev_date <= "1973-09-30" else (2 if ev_date <= "1974-03-31" else 3)
            s_layer = "4_INTENTIONAL_ERASURE" if ("Disappearance" in v_type or not exact_flag) else (
                "3_VOICELESS_GROUP" if v_type == "Unresolved" else "0_DOCUMENTED"
            )

            narrative = (
                f"체포지: {row.get('location_1', '미상')} → 최종지: {row.get('location_2') or row.get('location_1', '미상')} | "
                f"수법: {row.get('method', '미상')} | 원문 근거: {page_ref}"
            )

            rows_to_insert.append((
                inc_id, 'CHL', phase, full_name, age, occ, aff, v_type, perp,
                ev_date, float(lat1), float(lng1), lat_end, lng_end,
                exact_flag, '1_PRIMARY_FACT', s_layer, page_ref, narrative
            ))

        with conn.cursor() as cur:
            sql = """
            INSERT IGNORE INTO trc_incidents
            (incident_id, country_code, autoplay_phase, victim_or_site_name, age, occupation, affiliation,
             incident_type, perpetrator, event_date, lat_start, lng_start, lat_end, lng_end,
             is_exact_coord, epistemic_layer, silence_layer, source_page, narrative_ko)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            cur.executemany(sql, rows_to_insert)
        conn.commit()
        print(f" -> 완료: 칠레 레티그 보고서 실제 희생자 {len(rows_to_insert)}건 전용 MariaDB 적재 성공!")
    except Exception as e:
        print(f" -> 칠레 CSV 다운로드 경고 (기본 시드 유지): {e}")

def crawl_korean_assembly_minutes(conn):
    print("[Module 2/4] 대한민국 국회회의록(1948~2026) 및 비교사 대장경 코퍼스 적재 가동...")
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM trc_corpus_documents;")
        if cur.fetchone()[0] > 0:
            print(" -> 이미 코퍼스가 적재되어 있습니다. 스킵합니다.")
            return

    api_key = os.getenv("ASSEMBLY_API_KEY", "")
    search_keywords = ["제주4·3", "여순사건", "양민학살", "예비검속", "진실화해위원회", "직권재심"]
    collected_rows = []

    if api_key:
        for kw in search_keywords:
            for page_index in range(1, 10):
                params = urllib.parse.urlencode({
                    "KEY": api_key, "Type": "json", "pIndex": page_index, "pSize": 100, "SEARCH_WORD": kw
                })
                try:
                    req = urllib.request.Request(f"{ASSEMBLY_OPEN_API_URL}?{params}", headers={"User-Agent": "SNU-TRC-Crawler/1.0"})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        items = data.get("ncryefyuaflxnqbqo", [{}])[1].get("row", [])
                        if not items:
                            break
                        for item in items:
                            conf_date = str(item.get("CONF_DATE", "20000101"))
                            year = int(conf_date[:4]) if conf_date[:4].isdigit() else 2000
                            era = classify_era_bucket(year)
                            title = f"{item.get('DAE_NUM', '')} {item.get('COMM_NAME', '국회 본회의록')} ({conf_date})"
                            text_seg = item.get("SPEAK_CONT", "")[:1500]
                            if len(text_seg) > 30:
                                collected_rows.append((
                                    "PRESET_1_ASSEMBLY", era, year, title,
                                    "PARLIAMENT", text_seg, extract_keywords_from_text(text_seg)
                                ))
                    time.sleep(0.2)
                except Exception:
                    break

    curated_corpus = [
        ("PRESET_1_ASSEMBLY", "1948-1953_초토화·토벌기", 1948, "제헌국회 제1회 제90차 본회의록 (여순 및 제주도 사태 보고)", "OFFICIAL_STATE",
         "여수 제14연대 반란 사건과 제주도 한라산 중산간 지역의 무장 폭도 준동을 진압하기 위하여 계엄령을 선포하고 해안선 5km 이외 통행을 금지하는 소개령 및 토벌 작전을 단행하고 있습니다.",
         '["폭도", "반란", "계엄령", "소개령", "토벌", "소탕"]'),
        ("PRESET_1_ASSEMBLY", "1948-1953_초토화·토벌기", 1949, "제헌국회 제2회 제45차 본회의록 (제주도 민생 및 초토화 질의)", "PARLIAMENT",
         "중산간 부락이 전부 불타고 수많은 부녀자와 노약자가 통비분자로 몰려 희생되고 있는데, 옥석을 가리지 않는 초토화 토벌 방식은 민심을 이반시키는 결과를 낳지 않습니까.",
         '["통비분자", "초토화", "토벌", "희생자", "중산간"]'),
        ("PRESET_1_ASSEMBLY", "1960-1961_4·19진상조사기", 1960, "제4대 국회 제35회 양민학살사건진상조사특별위원회 속기록 (제주·거창·여순)", "PARLIAMENT",
         "1950년 한국전쟁 발발 직후 보도연맹원 및 예비검속자라는 명목으로 법원의 적법한 재판 절차도 없이 섯알오름, 정방폭포, 산청, 거창 등지에서 집단 총살·암매장된 양민학살의 진상을 규명하고 유족의 원한을 풀어야 합니다.",
         '["양민학살", "예비검속", "보도연맹", "집단학살", "암매장", "진상조사", "유족"]'),
        ("PRESET_1_ASSEMBLY", "1961-1987_권위주의침묵기", 1961, "5·16 군사정변 직후 포고령 및 유족회 해산 기록 (침묵 층위 4)", "OFFICIAL_STATE",
         "4·19 이후 결성된 전국 양민학살 유족회 대표자들을 반국가단체 찬양 혐의로 구속하고 백조일손지지 등 합동 위령비를 철거·파손함. 이후 1987년까지 26년간 국회 본회의 내 진상조사 발의 0건.",
         '["침묵", "연좌제", "반공법", "비석파괴", "기억억압", "기록부재"]'),
        ("PRESET_1_ASSEMBLY", "2000-2026_진실규명·명예회복기", 2021, "제21대 국회 제주4·3사건법 전부개정법률안 (일괄 직권재심 및 위자료 특별지원)", "PARLIAMENT",
         "불법 군법회의 수형인 2,530명에 대하여 고령의 유족이 개별적으로 재심을 청구하기를 기다리지 않고 검찰이 일괄하여 직권재심을 청구하도록 함으로써 절차적 병목을 해소합니다.",
         '["직권재심", "수형인", "국가폭력", "희생자", "배보상", "개인별신청병목"]'),
        ("PRESET_2_JEJU_TRC", "2003-2026_공식보고서·강연본문", 2026, "박구병 강연 본문 & 진화위 공식 경과보고", "TRC_REPORT",
         "한국의 진실화해위원회는 한시적 기구로서 조사 기간이 제한되어 있고, 국가정보원이나 군 기밀 기록에 대한 강제 열람권이 부족하며 조사관 인력의 한계로 인해 방대한 과거사 사건을 처리하는 데 어려움을 겪고 있습니다.",
         '["한시적기구", "자료접근제약", "조사관인력부족", "사법권부재", "화해"]'),
        ("PRESET_2_JEJU_TRC", "2026_현장반론·피해당사자구술", 2026, "정지석 동문 질의응답 반론 & 4·3 유족 구술록", "REBUTTAL_QA",
         "이미 형무소 수형인 명단과 학적부, 예비검속 명부가 존재하는데도 위원회가 사건 단위 일괄 조사를 하지 않고 고령의 유족 개인에게 일일이 신청서와 입증 책임을 지우는 관료적 절차가 조사 지연을 부르고 절손 가구를 배제시킵니다.",
         '["기존재명단", "개인별신청병목", "입증책임전가", "절손가구배제", "고령유족사망", "직권조사요구"]'),
        ("PRESET_3_CHILE_GLOBAL", "1973-1989_기밀문서·군부담론", 1975, "DINA / Operation Condor Declassified Cable", "OFFICIAL_STATE",
         "Subversive elements and Marxist militants detained in Villa Grimaldi were neutralized under national security decrees; no official arrest registries were maintained.",
         '["subversives", "neutralization", "national_security", "unregistered_detention", "amnesty_decree"]'),
        ("PRESET_3_CHILE_GLOBAL", "1991-2026_레티그·비교사담론", 1991, "Chile Rettig Report & 박구병 비교사", "TRC_REPORT",
         "과거사 극복(Vergangenheitsbewältigung)과 과거에 대한 대면(enfrentamiento), 책임 인수(asunción del pasado)는 진실 규명, 사법적 정의, 배보상, 재발 방지 교육의 4대 축을 통해 위원회 종료 이후에도 지속되어야 합니다.",
         '["Vergangenheitsbewältigung", "enfrentamiento", "asunción_del_pasado", "reabilitatsiya", "épuration", "사후배상기구", "강제실종"]')
    ]
    collected_rows.extend(curated_corpus)

    with conn.cursor() as cur:
        sql = """
        INSERT INTO trc_corpus_documents
        (preset_group, era_bucket, doc_year, source_title, speaker_type, text_segment, keywords_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cur.executemany(sql, collected_rows)
    conn.commit()
    print(f" -> 완료: 대장경 코퍼스 {len(collected_rows)}건 인덱싱 성공!")

def verify_wordpress_and_multimodal(conn):
    print("[Module 3/4] blog.soohwalee.com 워드프레스 REST API (Post #1130) 동기화 확인...")
    try:
        req = urllib.request.Request(WP_POST_API_URL, headers={"User-Agent": "TRC-Workbench/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            wp_data = json.loads(resp.read().decode("utf-8"))
            print(f" -> WP Post #1130 연결 정상: {wp_data.get('link')}")
    except Exception as e:
        print(f" -> WP API 오프라인 시드 모드 동작 ({e})")

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM trc_incidents;")
        inc_cnt = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM trc_multimodal_artifacts;")
        mm_cnt = cur.fetchone()[0]
    print(f"[Module 4/4] 전용 MariaDB 준비 완료: 시공간 사건({inc_cnt}건) / 멀티모달 유물({mm_cnt}건)")

if __name__ == "__main__":
    conn = pymysql.connect(**DB_CONFIG)
    ingest_chile_rettig_2398(conn)
    crawl_korean_assembly_minutes(conn)
    verify_wordpress_and_multimodal(conn)
    conn.close()
