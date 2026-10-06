/* Shows push notifications while the app is closed. Notifications carry no personal data. */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js')

const params = new URL(self.location).searchParams
firebase.initializeApp({
  apiKey: params.get('k'),
  projectId: 'komatal',
  messagingSenderId: '90736890029',
  appId: '1:90736890029:web:831e64d290b2e54fdef624',
})
firebase.messaging()

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.data && event.notification.data.FCM_MSG.data.url) || '/'
  event.waitUntil(clients.openWindow(url))
})
