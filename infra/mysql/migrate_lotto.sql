-- Lotto schema (Firebase lotto/drawHistory + userPicks → MySQL)
-- 적용: docker exec -i baseball-mysql mysql -uroot -proot_password baseball_db < migrate_lotto.sql

CREATE TABLE IF NOT EXISTS lotto_draws (
    round INT NOT NULL PRIMARY KEY COMMENT '회차',
    main_numbers VARCHAR(32) NOT NULL COMMENT '본번호 6개 (콤마 구분, 오름차순)',
    bonus_number TINYINT NULL COMMENT '보너스 번호',
    draw_date DATE NULL COMMENT '추첨일',
    first_prize_amount BIGINT NULL COMMENT '1등 1인당 당첨금(세전)',
    first_prize_winner_count INT NULL COMMENT '1등 당첨자 수',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_lotto_draws_date (draw_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='로또 회차별 당첨 번호';

CREATE TABLE IF NOT EXISTS lotto_user_picks (
    user_id CHAR(36) NOT NULL PRIMARY KEY COMMENT '회원 UUID',
    target_round INT NULL COMMENT '목표 회차',
    items JSON NOT NULL COMMENT '생성 번호 히스토리 (최대 200)',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_lotto_picks_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='회원별 로또 번호 생성 히스토리';
