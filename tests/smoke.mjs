// Testes de fumaça do DPI: abre o site num navegador sem internet (tudo simulado) com perfis diferentes
// e confere se cada tela monta sem erro. Rodar: node tests/smoke.mjs   (sai com código 1 se algo falhar)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname, ORIGIN = 'http://dpi.test';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
// mesmos atalhos de endereço da Vercel (vercel.json), para testar as abas com endereço próprio
const VJ = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
const REWRITE = { '/': '/index.html', ...Object.fromEntries(VJ.rewrites.filter(r => r.destination.startsWith('/') && !r.source.includes(':')).map(r => [r.source, r.destination])) };
const rewrite = p => REWRITE[p] || (/^\/beta\/[^/]+$/.test(p) ? '/index.html' : null);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const now = Date.now(), iso = t => new Date(t).toISOString();

// perfil de mentira: 3 personagens, sem itens (o site precisa aguentar conta "vazia")
const C = ['2305843009000000001', '2305843009000000002', '2305843009000000003'];
// armas para o Avaliar rolls: A está no Voltron (atual B, dá para chegar a A), T é gêmea por nome de A (sem rolls próprios), X é exótica
const WPN = { A: 877384, T: 2290416, X: 14194600, F: 2307365 };
const VOLT = `title:x\ndimwishlist:item=${WPN.A}&perks=1001,1002,1003,1004#notes:pve\n`;
function arsenal(pr) {
  const it = (h, i) => ({ itemHash: h, itemInstanceId: '69' + i, bucketHash: 138197802, quantity: 1, state: 0 });
  pr.profileInventory.data.items = [it(WPN.A, 1), it(WPN.T, 2), it(WPN.X, 3), it(WPN.F, 4)];
  const sk = l => ({ sockets: l.map(h => ({ plugHash: h, isEnabled: true, isVisible: true })) });
  pr.itemComponents.sockets.data = { 691: sk([2000, 1001, 1002, 2003, 2004]), 692: sk([2000, 1001, 1002, 1003, 1004]), 693: sk([2000, 3001]), 694: sk([5000, 1001, 1002, 1003, 9999]) };
  pr.itemComponents.instances.data = { 691: { primaryStat: { value: 2000 } }, 692: { primaryStat: { value: 2001 } }, 693: { primaryStat: { value: 2002 } }, 694: { primaryStat: { value: 2003 } } };
  pr.itemComponents.reusablePlugs = { data: { 691: { plugs: { 3: [{ plugItemHash: 2003, canInsert: true, enabled: true }, { plugItemHash: 1003, canInsert: true, enabled: true }], 4: [{ plugItemHash: 2004, canInsert: true, enabled: true }] } } } };
  return pr;
}
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
const GRADES = [{ id: 1, name: 'Queda do Rei: Normal', g: null, ci: null, desc: '**Atenção**\n\nSó quem já fez.', cap: 6, rk: 0, s: iso(now + 864e5), by: 'Peter', url: null, mine: null, creator: false, p: [{ n: 'Peter', c: 'titular', r: 0 }] }, { id: 2, name: 'Fim de Crota: Normal', g: null, ci: null, desc: 'Inscrita', cap: 6, rk: 0, s: iso(now + 2 * 864e5).replace('T', ' ').slice(0, 19), by: 'Nipanga', url: 'https://discord.com/channels/1/2/3', mine: 'titular', creator: true, p: [{ n: 'Nipanga', c: 'titular', r: 0 }] }];

