# WeMarket TWA (Trusted Web Activity) 모바일 앱 패키징 가이드

## 개요

WeMarket의 PWA를 Android 앱스토어(Google Play Store)에 등록하기 위한 TWA 패키징 가이드입니다.
[TWA](https://web.dev/articles/using-a-pwa-in-your-android-app)는 웹 앱을 네이티브 앱처럼 감싸서 배포하는 기술입니다.

---

## 사전 요구사항

| 항목 | 버전/설정 |
|------|----------|
| Android Studio | Koala (2024.1+) |
| JDK | 17+ |
| Gradle | 8.x |
| Node.js | 18+ |
| 앱 스토어 계정 | Google Play Developer ($25 등록비) |

---

## 1단계: PWA 매니페스트 검증

`frontend/public/manifest.json`이 다음 필드를 포함하는지 확인:

```json
{
  "name": "위마켓 — QR 메뉴 & 매장 관리",
  "short_name": "위마켓",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#F97316",
  "background_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**⚠️ 중요**: TWA는 SVG 아이콘을 지원하지 않습니다. 반드시 PNG 아이콘(192x192, 512x512)이 있어야 합니다.

---

## 2단계: Android 프로젝트 생성

### 방법 A: Bubblewrap CLI (권장)

```bash
# 1. Bubblewrap 설치
npm install -g @nicepkg/bubblewrap

# 2. 프로젝트 초기화
npx @nicepkg/bubblewrap init \
  --domain="toss.wemarket.workers.dev" \
  --name="WeMarket QR Menu" \
  --shortName="WeMarket" \
  --package="work.wemarket.app" \
  --themeColor="#F97316" \
  --backgroundColor="#0f172a" \
  --appVersionCode=1 \
  --appVersionName="1.1.0" \
  --signingKeyPath="./keystore/release.keystore" \
  --iconPath="./frontend/public/icons/icon-512.png"
```

### 방법 B: 수동 Android 프로젝트

```bash
# 1. Android Studio에서 새 프로젝트 생성
#   - File → New → New Project → "Empty Activity"
#   - Package name: work.wemarket.app
#   - Minimum SDK: API 23 (Android 6.0)
#   - Language: Kotlin

# 2. build.gradle (app) 의존성 추가
dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}

# 3. AndroidManifest.xml에 intent-filter 추가
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="toss.wemarket.workers.dev" />
</intent-filter>
```

---

## 3단계: assetlinks.json 설정

Google Play에서 TWA를 인증하기 위해 `assetlinks.json` 파일이 필요합니다.

### 파일 위치
- `frontend/public/.well-known/assetlinks.json`
- `frontend/public/assetlinks.json` (alias)

### 설정값

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "work.wemarket.app",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT_HERE"]
    }
  }
]
```

**SHA-256 fingerprint 확인:**
```bash
# debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey

# release keystore
keytool -list -v -keystore ./keystore/release.keystore -alias wemarket
```

---

## 4단계: 빌드 및 서명

### 빌드 스크립트 (`frontend/scripts/build-twa.sh`)

```bash
#!/bin/bash
set -euo pipefail

echo "🏗️  WeMarket TWA 빌드 시작..."

# 1. Vite 프론트엔드 빌드
cd frontend
npm run build
echo "✅ 프론트엔드 빌드 완료"

# 2. Android 프로젝트 빌드
cd ../android
./gradlew assembleRelease
echo "✅ Android 빌드 완료"

# 3. APK/AAB 출력
echo "📦 출력 파일:"
ls -la app/build/outputs/bundle/release/*.aab 2>/dev/null || \
ls -la app/build/outputs/apk/release/*.apk 2>/dev/null

echo "🎉 빌드 완료!"
```

### APK 서명

```bash
# keystore 생성 (최초 1회)
keytool -genkey -v -keystore keystore/release.keystore \
  -alias wemarket -keyalg RSA -keysize 2048 -validity 10000

# APK 서명
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore keystore/release.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk wemarket
```

---

## 5단계: Google Play Store 업로드

1. [Google Play Console](https://play.google.com/console) 접속
2. 새 앱 생성
   - 앱 이름: **위마켓 — QR 메뉴 & 매장 관리**
   - 기본 언어: 한국어
   - 앱 유형: 앱
3. 스토어 리스팅 작성
   - 설명: QR 메뉴 주문, 실시간 주방 관리, 재고 관리, 매출 분석 통합 SaaS
   - 스크린샷: 앱 실행 화면 캡처
   - 아이콘: 512x512 PNG
4. AAB 파일 업로드
   - `app/build/outputs/bundle/release/app-release.aab`
5. 콘텐츠 설문조사 및 정책 검토 완료
6. 출시 (개인 → 내부 테스트 → 알파 → 베타 → 프로덕션)

---

## 6단계: Firebase Cloud Messaging (FCM) 설정

TWA에서 네이티브 푸시 알림을 받으려면 Firebase 설정이 필요합니다.

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Android 앱 추가 (패키지: `work.wemarket.app`)
3. `google-services.json` 파일을 `android/app/` 에 복사
4. `build.gradle`에 Firebase Messaging 의존성 추가

```gradle
implementation 'com.google.firebase:firebase-messaging:24.0.0'
```

---

## 참고: TWA vs PWA 비교

| 항목 | PWA (현재) | TWA (추가) |
|------|-----------|-----------|
| 설치 | 브라우저에서 "홈 화면에 추가" | Play Store에서 다운로드 |
| 푸시 알림 | Web Push (제한적) | FCM 네이티브 알림 |
| 자동 업데이트 | SW 자동 업데이트 | Play Store 업데이트 |
| 접근성 | URL 공유 가능 | 앱스토어 검색 |
| 오프라인 | SW 캐시 | Android WebView 캐시 |

---

## Troubleshooting

### Q: 앱이 브라우저를 열어버려요
A: `assetlinks.json`의 SHA-256 fingerprint가 실제 서명 키와 일치하는지 확인하세요.

### Q: 자동 업데이트가 안 돼요
A: `versionCode`를 증가시키고 AAB를 다시 업로드하세요.

### Q: Android 12+에서 알림이 안 와요
A: `POST_NOTIFICATIONS` 권한을 Android 13+ 런타임에서 요청해야 합니다.

---

## 파일 구조

```
wemarket-toss/250105/
├── TWA_SETUP.md                    ← 이 문서
├── frontend/
│   ├── public/
│   │   ├── manifest.json           ← PWA/TWA 매니페스트
│   │   ├── assetlinks.json         ← Android 인증
│   │   └── .well-known/
│   │       └── assetlinks.json     ← Google 인증
│   ├── scripts/
│   │   └── build-twa.sh           ← TWA 빌드 스크립트
│   └── twa-manifest.json          ← Bubblewrap 설정
└── android/                       ← Android 프로젝트 (생성 필요)
```
