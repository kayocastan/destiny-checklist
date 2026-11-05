/* Criação de grade: mesmo fluxo para /orla grade (Discord) e para o formulário do DPI. */
import { ActivityInputError, parseActivityStart, validateActivityInput, validateActivityStart, skillForClears } from './rules.js';
import { BungieApiError, syncPlayerActivities } from './bungie.js';
import { getRoster, enroll, removeSignup, SignupError } from './signups.js';
import { renderActivity, BUTTONS } from './embed.js';
import { postMessage, editMessage, deleteMessage, DiscordError } from './discord.js';

export const CATALOG_PREFIX = 'curated:';

export async function publishPayload(env, activityId) {
  const r = await getRoster(env.DB, activityId);
  return { embeds: [renderActivity(r.activity, r.participants, { bungieNames: r.bungieNames, skills: r.skills, heroUrl: env.HERO_URL })], components: BUTTONS };
}

export async function refreshMessage(env, activityId) {
  const r = await getRoster(env.DB, activityId);
  if (!r.activity.discord_message_id) return;
  await editMessage(env, r.activity.discord_channel_id, r.activity.discord_message_id, await publishPayload(env, activityId));
}

/* in: { userId, atividade, integrantes, inicio, descricao, curatedId, rookieLimit }
   out: { activityId, warning, published } — ActivityInputError para dados inválidos */