async function run(name, { path = '/', auth = true, ls = {}, orla = 200, admin = false, xsave = false, expectSub = null, expired = false, mobile = false, clicks = true, steps = null, expectText = '', arm = false, owner = false, vc = '', noSub = null, expectBar = false }) {
  if (process.env.F && !name.includes(process.env.F)) return true; // F=trecho: roda só os testes com esse nome
  const b = await chromium.launch(), ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage(), errs = [], seen = { refresh: 0 };
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url()), j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.origin === ORIGIN) {
      if (u.pathname === '/api/config') { if (process.env.LAT) await new Promise(z => setTimeout(z, 600)); seen.cfg = (seen.cfg || 0) + 1; } if (u.pathname === '/api/config') return j({ apiKey: 'k', clientId: '1', configured: true });
      if (u.pathname === '/api/refresh') { seen.refresh++; await new Promise(z => setTimeout(z, process.env.LAT ? 850 : 300)); return j({ access_token: 'novo', access_expires: now + 36e5, refresh_token: 'r2', refresh_expires: now + 90 * 864e5 }); }
      const f = rewrite(u.pathname) || u.pathname, file = join(ROOT, f);
      if (existsSync(file) && !f.endsWith('/')) return r.fulfill({ status: 200, contentType: MIME[extname(f)] || 'application/octet-stream', body: readFileSync(file) });
      return r.fulfill({ status: 404, body: 'nf' });
    }
    if (u.hostname === 'www.bungie.net' && u.pathname.startsWith('/Platform')) { if (process.env.LAT && /Profile/.test(u.pathname)) await new Promise(z => setTimeout(z, 2000));
      const p = u.pathname.replace('/Platform', '');
      if (p.startsWith('/User/GetMembershipsForCurrentUser')) return j({ ErrorCode: 1, Response: { destinyMemberships: [{ membershipId: '4611686018400000001', membershipType: 3, displayName: 'Teste', bungieGlobalDisplayName: 'Teste', bungieGlobalDisplayNameCode: 1234 }], primaryMembershipId: '4611686018400000001', bungieNetUser: { membershipId: '99', uniqueName: 'Teste#1234' } } });
      if (/\/Profile\/\d+\/\?/.test(p + '?') && !/Item\//.test(p)) return j({ ErrorCode: 1, Response: arm ? arsenal(profile()) : profile() });
      if (p.startsWith('/GroupV2/User/')) return j({ ErrorCode: 1, Response: { results: [{ group: { groupId: '4886893', name: 'Clã Teste', clanInfo: { clanCallsign: 'TST' } }, member: { memberType: admin ? 3 : 2 } }] } });
      if (/\/GroupV2\/\d+\/Members/.test(p)) return j({ ErrorCode: 1, Response: { results: [{ memberType: admin ? 3 : 2, isOnline: true, destinyUserInfo: { membershipId: xsave ? '4611686018499999999' : '4611686018400000001', membershipType: xsave ? 1 : 3, bungieGlobalDisplayName: 'Teste', bungieGlobalDisplayNameCode: 1234 } }] } });
      return j({ ErrorCode: 1, Response: {} });
    }
    if (u.hostname === 'dni-api.dni-site.workers.dev') {
      if (u.pathname === '/err' && r.request().method() === 'POST') { seen.rep = (seen.rep || []).concat(String(r.request().postData() || '').slice(0, 200)); return j({ ok: true }); }
      if (u.pathname === '/defs') return j({});
      if (u.pathname === '/twins') return j({ g: [[WPN.A, WPN.T]], f: { '13:5000': [WPN.A, WPN.F] } });
      if (u.pathname === '/videos') return j({ list: [] }); if (u.pathname === '/guias') return j({ m: {} }); if (u.pathname === '/whoami') return j({ owner, uid: owner ? 'u1' : undefined });
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
    if (u.hostname === 'raw.githubusercontent.com') return r.fulfill({ status: 200, contentType: 'text/plain', body: arm ? VOLT : 'title:x\n' });
    return r.fulfill({ status: 200, body: '' });
  });
  const A = { access_token: 'a', access_expires: expired ? now - 1000 : now + 36e5, refresh_token: 'r', refresh_expires: now + 90 * 864e5, membership_id: '99' };
  await page.addInitScript(([a, ls, vc]) => { try { if (a) localStorage.setItem('dc-auth', JSON.stringify(a)); localStorage.setItem('dc-authv', '2'); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, JSON.stringify(v)); if (vc) sessionStorage.setItem('dc-vc', vc); } catch {} }, [auth ? A : null, ls, vc]);
  const fail = [];
  await page.goto(ORIGIN + path); await page.waitForTimeout(2500);
  const blank = async where => {
    for (let t = 0; t < 24; t++) { if (await page.evaluate(() => { const w = document.querySelector('.wrap'); return (document.getElementById('list')?.textContent || '').trim().length >= 5 && !(w && getComputedStyle(w).visibility === 'hidden'); })) break; await page.waitForTimeout(500); }
    const st = await page.evaluate(() => { const l = document.getElementById('list'), w = document.querySelector('.wrap'); return { n: (l?.textContent || '').trim().length && l.getBoundingClientRect().height > 20 ? (l?.textContent || '').trim().length : 0, hidden: w ? getComputedStyle(w).visibility === 'hidden' : false, html: (l?.innerHTML || '').slice(0, 200) + ' n=' + (l?.textContent || '').trim().length + ' hid=' + (w ? getComputedStyle(w).visibility : '') }; });
    if (st.n < 5 || st.hidden) fail.push(`${where}: tela em branco${process.env.DBG ? ' · ' + st.html : ''}`);
  };
  await blank(path);
  if (clicks && auth && (path === '/' || path === '/beta')) {
    const groups = await page.$$eval('#tabs .tab', t => t.map(x => x.dataset.group));
    for (const g of groups) {
      await page.evaluate(g => document.querySelector(`#tabs .tab[data-group="${g}"]`)?.click(), g); await page.waitForTimeout(600); await blank('aba ' + g);
      const subs = await page.$$eval('#subtabs .sub', t => t.map(x => x.dataset.sub));
      for (const s of subs) { await page.evaluate(s => document.querySelector(`#subtabs .sub[data-sub="${s}"]`)?.click(), s); await page.waitForTimeout(500); await blank(`aba ${g} › ${s}`); }
    }
  }
  if (expectSub) { const [g, sub] = expectSub; await page.evaluate(g => document.querySelector(`#tabs .tab[data-group="${g}"]`)?.click(), g); for (let t = 0; t < 10; t++) { if (await page.$(`#subtabs .sub[data-sub="${sub}"]`)) break; await page.waitForTimeout(500); } if (!(await page.$(`#subtabs .sub[data-sub="${sub}"]`))) fail.push(`subaba ${sub} não apareceu`); }
  if (noSub) { const [g, sub] = noSub; await page.evaluate(g => document.querySelector(`#tabs .tab[data-group="${g}"]`)?.click(), g); await page.waitForTimeout(1500); if (await page.$(`#subtabs .sub[data-sub="${sub}"]`)) fail.push(`subaba ${sub} apareceu e não devia`); }
  if (expectBar && !(await page.$('#vcbar'))) fail.push('barra "ver como" não apareceu');
  if (!owner && await page.$('#vcbar')) fail.push('barra "ver como" apareceu para quem não é dono');
  if (process.env.SHOTS) { await page.waitForTimeout(3000); await page.screenshot({ path: `${process.env.SHOTDIR}/${process.env.SHOTS}.png`, fullPage: true }); }
  if (arm && !steps) {
    await page.evaluate(() => { localStorage.setItem('dc-tab', JSON.stringify('inv')); }); await page.evaluate(() => document.querySelector('[data-rap]')?.click());
    for (let t = 0; t < 20; t++) { if (await page.$('.ap-r')) break; await page.waitForTimeout(500); }
    const st = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.ap-r')].map(r => r.querySelector('.ap-g')?.textContent + '|' + (r.querySelector('.ap-fix')?.textContent || '')), no: document.querySelector('.ap-no summary')?.textContent || '', all: !!document.querySelector('[data-apall]') }));
    if (!st.rows.some(r => r.startsWith('≈A'))) fail.push('avaliar: família devia dar ≈A · ' + JSON.stringify(st.rows));
    if (st.rows.length !== 3) fail.push('avaliar: esperava 3 linhas com nota, veio ' + JSON.stringify(st.rows));
    if (!st.rows.some(r => r.startsWith('A|') && r.includes('B→A'))) fail.push('avaliar: arma A devia mostrar A com ↻ B→A · ' + JSON.stringify(st.rows));
    if (!st.rows.some(r => r.startsWith('S|'))) fail.push('avaliar: gêmea por nome devia ter nota S · ' + JSON.stringify(st.rows));
    if (!/1/.test(st.no)) fail.push('avaliar: exótica devia ir para "Sem nota"');
    if (!st.all) fail.push('avaliar: faltou "Otimizar todas"');
    await page.evaluate(() => document.querySelector('[data-apopen]')?.click()); await page.waitForTimeout(800);
    if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + '-d.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.screenshot({ path: process.env.SHOT + '-m.png', fullPage: true }); await page.setViewportSize({ width: 1366, height: 900 }); }
    if (!(await page.$('.ap-x'))) fail.push('avaliar: linha não abriu');
    await page.evaluate(() => document.querySelector('[data-apall]')?.click()); await page.waitForTimeout(300); await page.evaluate(() => document.querySelector('[data-apgo]')?.click());
    for (let t = 0; t < 40; t++) { if (await page.$('[data-apbx]')) break; await page.waitForTimeout(500); }
    const dn = await page.evaluate(() => document.querySelector('.lkb')?.textContent || ''); if (!/1 (otimizada|optimized)/.test(dn)) fail.push('avaliar: otimizar todas não terminou · ' + dn.slice(0, 80));
    await page.evaluate(() => document.querySelector('[data-apbx]')?.click()); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-aplkall]')?.click()); await page.waitForTimeout(300);
    if (!(await page.$('[data-aplkgo]'))) fail.push('trancar S e A: faltou a confirmação');
    await page.evaluate(() => document.querySelector('[data-aplkgo]')?.click());
    for (let t = 0; t < 30; t++) { if (await page.$('[data-aplkx]')) break; await page.waitForTimeout(300); }
    const lk = await page.evaluate(() => document.querySelector('.lkb')?.textContent || ''); if (!/2 (trancadas|locked)/.test(lk)) fail.push('trancar S e A: ' + lk.slice(0, 80));
    if ((await page.$$('.ap-lki')).length < 2) fail.push('trancar: cadeado não apareceu nas linhas');
    await page.evaluate(() => document.querySelector('[data-aplkx]')?.click()); await page.evaluate(() => document.querySelector('[data-apf="junk"]')?.click()); await page.waitForTimeout(400);
    if (!(await page.$('.ap-junk'))) fail.push('pode desmontar: faltou o aviso da lista');
        await page.evaluate(() => document.querySelector('[data-rap]')?.click()); await page.waitForTimeout(500); if (await page.$('.ap')) fail.push('avaliar: botão não desligou a tela');
    await blank('avaliar desligado');
  }
  if (steps) { await page.evaluate(() => { window.__noReload = 1; }); try { await steps(page, fail); } catch (e) { fail.push('passo do teste quebrou: ' + String(e.message || e).split('\n')[0]); } }
  if (expectText) { let ok = false; for (let t = 0; t < 20 && !ok; t++) { ok = (await page.evaluate(() => document.getElementById('list')?.innerText || '')).includes(expectText); if (!ok) await page.waitForTimeout(500); } if (!ok) fail.push(`faltou o texto "${expectText}" na tela`); }
  if (seen.rep?.length) fail.push('o site relatou erro ao montar a tela: ' + seen.rep[0]);
  if (expired && (seen.refresh < 1 || seen.refresh > (steps ? 2 : 1))) fail.push(`login vencido: renovou ${seen.refresh} vezes (devia ser 1)`);
  await b.close();
  const all = [...fail, ...errs];
  console.log(`${all.length ? '✗' : '✓'} ${name}${all.length ? '\n    ' + [...new Set(all)].slice(0, 8).join('\n    ') : ''}`);
  return all.length === 0;
}

