# CI/빌링 진단 및 개선 가이드

GitHub Actions 무료 티어(월 2,000분) 초과로 CI가 차단된 이력에 대한 진단과 개선 방안을 정리한다.

---

## 1. 문제 현황

- **무료 티어 한도**: GitHub Actions 무료 티어는 월 2,000분 제공
- **초과 원인**: push/PR 시마다 실행되는 필수 잡(lint, 테스트)과 무거운 잡(통합/E2E/보안)의 병행 실행으로 분 소비 증가
- **영향**: CI 차단 → PR 머지 지연 → 배포 지연

---

## 2. 현재 워크플로우 구조

### 필수 잡 (push/PR 시 자동 실행)

| 잡 | 내용 | 예상 소요 |
|----|------|----------|
| `ci.yml` | lint, Prisma validate, 유닛/라우트 테스트, 라우트·API 계약 검증 | ~5-8분 |

### 선택 잡 (수동/스케줄)

| 잡 | 내용 | 예상 소요 |
|----|------|----------|
| `test.yml` | 통합 테스트 | ~10-15분 |
| `playwright.yml` | E2E 테스트 | ~15-20분 |
| `security.yml` | Semgrep, npm audit, TruffleHog | ~10-15분 |

---

## 3. 개선 방안

### 3.1 캐시 최적화

```yaml
# .github/workflows/ci.yml에 추가
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

**효과**: npm install 시간 50-70% 단축 (매 빌드 ~2-3분 절약)

### 3.2 테스트 병렬화·분할

```yaml
# 유닛 테스트를 2개 그룹으로 분할
strategy:
  matrix:
    test-group: [unit, routes]
```

**효과**: 테스트 시간 30-40% 단축

### 3.3 주간 스케줄 중복 제거

현재 상태:
- `test.yml`: 수동 + 주간 스케줄
- `playwright.yml`: 주간 스케줄 (화요일 새벽 3시)
- `security.yml`: 주간 스케줄 + 수동

개선:
- `test.yml`과 `playwright.yml` 스케줄을 동일 시간대로 통합
- `security.yml`은 월 1회로 변경

### 3.4 무거운 잡 조건부 실행

```yaml
# 통합/E2E 테스트는 경량 테스트 통과 후에만 실행
if: success() && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')
```

### 3.5 외부 플랫폼 배포 잡 최소화

- Render 배포: `push to main`에서만 실행 (PR 시 배포 스킵)
- Cloudflare Workers: `push to main`에서만 실행

---

## 4. 모니터링

### GitHub Actions 사용량 확인

1. GitHub repository → Settings → Actions → General
2. "Usage" 탭에서 월별 사용량 확인
3. 경고: 1,800분(90%) 초과 시 알림

### 로컬 모니터링 스크립트

```bash
# 월간 CI 사용량 요약 (GitHub API)
gh api repos/{owner}/{repo}/actions/runs --jq '.workflow_runs[] | .created_at' | head -100
```

---

## 5. 비용 영향 분석

| 시나리오 | 월간 사용량 | 비용 |
|----------|-------------|------|
| 현재 (개선 전) | ~2,500분 | 무료 티어 초과 |
| 캐시 최적화 적용 | ~1,800분 | 무료 티어 내 |
| 테스트 분할 + 캐시 | ~1,500분 | 무료 티어 내 |
| 스케줄 통합 + 분할 | ~1,200분 | 무료 티어 내 |

---

## 6. 체크리스트

- [ ] `ci.yml`에 npm 캐시 추가
- [ ] 유닛 테스트를 2개 그룹으로 분할
- [ ] 주간 스케줄 중복 제거
- [ ] 통합/E2E 테스트 조건부 실행 활성화
- [ ] Render/Cloudflare 배포 잡을 main 브랜치로 제한
- [ ] 월간 사용량 모니터링 자동화

---

## 7. 참고 자료

- [GitHub Actions pricing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [GitHub Actions caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Prisma + GitHub Actions caching](https://www.prisma.io/docs/guides/continuous-integration/prisma-client-cli-and-studio/caching)
