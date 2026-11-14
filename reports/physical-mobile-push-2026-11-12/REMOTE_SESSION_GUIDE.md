# BrowserStack Live 실기기 연결 및 푸시 검증

> 커밋된 링크·QR은 당시 실행 증거이며 이미 만료될 수 있습니다. 현재 시험은 `node scripts/mobile-push-lab.cjs --isolated-test-only`가 출력하는 새 링크를 사용하세요. 개발자 준비 절차: `scripts/MOBILE_PUSH_LAB.md`.

## 현재 연결과 테스트 주소

- 사용자가 제공한 제품 선택 화면: https://www.browserstack.com/user/choose-product
- 웹사이트 시험용 **Live → Mobile → 실제 기기**를 선택한다. 대시보드: https://live.browserstack.com/dashboard
- 최초 iPhone 15 Pro / iOS 17.1 세션은 해당 기기의 무료 체험 시간이 소진되어 종료됐다. 이후 Galaxy S24 / Android 14.0 및 iPhone 15 / iOS 17.5를 연결했지만 각각 1분 체험 후 종료됐다. 사용자가 현재 1분 체험만 가능하다고 확인했다. 이번 증거는 session-recheck/REPORT.md를 확인한다. `browserstack-trial-expired.png`가 실제 화면이다. 업그레이드나 유료 구독을 신청하지 않았다. 계정의 기존 이용 권한 또는 관리자에게 배정받은 실기기 시간이 필요하다.
- 임시 테스트: https://surely-list-embassy-stats.trycloudflare.com/lab
- 만료: **2026-11-12 05:50:32 한국시간**. 로컬 서버와 터널이 계속 실행되어야 한다. 재시작하면 주소가 바뀌므로 PWA 설치와 알림 동의를 다시 한다.

이 환경은 격리 PostgreSQL·Redis와 합성 계정, 매장 1, QA 테스트 메뉴 10,000원만 사용한다. 이름·전화번호는 입력하지 않는다. 카드/토스 승인·청구·관리자·웹훅 API는 공개하지 않는다. 현금 요청은 로컬 DB에 READY로 등록되고 주문 결제 상태는 pending으로 유지된다. 실제 결제 완료 검증을 뜻하지 않는다. 점주 비밀번호와 운영자 토큰은 원격 기기에 전달하지 않는다.

## 기기 연결

1. PC Chrome에서 직접 로그인한 뒤 Live 대시보드에서 Android Chrome 실기기를 선택한다. 기종·OS·브라우저 버전을 화면으로 기록한다.
2. 위 테스트 주소를 열고 기기 환경 확인 화면을 저장한다. `secureContext`, `pushManager` 및 알림 권한을 확인한다.
3. iPhone은 iOS 16.4 이상 Safari 실기기로 별도 세션을 시작한다. Safari 공유 메뉴 → 홈 화면에 추가 → BrowserStack 툴바 Show Home Screen → 설치된 **푸시 QA** 아이콘을 연다. **설치된 앱 안에서 주문과 알림 동의를 진행한다.** 환경 확인에서 standalone=true를 기록한다.
4. 시험 동안 BrowserStack 세션 자체는 종료하지 않는다. 고객 페이지를 닫는 것과 원격 기기를 반납하는 것은 다르다.

BrowserStack의 PWA 설치 절차: https://www.browserstack.com/support/faq/live/features-live/how-can-i-progressive-web-app-pwa-specific-scenarios-on-devices-in-live

Apple의 홈 화면 웹 앱 Web Push 조건: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## 주문부터 실제 알림 클릭까지

1. 테스트 주문 시작 → QA 테스트 메뉴 1개 → 장바구니 → 매장에서 먹기 → 현금 주문하기. 주문 번호·10,000원·미결제 상태와 감사 화면을 저장한다.
2. 매장찾기·주문진행 확인을 누르고 해당 주문 카드에서 준비 완료 알림을 켠다. OS 권한 요청을 직접 허용하고 '이 페이지를 닫아도 준비 완료 알림을 받아요'를 확인한다.
3. 기기에서 고객 페이지를 모두 닫는다. iPhone 홈 화면 앱은 홈 이동 상태와 앱 전환기 강제 종료 상태를 별도 시험으로 기록한다. 홈 이동만 확인했다면 '페이지 완전 종료 통과'로 쓰지 않는다.
4. PC의 프로젝트 폴더에서 아래 로컬 운영 명령을 실행한다. 해당 세션에서 생성된 주문만 변경할 수 있다.

```powershell
node scripts/mobile-push-lab-control.cjs list
node scripts/mobile-push-lab-control.cjs ready <주문ID>
```

5. Android 알림창 또는 iPhone 알림 센터를 열어 준비 완료 알림을 확인하고 화면을 저장한다. iOS 원격 스트림에는 홈 화면 배너가 보이지 않을 수 있으므로 알림 센터도 확인한다: https://www.browserstack.com/support/faq/mobile/features-mobile/when-testing-the-push-notification-functionality-of-my-app-i-dont-see-any-notifications-in-the-home-screen-banner-on-browserstack-live-and-app-lives-ios-devices-why
6. **실제 OS 알림을 탭**한다. 열린 주문 진행 카드의 같은 주문 번호·금액·준비 완료 상태를 저장한다. URL 직접 입력이나 notificationclick 이벤트 주입은 이 단계의 증거로 인정하지 않는다.
7. 별도 주문 완료 화면에서 매장찾기·네이버·유튜브 세 버튼을 각각 눌러 목적지와 복귀 동작을 기록한다. 외부 사이트에 로그인하지 않는다.
8. 시험 후 알림을 해제하고 설치한 QA PWA를 삭제한 뒤 원격 세션을 종료한다. 로컬 환경 종료: `node scripts/mobile-push-lab-control.cjs stop`.

## 증거 기준

기기별로 기종/OS/브라우저, 환경 확인, 주문 번호/금액/미결제, 알림 동의, 페이지 종료 상태, OS 알림 수신, 실제 탭 후 동일 주문 화면을 저장한다. 준비 완료 변경·수신·클릭 시각을 UTC와 한국시간으로 기록한다. BrowserStack 녹화/스크린샷 기능을 사용하고 개인 계정 화면은 포함하지 않는다.

실제 Android/iPhone 결과는 상위 `results.json`에만 기록한다. `environment-preflight`의 Windows Edge 결과는 환경 사전 점검이며 실기기 통과 증거가 아니다. 계정이 있어도 해당 요금제/기기에서 PWA 설치 또는 알림 기능이 제한되면 제한 화면을 남기고 미검증으로 유지한다.

임시 HTTPS 터널 특성: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
