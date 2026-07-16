# WeMarket 프로젝트 종합 분석 리포트

**분석일**: 2026-07-16
**프로젝트**: WeMarket - SaaS QR Menu & Store Management Platform
**버전**: 1.2.0
**스택**: Express 5.2 / Prisma 5.22 / PostgreSQL (Supabase) + React 19 / Vite 7 / Tailwind 4

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **목적** | QR 메뉴 주문 + 프랜차이즈 매장 관리 SaaS 플랫폼 |
| **사이트** | https://toss.wemarket.workers.dev (프론트) / https://wemarket-toss.onrender.com (백엔드) |
| **GitHub** | https://github.com/kwpark0047-iceu/250105 |
| **DB** | PostgreSQL (Supabase) - 모델 51개, Prisma 스키마 990줄 |
| **배포** | Cloudflare Workers Assets (프론트엔드) + Render (백엔드) |

---

## 2. 현재 진행 상황 (완료된 주요 마일스톤)

1. **백엔드 아키텍처 고도화 (4-Tier)**: Controller에 집중되어 있던 비즈니스 로직을 Service 계층으로 완벽히 분리 (BoardService, aiService, OrderService 등).
2. **프론트엔드 컴포넌트 최적화**: 1,400줄 이상의 거대 컴포넌트(MenuManager 등)를 커스텀 훅(`useMenuManager.js`)과 하위 UI 컴포넌트로 분리. 린트 에러 213개 해결 및 Fast Refresh 오류 교정.
3. **프론트엔드 배포 환경 마이그레이션**: Vercel에서 **Cloudflare Workers (Static Assets)**로 이전 완료. SPA 라우팅 지원을 위해 `wrangler.json` 구성 완비.
4. **테이블 QR 코드 URL 안정화**: 테이블 번호 한글 인코딩(`1번`)으로 인한 오류 해결을 위해 62만 개의 기존 테이블 데이터를 숫자형(`1`, `2`)으로 재생성 완료. Cloudflare 도메인 하드코딩 적용.
5. **고급 기능 추가 완비**:
   - **KDS 및 웹 블루투스 영수증 프린터**: KDS 화면에서 주문 승인 시 Web Bluetooth API를 통해 ESC/POS 감열식 프린터로 영수증 자동 인쇄.
   - **글로벌 메뉴 AI 자동 번역**: 신규 메뉴 등록 시 AI가 다국어(EN, JP, CN)로 자동 번역하여 DB(`translations` JSON)에 저장.
   - **재고 동기화 및 자동 품절 처리**: 주문 수락 시 재고 차감 및 품절 시 WebSocket 기반 실시간 메뉴판 상태 동기화.
   - **고객 멤버십/포인트 적립**: 주문 완료 시 전화번호 기반 포인트 적립 로직 적용.
   - **지오펜싱(Geo-fencing) & SSE**: 매장 반경 500m 내 주문 제한 및 실시간 주문 알림 적용.
   - **다중 매장(프랜차이즈) 본사 대시보드 및 통계 대시보드**: Recharts를 활용한 데이터 시각화 및 본사 권한 페이지 구축.

---

## 3. 현재 남아있는 문제점 (Technical Debt / Issues)

1. **테스트 커버리지 부족**: 핵심 로직(결제, 재고 차감, 포인트 적립)에 대한 E2E 및 단위 테스트가 누락되어 있습니다. 사이드 이펙트 발생 시 런타임에 발견될 위험이 높습니다.
2. **웹 블루투스(Web Bluetooth)의 한계**: KDS 영수증 출력 기능이 Web Bluetooth에 의존하고 있어, Safari(iOS/macOS)나 블루투스 모듈이 없는 데스크톱에서는 작동하지 않습니다.
3. **문서 현행화 지연**: 백엔드 API 명세서(Swagger/OpenAPI)가 업데이트된 서비스 계층 구조를 반영하지 못하고 있을 수 있습니다.
4. **프론트엔드 다국어(i18n) 지원 미비**: DB에는 글로벌 메뉴 번역(EN, JP, CN)이 저장되고 있으나, 실제 고객용 QR 메뉴판 화면 UI(버튼, 알림 등)는 여전히 한국어로 하드코딩되어 있습니다.

---

## 4. 추가 기능 제안 (Next-Step Feature Proposals)

1. **로컬 프린트 에이전트 (Local Print Agent)**
   - **내용**: 웹 블루투스의 한계를 극복하기 위해 매장 POS PC에 설치하는 가벼운 데스크톱 에이전트(Electron 또는 Node.js 데몬) 개발. USB/LAN 영수증 프린터와 직접 통신하여 KDS와 연동.
   - **효과**: 프린터 호환성 극대화 및 백그라운드 자동 인쇄 신뢰성 확보.

2. **완전한 다국어 UI 시스템 (React-i18next 도입)**
   - **내용**: 고객의 브라우저 언어 설정을 감지하여 QR 메뉴판의 UI 텍스트(주문하기, 장바구니, 결제 등)를 다국어로 자동 전환.
   - **효과**: 글로벌 메뉴 AI 번역 데이터와 결합하여 완벽한 인바운드 외국인 관광객 대응 가능.

3. **카카오 알림톡 기반 웨이팅(대기) 호출 시스템**
   - **내용**: 대기열(Waiting) 등록 시 카카오 알림톡으로 순번 및 대기 예상 시간 발송. 입장 차례가 오면 호출 메시지 전송.
   - **효과**: 매장 앞 혼잡도 감소 및 노쇼(No-show) 방지.

4. **프랜차이즈 점주용 모바일 앱 (PWA 고도화)**
   - **내용**: 현재의 Firebase Web Push를 넘어, 매장 점주가 앱스토어/플레이스토어에서 다운로드 받을 수 있는 TWA(Trusted Web Activity) 기반 하이브리드 앱 패키징.
   - **효과**: 네이티브 푸시 알림 신뢰성 확보 및 접근성 향상.
