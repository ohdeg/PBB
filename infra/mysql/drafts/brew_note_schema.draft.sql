-- ============================================================
-- Brew Note DB 초안 (미적용)
-- 기준: frontend/src/data/brews.ts → BrewRecipe
-- 적용 시: 이 파일을 migrations/ 등으로로 옮기거나 init.sql에 합친 뒤
--          Notion [DB 스키마] / [DB 테이블 컬럼]도 동기화할 것.
-- ============================================================

CREATE TABLE IF NOT EXISTS brew_recipes (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '레시피 ID (UUID)',
    user_id CHAR(36) NOT NULL COMMENT '소유 회원 ID',

    name VARCHAR(120) NOT NULL COMMENT '레시피 이름',
    method VARCHAR(64) NOT NULL COMMENT '추출 방식 (V60, AeroPress 등)',
    beans VARCHAR(200) NOT NULL DEFAULT '' COMMENT '원두 정보 (산지·로스팅 등 자유 텍스트)',
    dose VARCHAR(64) NOT NULL DEFAULT '' COMMENT '원두량 (예: 15g) — UI 문자열 유지',
    water VARCHAR(64) NOT NULL DEFAULT '' COMMENT '물의 양 (예: 250ml)',
    temperature VARCHAR(64) NOT NULL DEFAULT '' COMMENT '수온 (예: 92°C)',
    time VARCHAR(64) NOT NULL DEFAULT '' COMMENT '추출 시간 (예: 2:30)',
    grind VARCHAR(120) NOT NULL DEFAULT '' COMMENT '분쇄도',
    notes TEXT NULL COMMENT '테이스팅·메모',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',

    CONSTRAINT fk_brew_recipes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_brew_recipes_user_id (user_id),
    INDEX idx_brew_recipes_user_updated (user_id, updated_at DESC),
    INDEX idx_brew_recipes_method (method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Brew Note 커피 레시피';

-- ------------------------------------------------------------
-- 매핑 (FE BrewRecipe ↔ 컬럼)
--   id          → id
--   name        → name
--   method      → method
--   beans       → beans
--   dose        → dose
--   water       → water
--   temperature → temperature
--   time        → time
--   grind       → grind
--   notes       → notes
-- FE에 없음    → user_id, created_at, updated_at
--
-- 메모
-- · dose/water/temperature/time 은 현재 UI가 string이라 VARCHAR.
--   이후 필터·정렬이 필요하면 dose_g / water_ml / temp_c / time_sec 등
--   NUMERIC 컬럼을 추가하는 쪽을 권장 (기존 컬럼은 표시용으로 유지 가능).
-- · 원두 마스터·추출 세션 분리는 다음 단계.
-- ------------------------------------------------------------
