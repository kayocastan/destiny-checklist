/* Criação de grade: mesmo fluxo para /orla grade (Discord) e para o formulário do DPI. */
import { ActivityInputError, parseActivityStart, validateActivityInput, validateActivityStart, skillForClears } from './rules.js';
import { BungieApiError, syncPlayerActivities } from './bungie.js';
import { getRoster } from './signups.js';
import { renderActivity, BUTTONS } from './embed.js';
import { postMessage, editMessage } from './discord.js';

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
  const requiresBungie = !!curated && curated.eligibility_group !== 'orla:0';
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
