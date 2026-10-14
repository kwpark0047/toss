# SDD ledger — plan: docs/superpowers/plans/2026-10-14-ai-business-support.md

Ruling: 기존 codex/release-candidate-20261009 체크아웃에서 구현한다 — 사용자가 해당 프로젝트의 직접 구현을 승인했고 미커밋 변경을 보존해야 한다 — main checkout에서 구현하지 않는다.
Ruling: 지원센터와 사업자 제안함은 route별 권한을 가진 동일 React 컴포넌트를 재사용한다 — 데이터/근거 화면의 중복 방지 — 서버에서 실제 owner/platform 권한을 별도로 검사한다.
Ruling: 매입·CRM의 실제 업체 실행은 구현 범위에서 허위 활성화하지 않는다 — 실자료/제공자·동의가 필요하다 — QR 무할인 노출만 실행한다.
Pre-flight: Task1 manager transition은 Task2에서 동일 transaction을 받도록 확장. Task2/3/4의 storeId·UUID·상태 전이·JSON 응답 계약을 맞춤.

Task 1: 권한 테스트와 라우터/서비스 owner 검증 구현. Node 회귀 통과; 기존 manager 실DB fixture owner 필드 보완, 재실행 예정.
Task 2: enrollment/case/event/job SQL와 Prisma 모델, store-level locking, operation UUID idempotency, 실제 owner 승인, 지원 연결 action 우회 차단 구현. 신규 운영 migration 미적용.
Task 3: bounded worker(2 concurrent/10 default), lease/SKIP LOCKED, backoff/5 attempts DLQ/manual recovery 구현. 지연·품절·순매출·출처 근거. 운영 worker 비활성.
Task 4: 관리자/owner route와 메뉴·지원 UI 구현. UI tests 4개 포함. 격리 browser E2E 준비 중.
Task 5: backend 177 suites/1357 tests, frontend 46 files/185 tests, SaaS 81 tests 통과. 이후 보강 변경은 targeted+final regression으로 추가 검증.

Interruption: 사용자가 신규 가입 send-otp 404 긴급 수정 요청. 별도 가입 복구 커밋 3535a465341bbbadec0ff042ab36edcab130d81d만 main/RC에 게시하고 Render/Vercel Live 확인. AI 변경은 미커밋으로 보존했고 해당 배포에 포함하지 않음. 가입 실제 SMS는 보류, 운영 상태 변경 없음. 보고서 REGISTRATION_OTP_RECOVERY_2026-10-14.md.

실DB: scripts/test-business-support-postgres.cjs 격리 로컬 schema에서 owner/tenant/idempotency/QR concurrent execution/stop after withdrawal/lease/backoff/DLQ/recovery/FK/RLS 및 signup proof 통과. scripts/test-registration-otp-postgres.cjs 별도 rollback/concurrent signup 검증 통과.

Task 1~4: 코드·격리 실DB·브라우저 검증 완료, 로컬 구현 커밋 679d372. 운영 미적용.
Task 5: frontend 47 files/188 tests; 최신 UI targeted 6; backend 177 suites/1357; 최신 node targeted 13; 실DB support/legacy manager/signup/private-role 테스트 통과. 최종 frontend build 31.25초 성공. Independent reviewer의 두 중요 발견은 각각 실DB RED→GREEN 후 재검토 확인. 추가 stale lease 보고 오류도 RED→GREEN.
Browser: isolated store11/platform32/owner33에서 검토→담당→전달→승인→앱 내 확인→QR 공개1개→평가pending→중단→공개0개/고객 UI 제거. 기본 JS confirm이 IAB를 막아 앱 내 HTML dialog로 바꾼 뒤 Chrome에서 완료. 운영 계정·SMS·PG 미사용.
Ruling: 운영 schema metadata에서 phone_otps RLS false 및 anon/authenticated grant, provider_credentials RLS false 확인. 별도 private-auth migration 준비/비특권 실DB 통과. 운영 적용은 explicit approval pending. 신규 지원센터 migration과 섞어 적용하지 않는다.
Urgent signup follow-up: a35eccf backend Live 및 health200/revision 확인. JWT proof에 phone HMAC 결합. frontend3535a46 유지(opaque token contract 동일). 지원센터 commit은 아직 push하지 않음.
