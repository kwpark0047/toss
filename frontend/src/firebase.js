import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase 설정을 서버로부터 가져오는 함수
export const fetchFirebaseConfig = async () => {
  try {
    const response = await fetch('/api/config/firebase');
    return await response.json();
  } catch (e) {
    console.error('Failed to fetch Firebase config from server', e);
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
  }
};

let app;
let messaging;

// 지연 초기화 (Lazy initialization)
const getFirebaseApp = async () => {
  if (!app) {
    const config = await fetchFirebaseConfig();
    app = initializeApp(config);
  }
  return app;
};

const getFirebaseMessaging = async () => {
  if (!messaging) {
    const fApp = await getFirebaseApp();
    messaging = getMessaging(fApp);
  }
  return messaging;
};

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messagingInstance = await getFirebaseMessaging();
      const token = await getToken(messagingInstance, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('An error occurred while requesting notification permission. ', error);
    return null;
  }
};

export const onMessageListener = async () => {
  const messagingInstance = await getFirebaseMessaging();
  return new Promise((resolve) => {
    onMessage(messagingInstance, (payload) => {
      // console.log('Message received. ', payload);
      resolve(payload);
    });
  });
};
