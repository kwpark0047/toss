# WeMarket 프로젝트 상태 및 다음 단계

## 현재 상태

- 제품: QR 메뉴, 주문·결제, KDS, 직원 권한, 고객·CRM, 예약·웨이팅, 리뷰·커뮤니티, AI 추천, 동적 가격, 푸드트럭 기능을 포함한다.
- 구조: Express 5 + Prisma/PostgreSQL 백엔드와 React 19 + Vite 7 프론트엔드가 한 저장소에 있다.
- 배포: Render 백엔드와 Cloudflare Workers 프론트엔드로 분리되어 있다.
- 품질: 백엔드 단위·라우트 테스트 107개 suite, 947개 테스트가 통과했다. 프론트 테스트는 worker 수를 1개로 제한해 실행 안정화를 진행 중이다.

## 이번 단계에서 반영한 기반 개선

1. 배포 job이 보안·Docker·Trivy·번들·Lighthouse 결과를 기다리도록 CI 게이트를 강화했다.
2. README, CLAUDE, ARCHITECTURE의 기술 버전과 배포 설명을 실제 구성에 맞췄다.
3. 주문과 KDS 상태 전이 규칙을 `utils/orderStatus.js`로 중앙화했다.
4. `audit_logs` 모델·마이그레이션과 민감정보 마스킹 감사 로그 서비스를 추가했다.
5. `FEATURE_FLAGS_JSON` 기반 boolean·결정적 rollout Feature Flag 서비스를 추가했다.
6. DB Feature Flag에 환경·매장 scope 복합 키를 적용하고 KDS에 `kds_v2` flag를 연결했다.

## 단계별 로드맵

### 1단계: 릴리스 안정화

- CI 전체 게이트 통과 확인
- 프론트 Vitest worker timeout 제거
- OpenAPI와 실제 라우트 계약 비교 자동화
- 권한 매트릭스 테스트를 모든 매장 리소스로 확대

### 2단계: 운영 기반

- 감사 로그 관리자 조회 화면과 검색·보존 정책 추가
- 주문·결제·KDS 이벤트의 공통 이벤트 원장 구축
- Feature Flag와 롤백 절차 도입
- 장애·지연·프린트 실패 SLO와 알림 정의

### 3단계: 매출 기능

- 재고 임계치 기반 자동 발주
- 신규·휴면·등급 상승 고객 CRM 자동 캠페인
- 멀티매장 통합 대시보드
- AI 추천·수요예측 결과의 근거와 신뢰도 표시

### 4단계: 확장 플랫폼

- 외부 개발자용 Open API와 세분화된 API Key scope
- 구독·요금제 Feature Flag 연동
- 다국어 알림톡·영수증
- 플러그인형 결제·프린터·CRM 연동 구조
