import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeDb } from './d1shim.js';
import { enroll, removeSignup, getRoster } from '../src/signups.js';
import { renderActivity, BUTTONS } from '../src/embed.js';
import { verifySignature } from '../src/discord.js';
import { signState, readState } from '../src/index.js';

let db;
const now = () => new Date().toISOString();
async function mkActivity({ capacity = 2, rookie = null, creator = '1' } = {}) {
  const r = await db.prepare(`INSERT INTO activities (name, capacity, rookie_limit, starts_at, description, created_by_discord_id, created_at) VALUES ('Raid', ?, ?, '2026-12-01T20:00:00.000Z', 'desc', ?, ?)`).bind(capacity, rookie, creator, now()).run();
  const id = r.meta.last_row_id;
  await db.prepare(`INSERT INTO activity_participants (activity_id, discord_user_id, category, created_at) VALUES (?,?, 'titular', ?)`).bind(id, creator, now()).run();
  return id;
}
const cats = async id => Object.fromEntries((await getRoster(db, id)).participants.map(p => [p.discord_user_id, p.category]));
const wait = () => new Promise(r => setTimeout(r, 3));

beforeEach(() => { db = makeDb(); });

describe('seed', () => {
  it('traz o catálogo curado', async () => {
    const n = await db.prepare('SELECT count(*) n FROM curated_bungie_activities').first();
    expect(n.n).toBe(45);
  });
});

describe('inscrições', () => {
  it('excedente vira substituto e é promovido quando abre vaga', async () => {
    const id = await mkActivity({ capacity: 2 });
    await enroll(db, id, '2', 'titular'); await wait();
    expect(await enroll(db, id, '3', 'titular')).toContain('substitutos');
    expect(await cats(id)).toEqual({ 1: 'titular', 2: 'titular', 3: 'substituto' });
    const r = await removeSignup(db, id, '2');
    expect(r.message).toContain('<@3> foi promovido');
    expect((await cats(id))['3']).toBe('titular');
  });
  it('limite de novatos manda novato extra para substitutos', async () => {
    const id = await mkActivity({ capacity: 6, rookie: 1 });
    await enroll(db, id, '2', 'titular', { isRookie: true });
    expect(await enroll(db, id, '3', 'titular', { isRookie: true })).toContain('limite de novatos');
    expect((await cats(id))['3']).toBe('substituto');
    expect(await enroll(db, id, '4', 'titular', { isRookie: false })).toBe('Inscrição atualizada como titular.');
  });
  it('sem classificação e com limite, entra como substituto', async () => {
    const id = await mkActivity({ capacity: 6, rookie: 2 });
    expect(await enroll(db, id, '2', 'titular', { isRookie: null })).toContain('Não foi possível verificar');
  });
  it('reserva não ocupa vaga e criador sozinho apaga a grade', async () => {
    const id = await mkActivity({ capacity: 1 });
    expect(await enroll(db, id, '2', 'reserva')).toContain('reservas');
    expect((await removeSignup(db, id, '2')).message).toBe('Inscrição removida.');
    const r = await removeSignup(db, id, '1');
    expect(r.activityDeleted).toBe(true);
    expect(await db.prepare('SELECT count(*) n FROM activities').first()).toEqual({ n: 0 });
  });
});

describe('embed', () => {
  it('mantém o layout da grade', async () => {
    const id = await mkActivity({ capacity: 6, rookie: 2 });
    await db.prepare(`INSERT INTO users (discord_user_id, bungie_name, bungie_membership_id, bungie_membership_type) VALUES ('1','Guardian*#1','9',3)`).run();
    const r = await getRoster(db, id);
    const e = renderActivity(r.activity, r.participants, { bungieNames: r.bungieNames, skills: r.skills, heroUrl: 'https://x/y.png' });
    expect(e.description).toBe('# Raid\n### <t:1796155200:F> (<t:1796155200:R>)'.replace('1796155200', String(Date.parse('2026-12-01T20:00:00Z') / 1000)));
    expect(e.fields.map(f => f.name)).toEqual(['​', '​', '​', 'Titulares 1/6 [2]', 'Substitutos 0', '​', 'Reservas']);
    expect(e.fields[1].value).toBe('_desc_');
    expect(e.fields[3].value).toBe('[ ❔ ] Guardian\\*#1 ( **<@1>** )');
    expect(e.image.url).toBe('https://x/y.png');
    expect(BUTTONS[0].components.map(c => c.custom_id)).toEqual(['orla:activity:join', 'orla:activity:leave', 'orla:activity:reserve']);
  });
});

describe('segurança', () => {
  it('verifica assinatura Ed25519 do Discord', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pub = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('hex');
    const body = '{"type":1}', ts = '1700000000';
    const sig = Buffer.from(await crypto.subtle.sign('Ed25519', kp.privateKey, new TextEncoder().encode(ts + body))).toString('hex');
    const req = (s) => new Request('http://x', { method: 'POST', headers: { 'X-Signature-Ed25519': s, 'X-Signature-Timestamp': ts }, body });
    expect(await verifySignature(req(sig), body, pub)).toBe(true);
    expect(await verifySignature(req(sig.replace(/^../, '00')), body, pub)).toBe(false);
    expect(await verifySignature(req(sig), body + ' ', pub)).toBe(false);
  });
  it('estado do OAuth é assinado e expira', async () => {
    const env = { DISCORD_CLIENT_SECRET: 's3' };
    const s = await signState(env, { m: { a: 1 }, t: 'fulano', e: Date.now() + 1000 });
    expect((await readState(env, s)).t).toBe('fulano');
    expect(await readState({ DISCORD_CLIENT_SECRET: 'outro' }, s)).toBe(null);
    expect(await readState(env, s.slice(0, -2) + 'xx')).toBe(null);
    expect(await readState(env, await signState(env, { e: Date.now() - 1 }))).toBe(null);
  });
});
