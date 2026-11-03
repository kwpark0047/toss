# scripts/legacy

과거 루트에 있던 일회성 DB 점검·적용 스크립트. 현재 코드·CI·배포에서 참조하지 않는다.
운영 DB에 직접 쓰는 스크립트(`apply-*.js`, `insert-defaults.js`)는 실행 전 대상 `DATABASE_URL`을 반드시 확인한다.
정식 마이그레이션은 `prisma/migrations` + `scripts/deploy-migrations.cjs`를 사용한다.
