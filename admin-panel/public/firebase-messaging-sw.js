// Handles push notifications while the admin panel tab is closed or backgrounded.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBR1e0uzbKzqh5SVjSLCuPx3B1QNProUtw',
  appId: '1:158705608646:web:631be3d3cdda1683f574c7',
  messagingSenderId: '158705608646',
  projectId: 'yadu1-821e8',
  authDomain: 'yadu1-821e8.firebaseapp.com',
  storageBucket: 'yadu1-821e8.firebasestorage.app',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const url = payload.data?.url || '/instant-orders';
  self.registration.showNotification(title || 'New notification', {
    body,
    icon: '/favicon.svg',
    data: { url },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
