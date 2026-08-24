#!/bin/bash
# PostgreSQL 초기화 스크립트
# docker-entrypoint-initdb.d/ 에 마운트되어 컨테이너 첫 시작 시 실행됨

set -e

echo "=== WeMarket PostgreSQL 초기화 시작 ==="

# 기본 데이터베이스가 이미 생성된 후 실행되므로 추가 설정만 수행

# 1. UUID 확장 활성화 (Prisma에서 uuid() 사용 시 필요)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 텍스트 검색 최적화
    CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- 복합 인덱스 최적화
    CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- 제외 제약/지리 데이터
EOSQL

# 2. 타임존 설정 (한국 표준시)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SET timezone = 'Asia/Seoul';
    ALTER DATABASE "$POSTGRES_DB" SET timezone = 'Asia/Seoul';
EOSQL

# 3. 개발용 테스트 사용자/권한 (필요 시)
# 프로덕션에서는 주석 처리
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 테스트용 읽기 전용 역할 (CI 등에서 사용)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wemarket_readonly') THEN
            CREATE ROLE wemarket_readonly NOINHERIT;
            GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO wemarket_readonly;
            GRANT USAGE ON SCHEMA public TO wemarket_readonly;
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO wemarket_readonly;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO wemarket_readonly;
        END IF;
    END
    \$\$;
EOSQL

echo "=== WeMarket PostgreSQL 초기화 완료 ==="