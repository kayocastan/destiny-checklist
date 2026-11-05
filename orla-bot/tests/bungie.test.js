import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeDb } from './d1shim.js';
import { syncPlayerActivities, BungieApiError } from '../src/bungie.js';
import { renderActivity } from '../src/embed.js';

const env = { BUNGIE_API_KEY: 'k', SITE_URL: 'https://site' };
let db;

function stubBungie(aggregate) {
  vi.stubGlobal('fetch', vi.fn(async url => {
    const u = String(url);
    let Response_;
    if (u.includes('/LinkedProfiles/')) Response_ = { profiles: [{ membershipType: 3, membershipId: '1' }] };
    else if (u.includes('components=Profiles')) Response_ = { profile: { data: { characterIds: ['10'] } } };
    else Response_ = aggregate;
    return new Response(JSON.stringify({ ErrorCode: 1, Response: Response_ }), { status: 200 });
  }));
}

async function setup() {
  db = makeDb();
  await db.prepare(`INSERT INTO users (discord_user_id, discord_member_name, bungie_membership_id, bungie_membership_type, bungie_name, linked_at) VALUES ('1','u','1',3,'Guardian#1234','x')`).run();
  return (await db.prepare('SELECT id FROM curated_bungie_activities WHERE type = ? LIMIT 1').bind('Raid').first()).id;
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('syncPlayerActivities', () => {
  it('0 conclusões (hash ausente na resposta) vira rookie, sem erro', async () => {
    const curatedId = await setup();
    stubBungie({ activities: [{ activityHash: 999999999, values: { activityCompletions: { basic: { value: 3 } } } }] });
    const out = await syncPlayerActivities({ ...env, DB: db }, '1', curatedId);
    expect(Object.values(out).every(v => v === 0)).toBe(true);
    const rows = (await db.prepare('SELECT skill, clear_count FROM player_activities WHERE user_discord_id = ?').bind('1').all()).results;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.skill === 'rookie' && r.clear_count === 0)).toBe(true);
  });

  it('resposta em formato inválido continua sendo erro', async () => {
    const curatedId = await setup();
    stubBungie({ activities: 'nope' });
    await expect(syncPlayerActivities({ ...env, DB: db }, '1', curatedId)).rejects.toThrow(BungieApiError);
  });
});

describe('emojis', () => {
  const act = { name: 'Raid', capacity: 6, starts_at: '2026-12-01T20:00:00.000Z', description: '' };
  const p = id => ({ discord_user_id: id, category: 'titular' });
  it('rookie = 👶 e erro/desconhecido = ⚠️', () => {
    const e = renderActivity(act, [p('1'), p('2')], { bungieNames: { 1: 'A#1', 2: 'B#2' }, skills: { 1: 'rookie', 2: 'unknown' } });
    const v = e.fields.find(f => f.name.startsWith('Titulares')).value;
    expect(v).toContain('[ 👶 ] A#1');
    expect(v).toContain('[ ⚠️ ] B#2');
  });
});
