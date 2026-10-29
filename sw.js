/* Service worker: o site abre como app e funciona sem internet com a última versão salva.
   Arquivos do site: rede primeiro (sempre a versão nova), cache se estiver offline.
   Ícones da Bungie: cache primeiro (não mudam). Login e API ficam de fora. */
const V = 'dc-v4';
const SHELL = ['/', '/index.html', '/app.js', '/styles.css', '/site.css', '/data/defs.json', '/data/items.json', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith('/api/')) return;
    e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('/'))));
    return;
  }
  if (u.hostname === 'www.bungie.net' && u.pathname.startsWith('/common/destiny2_content/')) {
    // busca sempre em modo CORS e guarda só respostas legíveis: assim o mesmo ícone serve para a página e para a imagem de compartilhar
    const cr = new Request(r.url, { mode: 'cors', credentials: 'omit' });
    e.respondWith(caches.open(V + '-img').then(c => c.match(cr).then(m => m && m.type !== 'opaque' ? m : fetch(cr).then(res => { if (res.ok) c.put(cr, res.clone()); return res; }).catch(() => fetch(r)))));
  }
});
