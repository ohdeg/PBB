-- 기존 BIGINT AUTO_INCREMENT users 테이블을 UUID(CHAR(36))로 전환할 때 사용
-- 주의: 기존 회원 데이터는 유지되지 않습니다. 개발 환경 재생성용입니다.

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT '고유 식별자 (UUID)',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '로그인 이메일 (아이디 역할)',
    password VARCHAR(60) NOT NULL COMMENT 'BCrypt 암호화된 비밀번호',
    nickname VARCHAR(50) NOT NULL UNIQUE COMMENT '서비스 내 활동 닉네임',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '정보 수정 일시',

    INDEX idx_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원 정보 테이블';