const R = [];
if (process.env.ONLY) { R.push(await run(process.env.ONLY, { path: process.env.OPATH || '/beta', arm: !process.env.SHOTS, clicks: false, ls: { 'dc-tab': process.env.SHOTS || 'inv', ...(process.env.SHOTLS ? JSON.parse(process.env.SHOTLS) : {}) } })); console.log(R.every(Boolean) ? 'ok' : 'falhou'); process.exit(R.every(Boolean) ? 0 : 1); }
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
R.push(await run('/beta ver como: membro comum (admin real)', { path: '/beta', owner: true, admin: true, vc: 'm', ls: { 'dc-ownchk': { o: true, t: Date.now() } }, noSub: ['clan', 'gcla'], expectBar: true }));
R.push(await run('/beta ver como: sem clã', { path: '/beta', owner: true, vc: 'n', ls: { 'dc-ownchk': { o: true, t: Date.now() } }, expectBar: true }));
R.push(await run('/beta ver como: agenda recusada', { path: '/beta', owner: true, vc: 'a', ls: { 'dc-ownchk': { o: true, t: Date.now() }, 'dc-tab': 'gcl' }, clicks: false, expectBar: true }));
R.push(await run('avaliar rolls (nota, gêmea, família, exótica, otimizar)', { path: '/', arm: true, clicks: false, ls: { 'dc-tab': 'inv' } }));
R.push(await run('/grade: bot recusa a sessão (401) mostra aviso', { path: '/grade', auth: true, orla: 401, clicks: false, ls: { 'dc-lang': 'pt' }, expectText: 'Entrar de novo' }));
R.push(await run('/grade: fora do clã (403) mostra aviso', { path: '/grade', auth: true, orla: 403, clicks: false, ls: { 'dc-lang': 'pt' }, expectText: 'Orla Emaranhada' }));
R.push(await run('/grade: bot fora do ar (503) mostra aviso', { path: '/grade', auth: true, orla: 503, clicks: false, ls: { 'dc-lang': 'pt' }, expectText: 'Tentar de novo' }));
R.push(await run('/grade ver como: fora do clã', { path: '/grade', owner: true, vc: 'gc', clicks: false, ls: { 'dc-lang': 'pt', 'dc-ownchk': { o: true, t: Date.now() } }, expectText: 'Orla Emaranhada', expectBar: true }));

