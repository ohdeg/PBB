-- Drop unused person photo column (try-on is mannequin-only by prefs.sex).
ALTER TABLE sranko_prefs
    DROP COLUMN person_image_url;
