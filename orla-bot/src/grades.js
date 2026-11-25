/* Criação de grade: mesmo fluxo para /orla grade (Discord) e para o formulário do DPI. */
import { ActivityInputError, parseActivityStart, validateActivityInput, validateActivityStart, skillForClears } from './rules.js';
import { BungieApiError, syncPlayerActivities } from './bungie.js';
import { getRoster, enroll, removeSignup, SignupError } from './signups.js';
import { renderActivity, BUTTONS } from './embed.js';
import { postMessage, editMessage, deleteMessage, DiscordError } from './discord.js';
import { notify as notify_, prefOn } from './push.js';

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
  const category = limitApplies && creatorIsRookie === true && rl === 0 ? 'reserva' : limitApplies && rl != null && creatorIsRookie == null ? 'substituto' : 'titular'; // novato acima do limite: reserva
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
  const rl = a.rookieLimit ?? null, limitApplies = !!curated && /^(raid|dungeon):/i.test(curated.eligibility_group);
  const actChanged = (curated?.id ?? null) !== (act.curated_bungie_activity_id ?? null);
  // reavalia novato/veterano: atividade nova = consulta todos; limite de novatos = consulta quem ainda não tem classificação
  const rookie = Object.fromEntries(parts.map(p => [p.discord_user_id, p.is_rookie == null ? null : !!p.is_rookie])), rkStmts = [];
  if (limitApplies && env.BUNGIE_API_KEY) {
    for (const p of parts) {
      if (!actChanged && !(rl != null && rookie[p.discord_user_id] == null)) continue;
      let v = null;
      try { const c = await syncPlayerActivities(env, p.discord_user_id, curated.id); v = skillForClears(Object.values(c).reduce((s2, n) => s2 + n, 0)) === 'rookie'; }
      catch (e) { if (!(e instanceof BungieApiError)) throw e; }
      rookie[p.discord_user_id] = v; rkStmts.push(db.prepare('UPDATE activity_participants SET is_rookie = ? WHERE id = ?').bind(v == null ? null : v ? 1 : 0, p.id));
    }
  } else if (actChanged) for (const p of parts) if (p.is_rookie != null) { rookie[p.discord_user_id] = null; rkStmts.push(db.prepare('UPDATE activity_participants SET is_rookie = NULL WHERE id = ?').bind(p.id)); }
  // titulares de novo, pela ordem: quem criou, titulares (ordem de entrada) e depois substitutos (ordem de entrada); reserva não muda
  const byIn = c => parts.filter(p => p.category === c && p.discord_user_id !== act.created_by_discord_id);
  const me = parts.find(p => p.discord_user_id === act.created_by_discord_id && p.category !== 'reserva');
  const pool = [...(me ? [me] : []), ...byIn('titular'), ...byIn('substituto')];
  const down = [], up = [], res = [], why = {}; let nT = 0, nR = 0;
  for (const p of pool) {
    const rk = rookie[p.discord_user_id], gated = limitApplies && rl != null && (rk == null || (rk && nR >= rl));
    const to = nT < a.integrantes && !gated ? 'titular' : gated && rk === true ? 'reserva' : 'substituto'; // novato acima do limite vai para a reserva
    if (to === 'titular') { nT++; if (rk) nR++; }
    if (to !== p.category) { (to === 'titular' ? up : to === 'reserva' ? res : down).push(p.discord_user_id); why[p.discord_user_id] = to === 'titular' ? '' : nT >= a.integrantes && !gated ? 'vagas' : rk == null ? 'sem histórico' : 'novatos'; rkStmts.push(db.prepare('UPDATE activity_participants SET category = ? WHERE id = ?').bind(to, p.id)); }
  }
  const stmts = [db.prepare('UPDATE activities SET name = ?, curated_bungie_activity_id = ?, capacity = ?, rookie_limit = ?, starts_at = ?, description = ? WHERE id = ?')
    .bind(name, curated?.id ?? null, a.integrantes, rl, startsAt.toISOString(), a.descricao ?? '', act.id), ...rkStmts];
  const oldStart = new Date(String(act.starts_at).replace(' ', 'T')), timeChanged = startsAt.getTime() !== oldStart.getTime();
  if (timeChanged) stmts.push(db.prepare('DELETE FROM push_sent WHERE k LIKE ?').bind(`grade:${act.id}:%`)); // horário novo: o aviso de 30 min vale de novo
  await db.batch(stmts);
  // o que mudou, com o antes e o depois (mesmo texto no Discord e no celular)
  const ch = [], fmt = d => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  if (name !== act.name) ch.push(['atividade', act.name, name]);
  if (timeChanged) ch.push(['horário', fmt(oldStart), fmt(startsAt)]);
  if (a.integrantes !== act.capacity) ch.push(['vagas', act.capacity, a.integrantes]);
  if ((a.rookieLimit ?? null) !== (act.rookie_limit ?? null)) ch.push(['novatos', act.rookie_limit ?? 'sem limite', a.rookieLimit ?? 'sem limite']);
  if ((a.descricao ?? '') !== (act.description ?? '')) ch.push(['descrição']);
  const line = (bold) => ch.map(([k, x, y]) => y === undefined ? `${k} nova` : `${k}: ${x} → ${bold ? `**${y}**` : y}`).join(' · ');
  // avisa todos os inscritos (titulares, substitutos e reserva), menos quem editou
  const notify = parts.map(p => p.discord_user_id).filter(id => id !== act.created_by_discord_id);
  let warning = '';
  if (act.discord_message_id) {
    try { await refreshMessage(env, act.id); } catch (e) { console.error('editar mensagem', e?.message); warning = ' Não consegui atualizar a mensagem da grade no Discord.'; }
    if ((ch.length || down.length || up.length || res.length) && notify.length) {
      const m = id => `<@${id}>`, rs = { vagas: 'menos vagas', novatos: 'limite de novatos', 'sem histórico': 'sem histórico Bungie' };
      const extra = [down.length ? `\nViraram substitutos: ${down.map(id => `${m(id)} (${rs[why[id]] || why[id]})`).join(', ')}` : '', res.length ? `\nForam para a reserva (limite de novatos): ${res.map(m).join(' ')}` : '', up.length ? `\nSubiram para titular: ${up.map(m).join(' ')}` : ''].join('');
      try {
        await postMessage(env, act.discord_channel_id, { content: `✏️ <@${act.created_by_discord_id}> editou a grade **${name}**${ch.length ? `\n${line(true)}` : ''}${extra}\nInscritos: ${notify.map(m).join(' ')}`,
          allowed_mentions: { users: [...new Set([act.created_by_discord_id, ...notify])] }, message_reference: { message_id: act.discord_message_id, fail_if_not_exists: false } });
      } catch (e) { console.error('aviso edição', e?.message); warning += ' Não consegui avisar os inscritos no Discord.'; }
    }
  }
  // no celular: quem ativou os avisos de grade no DPI
  if ((ch.length || down.length || up.length || res.length) && notify.length) {
    try {
      const subsP = (await db.prepare(`SELECT endpoint, prefs, discord_user_id d FROM push_subs WHERE discord_user_id IN (${notify.map(() => '?').join(',')})`).bind(...notify).all()).results.filter(s => prefOn(s, 'grade'));
      for (const s of subsP) {
        const mv = down.includes(s.d) ? ` Você virou substituto (${{ vagas: 'menos vagas', novatos: 'limite de novatos', 'sem histórico': 'sem histórico Bungie' }[why[s.d]]}).` : res.includes(s.d) ? ' Você foi para a reserva (limite de novatos).' : up.includes(s.d) ? ' Você subiu para titular.' : '';
        await notify_(env, s.endpoint, { title: `Grade alterada: ${name}`, body: `${line(false) || 'Inscritos reorganizados.'}${mv}`, url: '/grade', tag: `grade-edit-${act.id}` }).catch(() => {});
      }
    } catch (e) { console.error('push edição', e?.message); }
  }
  return { ok: true, changed: ch.length + down.length + up.length + res.length, notified: notify.length, warning: warning.trim() };
}
