// Service worker for web push only (no caching, no fetch handling): shows Ngopu's order notifications and
// opens the order when one is tapped.
self.addEventListener('push', (event) => {
  let msg = {}
  try {
    msg = event.data ? event.data.json() : {}
  } catch {
    msg = { title: 'Ngopu', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Ngopu', {
      body: msg.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: msg.tag,
      data: { url: msg.url || '/app/orders' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/app/orders', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin + '/app') && 'focus' in w) {
          w.navigate(url)
          return w.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
