"""Data-loss and repeat-run regression checks. Does not access network or production."""
from contextlib import closing
import hashlib
from pathlib import Path
import sqlite3
import tempfile
import unittest

import pipeline as p


class IngestionTests(unittest.TestCase):
    def test_partial_date_is_interval_not_invented_day(self):
        d = p.normalized_dates({"start_date_daily": "NA", "start_date_monthly": "1976-02-01"})
        self.assertEqual((d["date_lower"], d["date_upper"], d["date_precision"]), ("1976-02-01", "1976-02-29", "month"))
        self.assertIsNone(p.normalized_dates({"start_date_daily": "NA", "start_date_monthly": "NA"})["event_year"])

    def test_full_dataset_preserved_and_first_location_filter_is_explicit(self):
        body = (p.ROOT / "raw" / "pinochet.csv").read_bytes()
        records, places, fields = p.normalize_csv(body)
        result = p.audit(records, places, fields)
        self.assertEqual((len(records), fields), (2398, 59))
        self.assertEqual(result["first_location_mappable"], 2109)
        self.assertEqual(result["any_location_mappable"], 2226)
        self.assertEqual(result["date_precision"], {"day":2232, "month":57, "unknown":109})
        self.assertEqual(sum(x["all_known_year"] for x in result["annual"]) + 109, 2398)
        self.assertTrue(all(len(r["raw_fields"]) == 59 for r in records))

    def test_repeat_import_and_distinct_snapshots(self):
        body = (p.ROOT / "raw" / "pinochet.csv").read_bytes()
        records, places, _ = p.normalize_csv(body)
        tables = p.make_tables(records, places, hashlib.sha256(body).hexdigest())
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "test.sqlite3"
            first = p.insert_sqlite(tables, target)
            self.assertEqual(p.insert_sqlite(tables, target), first)
            second = p.make_tables(records, places, "f" * 64)
            result = p.insert_sqlite(second, target)
            self.assertEqual(result["hist_record"], 2398 * 2)
            self.assertEqual(result["hist_snapshot"], 2)
            with closing(sqlite3.connect(target)) as conn:
                self.assertEqual(conn.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_mmdh_unparseable_date_and_identical_rows_are_not_silently_lost(self):
        head = ['Nombre','Calificación','Categoria','Militancia','Fecha Detención/Muerte','Región','Ciudad','Comuna','Edad','Ocupación']
        row = ['Example','DD','','','1973?','','Arica','','','']
        table = '<table><tr>' + ''.join('<th>'+x+'</th>' for x in head) + '</tr>'
        table += ('<tr>'+''.join('<td>'+x+'</td>' for x in row)+'</tr>')*2+'</table>'
        records, places, dates, duplicates = p.normalize_mmdh(table.encode())
        self.assertEqual(len(records), 2)
        self.assertEqual(duplicates, 1)
        self.assertNotEqual(records[0]['record_key'], records[1]['record_key'])
        self.assertEqual(dates, {'1973?':2})
        self.assertIsNone(records[0]['event_year'])
        self.assertTrue(all(x['latitude'] is None for x in places))

    def test_actual_mmdh_partial_dates_and_jeju_catalog_units(self):
        import json
        meta=json.loads((p.ROOT/'output/chile-mmdh-victims-download.json').read_text(encoding='utf8'))
        records,places,review,duplicates=p.normalize_mmdh(p.saved_path(meta['local_path']).read_bytes())
        self.assertEqual(len(records),3216)
        self.assertEqual(review,{'-1982':1})
        self.assertEqual(p.Counter(r['date_precision'] for r in records),{'day':3123,'month':89,'year':3,'unknown':1})
        self.assertTrue(all(x['latitude'] is None for x in places))
        meta=json.loads((p.ROOT/'output/probes/jeju43-sites.json').read_text(encoding='utf8'))
        parser=p.JejuSitesReader()
        parser.feed(p.saved_path(meta['local_path']).read_text(encoding='utf8'))
        self.assertEqual(len(parser.items),25)
        self.assertEqual(parser.items[0]['title'],'잃어버린마을 다랑쉬')
        self.assertTrue(all(x['title'] and x['category'] for x in parser.items))


if __name__ == "__main__":
    unittest.main()
