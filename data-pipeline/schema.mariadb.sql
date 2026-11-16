-- MariaDB additive staging schema. Does not touch trc_* application tables.
CREATE TABLE IF NOT EXISTS hist_source (
 source_id VARCHAR(80) PRIMARY KEY, country_code CHAR(3) NOT NULL,
 title VARCHAR(300) NOT NULL, url VARCHAR(1000) NOT NULL, scope TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hist_snapshot (
 snapshot_id VARCHAR(120) PRIMARY KEY, source_id VARCHAR(80) NOT NULL,
 source_url VARCHAR(1000) NOT NULL, sha256 CHAR(64) NOT NULL,
 fetched_at VARCHAR(40), imported_at VARCHAR(40) NOT NULL, parser_version VARCHAR(40) NOT NULL,
 UNIQUE KEY hist_source_version(source_id,sha256,parser_version),
 FOREIGN KEY(source_id) REFERENCES hist_source(source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hist_record (
 snapshot_id VARCHAR(120) NOT NULL, record_key VARCHAR(120) NOT NULL,
 country_code CHAR(3) NOT NULL, record_kind VARCHAR(40) NOT NULL,
 title VARCHAR(500) NOT NULL, source_locator TEXT, source_line INT,
 date_lower DATE NULL, date_upper DATE NULL, date_precision VARCHAR(20) NOT NULL,
 event_year SMALLINT NULL, date_basis VARCHAR(80) NULL, violence VARCHAR(100) NULL,
 raw_json JSON NOT NULL,
 PRIMARY KEY(snapshot_id,record_key), KEY hist_country_year(country_code,event_year),
 FOREIGN KEY(snapshot_id) REFERENCES hist_snapshot(snapshot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hist_place (
 snapshot_id VARCHAR(120) NOT NULL, record_key VARCHAR(120) NOT NULL, ordinal TINYINT NOT NULL,
 place_label TEXT, place_type VARCHAR(200), latitude DECIMAL(11,7) NULL, longitude DECIMAL(11,7) NULL,
 coordinate_precision VARCHAR(20) NOT NULL, coordinate_basis VARCHAR(80) NOT NULL, role VARCHAR(100) NOT NULL,
 PRIMARY KEY(snapshot_id,record_key,ordinal), KEY hist_coordinates(latitude,longitude),
 FOREIGN KEY(snapshot_id,record_key) REFERENCES hist_record(snapshot_id,record_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
