/* Interactions do Discord: /orla grade, /orla registrar, botões da grade e modais. */
import { ActivityInputError } from './rules.js';
import { BungieApiError, findMembership, syncPlayerActivities, upsertUser } from './bungie.js';
import { SignupError, enroll, removeSignup } from './signups.js';
import { CATALOG_PREFIX, createGrade, refreshMessage, applySignup } from './grades.js';
import { catalog, searchActivities, matchActivity } from './search.js';
import { DiscordError, deleteMessage, editOriginal, ephemeral, followup } from './discord.js';
import { escapeMarkdown } from './embed.js';
import { skillForClears } from './rules.js';

const json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
const deferEphemeral = () => ({ type: 5, data: { flags: 64 } });
const CAT = { j: 'titular', l: null, r: 'reserva' };
const CAT_CODE = { titular: 'j', reserva: 'r' };

// ---------- modais ----------
export const bungieNameModal = customId => ({ type: 9, data: { custom_id: customId, title: 'Vincular Bungie Name', components: [{ type: 1, components: [{ type: 4, custom_id: 'bn', label: 'Bungie Name', style: 1, placeholder: 'Guardian#6666', min_length: 6, max_length: 30, required: true }] }] } });

export function activityModal(curatedId, d = {}) {
  const opt = (v, desc, sel) => ({ label: String(v), value: String(v), ...(desc ? { description: desc } : {}), default: sel });
  const label = (text, description, component) => ({ type: 18, label: text, description, component });
  return { type: 9, data: { custom_id: `orla:grade:${curatedId ?? 0}`, title: 'Criar Grade', components: [
    label('Atividade', 'Digite o nome da atividade (até 80 caracteres).', { type: 4, custom_id: 'atividade', style: 1, placeholder: 'Nome da atividade', max_length: 80, required: true, ...(d.atividade ? { value: d.atividade } : {}) }),
    label('Integrantes', 'Quantidade de integrantes.', { type: 3, custom_id: 'integrantes', placeholder: 'Escolha', min_values: 1, max_values: 1, options: [
      opt(3, 'Masmorras, Atividade da Vanguarda / PvP / Esquadrão padrão', d.integrantes === 3), opt(4, 'Artimanha (Gambit) / PvP', d.integrantes === 4),
      opt(6, 'Raids / PvP', d.integrantes === 6), opt(12, 'Excisão / PvP Privado / Outras Atividades', d.integrantes === 12)] }),
    label('Novatos', 'Máximo de novatos titulares.', { type: 3, custom_id: 'novatos', placeholder: 'Escolha', min_values: 1, max_values: 1, options: Array.from({ length: 13 }, (_, n) => opt(n, null, n === (d.novatos ?? 0))) }),
    label('Início', 'Use o formato DD/mm/YY HH:MM', { type: 4, custom_id: 'inicio', style: 1, placeholder: '30/02/26 18:99', max_length: 16, required: true, ...(d.inicio ? { value: d.inicio } : {}) }),
    label('Descrição', 'Informações adicionais (opcional).', { type: 4, custom_id: 'descricao', style: 2, max_length: 250, required: false, ...(d.descricao ? { value: d.descricao } : {}) }),
  ] } };
}

// valores enviados por um modal (campos soltos ou dentro de Label/ActionRow)
function modalValues(components, out = {}) {
  for (const c of components ?? []) {
    if (c.custom_id) out[c.custom_id] = c.values ?? c.value;
    if (c.component) modalValues([c.component], out);
    if (c.components) modalValues(c.components, out);
  }
  return out;
}

const user = i => i.member?.user ?? i.user;
const linkedUser = (env, id) => env.DB.prepare('SELECT * FROM users WHERE discord_user_id = ?').bind(String(id)).first();
const safe = (ctx, p) => ctx.waitUntil(p.catch(e => console.error('interaction', e?.stack || e)));

