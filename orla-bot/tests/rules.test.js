import { describe, it, expect } from 'vitest';
import { parseActivityStart, validateActivityInput, validateActivityStart, skillForClears, ActivityInputError, parseDbDate, localToUtcMs } from '../src/rules.js';

describe('parseActivityStart', () => {
  it('aceita DD/mm/YY HH:MM em Brasília (UTC-3)', () => {
    expect(parseActivityStart('30/11/26 18:00').toISOString()).toBe('2026-11-30T21:00:00.000Z');
  });
  it('aceita DD/mm/YYYY e YYYY-mm-DD', () => {
    expect(parseActivityStart('30/11/2026 18:00').toISOString()).toBe('2026-11-30T21:00:00.000Z');
    expect(parseActivityStart('2026-11-30 18:00').toISOString()).toBe('2026-11-30T21:00:00.000Z');
  });
  it('aceita ISO com fuso e recusa ISO sem fuso', () => {
    expect(parseActivityStart('2026-11-30T21:00:00Z').toISOString()).toBe('2026-11-30T21:00:00.000Z');
    expect(() => parseActivityStart('2026-11-30T21:00:00')).toThrow(ActivityInputError);
  });
  it('recusa datas impossíveis e texto livre', () => {
    expect(() => parseActivityStart('30/02/26 18:99')).toThrow('não é válida');
    expect(() => parseActivityStart('amanhã')).toThrow('DD/mm/YY HH:MM');
  });
  it('detecta horário inexistente e ambíguo em fuso com horário de verão', () => {
    expect(() => localToUtcMs('America/New_York', 2026, 3, 8, 2, 30)).toThrow('não existe');
    expect(() => localToUtcMs('America/New_York', 2026, 11, 1, 1, 30)).toThrow('ambíguo');
  });
});

describe('validações', () => {
  it('limites de nome, integrantes, novatos e descrição', () => {
    expect(validateActivityInput('  Raid  ', 6, '')).toBe('Raid');
    expect(() => validateActivityInput('', 6, '')).toThrow('1 a 80');
    expect(() => validateActivityInput('x', 0, '')).toThrow('Integrantes');
    expect(() => validateActivityInput('x', 3, '', 4)).toThrow('novatos');
    expect(validateActivityInput('x', 3, '', 0)).toBe('x');
    expect(() => validateActivityInput('x', 3, 'a'.repeat(251))).toThrow('250');
  });
  it('início precisa ser futuro', () => {
    expect(() => validateActivityStart(new Date(Date.now() - 1000))).toThrow('futuras');
    expect(() => validateActivityStart(new Date(Date.now() + 60_000))).not.toThrow();
  });
  it('faixas de habilidade', () => {
    expect([0, 4, 5, 10, 11].map(skillForClears)).toEqual(['rookie', 'rookie', 'veteran', 'veteran', 'master']);
  });
  it('datas do banco antigo e novo', () => {
    expect(parseDbDate('2026-10-30 14:39:00.123456').toISOString()).toBe('2026-10-30T14:39:00.123Z');
    expect(parseDbDate('2026-10-30T14:39:00.000Z').toISOString()).toBe('2026-10-30T14:39:00.000Z');
  });
});
