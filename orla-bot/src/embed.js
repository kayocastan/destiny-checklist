/* Mensagem da grade: mesmo layout do bot em Python (activities/view.py). */
import { parseDbDate } from './rules.js';

const SKILL_EMOJI = { rookie: '👶', veteran: '🎖️', master: '🧙‍♂️', unknown: '⚠' };
const SP = '​';

export const escapeMarkdown = s => String(s).replace(/([\\*_~|`>])/g, '\\$1');
export const escapeMentions = s => String(s).replace(/@/g, '@​');

// três botões persistentes (mesmos custom_id e emojis do bot atual)
export const BUTTONS = [{
  type: 1,
  components: [
    { type: 2, style: 2, custom_id: 'orla:activity:join', emoji: { name: 'plus', id: '965116109164511333' } },
    { type: 2, style: 2, custom_id: 'orla:activity:leave', emoji: { name: 'minus', id: '965116109416181760' } },
    { type: 2, style: 2, custom_id: 'orla:activity:reserve', emoji: { name: 'question', id: '965116109114183732' } },
  ],
}];

export function renderActivity(activity, participants, { bungieNames = {}, skills = {}, heroUrl = '' } = {}) {
  const ts = Math.floor(parseDbDate(activity.starts_at).getTime() / 1000);
  const display = p => {
    const bn = bungieNames[p.discord_user_id];
    const emoji = SKILL_EMOJI[skills[p.discord_user_id] ?? ''] ?? '❔';
    const name = bn ? escapeMentions(escapeMarkdown(bn)) : 'Bungie ID não vinculado';
    return `[ ${emoji} ] ${name} ( **<@${p.discord_user_id}>** )`;
  };
  const by = c => participants.filter(p => p.category === c);
  const titular = by('titular').map(display), subs = by('substituto').map(display), reserve = by('reserva').map(display);
  const rl = activity.rookie_limit != null ? ` [${activity.rookie_limit}]` : '';
  const embed = {
    description: `# ${activity.name}\n### <t:${ts}:F> (<t:${ts}:R>)`,
    color: 0x5865f2,
    fields: [
      { name: SP, value: '------ ------ ------', inline: false },
      { name: SP, value: activity.description ? `_${activity.description}_` : SP, inline: false },
      { name: SP, value: '------ ------ ------', inline: false },
      { name: `Titulares ${titular.length}/${activity.capacity}${rl}`, value: titular.join('\n') || '-', inline: true },
      { name: `Substitutos ${subs.length}`, value: subs.join('\n') || '-', inline: true },
      { name: SP, value: SP, inline: false },
      { name: 'Reservas', value: reserve.join('\n') || '-', inline: false },
    ],
  };
  if (heroUrl) embed.image = { url: heroUrl };
  return embed;
}
