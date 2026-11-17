"""Read-only research API. Source records, edited examples and models stay distinct."""
from collections import Counter
from datetime import date, datetime
import json
import os
from pathlib import Path
import time

from fastapi import FastAPI, HTTPException, Query
import pymysql
import pymysql.cursors
from archive_api import CONFIG as ARCHIVE_CONFIG, DEFAULT as DEFAULT_SOURCE, GEO, source_dataset, source_index

app = FastAPI(title="TRC Historical Research Workbench", version="3.1.0")
META_PATH = Path(__file__).with_name("source_metadata.json")
SOURCE_METADATA = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else {}
_cache = {"at": 0, "rows": None}


def get_db():
    return pymysql.connect(host=os.getenv("DB_HOST", "trc-db"), port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "trc_user"), password=os.environ["DB_PASS"],
        database=os.getenv("DB_NAME", "trc_archive"), charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, connect_timeout=8, read_timeout=15)


def query(sql, args=()):
    started = time.perf_counter()
    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, args)
                rows = cur.fetchall()
        finally:
            conn.close()
    except (pymysql.MySQLError, KeyError):
        raise HTTPException(503, "연구 데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.")
    return rows, round((time.perf_counter() - started) * 1000, 2)


def clean(value):
    return None if value is None or str(value).strip() in ("", "NA", "N/A", "None") else value


def normalize_record(row):
    item = dict(row)
    for key in ("lat_start", "lng_start", "lat_end", "lng_end"):
        item[key] = float(item[key]) if item.get(key) is not None else None
    for key in ("occupation", "affiliation", "perpetrator", "narrative_ko"):
        item[key] = clean(item.get(key))
    if isinstance(item.get("event_date"), (date, datetime)):
        item["event_date"] = item["event_date"].isoformat()[:10]
    original = SOURCE_METADATA.get(item["incident_id"])
    if item["country_code"] == "CHL":
        item["record_basis"] = "research_dataset"
        item["source_url"] = "https://github.com/danilofreire/pinochet"
        item["coordinate_precision"] = original.get("coordinate_precision", "unknown") if original else "unknown"
        if original:
            source_date = clean(original.get("date_in_source"))
            item["event_date"] = source_date if source_date and len(source_date) == 10 else None
            item["location_start"] = clean(original.get("location_start"))
            item["location_end"] = clean(original.get("location_end"))
        item["silence_note"] = "좌표의 불확실성만으로 의도적 은폐 여부를 판정하지 않습니다."
    else:
        item["record_basis"] = "curated_seed"
        item["source_url"] = "https://jeju43peace.or.kr/kor/sub05_02_02.do"
        item["coordinate_precision"] = "seed_unverified"
        item["silence_note"] = "기존 앱의 편집 시드입니다. 날짜·좌표·쪽수는 원문 대조가 필요합니다."
    item["is_exact_coord"] = item["coordinate_precision"] == "exact"
    item.pop("epistemic_layer", None)
    item["legacy_silence_layer"] = item.pop("silence_layer", None)
    return item


def dataset():
    if _cache["rows"] is None or time.monotonic() - _cache["at"] > 30:
        rows, elapsed = query("SELECT * FROM trc_incidents ORDER BY country_code, event_date, incident_id")
        _cache.update(rows=[normalize_record(r) for r in rows], at=time.monotonic(), elapsed=elapsed)
    return _cache["rows"]


@app.get("/api/health")
def health():
    _, elapsed = query("SELECT 1 AS connected")
    return {"status": "ok", "version": app.version, "elapsed_ms": elapsed}


@app.get("/api/stats")
def stats():
    started = time.perf_counter()
    sources=source_index(query)
    corpus, _ = query("SELECT COUNT(*) AS cnt FROM trc_corpus_documents")
    counts=Counter()
    for source in sources:counts[source['country']]+=source['count']
    total=sum(counts.values())
    return {"total_incidents":total,"total_source_records":total,"source_counts":sources,"count_unit":"출처별 기록 · 출처 간 중복 포함", "by_country": [{"country_code": k, "cnt": v} for k, v in sorted(counts.items())],
            "corpus_count": corpus[0]["cnt"], "corpus_status": "curated_examples_unverified",
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 2), "version": app.version,
            "multimodal_count": 6, "sql": "SELECT * FROM trc_incidents ORDER BY country_code, event_date, incident_id"}


@app.get("/api/research/incidents")
def incidents(country: str = Query("CHL", pattern="^(CHL|KOR)$"),source: str|None=None):
    selected=source or DEFAULT_SOURCE[country]
    if selected not in ARCHIVE_CONFIG or ARCHIVE_CONFIG[selected]['country']!=country:
        raise HTTPException(422,'국가와 자료 출처를 확인해 주세요.')
    return source_dataset(query,selected)


@app.get('/api/research/sources')
def archive_sources():
    return {'sources':source_index(query),'unit_note':'출처가 겹칩니다. 합계를 고유 희생자 수로 해석하지 않습니다.'}


@app.get('/api/research/geography')
def reference_geography():
    return GEO


@app.get("/api/research/corpus")
def corpus():
    rows, elapsed = query("SELECT doc_id, preset_group, era_bucket, doc_year, source_title, speaker_type, text_segment, keywords_json FROM trc_corpus_documents ORDER BY doc_year, doc_id")
    for row in rows:
        if isinstance(row.get("keywords_json"), str):
            try:
                row["keywords_json"] = json.loads(row["keywords_json"])
            except ValueError:
                row["keywords_json"] = []
        row["source_status"] = "기존 앱의 구성 예문 · 원문 인용으로 사용 불가"
    return {"rows": rows, "count": len(rows), "elapsed_ms": elapsed,
            "notice": "국회회의록 전수 수집 결과가 아닙니다. 이 자료군으로 실제 발언 빈도나 역사적 침묵을 입증할 수 없습니다."}


@app.get("/api/app4/hgis/{country_code}")
def hgis(country_code: str, phase: int = Query(5, ge=1, le=5), silence_only: bool = False,
         limit: int = Query(5000, ge=1, le=5000)):
    if country_code not in ("CHL", "KOR", "ARG"):
        raise HTTPException(422, "지원하지 않는 국가 코드입니다.")
    rows = [r for r in dataset() if r["country_code"] == country_code
            and (phase == 5 or r["autoplay_phase"] == phase)
            and (not silence_only or r["legacy_silence_layer"] != "0_DOCUMENTED")]
    return {"rows": rows[:limit], "count": len(rows[:limit]), "total_matching": len(rows), "truncated": len(rows) > limit,
            "elapsed_ms": _cache.get("elapsed"), "source_status": "연구 데이터 / 편집 시드 구분 필요"}
