# AI 사업자 지원센터 운영 반영

사용자 운영 반영 요청에 따라 기존 검증된 지원센터를 배포한다. 기존 운영 주문·결제·원장·키·매장 동의는 변경하지 않는다.

## DB

- 2026-10-14 17:41 KST: `20261014010000_business_support` 대상 migration만 운영 적용. checksum `b8c651844ade36817582e8279506d7501c8872a2c1c86cf2afcd3c98ee30e876`.
- 신규 enrollment/case/event/job 4개 테이블 RLS true, 공개 역할 권한 없음, 서버 조회 유지. migration journal 원자적 기록.
- bigserial 시퀀스의 공개 권한도 회수. 격리 실DB 회귀 재통과 후 적용.
- 기존 `20261014020000_private_registration_and_provider_tables` 운영 보안 적용도 완료. 별도 보고서 참조.

## 검증

- `node --test tests/saas/business-support.test.cjs tests/saas/store-manager.test.cjs tests/saas/registration-otp.test.cjs`: 9/9 통과, skip 0.
- `node scripts/test-business-support-postgres.cjs`: 격리 실제 PostgreSQL 통과. 소유자 동의·매장 격리·플랫폼 승인 차단·동시 실행 멱등·작업 복구·RLS 확인.
- 기존 전체 테스트 및 브라우저 증적: `AI_BUSINESS_SUPPORT_IMPLEMENTATION_2026-10-14.md` 참조.

## 배포 및 잔여 검증

코드 배포·운영 API·화면 상태는 배포 후 기록한다. 매장 소유자의 동의를 플랫폼이 대신 등록하지 않는다. worker는 우선 동의된 매장만 처리하는 제한된 단발 실행으로 확인한다. 별도 상시 스케줄러·신규 유료 서비스는 자동 생성하지 않는다.

복구: worker 중단 및 backend a35eccf / frontend 3535a46 정상 배포로 복구. 추가 테이블과 감사 기록은 유지하며 DROP·수금·환불을 수행하지 않는다.

## 반영 진행 기록

- 고정 로컬 RC: `3781f5eb8f713641305ac399506c1e82b75a6f01`. 기존 운영 backend a35eccf와 비교해 30개 변경 파일.
- 신규 SQL의 table/sequence 공개 권한 회수를 포함한 로컬 PostgreSQL 회귀 통과. 운영 신규 4개 테이블 적용 성공 증거: `business-support-operating-migration.json`.
- 프론트 운영 build 통과, 43.02초 (`business-support-release-build.log`). 기존 400KB chunk 경고와 wakeup 정적/동적 import 혼용 경고는 남아 있다.
- 운영 health 재확인: HTTP 200, DB connected, revision a35eccf, 43,023ms. 가용성은 확인했지만 지연 원인을 확정하거나 해결했다고 주장하지 않는다.
- 공개 GitHub main/RC 푸시는 자동 승인 검토가 과거 ‘로컬 구현만 유지’ 지시를 근거로 차단했다. 우회하지 않았다. 정확한 커밋·30개 파일·저장소·배포 대상을 명시한 사용자 승인 요청 중.
- 따라서 신규 코드 Render/Vercel 배포와 운영 worker 실행은 미진행이다. 신규 DB 테이블은 보안 설정된 빈 구조로 유지하며 실제 매장 동의·결제·SMS는 변경하지 않았다.

## 최종 운영 배포 확인

이후 사용자가 정확한 커밋의 공개 푸시·운영 배포를 명시 승인했다. 이전 보류 상태는 아래 결과로 대체한다.

- 공개 GitHub main 및 RC 모두 `3781f5eb8f713641305ac399506c1e82b75a6f01` 푸시 성공. `git ls-remote`로 두 브랜치 일치 확인.
- Render 기존 wemarket 서비스 배포 `dep-db7k7ffavr4c738id55g`: Live, 2026-10-14 17:58 KST. 자동 배포는 기존 비활성 설정 유지.
- Vercel 기존 wemarket-saas 배포 `dpl_DmLwR6nCUU7RrhGpv8JQwLtngsVx`: READY, production alias `https://wemarket-saas.vercel.app`.
- `node reports/verify-support-release.cjs`: 종료 코드 0. 프론트 HTTP 200/meta revision, backend health HTTP 200/revision 모두 승인 SHA 일치. DB connected. warm health 409ms.
- 지원센터 overview/cases 익명 GET은 각각 401. send-otp/verify-otp 빈 JSON POST는 각각 400. 실제 SMS·계정 생성 없음.
- 운영 브라우저 기존 PWA는 3535a46 캐시 때문에 신규 경로 404가 잠시 표시됐고, 화면의 ‘업데이트’를 클릭한 뒤 3781f5e 및 정상 로그인 화면으로 전환 확인. 인증된 관리자 지원센터 화면 검증은 아직 수행하지 않았다.
- 증거: `business-support-release-live.json`, `business-support-render-live-20261014.jpg`.
- worker 코드는 배포됐으나 상시 스케줄러·실제 동의 매장 처리 검증은 미완료. 사업자 동의를 대신 등록하거나 자동 추천 실행하지 않았다.
- 이전 43초 health 지연의 영구 해결로 판단하지 않는다. Render 무료 인스턴스의 유휴 종료 및 50초 이상 재기동 지연 안내가 존재한다.

