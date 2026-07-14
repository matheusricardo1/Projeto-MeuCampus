// Web Push service worker for the owner admin dashboard. Kept deliberately
// tiny - it only turns a push payload into an OS notification and focuses
// (or opens) the dashboard tab on click. No caching/offline logic: this app
// doesn't need an offline shell, so a bigger service worker would just be
// more surface area to go stale.

self.addEventListener('push', (event) => {
    let data = { title: 'Meu Campus', body: 'Voce tem uma nova notificacao.' };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch {
            // Non-JSON payload - fall back to the defaults above.
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon.png',
            badge: '/icon.png'
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            for (const client of clientsList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow('/admin/dashboard');
            }

            return undefined;
        })
    );
});
