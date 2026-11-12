# DPI · Destiny Parallel Interface: backup do projeto (04/11/2026)

Resumo do estado do site, das decisões e do que está pendente, para retomar o trabalho em qualquer sessão.

## 1. Onde fica cada coisa

| Item | Onde |
|---|---|
| Site | https://destinyparallel.vercel.app (antigo: dni-site) |
| Repositório | GitHub `kayocastan/destiny-checklist` (branch `main`, último commit `a894278`) |
| Deploy do site | Vercel: push no `main` publica sozinho em ~1 min |
| Servidor (API) | Cloudflare Worker `dni-api` → https://dni-api.dni-site.workers.dev, publicado pelo GitHub Actions a cada push que mexe em `worker/` (aplica as migrações do D1 sozinho) |
| Banco | Cloudflare D1 `dni` (plano pago do Workers, renova dia 29) |
| Dono do site | conta Bungie `9967831` (Kayo Castan#4712), variável `OWNER` no worker |
| Clã | Orla Emaranhada (groupId `5280120`) |

### Stack real (importante)
O site é **HTML/JS/CSS puros**, sem framework: `index.html` + `app.js` (arquivo grande, tudo dentro de uma IIFE) + `site.css` + `styles.css` + `sw.js`. As funções serverless da Vercel ficam em `api/` (`config.js`, `callback.js`, `refresh.js`, `_bungie.js`: OAuth da Bungie e chave da API). Dados estáticos ficam em `data/` (`defs.json`, `items.json`, `changelog.json`, `api.json`). O manifesto da Bungie é baixado pelo navegador direto do CDN da Bungie e guardado em IndexedDB, e o worker tem `/defs` como cache de definições.

## 2. Mapa do site (abas)

| Grupo | Subabas | Destaques |
|---|---|---|
| Hoje | Principal, Desafios | painel único "Esta semana para você" com o seletor **Como você vai jogar?** (Sozinho/Até 3/Grupo de 6, padrão Sozinho) e a rotação da semana numa coluna; missão da semana em cartão discreto; Sua última sessão; Foco; Metas de build |
| Progresso | Atividades, Títulos e triunfos, Colecionáveis | incursões, masmorras, campanhas, missões exóticas; "Ver onde" → bray.tech/maps |
| Arsenal | Inventário (Personagens/Cofre), Coleção, Vendedores, Loadouts | rolos bons (voltron), etiquetas, **travar no jogo** (cadeado, "Travar rolos bons" em lote, "Manter" trava junto), detalhe do item com descrição de vantagens/mods (toque individual), **trocar mod de armadura**, montagem de build + otimizador, **Aplicar** e **Gravar no jogo** (nome/cor/ícone do loadout; equipa, grava e volta ao que estava), **Equipar** nos cartões dos loadouts do jogo |
| Guardião | Builds, Relatórios, Estatísticas | evolução (histórico do DPI, não da Bungie), patente |
| Clã | Membros, Placar, Grupos, **Administração**, **Discord do clã** | ver seção 4 |

### Ações na conta (escrita via API da Bungie)
- Equipar/mover/postmaster, inserir plug (`InsertSocketPlugFree`), travar (`SetLockState`), loadouts (`EquipLoadout`, `SnapshotLoadout` com color/icon/nameHash), clã (`Approve`, `DenyList`, `Kick`, `SetMembershipType`).
- Regras do aplicar build:
  1. Comuns de uma vez, exóticos um a um, trocando antes o exótico antigo por um comum.
  2. Build com dois exóticos do mesmo tipo vira um só.
  3. Subclasse e mods "do zero": esvazia os encaixes que vão mudar, aspectos antes dos fragmentos.
  4. Pula o que a conta não tem liberado e lista pelo nome.
  5. Pula fragmento em encaixe bloqueado.
  6. Erro 1618 tenta de novo sozinho.
  7. A conferência relê até 4× com 2,5 s de intervalo (a Bungie demora para refletir).
  8. Etapa parcial aparece como "parcial".
- Não grava loadout se a build não ficou completa.
- "Cópia" de build de outra pessoa não completa com um segundo exótico.

## 3. Servidor (worker) e banco

### Rotas
`/defs`, `/sync` (favoritos, builds, opções, tags, notas, evo…), `/hit`, `/stats` (painel /status do dono), `/whoami`, `/pub`, `/pub/<código>`, `/pubimg/`, `/page/`, `/gpage/` (links públicos de build e guardião), `/sug`, `/sug/read` (sugestões), `/clan/notice` (aviso dos admins), `/clan/hours` (mapa de horários), `/clan/social` e `/clan/social/backfill` (Quem joga com quem).

### Tabelas (D1, migrações em `worker/migrations`)
- `0001` a `0006`: kv (sync e estado por uid), meta (freio de gastos, `bkey` = chave pública da API), visit, pub, sug, pubimg.
- `0007_social.sql`:
  - `soc_on (g, mid, d, n, wc)`: unidades de 15 min online / com o clã por dia;
  - `soc_pair (g, a, b, d, n)`: duplas no mesmo esquadrão.

### Cron (Cloudflare, `17 * * * *`)
- Freio de gastos.
- Mapa de horários do clã: membros online a cada hora.
- **Quem joga com quem:**
  - a partir das 5h (Brasília) lê o histórico de partidas do dia anterior de cada membro, um clã por rodada;
  - abre o relatório (PGCR) só das partidas em que 2 ou mais membros aparecem;
  - marca d'água por clã em kv `socw`; recupera até 3 dias se falhar.
- Só entram clãs com uso do site nos últimos 30 dias.
- A foto de 15 em 15 min foi **desligada** (trocada pela leitura diária).

### Custos (estimados)
Tudo bem abaixo do incluído no plano pago do Cloudflare. A Vercel não muda. A etapa Discord por foto de 15 min, se feita, também fica perto de 0,1% das gravações incluídas.

## 4. Clã: o que existe

- **Membros:**
  - aviso dos admins (edita quem é admin, some na data);
  - Clã ao vivo;
  - lista com 12 e o botão "Ver todos";
  - mapa "Quando o clã está online" (lido pelo servidor);
  - aniversários de clã, com 🎂 no dia.
- **Placar:** categorias com líder, por atividade, Sempre/Semana, ativos em 30 dias, pódio, ▲▼, "Você", destaques, clã somado.
- **Grupos:** primeira vez, comparativos.
- **Administração** (só dono do site, fundador e admins):
  - Revisão de inativos 30/60/90, com alerta amarelo;
  - **Quem joga com quem (BETA):**
    - abas Todos, Mais enturmados e Mais isolados;
    - ordenar por Online, Com o clã (h), % e Parceiros;
    - busca e detalhe por pessoa;
    - 30 dias por padrão; histórico importado desde 05/10/2026;
  - **Entrada no clã:** pedidos (precisa "Entrar de novo" uma vez pela permissão de admin), promoções sugeridas, novatos;
  - Guias por atividade (só atividades em que a Bungie conta "Guiados": todas as incursões + Vésper, Doutrina Apartada, Equilíbrio), com "Copiar grupo de primeira vez".
- **Discord do clã:** aba em preparação, ver seção 6.

## 5. Jeito de trabalhar (combinados)

- Responder sempre em **PT-BR**.
- **Mockup primeiro** (canvases Design), depois implementar "o mais fiel possível".
- Mudanças grandes de visual podem ir antes para **/beta**: só o dono vê; a flag `BETA` vira `FX` ao liberar.
- Carregamento leve; evitar peso no banco.
- **Imagem de novidades: só uma vez por semana**, junto da tarefa agendada de sábado. Não gerar por atualização.
- Rodapé dos commits:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011EvwNF2x2bsRuBMwFwjBEs
  ```
- Nunca digitar senha/credenciais do usuário (ele entra sozinho).
- Não executar ações na conta dele sem pedido, e pedir antes de qualquer coisa destrutiva.
- Conferir conflitos de nomes de classe CSS/JS ao criar painéis novos. Já houve conflito com `lbd-*` da montagem de build e com `td-*` do "O que fazer hoje" (renomeado para `tdo-*`).

## 6. Pendências

1. **Discord do clã (etapa 2):** o dono cria o bot "DPI" em discord.com/developers:
   1. criar o aplicativo;
   2. ligar o Server Members Intent;
   3. gerar o token e guardar como segredo do worker;
   4. gerar o link OAuth2 "bot" com Ver canais + Ler histórico.

   Depois disso: botão "Adicionar ao servidor", escolha de canais, pares Discord ⇄ Bungie, mensagens contadas a cada 15 min por REST e calls por foto de 15 min. Painel "Participação no Discord" (mockup no canvas do clã, quadros 9 e 10).
2. **Conferir a primeira leitura diária** do Quem joga com quem (agendado para 05/11, 9h).
3. **Pedidos para entrar** precisam que o admin clique "Entrar de novo" uma vez.

## 7. Tarefas agendadas

- **"Novidades da semana do DPI"**:
  - roda sábado às 9h34 (Brasília), aprovação automática;
  - atualiza `data/changelog.json` (/novidades);
  - gera a imagem da semana como quadro novo no canvas de novidades;
  - entrega o post para o Discord.
- **"Conferir leitura diária do Quem joga com quem"**: lembrete único, 05/11 às 9h.

## 8. Canvases (claude.ai)

- Novidades (imagens): `Pcm8XVnUkuwcLoAYqpBJWs`
- Inventário, cofre e clã (inclui Administração, Quem joga com quem, Discord): `FD7wih2bZymXgnxGPz68KV`
- Navegação, colecionáveis e desafios: `BfqPeEinyGaAod2XKBCEUE`
- O que fazer hoje, rolos e evolução (inclui o painel único de Hoje): `DrFBgrjVWcJFXx1yrW4LWp`

## Testes antes de publicar
- `node tests/smoke.mjs` abre o site com perfis simulados (sem login, membro, admin, admin por outra plataforma, celular, login vencido, aba antiga guardada, /grade) e falha se alguma tela ficar em branco ou der erro de JavaScript.
- Rodar SEMPRE antes de `git push` quando mexer em app.js, index.html, site.css ou guias.html. O GitHub também roda a cada envio (workflow "Testes do site").
- Erros reais dos visitantes: `GET /err` no servidor do DPI (só o dono), últimos 300.
- Se um bug novo escapar, acrescente um cenário em tests/smoke.mjs que reproduza o bug antes de corrigir.
