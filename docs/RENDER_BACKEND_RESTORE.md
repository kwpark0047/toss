# Render 백엔드 복구 런북 (2026-10-04)

기준 커밋 `2ceac03` · 대상 저장소 `kwpark0047/toss@main` · 대상 서비스 `wemarket`

Render Node 서비스 `wemarket`이 삭제되어 `wemarket.onrender.com`이 응답하지 않는
상태를 복구하는 절차와 검증 기준을 정리한다.

모든 항목은 실제 파일·DB·Render API 조회로 확인했다. 추정은 "미확인"으로 구분했다.

---

## 1. 왜 복구하는가

| 구성요소 | 상태 | 비고 |
|---------|------|------|
| 프런트엔드 (Vercel `toss`) | ✅ 정상 | `https://toss-hazel.vercel.app`, SHA `2ceac03` |
| 백엔드 (Render `wemarket`) | ❌ 삭제됨 | 서비스 0개, `onrender.com` 응답 없음 |
| 운영 DB (Supabase Singapore) | ✅ 정상 | 테이블 107개 |

루트 `vercel.json`은 `frontend/dist` SPA만 서빙하며 `/api`·`/functions` 백엔드가
없다. 즉 **상주 Node 백엔드는 Render에서만 제공**되므로, 복구 없이는 프런트의
모든 API 호출이 실패한다.

---

## 2. 완료된 선행 작업

| 항목 | 결과 |
|------|------|
| JWT HS256 algorithm pinning | 적용·테스트 통과 |
| backend/frontend CSRF 보호 | 적용·테스트 통과 |
| bulk SMS 쿼리 무제한 결함 | 제한 적용·테스트 통과 |
| 백엔드 전체 테스트 | 142 suites / 1248 tests 통과 |
| 프런트 CSRF 테스트 | 23/23 통과 |
| TypeScript·ESLint·`git diff --check` | 통과 |
| Vercel 배포 | `READY / PROMOTED` |
| 운영 DB migration 조회 | 완료 23건·실패 0건·미적용 1건 |

### 미적용 migration 1건

| 항목 | 값 |
|------|-----|
| 이름 | `20260923033303_add_ai_usage_logs` |
| 내용 | `ALTER TABLE ADD COLUMN` 2건 |
| 파괴적 변경 | **없음** (추가형) |
| 적용 주체 | Render build의 `npx prisma migrate deploy` |

Render build command에 이미 포함되어 있으므로 별도 실행 불필요.

---

## 3. 대상 서비스 사양

`render.yaml` 기준. Dashboard → Blueprints → New Blueprint Instance로 적용한다.

| 항목 | 값 |
|------|-----|
| 서비스명 | `wemarket` |
| hostname | `wemarket.onrender.com` |
| repo / branch | `kwpark0047/toss` / `main` |
| runtime | `node` |
| plan | `free` |
| region | `singapore` |
| build | `npm install && npx prisma migrate deploy && npx prisma generate` |
| start | `node --import tsx index.mts` |
| health check | `/api/health` |
| databases 블록 | 없음 (기존 Supabase 사용) |

> **hostname이 정확히 `wemarket.onrender.com`이어야 한다.**
> `frontend/.env.production`이 이 값을 가리키고 있어, 이름이 다르면 Vite URL 수정과
> 프런트 재빌드가 추가로 필요하다.

### 런타임 호환성 (확인됨)

| 항목 | 값 | 출처 |
|------|-----|------|
| Node 요구 | `>=22.22.0` | `package.json` engines |
| Node 고정 | `22.22.0` | `.nvmrc` |
| 컨테이너 | `node:22-alpine` | `Dockerfile` |
| tsx | `^4.23.13` | `package.json` |
| Prisma | `^5.22.0` | `package.json` |

`node --import tsx`는 Node 20.6+를 요구하므로 22.22.0에서 정상 동작한다.
`index.mts`에 즉시 응답하는 bootstrap 서버와 `routes/health.mts`가 있어
DB 연결 전 `/api/health`가 살아난다.

---

## 4. 환경변수 상태 (33개)

`.env.production`·`.env` 대조와 Render 대시보드 확인 기준.
**시크릿 값은 문서에 기재하지 않는다.**

### 4.1 채워져 있음 (13개) — 조치 불필요