// ---------- navegação por endereço (abas com endereço próprio, Voltar/Avançar, /grade sem recarregar, permissões) ----------
const url = p => p.evaluate(() => location.pathname + location.search), act = p => p.evaluate(() => document.querySelector('#subtabs .sub.on, #subtabs .sub[aria-selected="true"], #subtabs .sub[aria-current]')?.dataset.sub || document.querySelector('#subtabs .on')?.dataset.sub || '');
const same = async (p, fail, w) => { if (!(await p.evaluate(() => window.__noReload === 1))) fail.push(`${w}: a página recarregou (devia trocar sem recarregar)`); };
const clickSub = async (p, g, sub) => { if (!(await p.$(`#subtabs .sub[data-sub="${sub}"]`))) { await p.evaluate(g => document.querySelector(`#tabs .tab[data-group="${g}"]`)?.click(), g); await p.waitForTimeout(400); } await p.evaluate(sub => document.querySelector(`#subtabs .sub[data-sub="${sub}"]`)?.click(), sub); };
const kidClick = (p, k) => p.evaluate(k => document.querySelector(`[data-kid="${k}"]`)?.click(), k);
R.push(await run('endereço: /cofre abre o Cofre', { path: '/cofre', clicks: false, steps: async (p, fail) => { await p.waitForTimeout(1500); if (!(await p.$('.vl-wrap, .iv-wrap'))) fail.push('/cofre não abriu o cofre'); if (await url(p) !== '/cofre') fail.push('endereço mudou: ' + await url(p)); } }));
R.push(await run('endereço: "/" retoma a última aba e mostra o endereço dela', { path: '/', clicks: false, ls: { 'dc-tab': 'vend' }, steps: async (p, fail) => { await p.waitForTimeout(800); if (await url(p) !== '/vendedores') fail.push('esperava /vendedores, veio ' + await url(p)); } }));
R.push(await run('endereço: trocar de aba muda o endereço e Voltar/Avançar funcionam', { path: '/hoje', clicks: false, steps: async (p, fail) => {
  await clickSub(p, 'drops', 'vend'); await p.waitForTimeout(600); if (await url(p) !== '/vendedores') fail.push('clique em Vendedores: endereço ' + await url(p));
  await clickSub(p, 'gd', 'gst'); await p.waitForTimeout(600); if (await url(p) !== '/estatisticas') fail.push('clique em Estatísticas: endereço ' + await url(p));
  await p.goBack(); await p.waitForTimeout(800); if (await url(p) !== '/vendedores') fail.push('Voltar: esperava /vendedores, veio ' + await url(p));
  if (!(await p.evaluate(() => (document.getElementById('list')?.textContent || '').trim().length > 5))) fail.push('Voltar: tela vazia');
  await p.goBack(); await p.waitForTimeout(800); if (await url(p) !== '/hoje') fail.push('Voltar 2x: esperava /hoje, veio ' + await url(p));
  await p.goForward(); await p.waitForTimeout(800); if (await url(p) !== '/vendedores') fail.push('Avançar: esperava /vendedores, veio ' + await url(p));
  await same(p, fail, 'Voltar/Avançar'); } }));
