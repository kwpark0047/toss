// Minimal Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "placeholder",
    projectId: "placeholder",
    messagingSenderId: "placeholder",
    appId: "placeholder"
});

const _messaging = firebase.messaging();
