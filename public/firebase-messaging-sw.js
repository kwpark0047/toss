importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());

fetch('/api/config/firebase')
    .then(function(r) { return r.json(); })
    .then(function(config) {
        firebase.initializeApp({
            apiKey: config.apiKey || '',
            projectId: config.projectId || '',
            messagingSenderId: config.messagingSenderId || '',
            appId: config.appId || ''
        });
        var messaging = firebase.messaging();
    })
    .catch(function() {
        console.warn('[SW] Firebase config fetch failed — push notifications disabled');
    });
