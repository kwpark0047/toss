/**
 * firebaseAdmin.js — Firebase Admin SDK 초기화 단일 진입점
 *
 * [배경 — H-5]
 * firebase-admin v14 는 네임스페이스 API(`admin.apps`, `admin.messaging()`,
 * `admin.credential.cert()`)를 제거하고 모듈러 API 만 제공한다.
 * 여러 파일이 각자 초기화하던 코드를 이 모듈로 통합해
 * 향후 SDK 변경 시 수정 지점을 한 곳으로 유지한다.
 *
 * 자격 증명 우선순위:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  (서비스 계정 JSON 문자열 — 컨테이너 환경 권장)
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH  (서비스 계정 파일 경로)
 *   3. 미설정 → 푸시 비활성화 (앱은 정상 기동)
 */
const path = require('path');
const logger = require('./logger');

let _messaging = null;
let _initialized = false;

/** 서비스 계정 자격 증명을 로드한다. 없으면 null. */
function loadServiceAccount() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson);
    } catch (e) {
      logger.error(`[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON 파싱 실패: ${e.message}`);
      return null;
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    try {
      return require(path.resolve(filePath));
    } catch (e) {
      logger.error(`[Firebase] 서비스 계정 파일 로드 실패(${filePath}): ${e.message}`);
      return null;
    }
  }

  return null;
}

/**
 * Firebase Admin 앱을 (필요 시) 초기화하고 Messaging 인스턴스를 반환한다.
 * 자격 증명이 없거나 SDK 로드에 실패하면 null 을 반환한다(앱 기동은 계속).
 *
 * @param {{ firebaseApp?: object, firebaseMessaging?: object }} [deps]
 *   테스트용 의존성 주입. 생략하면 실제 firebase-admin 모듈을 사용한다.
 * @returns {import('firebase-admin/messaging').Messaging|null}
 */
function getMessagingClient(deps = {}) {
  if (_initialized) return _messaging;
  _initialized = true;

  try {
    const firebaseApp = deps.firebaseApp || require('firebase-admin/app');
    const firebaseMessaging = deps.firebaseMessaging || require('firebase-admin/messaging');
    const { getApps, initializeApp, cert } = firebaseApp;
    const { getMessaging } = firebaseMessaging;

    if (getApps().length === 0) {
      const serviceAccount = loadServiceAccount();
      if (!serviceAccount) {
        logger.warn('[Firebase] 서비스 계정 미설정 — 푸시 알림이 비활성화됩니다.');
        return null;
      }
      initializeApp({ credential: cert(serviceAccount) });
      logger.info('[Firebase] Admin SDK 초기화 완료');
    }

    _messaging = getMessaging();
    return _messaging;
  } catch (error) {
    logger.warn(`[Firebase] Admin SDK 로드 실패 (푸시 제한): ${error.message}`);
    _messaging = null;
    return null;
  }
}

/**
 * 초기화된 Firebase 앱을 모두 정리 (테스트 teardown 용)
 * @param {{ firebaseApp?: object }} [deps] 테스트용 의존성 주입
 */
async function shutdownFirebase(deps = {}) {
  try {
    const firebaseApp = deps.firebaseApp || require('firebase-admin/app');
    const { getApps, deleteApp } = firebaseApp;
    await Promise.all(getApps().map((app) => deleteApp(app)));
  } catch {
    // SDK 미설치/미초기화 — 무시
  } finally {
    _messaging = null;
    _initialized = false;
  }
}

/** 테스트 전용: 내부 캐시 초기화 */
function _resetForTests() {
  _messaging = null;
  _initialized = false;
}

module.exports = { getMessagingClient, shutdownFirebase, loadServiceAccount, _resetForTests };
