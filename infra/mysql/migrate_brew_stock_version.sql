-- Optimistic lock for concurrent stock updates
ALTER TABLE brew_store_stocks
    ADD COLUMN version INT NOT NULL DEFAULT 0 COMMENT 'JPA @Version (낙관적 락)' AFTER stock_min_num;
