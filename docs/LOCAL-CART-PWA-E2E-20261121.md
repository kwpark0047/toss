# 장바구니·PWA 격리 결합 E2E

최종 확인일: 2026-11-21 KST. 결과: 8개 검사 통과, 실패 0개.
운영 DB·백업·운영 서버는 테스트에 연결하지 않았다. 새로운 원격 Actions나 배포 없이 로컬에서 실행했다.

## 검증 환경과 격리 경계

- 소스: 운영 프런트 `014c3a938e943efecc152494bf279e3d8a3f3589`, 백엔드 `975ab5d863652b54189079c000c32d513f78b23f`와 테스트 대상 소스가 동일한지 실행 전 Git 비교로 강제 확인한다.
- 실제 `app.mts`의 Express/API·Socket.IO·Prisma를 사용한다. 축약한 Socket.IO fixture 서버나 API 응답 mock으로 대체하지 않았다.
- `index.mts`의 과금·웹훅 재시도·배차 등 스케줄러는 시작하지 않는 전용 entry를 사용한다. 이 entry는 명시적 test 환경·loopback DB·테스트 DB 이름·API 포트가 아니면 앱 import 전에 거절한다.
- 새 PostgreSQL 18.6 클러스터에 Prisma schema를 적용하고 합성 사용자·매장·상품만 생성했다. 운영 dump/인증정보·기존 DB를 재사용하지 않았다.
- DB·API·정적 서버는 모두 loopback에만 바인딩하며, 이미 사용 중인 테스트 포트는 재사용하지 않고 시작을 거절한다. 합성 DB의 로컬 trust 인증은 운영 인증 설정과 무관하다.
- 자식 프로세스에는 OS 실행에 필요한 항목과 명시적인 테스트 변수만 전달한다. 운영 `.env`를 로드하지 않으며 외부 provider 키를 전달하지 않는다. 백엔드의 non-loopback 연결과 브라우저 외부 요청/DNS를 차단한다.
- Node v24.11.1, 설치된 Playwright Chromium headless, 실제 Workbox 서비스 워커를 사용했다. 기기별 브라우저 컨텍스트를 분리해 쿠키·localStorage를 공유하지 않는다.

빌드 A는 현재 프런트 소스와 실제 revision 표식을 사용한다. 빌드 B는 같은 소스에 `eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` 표식을 넣은 갱신 시험용 빌드다. B는 실제 후속 배포 커밋이 아니다.
두 production build를 로컬에서 생성했고, 하네스 assertion 수정 후 최종 실행에서는 소스/HTML/worker 표식을 검증한 동일 빌드 산출물을 재사용했다. API·DB·브라우저 컨텍스트는 매 실행 새로 만들었다.

## 실제 검사 결과

| 검사 | 확인 내용 | 결과 |
| --- | --- | --- |
| 메뉴·서비스 워커 | 실제 API의 합성 상품 표시, 최초 SW 제어 및 빌드 A 표식 | 통과 |
| 두 기기 공유 | 기기 A에서 담은 항목이 독립 기기 B에 실제 백엔드 중계로 반영 | 통과 |
| 새로고침·늦은 참여 | 기기 B 재열기 후 보존, 빈 저장소의 기기 C가 현재 상태 수신 | 통과 |
| offline 수정·재접속 | 기기 B에서 offline 상태로 추가 후 재연결, 기기 A의 합계 수량 2개 일치 | 통과 |
| 활성 장바구니와 업데이트 | 새 실제 worker 설치·waiting 상태 확인, 사용 중인 기존 두 화면 강제 reload 없음, 합계 보존 | 통과 |
| 다음 QR·offline 재열기 | 새 진입 시 빌드 B, waiting worker 활성화, offline reload 후 B 표식·실제 메뉴/장바구니 버튼·상태 보존 | 통과 |
| 삭제·재등장 방지 | 모든 항목 삭제가 다른 기기에 전파, 상대 기기 reload 후 항목 재등장 없음 | 통과 |
| 부작용·정리 | 합성 DB orders/payments 각각 0건, 브라우저·앱·DB 종료, 3개 테스트 포트 연결 거절 확인 | 통과 |

프런트가 로컬 `/api/ai/recommend`를 호출하는 경우도 관측했다. 해당 프로세스에 provider 키가 없고 외부 연결이 차단되어 있으며, 실제 AI 유료 호출을 검증한 것은 아니다.
이미지·외부 SDK 등 차단된 브라우저 요청은 있었으며, 이 검사에서 외부 서비스 정상 동작을 주장하지 않는다.

## 재실행 방법

Windows에서 저장소 의존성과 Playwright Chromium, 신뢰하는 PostgreSQL 실행 파일이 설치되어 있어야 한다. 운영 연결 문자열을 입력하지 않는다.

```powershell
$env:CART_PWA_PG_BIN = 'D:/tools/postgresql/bin' # 설치된 신뢰 가능한 경로로 변경
node scripts/test-cart-pwa-isolated.cjs
```

기본 실행은 새 합성 DB와 두 빌드를 생성한다. 개발 재실행 최적화용 `CART_PWA_REUSE_BUILDS`는 이 하네스가 생성한 로컬 산출물 디렉터리만 허용하며 소스·빌드 표식을 확인한다.
결과 JSON·스크린샷·로그·합성 DB는 Git 제외된 임시 디렉터리에 남는다. 원본 로그나 DB 파일을 PR에 업로드하지 않는다. 기존 백업은 읽거나 변경하지 않는다.

## 하네스 점검과 남은 한계

개발 중 Windows pg_ctl 출력 파이프 대기, loopback까지 막은 DNS 규칙, 같은 상품이 기기별 별도 항목일 수 있는데 첫 항목 수량만 비교한 assertion을 수정했다. 해당 실패를 제품 결함으로 계산하지 않았다. 정리 후 새 합성 환경의 최종 실행은 모두 통과했다.
`node --check`, Prettier 및 diff 공백 검사를 통과했다. non-loopback DB를 지정한 별도 부정 검사에서도 앱 import 전에 거절됨을 확인했다. 저장소 ESLint 설정은 이 scripts 경로를 ignore하므로 해당 실행을 lint 검증 완료로 보고하지 않는다.

- Prisma `db push`의 합성 schema이며, 운영 SQL migration·RLS·확장·트리거 전체를 재현하지 않았다. PostgreSQL도 운영과 메이저가 다르다.
- 실제 배포 CDN·TLS·CORS 전체 정책·기존 사용자 브라우저 저장소를 재현하지 않았다. 정적 서버는 이전 빌드 자산을 보존하는 로컬 서버다.
- 현재 소스 간 표식 변경 시험이다. PR #108 이전 프런트 코드에서의 업그레이드나 모든 과거 worker→현재 코드 전환을 검증하지 않았다.
- Chromium headless의 유한한 시나리오다. iOS/Safari·Android 설치형 PWA·백그라운드 종료·불안정망·장시간 사용·동시 편집 충돌 전체는 미검증이다.
- 인증된 운영 주문 조회·결제·실배차·예약 차단·AI/지도/푸시 등 외부 서비스는 범위 밖이다. 실제 주문이나 결제는 생성하지 않았다.
- 과금/배차 스케줄러 및 전체 `index.mts` 수명주기·운영 복원/rollback 훈련은 범위 밖이다.

이 결과는 기존 장바구니/PWA 결합 미검증 항목을 위 시나리오 범위에서 해소한다. 운영 데이터·배차·배포 설정은 변경하지 않았으며 Actions 중지를 유지한다.
