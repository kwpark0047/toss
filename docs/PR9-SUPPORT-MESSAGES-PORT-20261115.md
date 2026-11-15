# PR #9 지원센터 독립 이식

2026-11-15 KST. 기준 main `5f6e315e`. 원본 PR #9의 마지막 독립 커밋 `082555f2`만 새 main 기반 브랜치로 이식했다. #5의 사업자 계정 정책·미들웨어·관련 변경은 가져오지 않았다. 원본 PR의 대상 브랜치나 상태를 변경하거나 종료하지 않는다.

## 기능

- 매장 지원 사례별 공개 메시지와 최고관리자 전용 내부 메모.
- 상태·우선순위·자료 품질·매장명 검색 필터와 기존 keyset pagination.
- 주문 지연·재고·매출 변화·취소·리뷰·자료 부족/노후 등의 인정된 근거 키만 사용하는 검토 playbook. 원인/효과 확정이나 자동 실행을 하지 않는다.
- 기존 플랫폼 검토와 소유주 승인·최종 실행 확인 절차는 유지한다. 메시지 작성은 승인/실행 권한이 아니다. 유료 AI 호출이나 외부 발송은 추가하지 않는다.

## 권한·격리·멱등성

로그인 미들웨어를 유지하고 매장 소유주 또는 super_admin만 사례에 접근한다. 쓰기 트랜잭션은 store 행 잠금 후 소유권과 사례의 store_id를 다시 확인한다. 일반 직원·다른 매장 사용자·소유권 이전의 이전 소유자는 거절한다.

소유주 메시지 조회는 서버 SQL에서 `visibility='owner'`로 제한한다. 내부 작성은 super_admin만 가능하다. 작성자·매장은 클라이언트 입력을 신뢰하지 않고 인증된 actor와 경로에서 결합한다. 검색은 길이/enum 검증과 SQL 바인딩을 사용한다.

operation UUID는 DB unique constraint를 사용한다. 같은 작업의 재시도는 같은 메시지 ID를 돌려주며, 매장·사례·작성자·작성자 역할·공개 범위·본문 중 하나라도 다르면 409다. INSERT 충돌 후에도 기존 행을 재조회해 동일성을 검증한다. 소유주에게 draft 사례는 노출하지 않는다. 메시지는 최대 2,000자이며 빈 내용·제어 문자를 거부한다.

## 검증

- 지원센터 node:test 23건 통과: 매장 격리·소유권 재검증·공개/내부 조회·멱등성·동일 키의 6종 충돌·INSERT 경합 후 재조회·draft/본문 검증·필터·playbook·기존 소유주 승인 경계.
- 대상 프론트 3파일 11건 통과: 사업자 공개 답변, 플랫폼 내부 메모, 실패 후 같은 operation ID 재시도, 검색 필터, 명시적 실행 확인, Manager 승인·마케팅 초안 회귀.
- 새 필터의 option과 기존 표의 ‘자료 부족’ 문구가 중복되어 실패한 테스트는 해당 표 cell을 검증하도록 수정했다. 검사 항목을 삭제하지 않았다.
- 전체 백엔드 215스위트/1,688건, backend 타입 검사, frontend production build, AI OFF 설정 5건 통과. UI ESLint 오류 0이며 기존 cleanup ref 경고 1개가 남아 있다(테스트 파일은 lint 제외 규칙 대상).
- 전체 SaaS 검사: 188건 중 181건 통과·7건 생략·실패 0. 생략은 통과로 세지 않는다. Prisma schema validate 통과(연결 없는 검증, 합성 URL 사용).
- 실제 PostgreSQL 트랜잭션 경합·실기기·운영 데이터 시험은 하지 않았다. 권한과 race re-read는 합성 DB adapter/가짜 API를 사용한 모의 검증이다. 새 PR CI·E2E는 별도로 확인한다.

재실행:

```sh
node --test tests/saas/business-support-message-boundaries.test.cjs tests/saas/business-support-list.test.cjs tests/saas/business-support-messages.test.cjs tests/saas/business-support-playbooks.test.cjs tests/saas/business-support.test.cjs
npm run ai:review:check
```

frontend에서 `npx vitest run src/test/business-support.test.jsx src/test/ai-manager-approval.test.jsx src/test/marketing-drafts.test.jsx`를 실행한다.

## 운영 경계

Prisma 모델과 원본 migration SQL을 소스로 이식했지만 실제 DB에 적용하지 않는다. 신규 메시지 기능을 운영에서 사용하려면 별도의 승인형 migration과 운영 검증이 필요하다. RLS·anon/authenticated 직접 접근 차단·복합 FK·operation unique는 migration에 포함된다. 이번 작업에서 테이블 존재·grants·실제 DB 상태를 조회하거나 변경하지 않았다.

모든 AI 활성화·유료 호출·매장·UI·카메라 플래그 OFF, keep-warm 기본 OFF 및 migration/운영 배포 차단 유지. 운영 배포·DB 변경·유료 API 호출·외부 게시·실제 고객정보/연락처 사용 없음. 테스트·커밋·푸시·새 main 대상 PR 제출까지만 진행한다.
