/// <reference lib="webworker" />
import { defaultCache, PAGES_CACHE_NAME } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope

const privateNavigationNetworkOnly = {
  matcher: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
    sameOrigin && (request.mode === 'navigate' || request.headers.get('RSC') === '1'),
  handler: new NetworkOnly(),
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Forge pages are authenticated and user-specific. Caching their HTML or
  // RSC payload can restore an old account snapshot after login/onboarding.
  // Keep the installable asset shell, but always fetch private page data live.
  runtimeCaching: [privateNavigationNetworkOnly, ...defaultCache],
})

serwist.addEventListeners()

const privateRuntimeCaches = new Set([
  PAGES_CACHE_NAME.html,
  PAGES_CACHE_NAME.rsc,
  PAGES_CACHE_NAME.rscPrefetch,
  'next-data',
  'apis',
  'others',
])

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => privateRuntimeCaches.has(key)).map(key => caches.delete(key)),
    )),
  )
})

// --- Web Push ---

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json() as { title?: string; body?: string; icon?: string; url?: string }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Forge', {
      body: data.body,
      icon: data.icon ?? '/icons/web-app-manifest-192x192.png',
      badge: '/badge.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
