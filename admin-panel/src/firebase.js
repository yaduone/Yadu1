import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Same Firebase project as the mobile app (mobile_app/lib/firebase_options.dart, `web` block).
const firebaseConfig = {
  apiKey: 'AIzaSyBR1e0uzbKzqh5SVjSLCuPx3B1QNProUtw',
  appId: '1:158705608646:web:631be3d3cdda1683f574c7',
  messagingSenderId: '158705608646',
  projectId: 'yadu1-821e8',
  authDomain: 'yadu1-821e8.firebaseapp.com',
  storageBucket: 'yadu1-821e8.firebasestorage.app',
};

// Generate this in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const app = initializeApp(firebaseConfig);

/**
 * Requests notification permission, registers the background service worker,
 * and returns an FCM registration token — or null if unsupported/denied.
 */
export async function requestAdminPushToken() {
  if (!(await isSupported())) return null;
  if (!VAPID_KEY) {
    throw new Error('Missing VITE_FIREBASE_VAPID_KEY — generate one in Firebase Console → Cloud Messaging.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

/** Foreground message handler — background messages are shown by the service worker. */
export async function onForegroundMessage(callback) {
  if (!(await isSupported())) return () => {};
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
