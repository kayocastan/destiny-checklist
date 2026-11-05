import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeDb } from './d1shim.js';
import worker from '../src/index.js';

let env, kp, calls, pending, duUser;
const ctx = { waitUntil: p => pending.push(p) };
const flush = async () => { await Promise.all(pending); pending = []; };
const future = () => { const d = new Date(Date.now() + 36e5 * 26); const p = n => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} 12:00`; };

async function post(body) {
  const text = JSON.stringify(body), ts = String(Math.floor(Date.now() / 1000));
  const sig = Buffer.from(await crypto.subtle.sign('Ed25519', kp.privateKey, new TextEncoder().encode(ts + text))).toString('hex');
  const r = await worker.fetch(new Request('https://w/discord/interactions', { method: 'POST', headers: { 'X-Signature-Ed25519': sig, 'X-Signature-Timestamp': ts }, body: text }), env, ctx);
  return { status: r.status, body: r.status === 200 ? await r.json() : null };
}
const slash = (sub, options, user = { id: '10', username: 'fulano' }) => ({ type: 2, token: 'tok', member: { user }, data: { name: 'orla', options: [{ type: 1, name: sub, options }] } });

beforeEach(async () => {
  kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  env = { DB: makeDb(), DISCORD_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('hex'), DISCORD_TOKEN: 'bot', DISCORD_APP_ID: 'app', DISCORD_CLIENT_SECRET: 'sec', BUNGIE_API_KEY: 'k',
    LFG_CHANNEL_ID: '1474590008114679919', TIMEZONE: 'America/Sao_Paulo', CLAN_ID: '5280120', SITE_URL: 'https://destinyparallel.vercel.app', SELF_URL: 'https://w', HERO_URL: 'https://h/hero.png' };
  calls = []; pending = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : null });
    if (String(url).includes('/channels/') && init.method === 'POST') return new Response(JSON.stringify({ id: '777' }), { status: 200 });
    if (String(url).includes('bungie.net/Platform/User/GetMembershipsForCurrentUser')) return new Response(JSON.stringify({ ErrorCode: 1, Response: { bungieNetUser: { membershipId: '55' }, primaryMembershipId: '4611', destinyMemberships: [{ membershipId: '4611', membershipType: 3, bungieGlobalDisplayName: 'Guardian', bungieGlobalDisplayNameCode: 42 }] } }));
    if (String(url).includes('/GroupV2/User/254/')) return new Response(JSON.stringify({ ErrorCode: 1, Response: { results: [{ group: { groupId: '5280120' } }] } }));
    if (String(url).endsWith('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'at' }));
    if (String(url).endsWith('/users/@me')) return new Response(JSON.stringify(duUser));
    return new Response('{}', { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const link = (id = '10') => env.DB.prepare(`INSERT INTO users (discord_user_id, discord_member_name, bungie_membership_id, bungie_membership_type, bungie_name, linked_at) VALUES (?, 'fulano', '4611', 3, 'Guardian#0042', '2026-11-01T00:00:00Z')`).bind(id).run();

describe('Discord interactions', () => {
  it('recusa assinatura inválida e responde PING', async () => {
    const r = await worker.fetch(new Request('https://w/discord/interactions', { method: 'POST', headers: { 'X-Signature-Ed25519': '00', 'X-Signature-Timestamp': '1' }, body: '{}' }), env, ctx);
    expect(r.status).toBe(401);
    expect((await post({ type: 1 })).body).toEqual({ type: 1 });
  });
  it('autocomplete devolve o catálogo com prefixo curated:', async () => {
    const r = await post({ type: 4, data: { name: 'orla', options: [{ type: 1, name: 'grade', options: [{ name: 'atividade', value: 'crota', focused: true }] }] } });
    expect(r.body.type).toBe(8);
    expect(r.body.data.choices.length).toBeGreaterThan(0);
    expect(r.body.data.choices[0].value).toMatch(/^curated:\d+$/);
  });
  it('/orla grade sem vínculo abre o modal de Bungie Name e guarda a grade pendente', async () => {
    const r = await post(slash('grade', [{ name: 'atividade', value: 'Sala de treino' }, { name: 'integrantes', value: 3 }, { name: 'inicio', value: future() }]));
    expect(r.body.type).toBe(9);
    expect(r.body.data.custom_id).toMatch(/^orla:bn:g:/);
    expect((await env.DB.prepare('SELECT count(*) n FROM pending_grades').first()).n).toBe(1);
  });
  it('/orla grade completo cria a grade e publica no #lfg-destiny', async () => {
    await link();
    const r = await post(slash('grade', [{ name: 'atividade', value: 'Sala de treino' }, { name: 'integrantes', value: 3 }, { name: 'inicio', value: future() }, { name: 'descricao', value: 'bora' }]));
    expect(r.body).toEqual({ type: 5, data: { flags: 64 } });
    await flush();
    const post1 = calls.find(c => c.method === 'POST' && c.url.includes('/channels/1474590008114679919/messages'));
    expect(post1).toBeTruthy();
    expect(post1.body.embeds[0].description).toContain('# Sala de treino');
    expect(post1.body.components[0].components).toHaveLength(3);
    const a = await env.DB.prepare('SELECT * FROM activities').first();
    expect(a).toMatchObject({ discord_message_id: '777', discord_channel_id: '1474590008114679919', created_by_discord_id: '10' });
    expect(calls.some(c => c.method === 'PATCH' && c.url.endsWith('/messages/@original') && String(c.body.content).includes('publicada'))).toBe(true);
  });
  it('/orla grade incompleto abre o modal Criar Grade', async () => {
    await link();
    const r = await post(slash('grade', [{ name: 'atividade', value: 'curated:2' }]));
    expect(r.body.type).toBe(9);
    expect(r.body.data.title).toBe('Criar Grade');
    expect(r.body.data.custom_id).toBe('orla:grade:2');
    expect(r.body.data.components.map(c => c.label)).toEqual(['Atividade', 'Integrantes', 'Novatos', 'Início', 'Descrição']);
  });
  it('início no passado é recusado com mensagem', async () => {
    await link();
    await post(slash('grade', [{ name: 'atividade', value: 'X' }, { name: 'integrantes', value: 3 }, { name: 'inicio', value: '01/01/20 10:00' }]));
    await flush();
    expect(calls.find(c => c.method === 'PATCH').body.content).toContain('futuras');
    expect((await env.DB.prepare('SELECT count(*) n FROM activities').first()).n).toBe(0);
  });
  it('botão: sem vínculo abre modal; com vínculo inscreve e atualiza a mensagem', async () => {
    await link('10');
    await post(slash('grade', [{ name: 'atividade', value: 'Sala' }, { name: 'integrantes', value: 3 }, { name: 'inicio', value: future() }]));
    await flush(); calls.length = 0;
    const btn = (id, uid) => ({ type: 3, token: 't2', member: { user: { id: uid, username: 'u' + uid } }, message: { id: '777' }, data: { custom_id: id } });
    expect((await post(btn('orla:activity:join', '20'))).body.type).toBe(9);
    await link('20');
    const r = await post(btn('orla:activity:join', '20'));
    expect(r.body).toEqual({ type: 6 });
    await flush();
    expect(calls.some(c => c.method === 'PATCH' && c.url.endsWith('/channels/1474590008114679919/messages/777'))).toBe(true);
    expect((await env.DB.prepare(`SELECT category FROM activity_participants WHERE discord_user_id = '20'`).first()).category).toBe('titular');
  });
});

describe('API do DPI', () => {
  const api = (path, init = {}) => worker.fetch(new Request('https://w' + path, { ...init, headers: { Origin: 'https://destinyparallel.vercel.app', Authorization: 'Bearer abc', 'Content-Type': 'application/json', ...(init.headers || {}) } }), env, ctx);
  it('exige login Bungie e responde CORS', async () => {
    const r = await worker.fetch(new Request('https://w/me', { headers: { Origin: 'https://destinyparallel.vercel.app' } }), env, ctx);
    expect(r.status).toBe(401);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://destinyparallel.vercel.app');
  });
  it('quem não é do clã Orla Emaranhada recebe 403 em todas as rotas', async () => {
    env.CLAN_ID = '999';
    for (const [p, init] of [['/me', {}], ['/activities?q=a', {}], ['/link/start', { method: 'POST', body: '{"tag":"fulano"}' }], ['/grades', { method: 'POST', body: '{}' }]]) {
      const r = await api(p, init); expect(r.status, p).toBe(403); expect(await r.json()).toEqual({ error: 'clan' });
    }
    expect((await api('/activities?q=a', { headers: { Authorization: '' } })).status).toBe(401);
  });
  it('/me reconhece quem já registrou pelo Discord (mesma conta Destiny)', async () => {
    expect(await (await api('/me')).json()).toMatchObject({ linked: false, bungieName: 'Guardian#0042' });
    await link('10');
    expect(await (await api('/me')).json()).toMatchObject({ linked: true, discord: { id: '10' } });
  });
  it('/grades: 409 sem registro; cria e publica com registro; valida campos', async () => {
    const body = o => JSON.stringify({ atividade: 'Raid livre', integrantes: 6, novatos: 1, inicio: new Date(Date.now() + 36e5).toISOString(), descricao: 'oi', ...o });
    expect((await api('/grades', { method: 'POST', body: body({}) })).status).toBe(409);
    await link('10');
    const ok = await api('/grades', { method: 'POST', body: body({}) });
    expect(await ok.json()).toMatchObject({ ok: true, published: true });
    expect(calls.some(c => c.method === 'POST' && c.url.includes('/channels/1474590008114679919/messages'))).toBe(true);
    expect((await api('/grades', { method: 'POST', body: body({ integrantes: 13 }) })).status).toBe(400);
    expect((await api('/grades', { method: 'POST', body: body({ novatos: 7 }) })).status).toBe(400);
    expect((await api('/grades', { method: 'POST', body: body({ inicio: new Date(Date.now() - 1000).toISOString() }) })).status).toBe(400);
  });
  it('/link/start devolve a URL de OAuth do Discord com state assinado', async () => {
    const j = await (await api('/link/start', { method: 'POST', body: JSON.stringify({ tag: 'fulano', ret: '/grade' }) })).json();
    const u = new URL(j.url);
    expect(u.origin + u.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(u.searchParams.get('scope')).toBe('identify');
    expect(u.searchParams.get('redirect_uri')).toBe('https://w/link/callback');
    expect(u.searchParams.get('state')).toContain('.');
  });
  it('/link/callback vincula só se o usuário do Discord bater com a tag informada', async () => {
    const start = async tag => new URL((await (await api('/link/start', { method: 'POST', body: JSON.stringify({ tag, ret: '/grade' }) })).json()).url).searchParams.get('state');
    const cb = async (state, du) => {
      duUser = du;
      return worker.fetch(new Request(`https://w/link/callback?code=c&state=${encodeURIComponent(state)}`), env, ctx);
    };
    let r = await cb(await start('@Fulano'), { id: '999', username: 'outra_pessoa' });
    expect(r.headers.get('Location')).toBe('https://destinyparallel.vercel.app/grade?orla=mismatch');
    expect(await env.DB.prepare('SELECT count(*) n FROM users').first()).toEqual({ n: 0 });
    r = await cb(await start('@Fulano'), { id: '999', username: 'fulano' });
    expect(r.headers.get('Location')).toBe('https://destinyparallel.vercel.app/grade?orla=ok');
    expect(await env.DB.prepare('SELECT discord_user_id, bungie_membership_id, bungie_name FROM users').first()).toEqual({ discord_user_id: '999', bungie_membership_id: '4611', bungie_name: 'Guardian#0042' });
  });
  it('cron apaga grades que começaram há mais de 1 hora', async () => {
    await env.DB.prepare(`INSERT INTO activities (name, capacity, starts_at, description, created_by_discord_id, created_at, discord_channel_id, discord_message_id) VALUES ('Velha', 3, ?, '', '1', 'x', 'c', 'm')`).bind(new Date(Date.now() - 2 * 36e5).toISOString()).run();
    await env.DB.prepare(`INSERT INTO activities (name, capacity, starts_at, description, created_by_discord_id, created_at) VALUES ('Nova', 3, ?, '', '1', 'x')`).bind(new Date(Date.now() + 36e5).toISOString()).run();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    await worker.scheduled({}, env, ctx); await flush();
    expect((await env.DB.prepare('SELECT name FROM activities').all()).results.map(r => r.name)).toEqual(['Nova']);
    expect((await env.DB.prepare('SELECT name FROM grade_hist').all()).results.map(r => r.name)).toEqual(['Velha']);
  });
  it('masmorra limita a 3 titulares (ajusta e avisa); /activities informa o limite', async () => {
    await link('10');
    const acts = (await (await api('/activities?q=dualidade')).json()).activities;
    expect(acts[0].max).toBe(3);
    const r = await api('/grades', { method: 'POST', body: JSON.stringify({ atividade: acts[0].name, curatedId: acts[0].id, integrantes: 6, novatos: 5, inicio: new Date(Date.now() + 864e5).toISOString(), descricao: '' }) });
    const j = await r.json(); expect(j.ok).toBe(true); expect(j.warning).toMatch(/até 3/);
    expect(await env.DB.prepare('SELECT capacity, rookie_limit FROM activities WHERE id = ?').bind(j.activityId).first()).toEqual({ capacity: 3, rookie_limit: 3 });
  });
  it('GET /grades lista a agenda com os inscritos', async () => {
    await link('10');
    const id = (await env.DB.prepare(`INSERT INTO activities (name, capacity, starts_at, description, created_by_discord_id, created_at, discord_channel_id, discord_message_id) VALUES ('Crota', 6, ?, '', '10', 'x', 'c1', 'm1')`).bind(new Date(Date.now() + 36e5).toISOString()).run()).meta.last_row_id;
    await env.DB.prepare(`INSERT INTO activity_participants (activity_id, discord_user_id, category, is_rookie, created_at) VALUES (?, '10', 'titular', 1, 'x')`).bind(id).run();
    env.DISCORD_GUILD_ID = 'g1';
    const j = await (await api('/grades')).json();
    expect(j.grades).toEqual([expect.objectContaining({ name: 'Crota', cap: 6, by: 'Guardian#0042', url: 'https://discord.com/channels/g1/c1/m1', p: [{ n: 'Guardian', c: 'titular', r: 1 }] })]);
  });
  it('/clan/panel: só admin; soma grades guardadas e abertas por pessoa', async () => {
    expect((await api('/clan/panel')).status).toBe(403); // membro comum (sem memberType)
    env.OWNER = '55'; // dono do DPI (conta Bungie.net do teste) vê mesmo sem ser admin
    await link('10');
    const old = new Date(Date.now() - 2 * 36e5).toISOString(), soon = new Date(Date.now() + 36e5).toISOString();
    const a1 = (await env.DB.prepare(`INSERT INTO activities (name, capacity, starts_at, description, created_by_discord_id, created_at) VALUES ('Velha', 3, ?, '', '10', 'x')`).bind(old).run()).meta.last_row_id;
    await env.DB.prepare(`INSERT INTO activity_participants (activity_id, discord_user_id, category, is_rookie, created_at) VALUES (?, '10', 'titular', 1, 'x'), (?, '20', 'reserva', 0, 'x')`).bind(a1, a1).run();
    await worker.scheduled({}, env, ctx); await flush();
    const a2 = (await env.DB.prepare(`INSERT INTO activities (name, capacity, starts_at, description, created_by_discord_id, created_at) VALUES ('Nova', 3, ?, '', '20', 'x')`).bind(soon).run()).meta.last_row_id;
    await env.DB.prepare(`INSERT INTO activity_participants (activity_id, discord_user_id, category, is_rookie, created_at) VALUES (?, '10', 'titular', 0, 'x')`).bind(a2).run();
    const r = await api('/clan/panel?days=30'); expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.users.map(u => u.b)).toEqual(['Guardian#0042']);
    expect(j.part.find(p => p.d === '10' && p.c === 'titular')).toMatchObject({ n: 2, rk: 1 });
    expect(j.part.find(p => p.d === '20' && p.c === 'reserva')).toMatchObject({ n: 1 });
    expect(j.made.map(m => [m.d, m.n]).sort()).toEqual([['10', 1], ['20', 1]]);
    expect(j.grades.map(g => [g.name, g.open, g.tit])).toEqual([['Nova', 1, 1], ['Velha', 0, 1]]);
    expect(j.histSince).toBeTruthy();
  });
});
