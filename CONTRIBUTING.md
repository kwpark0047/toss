# Contributing to WeMarket

WeMarket에 기여해 주셔서 감사합니다! 이 문서는 프로젝트에 기여하는 방법을 안내합니다.

## 시작하기

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/kwpark0047-iceu/250105.git
cd 250105

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일 편집 (DATABASE_URL, JWT_SECRET 등 필수 값 입력)

# DB 마이그레이션
npx prisma migrate dev

# 시드 데이터
npm run seed

# 개발 서버 실행
npm start  # 백엔드 :3000

# 프론트엔드 별도 실행
cd frontend
npm install
npm run dev
```

## 개발 워크플로우

### 1. 이슈 생성
- GitHub Issues에서 버그 리포트, 기능 요청, 개선 사항 등록
- 템플릿 사용 권장 (Bug Report, Feature Request, Improvement)

### 2. 브랜치 전략

```
main (보호된 브랜치)
├── develop (개발 브랜치)
│   ├── feature/이슈번호-기능명
│   ├── fix/이슈번호-버그명
│   ├── refactor/이슈번호-리팩토링명
│   └── docs/이슈번호-문서명
```

### 3. 커밋 컨벤션

```
<type>(<scope>): <description>

Types:
  feat     - 새로운 기능
  fix      - 버그 수정
  docs     - 문서 수정
  style    - 코드 포맷팅, 세미콜론 등 (기능 변경 없음)
  refactor - 리팩토링 (기능 변경 없음)
  perf     - 성능 개선
  test     - 테스트 추가/수정
  chore    - 빌드/설정/의존성 변경
  security - 보안 관련

Scopes: admin | ai | api | auth | cart | kds | landing | menu | order | payment | review | store | ui | etc.

Examples:
  feat(menu): 카테고리별 필터링 추가
  fix(order): 주문 취소 시 포인트 환급 로직 수정
  perf(frontend): 이미지 WebP 변환 적용
  test(api): 주문 생성 API 통합 테스트 추가
```

### 4. Pull Request 프로세스

1. `develop` 브랜치에서 작업 브랜치 생성
2. 작업 완료 후 PR 생성 (develop 브랜치 대상)
3. PR 템플릿 작성 필수:
   - 변경 사항 요약
   - 관련 이슈 번호
   - 테스트 방법
   - 스크린샷 (UI 변경 시)
2. 코드 리뷰 통과 후 `develop` 병합
3. 릴리즈 준비 시 `main`에 머지

## 코드 스타일 가이드

### Backend (Node.js/Express)

```javascript
// ESLint 설정 준수 (.eslintrc.js)
// - no-unused-vars: error (언더스코어 _ 접두사로 미사용 허용)
// - no-var: error (const/let 사용)
// - prefer-const: error
// - eqeqeq: error (=== 사용)
// - curly: error (블록 필수)

// Import 순서
// 1. Node 내장 모듈
// 2. 외부 라이브러리
// 3. 내부 모듈 (@/* 경로)

// JSDoc 필수 (공개 함수/클래스)
/**
 * 주문 생성
 * @param {Object} data - 주문 데이터
 * @returns {Promise<Object>} 생성된 주문
 */
async function createOrder(data) { ... }
```

### Frontend (React/Vite)

```javascript
// ESLint + Prettier 준수 (frontend/eslint.config.js)
// - react-hooks/rules-of-hooks: error
// - react-refresh/only-export-components: warn

// 컴포넌트 구조
// - 함수형 컴포넌트 + hooks
// - props interface 필수 (TypeScript 사용 시)
// - 커스텀 훅은 `use` 접두사 (useAuth, useKioskMode 등)

// CSS: Tailwind CSS 유틸리티 클래스 우선
// - 의미있는 클래스명보다는 유틸리티 조합 선호
// - 반응형: mobile-first (sm:, md:, lg:, xl:)
```

### 데이터베이스 (Prisma)

```prisma
// 스키마 변경 시 마이그레이션 생성 필수
npx prisma migrate dev --name descriptive_name

// 컨벤션
// - 모델명: PascalCase 단수 (Store, Order, Product)
// - 필드명: camelCase (storeId, createdAt)
// - 관계명: 단수/복수 명확히 (store, orders)
// - 인덱스: @@index([field1, field2])
// - 유니크: @@unique([field1, field2])
```

### 테스트 작성

```javascript
// Jest + React Testing Library
// 파일명: *.test.js (단위), *.spec.js (E2E)

// 단위 테스트 패턴
describe('OrderService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('주문을 생성한다', async () => {
    // Given
    const mockData = { storeId: 1, items: [...] };
    
    // When
    const result = await OrderService.createOrder(mockData);
    
    // Then
    expect(result).toBeDefined();
    expect(OrderRepository.create).toHaveBeenCalledWith(expect.objectContaining(mockData));
  });
});

// 통합 테스트
// - 실제 DB 연결 (PostgreSQL 컨테이너)
// - Supertest로 API 엔드포인트 호출
```

## 코드 리뷰 체크리스트

### 기능성
- [ ] 요구사항 충족
- [ ] 엣지 케이스 처리
- [ ] 에러 처리 적절 (try/catch, next(err))

### 코드 품질
- [ ] ESLint/Prettier 통과
- [ ] 타입 안전성 (TypeScript 사용 시)
- [ ] 중복 코드 없음 (DRY)
- [ ] 함수/컴포넌트 단일 책임

### 보안
- [ ] 입력 검증/새니타이징
- [ ] 인증/인가 검사
- [ ] SQL 인젝션 방지 (Prisma 사용 시 자동)
- [ ] XSS 방지 (sanitize-html, xss-clean)

### 성능
- [ ] N+1 쿼리 방지 (Prisma include/select)
- [ ] 불필요한 리렌더링 방지 (React.memo, useMemo, useCallback)
- [ ] 이미지 최적화 (WebP/AVIF, 적절한 크기)

### 테스트
- [ ] 단위 테스트 추가/수정
- [ ] 통합 테스트 통과
- [ ] 회귀 테스트 고려

## 릴리즈 프로세스

### 버전 관리 (SemVer)
- **Major**: Breaking changes
- **Minor**: 새로운 기능 (하위 호환)
- **Patch**: 버그 수정 (하위 호환)

### 릴리즈 절차
1. `develop` → `main` PR 생성
2. 버전 번호 업데이트 (`package.json`, `CHANGELOG.md`)
3. 태그 생성: `git tag v1.x.x`
4. GitHub Release 생성
5. CI/CD 파이프라인 자동 배포

## 도움말

### 유용한 명령어
```bash
# 타입 체크
npm run typecheck

# 린트 수정
npm run format

# 테스트 단일 실행
npm test -- --testNamePattern="주문 생성"

# 커버리지 리포트
npm run test:coverage

# 프론트엔드 성능 예산
cd frontend && npm run perf:budget

# 번들 분석
cd frontend && npm run analyze
```

## 문의 및 지원

- GitHub Issues: 버그/기능 요청
- GitHub Discussions: 질문/토론
- 이메일: team@wemarket.kr

---

**모든 기여를 환영합니다!** 🎉
