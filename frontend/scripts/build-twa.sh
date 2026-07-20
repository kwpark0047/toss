#!/bin/bash
set -euo pipefail

# WeMarket TWA (Trusted Web Activity) 빌드 스크립트
# Usage: bash scripts/build-twa.sh [--release]

echo "🏗️  WeMarket TWA 빌드 시작..."
echo "============================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# ── 1. 프론트엔드 빌드 ──
echo ""
echo "📦 Step 1/4: 프론트엔드 빌드..."
cd "$FRONTEND_DIR"
npm run build
echo "✅ 프론트엔드 빌드 완료 ($FRONTEND_DIR/dist)"

# ── 2. Android 프로젝트 확인 ──
ANDROID_DIR="$PROJECT_ROOT/android"
if [ ! -d "$ANDROID_DIR" ]; then
  echo ""
  echo "⚠️  Android 프로젝트가 없습니다."
  echo "    Android Studio에서 새 프로젝트를 생성하세요:"
  echo "    - Package name: work.wemarket.app"
  echo "    - Min SDK: 23 (Android 6.0)"
  echo "    - Language: Kotlin"
  echo ""
  echo "    또는 Bubblewrap 사용:"
  echo "    npx @nicepkg/bubblewrap init --domain=toss.wemarket.workers.dev --package=work.wemarket.app"
  exit 1
fi

# ── 3. Android 빌드 ──
echo ""
echo "🤖 Step 2/4: Android 프로젝트 빌드..."
cd "$ANDROID_DIR"

if [ "${1:-}" = "--release" ]; then
  echo "   릴리스 빌드 모드"
  ./gradlew bundleRelease
  AAB_PATH=$(find app/build/outputs/bundle -name "*.aab" 2>/dev/null | head -1)
  if [ -n "$AAB_PATH" ]; then
    echo "✅ AAB 빌드 완료: $AAB_PATH"
  else
    echo "❌ AAB 빌드 실패"
    exit 1
  fi
else
  echo "   디버그 빌드 모드 (--release 로 릴리스 빌드)"
  ./gradlew assembleDebug
  APK_PATH=$(find app/build/outputs/apk/debug -name "*.apk" 2>/dev/null | head -1)
  if [ -n "$APK_PATH" ]; then
    echo "✅ APK 빌드 완료: $APK_PATH"
  else
    echo "❌ APK 빌드 실패"
    exit 1
  fi
fi

# ── 4. 출력 ──
echo ""
echo "📦 Step 3/4: 빌드 결과"
if [ "${1:-}" = "--release" ]; then
  echo "   Release AAB: $AAB_PATH"
  echo "   → Google Play Console에 업로드하세요"
else
  echo "   Debug APK: $APK_PATH"
  echo "   → 기기에 설치하여 테스트하세요"
fi

# ── 5. 안내 ──
echo ""
echo "📋 Step 4/4: 다음 단계"
echo "   1. SHA-256 fingerprint 확인:"
echo "      keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey"
echo "   2. frontend/public/assetlinks.json 업데이트"
echo "   3. Google Play Console 업로드 (릴리스)"
echo ""
echo "🎉 TWA 빌드 완료!"
