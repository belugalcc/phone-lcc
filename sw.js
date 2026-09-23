self.addEventListener('push', event => {
  const payload = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(payload.title || 'LinkUp', { body: payload.body || 'You have a new message.', icon: '/icon.svg', badge: '/icon.svg', data: { url: payload.url || '/' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => windows[0] ? windows[0].focus() : clients.openWindow(event.notification.data.url)));
});
