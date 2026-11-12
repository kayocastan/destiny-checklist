// Testes de fumaça do DPI: abre o site num navegador sem internet (tudo simulado) com perfis diferentes
// e confere se cada tela monta sem erro. Rodar: node tests/smoke.mjs   (sai com código 1 se algo falhar)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname, ORIGIN = 'http://dpi.test';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const REWRITE = { '/grade': '/index.html', '/beta': '/index.html', '/guias': '/guias.html', '/novidades': '/novidades.html', '/estado': '/estado.html', '/status': '/status.html', '/': '/index.html' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const now = Date.now(), iso = t => new Date(t).toISOString();

// perfil de mentira: 3 personagens, sem itens (o site precisa aguentar conta "vazia")
const C = ['2305843009000000001', '2305843009000000002', '2305843009000000003'];
function profile() {
  const ch = Object.fromEntries(C.map((c, i) => [c, { characterId: c, classType: i, raceType: 0, genderType: 0, light: 500 + i, emblemPath: '/x.png', emblemBackgroundPath: '/x.png', dateLastPlayed: iso(now - i * 864e5), stats: {} }]));
  const per = v => Object.fromEntries(C.map(c => [c, v()]));
  return {
    responseMintedTimestamp: iso(now),
    profile: { data: { userInfo: { membershipId: '4611686018400000001', membershipType: 3, displayName: 'Teste', bungieGlobalDisplayName: 'Teste', bungieGlobalDisplayNameCode: 1234 }, characterIds: C, dateLastPlayed: iso(now) } },
    characters: { data: ch },
    characterEquipment: { data: per(() => ({ items: [] })) }, characterInventories: { data: per(() => ({ items: [] })) },
    characterProgressions: { data: per(() => ({ progressions: {}, factions: {}, milestones: {}, quests: [], uninstancedItemObjectives: {}, checklists: {}, seasonalArtifact: {} })) },
    characterRecords: { data: per(() => ({ records: {}, featuredRecordHashes: [] })) }, characterCollectibles: { data: per(() => ({ collectibles: {} })) },
    characterLoadouts: { data: per(() => ({ loadouts: [] })) }, characterActivities: { data: per(() => ({ availableActivities: [] })) },
    profileInventory: { data: { items: [] } }, profileCurrencies: { data: { items: [] } }, profileProgression: { data: { checklists: {}, seasonalArtifact: {} } },
    profileRecords: { data: { score: 0, activeScore: 0, records: {}, recordCategoriesRootNodeHash: 0, recordSealsRootNodeHash: 0 } }, profileCollectibles: { data: { collectibles: {} } },
    profileStringVariables: { data: { integerValuesByHash: {} } }, characterStringVariables: { data: per(() => ({ integerValuesByHash: {} })) }, metrics: { data: { metrics: {} } },
    itemComponents: { instances: { data: {} }, sockets: { data: {} }, stats: { data: {} }, objectives: { data: {} }, perks: { data: {} } },
  };
}
const GRADES = [{ id: 1, name: 'Queda do Rei: Normal', g: null, ci: null, desc: '**Atenção**\n\nSó quem já fez.', cap: 6, rk: 0, s: iso(now + 864e5), by: 'Peter', url: null, mine: null, creator: false, p: [{ n: 'Peter', c: 'titular', r: 0 }] }];

