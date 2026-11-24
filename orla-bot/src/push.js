/* Avisos no celular (Web Push) do DPI.
   O aviso vai SEM conteúdo (só o "toque" assinado com VAPID); o service worker do site busca o texto em /push/inbox.
   Assim não há criptografia de conteúdo e nenhum dado pessoal passa pelo serviço de push do navegador.
   As chaves VAPID nascem aqui na primeira vez e ficam no D1 (só o Worker lê). */
import { publicGet } from './bungie.js';

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const now = () => new Date().toISOString();

export async function vapid(env) {
  let row = await env.DB.prepare("SELECT v FROM push_keys WHERE k = 'vapid'").first();
  if (!row) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const v = JSON.stringify({ pub: b64(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) });
    await env.DB.prepare("INSERT OR IGNORE INTO push_keys (k, v) VALUES ('vapid', ?)").bind(v).run();
    row = await env.DB.prepare("SELECT v FROM push_keys WHERE k = 'vapid'").first();
  }
  const { pub, jwk } = JSON.parse(row.v);
  return { pub, key: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
}

async function auth(env, endpoint) {
  const { pub, key } = await vapid(env);
  const h = b64(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.SITE_URL || 'https://destinyparallel.vercel.app' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${h}.${c}`));
  return `vapid t=${h}.${c}.${b64(sig)}, k=${pub}`;
}

// guarda a mensagem e manda o "toque"; inscrição que não existe mais (404/410) é apagada
export async function notify(env, endpoint, { title, body, url = '/', tag = '' }) {
  await env.DB.prepare('INSERT INTO push_inbox (endpoint, title, body, url, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(endpoint, title.slice(0, 120), body.slice(0, 300), url, tag, now()).run();
  let r; try { r = await fetch(endpoint, { method: 'POST', headers: { TTL: '43200', Urgency: 'normal', Authorization: await auth(env, endpoint), 'Content-Length': '0' } }); } catch { return 0; }
  if (r.status === 404 || r.status === 410) await env.DB.batch([env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint), env.DB.prepare('DELETE FROM push_inbox WHERE endpoint = ?').bind(endpoint)]);
  return r.status;
}
const once = async (env, k) => (await env.DB.prepare('INSERT OR IGNORE INTO push_sent (k, at) VALUES (?, ?)').bind(k, now()).run()).meta.changes > 0;
export const prefOn = (s, k) => { try { return !!JSON.parse(s.prefs || '{}')[k]; } catch { return false; } };

// 30 min antes: avisa quem está na grade (titular, substituto ou reserva) e ativou o aviso
export async function gradeReminders(env) {
  const a = new Date(Date.now() + 25 * 60_000).toISOString(), b = new Date(Date.now() + 31 * 60_000).toISOString();
  const rows = (await env.DB.prepare(`SELECT g.id, g.name, g.starts_at s, p.category c, ps.endpoint, ps.prefs FROM activities g
      JOIN activity_participants p ON p.activity_id = g.id JOIN push_subs ps ON ps.discord_user_id = p.discord_user_id
      WHERE replace(g.starts_at, ' ', 'T') > ? AND replace(g.starts_at, ' ', 'T') <= ?`).bind(a, b).all()).results;
  const cat = { titular: 'titular', substituto: 'substituto', reserva: 'reserva' };
  for (const r of rows) {
    if (!prefOn(r, 'grade') || !(await once(env, `grade:${r.id}:${r.endpoint}`))) continue;
    const t = new Date(String(r.s).replace(' ', 'T')).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: env.TIMEZONE || 'America/Sao_Paulo' });
    await notify(env, r.endpoint, { title: `Grade em 30 min: ${r.name}`, body: `Começa às ${t}. Você está como ${cat[r.c] || r.c}.`, url: '/grade', tag: `grade-${r.id}` });
  }
}

// sexta, depois que o Xûr chega (17h UTC): avisa quem ainda não tem algum exótico que ele vende
const XUR = 2190858386;
export async function xurAlerts(env) {
  const d = new Date(); if (d.getUTCDay() !== 5 || d.getUTCHours() < 17 || d.getUTCHours() > 22) return;
  const wk = d.toISOString().slice(0, 10);
  const subs = (await env.DB.prepare('SELECT endpoint, prefs, dmi, dmt FROM push_subs WHERE dmi IS NOT NULL').all()).results.filter(s => prefOn(s, 'xur'));
  if (!subs.length) return;
  const todo = []; for (const s of subs) if (!(await env.DB.prepare('SELECT 1 FROM push_sent WHERE k = ?').bind(`xur:${wk}:${s.endpoint}`).first())) todo.push(s);
  if (!todo.length) return;
  // o que o Xûr vende (vendedores públicos) e os colecionáveis desses exóticos; guardado por semana
  let cache = await env.DB.prepare('SELECT v FROM push_keys WHERE k = ?').bind('xur:' + wk).first().then(r => r && JSON.parse(r.v));
  if (!cache) {
    const v = await publicGet(env, '/Destiny2/Vendors/?components=400,402').catch(() => null);
    const sales = Object.values(v?.sales?.data?.[XUR]?.saleItems || {}); if (!sales.length) return; // Xûr ainda não chegou na API
    const items = [];
    for (const it of sales) { const def = await publicGet(env, `/Destiny2/Manifest/DestinyInventoryItemDefinition/${it.itemHash}/`).catch(() => null); if (def?.inventory?.tierType === 6 && def.collectibleHash && (def.itemType === 2 || def.itemType === 3)) items.push({ h: def.collectibleHash, n: def.displayProperties?.name || '' }); }
    cache = { items }; await env.DB.prepare('INSERT OR REPLACE INTO push_keys (k, v) VALUES (?, ?)').bind('xur:' + wk, JSON.stringify(cache)).run();
  }
  for (const s of todo.slice(0, 40)) { // até 40 por minuto: folga com a Bungie
    const p = await publicGet(env, `/Destiny2/${s.dmt}/Profile/${s.dmi}/?components=800`).catch(() => null);
    if (!(await once(env, `xur:${wk}:${s.endpoint}`))) continue;
    if (!p?.profileCollectibles?.data) continue; // perfil privado: sem como saber
    const st = h => { const a = p.profileCollectibles.data.collectibles?.[h]?.state; const cs = Object.values(p.characterCollectibles?.data || {}).map(c => c.collectibles?.[h]?.state).filter(x => x != null); return [a, ...cs].filter(x => x != null); };
    const miss = cache.items.filter(i => { const l = st(i.h); return l.length && l.every(x => x & 1); }).map(i => i.n);
    if (miss.length) await notify(env, s.endpoint, { title: 'Xûr chegou', body: `Vende ${miss.length > 1 ? 'exóticos que você não tem' : 'um exótico que você não tem'}: ${miss.join(', ')}.`, url: '/vendedores', tag: 'xur-' + wk });
  }
}

// limpeza: mensagens velhas e marcas antigas
export async function pushCleanup(env) {
  const old = new Date(Date.now() - 3 * 864e5).toISOString(), older = new Date(Date.now() - 30 * 864e5).toISOString();
  await env.DB.batch([env.DB.prepare('DELETE FROM push_inbox WHERE created_at < ?').bind(old), env.DB.prepare('DELETE FROM push_sent WHERE at < ?').bind(older), env.DB.prepare("DELETE FROM push_keys WHERE k LIKE 'xur:%' AND k < ?").bind('xur:' + older.slice(0, 10))]);
}
