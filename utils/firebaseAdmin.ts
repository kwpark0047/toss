import path from 'path';
import logger from './logger.js';

let _messaging: any = null;
let _initialized = false;

/** 서비스 계정 자격 증명을 로드한다. 없으면 null. */
function loadServiceAccount(): any {
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
 * @returns {Promise<import('firebase-admin/messaging').Messaging|null>}
 */
export async function getMessagingClient(deps: { firebaseApp?: any; firebaseMessaging?: any } = {}): Promise<any | null> {
  if (_initialized) return _messaging;
  _initialized = true;

  try {
    const firebaseApp = deps.firebaseApp || (await import('firebase-admin/app'));
    const firebaseMessaging = deps.firebaseMessaging || (await import('firebase-admin/messaging'));
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

    const { getMessaging } = await import('firebase-admin/messaging');
    _messaging = getMessaging();
    return _messaging;
  } catch (error: any) {
    logger.warn(`[Firebase] Admin SDK 로드 실패 (푸시 제한): ${error.message}`);
    _messaging = null;
    return null;
  }
}

/**
 * 초기화된 Firebase 앱을 모두 정리 (테스트 teardown 용)
 * @param {{ firebaseApp?: object }} [deps] 테스트용 의존성 주입
 */
export async function shutdownFirebase(deps: { firebaseApp?: any } = {}): Promise<void> {
  try {
    const firebaseApp = deps.firebaseApp || (await import('firebase-admin/app'));
    const { getApps, deleteApp } = firebaseApp;
    await Promise.all(getApps().map((app: any) => deleteApp(app)));
  } catch {
    // SDK 미설치/미초기화 — 무시
  } finally {
    _messaging = null;
    _initialized = false;
  }
}

/** 테스트 전용: 내부 캐시 초기화 */
export function _resetForTests(): void {
  _messaging = null;
  _initialized = false;
}

function loadServiceAccount(): any {
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

export default { getMessagingClient, shutdownFirebase, loadServiceAccount, _resetForTests };