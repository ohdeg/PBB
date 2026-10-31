# Dieta 레시피 구분 DB 변경

`infra/mysql/migrations/20261031_dieta_recipe_kind.sql`은 `dieta_recipes.record_kind`를
`VARCHAR(16) NOT NULL DEFAULT 'LEGACY'`로 추가한다. 기존 행은 `LEGACY`로 유지하며
이미 저장된 `LIBRARY`/`INTAKE`를 덮어쓰지 않는다. 같은 스크립트를 순차 재실행할 수 있다.

## 적용 순서

1. 대상 DB의 기존 백업/복구 절차를 확인한다. 새 백엔드를 시작하기 전에 적용하며,
   배포 중 구버전과 신버전 백엔드를 혼용하지 않는다. 프런트엔드도 대응 버전을 배포한다.
2. Docker 접근이 가능한 터미널에서 저장소 루트로 이동한다.
3. 아래 명령을 실행하고 MySQL 프롬프트에 비밀번호를 직접 입력한다.
   스크립트는 환경 파일을 읽거나 권한을 변경하지 않는다.

로컬:

```bash
bash scripts/migrate-dieta-recipe-kind.sh baseball-mysql baseball_db baseball_user
```

서버(실제 DB명과 계정명으로 바꿔 실행):

```bash
bash scripts/migrate-dieta-recipe-kind.sh pbb-mysql YOUR_DATABASE YOUR_DB_USER
```

컨테이너명, DB명, 계정은 명시적으로 전달한다. DB명과 계정명은 영문/숫자/밑줄만
허용한다. 컨테이너 내부 `127.0.0.1:3306`의 MySQL에 접속한다. 실제 비밀번호를
명령 인자나 파일에 넣지 않는다. 비밀번호 입력 때문에 대화형 터미널이 필요하다.

## 요구 사항과 결과 확인

- MySQL 8.0.12 이상, 기존 InnoDB `dieta_recipes` 테이블이 필요하다.
- 실행 계정에는 대상 테이블의 `SELECT`, `ALTER`, `CREATE`, `INSERT` 및 대상
  스키마의 `CREATE ROUTINE`, `ALTER ROUTINE`, `EXECUTE` 권한이 필요하다.
  스크립트는 권한을 부여하지 않는다.
- 반드시 한 명의 배포 담당자가 순차 실행한다. 내부 advisory lock은 프로시저의
  생성/삭제까지 보호하지 않으므로 여러 배포 작업을 동시에 실행하지 않는다.
- 성공 출력은 최초 적용 시 `APPLIED`, 재실행 시 `ALREADY_APPLIED`이다.
  함께 출력되는 DB명, `record_kind`의 타입/NULL 허용 여부/기본값 및 종류별 행 수를 확인한다.
- 기존 컬럼 정의나 값이 예상과 다르면 오류로 중단한다. 컬럼이나 데이터를 임의로 고치지 않는다.
- `ALGORITHM=INSTANT`를 지원하지 않는 테이블은 오류로 중단하며 테이블 복사로 전환하지 않는다.
  메타데이터 잠금 대기는 문장별 최대 15초, advisory lock 대기는 최대 10초다.
  전체 스크립트 실행 시간 제한은 아니다.
- DDL은 암시적으로 커밋된다. 후속 검증에서 실패하더라도 이미 추가된 컬럼은 남을 수 있다.
  자동 롤백이나 컬럼 삭제는 하지 않는다.
- 오류 후 예약 프로시저 `pbb_migrate_dieta_recipe_kind_20261031`이 남을 수 있다.
  원인을 해결한 뒤 재실행하면 교체한다. 컨테이너의 임시 SQL은 성공/실패 시 삭제를 시도하며,
  삭제 실패 시 경로를 출력하고 실패로 종료한다.

SQL만 별도로 실행할 경우 대상 DB를 선택한 MySQL 배치 클라이언트에 파일을 표준입력으로
전달한다. `--force`나 대화형 `source` 실행을 사용하지 않는다. 제공된 래퍼는
`--no-defaults`, 로그인 파일 경로 무효화, 빈 자식 환경, `--skip-reconnect`를 사용한다.

## 검증 상태

래퍼는 가짜 Docker를 이용한 성공/SQL 실패/복사 실패/잘못된 인자/비대화형 실행
5개 테스트와 Bash 구문 검사를 통과했다. 이는 MySQL 실행 검증이 아니다.
현재 로컬 Docker 소켓 접근 거부로 실제 DB 적용과 MySQL 최초 실행/재실행 검증은 보류되어 있다.
Docker 접근 복구 후 위 로컬 명령으로 적용하고 결과를 확인해야 한다.

참고: [MySQL ALTER TABLE](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html),
[온라인 DDL 제약](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html),
[MySQL 환경 변수](https://dev.mysql.com/doc/refman/8.0/en/environment-variables.html).
