# PR #102 운영 릴리스 결과

기록 기준: 2026-11-21 KST. 배포 코드: `975ab5d863652b54189079c000c32d513f78b23f`.
사용자가 12월 1일 예약을 즉시 실행으로 전환한 뒤, 변경된 main 재검증을 승인하여 진행했다.
이 문서는 결과 요약이다. 백업 파일·원본 manifest·전체 로그·접속정보·비공개 백업 경로·백업 해시는 포함하지 않는다.

## 단계별 결과와 근거

| 단계 | 결과 | 근거 |
| --- | --- | --- |
| 원격 필수 검증 | 성공 | [CI 44821726870](https://github.com/kwpark0047/toss/actions/runs/44821726870), 위 배포 SHA |
| 보안 검사 | 성공 | [Security 44821732698](https://github.com/kwpark0047/toss/actions/runs/44821732698) |
| 수동 백업 갱신 | 성공 | 읽기 전용 export snapshot을 공유한 custom archive 생성, 기존 백업 보존 |
| 격리 SQL 복원 | 성공 | 167개 테이블·232,594행 대조 일치, pg_restore 종료 코드 0 |
| 복원본 무결성 검사 | 성공 | 미검증 제약조건·invalid 인덱스·실패 migration 각각 0개 |
| 추가 SQL 로컬 시험 | 성공 | nullable JSONB·기본값 없음 확인 후 transaction rollback |
| 운영 migration | 성공 | 아래 단일 migration만 적용, Prisma 이력·체크섬·실제 열 검증 |
| 배포 및 workflow 스모크 | 성공 | [CI deploy 44822789375](https://github.com/kwpark0047/toss/actions/runs/44822789375) |
| 추가 운영 확인 | 성공 | 2026-11-21 06:52 KST 공개 경로·권한·배차 비활성 13개 검사 통과 |

필수 CI와 배포 실행의 필수 잡은 성공했다. 수동 `required`/`deploy` 선택에서 제외되는 Docker·Trivy·Lighthouse·번들·프린트 검사는 별도 실행하지 않았다. 모든 선택형 검사를 통과했다고 표현하지 않는다.

## 마이그레이션 적용

- 대상: `20261117010000_barogo_reservation_snapshot`.
- 변경: `public.orders.delivery_reservation` nullable JSONB 열 하나 추가, 기본값 없음.
- SQL 파일 체크섬: `d432084c39dfc19233c112fdceb49ceb6ac96a4259194e06761ca141dd5c10ff`.
- Prisma 이력 완료 시각: 2026-11-21 06:42:51 KST.
- `scripts/deploy-migrations.cjs --check`: pending 없음 확인.

운영 데이터 삭제·보정, 다른 migration 일괄 적용, 고객 예약 접수 활성화는 하지 않았다.
잠금·실행 제한과 트랜잭션으로 대상 SQL을 적용한 뒤, 실제 적용 사실을 확인하고 해당 Prisma 이력을 기록했다.

## 플랫폼 배포와 운영 확인

| 대상 | 배포 ID | 확인 상태 |
| --- | --- | --- |
| Render 백엔드 | `dep-dc0c0lon74is73b4ca50` | live, 2026-11-21 06:51:26 KST 완료 |
| Vercel 프런트엔드 | `dpl_7twuDq2D57BQ3uSHLj9T8BNUQiKY` | READY, production |

양쪽 revision은 위 배포 SHA와 일치했다. `/api/health`의 DB connected, deep health의 schema/operationalConfig 정상, 키워드 검색·매장 목록·주문유형·상품·공개 법정 정보 조회를 확인했다.
익명 관리자 설정/매장 주문 목록 요청은 401/403으로 차단됐다. 세 대행사 webhook의 빈 입력은 비활성 어댑터 선차단으로 404를 반환했다. 실제 업체 이벤트·배차·주문·결제를 생성하지 않았다.

실제 랜딩 화면에서 매장 목록이 렌더링되는 것을 확인하고, PWA 업데이트 안내를 적용한 뒤 브라우저 DOM의 `app-commit`도 동일 SHA임을 확인했다. 이 관측은 모든 기기·모든 화면의 종합 QA를 의미하지 않는다.

## 중단 이력과 복구 상태

앞선 즉시 실행에서는 검증 SHA `88ddb4e4` 이후 PR #107이 머지되어 `MAIN_CHANGED` 게이트에서 중단했다. 당시 운영 SQL·배포는 실행하지 않았다.
이번 재개에서는 새 SHA의 원격 검증과 새 백업·복원 검증을 수행했고, 적용·배포가 성공했다. 실패에 따른 운영 rollback이나 DB 전체 복원은 필요하지 않았다.
격리 복원 서버는 정상 종료했다. 임시 운영 배포 게이트는 OFF로 복구했으며, 기존 7개 Actions는 중지 상태로 확인했다. 다른 작업이 workflow를 활성화할 수 있으므로 이 상태는 확인 시점 기준이다.

## 비활성 경계와 남은 미검증 항목

- 바로고·부릉·생각대로 어댑터와 운영 자동 배차는 비활성 유지. 자동 배차 활성 매장 수 0개를 DB에서 확인했다.
- 고객 예약 접수 기본 차단은 유지했다. 실제 주문 생성으로 운영 409 동작을 시험하지 않았다.
- 기존 승인 계정으로 인증된 운영 주문 목록·상세를 읽는 검사는 미수행이다. 익명 접근 차단과 공개 경로 확인으로 이를 대체했다고 표현하지 않는다.
- 복원 검증은 운영 PostgreSQL 17 → 로컬 PostgreSQL 18.6의 public/auth/storage SQL 범위다. 동일 Supabase 환경·관리 확장(vault 등)·플랫폼 메타데이터 전체·외부 Auth 서비스는 검증하지 않았다.
- Storage SQL 메타데이터와 실제 객체 파일은 다르며, 실제 파일 복구는 검증하지 않았다.
- `--no-owner --no-acl` 복원으로 원본 소유권·ACL·역할 비밀번호 복구는 검증하지 않았다. 행 수 대조는 데이터 내용별 해시 대조나 전체 서비스 기동 검증이 아니다.
- 백업은 접근 제한된 단일 로컬 사본이다. 오프사이트 백업·PITR·운영 전체 재해복구 검증을 대체하지 않는다. 관리형 백업/PITR 유료 전환은 하지 않았다.
- 장기 안정성·운영 롤백 실행·실제 대행사 연동/실배차·결제 검증은 이번 릴리스 범위 밖이다.

기존 `12-actions` 예약은 완료 결과를 반영한 PAUSED 상태로 유지하여 12월 1일 중복 재배포를 방지한다. 운영 배차와 유료 기능을 자동 활성화하지 않는다.
