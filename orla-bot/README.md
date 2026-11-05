# Orla Bot (dentro do DPI)

Bot de grades de atividade do clã, agora um **Cloudflare Worker** (`orla-bot`) com banco **D1 próprio `orla`** (separado do `dni`).
Funciona por *Interactions HTTP* (sem conexão de gateway), então roda 100% na Cloudflare.

- `src/index.js` – rotas, API do DPI, cron (limpa grades que começaram há mais de 1 h)
- `src/interactions.js` – `/orla grade`, `/orla registrar`, botões e modais (mesmo comportamento do bot em Python)
- `src/grades.js` – criação da grade (Discord e site usam o mesmo código); publica sempre no `#lfg-destiny`
- `src/embed.js`, `src/signups.js`, `src/rules.js`, `src/bungie.js`, `src/discord.js`
- `migrations/` – esquema (`0001`) e catálogo curado (`0002`)
- `legacy-python/` – bot antigo, só de referência (pode ser apagado após o corte)
- Testes: `npm test` (vitest; usa o `node:sqlite` para simular o D1)

## API para o site (CORS só do DPI; login = token Bungie)
`GET /me` · `POST /link/start` · `GET /link/callback` · `GET /activities?q=` · `POST /grades`

O botão **Registrar** do site pede o usuário do Discord e confirma por OAuth do Discord (scope `identify`);
só vincula se o usuário que entrou for o informado. O perfil Bungie vem do token no servidor, nunca do navegador.

## Corte (uma vez só)
1. **Segredos no GitHub** (Settings › Secrets › Actions): `DISCORD_APP_ID`, `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_SECRET`, `BUNGIE_API_KEY` (os `CLOUDFLARE_*` já existem).
2. Dar push: o workflow `orla-bot.yml` testa, cria o D1, aplica as migrações, publica, grava os segredos, registra os comandos e grava `data/orla.json` (endereço usado pelo site).
3. **Importar os dados atuais** (opcional, antes de trocar o endpoint):
   `python scripts/export-legacy.py caminho/orla.sqlite3 > legacy-import.sql` e `npx wrangler d1 execute orla --remote --file legacy-import.sql`.
4. No portal do Discord (aplicativo do bot):
   - **General Information › Interactions Endpoint URL** = `https://orla-bot.<subdominio>.workers.dev/discord/interactions` (o Discord valida na hora).
   - **OAuth2 › Redirects** = `https://orla-bot.<subdominio>.workers.dev/link/callback`.
5. **Pare o bot da Discloud.** Com o endpoint de Interactions ativo o gateway deixa de receber comandos e botões, então o corte é de uma vez só. As mensagens de grade já postadas continuam funcionando (mesmos `custom_id`).
6. A interface fica em **`/grade`** (rewrite no `vercel.json`) e só abre para membros do clã Orla Emaranhada (`CLAN_ID` no `wrangler.toml`, conferido na Bungie em todas as rotas); os demais veem página em branco. O menu Clã › Orla Bot só aparece para esses membros e leva para `/grade`.

## Diferenças em relação ao bot em Python
- `/orla grade` agora sempre publica no `#lfg-destiny` (`LFG_CHANNEL_ID`), não no canal onde o comando foi usado.
- A imagem do cabeçalho vem de URL pública (`HERO_URL`) em vez de anexo; o layout é o mesmo.
- O catálogo de atividades vem do seed (`0002_seed.sql`); a importação do manifesto da Bungie (`bungie/catalog.py`) não foi portada.
- Inscrições simultâneas no mesmo milissegundo não têm trava de linha (D1 não tem transação interativa).
