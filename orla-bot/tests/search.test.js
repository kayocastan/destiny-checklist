import { describe, it, expect } from 'vitest';
import { makeDb } from './d1shim.js';
import { catalog, searchActivities, matchActivity } from '../src/search.js';

describe('busca do catálogo', async () => {
  const c = await catalog(makeDb());
  const top = q => searchActivities(c, q, 3).map(a => a.name);
  it('ignora artigo, acento e erro de digitação', () => {
    expect(top('O fim de crota')[0]).toBe('Fim de Crota: Normal');
    expect(top('equilíbro')).toEqual(['Equilíbrio: Normal']);
    expect(top('Jardim da salvaçao')).toEqual(['Jardim da Salvação']);
  });
  it('aceita nome em inglês e siglas', () => {
    expect(top('kings fall')[0]).toMatch(/^Queda do Rei/);
    expect(top('dsc')).toEqual(['Cripta da Pedra Profunda']);
  });
  it('liga título livre ao catálogo só sem dúvida', () => {
    expect(matchActivity(c, 'o fim de crota')?.name).toBe('Fim de Crota: Normal');
    expect(matchActivity(c, 'queda do rei mestre')?.name).toBe('Queda do Rei: Mestre');
    expect(matchActivity(c, 'crota')).toBeNull();
    expect(matchActivity(c, 'Sala de treino')).toBeNull();
  });
});

describe('missões exóticas no catálogo', async () => {
  const c = await catalog(makeDb());
  it('acha pelo nome em português, em inglês e liga o título digitado', () => {
    expect(searchActivities(c, 'heliostato', 2)[0].name).toBe('Missão exótica: Heliostato');
    expect(searchActivities(c, 'zero hour', 2)[0].name).toBe('Missão exótica: Hora Zero');
    expect(matchActivity(c, 'hora zero')?.name).toBe('Missão exótica: Hora Zero');
  });
});