export async function createGrade(env, a) {
  const db = env.DB, tz = env.TIMEZONE || 'America/Sao_Paulo';
  let curated = null;
  if (a.curatedId != null) {
    curated = await db.prepare('SELECT * FROM curated_bungie_activities WHERE id = ?').bind(a.curatedId).first();
    if (!curated) throw new ActivityInputError('Essa opção não está mais no catálogo. Pesquise novamente e escolha outra.');
  }
  const requiresBungie = !!curated && /^(raid|dungeon):/i.test(curated.eligibility_group); // histórico Bungie só de incursão/masmorra
  const startsAt = parseActivityStart(a.inicio, tz);
  validateActivityStart(startsAt);
  const name = validateActivityInput(a.atividade, a.integrantes, a.descricao ?? '', a.rookieLimit ?? null);

  let warning = '', creatorIsRookie = null;
  if (curated && requiresBungie) {
    try { const c = await syncPlayerActivities(env, a.userId, curated.id); creatorIsRookie = skillForClears(Object.values(c).reduce((s, n) => s + n, 0)) === 'rookie'; }
    catch (e) {
      if (!(e instanceof BungieApiError)) throw e;
      warning = a.rookieLimit != null ? ' Não consegui verificar seu histórico Bungie; você entrou como substituto.' : ' Não consegui verificar seu histórico Bungie; nenhum dado novo de progressão foi salvo.';
    }
  }
  const limitApplies = !!curated && requiresBungie, rl = a.rookieLimit ?? null, now = new Date().toISOString();
  const category = (limitApplies && rl != null && creatorIsRookie == null) || (limitApplies && creatorIsRookie === true && rl === 0) ? 'substituto' : 'titular';
  const ins = await db.prepare(`INSERT INTO activities (name, curated_bungie_activity_id, capacity, rookie_limit, starts_at, description, created_by_discord_id, created_at, discord_channel_id)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(name, curated?.id ?? null, a.integrantes, rl, startsAt.toISOString(), a.descricao ?? '', String(a.userId), now, env.LFG_CHANNEL_ID).run();
  const activityId = ins.meta.last_row_id;
  await db.prepare('INSERT INTO activity_participants (activity_id, discord_user_id, category, is_rookie, created_at) VALUES (?,?,?,?,?)')
    .bind(activityId, String(a.userId), category, creatorIsRookie == null ? null : creatorIsRookie ? 1 : 0, now).run();
  try {
    const msg = await postMessage(env, env.LFG_CHANNEL_ID, await publishPayload(env, activityId));
    await db.prepare('UPDATE activities SET discord_message_id = ? WHERE id = ?').bind(msg.id, activityId).run();
    return { activityId, name, warning, published: true };
  } catch (e) {
    console.error('publicar grade', e.message);
    return { activityId, name, warning, published: false };
  }
}

/* Entrar (titular), reserva ou sair (category null) — mesmo fluxo para os botões do Discord e para o /grade do DPI.
   Devolve o texto para quem clicou (ou null quando não há o que avisar). */
export async function applySignup(env, userId, activityId, category) {
  try {
    const act = await env.DB.prepare('SELECT * FROM activities WHERE id = ?').bind(activityId).first();
    if (!act) return 'Essa atividade não está mais disponível.';
    let warning = '', isRookie = null, requiresBungie = false;
    const curatedId = act.curated_bungie_activity_id, rookieLimit = act.rookie_limit;
    if (category !== null) {
      const c = curatedId != null ? await env.DB.prepare('SELECT eligibility_group g FROM curated_bungie_activities WHERE id = ?').bind(curatedId).first() : null;
      requiresBungie = curatedId != null && (!c || /^(raid|dungeon):/i.test(c.g));
      if (rookieLimit == null && requiresBungie && !env.BUNGIE_API_KEY) warning = 'A integração Bungie não está configurada; sua inscrição seguirá sem atualizar o histórico.';
      if (curatedId != null && requiresBungie && env.BUNGIE_API_KEY) {
        try { const counts = await syncPlayerActivities(env, userId, curatedId); isRookie = skillForClears(Object.values(counts).reduce((s, n) => s + n, 0)) === 'rookie'; }
        catch (e) { if (!(e instanceof BungieApiError)) throw e; if (rookieLimit == null) warning = 'A consulta Bungie falhou; sua inscrição foi mantida sem atualizar o histórico.'; }
      }
    }
    let result;
    if (category === null) result = await removeSignup(env.DB, activityId, userId);
    else result = await enroll(env.DB, activityId, userId, category, { isRookie, rookieLimitApplicable: curatedId != null && requiresBungie });
    if (category === null && result.activityDeleted) {
      try { if (result.messageId) await deleteMessage(env, result.channelId, result.messageId); }
      catch (e) { if (e instanceof DiscordError && e.status !== 404) return 'A grade foi excluída do banco, mas não consegui apagar a mensagem do Discord.'; }
      return result.message;
    }
    try { await refreshMessage(env, activityId); }
    catch (e) { console.error('editar mensagem', e?.message); return 'Sua inscrição foi processada, mas não consegui atualizar a mensagem da grade. Grades publicadas no layout anterior precisam ser recriadas para usar o embed.'; }
    const text = category === null ? result.message : result;
    if (category === null || text !== 'Inscrição atualizada como titular.') return warning ? `${text}\n${warning}` : text;
    return warning || null;
  } catch (e) {
    if (e instanceof SignupError) return e.message;
    console.error('inscrição', e?.stack || e);
    return 'Não foi possível atualizar a inscrição agora. Tente novamente.';
  }
}

/* Edição pelo criador (site): atualiza a grade, ajusta titulares/substitutos às vagas novas,
   atualiza a mensagem e avisa no #lfg-destiny marcando quem estava confirmado (titulares).
   in: { userId, activityId, atividade, integrantes, inicio, descricao, curatedId, rookieLimit } */
export async function editGrade(env, a) {
  const db = env.DB, tz = env.TIMEZONE || 'America/Sao_Paulo';
  const act = await db.prepare('SELECT * FROM activities WHERE id = ?').bind(a.activityId).first();
  if (!act) throw new ActivityInputError('Essa grade não está mais disponível.');
  if (act.created_by_discord_id !== String(a.userId)) throw new ActivityInputError('Só quem criou a grade pode editar.');
  let curated = null;
  if (a.curatedId != null) curated = await db.prepare('SELECT * FROM curated_bungie_activities WHERE id = ?').bind(a.curatedId).first();
  const startsAt = parseActivityStart(a.inicio, tz);
  if (startsAt.getTime() !== new Date(String(act.starts_at).replace(' ', 'T')).getTime()) validateActivityStart(startsAt);
  const name = validateActivityInput(a.atividade, a.integrantes, a.descricao ?? '', a.rookieLimit ?? null);
  const parts = (await db.prepare('SELECT * FROM activity_participants WHERE activity_id = ? ORDER BY created_at, id').bind(act.id).all()).results;
  const tit = parts.filter(p => p.category === 'titular'), subs = parts.filter(p => p.category === 'substituto');
  const confirmed = tit.map(p => p.discord_user_id);
  const stmts = [db.prepare('UPDATE activities SET name = ?, curated_bungie_activity_id = ?, capacity = ?, rookie_limit = ?, starts_at = ?, description = ? WHERE id = ?')
    .bind(name, curated?.id ?? null, a.integrantes, a.rookieLimit ?? null, startsAt.toISOString(), a.descricao ?? '', act.id)];
  // menos vagas: os últimos a entrar viram substitutos (o criador fica); mais vagas: sobem os substitutos mais antigos
  const over = tit.length - a.integrantes;
  if (over > 0) for (const p of tit.filter(p => p.discord_user_id !== act.created_by_discord_id).slice(-over)) stmts.push(db.prepare(`UPDATE activity_participants SET category = 'substituto' WHERE id = ?`).bind(p.id));
  else for (const p of subs.slice(0, -over)) stmts.push(db.prepare(`UPDATE activity_participants SET category = 'titular' WHERE id = ?`).bind(p.id));
  await db.batch(stmts);
  const ch = [], fmt = d => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  if (name !== act.name) ch.push(`atividade: **${name}**`);
  if (startsAt.toISOString() !== new Date(String(act.starts_at).replace(' ', 'T')).toISOString()) ch.push(`horário: **${fmt(startsAt)}**`);
  if (a.integrantes !== act.capacity) ch.push(`vagas: **${a.integrantes}**`);
  if ((a.rookieLimit ?? null) !== (act.rookie_limit ?? null)) ch.push(`novatos: **${a.rookieLimit ?? 'sem limite'}**`);
  if ((a.descricao ?? '') !== (act.description ?? '')) ch.push('descrição');
  let warning = '';
  if (act.discord_message_id) {
    try { await refreshMessage(env, act.id); } catch (e) { console.error('editar mensagem', e?.message); warning = ' Não consegui atualizar a mensagem da grade no Discord.'; }
    const notify = confirmed.filter(id => id !== act.created_by_discord_id);
    if (ch.length && notify.length) {
      try {
        await postMessage(env, act.discord_channel_id, { content: `✏️ <@${act.created_by_discord_id}> editou a grade **${name}** (${ch.join(', ')}). ${notify.map(id => `<@${id}>`).join(' ')}`,
          allowed_mentions: { users: [...new Set([act.created_by_discord_id, ...notify])] }, message_reference: { message_id: act.discord_message_id, fail_if_not_exists: false } });
      } catch (e) { console.error('aviso edição', e?.message); warning += ' Não consegui avisar os confirmados no Discord.'; }
    }
  }
  return { ok: true, changed: ch.length, notified: confirmed.filter(id => id !== act.created_by_discord_id).length, warning: warning.trim() };
}
