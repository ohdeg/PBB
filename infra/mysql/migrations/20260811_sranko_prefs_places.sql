-- Sranko: saved places (home / work / favorites) for weather
ALTER TABLE sranko_prefs
    ADD COLUMN places_json JSON NOT NULL DEFAULT (JSON_ARRAY())
        COMMENT '[{id,label,kind:HOME|WORK|FAVORITE,lat,lon,query?}]'
        AFTER body_measurements_json;