// ---------- grade ----------
async function runSave(env, token, u, a) {
  try {
    const r = await createGrade(env, { userId: u.id, ...a });
    await editOriginal(env, token, { content: r.published
      ? `Atividade **${r.name}** publicada (#${r.activityId}).${r.warning}`
      : `A atividade foi salva (#${r.activityId}), mas não consegui publicar a mensagem com os botões. Peça a um administrador para verificar.` });
  } catch (e) {
    const msg = e instanceof ActivityInputError ? e.message : 'Não foi possível salvar a atividade agora. Tente novamente mais tarde.';
    if (!(e instanceof ActivityInputError)) console.error('grade', e?.stack || e);
    await editOriginal(env, token, { content: msg });
  }
}

async function commandGrade(env, ctx, i, opts) {
  const u = user(i);
  let { atividade, integrantes, inicio, descricao, novatos } = opts, curatedId = null;
  if (atividade?.startsWith(CATALOG_PREFIX)) {
    const id = Number(atividade.slice(CATALOG_PREFIX.length));
    if (!Number.isInteger(id)) return ephemeral('A opção do catálogo é inválida. Escolha outra atividade.');
    const c = await env.DB.prepare('SELECT * FROM curated_bungie_activities WHERE id = ?').bind(id).first();
    if (!c) return ephemeral('Essa opção não está mais no catálogo. Pesquise novamente e escolha outra.');
    curatedId = id; atividade = c.name;
  }
  else if (atividade) { const m = matchActivity(await catalog(env.DB), atividade); if (m) { curatedId = m.id; atividade = m.name; } }
  const complete = integrantes != null && inicio != null;
  if (!(await linkedUser(env, u.id))) {
    if (!complete) return json(bungieNameModal('orla:bn:g0'));
    const pid = crypto.randomUUID().slice(0, 12);
    await env.DB.prepare('INSERT INTO pending_grades (id, payload, created_at) VALUES (?,?,?)').bind(pid, JSON.stringify({ atividade, integrantes, inicio, descricao: descricao ?? '', curatedId, rookieLimit: novatos ?? null }), new Date().toISOString()).run();
    return json(bungieNameModal(`orla:bn:g:${pid}`));
  }
  if (!complete) return json(activityModal(curatedId, { atividade, integrantes, inicio, descricao, novatos }));
  safe(ctx, runSave(env, i.token, u, { atividade, integrantes, inicio, descricao: descricao ?? '', curatedId, rookieLimit: novatos ?? null }));
  return json(deferEphemeral());
}

async function submitGrade(env, ctx, i) {
  const f = modalValues(i.data.components), u = user(i);
  const typed = String(f.atividade ?? '');
  const curatedId = Number(i.data.custom_id.split(':')[2]) || null;
  let linked = null;
  if (curatedId) { const c = await env.DB.prepare('SELECT name FROM curated_bungie_activities WHERE id = ?').bind(curatedId).first(); if (c && typed.trim() === c.name) linked = curatedId; }
  let nome = typed;
  if (!linked) { const m = matchActivity(await catalog(env.DB), typed); if (m) { linked = m.id; nome = m.name; } }
  safe(ctx, runSave(env, i.token, u, { atividade: nome, integrantes: Number(f.integrantes?.[0]), inicio: String(f.inicio ?? ''), descricao: String(f.descricao ?? ''), curatedId: linked, rookieLimit: Number(f.novatos?.[0]) }));
  return json(deferEphemeral());
}

// ---------- registrar (Discord → informa o Bungie Name) ----------
async function linkByName(env, u, name) {
  const m = await findMembership(env, name);
  await upsertUser(env.DB, u.id, u.username, m);
  return m;
}

async function commandRegister(env, ctx, i, opts) {
  const u = user(i);
  safe(ctx, (async () => {
    try { const m = await linkByName(env, u, opts.player_bungie_id); await editOriginal(env, i.token, { content: `Bungie Name **${escapeMarkdown(m.bungieName)}** vinculado à sua conta Discord.` }); }
    catch (e) { await editOriginal(env, i.token, { content: e instanceof BungieApiError ? e.message : 'Não consegui salvar o vínculo Bungie agora. Tente novamente.' }); if (!(e instanceof BungieApiError)) console.error('registrar', e?.stack || e); }
  })());
  return json(deferEphemeral());
}