| 키 | 출처 | 비고 |
|----|------|------|
| `DATABASE_URL` | `.env.production` | 운영 Supabase Singapore |
| `DIRECT_URL` | `.env.production` | migration용 직접 연결 |
| `SUPABASE_URL` | DB에서 추출 | 아래 4.4 참조 |
| `FRONTEND_URL` | 수동 입력 | `https://toss-hazel.vercel.app` |
| `CORS_ORIGIN` | 수동 입력 | ⚠️ 4.5 검증 필요 |
| `SMS_ENV` | literal | `coolsms` |
| `SMS_API_KEY` | 수동 입력 | CoolSMS |
| `SMS_API_SECRET` | 수동 입력 | CoolSMS |
| `SMS_SENDER` | 수동 입력 | CoolSMS 승인 발신번호 |
| `FIREBASE_API_KEY` | 수동 입력 | ⚠️ 4.6 검증 필요 |
| `FIREBASE_PROJECT_ID` | 수동 입력 | Firebase 콘솔 |
| `FIREBASE_MESSAGING_SENDER_ID` | 수동 입력 | Firebase 콘솔 |
| `FIREBASE_APP_ID` | 수동 입력 | Firebase 콘솔 |

### 4.2 🔴 즉시 채워야 할 5개 (부팅은 되지만 인증·결제 전 불가)

`.env.production`에 값이 존재하므로 **복사해서 붙여넣기만 하면 된다.**

| 키 | 용도 | 누락 시 증상 |
|----|------|-------------|
| `JWT_SECRET` | access token 서명/검증 | **모든 인증 API 500** (`jwt secret required`) |
| `JWT_REFRESH_SECRET` | refresh token 서명 | 재발급 불가 |
| `PHONE_ENC_KEY` | 전화번호 암호화 | 로그인·회원가입 실패 |
| `TOSS_SECRET_KEY` | Toss 결제 검증 | 결제 승인/취소 전부 실패 |
| `TOSS_CLIENT_KEY` | Toss 클라이언트 식별 | 결제창 미표시 |

> **`JWT_SECRET`이 가장 중요하다.** `utils/envValidator`는 현재 부팅 경로에서 호출되지
> 않아서 서비스는 뜬다. 하지만 인증 미들웨어가 `jwt.verify(token, '')`를 실행하며
> 예외를 던져, 인증이 필요한 모든 라우트가 500이 된다. 헬스체크는 통과하므로
> "서비스가 떴다"만으로는 정상 판정할 수 없다.

### 4.3 ⚪ 비워둘 것 (빈 값이 정답)

| 키 | 이유 |
|----|------|
| `SEED_KEY` | 미설정 시 `routes/_devOps.js`의 `timingSafeEqual`이 길이 불일치로 거부 |
| `ALERT_WEBHOOK_URL` | 미설정 시 `utils/alerting.js:71-75`가 로그로 대체하고 정상 종료 |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Render에 해당 파일이 없어 푸시 발송만 실패. 부팅 영향 없음 |
| `ENABLE_DEV_OPS` | 미설정 시 `/api/_devops/*`가 **무조건 403** |

> `ENABLE_DEV_OPS`를 두면 `/api/_devops/db-push`가
> `prisma db push --accept-data-loss`를 실행하므로, 운영에서 실수로 열면
> 데이터 손실 위험이 있다. 시드를 돌려야 할 때만 임시로 열고 즉시 제거한다.

### 4.4 `SUPABASE_URL` 재추출 방법

placeholder(`https://your-frontend.vercel.app` 계열)가 남아 있으면 아래에서 재추출한다.
프로젝트 reference는 `DATABASE_URL`의 사용자명에 들어 있다.

```
postgres.<project-ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com
                    └─ 이 부분 ─┘

→ SUPABASE_URL = https://<project-ref>.supabase.co
```

확인된 값: `https://yreoeqmcebnosmtlyump.supabase.co`
(공개 API 엔드포인트이며 비밀값이 아니다. 비밀번호는 포함하지 않는다.)

### 4.5 ⚠️ `CORS_ORIGIN` 형식 검증 필요

정확히 아래 값이어야 한다. 공백混入·누락 시 API가 전부 차단된다.

```
https://toss-hazel.vercel.app,https://wemarket.vercel.app
```

