/* Inscrições nas grades (porte de activities/signups.py).
   D1 não tem transação interativa: lê o estado, decide e grava em um único batch (atômico). */
export class SignupError extends Error {}

const now = () => new Date().toISOString();
const one = (db, sql, ...b) => db.prepare(sql).bind(...b).first();

async function oldestSubstitute(db, activityId, exceptUser) {
  return one(db, `SELECT id, discord_user_id FROM activity_participants WHERE activity_id = ? AND category = 'substituto' AND discord_user_id != ? ORDER BY created_at, id LIMIT 1`, activityId, exceptUser ?? '');
}
const promote = (db, id) => db.prepare(`UPDATE activity_participants SET category = 'titular' WHERE id = ?`).bind(id);

export async function enroll(db, activityId, userId, category, { isRookie = null, rookieLimitApplicable = true } = {}) {
  if (category !== 'titular' && category !== 'reserva') throw new Error('Invalid participant category');
  const activity = await one(db, 'SELECT * FROM activities WHERE id = ?', activityId);
  if (!activity) throw new SignupError('Essa atividade não está mais disponível.');
  const participant = await one(db, 'SELECT * FROM activity_participants WHERE activity_id = ? AND discord_user_id = ?', activityId, userId);
  const rookieVal = isRookie == null ? null : isRookie ? 1 : 0;
  let actual = category, classificationUnavailable = false, rookieLimitFull = false, titularCount = 0;
  if (category === 'titular') {
    if (participant?.category === 'titular') {
      if (isRookie != null) await db.prepare('UPDATE activity_participants SET is_rookie = ? WHERE id = ?').bind(rookieVal, participant.id).run();
      return 'Você já está como integrante titular.';
    }
    titularCount = (await one(db, `SELECT count(*) n FROM activity_participants WHERE activity_id = ? AND category = 'titular'`, activityId)).n;
    if (activity.rookie_limit != null && rookieLimitApplicable && isRookie == null) {
      classificationUnavailable = true; actual = 'substituto';
    } else if (isRookie === true && activity.rookie_limit != null && rookieLimitApplicable) {
      const rc = (await one(db, `SELECT count(*) n FROM activity_participants WHERE activity_id = ? AND category = 'titular' AND is_rookie = 1`, activityId)).n;
      rookieLimitFull = rc >= activity.rookie_limit;
      if (rookieLimitFull) actual = 'substituto';
    }
    if (titularCount >= activity.capacity) {
      actual = 'substituto';
      if (participant?.category === 'substituto') return 'Você já está na fila de substitutos e mantém sua posição.';
    } else if (rookieLimitFull && participant?.category === 'substituto') {
      return 'Você já está na fila de substitutos e mantém sua posição.';
    }
  }
  const ts = now();
  if (!participant) {
    await db.prepare('INSERT INTO activity_participants (activity_id, discord_user_id, category, is_rookie, created_at) VALUES (?,?,?,?,?)').bind(activityId, userId, actual, rookieVal, ts).run();
  } else {
    const wasTitular = participant.category === 'titular';
    const stmts = [db.prepare('UPDATE activity_participants SET category = ?, is_rookie = ?, created_at = ? WHERE id = ?').bind(actual, rookieVal, ts, participant.id)];
    let promoted = null;
    if (wasTitular && actual !== 'titular') {
      promoted = await oldestSubstitute(db, activityId, userId);
      if (promoted) stmts.push(promote(db, promoted.id));
    }
    await db.batch(stmts);
    if (promoted) return `Inscrição atualizada; <@${promoted.discord_user_id}> foi promovido a titular.`;
  }
  if (actual === 'substituto') {
    if (classificationUnavailable) return 'Não foi possível verificar se você é novato; você entrou na fila de substitutos e será promovido quando abrir uma vaga.';
    if (rookieLimitFull && titularCount < activity.capacity) return 'O limite de novatos da grade foi preenchido. Você entrou na fila de substitutos e será promovido quando abrir uma vaga.';
    return 'Você entrou na fila de substitutos. Ao abrir uma vaga, será promovido automaticamente.';
  }
  if (actual === 'reserva') return 'Você entrou na lista de reservas. Essa lista não preenche vagas automaticamente.';
  return 'Inscrição atualizada como titular.';
}

export async function removeSignup(db, activityId, userId) {
  const activity = await one(db, 'SELECT * FROM activities WHERE id = ?', activityId);
  if (!activity) throw new SignupError('Essa atividade não está mais disponível.');
  const p = await one(db, 'SELECT * FROM activity_participants WHERE activity_id = ? AND discord_user_id = ?', activityId, userId);
  if (!p) return { message: 'Você não está inscrito nessa atividade.' };
  const wasTitular = p.category === 'titular';
  if (activity.created_by_discord_id === userId) {
    const remaining = (await one(db, 'SELECT count(*) n FROM activity_participants WHERE activity_id = ? AND id != ?', activityId, p.id)).n;
    if (remaining === 0) {
      await db.prepare('DELETE FROM activities WHERE id = ?').bind(activityId).run(); // participantes saem por CASCADE
      return { message: 'Você saiu e, como não havia outros participantes, a grade foi excluída.', activityDeleted: true, channelId: activity.discord_channel_id, messageId: activity.discord_message_id };
    }
  }
  const stmts = [db.prepare('DELETE FROM activity_participants WHERE id = ?').bind(p.id)];
  if (!wasTitular) { await db.batch(stmts); return { message: 'Inscrição removida.' }; }
  const next = await oldestSubstitute(db, activityId, userId);
  if (next) stmts.push(promote(db, next.id));
  await db.batch(stmts);
  return { message: next ? `Inscrição removida; <@${next.discord_user_id}> foi promovido da fila de substitutos.` : 'Inscrição removida. Não havia substituto para promover.' };
}

export async function getRoster(db, activityId) {
  const activity = await one(db, 'SELECT * FROM activities WHERE id = ?', activityId);
  if (!activity) throw new SignupError('Essa atividade não está mais disponível.');
  const participants = (await db.prepare('SELECT * FROM activity_participants WHERE activity_id = ? ORDER BY category, created_at, id').bind(activityId).all()).results;
  const ids = participants.map(p => p.discord_user_id);
  const bungieNames = {}, skills = {};
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    for (const r of (await db.prepare(`SELECT discord_user_id, bungie_name FROM users WHERE discord_user_id IN (${ph})`).bind(...ids).all()).results) bungieNames[r.discord_user_id] = r.bungie_name;
    if (activity.curated_bungie_activity_id != null) {
      const g = await one(db, 'SELECT eligibility_group g FROM curated_bungie_activities WHERE id = ?', activity.curated_bungie_activity_id);
      if (g) {
        const rows = (await db.prepare(`SELECT pa.user_discord_id u, pa.skill s FROM player_activities pa JOIN bungie_activities ba ON ba.bungie_id = pa.activity_bungie_id WHERE pa.user_discord_id IN (${ph}) AND ba.eligibility_group = ?`).bind(...ids, g.g).all()).results;
        for (const r of rows) skills[r.u] = r.s;
        for (const id of ids) skills[id] ??= 'unknown';
      }
    }
  }
  return { activity, participants, bungieNames, skills };
}