async function submitBungieName(env, ctx, i) {
  const u = user(i), [, , kind, a, b] = i.data.custom_id.split(':'), name = String(modalValues(i.data.components).bn ?? '');
  safe(ctx, (async () => {
    try {
      await linkByName(env, u, name);
    } catch (e) {
      await editOriginal(env, i.token, { content: e instanceof BungieApiError ? e.message : 'Não consegui salvar o vínculo Bungie agora. Tente novamente.' });
      if (!(e instanceof BungieApiError)) console.error('vinculo', e?.stack || e);
      return;
    }
    if (kind === 'e') { await editOriginal(env, i.token, { content: 'Bungie Name vinculado. Continuando sua inscrição…' }); return applyEnrollment(env, i.token, u, Number(a), CAT[b]); }
    if (kind === 'g' && a) {
      const row = await env.DB.prepare('SELECT payload FROM pending_grades WHERE id = ?').bind(a).first();
      if (row) { await env.DB.prepare('DELETE FROM pending_grades WHERE id = ?').bind(a).run(); return runSave(env, i.token, u, JSON.parse(row.payload)); }
    }
    await editOriginal(env, i.token, { content: 'Bungie Name vinculado. Execute `/orla grade` novamente para abrir o formulário da grade.' });
  })());
  return json(deferEphemeral());
}

// ---------- botões ----------
async function applyEnrollment(env, token, u, activityId, category) {
  const text = await applySignup(env, String(u.id), activityId, category);
  if (text) return followup(env, token, text);
}

async function buttonPress(env, ctx, i) {
  const u = user(i), action = i.data.custom_id.split(':')[2];
  const category = action === 'join' ? 'titular' : action === 'reserve' ? 'reserva' : null;
  const act = await env.DB.prepare('SELECT id FROM activities WHERE discord_message_id = ?').bind(String(i.message?.id)).first();
  if (!act) return ephemeral('Essa atividade não está mais disponível.');
  if (category !== null && !(await linkedUser(env, u.id))) return json(bungieNameModal(`orla:bn:e:${act.id}:${CAT_CODE[category]}`));
  safe(ctx, applyEnrollment(env, i.token, u, act.id, category));
  return json({ type: 6 });
}

// ---------- autocomplete ----------
async function autocomplete(env, i, sub) {
  const focused = sub.options?.find(o => o.focused);
  const rows = searchActivities(await catalog(env.DB), String(focused?.value ?? '').slice(0, 80));
  return json({ type: 8, data: { choices: rows.map(r => ({ name: r.name.slice(0, 100), value: `${CATALOG_PREFIX}${r.id}` })) } });
}

async function route(env, ctx, i) {
  if (i.type === 1) return json({ type: 1 });
  if (i.type === 2 || i.type === 4) {
    if (i.data?.name !== 'orla') return json(ephemeral('Comando desconhecido.'));
    const sub = i.data.options?.[0];
    const opts = Object.fromEntries((sub?.options ?? []).map(o => [o.name, o.value]));
    if (i.type === 4) return sub?.name === 'grade' ? autocomplete(env, i, sub) : json({ type: 8, data: { choices: [] } });
    if (sub?.name === 'grade') return commandGrade(env, ctx, i, opts);
    if (sub?.name === 'registrar') return commandRegister(env, ctx, i, opts);
    return json(ephemeral('Comando desconhecido.'));
  }
  if (i.type === 3 && i.data.custom_id?.startsWith('orla:activity:')) return buttonPress(env, ctx, i);
  if (i.type === 5) {
    const id = i.data.custom_id ?? '';
    if (id.startsWith('orla:bn:')) return submitBungieName(env, ctx, i);
    if (id.startsWith('orla:grade:')) return submitGrade(env, ctx, i);
  }
  return json(ephemeral('Interação não reconhecida.'));
}

export async function handleInteraction(env, ctx, i) {
  const r = await route(env, ctx, i);
  return r instanceof Response ? r : json(r);
}
