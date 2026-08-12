-- Document accessory slots on sranko_items.slot (BAG | HAT | JEWELRY).
-- Column type already VARCHAR(16); no data migration required.

ALTER TABLE sranko_items
    MODIFY COLUMN slot VARCHAR(16) NOT NULL
        COMMENT 'TOP|BOTTOM|OUTER|SHOES|DRESS|BAG|HAT|JEWELRY';