R.push(await run('endereço: Hoje → Grade → Arsenal → Voltar (sem recarregar)', { path: '/hoje', clicks: false, ls: { 'dc-lang': 'pt' }, steps: async (p, fail) => {
  await p.evaluate(() => { const b = document.getElementById('gradebtn'); if (b) { b.hidden = false; b.click(); } }); await p.waitForTimeout(1500);
  if (await url(p) !== '/grade') fail.push('botão Grade: endereço ' + await url(p));
  if (!(await p.evaluate(() => document.documentElement.classList.contains('grade')))) fail.push('Grade: faltou o visual da página da grade');
  if (!(await p.evaluate(() => /Grades do clã|Clan rosters/.test(document.title)))) fail.push('Grade: título da aba não mudou');
  if (!(await p.evaluate(() => (document.getElementById('list')?.innerText || '').includes('Agenda')))) fail.push('Grade: agenda não apareceu');
  await clickSub(p, 'drops', 'vend'); await p.waitForTimeout(800);
  if (await url(p) !== '/vendedores') fail.push('saindo da Grade: endereço ' + await url(p));
  if (await p.evaluate(() => document.documentElement.classList.contains('grade'))) fail.push('saindo da Grade: visual da grade ficou');
  if (await p.evaluate(() => /Grades do clã/.test(document.title))) fail.push('saindo da Grade: título ficou "Grades do clã"');
  await p.goBack(); await p.waitForTimeout(1200); if (await url(p) !== '/grade') fail.push('Voltar para a Grade: endereço ' + await url(p));
  if (!(await p.evaluate(() => (document.getElementById('list')?.innerText || '').includes('Agenda')))) fail.push('Voltar para a Grade: agenda sumiu');
  await same(p, fail, 'Grade ida e volta'); } }));
