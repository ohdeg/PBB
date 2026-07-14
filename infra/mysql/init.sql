CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '고유 식별자 (UUID)',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '로그인 이메일 (아이디 역할)',
    password VARCHAR(60) NOT NULL COMMENT 'BCrypt 암호화된 비밀번호',
    nickname VARCHAR(50) NOT NULL UNIQUE COMMENT '서비스 내 활동 닉네임',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '정보 수정 일시',

    INDEX idx_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원 정보 테이블';

CREATE TABLE IF NOT EXISTS user_consents (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '동의 기록 ID (UUID)',
    user_id CHAR(36) NOT NULL COMMENT '회원 ID',
    consent_key VARCHAR(64) NOT NULL COMMENT '동의 항목 키 (terms, privacy 등)',
    agreed TINYINT(1) NOT NULL COMMENT '동의 여부',
    version VARCHAR(32) NOT NULL COMMENT '동의 문서 버전',
    agreed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '동의 시각',

    CONSTRAINT fk_user_consents_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_consents_user_id (user_id),
    INDEX idx_user_consents_key (consent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원가입 약관·마케팅 동의 기록';
