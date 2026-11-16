"""Load additive hist_* tables in a separate MariaDB database and verify repeat runs.

Run on the existing Oracle host from this file's directory after copying output/*.sql.
No application container restart, production DDL, or production record update.
"""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
DATABASE = "trc_research_staging"
CLIENT = ["docker", "exec", "-i", "trc-mariadb", "sh", "-c",
          'MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec mariadb --user=root --default-character-set=utf8mb4 --batch --skip-column-names']


def sql(text, database=None):
    # A fixed identifier only. No shell interpolation of SQL or credentials.
    prefix = f"USE {database};\n" if database else ""
    run = subprocess.run(CLIENT, input=(prefix+text).encode(), capture_output=True, check=True)
    return run.stdout.decode("utf-8").strip()


before = sql("SELECT COUNT(*) FROM trc_incidents;", "trc_archive")
existing = sql(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{DATABASE}';")
if any(name not in {"hist_source", "hist_snapshot", "hist_record", "hist_place"} for name in existing.splitlines()):
    raise RuntimeError("Staging database contains unexpected tables; inspect before import")
sql(f"CREATE DATABASE IF NOT EXISTS {DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")

files = [ROOT/"output"/name for name in ("chile-import.mariadb.sql", "mmdh-import.mariadb.sql", "jeju-sites-import.mariadb.sql")]
for file in files:
    body = file.read_text(encoding="utf-8")
    if any(f"{verb} " in body.upper() for verb in ("DROP", "DELETE", "TRUNCATE", "ALTER")):
        raise RuntimeError("Unexpected destructive statement in reviewed import")
    sql(body, DATABASE)
count_query = "SELECT COUNT(*) FROM hist_record; SELECT COUNT(*) FROM hist_place; SELECT COUNT(*) FROM hist_snapshot;"
first = sql(count_query, DATABASE)
for file in files:
    sql(file.read_text(encoding="utf-8"), DATABASE)
second = sql(count_query, DATABASE)
if first != second:
    raise RuntimeError("Repeated import changed row counts")
if first.splitlines() != ["5639", "7395", "3"]:
    raise RuntimeError("Unexpected pilot coverage: " + first)
after = sql("SELECT COUNT(*) FROM trc_incidents;", "trc_archive")
if before != after:
    raise RuntimeError("Application incident count changed during staging validation")
grouped = sql("SELECT s.source_id,r.record_kind,COUNT(*) FROM hist_record r JOIN hist_snapshot s USING(snapshot_id) GROUP BY s.source_id,r.record_kind ORDER BY s.source_id;", DATABASE)
result = {"database":DATABASE,"grouped_rows":grouped.splitlines(),"total_source_records":5639,
          "not_distinct_people":True,"place_observations":7395,"snapshots":3,"repeat_import_idempotent":True,
          "application_incidents_before":int(before),"application_incidents_after":int(after)}
(ROOT/"output"/"oracle-staging-verification.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
