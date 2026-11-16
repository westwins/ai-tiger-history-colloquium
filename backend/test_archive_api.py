"""Published API shape/coverage tests using the real source snapshots in local SQLite."""
from collections import Counter
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import unittest
import archive_api as a

DB=Path(__file__).resolve().parents[1]/'data-pipeline/output/research.sqlite3'

def query(sql,args=()):
    with closing(sqlite3.connect(DB)) as conn:
        conn.row_factory=sqlite3.Row
        rows=[dict(row) for row in conn.execute(sql.replace('%s','?'),args).fetchall()]
    return rows,0

class PublishedSourceTests(unittest.TestCase):
    def test_full_sources_and_missing_locations_survive(self):
        data=a.source_dataset(query,'chile-pinochet-2019')
        self.assertEqual(data['count'],2398)
        self.assertEqual(data['coverage']['first_location_mappable'],2109)
        self.assertEqual(data['coverage']['any_location_mappable'],2226)
        self.assertEqual(data['coverage']['date_precision'],{'day':2232,'month':57,'unknown':109})
        self.assertEqual(sum(r['event_year']==1973 for r in data['rows']),1274)
        self.assertEqual(sum(r['event_date'] is None for r in data['rows']),166)
        self.assertEqual(sum(len(r['places']) for r in data['rows']),4154)

    def test_mmdh_has_no_invented_individual_coordinates(self):
        data=a.source_dataset(query,'chile-mmdh-victims')
        self.assertEqual(data['count'],3216)
        self.assertTrue(all(r['lat_start'] is None and r['lng_start'] is None for r in data['rows']))
        self.assertEqual(data['coverage']['region_assigned'],3155)
        self.assertEqual(sum(r['event_year']==1973 for r in data['rows']),1829)
        self.assertEqual(sum(bool(r['quality_notes']) for r in data['rows']),5)

    def test_jeju_sources_stay_separate_from_person_records(self):
        data=a.source_dataset(query,'jeju43-history')
        self.assertEqual(data['count'],47)
        self.assertEqual(data['coverage']['region_assigned'],47)
        self.assertEqual(data['coverage']['osm_site_references'],5)
        self.assertTrue(all(r['record_kind']=='site_catalog' and r['event_year'] is None for r in data['rows']))
        self.assertEqual(a.source_dataset(query,'jeju43-sites')['count'],25)
        self.assertEqual(sum(s['count'] for s in a.source_index(query)),5686)

if __name__=='__main__':
    unittest.main()
