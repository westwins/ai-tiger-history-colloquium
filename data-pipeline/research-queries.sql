-- Run in trc_research_staging. Select one latest parser/snapshot per source.
-- Counts from different sources must never be added as distinct victims.
WITH ranked AS (
 SELECT snapshot_id,source_id,ROW_NUMBER() OVER(PARTITION BY source_id ORDER BY imported_at DESC,snapshot_id DESC) AS rn
 FROM hist_snapshot
)
SELECT s.source_id,r.record_kind,r.event_year,r.date_precision,COUNT(*) AS source_records
FROM ranked s JOIN hist_record r USING(snapshot_id)
WHERE s.rn=1
GROUP BY s.source_id,r.record_kind,r.event_year,r.date_precision
ORDER BY s.source_id,r.event_year;

-- Inspect missing coordinate coverage without dropping the records.
WITH ranked AS (
 SELECT snapshot_id,source_id,ROW_NUMBER() OVER(PARTITION BY source_id ORDER BY imported_at DESC,snapshot_id DESC) AS rn
 FROM hist_snapshot
)
SELECT s.source_id,COUNT(*) AS source_records,
 SUM(EXISTS(SELECT 1 FROM hist_place p WHERE p.snapshot_id=r.snapshot_id AND p.record_key=r.record_key AND p.ordinal=1 AND p.latitude IS NOT NULL)) AS first_location_mappable,
 SUM(EXISTS(SELECT 1 FROM hist_place p WHERE p.snapshot_id=r.snapshot_id AND p.record_key=r.record_key AND p.latitude IS NOT NULL)) AS any_location_mappable
FROM ranked s JOIN hist_record r USING(snapshot_id)
WHERE s.rn=1 GROUP BY s.source_id;

-- Multiple records at the same coordinate: display counts, not a single unlabelled dot.
SELECT p.latitude,p.longitude,COUNT(*) AS source_records
FROM hist_place p JOIN hist_snapshot s USING(snapshot_id)
WHERE s.source_id='chile-pinochet-2019' AND s.parser_version='0.2.0'
 AND p.ordinal=1 AND p.latitude IS NOT NULL
GROUP BY p.snapshot_id,p.latitude,p.longitude ORDER BY source_records DESC LIMIT 20;
