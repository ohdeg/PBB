-- 전역 앱 설정 (key-value). dev가 관리. 현재 사용 키: featured_app_id (메인 상단 추천 앱)
CREATE TABLE IF NOT EXISTS app_config (
    config_key    VARCHAR(64)   NOT NULL PRIMARY KEY COMMENT '설정 키',
    config_value  VARCHAR(255)  NOT NULL COMMENT '설정 값',
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='전역 앱 설정 (dev 관리)';

-- 기본 추천 앱 (미설정 시 백엔드가 analyze-baseball로 폴백하므로 선택 사항)
INSERT INTO app_config (config_key, config_value)
VALUES ('featured_app_id', 'analyze-baseball')
ON DUPLICATE KEY UPDATE config_value = config_value;