- 쉼표 구분이며 구분자 앞뒤 공백을 넣지 않는다.
- `https://` 스킴을 생략하지 않는다.
- `config/domain.js`의 `BACKEND_URL.split(',')` 로 파싱되어 원문 그대로 비교된다.

`FRONTEND_URL`은 OAuth redirect에 쓰이므로 `https://toss-hazel.vercel.app` 단일 값이어야 한다.

### 4.6 ⚠️ `FIREBASE_API_KEY` 재확인 필요

`.env`에 있던 값은 **길이가 21**이어서 실제 Firebase Web API 키가 아니다.
Firebase 콘솔 → 프로젝트 설정 → 일반 → 웹 API 키와 일치시키자.

현재는 푸시 발송만 비동작이고 서비스 기동에는 영향이 없다.

### 4.7 나중에 채워도 되는 값 (기능별)

부팅·헬스체크에는 영향 없으나, 해당 기능은 비작동한다.

| 키 | 영향받는 기능 | 발급처 |
|----|---------------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | 파일 업로드 (`STORAGE_DRIVER=supabase`) | Supabase → Project Settings → API |
| `TOSS_WEBHOOK_SECRET` | Toss webhook 검증 | Toss 개발자센터 |
| `TOSS_WEBHOOK_SIGNING_SECRET` | webhook 서명 검증 | Toss 개발자센터 |
| `TOSS_WEBHOOK_IPS` | webhook IP 대역 제한 | Toss 개발자센터 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 지도·검색 | 네이버 클라우드 콘솔 |
| `KAKAO_REST_API_KEY` | 카카오 지도·주소검색 | 카카오 개발자 콘솔 |
| `NCP_GEOCODE_KEY_ID` / `NCP_GEOCODE_KEY` | 주소 지오코딩 | 네이버 클라우드 콘솔 |
| `SEOUL_OPENAPI_KEYS` | 서울데이터 | 서울 열린데이터 |
| `UNSPLASH_ACCESS_KEY` | 이미지 검색 | unsplash.com/developers |
| `GEMINI_API_KEY` | AI 기능 | Google AI Studio |

### 4.8 비활성 상태 확인 (확인됨)

| 플래그 | 상태 | 의미 |
|--------|------|------|
| `BYPASS_OTP` | 미설정 | OTP 우회 비활성 |
| `EXPOSE_OTP` | 미설정 | OTP 노출 비활성 |
| `ALLOW_MOCK_PAYMENTS` | 미설정 | 모의 결제 비활성 |

운영에서 세 값이 모두 꺼져 있음을 확인했다. 이 중 하나라도 켜면 즉시 되돌린다.

---

## 5. 배포 절차

### 단계 1 — 시크릿 5개 입력

Render 대시보드 → `wemarket` 서비스 → Environment에서 4.2의 5개 키를
`.env.production`에서 복사해 입력한다.

```
JWT_SECRET  ·  JWT_REFRESH_SECRET  ·  PHONE_ENC_KEY  ·  TOSS_SECRET_KEY  ·  TOSS_CLIENT_KEY
```

### 단계 2 — Save & Deploy

`Save & Deploy`를 누른다. build log에서 `prisma migrate deploy`가
`20260923033303_add_ai_usage_logs`를 적용하는지 확인한다.

Free 플랜은 build·start 실패 시 자동 재시도하지 않는다. 실패하면 로그를 직접 읽고
원인을 고쳐 redeploy한다.

### 단계 3 — 헬스체크

Free 플랜은冷 Instance가 기본이라 최초 요청이 수십 초 걸릴 수 있다. 30초 이상
응답이 없으면 build log와 service log를 함께 본다.

---

## 6. 검증 절차

API 키 없이 공개 엔드포인트로 수행한다.

| # | 검사 | 방법 | 통과 기준 |
|---|------|------|-----------|
| 1 | 헬스체크 | `GET https://wemarket.onrender.com/api/health` | 200 |
| 2 | CORS 허용 | preflight에 `Origin: https://toss-hazel.vercel.app` | `Access-Control-Allow-Origin`에 동일 origin |
| 3 | CORS 거부 | `Origin: https://evil.example` | 허용 헤더 없음 |
| 4 | 인증 동작 | signup 또는 login 1회 | 500이 아닌 2xx/4xx |
| 5 | 프런트 연동 | `https://toss-hazel.vercel.app`에서 실제 API 호출 | 네트워크 오류 없음 |
| 6 | SPA fallback | 존재하지 않는 경로 직접 진입 | `index.html` 반환 |
| 7 | SW purge | 첫 방문 후 하드 리로드 | 구버전 청크 404 없음 |

