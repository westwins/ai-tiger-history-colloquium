"""Traceable archive ingestion pilot; Python standard library only.

Never changes the application database. SQLite and MariaDB SQL are reviewable outputs.
No missing dates or coordinates are invented; no cross-source people are auto-merged.
"""
import argparse
import calendar
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import date, datetime, timezone
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import sqlite3
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parent
UA = "TRC-Archive-Research/0.1 (+https://trc.soohwalee.com/)"
SOURCE = "chile-pinochet-2019"
PARSER_VERSION = "0.2.0"
REGISTRY = json.loads((ROOT / "sources.json").read_text(encoding="utf-8"))["sources"]
ALLOWED_HOSTS = {urlsplit(s[k]).hostname for s in REGISTRY for k in ("url", "seed")}
MISSING = {"", "NA", "N/A", "NULL"}


def utcnow():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def saved_path(relative):
    target = (ROOT / str(relative).replace("\\", "/")).resolve()
    if ROOT not in target.parents:
        raise ValueError("Saved artifact path escapes the pipeline directory")
    return target


def val(value):
    value = str(value or "").strip()
    return None if value.upper() in MISSING else value


class ScopedRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def validate_url(url):
    parts = urlsplit(url)
    if parts.scheme not in ("https", "http") or parts.hostname not in ALLOWED_HOSTS or parts.username or parts.password:
        raise ValueError("URL outside registered archive hosts")


class Fetcher:
    """Host-scoped, bounded public GETs; robots errors fail closed except 404/410."""
    def __init__(self):
        self.opener = build_opener(ScopedRedirect())
        self.last, self.robots = {}, {}

    def request(self, url, limit=20_000_000, payload=None):
        validate_url(url)
        host = urlsplit(url).netloc
        delay = max(0, self.last.get(host, 0) + 2 - time.monotonic())
        if delay:
            time.sleep(delay)
        self.last[host] = time.monotonic()
        headers={"User-Agent": UA, "Accept": "*/*"}
        data=None
        if payload is not None:
            if urlsplit(url).hostname!='43archives.or.kr' or urlsplit(url).path not in ('/events/history/getHistoricalSites.do','/events/history/getHistoricalSite.do'):
                raise ValueError('POST only allowed to observed read-only archive search endpoints')
            data=json.dumps(payload).encode('utf-8')
            headers['Content-Type']='application/json'
        with self.opener.open(Request(url, data=data, headers=headers), timeout=18) as response:
            body = response.read(limit + 1)
            if len(body) > limit:
                raise ValueError("Response exceeds configured byte budget")
            return body, {"status": response.status, "final_url": response.url,
                          "content_type": response.headers.get("Content-Type"),
                          "etag": response.headers.get("ETag"),
                          "last_modified": response.headers.get("Last-Modified")}

    def check_robots(self, url):
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self.robots:
            try:
                body, _ = self.request(origin + "/robots.txt", limit=500_000)
                text = body.decode("utf-8-sig", errors="replace")
                if "<html" in text[:200].lower():
                    raise ValueError("robots.txt returned HTML; policy needs inspection")
                parser = RobotFileParser()
                parser.parse(text.splitlines())
                self.robots[origin] = (parser, "fetched")
                digest = hashlib.sha256(body).hexdigest()
                (ROOT / "raw" / "snapshots").mkdir(parents=True, exist_ok=True)
                (ROOT / "raw" / "snapshots" / (digest + ".bin")).write_bytes(body)
            except HTTPError as exc:
                if exc.code not in (404, 410):
                    raise
                self.robots[origin] = (None, f"http_{exc.code}_no_rules")
        parser, status = self.robots[origin]
        if parser and not parser.can_fetch(UA, url):
            raise ValueError("robots.txt disallows this URL")
        if parser:
            host = parts.netloc
            interval = parser.crawl_delay(UA) or parser.crawl_delay("*") or 0
            rate = parser.request_rate(UA) or parser.request_rate("*")
            if rate and rate.requests:
                interval = max(interval, rate.seconds / rate.requests)
            if interval:
                delay = self.last.get(host, 0) + interval - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
        return status

    def get(self, url, payload=None):
        started = utcnow()
        log = {"url": url, "fetched_at": started}
        if payload is not None:
            log['request_method']='POST'
            log['search_parameters']=payload
        try:
            log["robots_status"] = self.check_robots(url)
            for attempt in range(3):
                try:
                    body, meta = self.request(url,payload=payload)
                    break
                except HTTPError as exc:
                    if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                        raise
                    seconds = exc.headers.get("Retry-After", "")
                    delay = int(seconds) if seconds.isdigit() else 2 ** (attempt + 1)
                    if delay > 30:
                        raise RuntimeError("Server requested a longer pause; resume later") from exc
                    time.sleep(delay)
            digest = hashlib.sha256(body).hexdigest()
            target = ROOT / "raw" / "snapshots" / (digest + ".bin")
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(body)
            log.update(meta, sha256=digest, byte_count=len(body), local_path=target.relative_to(ROOT).as_posix())
            return body, log
        except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError, OSError) as exc:
            log.update(error=type(exc).__name__ + ": " + str(exc), status=getattr(exc, "code", None))
            raise
        finally:
            path = ROOT / "raw" / "fetch-log.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(log, ensure_ascii=False) + "\n")


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.current, self.title, self.in_title = [], None, [], False
        self.title_complete = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title" and not self.title_complete:
            self.in_title = True
        if tag == "a" and a.get("href"):
            self.current = {"href": a["href"], "text": []}
        if tag == "link" and a.get("href"):
            self.links.append({"href": a["href"], "text": a.get("rel", "")})

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
            self.title_complete = True
        if tag == "a" and self.current:
            self.current["text"] = " ".join("".join(self.current["text"]).split())
            self.links.append(self.current)
            self.current = None

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.current:
            self.current["text"].append(data)


