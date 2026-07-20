-- Brew Note: 구독자 재고 수정 권한
-- 적용: docker exec -i baseball-mysql mysql -uroot -proot_password baseball_db < migrate_brew_stock_permission.sql

ALTER TABLE brew_store_subscriptions
    ADD COLUMN can_edit_stock TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '재고 수정 권한' AFTER store_id;