> **검증 항목 4를 반드시 수행한다.** 헬스체크는 인증 시크릿 없이도 통과하므로,
> 1번만 통과했다고 정상으로 판정하면 안 된다.

---

## 7. 실패 시 대응

| 증상 | 원인 | 조치 |
|------|------|------|
| build 실패 `prisma` connection | `DATABASE_URL` 누락/오류 | 값 확인 후 redeploy |
| health 404 | start 실패 | `node --import tsx index.mts` 로그 확인 |
| 인증 API 500 `jwt secret required` | `JWT_SECRET` 미설정 | 4.2의 5개 입력 |
| 프런트 CORS 오류 | `CORS_ORIGIN` 형식 틀림 | 4.5대로 정확히 입력 |
| OAuth redirect 실패 | `FRONTEND_URL` 미설정 | canonical 단일 값으로 설정 |
| migration 재시도 | 트랜잭션 중간 실패 | `_prisma_migrations`의 failed row 확인 후 정리 |

---

## 8. 롤백

Render Free에는 이전 커밋으로의 자동 롤백이 없다.

1. 서비스 대시보드 → `Events`에서 마지막 정상 deploy의 커밋 SHA 확인
2. `Settings` → repository branch를 이전 커밋으로 고정하거나
3. 이전 커밋으로 revert한 PR을 머지해 redeploy한다.

롤백 시에도 migration은 되돌아가지 않는다. 스키마 변경이 있었다면
`prisma migrate resolve`로 수동 처리한다. 현재 미적용분은 **추가형이라
롤백 시 데이터 손실 위험이 없다.**

---

## 9. 보안 주의사항

> **이 문서와 저장소에 실제 시크릿 값을 커밋하지 않는다.**

- `.env.production`은 값이 채워진 상태이므로 git 추적 여부를 배포 전 확인한다.
- Render·Vercel·GitHub 자격증명이 작업 세션에 노출된 상태다.
  **최종 종료 후 전부 폐기·재발급**한다.
- `SEED_KEY`는 앱 내부 생성값이며 과거 운영값과 일치하지 않는다.
  필요 시 시드로만 생성하고 운영 환경에는 두지 않는다.
- dev 환경에서 production 키를 그대로 쓰지 않는다.

---

## 10. 후속 작업

| 우선순위 | 항목 | 비고 |
|----------|------|------|
| P0 | 노출 자격증명 재발급 | Render·Vercel·GitHub |
| P0 | `FIREBASE_API_KEY` 실제 값으로 교체 | 4.6 |
| P1 | `SUPABASE_SERVICE_ROLE_KEY` 입력 | 업로드 기능 |
| P1 | Toss webhook 시크릿 3종 입력 | 결제 기능 |
| P1 | `CORS_ORIGIN` 실측 확인 | 6번 검사 |
| P2 | 지역·지도 API 키 6종 입력 | 검색 기능 |
| P2 | 구형 `wemarket.vercel.app` 정책 | 아래 11절 |
| P3 | 알림 채널 구성 | Slack/Discord 웹훅 |
| P3 | AI 키 검증 | 권한·비용 확인 |

---

## 11. 미해결 정책 결정

구형 `https://wemarket.vercel.app`은 project `prj_nh4UbZtlE1ZjVdSF52yirbBnzoTn`,
team `team_aS8zqQvwTXUKk56uTPEgvsGO`에 속하며 현재 계정으로 접근할 수 없다.

선택지는 두 가지다.

| 선택 | 절차 | 결과 |
|------|------|------|
| A. 구형 폐기 | canonical을 `toss-hazel.vercel.app`로 확정 | 권한 불필요. 구형은 404 |
| B. 구형 유지 | 해당 팀 권한 확보 후 동일 커밋 재배포 | 두 도메인 공존 |

선택 B를 택하려면 팀 접근 권한이 먼저 필요하다. 그전까지 구형 도메인 갱신은 불가하다.

`config/domain.js`의 기본 백엔드는 죽은 `https://wemarket-toss.onrender.com`이다.
`wemarket.onrender.com`으로 수정하고 기본 CORS 목록에 canonical을 추가해야 한다.