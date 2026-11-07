// Registra /orla grade, /orla agenda e /orla registrar na guilda (substitui o conjunto atual). Uso:
//   DISCORD_TOKEN=... DISCORD_APP_ID=... DISCORD_GUILD_ID=... node scripts/register-commands.mjs
const { DISCORD_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_APP_ID || !DISCORD_GUILD_ID) throw new Error('Defina DISCORD_TOKEN, DISCORD_APP_ID e DISCORD_GUILD_ID');

import { commands } from '../src/commands.js';


const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`, {
  method: 'PUT', headers: { Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands),
});
console.log(r.status, (await r.text()).slice(0, 300));
if (!r.ok) process.exit(1);
