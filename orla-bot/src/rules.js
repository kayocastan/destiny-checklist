/* Regras de entrada e horário das grades (porte de activities/service.py). */
export class ActivityInputError extends Error {}

const LOCAL_PATTERNS = [
  [/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/, [0, 1, 2, 3, 4]],
  [/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/, [2, 1, 0, 3, 4]],
  [/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/, [2, 1, 0, 3, 4]],
];

// deslocamento (ms) do fuso em um instante UTC
export function tzOffsetMs(tz, utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(Math.floor(utcMs / 1000) * 1000)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000;
}

// hora local -> instante UTC (ms); recusa horário inexistente ou ambíguo (mudança de fuso)
export function localToUtcMs(tz, y, mo, d, h, mi) {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offs = new Set([tzOffsetMs(tz, asUtc - 864e5), tzOffsetMs(tz, asUtc + 864e5)]);
  const valid = [...offs].map(o => asUtc - o).filter(u => tzOffsetMs(tz, u) === asUtc - u);
  if (!valid.length) throw new ActivityInputError('Esse horário local não existe por causa da mudança de fuso horário.');
  if (new Set(valid).size > 1) throw new ActivityInputError('Esse horário é ambíguo no fuso local; informe a data em ISO 8601 com deslocamento UTC.');
  return valid[0];
}

export function parseActivityStart(value, tz = 'America/Sao_Paulo') {
  const v = String(value ?? '').trim();
  for (const [re, ix] of LOCAL_PATTERNS) {
    const m = re.exec(v);
    if (!m) continue;
    const n = m.slice(1).map(Number);
    let year = n[ix[0]];
    if (m[ix[0] + 1].length === 2) year += year <= 68 ? 2000 : 1900;
    const [mo, d, h, mi] = [n[ix[1]], n[ix[2]], n[ix[3]], n[ix[4]]];
    const chk = new Date(Date.UTC(year, mo - 1, d, h, mi));
    if (chk.getUTCFullYear() !== year || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d || h > 23 || mi > 59) throw new ActivityInputError('A data ou hora informada não é válida.');
    return new Date(localToUtcMs(tz, year, mo, d, h, mi));
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    throw new ActivityInputError(/^\d{4}-\d{2}-\d{2}T/.test(v) ? 'Formato de início inválido. Use um dos formatos informados ou ISO 8601 com fuso explícito.' : 'Use o formato DD/mm/YY HH:MM.');
  }
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new ActivityInputError('Use o formato DD/mm/YY HH:MM.');
  return new Date(t);
}

export function validateActivityInput(name, capacity, description, rookieLimit = null) {
  const n = String(name ?? '').trim();
  if (!n || n.length > 80) throw new ActivityInputError('Atividade deve conter de 1 a 80 caracteres.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 99) throw new ActivityInputError('Integrantes deve ser um número entre 1 e 99.');
  if (rookieLimit != null && (!Number.isInteger(rookieLimit) || rookieLimit < 0 || rookieLimit > capacity)) throw new ActivityInputError('A quantidade de novatos deve ser 0 ou um número entre 1 e a quantidade de integrantes.');
  if ((description ?? '').length > 250) throw new ActivityInputError('Descrição deve ter no máximo 250 caracteres.');
  return n;
}

export function validateActivityStart(startsAt, now = Date.now()) {
  if (startsAt.getTime() <= now) throw new ActivityInputError('A data e hora de início precisam ser futuras; não é possível criar uma atividade no passado.');
}

export function skillForClears(n) { return n < 5 ? 'rookie' : n <= 10 ? 'veteran' : 'master'; }

// datas do banco: ISO UTC; importadas do SQLite antigo vêm como 'YYYY-MM-DD HH:MM:SS(.ffffff)'
export function parseDbDate(s) {
  const t = String(s);
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t.replace(' ', 'T') : t.replace(' ', 'T') + 'Z');
}