R.push(await run('endereço: /grade → clicar em aba vai sem recarregar', { path: '/grade', clicks: false, steps: async (p, fail) => {
  await clickSub(p, 'gd', 'gd'); await p.waitForTimeout(1000); if (await url(p) !== '/builds') fail.push('da grade para Builds: ' + await url(p)); await same(p, fail, 'grade → builds'); } }));
R.push(await run('rolagem: Voltar devolve a posição; aba nova sobe para a lista', { path: '/hoje', clicks: false, steps: async (p, fail) => {
  await p.evaluate(() => { document.body.style.minHeight = '5000px'; scrollTo(0, 1500); }); await p.waitForTimeout(300);
  await clickSub(p, 'obj', 'cal'); await p.waitForTimeout(900); const y1 = await p.evaluate(() => scrollY); if (y1 > 1200) fail.push('aba nova não subiu (' + y1 + ')');
  await p.goBack(); await p.waitForTimeout(1200); const y2 = await p.evaluate(() => scrollY); if (Math.abs(y2 - 1500) > 60) fail.push('Voltar não devolveu a rolagem (' + y2 + ')'); } }));
R.push(await run('teclado: trocar de aba pelo teclado leva o foco ao conteúdo', { path: '/hoje', clicks: false, steps: async (p, fail) => {
  await p.focus('#tabs .tab[data-group="drops"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  if (!(await p.evaluate(() => document.activeElement?.id === 'list'))) fail.push('foco não foi para o conteúdo: ' + await p.evaluate(() => document.activeElement?.className || document.activeElement?.tagName)); } }));
R.push(await run('tempo: abrir de novo mostra a última visita antes da Bungie responder', { path: '/hoje', expired: true, clicks: false, steps: async (p, fail) => {
  await p.waitForTimeout(process.env.LAT ? 6000 : 2500); await p.reload(); const t0 = Date.now();
  let ms = -1; for (let t = 0; t < 120; t++) { if (await p.evaluate(() => (document.getElementById('list')?.textContent || '').length > 300 && !!document.querySelector('#tabs .tab'))) { ms = Date.now() - t0; break; } await p.waitForTimeout(50); }
  let live = -1; for (let t = 0; t < 160; t++) { if (await p.evaluate(() => /Atualizado às|Updated at/.test(document.body.innerText) && !/cópia|copy|salv/i.test(document.getElementById('updated')?.textContent || ''))) { live = Date.now() - t0; break; } await p.waitForTimeout(50); }
  console.log('    ⏱ dados novos da Bungie em', live, 'ms');
  console.log('    ⏱ conteúdo na tela em', ms, 'ms' + (process.env.LAT ? ' (com atrasos reais simulados: config 0,6 s, login 0,85 s, Bungie 2 s)' : ''));
  if (ms < 0 || (process.env.LAT && ms > 1500)) fail.push('conteúdo demorou: ' + ms + ' ms'); } }));
// ---------- tabela de telas (SCREENS no app.js): toda tela tem endereço na Vercel e abre (ou é recusada) conforme "who" ----------
const SCREENS = new Function('return ' + readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/const SCREENS = (\[[\s\S]*?\n\]);/)[1])();
{ const miss = SCREENS.filter(x => !REWRITE['/' + x.r]); const ok = !miss.length; console.log((ok ? '✓' : '✗') + ' tabela de telas: todo endereço tem rewrite no vercel.json' + (ok ? '' : '\n    faltam: ' + miss.map(x => '/' + x.r).join(', '))); R.push(ok); }
for (const x of SCREENS) {
  const who = x.who || 'all', want = who === 'all' ? '/' + x.r : who === 'admin' ? '/membros' : '/hoje';
  R.push(await run(`tela ${x.id} (/${x.r}) como membro comum`, { path: '/' + x.r, clicks: false, steps: async (p, fail) => {
    await p.waitForTimeout(x.id === 'gclo' ? 2000 : 1200); const u = await url(p); if (u !== want) fail.push(`esperava ${want} (who=${who}), veio ${u}`);
    if (who === 'all' && x.id !== 'gclo' && x.g && !(await p.evaluate(g => !!document.querySelector(`#tabs .tab[data-group="${g}"][aria-current="true"]`), x.g))) fail.push('aba do grupo ' + x.g + ' não ficou ativa');
    const ovShown = await p.evaluate(() => !document.getElementById('overall')?.hidden); if (who === 'all' && x.id !== 'gclo' && ovShown !== !!x.ov) fail.push(`barra "x de y feitos": ${ovShown ? 'apareceu' : 'sumiu'} (tabela diz ov=${!!x.ov})`); } }));
}
for (const x of SCREENS.filter(x => x.who === 'admin')) R.push(await run(`tela ${x.id} (/${x.r}) como admin`, { path: '/' + x.r, admin: true, clicks: false, steps: async (p, fail) => { await p.waitForTimeout(1500); if (await url(p) !== '/' + x.r) fail.push('admin não abriu: ' + await url(p)); } }));
for (const x of SCREENS.filter(x => x.who === 'beta')) R.push(await run(`tela ${x.id} (/beta/${x.r}) no /beta`, { path: '/beta/' + x.r, owner: true, clicks: false, ls: { 'dc-ownchk': { o: true, t: Date.now() } }, steps: async (p, fail) => { await p.waitForTimeout(1500); if (await url(p) !== '/beta/' + x.r) fail.push('/beta não abriu: ' + await url(p)); } }));
R.push(await run('permissão: /administracao sem ser admin cai em Membros', { path: '/administracao', clicks: false, steps: async (p, fail) => {
  await p.waitForTimeout(1500); if (await url(p) !== '/membros') fail.push('esperava /membros, veio ' + await url(p)); if (await p.$('#subtabs .sub[data-sub="gcla"]')) fail.push('aba Administração apareceu para não-admin'); } }));
R.push(await run('permissão: /administracao como admin abre', { path: '/administracao', admin: true, clicks: false, steps: async (p, fail) => {
  await p.waitForTimeout(1500); if (await url(p) !== '/administracao') fail.push('admin: esperava /administracao, veio ' + await url(p)); } }));
R.push(await run('endereço: sem login em /cofre mostra a entrada e guarda a volta', { path: '/cofre', auth: false, clicks: false, steps: async (p, fail) => {
  await p.waitForTimeout(800); if (await url(p) !== '/cofre') fail.push('sem login: endereço mudou para ' + await url(p));
  await p.route('https://www.bungie.net/**/OAuth/**', r => r.abort());
  await p.evaluate(() => document.getElementById('loginbtn')?.click()); await p.waitForTimeout(800);
  const st = await p.context().storageState(), ls2 = st.origins.find(o => o.origin === 'http://dpi.test')?.localStorage || [], r = (() => { try { return JSON.parse(ls2.find(x => x.name === 'dc-ret2')?.value || 'null')?.r; } catch { return null; } })(); if (r !== '/cofre') fail.push('entrar: não guardou a volta para /cofre (' + r + ')'); } }));
R.push(await run('endereço: /beta/cofre (dono) mantém o /beta', { path: '/beta/cofre', owner: true, clicks: false, ls: { 'dc-ownchk': { o: true, t: Date.now() } }, steps: async (p, fail) => {
  await p.waitForTimeout(1200); if (await url(p) !== '/beta/cofre') fail.push('beta: endereço ' + await url(p)); await clickSub(p, 'drops', 'vend'); await p.waitForTimeout(600); if (await url(p) !== '/beta/vendedores') fail.push('beta: aba nova foi para ' + await url(p)); } }));
R.push(await run('endereço: link "Marcar grade" (/grade?a=) abre a Grade sem recarregar', { path: '/hoje', clicks: false, steps: async (p, fail) => {
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/grade?a=teste'; a.id = 'tlink'; document.body.append(a); a.click(); }); await p.waitForTimeout(1500);
  if (!(await url(p)).startsWith('/grade')) fail.push('link Marcar grade: ' + await url(p)); await same(p, fail, 'Marcar grade'); } }));
R.push(await run('grade: sugestão de loadout no cartão em que estou inscrito', { path: '/grade', arm: true, clicks: false, ls: { 'dc-lang': 'pt' }, steps: async (p, fail) => {
  for (let t = 0; t < 30; t++) { if (await p.$('.ls [data-lseq]')) break; await p.waitForTimeout(400); }
  const st = await p.evaluate(() => ({ n: document.querySelectorAll('.ls').length, txt: document.querySelector('.ls')?.innerText || '', eq: !!document.querySelector('.ls [data-lseq]:not([disabled])') }));
  if (st.n !== 1) fail.push('esperava 1 sugestão (só na grade em que estou), veio ' + st.n);
  if (!/Sugestão de loadout/.test(st.txt) || !/Nada muda na sua conta/.test(st.txt)) fail.push('texto da sugestão: ' + st.txt.slice(0, 120));
  if (!st.eq) fail.push('botão Equipar sugestão desligado');
  if (process.env.SHOT2) { await p.evaluate(() => document.querySelector('.ls')?.scrollIntoView()); await (await p.$('.ls')).screenshot({ path: process.env.SHOT2 }); }
  await p.evaluate(() => document.querySelector('.ls [data-lsalt]')?.click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('.ls [data-lseq]')?.click()); await p.waitForTimeout(1500);
  if (!(await p.evaluate(() => document.getElementById('wrdlg')?.open))) fail.push('Equipar não abriu a confirmação'); } }));
R.push(await run('/grade: sem login', { path: '/grade', auth: false, clicks: false }));
const bad = R.filter(x => !x).length;
console.log(bad ? `\n${bad} teste(s) falharam.` : '\nTudo certo.');
process.exit(bad ? 1 : 0);
