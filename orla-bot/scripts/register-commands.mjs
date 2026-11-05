// Registra /orla grade e /orla registrar na guilda (substitui o conjunto atual). Uso:
//   DISCORD_TOKEN=... DISCORD_APP_ID=... DISCORD_GUILD_ID=... node scripts/register-commands.mjs
const { DISCORD_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_APP_ID || !DISCORD_GUILD_ID) throw new Error('Defina DISCORD_TOKEN, DISCORD_APP_ID e DISCORD_GUILD_ID');

export const commands = [{
  name: 'orla', description: 'Comandos do bot Orla', type: 1,
  options: [
    { type: 1, name: 'grade', description: 'Configura uma atividade do clã', options: [
      { type: 3, name: 'atividade', description: 'Escolha uma sugestão ou digite um título livre (até 80 caracteres)', required: true, autocomplete: true, min_length: 1, max_length: 80 },
      { type: 4, name: 'integrantes', description: 'Escolha 3, 4, 6 ou 12 integrantes', choices: [3, 4, 6, 12].map(n => ({ name: String(n), value: n })) },
      { type: 3, name: 'inicio', description: 'Use o formato DD/mm/YY HH:MM', min_length: 1, max_length: 40 },
      { type: 3, name: 'descricao', description: 'Informações adicionais (até 250 caracteres)', max_length: 250 },
      { type: 4, name: 'novatos', description: 'Quantidade máxima de novatos titulares (opcional)', min_value: 0, max_value: 99 },
    ] },
    { type: 1, name: 'registrar', description: 'Vincula seu Bungie Name à sua conta Discord', options: [
      { type: 3, name: 'player_bungie_id', description: 'Seu Bungie Name completo, no formato Nome#1234', required: true, min_length: 6, max_length: 30 },
    ] },
  ],
}];

const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`, {
  method: 'PUT', headers: { Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands),
});
console.log(r.status, (await r.text()).slice(0, 300));
if (!r.ok) process.exit(1);