def inspect_source(source):
    try:
        body, meta = Fetcher().get(source["seed"])
        text = body.decode("utf-8-sig", errors="replace")
        parser = Links()
        parser.feed(text)
        links = []
        for link in parser.links:
            href = urljoin(meta["final_url"], link["href"])
            if urlsplit(href).scheme in ("https", "http"):
                links.append({"url": href, "label": link["text"]})
        result = {"source_id": source["id"], **meta, "title": "".join(parser.title).strip(), "links": links}
    except Exception as exc:
        result = {"source_id": source["id"], "url": source["seed"], "checked_at": utcnow(), "error": str(exc)}
    dump(ROOT / "output" / "probes" / (source["id"] + ".json"), result)
    return {k: v for k, v in result.items() if k not in ("links", "local_path")}


def iso_date(value):
    text = val(value)
    return date.fromisoformat(text).isoformat() if text else None


def normalized_dates(row):
    daily, monthly = iso_date(row["start_date_daily"]), iso_date(row["start_date_monthly"])
    if daily:
        return {"date_lower": daily, "date_upper": daily, "date_precision": "day", "event_year": int(daily[:4]), "date_basis": "start_date_daily"}
    if monthly:
        yr, mo = map(int, monthly[:7].split("-"))
        return {"date_lower": f"{yr}-{mo:02}-01", "date_upper": f"{yr}-{mo:02}-{calendar.monthrange(yr,mo)[1]}", "date_precision": "month", "event_year": yr, "date_basis": "start_date_monthly"}
    return {"date_lower": None, "date_upper": None, "date_precision": "unknown", "event_year": None, "date_basis": None}


def normalize_csv(body):
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")))
    required = {"individual_id", "first_name", "last_name", "start_date_daily", "start_date_monthly", "latitude_1", "longitude_1", "page"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("Source CSV schema changed; inspect before importing")
    records, places, seen = [], [], set()
    for line, row in enumerate(reader, 2):
        key = val(row["individual_id"])
        if not key or key in seen:
            raise ValueError(f"Missing or duplicate individual_id at CSV line {line}")
        seen.add(key)
        dates = normalized_dates(row)
        records.append({"record_key": key, "source_id": SOURCE, "country_code": "CHL", "record_kind": "person_record",
                        "title": " ".join(filter(None, (val(row["first_name"]), val(row["last_name"])))),
                        "source_locator": "CSV individual_id=" + key + "; report page=" + str(val(row["page"]) or "unknown"),
                        "source_line": line, "violence": val(row["violence"]), **dates, "raw_fields": row})
        for ordinal in range(1, 7):
            label, place_type = val(row.get(f"location_{ordinal}")), val(row.get(f"place_{ordinal}"))
            raw_lat, raw_lon = val(row.get(f"latitude_{ordinal}")), val(row.get(f"longitude_{ordinal}"))
            lat, lon = float(raw_lat) if raw_lat else None, float(raw_lon) if raw_lon else None
            if (lat is None) != (lon is None):
                raise ValueError(f"Incomplete coordinate pair: {key}/{ordinal}")
            if lat is not None and not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"Invalid coordinate: {key}/{ordinal}")
            if label or place_type or lat is not None:
                flag = val(row.get(f"exact_coordinates_{ordinal}"))
                precision = "exact" if flag == "1" else "approximate" if flag == "0" else "unknown"
                places.append({"record_key": key, "ordinal": ordinal, "place_label": label, "place_type": place_type,
                               "latitude": lat, "longitude": lon, "coordinate_precision": precision if lat is not None else "unlocated",
                               "coordinate_basis": "source_csv", "role": "source_location_sequence_not_inferred_route"})
    return records, places, len(reader.fieldnames)


SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS hist_source(source_id TEXT PRIMARY KEY, country_code TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, scope TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hist_snapshot(snapshot_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES hist_source(source_id), source_url TEXT NOT NULL, sha256 TEXT NOT NULL, fetched_at TEXT, imported_at TEXT NOT NULL, parser_version TEXT NOT NULL, UNIQUE(source_id,sha256,parser_version));
CREATE TABLE IF NOT EXISTS hist_record(snapshot_id TEXT NOT NULL REFERENCES hist_snapshot(snapshot_id), record_key TEXT NOT NULL, country_code TEXT NOT NULL, record_kind TEXT NOT NULL, title TEXT NOT NULL, source_locator TEXT, source_line INTEGER, date_lower TEXT, date_upper TEXT, date_precision TEXT NOT NULL, event_year INTEGER, date_basis TEXT, violence TEXT, raw_json TEXT NOT NULL, PRIMARY KEY(snapshot_id,record_key));
CREATE TABLE IF NOT EXISTS hist_place(snapshot_id TEXT NOT NULL, record_key TEXT NOT NULL, ordinal INTEGER NOT NULL, place_label TEXT, place_type TEXT, latitude REAL, longitude REAL, coordinate_precision TEXT NOT NULL, coordinate_basis TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(snapshot_id,record_key,ordinal), FOREIGN KEY(snapshot_id,record_key) REFERENCES hist_record(snapshot_id,record_key));
CREATE INDEX IF NOT EXISTS hist_record_country_year ON hist_record(country_code,event_year);
CREATE INDEX IF NOT EXISTS hist_place_coords ON hist_place(latitude,longitude);
"""


def make_tables(records, places, digest, fetched_at=None, source_id=SOURCE, source_url=None):
    snapshot_id = source_id + ":" + digest[:24] + ":" + PARSER_VERSION
    source = next(s for s in REGISTRY if s["id"] == source_id)
    tables = {
        "hist_source": [{"source_id": source_id, "country_code": source["country"], "title": source["title"], "url": source["url"], "scope": source["scope"]}],
        "hist_snapshot": [{"snapshot_id": snapshot_id, "source_id": source_id, "source_url": source_url or source["seed"], "sha256": digest,
                           "fetched_at": fetched_at, "imported_at": utcnow(), "parser_version": PARSER_VERSION}],
        "hist_record": [], "hist_place": []}
    for r in records:
        item = {"snapshot_id": snapshot_id, **{k: v for k, v in r.items() if k not in ("raw_fields", "source_id")}, "raw_json": json.dumps(r["raw_fields"], ensure_ascii=False, separators=(",", ":"))}
        tables["hist_record"].append(item)
    tables["hist_place"] = [{"snapshot_id": snapshot_id, **p} for p in places]
    return tables


def insert_sqlite(tables, target):
    conn = sqlite3.connect(target)
    try:
        conn.executescript(SCHEMA)
        with conn:
            for name, rows in tables.items():
                if not rows:
                    continue
                columns = list(rows[0])
                conn.executemany(f"INSERT OR IGNORE INTO {name} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", [[row[c] for c in columns] for row in rows])
        return {name: conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in tables}
    finally:
        conn.close()


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "CONVERT(X'" + str(value).encode("utf-8").hex() + "' USING utf8mb4)"


def export_mariadb(tables, target):
    with target.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write("-- Additive research tables only. Select a staging database first.\nSET NAMES utf8mb4;\n")
        stream.write((ROOT / "schema.mariadb.sql").read_text(encoding="utf-8"))
        stream.write("\nSTART TRANSACTION;\n")
        for table, rows in tables.items():
            for start in range(0, len(rows), 50):
                batch = rows[start:start+50]
                columns = list(batch[0])
                stream.write(f"INSERT INTO {table} ({','.join(columns)}) VALUES\n")
                stream.write(",\n".join("(" + ",".join(sql_value(row[c]) for c in columns) + ")" for row in batch))
                # A repeated identical snapshot is a no-op. Other constraint errors must surface.
                first = columns[0]
                stream.write(f"\nON DUPLICATE KEY UPDATE {first}={first};\n")
        stream.write("COMMIT;\n")


def audit(records, places, field_count, legacy_path=None):
    first = {p["record_key"]: p for p in places if p["ordinal"] == 1 and p["latitude"] is not None}
    any_coords = {p["record_key"] for p in places if p["latitude"] is not None}
    year_counts = Counter(r["event_year"] for r in records if r["event_year"])
    daily_years = Counter(r["event_year"] for r in records if r["date_precision"] == "day")
    coords = Counter((p["latitude"], p["longitude"]) for p in first.values())
    result = {"source_id": SOURCE, "record_unit": "source person record, not distinct event count", "source_records": len(records), "source_fields": field_count,
              "first_location_mappable": len(first), "missing_first_location_coordinates": len(records)-len(first),
              "any_location_mappable": len(any_coords), "no_location_coordinates": len(records)-len(any_coords),
              "date_precision": dict(Counter(r["date_precision"] for r in records)),
              "annual": [{"year": y, "all_known_year": year_counts[y], "exact_day": daily_years[y], "month_only": year_counts[y]-daily_years[y]} for y in sorted(year_counts)],
              "first_coordinate_precision": dict(Counter(p["coordinate_precision"] for p in first.values())),
              "top_repeated_first_coordinates": [{"latitude": c[0], "longitude": c[1], "records": n, "labels": Counter(p["place_label"] for p in first.values() if (p["latitude"],p["longitude"])==c).most_common(5)} for c,n in coords.most_common(8)],
              "post1973_non_santiago_examples": sorted({(r["event_year"], first[r["record_key"]]["place_label"]) for r in records if r["event_year"] and r["event_year"]>1973 and r["record_key"] in first and re.search(r"Iquique|Lautaro|Viña|Parral", first[r["record_key"]]["place_label"] or "", re.I)}),
              "notes": ["Counting a coordinate cluster as one dot hides multiple records.", "Missing coordinates are retained in the database and excluded only from map rendering.", "Month-only dates are intervals; first of month is not an observed event day.", "Location sequence is not a verified movement route."]}
    if legacy_path:
        legacy = json.loads(legacy_path.read_text(encoding="utf-8-sig"))["rows"]
        result["legacy_api_comparison"] = {"records": len(legacy), "dated_records": sum(bool(r["event_date"]) for r in legacy),
                                          "annual_exact_day": dict(sorted(Counter(r["event_date"][:4] for r in legacy if r["event_date"]).items())),
                                          "missing_from_legacy": len(records)-len(legacy)}
    return result


def write_exports(records, places, result):
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    with (out / "chile-records.jsonl").open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    fields = [k for k in records[0] if k != "raw_fields"]
    with (out / "chile-records.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    dump(out / "chile-quality.json", result)
    grouped = {}
    for place in places:
        if place["ordinal"] != 1 or place["latitude"] is None:
            continue
        key = (place["longitude"], place["latitude"])
        grouped.setdefault(key, []).append(place)
    features = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": list(coords)},
                 "properties": {"source_id": SOURCE, "unit": "source_person_record", "record_count": len(items), "source_record_ids": [p["record_key"] for p in items],
                                "coordinate_precisions": dict(Counter(p["coordinate_precision"] for p in items)), "source_labels": sorted({p["place_label"] for p in items if p["place_label"]})}}
                for coords,items in grouped.items()]
    dump(out / "chile-first-location-clusters.geojson", {"type": "FeatureCollection", "features": features})


def prepare(args):
    body = args.csv.read_bytes()
    records, places, fields = normalize_csv(body)
    digest = hashlib.sha256(body).hexdigest()
    fetched_at = None
    log_path = ROOT / "raw" / "fetch-log.jsonl"
    if log_path.exists():
        for line in log_path.read_text(encoding="utf-8").splitlines():
            entry = json.loads(line)
            if entry.get("sha256") == digest:
                fetched_at = entry["fetched_at"]
    tables = make_tables(records, places, digest, fetched_at)
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    result = audit(records, places, fields, args.legacy_json)
    result["sha256"] = digest
    result["database_rows"] = insert_sqlite(tables, out / "research.sqlite3")
    export_mariadb(tables, out / "chile-import.mariadb.sql")
    write_exports(records, places, result)
    print(json.dumps({k: result[k] for k in ("source_records", "source_fields", "first_location_mappable", "date_precision", "database_rows")}, ensure_ascii=False))


class TableReader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("th", "td"):
            self.cell = []
        elif tag == "br" and self.cell is not None:
            self.cell.append(" ")

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def normalize_mmdh(body):
    """Parse the site's own Excel-labelled HTML table. Keep date semantics as supplied."""
    parser = TableReader()
    parser.feed(body.decode("utf-8-sig"))
    expected = ["Nombre", "Calificación", "Categoria", "Militancia", "Fecha Detención/Muerte", "Región", "Ciudad", "Comuna", "Edad", "Ocupación"]
    if not parser.rows or parser.rows[0] != expected:
        raise ValueError("MMDH export schema changed; inspect headers")
    records, places, review_dates, seen = [], [], Counter(), Counter()
    for line, values in enumerate(parser.rows[1:], 2):
        if len(values) != len(expected) or not values[0].strip():
            raise ValueError(f"Invalid MMDH export row {line}")
        row = dict(zip(expected, values))
        fingerprint = hashlib.sha256(json.dumps(row, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:32]
        seen[fingerprint] += 1
        key = fingerprint + ":" + str(seen[fingerprint])
        raw_date = val(row["Fecha Detención/Muerte"])
        parsed = None
        precision = "unknown"
        lower = upper = None
        if raw_date and re.fullmatch(r"\d{2}-\d{2}-\d{4}", raw_date):
            try:
                parsed = datetime.strptime(raw_date, "%d-%m-%Y").date().isoformat()
            except ValueError:
                pass
        if parsed:
            lower = upper = parsed
            precision = "day"
        elif raw_date:
            # Explicit zero means the day/month is absent in this export, not day zero.
            month_match = re.fullmatch(r"00-(0[1-9]|1[0-2])-(\d{4})", raw_date)
            named_month = re.fullmatch(r"([A-Za-z]{3})-(\d{4})", raw_date)
            months = {"ene":1,"feb":2,"mar":3,"abr":4,"may":5,"jun":6,"jul":7,"ago":8,"sep":9,"set":9,"oct":10,"nov":11,"dic":12}
            if month_match or (named_month and named_month[1].lower() in months):
                yr = int((month_match or named_month)[2])
                mo = int(month_match[1]) if month_match else months[named_month[1].lower()]
                lower, upper, precision = f"{yr:04}-{mo:02}-01", f"{yr:04}-{mo:02}-{calendar.monthrange(yr,mo)[1]}", "month"
            elif re.fullmatch(r"(?:00-00-)?\d{4}", raw_date):
                yr = int(raw_date[-4:])
                lower, upper, precision = f"{yr:04}-01-01", f"{yr:04}-12-31", "year"
        if raw_date and precision == "unknown":
            review_dates[raw_date] += 1
        records.append({"record_key": key, "source_id": "chile-mmdh-victims", "country_code": "CHL", "record_kind": "person_catalog",
                        "title": row["Nombre"], "source_locator": f"MMDH public export row {line}; content fingerprint, not person identifier",
                        "source_line": line, "date_lower": lower, "date_upper": upper, "date_precision": precision,
                        "event_year": int(lower[:4]) if lower else None, "date_basis": "Fecha Detención/Muerte (ambiguous event type)",
                        "violence": val(row["Calificación"]), "raw_fields": row})
        labels = [val(row[k]) for k in ("Comuna", "Ciudad", "Región")]
        if any(labels):
            places.append({"record_key": key, "ordinal": 1, "place_label": " / ".join(dict.fromkeys(x for x in labels if x)),
                           "place_type": "administrative labels: comuna / ciudad / region", "latitude": None, "longitude": None,
                           "coordinate_precision": "unlocated", "coordinate_basis": "no_coordinates_in_source_export", "role": "source_administrative_location_not_precise_event_site"})
    return records, places, dict(review_dates), sum(n-1 for n in seen.values())


class JejuSitesReader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.items, self.current = [], [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "li" and self.current is None and any(t == "ul" and "ruins_list" in v.get("class", "").split() for t,v in self.stack):
            self.current = {"title": [], "category": [], "description": [], "link": None, "image": None}
        if self.current:
            if tag == "a" and a.get("href") and not self.current["link"]:
                self.current["link"] = a["href"]
            if tag == "img" and a.get("src"):
                self.current["image"] = a["src"]
        if tag not in ("img", "input", "link", "meta", "br", "hr", "source"):
            self.stack.append((tag, a))

    def handle_data(self, text):
        if not self.current or any(t in ("script", "style") for t,a in self.stack):
            return
        if any(t == "p" and "title" in a.get("class", "").split() for t,a in self.stack):
            self.current["title"].append(text)
        elif any(t == "span" and "category" in a.get("class", "").split() for t,a in self.stack):
            self.current["category"].append(text)
        elif self.stack and self.stack[-1][0] == "span" and any(t == "p" and "active" in a.get("class", "").split() for t,a in self.stack):
            self.current["description"].append(text)

    def handle_endtag(self, tag):
        if tag == "li" and self.current:
            item = self.current
            for field in ("title", "category", "description"):
                item[field] = " ".join("".join(item[field]).split())
            if item["title"]:
                self.items.append(item)
            self.current = None
        for index in range(len(self.stack)-1, -1, -1):
            if self.stack[index][0] == tag:
                self.stack = self.stack[:index]
                break


def prepare_jeju_sites():
    meta = json.loads((ROOT / "output/probes/jeju43-sites.json").read_text(encoding="utf-8"))
    body = saved_path(meta["local_path"]).read_bytes()
    if hashlib.sha256(body).hexdigest() != meta["sha256"]:
        raise ValueError("Site page hash mismatch")
    parser = JejuSitesReader()
    parser.feed(body.decode("utf-8-sig"))
    if not parser.items:
        raise ValueError("No site catalog items; source structure changed")
    records, places, seen = [], [], set()
    for line, item in enumerate(parser.items, 1):
        key = hashlib.sha256((item["title"] + "|" + item["category"]).encode()).hexdigest()[:32]
        if key in seen:
            raise ValueError("Duplicate site catalog key; manual review required")
        seen.add(key)
        raw = {**item, "link": urljoin(meta["final_url"], item["link"] or ""), "image": urljoin(meta["final_url"], item["image"] or "")}
        records.append({"record_key": key, "source_id": "jeju43-sites", "country_code": "KOR", "record_kind": "site_catalog", "title": item["title"],
                        "source_locator": f"Official ruins_list item {line}; content-derived key, not archive accession ID", "source_line": line,
                        "date_lower": None, "date_upper": None, "date_precision": "unknown", "event_year": None, "date_basis": None, "violence": None, "raw_fields": raw})
        places.append({"record_key": key, "ordinal": 1, "place_label": item["category"], "place_type": "source administrative category",
                       "latitude": None, "longitude": None, "coordinate_precision": "unlocated", "coordinate_basis": "no_coordinates_on_catalog_page", "role": "site_catalog_not_person_or_event_count"})
    tables = make_tables(records, places, meta["sha256"], meta["fetched_at"], "jeju43-sites")
    out = ROOT / "output"
    counts = insert_sqlite(tables, out / "research.sqlite3")
    export_mariadb(tables, out / "jeju-sites-import.mariadb.sql")
    dump(out / "jeju-sites.json", {"source_url": meta["final_url"], "sha256": meta["sha256"], "record_unit": "site_catalog, not victims",
                                   "records": records, "count": len(records), "scope": "Public featured site catalog page only; not a complete Jeju victim/site census.", "database_rows": counts})
    print(json.dumps({"source_id":"jeju43-sites", "site_catalog_records":len(records), "database_rows":counts}, ensure_ascii=False))


def prepare_mmdh():
    meta = json.loads((ROOT / "output" / "chile-mmdh-victims-download.json").read_text(encoding="utf-8"))
    body = saved_path(meta["local_path"]).read_bytes()
    if hashlib.sha256(body).hexdigest() != meta["sha256"]:
        raise ValueError("Downloaded file hash mismatch")
    records, places, review_dates, duplicates = normalize_mmdh(body)
    tables = make_tables(records, places, meta["sha256"], meta["fetched_at"], "chile-mmdh-victims", meta["url"])
    out = ROOT / "output"
    result = {"source_id": "chile-mmdh-victims", "source_records": len(records), "sha256": meta["sha256"],
              "record_unit": "source person catalog record; no cross-source deduplication performed",
              "date_precision": dict(Counter(r["date_precision"] for r in records)), "dates_requiring_review": review_dates,
              "identical_export_rows": duplicates, "source_region_labels": dict(Counter(r["raw_fields"]["Región"] or "unknown" for r in records)),
              "source_type_labels": dict(Counter(r["violence"] for r in records)), "coordinate_count": 0,
              "annual": dict(sorted(Counter(r["event_year"] for r in records if r["event_year"]).items()))}
    result["database_rows"] = insert_sqlite(tables, out / "research.sqlite3")
    export_mariadb(tables, out / "mmdh-import.mariadb.sql")
    with (out / "mmdh-records.jsonl").open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    dump(out / "mmdh-quality.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("fetch-chile")
    sub.add_parser("prepare-mmdh")
    sub.add_parser("prepare-jeju-sites")
    fetch = sub.add_parser("fetch-discovered")
    fetch.add_argument("source_id")
    fetch.add_argument("url", help="Must be an actual link in the source's saved probe")
    probe = sub.add_parser("probe")
    probe.add_argument("source_ids", nargs="*", help="Registered source IDs; one seed per source only")
    prep = sub.add_parser("prepare")
    prep.add_argument("--csv", type=Path, default=ROOT / "raw" / "pinochet.csv")
    prep.add_argument("--legacy-json", type=Path)
    args = parser.parse_args()
    if args.command == "fetch-chile":
        body, meta = Fetcher().get(next(s for s in REGISTRY if s["id"] == SOURCE)["seed"])
        normalize_csv(body)  # Refuse HTML error pages / schema changes before updating current input.
        (ROOT / "raw" / "pinochet.csv").write_bytes(body)
        print(json.dumps(meta, ensure_ascii=False))
    elif args.command == "fetch-discovered":
        probe_path = ROOT / "output" / "probes" / (args.source_id + ".json")
        if args.source_id not in {s["id"] for s in REGISTRY}:
            raise ValueError("Unknown source ID")
        observed = json.loads(probe_path.read_text(encoding="utf-8"))
        if args.url not in {link["url"] for link in observed.get("links", [])}:
            raise ValueError("URL not found among this source's observed links")
        body, meta = Fetcher().get(args.url)
        url_key = hashlib.sha256(args.url.encode()).hexdigest()[:12]
        dump(ROOT / "output" / "downloads" / (args.source_id + "-" + url_key + ".json"), meta)
        dump(ROOT / "output" / (args.source_id + "-download.json"), meta)
        print(json.dumps(meta, ensure_ascii=False))
    elif args.command == "probe":
        selected = [s for s in REGISTRY if not args.source_ids or s["id"] in args.source_ids]
        if len(selected) != len(set(args.source_ids)) and args.source_ids:
            raise ValueError("Unknown or duplicate source ID")
        # Serialize sources sharing a host. Different hosts can be inspected independently.
        grouped = {}
        for source in selected:
            grouped.setdefault(urlsplit(source["seed"]).netloc, []).append(source)
        def group_run(sources):
            results = []
            for source in sources:
                results.append(inspect_source(source))
                time.sleep(2)
            return results
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = [r for group in pool.map(group_run, grouped.values()) for r in group]
        inventory = []
        for saved in sorted((ROOT / "output" / "probes").glob("*.json")):
            item = json.loads(saved.read_text(encoding="utf-8"))
            inventory.append({k:v for k,v in item.items() if k not in ("links", "local_path")})
        dump(ROOT / "output" / "source-access-audit.json", inventory)
        print(json.dumps(results, ensure_ascii=False, indent=2))
    elif args.command == "prepare-mmdh":
        prepare_mmdh()
    elif args.command == "prepare-jeju-sites":
        prepare_jeju_sites()
    else:
        prepare(args)


if __name__ == "__main__":
    main()