async function run(name, { path = '/', auth = true, ls = {}, orla = 200, admin = false, xsave = false, expectSub = null, expired = false, mobile = false, clicks = true }) {
  const b = await chromium.launch(), ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage(), errs = [], seen = { refresh: 0 };
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url()), j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.origin === ORIGIN) {
      if (u.pathname === '/api/config') return j({ apiKey: 'k', clientId: '1', configured: true });
      if (u.pathname === '/api/refresh') { seen.refresh++; await new Promise(z => setTimeout(z, 300)); return j({ access_token: 'novo', access_expires: now + 36e5, refresh_token: 'r2', refresh_expires: now + 90 * 864e5 }); }
      const f = REWRITE[u.pathname] || u.pathname, file = join(ROOT, f);
      if (existsSync(file) && !f.endsWith('/')) return r.fulfill({ status: 200, contentType: MIME[extname(f)] || 'application/octet-stream', body: readFileSync(file) });
      return r.fulfill({ status: 404, body: 'nf' });
    }
    if (u.hostname === 'www.bungie.net' && u.pathname.startsWith('/Platform')) {
      const p = u.pathname.replace('/Platform', '');
      if (p.startsWith('/User/GetMembershipsForCurrentUser')) return j({ ErrorCode: 1, Response: { destinyMemberships: [{ membershipId: '4611686018400000001', membershipType: 3, displayName: 'Teste', bungieGlobalDisplayName: 'Teste', bungieGlobalDisplayNameCode: 1234 }], primaryMembershipId: '4611686018400000001', bungieNetUser: { membershipId: '99', uniqueName: 'Teste#1234' } } });
      if (/\/Profile\/\d+\/\?/.test(p + '?') && !/Item\//.test(p)) return j({ ErrorCode: 1, Response: profile() });
      if (p.startsWith('/GroupV2/User/')) return j({ ErrorCode: 1, Response: { results: [{ group: { groupId: '4886893', name: 'Clã Teste', clanInfo: { clanCallsign: 'TST' } }, member: { memberType: admin ? 3 : 2 } }] } });
      if (/\/GroupV2\/\d+\/Members/.test(p)) return j({ ErrorCode: 1, Response: { results: [{ memberType: admin ? 3 : 2, isOnline: true, destinyUserInfo: { membershipId: xsave ? '4611686018499999999' : '4611686018400000001', membershipType: xsave ? 1 : 3, bungieGlobalDisplayName: 'Teste', bungieGlobalDisplayNameCode: 1234 } }] } });
      return j({ ErrorCode: 1, Response: {} });
    }
    if (u.hostname === 'dni-api.dni-site.workers.dev') {
      if (u.pathname === '/defs') return j({});
      if (u.pathname === '/videos') return j({ list: [] }); if (u.pathname === '/guias') return j({ m: {} }); if (u.pathname === '/whoami') return j({ owner: false });
      return j({});
    }
    if (u.hostname === 'orla-bot.dni-site.workers.dev') {
      if (orla !== 200) return j({ error: orla === 403 ? 'clan' : 'auth' }, orla);
      if (u.pathname === '/me') return j({ bungieName: 'Teste#1234', linked: true, discord: { id: '1', name: 'teste' } });
      if (u.pathname === '/grades') return j({ guild: '1', grades: GRADES });
      return j({});
    }
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(u.pathname) || u.hostname.endsWith('bungie.net')) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.hostname.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.hostname === 'raw.githubusercontent.com') return r.fulfill({ status: 200, contentType: 'text/plain', body: 'title:x\n' });
    return r.fulfill({ status: 200, body: '' });
  });
  const A = { access_token: 'a', access_expires: expired ? now - 1000 : now + 36e5, refresh_token: 'r', refresh_expires: now + 90 * 864e5, membership_id: '99' };
  await page.addInitScript(([a, ls]) => { try { if (a) localStorage.setItem('dc-auth', JSON.stringify(a)); localStorage.setItem('dc-authv', '2'); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, JSON.stringify(v)); } catch {} }, [auth ? A : null, ls]);
  const fail = [];
  await page.goto(ORIGIN + path); await page.waitForTimeout(2500);
  const blank = async where => { for (let t = 0; t < 12; t++) { const st0 = await page.evaluate(() => (document.getElementById('list')?.innerText || '').trim().length); if (st0 >= 5) break; await page.waitForTimeout(500); } const st = await page.evaluate(() => { const l = document.getElementById('list'), w = document.querySelector('.wrap'); return { n: (l?.innerText || '').trim().length, hidden: w ? getComputedStyle(w).visibility === 'hidden' : false }; }); if (st.n < 5 || st.hidden) fail.push(`${where}: tela em branco` + (process.env.DBG ? ' ' + (await page.evaluate(() => ({ tab: typeof tab, list: document.getElementById('list')?.innerHTML.slice(0, 300), sub: document.getElementById('subtabs')?.innerText.slice(0,80), cur: document.querySelector('.tab[aria-current=true]')?.dataset.group }))).list + ' | ' + JSON.stringify(await page.evaluate(() => [document.querySelector('.tab[aria-current=true]')?.dataset.group, document.querySelector('.sub[aria-pressed=true]')?.dataset.sub]))) : '')); };
  await blank(path);
  if (clicks && auth && path === '/') {
    const groups = await page.$$eval('#tabs .tab', t => t.map(x => x.dataset.group));
    for (const g of groups) {
      await page.evaluate(g => document.querySelector(`#tabs .tab[data-group="${g}"]`)?.click(), g); await page.waitForTimeout(600); await blank('aba ' + g);
      const subs = await page.$$eval('#subtabs .sub', t => t.map(x => x.dataset.sub));
      for (const s of subs) { await page.evaluate(s => document.querySelector(`#subtabs .sub[data-sub="${s}"]`)?.click(), s); await page.waitForTimeout(500); await blank(`aba ${g} › ${s}`); }
    }
  }
  if (expectSub) { const [g, sub] = expectSub; await page.evaluate(g => document.querySelector(`#tabs .tab[data-group="${g}"]`)?.click(), g); for (let t = 0; t < 10; t++) { if (await page.$(`#subtabs .sub[data-sub="${sub}"]`)) break; await page.waitForTimeout(500); } if (!(await page.$(`#subtabs .sub[data-sub="${sub}"]`))) fail.push(`subaba ${sub} não apareceu`); }
  if (expired && seen.refresh !== 1) fail.push(`login vencido: renovou ${seen.refresh} vezes (devia ser 1)`);
  await b.close();
  const all = [...fail, ...errs];
  console.log(`${all.length ? '✗' : '✓'} ${name}${all.length ? '\n    ' + [...new Set(all)].slice(0, 8).join('\n    ') : ''}`);
  return all.length === 0;
}

const R = [];
R.push(await run('sem login: página inicial', { auth: false }));
R.push(await run('membro comum: todas as abas', {}));
R.push(await run('admin do clã: todas as abas', { admin: true }));
R.push(await run('celular: todas as abas', { mobile: true }));
R.push(await run('login vencido: renova uma vez só', { expired: true, clicks: false, ls: { 'dc-member': { type: 3, id: '4611686018400000001', name: 'Teste#1234' } } }));
R.push(await run('admin do clã por outra plataforma (cross-save)', { admin: true, xsave: true, clicks: false, expectSub: ['clan', 'gcla'] }));
R.push(await run('aba de admin guardada, sem ser admin', { ls: { 'dc-tab': 'gcla' }, clicks: false }));
R.push(await run('aba que não existe mais', { ls: { 'dc-tab': 'xyz' }, clicks: false }));
R.push(await run('/grade: membro do clã', { path: '/grade', clicks: false }));
R.push(await run('/grade: inglês', { path: '/grade', ls: { 'dc-lang': 'en' }, clicks: false }));
R.push(await run('/grade: sem login', { path: '/grade', auth: false, clicks: false }));
const bad = R.filter(x => !x).length;
console.log(bad ? `\n${bad} teste(s) falharam.` : '\nTudo certo.');
process.exit(bad ? 1 : 0);
