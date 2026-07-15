-- 회원 등급 (free | dev). 가입 시 기본 free. 기존 회원도 free.
ALTER TABLE users
    ADD COLUMN user_class VARCHAR(16) NOT NULL DEFAULT 'FREE'
        COMMENT '회원 등급 (FREE, DEV)'
        AFTER nickname;

-- 첫 DEV 계정은 수동 승격 (예시):
-- UPDATE users SET user_class = 'DEV' WHERE email = 'your-dev@example.com';
