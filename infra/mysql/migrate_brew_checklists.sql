CREATE TABLE IF NOT EXISTS brew_checklist_templates (
    id              CHAR(36)      NOT NULL PRIMARY KEY COMMENT '체크리스트 ID',
    store_id        CHAR(36)      NOT NULL COMMENT '가게 ID',
    owner_user_id   CHAR(36)      NULL COMMENT 'NULL=가게, 있으면 개인',
    title           VARCHAR(120)  NOT NULL COMMENT '이름',
    trigger_type    VARCHAR(16)   NOT NULL COMMENT 'CLOCK|SHIFT_START|SHIFT_END|MANUAL',
    trigger_time    TIME          NULL COMMENT 'CLOCK 시각',
    trigger_dows    VARCHAR(32)   NULL COMMENT '월=1..일=7 콤마. NULL이면 매일',
    audience        VARCHAR(16)   NOT NULL DEFAULT 'ON_DUTY' COMMENT 'ON_DUTY|OWNER_ONLY',
    interrupt       TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1이면 들어오면 바로 열기',
    enabled         TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order      INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_checklist_store
        FOREIGN KEY (store_id) REFERENCES brew_stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_checklist_owner
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_brew_checklist_trigger
        CHECK (trigger_type IN ('CLOCK', 'SHIFT_START', 'SHIFT_END', 'MANUAL')),
    CONSTRAINT chk_brew_checklist_audience
        CHECK (audience IN ('ON_DUTY', 'OWNER_ONLY')),
    INDEX idx_brew_checklist_store_owner (store_id, owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 템플릿';

CREATE TABLE IF NOT EXISTS brew_checklist_items (
    id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    template_id  CHAR(36)     NOT NULL,
    body         VARCHAR(200) NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,

    CONSTRAINT fk_brew_checklist_item_tmpl
        FOREIGN KEY (template_id) REFERENCES brew_checklist_templates(id) ON DELETE CASCADE,
    INDEX idx_brew_checklist_item_tmpl (template_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 항목';

CREATE TABLE IF NOT EXISTS brew_checklist_runs (
    id           CHAR(36)  NOT NULL PRIMARY KEY,
    template_id  CHAR(36)  NOT NULL,
    run_on       DATE      NOT NULL COMMENT '서울 날짜',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_brew_checklist_run_tmpl
        FOREIGN KEY (template_id) REFERENCES brew_checklist_templates(id) ON DELETE CASCADE,
    UNIQUE KEY uk_brew_checklist_run (template_id, run_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 하루 회차';

CREATE TABLE IF NOT EXISTS brew_checklist_checks (
    run_id      CHAR(36)  NOT NULL,
    item_id     INT       NOT NULL,
    user_id     CHAR(36)  NOT NULL,
    checked_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (run_id, item_id),

    CONSTRAINT fk_brew_checklist_check_run
        FOREIGN KEY (run_id) REFERENCES brew_checklist_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_checklist_check_item
        FOREIGN KEY (item_id) REFERENCES brew_checklist_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_brew_checklist_check_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veveno 체크리스트 항목 체크';
