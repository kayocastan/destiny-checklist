/* Destiny Checklist — lê a conta Bungie.net da pessoa e monta o checklist.
   Tudo roda no navegador; o servidor só troca o código do login pelos tokens. */
(() => {
'use strict';
const API = 'https://www.bungie.net/Platform';
const QUEST_BUCKET = 1345459588;
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- textos da interface ---------- */
const UI = {
  pt: {
    hide: 'Ocultar feitos', search: 'Buscar por nome ou origem', refresh: 'Atualizar', logout: 'Sair',
    disclaimer: 'Dados lidos da sua conta pela API oficial da Bungie. Este site não é afiliado à Bungie.',
    loadouts: 'Loadouts', checklist: 'Checklist',
    tabs: { obj: 'Objetivos', act: 'Atividades', drops: 'Arsenal', gd: 'Guardião' },
    subs: { camp: 'Campanhas', raid: 'Incursões', dg: 'Masmorras', tit: 'Títulos', exo: 'Exóticos', cat: 'Catalisadores', vend: 'Vendedores' },
    heroTitle: 'Seu checklist de Destiny 2', heroText: 'Entre com a sua conta Bungie.net para ver o que falta: exóticos, catalisadores, títulos, incursões, masmorras e campanhas, do mais fácil para o mais difícil.',
    heroList: ['O site só lê os seus dados; não altera nada no jogo.', 'Sua senha fica na Bungie; o site nunca vê.', 'As suas marcações ficam salvas neste navegador.'],
    login: 'Entrar com Bungie.net', notConfigured: 'O site ainda não foi configurado: faltam as chaves da Bungie nas variáveis de ambiente da Vercel.',
    loading: 'Carregando sua conta…', loadingDefs: 'Buscando nomes de missões e itens…', loadingPlaces: 'Buscando locais das missões…', cached: t => `Mostrando dados das ${t}; atualizando…`, updated: t => `Atualizado às ${t}`,
    authError: m => `Não deu para entrar: ${m}. Tente de novo.`, apiError: m => `Erro ao falar com a Bungie: ${m}`,
    maintenance: 'A API da Bungie está em manutenção agora. Tente de novo em alguns minutos.',
    noChars: 'Nenhum personagem de Destiny 2 encontrado nesta conta.',
    done1: (n, t) => `${n} de ${t} feitos`, dg: (n, t) => `${n} de ${t} masmorras concluídas`, raid: (n, t) => `${n} de ${t} incursões concluídas`,
    tit: (n, t) => `${n} de ${t} títulos conquistados`, camp: n => `${n} campanha${n === 1 ? '' : 's'} em andamento`, ld: n => `${n} loadout${n === 1 ? '' : 's'} no jogo`,
    panels: (n, sh) => n === 1 ? '1 painel concluído ' + (sh ? 'aparecendo.' : 'oculto.') : `${n} painéis concluídos ${sh ? 'aparecendo.' : 'ocultos.'}`,
    show: 'Mostrar', hideDone: 'Ocultar concluídos',
    s: {
      contracts: 'Contratos ativos', contractsNote: 'Contratos e recompensas que estão com você agora.', noContracts: 'Nenhum contrato ativo agora. Pegue novos com os Sindicatos ou vendedores.', expires: h => h >= 48 ? `Expira em ${Math.round(h / 24)} dias.` : `Expira em ${h} h.`,
      loadingQuests: 'Carregando missões e contratos…', loadingRecords: 'Carregando títulos e catalisadores…',
      quests: 'Missões em andamento', questsNote: 'Do seu registro de missões, das mais adiantadas para as menos.',
      nearCats: 'Catalisadores quase prontos', nearCatsNote: 'Já passaram da metade.',
      nearTitles: 'Títulos quase prontos', nearTitlesNote: 'Faltam poucos triunfos.',
      noCamp: 'Nenhuma campanha em andamento no registro deste personagem. Campanhas concluídas não aparecem.',
      campNote: (a, b) => `Passo ${a} de ${b}.`, current: 'Passo atual',
      clear: n => `Concluir ${n}`, exotic: n => `Exótico: ${n}`,
      wpn: 'Armas exóticas', armor: c => `Armaduras exóticas de ${c}`,
      catProg: 'Em progresso', catProgNote: 'Catalisador obtido; use a arma para completar.',
      catNew: 'Ainda não iniciados', catNewNote: 'Ainda sem progresso. Alguns precisam ser obtidos antes.',
      src: { archive: 'Arquivo Exótico', engram: 'Engramas exóticos', raid: 'Incursões', dungeon: 'Masmorras', mission: 'Missões e jornadas', lost: 'Setores perdidos', xur: 'Xûr', season: 'Temporadas, passes e eventos', other: 'Outras fontes' },
      xg: { archive: 'Arquivo Exótico na Torre', armor: c => `Armaduras exóticas de ${c}`, explore: 'Exploração e atividades', mission: 'Jornadas e missões exóticas', dungeon: 'Masmorras', raid: 'Incursões', season: 'Passes e temporadas' },
      xn: { archive: 'Fácil · solo. Compra direta no Arquivo Exótico, na Torre; só precisa dos materiais.', armor: 'Fácil · solo. Foco de engrama exótico na Torre ou a fonte indicada em cada uma.', explore: 'Fácil a médio · solo. Engramas exóticos, Xûr, setores perdidos e outras atividades.', mission: 'Médio · quase todas dá para fazer solo. Missões exóticas pedem atenção às mecânicas.', dungeon: 'Médio · trio. Ideal para jogar com dois amigos.', raid: 'Difícil · incursão com 6 jogadores. O exótico cai com chance baixa.', season: 'Médio · solo. Passes e eventos antigos; alguns custam Prata.' },
      tierNote: ['Fácil · solo', 'Médio · masmorras e um pouco de PvP', 'Difícil · incursão (6 jogadores)', 'Muito difícil · PvP competitivo e Grão-mestre', 'Evento · só com o evento ativo'],
    },
    chip: { 'Fácil': 'Fácil', 'Médio': 'Médio', 'Difícil': 'Difícil', 'Muito difícil': 'Muito difícil', 'Evento': 'Evento', 'Solo': 'Solo', 'Trio': 'Trio', '6': '6 jogadores', 'Exótico': 'Exótico', 'Mestre': 'Mestre' },
    w: {
      wkChallenge: n => `Desafio semanal: ${n}`, wkChallengeD: 'Conclua o desafio da semana nessa atividade para a recompensa extra.', wkClaim: n => `${n} para resgatar. Fale com quem entrega as recompensas.`, wkRewardsD: 'Recompensas semanais.', wkRewardT: n => `${n}: recompensas da semana`, wkQuestD: 'Missão da semana.', wkStarted: 'Em andamento', wkNew: 'Disponível', weeklyChip: 'Semanal', xurChip: 'Xûr', resetNote: t => `Reseta em ${t} (terça, 14h de Brasília).`,
      week: 'Esta semana', xurSells: n => `Xûr vende ${n}`, xurSub: (c, h, t) => `${c} moedas${h != null ? ` · você tem ${h}` : ''} · sai em ${t}`,
      featured: 'Em destaque: ', missingEx: n => `${n} ainda falta`, untilReset: 'até o reset', reset: 'Reset semanal', resetSub: t => `em ${t} · terça, 14h (Brasília)`,
      featWeek: 'Em destaque nesta semana', clears: n => n === 1 ? '1 conclusão' : `${n} conclusões`, showBuild: 'Ver a build equipada',
      find: 'Buscar guardião', findShort: 'Buscar', findPh: 'Nome Bungie (ex.: Fulano#1234)', findHint: 'Digite o nome Bungie completo, como aparece no jogo (ex.: Kayo Castan). O #código é opcional: sem ele aparecem todos com esse nome.', findNone: 'Ninguém com esse nome exato. Confira se o nome está completo, com espaços e acentos.', findErr: 'Não deu para buscar agora. Tente de novo em instantes.', findLoading: 'Buscando…', findLoadingP: 'Carregando a build…', back: 'Voltar', privateP: 'Não deu para ver o equipamento desse guardião agora.', seeBuild: 'Ver a build', compare: 'Comparar com a minha build', cmpClose: 'Fechar a comparação', cmpOn: 'Comparando com a sua', artT: 'Artefato', toDim: 'Levar esta build para o DIM (abre como loadout para salvar)', backBuild: 'Voltar para a build', you: 'Você', abilities: 'Habilidades', exoArmor: 'Armadura exótica', lgHave: 'diferente, e você tem', lgMiss: 'diferente, e você não tem', lgSame: 'igual nas duas', vendT: 'Vendedores da semana', vendNote: t => `Xûr, Banshee-44 e Ada-1 na Torre. Armas com o rolo que está à venda; em dourado as vantagens principais.${t ? ' Muda em ' + t + '.' : ''}`, notOwned: 'Não tem', xurSub2: (n, t, c) => `${n} exóticos para ${c} · sai em ${t}`, xurGoneShort: 'Fora da Torre até sexta', missN: n => n === 1 ? '1 que falta' : `${n} que faltam`, nWeapons: n => n === 1 ? '1 arma' : `${n} armas`, nOther: n => n === 1 ? '1 item' : `${n} itens`, changesIn: t => `muda em ${t}`, perksGold: 'Em dourado, as duas vantagens principais do rolo à venda.', xurLeaves: t => `exóticos · sai em ${t}`, coins: 'moedas', coinsHave: n => `Você tem ${n} Moedas Estranhas.`, xurGone: 'O Xûr não está na Torre agora. Ele volta na sexta, às 14h.', shaders: (n, o) => o === n ? `Também vende ${n} tonalizadores, e você já tem todos.` : `Também vende ${n} tonalizadores; você tem ${o}.`, vaultT: 'Limpeza do cofre', of: 'de', slots: 'espaços usados', dupExo: 'Exóticos repetidos', dupLeg: 'Lendários repetidos', andMore: n => `E mais ${n}.`, vaultNote: 'Itens iguais guardados mais de uma vez. Para liberar espaço, desmonte as cópias que não usa, no jogo ou no DIM.', vaultClean: 'Nenhum item repetido no cofre.', statsT: 'Estatísticas de jogo', crucible: 'Crisol', eff: 'Eficiência', winsOf: (w, g) => `Vitórias (${w} de ${g})`, bestGame: 'Mais abates numa partida', cleared: 'Atividades concluídas', played: 'Tempo jogado', noTrials: 'Desafios de Osíris: você ainda não jogou.', trialsLine: (g, w, kd) => `Desafios de Osíris: ${g} partidas, ${w} vitórias, K/D ${kd}.`, recentT: 'Esquadrão recente', recentNote: 'Quem jogou no seu esquadrão nas últimas atividades. Toque num nome para ver a build.', recentNone: 'Ninguém no seu esquadrão nas últimas atividades.', together: n => n === 1 ? '1 atividade juntos' : `${n} atividades juntos`, clanTip: 'Toque num nome para ver a build da pessoa.', lastPlayed: d => `jogou ${d}`, fav: 'Favoritar este guardião', unfav: 'Tirar dos favoritos', favGT: 'Guardiões favoritos', favNone: 'Toque na estrela ao lado do nome de alguém (na busca, no clã ou no esquadrão recente) para guardar aqui.', seenAgo: t => `visto ${t}`, favT: 'Favoritos', copyLink: 'Copiar o link desta build', myLink: 'Copiar o link da sua build', linkOk: 'Link copiado', cmpWith: 'Comparar com', equippedNow: 'Equipada agora', ldEmpty: 'Esse loadout está vazio.', loadingLd: 'Carregando o loadout…', publicNote: 'Você está vendo a build pública deste guardião. Entre com a sua conta para comparar com a sua.',
      ammo: { 1: 'Munição primária', 2: 'Munição especial', 3: 'Munição pesada' },
      share: 'Gerar imagem para compartilhar', shareMaking: 'Montando a imagem da sua build…', shareAlt: 'Imagem da build equipada', shareBtn: 'Compartilhar', shareDl: 'Baixar imagem', shareClose: 'Fechar', shareTitle: 'Minha build no Destiny 2', shareFail: 'Não deu para gerar a imagem agora. Tente de novo.',
      setT: 'Bônus de conjunto', setPieces: n => n === 1 ? '1 peça' : `${n} peças`, setReq: n => `${n} peças`,
      subclass: 'Subclasse', weapons: 'Armas', armor: 'Armadura e mods', aspects: 'Aspectos', frags: 'Fragmentos',
      ranksT: 'Patentes e reputação', gRank: 'Patente de Guardião', pass: 'Passe',
      clearsT: 'Conclusões', dgW: 'Masmorra', raidW: 'Incursão', others: (k, z, any) => k === 'dg' ? (any ? `Outras ${z} masmorras` : 'Masmorras') : (any ? `Outras ${z} incursões` : 'Incursões'), noneYet: 'nenhuma ainda',
      wpnT: 'Armas que você mais usa', wpnNote: 'Abates e precisão com cada arma neste personagem, segundo a Bungie.', kills: 'abates', prec: 'precisão',
      commT: 'Elogios', commScore: 'Pontuação de elogios', clanT: 'Clã', noClan: 'Você não está em um clã.', clanNote: n => n === 1 ? '1 pessoa do clã online agora.' : n ? `${n} pessoas do clã online agora.` : 'Ninguém do clã online agora.',
      unavailable: 'Não deu para carregar agora. Tente Atualizar.',
      optsT: 'Ajustes', optsNote: 'Ligue ou desligue as partes novas. Fica salvo neste navegador.', optWeek: 'Mostrar a faixa “Esta semana”', optClears: 'Mostrar conclusões nas incursões e masmorras', optBuild: 'Abrir a build ao tocar nos ícones do cabeçalho',
    },
    openDim: 'Abrir no DIM', noLoadouts: 'Nenhum loadout salvo no jogo para este personagem.',
    toLight: 'Mudar para tema claro', toDark: 'Mudar para tema escuro', classes: ['Titã', 'Caçador', 'Arcano'], races: ['Humano', 'Despertado', 'Exo'], power: 'Poder', max: 'máx.', where: 'Onde',
  },
  en: {
    hide: 'Hide done', search: 'Search by name or source', refresh: 'Refresh', logout: 'Sign out',
    disclaimer: 'Data read from your account through the official Bungie API. This site is not affiliated with Bungie.',
    loadouts: 'Loadouts', checklist: 'Checklist',
    tabs: { obj: 'Objectives', act: 'Activities', drops: 'Arsenal', gd: 'Guardian' },
    subs: { camp: 'Campaigns', raid: 'Raids', dg: 'Dungeons', tit: 'Titles', exo: 'Exotics', cat: 'Catalysts', vend: 'Vendors' },
    heroTitle: 'Your Destiny 2 checklist', heroText: "Sign in with your Bungie.net account to see what's left: exotics, catalysts, titles, raids, dungeons and campaigns, from easiest to hardest.",
    heroList: ['The site only reads your data; it never changes anything in the game.', 'Your password stays with Bungie; the site never sees it.', 'Your checkmarks are saved in this browser.'],
    login: 'Sign in with Bungie.net', notConfigured: "The site isn't configured yet: the Bungie keys are missing from the Vercel environment variables.",
    loading: 'Loading your account…', loadingDefs: 'Fetching quest and item names…', loadingPlaces: 'Fetching quest locations…', cached: t => `Showing data from ${t}; updating…`, updated: t => `Updated at ${t}`,
    authError: m => `Couldn't sign in: ${m}. Please try again.`, apiError: m => `Error talking to Bungie: ${m}`,
    maintenance: 'The Bungie API is down for maintenance. Try again in a few minutes.',
    noChars: 'No Destiny 2 characters found on this account.',
    done1: (n, t) => `${n} of ${t} done`, dg: (n, t) => `${n} of ${t} dungeons cleared`, raid: (n, t) => `${n} of ${t} raids cleared`,
    tit: (n, t) => `${n} of ${t} titles earned`, camp: n => `${n} campaign${n === 1 ? '' : 's'} in progress`, ld: n => `${n} in-game loadout${n === 1 ? '' : 's'}`,
    panels: (n, sh) => `${n} completed panel${n === 1 ? '' : 's'} ${sh ? 'shown.' : 'hidden.'}`,
    show: 'Show', hideDone: 'Hide completed',
    s: {
      contracts: 'Active contracts', contractsNote: 'Contracts and bounties you are holding right now.', noContracts: 'No active contracts right now. Pick up new ones from the Syndicates or vendors.', expires: h => h >= 48 ? `Expires in ${Math.round(h / 24)} days.` : `Expires in ${h} h.`,
      loadingQuests: 'Loading quests and contracts…', loadingRecords: 'Loading titles and catalysts…',
      quests: 'Quests in progress', questsNote: 'From your quest log, most advanced first.',
      nearCats: 'Catalysts almost done', nearCatsNote: 'Already past halfway.',
      nearTitles: 'Titles almost done', nearTitlesNote: 'Only a few triumphs left.',
      noCamp: 'No campaign in progress in this character\'s quest log. Finished campaigns are not shown.',
      campNote: (a, b) => `Step ${a} of ${b}.`, current: 'Current step',
      clear: n => `Complete ${n}`, exotic: n => `Exotic: ${n}`,
      wpn: 'Exotic weapons', armor: c => `${c} exotic armor`,
      catProg: 'In progress', catProgNote: 'Catalyst obtained; use the weapon to finish it.',
      catNew: 'Not started', catNewNote: 'No progress yet. Some must be obtained first.',
      src: { archive: 'Exotic Archive', engram: 'Exotic engrams', raid: 'Raids', dungeon: 'Dungeons', mission: 'Missions and quests', lost: 'Lost Sectors', xur: 'Xûr', season: 'Seasons, passes and events', other: 'Other sources' },
      xg: { archive: 'Exotic Archive in the Tower', armor: c => `${c} exotic armor`, explore: 'Exploration and activities', mission: 'Exotic quests and missions', dungeon: 'Dungeons', raid: 'Raids', season: 'Passes and seasons' },
      xn: { archive: 'Easy · solo. Buy it at the Exotic Archive in the Tower; you only need the materials.', armor: 'Easy · solo. Exotic engram focusing in the Tower, or the source shown on each one.', explore: 'Easy to medium · solo. Exotic engrams, Xûr, Lost Sectors and other activities.', mission: 'Medium · almost all can be done solo. Exotic missions need attention to mechanics.', dungeon: 'Medium · trio. Great with two friends.', raid: 'Hard · 6-player raid. The exotic has a low drop chance.', season: 'Medium · solo. Old passes and events; some cost Silver.' },
      tierNote: ['Easy · solo', 'Medium · dungeons and some PvP', 'Hard · raid (6 players)', 'Very hard · competitive PvP and Grandmaster', 'Event · only while the event is live'],
    },
    chip: { 'Fácil': 'Easy', 'Médio': 'Medium', 'Difícil': 'Hard', 'Muito difícil': 'Very hard', 'Evento': 'Event', 'Solo': 'Solo', 'Trio': 'Trio', '6': '6 players', 'Exótico': 'Exotic', 'Mestre': 'Master' },
    w: {
      wkChallenge: n => `Weekly challenge: ${n}`, wkChallengeD: 'Finish this week\'s challenge in this activity for the extra reward.', wkClaim: n => `${n} to claim. Talk to whoever hands out the rewards.`, wkRewardsD: 'Weekly rewards.', wkRewardT: n => `${n}: weekly rewards`, wkQuestD: 'Quest of the week.', wkStarted: 'In progress', wkNew: 'Available', weeklyChip: 'Weekly', xurChip: 'Xûr', resetNote: t => `Resets in ${t} (Tuesday, 17:00 UTC).`,
      week: 'This week', xurSells: n => `Xûr sells ${n}`, xurSub: (c, h, t) => `${c} coins${h != null ? ` · you have ${h}` : ''} · leaves in ${t}`,
      featured: 'Featured: ', missingEx: n => `${n} still missing`, untilReset: 'until reset', reset: 'Weekly reset', resetSub: t => `in ${t} · Tuesday, 17:00 UTC`,
      featWeek: 'Featured this week', clears: n => n === 1 ? '1 clear' : `${n} clears`, showBuild: 'Show the equipped build',
      find: 'Find a guardian', findShort: 'Search', findPh: 'Bungie Name (e.g. Someone#1234)', findHint: 'Type the full Bungie Name as it shows in game (e.g. Kayo Castan). The #code is optional: without it you see everyone with that name.', findNone: 'No one with that exact name. Check that the name is complete, with spaces and accents.', findErr: "Couldn't search right now. Try again in a moment.", findLoading: 'Searching…', findLoadingP: 'Loading the build…', back: 'Back', privateP: "Couldn't see this guardian's gear right now.", seeBuild: 'See their build', compare: 'Compare with my build', cmpClose: 'Close comparison', cmpOn: 'Comparing with yours', artT: 'Artifact', toDim: 'Take this build to DIM (opens as a loadout to save)', backBuild: 'Back to the build', you: 'You', abilities: 'Abilities', exoArmor: 'Exotic armor', lgHave: 'different, and you have it', lgMiss: "different, and you don't have it", lgSame: 'same on both', vendT: "This week's vendors", vendNote: t => `Xûr, Banshee-44 and Ada-1 in the Tower. Weapons with the roll for sale; main perks in gold.${t ? ' Changes in ' + t + '.' : ''}`, notOwned: 'Not owned', xurSub2: (n, t, c) => `${n} exotics for ${c} · leaves in ${t}`, xurGoneShort: 'Away until Friday', missN: n => `${n} missing`, nWeapons: n => n === 1 ? '1 weapon' : `${n} weapons`, nOther: n => n === 1 ? '1 item' : `${n} items`, changesIn: t => `changes in ${t}`, perksGold: 'In gold, the two main perks of the roll for sale.', xurLeaves: t => `exotics · leaves in ${t}`, coins: 'coins', coinsHave: n => `You have ${n} Strange Coins.`, xurGone: "Xûr isn't in the Tower right now. He's back Friday at 17:00 UTC.", shaders: (n, o) => o === n ? `Also sells ${n} shaders, and you own all of them.` : `Also sells ${n} shaders; you own ${o}.`, vaultT: 'Vault cleanup', of: 'of', slots: 'slots used', dupExo: 'Duplicate exotics', dupLeg: 'Duplicate legendaries', andMore: n => `And ${n} more.`, vaultNote: 'Identical items stored more than once. To free space, dismantle the copies you don\'t use, in game or in DIM.', vaultClean: 'No duplicate items in the vault.', statsT: 'Game stats', crucible: 'Crucible', eff: 'Efficiency', winsOf: (w, g) => `Wins (${w} of ${g})`, bestGame: 'Most kills in a match', cleared: 'Activities cleared', played: 'Time played', noTrials: "Trials of Osiris: you haven't played yet.", trialsLine: (g, w, kd) => `Trials of Osiris: ${g} matches, ${w} wins, K/D ${kd}.`, recentT: 'Recent fireteam', recentNote: 'People in your fireteam in your latest activities. Tap a name to see their build.', recentNone: 'No one in your fireteam in your latest activities.', together: n => n === 1 ? '1 activity together' : `${n} activities together`, clanTip: 'Tap a name to see their build.', lastPlayed: d => `played ${d}`, fav: 'Favorite this guardian', unfav: 'Remove from favorites', favGT: 'Favorite guardians', favNone: "Tap the star next to someone's name (in search, your clan or recent fireteam) to keep them here.", seenAgo: t => `seen ${t}`, favT: 'Favorites', copyLink: 'Copy the link to this build', myLink: 'Copy the link to your build', linkOk: 'Link copied', cmpWith: 'Compare with', equippedNow: 'Equipped now', ldEmpty: 'This loadout is empty.', loadingLd: 'Loading the loadout…', publicNote: "You're viewing this guardian's public build. Sign in to compare it with yours.",
      ammo: { 1: 'Primary ammo', 2: 'Special ammo', 3: 'Heavy ammo' },
      share: 'Make an image to share', shareMaking: 'Putting your build image together…', shareAlt: 'Image of the equipped build', shareBtn: 'Share', shareDl: 'Download image', shareClose: 'Close', shareTitle: 'My Destiny 2 build', shareFail: "Couldn't make the image right now. Please try again.",
      setT: 'Set bonuses', setPieces: n => n === 1 ? '1 piece' : `${n} pieces`, setReq: n => `${n} pieces`,
      subclass: 'Subclass', weapons: 'Weapons', armor: 'Armor and mods', aspects: 'Aspects', frags: 'Fragments',
      ranksT: 'Ranks and reputation', gRank: 'Guardian Rank', pass: 'Pass',
      clearsT: 'Clears', dgW: 'Dungeon', raidW: 'Raid', others: (k, z, any) => k === 'dg' ? (any ? `Other ${z} dungeons` : 'Dungeons') : (any ? `Other ${z} raids` : 'Raids'), noneYet: 'none yet',
      wpnT: 'Your most used weapons', wpnNote: 'Kills and precision with each weapon on this character, from Bungie.', kills: 'kills', prec: 'precision',
      commT: 'Commendations', commScore: 'Commendation score', clanT: 'Clan', noClan: "You're not in a clan.", clanNote: n => n === 1 ? '1 clanmate online now.' : n ? `${n} clanmates online now.` : 'No clanmates online right now.',
      unavailable: "Couldn't load this right now. Try Refresh.",
      optsT: 'Settings', optsNote: 'Turn the new parts on or off. Saved in this browser.', optWeek: 'Show the “This week” strip', optClears: 'Show clears on raids and dungeons', optBuild: 'Open the build when tapping the header icons',
    },
    openDim: 'Open in DIM', noLoadouts: 'No in-game loadouts saved for this character.',
    toLight: 'Switch to light theme', toDark: 'Switch to dark theme', classes: ['Titan', 'Hunter', 'Warlock'], races: ['Human', 'Awoken', 'Exo'], power: 'Power', max: 'max', where: 'Where',
  },
};
let lang = LS.get('dc-lang', null) || ((navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en');
const u = () => UI[lang];
const L = pair => Array.isArray(pair) ? (lang === 'en' ? pair[0] : (pair[1] || pair[0])) : pair;
const chipClass = x => /^(Fácil|Easy)$/.test(x) ? 'easy' : /^(Médio|Medium)$/.test(x) ? 'mid' : /^(Difícil|Hard|Muito difícil|Very hard)$/.test(x) ? 'hard' : /%$/.test(x) ? 'hot' : '';

/* ---------- estado ---------- */
let cfg = null, defs = null, ITEMS = null, auth = LS.get('dc-auth', null), profile = null, member = null;
let charId = null, tab = LS.get('dc-tab', 'obj'), prevTab = 'obj', query = '';
const lastSub = LS.get('dc-subs', {});
let marks = new Set(), SECTIONS = [], LOADOUTS = [], loadedAt = null;
const openSecs = new Set(), openItems = new Set();
const GROUPS = [{ id: 'obj', subs: ['obj'] }, { id: 'act', subs: ['camp', 'raid', 'dg', 'tit'] }, { id: 'drops', subs: ['exo', 'cat', 'vend'] }, { id: 'gd', subs: ['gd'] }];
const groupOf = t => GROUPS.find(g => g.subs.includes(t));
// aba salva que não existe mais (ex.: Padrões, que foi retirada) volta para Objetivos
if (tab !== 'ld' && !groupOf(tab)) { tab = 'obj'; LS.set('dc-tab', 'obj'); }
for (const [k, v] of Object.entries(lastSub)) if (!GROUPS.find(g => g.id === k)?.subs.includes(v)) delete lastSub[k];

/* ---------- status ---------- */
function status(msg) { $('status').textContent = msg || ''; }
function showMessage(html) { $('list').innerHTML = `<div class="panel">${html}</div>`; }

/* ---------- autenticação ---------- */
function readHash() {
  const h = location.hash.slice(1);
  if (!h) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('auth_error')) return { error: p.get('auth_error') };
  const a = p.get('auth');
  if (!a) return null;
  try {
    const t = JSON.parse(atob(a.replace(/-/g, '+').replace(/_/g, '/')));
    const expected = sessionStorage.getItem('dc-state');
    sessionStorage.removeItem('dc-state');
    if (!expected || t.state !== expected) return { error: 'state' };
    delete t.state;
    return { auth: t };
  } catch { return { error: 'token' }; }
}
function login() {
  const st = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('dc-state', st); } catch {}
  location.href = `https://www.bungie.net/${lang === 'pt' ? 'pt-br' : 'en'}/OAuth/Authorize?client_id=${encodeURIComponent(cfg.clientId)}&response_type=code&state=${st}`;
}
function logout() { resetChar(); buildOpen = false; if (member) idbDel('profile-' + member.id); LS.del('dc-auth'); LS.del('dc-member'); LS.del('dc-el'); auth = null; profile = null; member = null; render(); }
async function token() {
  if (!auth) throw new Error('auth');
  if (auth.access_expires - Date.now() > 60000) return auth.access_token;
  if (!auth.refresh_token || (auth.refresh_expires && auth.refresh_expires < Date.now())) { logout(); throw new Error('auth'); }
  const r = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: auth.refresh_token }) });
  if (!r.ok) { logout(); throw new Error('auth'); }
  auth = { ...auth, ...(await r.json()) };
  LS.set('dc-auth', auth);
  return auth.access_token;
}
async function bungie(path, needAuth = true) {
  const headers = { 'X-API-Key': cfg.apiKey };
  if (needAuth) headers.Authorization = 'Bearer ' + await token();
  const r = await fetch(API + path, { headers });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`HTTP ${r.status}`);
  if (j.ErrorCode === 5) throw new Error('maintenance');
  if (j.ErrorCode === 99 || j.ErrorCode === 22) { logout(); throw new Error('auth'); }
  if (j.ErrorCode !== 1) throw new Error(j.Message || j.ErrorStatus);
  return j.Response;
}

/* ---------- nomes de itens (API de entidades, com cache) ---------- */
LS.del('dc-ent3-en'); LS.del('dc-ent3-pt');
const entCache = { en: LS.get('dc-ent4-en', {}), pt: LS.get('dc-ent4-pt', {}) };
for (const k of ['dc-ent-en', 'dc-ent-pt', 'dc-ent2-en', 'dc-ent2-pt']) LS.del(k);
let entDirty = false;
async function entity(type, hash, lc) {
  const key = type + ':' + hash, store = entCache[lc];
  if (store[key] && (store[key].n || !/LoadoutName/.test(type))) return store[key];
  try {
    const d = await bungie(`/Destiny2/Manifest/${type}/${hash >>> 0}/?lc=${lc === 'pt' ? 'pt-br' : 'en'}`, false);
    const v = { n: d.displayProperties?.name || d.name || '', d: d.displayProperties?.description || '', ql: d.setData?.questLineName || '', il: (d.setData?.itemList || []).map(x => x.itemHash), b: d.inventory?.bucketTypeHash || 0, it: d.itemType || 0, tl: d.itemTypeDisplayName || '', su: d.inventory?.stackUniqueLabel || '', ob: d.objectives?.objectiveHashes || [], lh: d.locationHash || 0, lr: (d.locationReleases || []).map(r => [r.destinationHash || 0, r.activityHash || 0]).slice(-1)[0] || null, ic: d.displayProperties?.icon || '', tt: d.inventory?.tierType || 0, dt: d.talentGrid?.hudDamageType || 0 };
    store[key] = v; entDirty = true;
    return v;
  } catch { return { n: '', d: '', ql: '', il: [], b: 0, it: 0, tl: '', su: '', ob: [], lh: 0, lr: null }; }
}
async function entities(type, hashes, lc) {
  const list = [...new Set(hashes)];
  const out = {};
  let i = 0;
  const worker = async () => { while (i < list.length) { const h = list[i++]; out[h] = await entity(type, h, lc); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (entDirty) { LS.set('dc-ent4-en', entCache.en); LS.set('dc-ent4-pt', entCache.pt); entDirty = false; }
  return out;
}

/* ---------- cópia local do último perfil (IndexedDB) ---------- */
const idb = () => new Promise((res, rej) => { const q = indexedDB.open('destiny-checklist', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
async function idbGet(k) { try { const db = await idb(); return await new Promise(r => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch { return null; } }
async function idbSet(k, v) { try { const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch {} }
async function idbDel(k) { try { const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').delete(k); } catch {} }

/* ---------- leitura do perfil ----------
   O perfil vem em 3 partes em paralelo, da mais leve para a mais pesada, e a tela é desenhada
   conforme cada parte chega. Se houver uma cópia da última visita, ela aparece na hora. */
// id: personagens e equipados (cabeçalho e cor da subclasse, sempre primeiro) · q: missões e contratos
// a: coleções, métricas, marcos e elogios · b: triunfos · c: inventário, instâncias e loadouts · g: encaixes do equipamento (build)
// 201 também em c: a Bungie só manda instâncias (300) dos itens incluídos na mesma resposta
const PARTS = { id: '200,205', q: '201,301', a: '100,202,800,1100,1400', b: '900', c: '102,201,205,206,300', g: '205,300,305' };
// parte de que cada aba depende: ela é pedida logo depois do cabeçalho
const TAB_PART = { vend: 'a', obj: 'q', camp: 'q', raid: 'a', dg: 'a', exo: 'a', cat: 'b', tit: 'b', ld: 'c', gd: 'a' };
let have = { id: false, q: false, a: false, b: false, c: false, g: false };
function pickChar() {
  const chars = Object.values(profile.characters?.data || {});
  if (!chars.length) return false;
  const saved = LS.get('dc-char-' + member.id, null);
  if (!chars.some(c => c.characterId === charId)) charId = chars.some(c => c.characterId === saved) ? saved : chars.slice().sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))[0].characterId;
  return true;
}
async function loadMember() {
  const m = await bungie('/User/GetMembershipsForCurrentUser/');
  const list = m.destinyMemberships || [];
  if (!list.length) return null;
  const pick = list.find(x => x.membershipId === m.primaryMembershipId) || list.find(x => x.crossSaveOverride && x.crossSaveOverride === x.membershipType) || list[0];
  return { type: pick.membershipType, id: pick.membershipId, name: m.bungieNetUser?.uniqueName || pick.bungieGlobalDisplayName || pick.displayName };
}
async function loadAccount() {
  status(u().loading);
  member = LS.get('dc-member', null);
  if (!member) {
    showMessage(`<p class="loading">${esc(u().loading)}</p>`);
    member = await loadMember();
    if (!member) { showMessage(`<p class="notice">${esc(u().noChars)}</p>`); return; }
    LS.set('dc-member', member);
  }
  marks = new Set(LS.get('dc-marks-' + member.id, []));
  // 1) cópia da última visita, se houver
  let usingCache = false;
  if (!profile) {
    const cached = await idbGet('profile-' + member.id);
    if (cached?.p?.characters) {
      profile = cached.p; have = { id: true, q: true, a: true, b: true, c: true, g: true }; usingCache = true;
      if (pickChar()) { loadedAt = new Date(cached.t); hydrate(u().cached(loadedAt.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' }))); }
    } else showMessage(`<p class="loading">${esc(u().loading)}</p>`);
  } else usingCache = true;
  // 2) dados ao vivo, em 3 partes
  const live = {}, got = { id: false, q: false, a: false, b: false, c: false, g: false };
  let hydrated = false;
  const need = TAB_PART[tab] || 'q';
  const url = k => `/Destiny2/${member.type}/Profile/${member.id}/?components=${PARTS[k]}`;
  const merge = (dst, r) => { const ic = dst.itemComponents; Object.assign(dst, r); if (ic && r.itemComponents) { const m = { ...ic }; for (const [c, v] of Object.entries(r.itemComponents)) m[c] = { ...ic[c], ...v, data: { ...ic[c]?.data, ...v?.data } }; dst.itemComponents = m; } };
  const onPart = (k, r) => {
    merge(live, r); got[k] = true;
    // Com a cópia da última visita na tela: o cabeçalho, a aba aberta e a build já trocam pelos dados novos; o resto troca de uma vez no fim
    if (usingCache) { if ((k === 'id' || k === need || k === 'g') && profile) { merge(profile, r); if (pickChar()) { if (k === 'id') { build(); render(); loadGear(gen); } else if (k === 'g') loadBuild(gen); else { build(); render(); } } } return; }
    profile = live; have = { ...got };
    if (!got.id || !pickChar()) return;
    loadedAt = new Date();
    if (got.q && got[need] && !hydrated) { hydrated = true; hydrate(); return; }
    if (k === 'id') { build(); render(); loadGear(gen); }
    else if (k === 'c' && hydrated) loadLoadouts(gen);
    else if (k === 'g' && hydrated) loadBuild(gen);
    else { build(); render(); if (k === 'a' && hydrated) { loadMilestones(gen); if (!VEND) loadVendors(gen); if (tab === 'gd') loadGuardian(gen); } }
  };
  // ordem: cabeçalho, a parte da aba aberta, e o resto
  const order = ['id', need, 'g', ...['q', 'a', 'b', 'c'].filter(k => k !== need)];
  const results = await Promise.allSettled(order.map(k => bungie(url(k)).then(r => onPart(k, r))));
  const failed = results.find(r => r.status === 'rejected');
  if (failed) {
    if (failed.reason?.message === 'auth') throw failed.reason;
    if (!got.id && !usingCache) { LS.del('dc-member'); throw failed.reason; }
  }
  if (!hydrated && got.id && got.q && !usingCache && pickChar()) { hydrated = true; hydrate(); }
  if (!Object.values(got).every(Boolean)) { if (!usingCache) throw failed?.reason || new Error('profile'); status(u().apiError(failed?.reason?.message || '')); return; }
  profile = live; have = { id: true, q: true, a: true, b: true, c: true, g: true };
  if (!pickChar()) { showMessage(`<p class="notice">${esc(u().noChars)}</p>`); return; }
  loadedAt = new Date();
  idbSet('profile-' + member.id, { t: Date.now(), p: live });
  if (usingCache) hydrate();
}

let questInfo = {}, loadoutNames = {}, itemNames = {}, questLoc = {}, gearDefs = {};
/* Local oficial da missão: objetivo -> local -> destino/atividade (quando a Bungie informa). */
async function prepareLocations(defsEn) {
  const objHashes = [...new Set(defsEn.flatMap(d => d.ob || []))];
  const objs = await entities('DestinyObjectiveDefinition', objHashes, 'en');
  const locHashes = [...new Set(Object.values(objs).map(o => o.lh).filter(Boolean))];
  const locs = await entities('DestinyLocationDefinition', locHashes, 'en');
  const dests = [], acts = [];
  for (const l of Object.values(locs)) if (l.lr) { if (l.lr[0]) dests.push(l.lr[0]); if (l.lr[1]) acts.push(l.lr[1]); }
  const dN = await entities('DestinyDestinationDefinition', dests, lang), aN = await entities('DestinyActivityDefinition', acts, lang);
  questLoc = {};
  const quests = Object.entries(questInfo.en);
  for (const [h, d] of quests) {
    const names = [];
    for (const o of d.ob || []) { const l = locs[objs[o]?.lh]; if (!l || !l.lr) continue; let nm = (l.lr[0] && dN[l.lr[0]]?.n) || (l.lr[1] && aN[l.lr[1]]?.n); if (nm && nm === nm.toUpperCase()) nm = nm.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); if (nm && !names.includes(nm)) names.push(nm); }
    if (names.length) questLoc[h] = names.join(', ');
  }
}
/* Sem local oficial: deduz pela descrição em inglês. */
const PLACE = [[/neomuna/i, 'Neomuna', 'Neomuna'], [/dreaming city/i, 'Dreaming City', 'Cidade Onírica'], [/pale heart/i, 'The Pale Heart', 'Coração Pálido'], [/europa|eventide|asterion|cadmus/i, 'Europa', 'Europa'], [/\bmoon\b/i, 'The Moon', 'Lua'], [/kepler/i, 'Kepler', 'Kepler'], [/throne world|savath[uû]n/i, 'Throne World', 'Mundo-trono'], [/\benclave\b/i, 'Mars, Enclave', 'Marte, Enclave'], [/\bnessus\b/i, 'Nessus', 'Nesso'], [/\bEDZ\b|european dead zone/i, 'EDZ', 'ZME'], [/\btower\b/i, 'Tower', 'Torre']];
function guessLoc(en) {
  const t = en || '', out = [];
  const dg = t.match(/dungeon\W+"?([^".]+?)"?(?:[.]|\s|$)|"([^"]+?)\.?"\s+dungeon/i);
  if (dg) { const n = (dg[1] || dg[2] || '').trim(); const a = defs.dungeons.find(x => x.n[0].toLowerCase() === n.toLowerCase()); if (a) return lang === 'en' ? `${a.n[0]} dungeon` : `Masmorra ${a.n[1]}`; }
  const rd = t.match(/raid\W+"?([^".]+?)"?(?:[.]|\s|$)|"([^"]+?)\.?"\s+raid/i);
  if (rd) { const n = (rd[1] || rd[2] || '').trim(); const a = defs.raids.find(x => x.n[0].toLowerCase() === n.toLowerCase()); if (a) return lang === 'en' ? `${a.n[0]} raid` : `Incursão ${a.n[1]}`; }
  const ops = /\bops\b|operations/i.test(t), cru = /crucible/i.test(t), gam = /gambit/i.test(t), comp = /competitive/i.test(t), nf = /nightfall/i.test(t), ls = /lost sector/i.test(t);
  const P = lang === 'en';
  if (ops) out.push(P ? 'Ops in the Portal' : 'Operações no Portal');
  if (nf) out.push(P ? 'Nightfall' : 'Anoitecer');
  if (ls) out.push(P ? 'Lost Sectors' : 'Setores perdidos');
  if (gam) out.push(P ? 'Gambit' : 'Artimanha');
  if (comp) out.push(P ? 'Competitive Crucible' : 'Crisol competitivo'); else if (cru) out.push(P ? 'Crucible' : 'Crisol');
  for (const [re, e, p] of PLACE) if (re.test(t)) out.push(P ? e : p);
  return out.length ? out.join(P ? ', ' : ', ').replace(/, ([^,]+)$/, P ? ' and $1' : ' e $1') : '';
}
const questWhere = x => questLoc[x.it.itemHash] || guessLoc(x.q.d);
/* Carregamento em etapas: a lista aparece na hora; nomes de missões e loadouts chegam em seguida,
   e os locais por último. Cada etapa redesenha a tela sem perder aba, itens abertos ou busca. */
let gen = 0, stage = 0;
const updatedText = () => u().updated(loadedAt.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
async function hydrate(doneMsg) {
  const my = ++gen, p = profile;
  stage = 0; questLoc = {};
  build(); render();
  await loadGear(my); if (my !== gen) return; // cabeçalho e cor primeiro
  GD = null; VAULT = null; if (have.g) loadBuild(my); loadXur(my); if (have.a) loadVendors(my); if (have.a) loadMilestones(my); if (tab === 'gd' && have.a) loadGuardian(my);
  if (!weekT) weekT = setTimeout(() => { weekReady.x = weekReady.m = true; if (my === gen) { build(); render(); } }, 6000);
  status(u().loadingDefs);
  const quests = [];
  for (const inv of Object.values(p.characterInventories?.data || {})) for (const it of inv.items || []) if (it.bucketHash === QUEST_BUCKET) quests.push(it.itemHash);
  const qEn = await entities('DestinyInventoryItemDefinition', quests, 'en'); if (my !== gen) return;
  const qLang = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', quests, 'pt') : qEn; if (my !== gen) return;
  questInfo = { en: qEn, pt: qLang };
  stage = 1;
  if (have.c) await loadLoadouts(my, true); if (my !== gen) return;
  build(); render();
  status(u().loadingPlaces);
  await prepareLocations(quests.map(h => qEn[h]).filter(Boolean)); if (my !== gen) return;
  stage = 2; build(); render();
  status(doneMsg || updatedText());
}
/* Nomes dos loadouts e dos itens deles (precisa da parte de equipamentos). */
async function loadLoadouts(my, quiet) {
  const p = profile, inst = instanceMap(), ldItems = [], ldNames = [];
  for (const l of p.characterLoadouts?.data?.[charId]?.loadouts || []) { ldNames.push(l.nameHash); for (const i of l.items || []) if (inst[i.itemInstanceId]) ldItems.push(inst[i.itemInstanceId]); }
  const ln = await entities('DestinyLoadoutNameDefinition', ldNames, lang); if (my !== gen) return;
  const it = await entities('DestinyInventoryItemDefinition', ldItems, lang); if (my !== gen) return;
  loadoutNames = ln; itemNames = it;
  if (!quiet) { build(); render(); }
}
/* Identidade do personagem: subclasse e exóticos equipados (cor de destaque = elemento da subclasse) */
const SUB_BUCKET = 3284755031, GEAR_BUCKETS = [3284755031, 1498876634, 2465295065, 953998645, 3448274439, 3551918588, 14239492, 20886954, 1585787867];
const ELEMENTS = { 1: 'prismatic', 2: 'arc', 3: 'solar', 4: 'void', 6: 'stasis', 7: 'strand' };
const BNET = 'https://www.bungie.net';
async function loadGear(my) {
  const eq = (profile.characterEquipment?.data?.[charId]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).map(i => i.itemHash);
  if (!eq.length) return;
  const gd = await entities('DestinyInventoryItemDefinition', eq, lang); if (my !== gen) return;
  gearDefs = gd; render();
}
function renderGuardian(ch) {
  const gh = $('gh');
  if (!ch) { gh.classList.add('noemb'); $('ghband').style.backgroundImage = ''; $('gear').innerHTML = ''; $('ghpw').hidden = true; delete document.documentElement.dataset.el; return; }
  gh.classList.toggle('noemb', !ch.emblemBackgroundPath);
  $('ghband').style.backgroundImage = ch.emblemBackgroundPath ? `url("${BNET}${ch.emblemBackgroundPath}")` : '';
  const eq = profile.characterEquipment?.data?.[ch.characterId]?.items || [];
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), sd = sub && gearDefs[sub.itemHash];
  const exo = eq.filter(i => i.bucketHash !== SUB_BUCKET && gearDefs[i.itemHash]?.tt === 6).map(i => gearDefs[i.itemHash]);
  const el = sd ? ELEMENTS[sd.dt] : null;
  if (el) { document.documentElement.dataset.el = el; LS.set('dc-el', el); } else if (sd) delete document.documentElement.dataset.el;
  const g = (d, cls) => d && d.ic ? `<span class="g${cls}" title="${esc(d.n)}"><img src="${BNET}${d.ic}" alt="" loading="lazy"><span>${esc(d.n)}</span></span>` : '';
  $('gear').innerHTML = g(sd, ' g-sub') + exo.map(d => g(d, '')).join('');
  return el;
}
function instanceMap() {
  const p = profile, map = {};
  const add = items => { for (const it of items || []) if (it.itemInstanceId) map[it.itemInstanceId] = it.itemHash; };
  add(p.profileInventory?.data?.items);
  for (const v of Object.values(p.characterInventories?.data || {})) add(v.items);
  for (const v of Object.values(p.characterEquipment?.data || {})) add(v.items);
  return map;
}

/* ---------- poder máximo (como o DIM: melhor item por espaço, no máximo 1 exótico de arma e 1 de armadura) ---------- */
function maxPower(cls) {
  if (!ITEMS) return null;
  const inst = profile.itemComponents?.instances?.data || {}, all = [];
  const add = items => { for (const it of items || []) if (it.itemInstanceId) all.push(it); };
  add(profile.profileInventory?.data?.items);
  for (const v of Object.values(profile.characterInventories?.data || {})) add(v.items);
  for (const v of Object.values(profile.characterEquipment?.data || {})) add(v.items);
  const best = Array.from({ length: 8 }, () => ({ n: 0, x: 0 }));
  for (const it of all) {
    const code = ITEMS[it.itemHash]; if (code == null) continue;
    const slot = Math.floor(code / 100), c = Math.floor(code / 10) % 10, ex = code % 2;
    if (slot >= 3 && c !== 3 && c !== cls) continue;
    const pw = inst[it.itemInstanceId]?.primaryStat?.value; if (!pw) continue;
    const k = ex ? 'x' : 'n'; if (pw > best[slot][k]) best[slot][k] = pw;
  }
  const pick = slots => {
    let top = slots.every(t => best[t].n) ? slots.reduce((a, t) => a + best[t].n, 0) : 0;
    for (const s of slots) {
      if (!best[s].x || !slots.every(t => t === s || best[t].n)) continue;
      const sum = slots.reduce((a, t) => a + (t === s ? best[t].x : best[t].n), 0);
      if (sum > top) top = sum;
    }
    return top;
  };
  const w = pick([0, 1, 2]), a = pick([3, 4, 5, 6, 7]);
  return w && a ? Math.floor((w + a) / 8) : null;
}

/* ---------- regras ---------- */
const recState = h => profile.profileRecords?.data?.records?.[h] || profile.characterRecords?.data?.[charId]?.records?.[h] || null;
const recDone = r => !!r && (!!(r.state & 1) || !(r.state & 4));
const recObjs = r => (r && (r.objectives?.length ? r.objectives : r.intervalObjectives)) || [];
const progText = r => { const o = recObjs(r); if (o.length !== 1 || !o[0].completionValue || o[0].completionValue <= 1) return ''; return `${Math.min(o[0].progress || 0, o[0].completionValue)}/${o[0].completionValue}`; };
const pct = r => { const o = recObjs(r); let a = 0, b = 0; for (const x of o) { a += Math.min(x.progress || 0, x.completionValue || 1); b += x.completionValue || 1; } return b ? a / b : 0; };
const colStates = hashes => hashes.map(h => profile.profileCollectibles?.data?.collectibles?.[h]?.state ?? profile.characterCollectibles?.data?.[charId]?.collectibles?.[h]?.state).filter(s => s !== undefined);
const colAcquired = hashes => colStates(hashes).some(s => !(s & 1));
// Faltando = não adquirido e visível nas Coleções do jogo (o bit 4 marca itens que o jogo esconde, como exóticos que não dá mais para obter).
const colMissing = hashes => { const st = colStates(hashes); return st.length > 0 && !st.some(s => !(s & 1)) && st.some(s => !(s & 4)); };
const metric = h => profile.metrics?.data?.metrics?.[h]?.objectiveProgress?.progress || 0;
const exoticByName = name => defs.exotics.find(e => e.n[0] === name);
function srcGroup(s) {
  const t = (s || '').split(/\.\s/)[0].toLowerCase(); // só a 1ª frase: o resto explica onde começar
  if (/archive/.test(t)) return ['archive', 'Fácil', 'Solo'];
  if (/xûr|xur/.test(t)) return ['xur', 'Fácil', 'Solo'];
  if (/engram/.test(t)) return ['engram', 'Fácil', 'Solo'];
  if (/raid/.test(t)) return ['raid', 'Difícil', '6'];
  if (/dungeon/.test(t)) return ['dungeon', 'Médio', 'Trio'];
  if (/lost sector/.test(t)) return ['lost', 'Médio', 'Solo'];
  if (/quest|mission|exotic mission/.test(t)) return ['mission', 'Médio', 'Solo'];
  if (/season|pass|event|festival|solstice|dawning|guardian games|episode/.test(t)) return ['season', 'Médio', 'Solo'];
  return ['other', 'Médio', 'Solo'];
}
const CAMPAIGN_RE = /^(the edge of fate|renegades|lightfall|the final shape|legacy:|the witch queen|beyond light|shadowkeep|forsaken)/i;

/* ---------- montagem das seções ---------- */
// Tira o nome repetido no começo da descrição ("Nome — texto") e variáveis internas do jogo ({var:123}).
const cleanDesc = x => { const n = x.qd.n || x.q.n || ''; let d = (x.qd.d || '').replace(/\{var:\d+\}/g, '…'); if (n && d.startsWith(n + ' — ')) d = d.slice(n.length + 3); if (x.qd.ql && x.qd.ql !== n) d = x.qd.ql + ' — ' + d; return d.trim(); };
const S = (tab, id, title, note, items, extra) => ({ tab, id, title, note, items, ...extra });
const I = (id, t, d, c, done, extra) => ({ id, t, d, c: c || [], auto: !!done, ...extra });
function build() {
  const p = profile, U = u(), s = U.s, ch = p.characters.data[charId];
  const waiting = stage < 1;
  const out = [];
  // Objetivos: missões em andamento
  const qItems = [];
  const inv = p.characterInventories?.data?.[charId]?.items || [];
  for (const it of inv) {
    if (it.bucketHash !== QUEST_BUCKET) continue;
    const q = (questInfo.en || {})[it.itemHash], qd = (questInfo[lang] || questInfo.en || {})[it.itemHash];
    if (!q || !q.n) continue;
    const objs = (it.itemInstanceId ? p.itemComponents?.objectives?.data?.[it.itemInstanceId]?.objectives : null) || p.characterUninstancedItemComponents?.[charId]?.objectives?.data?.[it.itemHash]?.objectives || [];
    let a = 0, b = 0; for (const o of objs) { a += Math.min(o.progress || 0, o.completionValue || 1); b += o.completionValue || 1; }
    const frac = b ? a / b : 0;
    const isCamp = CAMPAIGN_RE.test(q.ql);
    const isContract = q.it === 26 || /\bcontract\b/i.test(q.n) || /\bcontract/i.test(q.ql);
    qItems.push({ it, q, qd, frac, objs, isCamp, isContract });
  }
  const contracts = qItems.filter(x => x.isContract).sort((a, b) => b.frac - a.frac);
  const expires = x => { const d = x.it.expirationDate ? new Date(x.it.expirationDate) : null; if (!d || isNaN(d)) return ''; const h = Math.max(0, Math.round((d - Date.now()) / 3600000)); return s.expires(h); };
  out.push(weekSection());
  out.push(S('vend', 'vendors', '', null, [], { html: true }));
  if (!contracts.length) out.push(S('obj', 'contracts', s.contracts, waiting ? s.loadingQuests : s.noContracts, []));
  // Um painel por vendedor/origem, usando o rótulo oficial do jogo (ex.: "Recompensa da Vanguarda", "Contrato do Sindicato").
  const byVendor = new Map();
  for (const x of contracts) { const label = x.qd.tl || x.q.tl || s.contracts; if (!byVendor.has(label)) byVendor.set(label, []); byVendor.get(label).push(x); }
  for (const [label, list] of byVendor) out.push(S('obj', 'contracts-' + label.replace(/[^a-z0-9]+/gi, '-'), label, null, list.map(x => I('k-' + (x.it.itemInstanceId || x.it.itemHash), x.qd.n || x.q.n, [cleanDesc(x), expires(x)].filter(Boolean).join(' '), [Math.round(x.frac * 100) + '%'], x.frac >= 1, { loc: questWhere(x) }))));
  const quests = qItems.filter(x => !x.isCamp && !x.isContract && x.objs.length).sort((a, b) => b.frac - a.frac).slice(0, 20);
  out.push(S('obj', 'quests', s.quests, waiting ? s.loadingQuests : s.questsNote, quests.map(x => I('q-' + x.it.itemHash, x.qd.n || x.q.n, cleanDesc(x), [Math.round(x.frac * 100) + '%'], x.frac >= 1, { loc: questWhere(x) }))));
  // catalisadores quase prontos
  const recOK = have.b;
  const nearCats = !recOK ? [] : defs.cats.map(c => ({ c, r: recState(c.h) })).filter(x => x.r && !recDone(x.r) && pct(x.r) >= 0.5).sort((a, b) => pct(b.r) - pct(a.r));
  if (nearCats.length) out.push(S('obj', 'nearcats', s.nearCats, s.nearCatsNote, nearCats.map(x => I('c-' + x.c.h, L(x.c.n), L(x.c.d), [progText(x.r) || Math.round(pct(x.r) * 100) + '%'], false))));
  // títulos quase prontos
  const sealStats = !recOK ? [] : defs.seals.map(se => { const recs = se.r.filter(r => { const st = recState(r[0]); return !st || !(st.state & 16); }); const done = recs.filter(r => recDone(recState(r[0]))).length; return { se, recs, done, total: recs.length }; }).filter(x => x.total);
  const near = sealStats.filter(x => x.done < x.total && x.done / x.total >= 0.7 && x.se.tier < 5).sort((a, b) => b.done / b.total - a.done / a.total).slice(0, 5);
  if (near.length) out.push(S('obj', 'neartitles', s.nearTitles, s.nearTitlesNote, near.map(x => I('nt-' + x.se.cr, L(x.se.t), L(x.se.ds), [`${x.done}/${x.total}`], false))));
  // Campanhas
  const camps = qItems.filter(x => x.isCamp);
  if (camps.length) {
    for (const x of camps) {
      const idx = Math.max(0, x.q.il.indexOf(x.it.itemHash)) + 1, tot = x.q.il.length || 1;
      out.push(S('camp', 'cp-' + x.it.itemHash, x.qd.ql || x.q.ql, s.campNote(idx, tot), [I('cp-' + x.it.itemHash, x.qd.n || x.q.n, x.qd.d, [`${idx}/${tot}`], false)]));
    }
  } else out.push(S('camp', 'nocamp', '', waiting ? s.loadingQuests : s.noCamp, [], { empty: true }));
  // Atividades: incursões e masmorras
  for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) {
    for (const a of list) {
      const items = [I(`${kind}-${a.k}-clear`, s.clear(L(a.n)), null, [U.chip[a.d], kind === 'raid' ? U.chip['6'] : U.chip.Trio], a.m && metric(a.m) > 0)];
      const ex = a.x && exoticByName(a.x);
      if (ex) items.push(I(`${kind}-${a.k}-x`, s.exotic(L(ex.n)), L(ex.s), [U.chip['Exótico']], colAcquired(ex.h), { isEx: true, exName: L(ex.n) }));
      out.push(S(kind, `${kind}-${a.k}`, L(a.n), L([a.note[1], a.note[0]]), items, { firstIsClear: true, kind, key: a.k, metric: a.m }));
    }
  }
  // Títulos
  if (!recOK) out.push(S('tit', 'tit-wait', '', s.loadingRecords, [], { empty: true }), S('cat', 'cat-wait', '', s.loadingRecords, [], { empty: true }));
  const ordered = sealStats.slice().sort((a, b) => (a.se.tier - b.se.tier) || (b.done / b.total - a.done / a.total));
  for (const x of ordered) {
    const items = x.recs.map(r => { const st = recState(r[0]); return I('t-' + r[0], L(r[1]), L(r[2]), [progText(st) || U.chip[['Fácil', 'Médio', 'Difícil', 'Muito difícil', 'Evento'][x.se.tier - 1]]].filter(Boolean), recDone(st)); });
    out.push(S('tit', 'seal-' + x.se.cr, L(x.se.t), s.tierNote[x.se.tier - 1] + '. ' + L(x.se.ds), items, { coll: true, titleSeal: true }));
  }
  // Drops: exóticos
  const cls = ch.classType;
  // Toda a coleção que ainda dá para obter: o que você já tem aparece marcado, para mostrar o progresso de cada grupo.
  const obtainable = defs.exotics.filter(e => (e.t === 'w' || e.c === cls) && (colAcquired(e.h) || colMissing(e.h)));
  const XG = { archive: 'archive', xur: 'explore', engram: 'explore', lost: 'explore', other: 'explore', mission: 'mission', dungeon: 'dungeon', raid: 'raid', season: 'season' };
  const byG = {};
  for (const e of obtainable) { const g = srcGroup(e.s[0]), k = e.t === 'a' ? 'armor' : XG[g[0]]; (byG[k] = byG[k] || []).push([e, g]); }
  if (have.a) for (const k of ['archive', 'armor', 'explore', 'mission', 'dungeon', 'raid', 'season']) if (byG[k]) {
    const list = byG[k].map(([e, g]) => ({ e, g, has: colAcquired(e.h) })).sort((a, b) => (a.has - b.has) || ['Fácil', 'Médio', 'Difícil'].indexOf(a.g[1]) - ['Fácil', 'Médio', 'Difícil'].indexOf(b.g[1]));
    out.push(S('exo', 'exo-' + k, k === 'armor' ? s.xg.armor(U.classes[cls]) : s.xg[k], s.xn[k], list.map(x => I('x-' + x.e.h[0], L(x.e.n), L(x.e.s), [U.chip[x.g[1]], U.chip[x.g[2]]], x.has))));
  }
  // Drops: catalisadores
  const catRows = !recOK ? [] : defs.cats.map(c => ({ c, r: recState(c.h) })).filter(x => x.r && !(x.r.state & 16));
  const catSrc = c => { const k = c.n[0].replace(/ Catalyst$/, ''); return defs.catsrc[k] ? L(defs.catsrc[k]) : ''; };
  const prog = catRows.filter(x => !recDone(x.r) && pct(x.r) > 0).sort((a, b) => pct(b.r) - pct(a.r));
  const fresh = catRows.filter(x => !recDone(x.r) && pct(x.r) === 0);
  if (prog.length) out.push(S('cat', 'cat-prog', s.catProg, s.catProgNote, prog.map(x => I('c-' + x.c.h, L(x.c.n), L(x.c.d), [progText(x.r) || Math.round(pct(x.r) * 100) + '%'], false))));
  if (fresh.length) out.push(S('cat', 'cat-new', s.catNew, s.catNewNote, fresh.map(x => I('c-' + x.c.h, L(x.c.n), [catSrc(x.c), L(x.c.d)].filter(Boolean).join(' '), [], false))));
  SECTIONS = out; SECTIONS_PREV = out;
  // Loadouts
  const inst = instanceMap();
  LOADOUTS = (p.characterLoadouts?.data?.[charId]?.loadouts || []).map((l, i) => ({ i, name: loadoutNames[l.nameHash]?.n || `Loadout ${i + 1}`, items: (l.items || []).map(x => itemNames[inst[x.itemInstanceId]]?.n).filter(Boolean) })).filter(l => l.items.length);
}

/* ---------- novidades: faixa da semana, build, conclusões e aba Guardião ---------- */
const XUR_VENDOR = 2190858386, STRANGE_COIN = 800069450;
const RANK_PROGS = [457612306, 3011295063, 1807348350, 689153319, 584850370];
const COUNT_METRICS = [740213466, 2959623395, 26751835, 3264536674];
const OPTS = Object.assign({ week: true, clears: true, build: true }, LS.get('dc-opts', {}));
const ARTIFACT_BUCKET = 1506418338;
const AMMO = {};
/* Tipo de munição: 1 primária (branca), 2 especial (verde), 3 pesada (roxa) */
const AMMO_COLOR = { 1: '#f2f4f7', 2: '#7fe08f', 3: '#b98cff' };
const AMMO_PATH = 'M5 14V6.2L8 2l3 4.2V14z';
const ammoSVG = t => AMMO_COLOR[t] ? `<svg viewBox="0 0 ${t * 7 + 3} 16" height="16" aria-hidden="true">${Array.from({ length: t }, (_, k) => `<path transform="translate(${k * 7 - 3.5} 0)" d="${AMMO_PATH}" fill="${AMMO_COLOR[t]}"/>`).join('')}</svg>` : '';
let weekReady = { x: false, m: false }, weekT = null;
function resetChar() { VEND = null; VAULT = null; XUR = null; MSN = {}; BUILD = null; GD = null; weekReady = { x: false, m: false }; clearTimeout(weekT); weekT = null; }
const EMBLEMS = {};
let MSL = {}, ACTN = {};
let XUR = null, MSN = {}, BUILD = null, buildOpen = false, GD = null, gdLoading = false;
const rtf = () => { try { return new Intl.RelativeTimeFormat(lang === 'pt' ? 'pt-BR' : 'en', { numeric: 'auto' }); } catch { return null; } };
// O Xûr chega na sexta às 17h UTC e sai no reset de terça; fora disso a API ainda pode devolver o estoque antigo
function xurLeaves() { const d = new Date(); d.setUTCHours(17, 0, 0, 0); while (d.getUTCDay() !== 5 || d > Date.now()) d.setUTCDate(d.getUTCDate() - 1); return d.getTime() + 4 * 864e5; }
function nextReset() { const d = new Date(); d.setUTCHours(17, 0, 0, 0); while (d.getUTCDay() !== 2 || d <= Date.now()) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); }
function cd(ms) { const m = Math.max(0, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d}d ${h}h` : h ? `${h}h ${String(mm).padStart(2, '0')}min` : `${mm}min`; }
const fmtN = n => Number(n || 0).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');

/* Xûr: o que ele vende agora (só aparece quando ele está no jogo) */
async function loadXur(my) {
  try {
    const r = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/Character/${charId}/Vendors/${XUR_VENDOR}/?components=400,402`);
    const sales = Object.values(r.sales?.data || {});
    const hs = sales.map(s => s.itemHash);
    const en = await entities('DestinyInventoryItemDefinition', hs, 'en'); if (my !== gen) return;
    const loc = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', hs, 'pt') : en; if (my !== gen) return;
    // o Xûr vai embora no reset de terça; a data de "renovação" da API (sexta) não é a saída dele
    XUR = { until: new Date(xurLeaves()).toISOString(), items: sales.filter(s => en[s.itemHash]?.tt === 6).map(s => ({ ic: loc[s.itemHash]?.ic || en[s.itemHash].ic, tl: loc[s.itemHash]?.tl || '', en: en[s.itemHash].n, n: loc[s.itemHash]?.n || en[s.itemHash].n, cost: (s.costs || []).find(c => c.itemHash === STRANGE_COIN)?.quantity || 0 })) };
  } catch { XUR = null; }
  if (my === gen) { weekReady.x = true; build(); render(); }
}
const coins = () => { let n = 0; for (const it of profile.profileInventory?.data?.items || []) if (it.itemHash === STRANGE_COIN) n += it.quantity || 0; for (const it of profile.profileCurrencies?.data?.items || []) if (it.itemHash === STRANGE_COIN) n += it.quantity || 0; return n; };
function xurMissing() {
  if (!XUR || !have.a) return [];
  const cls = profile.characters.data[charId].classType;
  return XUR.items.filter(x => { const e = exoticByName(x.en); return e && (e.t === 'w' || e.c === cls) && colMissing(e.h); });
}
/* Rotação: incursões e masmorras com desafios ativos nos marcos do personagem */
async function loadMilestones(my) {
  const ms = profile.characterProgressions?.data?.[charId]?.milestones; if (!ms) { weekReady.m = true; build(); render(); return; }
  const hs = Object.keys(ms).map(Number), acts = Object.values(ms).flatMap(m => (m.activities || []).filter(a => (a.challenges || []).length).map(a => a.activityHash));
  const d = await entities('DestinyMilestoneDefinition', hs, 'en'); if (my !== gen) return;
  const dl = lang === 'pt' ? await entities('DestinyMilestoneDefinition', hs, 'pt') : d; if (my !== gen) return;
  ACTN = await entities('DestinyActivityDefinition', acts, lang); if (my !== gen) return;
  MSN = d; MSL = dl; weekReady.m = true; build(); render();
}
function featured() {
  const ms = profile.characterProgressions?.data?.[charId]?.milestones || {}, out = { raid: new Set(), dg: new Set(), ends: null };
  for (const m of Object.values(ms)) {
    const name = (MSN[m.milestoneHash]?.n || '').toLowerCase(); if (!name) continue;
    if (!(m.activities || []).some(a => (a.challenges || []).length)) continue;
    for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) { const a = list.find(x => x.n[0].toLowerCase() === name); if (a) { out[kind].add(a.k); if (m.endDate) out.ends = Math.min(out.ends || Infinity, Date.parse(m.endDate)); } }
  }
  return out;
}
/* Painel "Esta semana" em Objetivos: desafios e recompensas semanais, Xûr e rotação; a nota mostra o reset */
function weekSection() {
  const W = u().w, items = [], t = Date.now(), ms = profile.characterProgressions?.data?.[charId]?.milestones || {};
  if (have.a && weekReady.m) for (const m of Object.values(ms)) {
    const name = MSL[m.milestoneHash]?.n || MSN[m.milestoneHash]?.n; if (!name) continue;
    if (m.endDate && Date.parse(m.endDate) <= t) continue;
    for (const a of m.activities || []) for (const c of a.challenges || []) {
      const o = c.objective || {}, an = ACTN[a.activityHash]?.n || name, cv = o.completionValue || 1;
      items.push(I(`wk-${m.milestoneHash}-${a.activityHash}-${o.objectiveHash || 0}`, W.wkChallenge(an), W.wkChallengeD, [`${Math.min(o.progress || 0, cv)}/${cv}`, U_CHIP_WEEK()], !!o.complete));
    }
    const rw = (m.rewards || []).flatMap(r => r.entries || []);
    if (rw.length) { const red = rw.filter(e => e.redeemed).length, earn = rw.filter(e => e.earned).length; items.push(I(`wk-${m.milestoneHash}-rw`, W.wkRewardT(name), earn > red ? W.wkClaim(earn - red) : W.wkRewardsD, [`${red}/${rw.length}`, U_CHIP_WEEK()], red === rw.length)); }
    for (const q of m.availableQuests || []) if (q.status) items.push(I(`wk-${m.milestoneHash}-q`, name, W.wkQuestD, [q.status.completed ? '✓' : q.status.started ? W.wkStarted : W.wkNew], !!q.status.completed));
  }
  const miss = xurMissing();
  // o Xûr fica em Arsenal → Vendedores
  const f = featured(), feat = [...[...f.raid].map(k => 'raid-' + k), ...[...f.dg].map(k => 'dg-' + k)].map(id => SECTIONS_PREV.find(s => s.id === id)).filter(Boolean);
  const featTxt = feat.length ? ' ' + W.featured + feat.map(s => s.title).join(' · ') + '.' : '';
  const waiting = !(have.a && weekReady.m && weekReady.x);
  return S('obj', 'week', W.week, (waiting ? u().loadingDefs + ' ' : '') + W.resetNote(cd(nextReset() - t)) + featTxt, items.sort((a, b) => a.auto - b.auto), { weekly: true, coll: true });
}
const U_CHIP_WEEK = () => u().w.weeklyChip;
let SECTIONS_PREV = [];
let WK = [];
function weekItems() {
  const W = u().w, it = [], t = Date.now();
  const miss = xurMissing();
  if (miss.length && XUR.until && Date.parse(XUR.until) > t) it.push({ cls: 'xur', ic: '◆', t: W.xurSells(miss.map(x => x.n).join(', ')), s: W.xurSub(miss[0].cost, have.c ? coins() : null, cd(Date.parse(XUR.until) - t)), to: null });
  const f = featured(), feat = [...[...f.raid].map(k => 'raid-' + k), ...[...f.dg].map(k => 'dg-' + k)].map(id => SECTIONS.find(s => s.id === id)).filter(s => s && !s.items.every(isDone));
  if (feat.length) { const ex = feat.map(s => s.items.find(i => i.isEx && !isDone(i))).find(Boolean); it.push({ cls: 'rot', ic: '★', t: W.featured + feat.map(s => s.title).join(' · '), s: ex ? W.missingEx(ex.exName) : W.untilReset, to: [feat[0].tab, feat[0].id] }); }
  it.push({ cls: 'reset', ic: '↻', t: W.reset, s: W.resetSub(cd(nextReset() - t)), to: null });
  return it.slice(0, 3);
}
function renderWeek() {
  const el = $('week'); if (!el) return;
  // a faixa só aparece completa (Xûr e rotação já conferidos), para não crescer na frente da pessoa
  WK = []; el.hidden = true; // a faixa do topo foi para o painel "Esta semana" em Objetivos
  el.innerHTML = WK.length ? `<div class="week-k">${esc(u().w.week)}</div><div class="week-items">${WK.map((w, i) => `<button class="wk ${w.cls}" type="button" data-wk="${i}"${w.to ? '' : ' tabindex="-1"'}><span class="wk-ic" aria-hidden="true">${w.ic}</span><span class="wk-t">${esc(w.t)}</span><span class="wk-s">${esc(w.s)}</span></button>`).join('')}</div>` : '';
}
function jumpTo(t, id) { go(t); requestAnimationFrame(() => { const sec = document.querySelector(`[data-sec="${id}"]`); if (!sec) return; const h = sec.querySelector('.sec-head[data-coll]'); if (h && sec.classList.contains('collapsed')) toggleSec(h); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
function secMeta(sec) {
  const W = u().w, c = [], f = featured(), n = metric(sec.metric);
  if (f[sec.kind].has(sec.key) && (!f.ends || f.ends > Date.now())) c.push(`<span class="chip feat">${esc(W.featWeek)}</span>`);
  if (n && have.a) c.push(`<span class="chip clr">${esc(W.clears(n))}</span>`);
  return c.length ? `<div class="sec-meta">${c.join('')}</div>` : '';
}

/* Build equipada: abre ao tocar nos ícones do cabeçalho */
/* Nomes, ícones e munição de tudo que o personagem tem equipado (serve para você e para quem você buscar) */
async function fetchBuild(p, cid) {
  const eq = p.characterEquipment?.data?.[cid]?.items || [], sk = p.itemComponents?.sockets?.data;
  if (!sk || !eq.length) return null;
  const plugs = []; for (const i of eq) for (const s of sk[i.itemInstanceId]?.sockets || []) if (s.plugHash && s.isVisible !== false) plugs.push(s.plugHash);
  const all = [...plugs, ...eq.map(i => i.itemHash)];
  const en = await entities('DestinyInventoryItemDefinition', all, 'en');
  const loc = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', all, 'pt') : en;
  const wh = eq.filter(i => [1498876634, 2465295065, 953998645].includes(i.bucketHash)).map(i => i.itemHash).filter(h => AMMO[h] == null);
  await Promise.all(wh.map(h => bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false).then(d => { AMMO[h] = d.equippingBlock?.ammoType || 0; }).catch(() => {})));
  // artefato: desde Monumento do Triunfo é um item equipado (7 artefatos para escolher); as vantagens escolhidas são os encaixes dele
  const ai = eq.find(i => i.bucketHash === ARTIFACT_BUCKET);
  const artPerks = ai ? (sk[ai.itemInstanceId]?.sockets || []).map(x => x.plugHash).filter(h => h && en[h]?.n && !SKIP_NAME.test(en[h].n) && !/Empty|Default/i.test(en[h].n)) : [];
  return { en, loc, sets: await armorSets(eq), art: ai && artPerks.length ? { h: ai.itemHash, perks: artPerks } : null };
}
async function loadBuild(my) {
  const b = await fetchBuild(profile, charId); if (my !== gen || !b) return;
  BUILD = b; if (buildOpen) renderBuild(); if (FD.cmp) renderFind();
}
/* Bônus de conjunto da armadura: conta as peças equipadas de cada conjunto e marca os bônus ativos */
const SETOF = {}, SETDEF = {};
async function armorSets(eq) {
  const lc = lang === 'pt' ? 'pt-br' : 'en', arm = eq.filter(i => [3448274439, 3551918588, 14239492, 20886954, 1585787867].includes(i.bucketHash));
  await Promise.all(arm.filter(i => SETOF[i.itemHash] === undefined).map(i => bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${i.itemHash}/`, false).then(d => { SETOF[i.itemHash] = d.equippingBlock?.equipableItemSetHash || 0; }).catch(() => { SETOF[i.itemHash] = 0; })));
  const count = {}; for (const i of arm) { const h = SETOF[i.itemHash]; if (h) count[h] = (count[h] || 0) + 1; }
  const out = [];
  for (const [h, n] of Object.entries(count)) {
    const key = h + ':' + lc;
    if (!SETDEF[key]) { try { const d = await bungie(`/Destiny2/Manifest/DestinyEquipableItemSetDefinition/${h}/?lc=${lc}`, false); const perks = await Promise.all((d.setPerks || []).map(p => bungie(`/Destiny2/Manifest/DestinySandboxPerkDefinition/${p.sandboxPerkHash}/?lc=${lc}`, false).then(sp => ({ c: p.requiredSetCount, n: sp.displayProperties?.name || '', d: sp.displayProperties?.description || '', ic: sp.displayProperties?.icon || '' })).catch(() => null))); SETDEF[key] = { n: d.displayProperties?.name || '', perks: perks.filter(Boolean).sort((a, b) => a.c - b.c) }; } catch { continue; } }
    out.push({ n: SETDEF[key].n, count: n, perks: SETDEF[key].perks.map(p => ({ ...p, on: n >= p.c })) });
  }
  return out.sort((a, b) => b.count - a.count);
}
const ownCtx = () => ({ p: profile, cid: charId, B: BUILD, name: member?.name || '' });
const SKIP_NAME = /^(Empty|Default|Upgrade Armor|Locked|No |Restore Defaults|Kill Tracker|Tracker Disabled|Change Energy|Deepsight)/i;
const SKIP_TYPE = /Shader|Ornament|Memento|Tracker|Flair|Emote|Transmat|Projection/i;
function buildHTML(C = ownCtx()) {
  const W = u().w, B = C.B; if (!B) return `<p class="b-note">${esc(u().loadingDefs)}</p>`;
  const inst = C.p.itemComponents?.instances?.data || {}, sk = C.p.itemComponents?.sockets?.data || {};
  const eq = (C.p.characterEquipment?.data?.[C.cid]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).sort((a, b) => GEAR_BUCKETS.indexOf(a.bucketHash) - GEAR_BUCKETS.indexOf(b.bucketHash));
  const chip = (h, cls) => { const d = B.loc[h] || B.en[h] || {}; return `<span class="${cls || ''}">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : ''}${esc(d.n)}</span>`; };
  const plugsOf = i => { const own = B.en[i.itemHash]?.tl || ''; return (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => { const e = B.en[h]; return e && e.n && !SKIP_NAME.test(e.n) && !SKIP_TYPE.test(e.tl) && e.tl !== own; }); };
  const row = (i, body) => { const d = B.loc[i.itemHash] || {}, pw = i.bucketHash === SUB_BUCKET ? 0 : inst[i.itemInstanceId]?.primaryStat?.value; return `<div class="b-row${d.tt === 6 ? ' exo' : ''}"><div class="b-name">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : ''}<span>${esc(d.n)}</span>${AMMO[i.itemHash] ? `<span class="ammo" title="${esc(u().w.ammo[AMMO[i.itemHash]])}" aria-label="${esc(u().w.ammo[AMMO[i.itemHash]])}">${ammoSVG(AMMO[i.itemHash])}</span>` : ''}<small>${esc(d.tl || '')}${pw && pw > 0 ? ` · <b>${pw}</b>` : ''}</small></div>${body}</div>`; };
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET);
  let html = '';
  if (sub) {
    const ps = plugsOf(sub), t = h => B.en[h]?.tl || '';
    const sup = ps.filter(h => /Super/.test(t(h))), asp = ps.filter(h => /Aspect/.test(t(h))), fr = ps.filter(h => /Fragment/.test(t(h))), ab = ps.filter(h => !sup.includes(h) && !asp.includes(h) && !fr.includes(h));
    html += `<div class="b-grp">${row(sub, `<div class="b-perks">${sup.map(h => chip(h, 'mw')).join('')}${ab.map(h => chip(h)).join('')}</div>${asp.length ? `<div class="b-perks"><span class="k">${esc(W.aspects)}</span>${asp.map(h => chip(h)).join('')}</div>` : ''}${fr.length ? `<div class="b-perks"><span class="k">${esc(W.frags)}</span>${fr.map(h => chip(h)).join('')}</div>` : ''}`)}</div>`;
  }
  const grp = (k, list) => list.length ? `<div class="b-grp"><div class="b-k">${esc(k)}</div>${list.map(i => row(i, `<div class="b-perks">${plugsOf(i).map(h => { const e = B.en[h]; return chip(h, /^Masterworked|^Tier \d/i.test(e.n) || /Intrinsic/i.test(e.tl) ? 'mw' : ''); }).join('')}</div>`)).join('')}</div>` : '';
  const sets = (B.sets || []).map(st => `<div class="b-set"><div class="b-set-h"><b>${esc(st.n)}</b><small>${esc(W.setPieces(st.count))}</small></div>${st.perks.map(pk => `<div class="b-set-p${pk.on ? ' on' : ''}"><span class="b-set-c">${esc(W.setReq(pk.c))}</span><span><b>${esc(pk.n)}</b>${pk.d ? `<small>${esc(pk.d)}</small>` : ''}</span></div>`).join('')}</div>`).join('');
  html += `<div class="b-cols">${grp(W.weapons, eq.filter(i => [1498876634, 2465295065, 953998645].includes(i.bucketHash)))}<div>${grp(W.armor, eq.filter(i => [3448274439, 3551918588, 14239492, 20886954, 1585787867].includes(i.bucketHash)))}${sets ? `<div class="b-grp b-sets"><div class="b-k">${esc(W.setT)}</div>${sets}</div>` : ''}</div></div>`;
  if (B.art) html += `<div class="b-grp"><div class="b-k">${esc(W.artT)}${B.art.h && B.loc[B.art.h]?.n ? ' · ' + esc(B.loc[B.art.h].n) : ''}</div><div class="b-row"><div class="b-perks">${B.art.perks.map(h => chip(h)).join('')}</div></div></div>`;
  const cam = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  return `<div class="b-top"><div class="b-k">${sub ? esc(W.subclass) : ''}</div><button class="b-link" type="button" title="${esc(W.myLink)}" aria-label="${esc(W.myLink)}">${LINK_ICON}</button><button class="b-cam" type="button" title="${esc(W.share)}" aria-label="${esc(W.share)}">${cam}</button></div>` + html;
}
/* ---------- imagem da build para compartilhar ----------
   Desenha o conteúdo numa tela transparente, anotando os cartões; no fim compõe:
   fundo + brilho da cor da subclasse, cartões, conteúdo, e corta na altura usada. */
const STAT_ORDER = [2996146975, 392767087, 1943323491, 1735777505, 144602215, 4244567218];
const imgCache = new Map();
function loadImg(path) {
  if (!path) return Promise.resolve(null);
  if (!imgCache.has(path)) imgCache.set(path, fetch(BNET + path, { mode: 'cors' }).then(r => r.ok ? r.blob() : null).then(b => b ? createImageBitmap(b) : null).catch(() => null));
  return imgCache.get(path);
}
const ELEMENT_ACC = { prismatic: ['#e57ce0', '#5cc6f2'], arc: ['#6fd3ff', '#a8f0ff'], solar: ['#f5a13c', '#ffd36e'], void: ['#b48cff', '#e07cf0'], stasis: ['#6fa8ff', '#b6e4ff'], strand: ['#5fe39a', '#c6ff7a'] };
async function buildShareCanvas(C, S = 1, MAXH = 4400) {
  const W = u().w, B = C.B, ch = C.p.characters.data[C.cid], U = u();
  try { await Promise.all(['700 40px Rajdhani', '500 20px "IBM Plex Sans"', '600 20px "IBM Plex Sans"', '500 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch {}
  const statDefs = await entities('DestinyStatDefinition', STAT_ORDER, lang);
  const eq = (C.p.characterEquipment?.data?.[C.cid]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).sort((a, b) => GEAR_BUCKETS.indexOf(a.bucketHash) - GEAR_BUCKETS.indexOf(b.bucketHash));
  const inst = C.p.itemComponents?.instances?.data || {}, sk = C.p.itemComponents?.sockets?.data || {};
  const def = h => B.loc[h] || B.en[h] || {};
  const subI = eq.find(i => i.bucketHash === SUB_BUCKET), [acc, acc2] = ELEMENT_ACC[ELEMENTS[B.en[subI?.itemHash]?.dt]] || ELEMENT_ACC.arc;
  const plugsOf = i => { const own = B.en[i.itemHash]?.tl || ''; return (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => { const e = B.en[h]; return e && e.n && !SKIP_NAME.test(e.n) && !SKIP_TYPE.test(e.tl) && e.tl !== own; }); };
  const emDef = EMBLEMS[ch.emblemHash] || (EMBLEMS[ch.emblemHash] = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${ch.emblemHash}/`, false).catch(() => ({})));
  const emWide = emDef.secondarySpecial, emIcon = emDef.displayProperties?.icon;
  const paths = new Set([ch.emblemBackgroundPath, emWide, emIcon]);
  for (const i of eq) { paths.add(def(i.itemHash).ic); for (const h of plugsOf(i)) paths.add(def(h).ic); }
  for (const h of STAT_ORDER) paths.add(statDefs[h]?.ic);
  await Promise.all([...paths].filter(Boolean).map(loadImg));

  const Wd = 1080, PAD = 48, IN = PAD + 28, CW = Wd - PAD * 2;
  const cv = document.createElement('canvas'); cv.width = Wd * S; cv.height = Math.ceil(MAXH * S);
  const x = cv.getContext('2d'), cards = []; x.scale(S, S); x.imageSmoothingQuality = 'high';
  const F = { d: s => `700 ${s}px Rajdhani, "Arial Narrow", sans-serif`, b: (s, w = 500) => `${w} ${s}px "IBM Plex Sans", system-ui, sans-serif`, m: s => `500 ${s}px "IBM Plex Mono", ui-monospace, monospace` };
  const rr = (c, X, Y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(X, Y, w, h, r); else c.rect(X, Y, w, h); };
  const icon = (p, X, Y, s, r = 8, ring) => { return loadImg(p).then(im2 => { x.save(); rr(x, X, Y, s, s, r); x.clip(); if (im2) x.drawImage(im2, X, Y, s, s); else { x.fillStyle = 'rgba(255,255,255,.1)'; x.fill(); } x.restore(); if (ring) { x.save(); rr(x, X + 1, Y + 1, s - 2, s - 2, r); x.strokeStyle = ring; x.lineWidth = 2.5; x.stroke(); x.restore(); } }); };
  const fit = (s, maxW) => { s = String(s ?? ''); if (maxW) while (s.length > 1 && x.measureText(s).width > maxW) s = s.slice(0, -2).trimEnd() + '…'; return s; };
  const text = (t, X, Y, font, color, align = 'left', maxW) => { x.font = font; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic'; const s = fit(t, maxW); x.fillText(s, X, Y); return x.measureText(s).width; };
  const label = (t, Y) => { text(t.toUpperCase(), PAD + 4, Y, F.m(22), '#8f9bb0'); return Y + 20; };
  const GOLD = '#f3d77a';
  const chips = async (hs, X, Y, maxW, hl, sm) => {
    let cx = X, cy = Y; const H = sm ? 40 : 48, IS = sm ? 30 : 36, FS = sm ? 20 : 23;
    for (const h of hs) {
      const d = def(h), on = hl && hl(h); x.font = F.b(FS, 500);
      const w = Math.min(maxW, IS + 12 + x.measureText(d.n).width + 18);
      if (cx > X && cx + w > X + maxW) { cx = X; cy += H + (sm ? 8 : 10); }
      x.save(); rr(x, cx, cy, w, H, sm ? 8 : 10); x.fillStyle = on ? 'rgba(243,215,122,.14)' : 'rgba(255,255,255,.075)'; x.fill(); x.restore();
      await icon(d.ic, cx + 5, cy + 5, IS, 6);
      text(d.n, cx + IS + 14, cy + (sm ? 27 : 32), F.b(FS, 500), on ? GOLD : '#dfe5ee', 'left', w - IS - 24);
      cx += w + (sm ? 8 : 10);
    }
    return hs.length ? cy + H : Y;
  };

  // cabeçalho com o emblema
  // Cabeçalho: a arte larga do emblema vira um fundo desfocado (ela é pequena demais para ficar nítida ampliada)
  // e o ícone do emblema aparece em tamanho que não estoura
  const HH = 240, wide = await loadImg(emWide), eic = await loadImg(emIcon), em = wide || eic ? null : await loadImg(ch.emblemBackgroundPath);
  x.fillStyle = '#1b2232'; x.fillRect(0, 0, Wd, HH);
  if (wide) { const s = Math.max(Wd / wide.width, HH / wide.height) * 1.08, w = wide.width * s, h = wide.height * s; const t = document.createElement('canvas'); t.width = Math.max(8, Math.round(w / 14)); t.height = Math.max(4, Math.round(h / 14)); const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(wide, 0, 0, t.width, t.height); x.save(); x.imageSmoothingQuality = 'high'; x.drawImage(t, (Wd - w) / 2, (HH - h) / 2, w, h); x.restore(); }
  else if (em) { const s = HH / em.height; x.drawImage(em, 0, 0, em.width * s, HH); }
  const og = x.createLinearGradient(0, 0, Wd, 0); og.addColorStop(0, 'rgba(14,18,28,0)'); og.addColorStop(.22, 'rgba(14,18,28,.5)'); og.addColorStop(.6, 'rgba(14,18,28,.78)'); og.addColorStop(1, 'rgba(14,18,28,.94)'); x.fillStyle = og; x.fillRect(0, 0, Wd, HH);
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), sd = sub ? def(sub.itemHash) : {};
  const el = ELEMENTS[B.en[sub?.itemHash]?.dt] || '';
  const elName = { prismatic: ['Prismatic', 'Prismático'], arc: ['Arc', 'Arco'], solar: ['Solar', 'Solar'], void: ['Void', 'Vácuo'], stasis: ['Stasis', 'Estase'], strand: ['Strand', 'Filamento'] }[el];
  const cls = U.classes[ch.classType] || '';
  let hx = em ? 270 : PAD;
  if (eic) { x.save(); x.fillStyle = 'rgba(0,0,0,.35)'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 18; rr(x, PAD, (HH - 112) / 2, 112, 112, 12); x.fill(); x.restore(); await icon(emIcon, PAD, (HH - 112) / 2, 112, 12, 'rgba(255,255,255,.35)'); hx = PAD + 112 + 30; }
  text((C.name || '').toUpperCase(), hx, 100, F.m(24), '#c3ccda', 'left', 560);
  { const tt = charTitle(cls, sd.n), mw = Wd - hx - 290; let fs = 70; x.font = F.d(fs); while (x.measureText(tt).width > mw && fs > 34) { fs -= 2; x.font = F.d(fs); } text(tt, hx - 3, 170, F.d(fs), '#ffffff', 'left', mw); }
  text(String(ch.light), Wd - PAD, 160, F.d(96), GOLD, 'right');
  x.font = F.d(96); const pwW = x.measureText(String(ch.light)).width; text('✦', Wd - PAD - pwW - 8, 120, F.d(40), GOLD, 'right');
  text(U.power.toUpperCase(), Wd - PAD, 196, F.m(20), '#c3ccda', 'right');
  const bar = x.createLinearGradient(0, 0, Wd, 0); bar.addColorStop(0, acc); bar.addColorStop(1, acc2); x.fillStyle = bar; x.fillRect(0, HH, Wd, 8);
  let y = HH + 66;

  // subclasse
  if (sub) {
    const ps = plugsOf(sub), t = h => B.en[h]?.tl || '';
    const sup = ps.filter(h => /Super/.test(t(h))), asp = ps.filter(h => /Aspect/.test(t(h))), fr = ps.filter(h => /Fragment/.test(t(h))), ab = ps.filter(h => !sup.includes(h) && !asp.includes(h) && !fr.includes(h));
    y = label(W.subclass, y) + 16; const top = y; y += 28;
    await icon(sd.ic, IN, y, 104, 52);
    text(sd.n, IN + 128, y + 50, F.d(58), '#ffffff', 'left', CW - 190);
    if (sup[0]) { const d = def(sup[0]); await icon(d.ic, IN + 128, y + 64, 38, 6); text(d.n, IN + 176, y + 92, F.b(27, 600), GOLD, 'left', CW - 240); }
    y += 132;
    const colW = (CW - 56 - 20) / 2;
    for (let k = 0; k < ab.length; k++) { const d = def(ab[k]), cx = IN + (k % 2) * (colW + 20), cy = y + Math.floor(k / 2) * 72; await icon(d.ic, cx, cy, 56, 8); text(d.tl || '', cx + 70, cy + 22, F.m(17), '#8f9bb0', 'left', colW - 78); text(d.n, cx + 70, cy + 49, F.b(25, 600), '#e9eef5', 'left', colW - 78); }
    y += Math.ceil(ab.length / 2) * 72;
    for (const [lbl, list] of [[W.aspects, asp], [W.frags, fr]]) if (list.length) { y += 16; text(lbl.toUpperCase(), IN, y + 18, F.m(18), '#8f9bb0'); y = await chips(list, IN, y + 30, CW - 56); }
    const st = STAT_ORDER.filter(h => ch.stats?.[h] != null);
    if (st.length) {
      y += 24; const tw = (CW - 56 - 10 * (st.length - 1)) / st.length;
      for (let k = 0; k < st.length; k++) { const h = st[k], cx = IN + k * (tw + 10); x.save(); rr(x, cx, y, tw, 108, 12); x.fillStyle = 'rgba(255,255,255,.06)'; x.fill(); x.restore(); await icon(statDefs[h]?.ic, cx + (tw - 32) / 2, y + 12, 32, 4); text(ch.stats[h], cx + tw / 2, y + 80, F.d(40), '#ffffff', 'center'); text(statDefs[h]?.n || '', cx + tw / 2, y + 99, F.m(14), '#8f9bb0', 'center', tw - 10); }
      y += 108;
    }
    y += 28; cards.push({ y: top, h: y - top });
    y += 44;
  }
  // armas
  const wpns = eq.filter(i => [1498876634, 2465295065, 953998645].includes(i.bucketHash));
  if (wpns.length) {
    y = label(W.weapons, y) + 16;
    for (const i of wpns) {
      const d = def(i.itemHash), pw = inst[i.itemInstanceId]?.primaryStat?.value, top = y, exo = d.tt === 6;
      await icon(d.ic, IN - 4, top + 26, 88, 10, exo ? 'rgba(243,215,122,.9)' : 'rgba(255,255,255,.28)');
      const nw = text(d.n, IN + 112, top + 64, F.d(46), exo ? GOLD : '#ffffff', 'left', CW - 260); const am = AMMO[i.itemHash];
      if (AMMO_COLOR[am]) { x.save(); x.fillStyle = AMMO_COLOR[am]; for (let k = 0; k < am; k++) { x.save(); x.translate(IN + 112 + nw + 16 + k * 15, top + 30); x.scale(2, 2); x.translate(-5, 0); x.fill(new Path2D(AMMO_PATH)); x.restore(); } x.restore(); }
      text(`${d.tl || ''}${pw > 0 ? '  ·  ✦' + pw : ''}`, IN + 112, top + 100, F.m(22), '#b9c3d3', 'left', CW - 200);
      const end = await chips(plugsOf(i), IN + 112, top + 122, CW - 56 - 112, h => /^Masterworked|^Tier \d/i.test(B.en[h]?.n || '') || /Intrinsic/i.test(B.en[h]?.tl || ''));
      y = Math.max(end, top + 120) + 26; cards.push({ y: top, h: y - top, exo }); y += 14;
    }
    y += 40;
  }
  // armaduras
  const arm = eq.filter(i => [3448274439, 3551918588, 14239492, 20886954, 1585787867].includes(i.bucketHash));
  if (arm.length) {
    y = label(W.armor, y) + 16;
    for (const i of arm) {
      const d = def(i.itemHash), exo = d.tt === 6, top = y, ps = plugsOf(i);
      await icon(d.ic, IN - 4, top + 20, 76, 8, exo ? 'rgba(243,215,122,.9)' : 'rgba(255,255,255,.28)');
      text(d.n, IN + 92, top + 54, F.b(29, 600), exo ? GOLD : '#ffffff', 'left', CW - 140);
      const end = await chips(ps, IN + 92, top + 70, CW - 56 - 92, h => /Intrinsic/i.test(B.en[h]?.tl || ''), true);
      y = Math.max(end, top + 96) + 22; cards.push({ y: top, h: y - top, exo }); y += 12;
    }
    y += 30;
  }
  // bônus de conjunto
  if ((B.sets || []).length) {
    y = label(W.setT, y) + 16;
    for (const st of B.sets) {
      const top = y; y += 50;
      text(st.n, IN, y, F.d(40), '#ffffff', 'left', CW - 260); text(W.setPieces(st.count), PAD + CW - 28, y, F.m(22), '#b9c3d3', 'right');
      y += 18;
      for (const pk of st.perks) {
        y += 40; const c = pk.on ? GOLD : '#7d8899';
        x.save(); rr(x, IN, y - 28, 120, 38, 8); x.fillStyle = pk.on ? 'rgba(243,215,122,.14)' : 'rgba(255,255,255,.06)'; x.fill(); x.restore();
        text(W.setReq(pk.c), IN + 60, y - 2, F.m(20), c, 'center');
        text(pk.n, IN + 138, y, F.b(27, 600), pk.on ? '#ffffff' : '#9aa5b5', 'left', CW - 200);
        if (pk.d) { x.font = F.b(21); const words = pk.d.split(/\s+/); let line = '', lines = []; for (const w of words) { const t2 = line ? line + ' ' + w : w; if (x.measureText(t2).width > CW - 200) { lines.push(line); line = w; } else line = t2; } if (line) lines.push(line); for (const ln of lines.slice(0, 3)) { y += 30; text(ln, IN + 138, y, F.b(21), '#9aa5b5'); } }
        y += 10;
      }
      y += 26; cards.push({ y: top, h: y - top, exo: false }); y += 14;
    }
    y += 30;
  }
  // artefato sazonal
  if (B.art) {
    y = label(W.artT + (B.art.h && def(B.art.h).n ? ' · ' + def(B.art.h).n : ''), y) + 16;
    const top = y; y = await chips(B.art.perks, IN, y + 24, CW - 56, null, true); y += 24; cards.push({ y: top, h: y - top, exo: false }); y += 44;
  }
  // rodapé
  x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(PAD, y, CW, 2); y += 46;
  text('destiny-checklist.vercel.app', PAD, y, F.m(22), '#c3ccda');
  text(new Date().toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }), Wd - PAD, y, F.m(22), '#8f9bb0', 'right');
  y += 40;

  // composição final
  const Hh = Math.min(y, MAXH), out = document.createElement('canvas'); out.width = Wd * S; out.height = Math.ceil(Hh * S);
  const o = out.getContext('2d'); o.scale(S, S);
  o.fillStyle = '#0d121c'; o.fillRect(0, 0, Wd, Hh);
  const glow = (cx, cy, r, c, a) => { const g = o.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(13,18,28,0)'); o.globalAlpha = a; o.fillStyle = g; o.fillRect(0, 0, Wd, Hh); o.globalAlpha = 1; };
  glow(Wd * .1, 420, 760, acc, .28); glow(Wd * .95, Hh * .55, 720, acc2, .2); glow(Wd * .3, Hh, 700, acc, .14);
  for (const c of cards) { rr(o, PAD, c.y, CW, c.h, 18); o.fillStyle = 'rgba(255,255,255,.045)'; o.fill(); }
  o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(cv, 0, 0); o.restore();
  for (const c of cards) { rr(o, PAD + 1, c.y + 1, CW - 2, c.h - 2, 18); o.strokeStyle = c.exo ? 'rgba(243,215,122,.5)' : 'rgba(255,255,255,.09)'; o.lineWidth = 2; o.stroke(); }
  out.logicalH = Hh; return out;
}
let shareUrl = null, pngUrl = null;
async function openShare(C) {
  const W = u().w, dlg = $('sharedlg'); if (!dlg || !C?.B) return;
  dlg.innerHTML = `<div class="sh-box"><p class="sh-wait">${esc(W.shareMaking)}</p></div>`; dlg.showModal();
  try {
    // 1ª passada mede a altura; a 2ª desenha em 2x (2160 px de largura) para ficar nítida no WhatsApp
    const h = (await buildShareCanvas(C, 1)).logicalH;
    const cv = await buildShareCanvas(C, 2, h + 2);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95)), png = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (pngUrl) URL.revokeObjectURL(pngUrl); pngUrl = URL.createObjectURL(png || blob);
    if (shareUrl) URL.revokeObjectURL(shareUrl); shareUrl = URL.createObjectURL(blob);
    const name = `build-${String(C.name || '').replace(/#\d+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'destiny'}-${(u().classes[C.p.characters.data[C.cid].classType] || '').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.jpg`;
    const file = new File([blob], name, { type: 'image/jpeg' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    dlg.innerHTML = `<div class="sh-box"><button class="sh-x" id="shx" type="button" aria-label="${esc(W.shareClose)}" title="${esc(W.shareClose)}">×</button><div class="sh-img"><img src="${shareUrl}" alt="${esc(W.shareAlt)}"></div><div class="sh-actions">${canShare ? `<button class="btn" id="shgo" type="button">${esc(W.shareBtn)}</button>` : ''}<a class="${canShare ? 'reset' : 'btn'}" id="shdl" href="${pngUrl}" download="${name.replace(/\.jpg$/, png ? '.png' : '.jpg')}">${esc(W.shareDl)}</a></div></div>`;
    $('shx').onclick = () => dlg.close();
    if (canShare) $('shgo').onclick = () => navigator.share({ files: [file], title: W.shareTitle }).catch(() => {});
  } catch (e) { console.error(e); dlg.innerHTML = `<div class="sh-box sh-err"><button class="sh-x" id="shx" type="button" aria-label="${esc(W.shareClose)}" title="${esc(W.shareClose)}">×</button><p class="sh-wait">${esc(W.shareFail)}</p></div>`; $('shx').onclick = () => dlg.close(); }
}
function renderBuild() {
  const b = $('build'), bb = $('buildbtn'); if (!b) return;
  const on = OPTS.build && !!profile && !!auth;
  b.hidden = !buildOpen || !on; if (!b.hidden) b.innerHTML = buildHTML();
  const g = $('gear'); g.querySelector('.g-more')?.remove();
  if (bb) { bb.hidden = !on; bb.setAttribute('aria-expanded', !b.hidden); bb.title = u().w.showBuild; bb.setAttribute('aria-label', u().w.showBuild); }
  if (on) { g.setAttribute('role', 'button'); g.tabIndex = 0; g.setAttribute('aria-expanded', !b.hidden); g.title = u().w.showBuild; }
  else { g.removeAttribute('role'); g.removeAttribute('tabindex'); g.removeAttribute('aria-expanded'); g.title = ''; }
}
function toggleBuild() { if (!OPTS.build || !profile) return; buildOpen = !buildOpen; renderBuild(); }

/* Aba Guardião: o que é para consultar */
async function loadGuardian(my) {
  if (gdLoading) return; gdLoading = true;
  const out = { weapons: null, clan: null, pass: null, names: {}, metricNames: {}, commNames: {} };
  const tasks = [
    entities('DestinyProgressionDefinition', RANK_PROGS, lang).then(d => { out.names = d; }),
    entities('DestinyMetricDefinition', COUNT_METRICS, lang).then(d => { out.metricNames = d; }),
    (async () => { const h = profile.profile?.data?.currentSeasonPassHash; if (!h) return; const d = await bungie(`/Destiny2/Manifest/DestinySeasonPassDefinition/${h}/?lc=${lang === 'pt' ? 'pt-br' : 'en'}`, false); const p = profile.characterProgressions?.data?.[charId]?.progressions?.[d.rewardProgressionHash]; if (p) out.pass = { n: d.displayProperties?.name || '', lvl: p.level, a: p.progressToNextLevel, b: p.nextLevelAt }; })(),
    (async () => { const r = await bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${charId}/Stats/UniqueWeapons/`); const v = (w, k) => w.values?.[k]?.basic?.value || 0; const top = (r.weapons || []).map(w => ({ h: w.referenceId, k: v(w, 'uniqueWeaponKills'), p: v(w, 'uniqueWeaponKillsPrecisionKills') })).sort((a, b) => b.k - a.k).slice(0, 6); const n = await entities('DestinyInventoryItemDefinition', top.map(w => w.h), lang); out.weapons = top.map(w => ({ ...w, n: n[w.h]?.n || '', ic: n[w.h]?.ic || '' })); })(),
    (async () => { const g = await bungie(`/GroupV2/User/${member.type}/${member.id}/0/1/`); const grp = g.results?.[0]?.group; if (!grp) { out.clan = { none: true }; return; } const m = await bungie(`/GroupV2/${grp.groupId}/Members/?currentpage=1`); const list = (m.results || []).filter(x => x.destinyUserInfo?.membershipId !== member.id).map(x => { const d = x.destinyUserInfo || {}; return { n: d.bungieGlobalDisplayName || d.displayName || '?', full: d.bungieGlobalDisplayName ? `${d.bungieGlobalDisplayName}#${String(d.bungieGlobalDisplayNameCode || 0).padStart(4, '0')}` : (d.displayName || ''), mt: d.membershipType, mid: d.membershipId, on: !!x.isOnline, t: (x.lastOnlineStatusChange || 0) * 1000 }; }).sort((a, b) => (b.on - a.on) || (b.t - a.t)); out.clan = { name: grp.name, list }; })(),
    (async () => {
      // Esquadrão recente: últimas atividades de todos os personagens → relatório de cada uma → quem estava no mesmo esquadrão
      const chars = Object.keys(profile.characters?.data || {});
      const hist = (await Promise.all(chars.map(c => bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${c}/Stats/Activities/?count=10&mode=0`).then(r => r.activities || []).catch(() => [])))).flat().sort((a, b) => Date.parse(b.period) - Date.parse(a.period)).slice(0, 12);
      const pgcr = id => fetch(`https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${id}/`, { headers: { 'X-API-Key': cfg.apiKey } }).then(r => r.json()).then(j => j.ErrorCode === 1 ? j.Response : null).catch(() => null);
      const reps = await Promise.all(hist.map(a => pgcr(a.activityDetails.instanceId)));
      const names = await entities('DestinyActivityDefinition', hist.map(a => a.activityDetails.directorActivityHash || a.activityDetails.referenceId), lang);
      const v = (e, k) => e?.values?.[k]?.basic?.value, map = new Map();
      reps.forEach((r, k) => {
        if (!r) return; const me = r.entries?.find(e => e.player?.destinyUserInfo?.membershipId === member.id); if (!me) return;
        const fid = v(me, 'fireteamId'), team = v(me, 'team'), when = Date.parse(hist[k].period), an = names[hist[k].activityDetails.directorActivityHash || hist[k].activityDetails.referenceId]?.n || '', seen = new Set();
        for (const e of r.entries) {
          const d = e.player?.destinyUserInfo; if (!d || d.membershipId === member.id || seen.has(d.membershipId)) continue;
          const same = fid != null && v(e, 'fireteamId') != null ? v(e, 'fireteamId') === fid : team != null && v(e, 'team') === team;
          if (!same) continue; seen.add(d.membershipId);
          const cur = map.get(d.membershipId) || { n: d.bungieGlobalDisplayName || d.displayName || '?', full: d.bungieGlobalDisplayName ? fullName(d.bungieGlobalDisplayName, d.bungieGlobalDisplayNameCode) : (d.displayName || ''), mt: d.membershipType, mid: d.membershipId, cls: e.player.characterClass || '', count: 0, t: 0, act: '' };
          cur.count++; if (when > cur.t) { cur.t = when; cur.act = an; cur.cls = e.player.characterClass || cur.cls; } map.set(d.membershipId, cur);
        }
      });
      out.recent = [...map.values()].sort((a, b) => b.t - a.t).slice(0, 15);
    })(),
    (async () => {
      const r = await bungie(`/Destiny2/${member.type}/Account/${member.id}/Stats/?groups=1&modes=5,7,84`), R = r?.mergedAllCharacters?.results || {};
      const pick = o => { const a = o?.allTime; if (!a) return null; const v = k => a[k]?.basic?.value; return { games: v('activitiesEntered') || 0, wins: v('activitiesWon') || 0, kd: v('killsDeathsRatio') || 0, eff: v('efficiency') || 0, kills: v('kills') || 0, best: v('bestSingleGameKills') || 0, cleared: v('activitiesCleared') || 0, secs: v('secondsPlayed') || 0 }; };
      out.stats = { pvp: pick(R.allPvP), pve: pick(R.allPvE), trials: pick(R.trials_of_osiris) };
    })(),
    (async () => { const c = profile.profileCommendations?.data; if (!c) return; out.comm = c; const ks = Object.keys(c.commendationNodePercentagesByHash || {}).map(Number); if (ks.length) out.commNames = await entities('DestinySocialCommendationNodeDefinition', ks, lang); })(),
  ];
  await Promise.allSettled(tasks);
  gdLoading = false; if (my !== gen) return;
  GD = out; if (tab === 'gd') render();
}
function gdHTML() {
  const W = u().w, G = GD, p = profile, cp = p.characterProgressions?.data?.[charId];
  const pc = (a, b) => b ? Math.min(100, a / b * 100) : 100;
  const st = (big, label, bar) => `<div class="st"><b>${big}</b><span>${esc(label)}</span>${bar != null ? `<i><u style="width:${bar}%"></u></i>` : ''}</div>`;
  const wait = `<p class="gd-wait">${esc(u().loadingDefs)}</p>`;
  const gr = p.profile?.data?.currentGuardianRank;
  const ranks = `<article class="gd"><div class="gd-head"><h2>${esc(W.ranksT)}</h2></div>${!have.a ? wait : `<div class="gd-grid">
    ${gr ? st(gr, W.gRank) : ''}${G?.pass ? st(G.pass.lvl, `${W.pass} ${G.pass.n}`, pc(G.pass.a, G.pass.b)) : ''}
    ${RANK_PROGS.map(h => { const x = cp?.progressions?.[h]; const n = G?.names?.[h]?.n; return x && n && (x.level || x.currentProgress) ? st(x.level, n, x.nextLevelAt ? pc(x.progressToNextLevel, x.nextLevelAt) : null) : ''; }).join('')}</div>`}</article>`;
  const rows = (kind, list) => { const done = list.filter(a => metric(a.m) > 0).sort((a, b) => metric(b.m) - metric(a.m)), z = list.length - done.length; return done.map(a => `<tr><td>${esc((kind === 'dg' ? W.dgW : W.raidW) + ' ' + L(a.n))}</td><td class="n">${fmtN(metric(a.m))}</td></tr>`).join('') + (z ? `<tr><td class="z">${esc(W.others(kind, z, done.length))}</td><td class="n z">${esc(W.noneYet)}</td></tr>` : ''); };
  const clears = `<article class="gd"><div class="gd-head"><h2>${esc(W.clearsT)}</h2></div>${!have.a ? wait : `<div class="gd-grid">${COUNT_METRICS.map(h => G?.metricNames?.[h]?.n ? st(fmtN(metric(h)), G.metricNames[h].n) : '').join('')}</div><table>${rows('dg', defs.dungeons)}${rows('raid', defs.raids)}</table>`}</article>`;
  const wp = `<article class="gd"><div class="gd-head"><h2>${esc(W.wpnT)}</h2></div><p>${esc(W.wpnNote)}</p>${!G ? wait : G.weapons?.length ? `<table>${G.weapons.map(w => `<tr><td class="wn">${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : ''}${esc(w.n)}</td><td class="n">${fmtN(w.k)} ${esc(W.kills)}<small>${Math.round(w.p <= 1 ? w.p * 100 : w.p)}% ${esc(W.prec)}</small></td></tr>`).join('')}</table>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const c = G?.comm;
  const comm = `<article class="gd"><div class="gd-head"><h2>${esc(W.commT)}</h2></div>${!G ? wait : c ? `<div class="gd-grid">${st(fmtN(c.totalScore), W.commScore)}${Object.entries(c.commendationNodePercentagesByHash || {}).filter(([h]) => G.commNames[h]?.n).sort((a, b) => b[1] - a[1]).map(([h, v]) => st(v + '%', G.commNames[h].n, v)).join('')}</div>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const r = rtf(), ago = t => t && r ? (() => { const d = (t - Date.now()) / 1000; const a = Math.abs(d); return a < 3600 ? r.format(Math.round(d / 60), 'minute') : a < 86400 ? r.format(Math.round(d / 3600), 'hour') : r.format(Math.round(d / 86400), 'day'); })() : '';
  const clan = `<article class="gd"><div class="gd-head"><h2>${esc(G?.clan?.name || W.clanT)}</h2></div>${!G ? wait : G.clan?.none ? `<p>${esc(W.noClan)}</p>` : G.clan ? `<p>${esc(W.clanNote(G.clan.list.filter(x => x.on).length))}</p><div class="cl">${G.clan.list.slice(0, 12).map(x => `<button type="button" class="cl-p${x.on ? ' on' : ''}" data-mt="${x.mt}" data-mid="${esc(x.mid)}" data-name="${esc(x.full)}" title="${esc(W.seeBuild)}">${esc(x.n)}${x.on ? '' : ` · ${esc(ago(x.t))}`}</button>`).join('')}</div><p class="gd-tip">${esc(W.clanTip)}</p>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const opts = `<article class="gd"><div class="gd-head"><h2>${esc(W.optsT)}</h2></div><p>${esc(W.optsNote)}</p><div class="opts">${[['clears', W.optClears], ['build', W.optBuild]].map(([k, t]) => `<label><input type="checkbox" data-opt="${k}"${OPTS[k] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</div></article>`;
  const S2 = G?.stats, dec = n => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statsA = `<article class="gd"><div class="gd-head"><h2>${esc(W.statsT)}</h2></div>${!G ? wait : !S2 || (!S2.pvp && !S2.pve) ? `<p>${esc(W.unavailable)}</p>` : `
    ${S2.pvp?.games ? `<div class="gd-k">${esc(W.crucible)}</div><div class="gd-grid">${st(dec(S2.pvp.kd), 'K/D')}${st(dec(S2.pvp.eff), W.eff)}${st(Math.round(S2.pvp.wins / S2.pvp.games * 100) + '%', W.winsOf(S2.pvp.wins, S2.pvp.games))}${st(S2.pvp.best, W.bestGame)}</div>` : ''}
    ${S2.pve ? `<div class="gd-k">PvE</div><div class="gd-grid">${st(fmtN(S2.pve.kills), W.kills.replace(/^./, c => c.toUpperCase()))}${st(fmtN(S2.pve.cleared), W.cleared)}${st(fmtN(Math.round(S2.pve.secs / 3600)) + ' h', W.played)}</div>` : ''}
    <p>${S2.trials?.games ? esc(W.trialsLine(S2.trials.games, S2.trials.wins, dec(S2.trials.kd))) : esc(W.noTrials)}</p>`}</article>`;
  const rec = `<article class="gd"><div class="gd-head"><h2>${esc(W.recentT)}</h2></div><p>${esc(W.recentNote)}</p>${!G ? wait : !G.recent ? `<p>${esc(W.unavailable)}</p>` : !G.recent.length ? `<p>${esc(W.recentNone)}</p>` : `<ul class="sq">${G.recent.map(x => `<li><button type="button" class="cl-p sq-p" data-mt="${x.mt}" data-mid="${esc(x.mid)}" data-name="${esc(x.full)}" title="${esc(W.seeBuild)}"><span class="sq-n">${esc(x.n)}</span><span class="sq-s">${esc([x.cls, W.together(x.count), x.act, ago(x.t)].filter(Boolean).join(' · '))}</span></button></li>`).join('')}</ul>`}</article>`;
  const fl = favs();
  const fav = `<article class="gd"><div class="gd-head"><h2>${esc(W.favGT)}</h2></div>${fl.length ? `<ul class="sq">${fl.map(x => { const k = x.name.lastIndexOf('#'); return `<li><button type="button" class="cl-p sq-p fav-p" data-mt="${x.type}" data-mid="${esc(x.id)}" data-name="${esc(x.name)}" title="${esc(W.seeBuild)}"><span class="sq-n">${esc(k > 0 ? x.name.slice(0, k) : x.name)}<small>${esc(k > 0 ? x.name.slice(k) : '')}</small></span><span class="sq-s">${esc([x.t, x.pw ? '✦ ' + x.pw : '', x.at ? W.seenAgo(ago(x.at)) : ''].filter(Boolean).join(' · '))}</span></button></li>`; }).join('')}</ul>` : `<p>${esc(W.favNone)}</p>`}</article>`;
  return `<div class="panel">${ranks}${statsA}${clears}${wp}${fav}${rec}${clan}${comm}${vaultHTML()}${opts}</div>`;
}

/* Título do cabeçalho: subclasse + classe ("Titã Combatente" / "Striker Titan"); se o nome da subclasse já traz a classe ("Titã Prismático"), usa só ele */
/* Ajusta o tamanho do título para caber numa linha (nomes longos, como os do Caçador) */
function fitTitle() {
  const h = $('title'), eb = $('eyebrow'); if (!h || !h.dataset.full) return;
  const over = () => h.scrollWidth > h.clientWidth + 1;
  const shrink = min => { let fs = parseFloat(getComputedStyle(h).fontSize) || 40; while (over() && fs > min) { fs -= 1; h.style.fontSize = fs + 'px'; } };
  h.style.fontSize = ''; h.classList.remove('two'); h.textContent = h.dataset.full; eb.textContent = eb.dataset.base || '';
  shrink(26); if (!over()) return;
  // não coube: a classe vai para a linha pequena e o título fica só com a subclasse
  h.style.fontSize = ''; h.textContent = h.dataset.short; if (h.dataset.short !== h.dataset.full) eb.textContent = `${h.dataset.cls} · ${eb.dataset.base}`;
  shrink(20); if (over()) h.classList.add('two');
}
addEventListener('resize', () => fitTitle());
try { document.fonts.ready.then(() => fitTitle()); } catch {}
function charTitle(cls, sn) { if (!sn) return cls; if (sn.toLowerCase().includes(cls.toLowerCase())) return sn; return lang === 'pt' ? `${cls} ${sn}` : `${sn} ${cls}`; }

/* ---------- Vendedores da semana (Banshee-44 e Ada-1): armas com o rolo à venda e o que mais importa ---------- */
const VENDORS = [[672118013, 'Banshee-44'], [350061650, 'Ada-1']];
let VEND = null, vendLoading = false;
async function loadVendors(my) {
  if (vendLoading) return; vendLoading = true;
  const out = [], cid = charId;
  await Promise.all(VENDORS.map(async ([vh, vname], vi) => {
    try {
      const r = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/Character/${charId}/Vendors/${vh}/?components=400,402,305`);
      const sales = Object.entries(r.sales?.data || {});
      const hs = sales.map(([, x]) => x.itemHash), plugs = [];
      for (const [i] of sales) for (const sk of r.itemComponents?.sockets?.data?.[i]?.sockets || []) if (sk.plugHash && sk.isVisible !== false) plugs.push(sk.plugHash);
      const costH = sales.flatMap(([, x]) => (x.costs || []).map(c => c.itemHash));
      const all = [...hs, ...plugs, ...costH];
      const en = await entities('DestinyInventoryItemDefinition', all, 'en'), loc = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', all, 'pt') : en;
      // coleção: só as armas e tonalizadores precisam (poucos itens)
      const need = hs.filter(h => (en[h]?.it === 3 || /Shader/.test(en[h]?.tl || '')) && COLL[h] === undefined);
      await Promise.all(need.map(h => bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false).then(d => { COLL[h] = d.collectibleHash || 0; }).catch(() => { COLL[h] = 0; })));
      const weapons = [], other = []; let sh = 0, shOwn = 0;
      for (const [i, x] of sales) {
        const e = en[x.itemHash], d = loc[x.itemHash]; if (!e?.n || !e.tl) continue;
        const owned = COLL[x.itemHash] ? colAcquired([COLL[x.itemHash]]) : null;
        if (/Shader/.test(e.tl)) { sh++; if (owned) shOwn++; continue; }
        if (/Material|Faction Reward|Currency|Engram$/i.test(e.tl) || e.tt < 5 && e.it !== 3) continue;
        const cost = (x.costs || []).map(c => `${fmtN(c.quantity)} ${loc[c.itemHash]?.n || ''}`.trim()).join(' + ');
        if (e.it === 3) {
          const ps = (r.itemComponents?.sockets?.data?.[i]?.sockets || []).filter(sk => sk.plugHash && sk.isVisible !== false).map(sk => sk.plugHash).filter(h => { const pe = en[h]; return pe?.n && !SKIP_NAME.test(pe.n) && !SKIP_TYPE.test(pe.tl) && !/Empty|Default/i.test(pe.n); });
          const kind = h => { const pe = en[h]; return /Intrinsic/i.test(pe.tl) ? 'k' : /Trait/i.test(pe.tl) ? 'tr' : /^Tier \d|^Masterworked/i.test(pe.n) ? 'mw' : ''; };
          weapons.push({ n: d.n, tl: d.tl, ic: d.ic, dt: e.dt, owned, perks: ps.map(h => ({ n: loc[h]?.n || en[h].n, ic: loc[h]?.ic || en[h].ic, k: kind(h) })), cost });
        } else other.push({ n: d.n, d: (d.d || '').replace(/\{var:\d+\}/g, '…').split('\n')[0], ic: d.ic, cost });
      }
      out[vi] = { name: vname, until: r.vendor?.data?.nextRefreshDate, weapons, other, sh, shOwn };
    } catch { out[vi] = { name: vname, failed: true }; }
  }));
  vendLoading = false; if (cid !== charId) return;
  VEND = out.filter(Boolean); if (tab === 'vend') render();
}
const COLL = {};
const EL_COLOR = { 1: '#d5dbe6', 2: 'var(--arc)', 3: 'var(--solar)', 4: '#b48cff', 6: '#6fa8ff', 7: 'var(--done)' };
function vendorsHTML() {
  const W = u().w, now = Date.now();
  // cada vendedor é um painel próprio, fechado por padrão; abre ao tocar
  const card = (id, title, sub, chip, body) => { const open = openSecs.has(id); return `<section data-sec="${id}" class="vend keep coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="${id}" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>${esc(title)}</h2><div class="sec-sub">${esc(sub)}</div></div>${chip ? `<span class="chip hot">${esc(chip)}</span>` : ''}<span class="chev" aria-hidden="true"></span></div></div><div class="vd-body">${body}</div></section>`; };
  // Xûr
  const cls = profile.characters.data[charId].classType, miss = xurMissing().map(x => x.en);
  const xu = XUR && XUR.items.length && (!XUR.until || Date.parse(XUR.until) > now);
  const xItems = xu ? XUR.items.filter(x => { const e = exoticByName(x.en); return e && (e.t === 'w' || e.c === cls); }) : [];
  const xMiss = xItems.filter(x => miss.includes(x.en)).length;
  const xur = card('vd-xur', 'Xûr', xu ? W.xurSub2(xItems.length, cd(Date.parse(XUR.until) - now), u().classes[cls]) : (XUR ? W.xurGoneShort : u().loadingDefs), xMiss ? W.missN(xMiss) : '',
    xu ? `<div class="vd-x">${xItems.map(x => `<div class="vd-xi${miss.includes(x.en) ? ' miss' : ''}">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(x.n)}</b><small>${esc(x.tl)}${x.cost ? ` · ${x.cost} ${esc(W.coins)}` : ''}</small></div>${miss.includes(x.en) ? `<span class="chip hot">${esc(W.notOwned)}</span>` : ''}</div>`).join('')}</div>${have.c ? `<p class="vd-note">${esc(W.coinsHave(coins()))}</p>` : ''}` : `<p class="vd-note">${esc(XUR ? W.xurGone : u().loadingDefs)}</p>`);
  if (!VEND) return xur + VENDORS.map(([, n], k) => card('vd-' + k, n, u().loadingDefs, '', '')).join('');
  const others = VEND.map((v, k) => {
    if (v.failed) return card('vd-' + k, v.name, W.unavailable, '', '');
    const wm = v.weapons.filter(w => w.owned === false).length;
    const sub = [v.weapons.length ? W.nWeapons(v.weapons.length) : '', v.other.length ? W.nOther(v.other.length) : '', v.until ? W.changesIn(cd(Date.parse(v.until) - now)) : ''].filter(Boolean).join(' · ');
    const body = `${v.weapons.map(w => `<div class="vd-w"><div class="vd-wh">${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(w.n)}</b><small><span class="vd-el" style="--c:${EL_COLOR[w.dt] || 'var(--muted)'}"></span>${esc(w.tl)}${w.cost ? ' · ' + esc(w.cost) : ''}</small></div>${w.owned === false ? `<span class="chip hot">${esc(W.notOwned)}</span>` : ''}</div>
      <div class="vd-perks">${w.perks.map(p => `<span class="${p.k}">${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}${esc(p.n)}</span>`).join('')}</div></div>`).join('')}
      ${v.other.length ? `<table class="vd-t">${v.other.map(o => `<tr><td><b>${esc(o.n)}</b>${o.d ? `<small>${esc(o.d)}</small>` : ''}</td><td class="n">${esc(o.cost || '')}</td></tr>`).join('')}</table>` : ''}
      ${v.sh ? `<p class="vd-note">${esc(W.shaders(v.sh, v.shOwn))}</p>` : ''}${v.weapons.length ? `<p class="vd-note">${esc(W.perksGold)}</p>` : ''}`;
    return card('vd-' + k, v.name, sub, wm ? W.missN(wm) : '', body);
  }).join('');
  return xur + others;
}

/* ---------- Limpeza do cofre: espaço usado e itens repetidos (só mostra; desmontar é no jogo) ---------- */
const VAULT_BUCKET = 138197802;
let VAULT = null;
async function loadVault(my) {
  const items = (profile.profileInventory?.data?.items || []).filter(i => i.bucketHash === VAULT_BUCKET);
  const cnt = {}; for (const i of items) if (i.itemInstanceId) cnt[i.itemHash] = (cnt[i.itemHash] || 0) + 1;
  const dupH = Object.keys(cnt).filter(h => cnt[h] > 1).map(Number);
  const en = await entities('DestinyInventoryItemDefinition', dupH, 'en'), loc = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', dupH, 'pt') : en; if (my !== gen) return;
  const row = h => ({ n: loc[h]?.n || en[h]?.n || '', tl: loc[h]?.tl || '', ic: loc[h]?.ic || '', c: cnt[h], tt: en[h]?.tt, it: en[h]?.it });
  const dups = dupH.map(row).filter(x => x.n && (x.it === 2 || x.it === 3)).sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
  VAULT = { used: items.length, max: 600, exo: dups.filter(x => x.tt === 6), leg: dups.filter(x => x.tt !== 6) };
  if (tab === 'gd') render();
}
function vaultHTML() {
  const W = u().w;
  if (!VAULT) return `<article class="gd"><div class="gd-head"><h2>${esc(W.vaultT)}</h2></div><p class="gd-wait">${esc(u().loadingDefs)}</p></article>`;
  const list = (t, a) => a.length ? `<div class="gd-k">${esc(t)}</div><table>${a.slice(0, 12).map(x => `<tr><td class="wn">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<span>${esc(x.n)}<small class="pv-s">${esc(x.tl)}</small></span></td><td class="n">×${x.c}</td></tr>`).join('')}</table>${a.length > 12 ? `<p>${esc(W.andMore(a.length - 12))}</p>` : ''}` : '';
  const pc = Math.round(VAULT.used / VAULT.max * 100);
  return `<article class="gd"><div class="gd-head"><h2>${esc(W.vaultT)}</h2></div>
    <div class="vb"><div><b>${VAULT.used}</b> ${esc(W.of)} ${VAULT.max} ${esc(W.slots)}</div><i><u style="width:${pc}%"></u></i></div>
    ${list(W.dupExo, VAULT.exo)}${list(W.dupLeg, VAULT.leg)}
    <p>${esc(VAULT.exo.length || VAULT.leg.length ? W.vaultNote : W.vaultClean)}</p></article>`;
}
/* ---------- renderização ---------- */
/* Tema claro/escuro: segue o sistema até a pessoa escolher; a escolha fica salva neste navegador */
const SUN = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M4.2 15.8l1.6-1.6M14.2 5.8l1.6-1.6"/></g></svg>';
const MOON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.8 12.6A6.8 6.8 0 0 1 7.4 4.2a6.8 6.8 0 1 0 8.4 8.4z" fill="currentColor"/></svg>';
const curTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme() { const b = $('themebtn'), d = curTheme() === 'dark', l = d ? u().toLight : u().toDark; b.innerHTML = d ? SUN : MOON; b.title = l; b.setAttribute('aria-label', l); }
function applyUI() {
  applyTheme();
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.querySelectorAll('[data-u]').forEach(el => { const v = u()[el.dataset.u]; if (typeof v === 'string') el.textContent = v; });
  const q = $('q'); q.placeholder = u().search; q.setAttribute('aria-label', u().search); $('searchbtn').setAttribute('aria-label', u().search);
  $('langbtn').innerHTML = lang === 'en' ? '<b>EN</b><span class="sep">/</span><span>PT</span>' : '<span>EN</span><span class="sep">/</span><b>PT</b>';
  $('langbtn').title = lang === 'en' ? 'Mudar para português' : 'Switch to English';
}
function render() {
  applyUI();
  const logged = !!(auth && profile);
  for (const id of ['tabs', 'overall', 'chars', 'ldbtn', 'refresh', 'logout']) $(id).hidden = !logged;
  renderWeek(); renderBuild();
  if (!cfg) return;
  if (!logged) {
    delete $('title').dataset.full; $('title').style.fontSize = ''; $('title').classList.remove('two'); $('title').textContent = 'Destiny Checklist'; document.title = 'Destiny Checklist'; $('eyebrow').textContent = 'Destiny 2'; renderGuardian(null);
    $('subtabs').hidden = true;
    if (auth) return; // carregando
    const U = u();
    showMessage(`<section class="hero"><h2>${esc(U.heroTitle)}</h2><p>${esc(U.heroText)}</p>${cfg.configured ? `<button class="btn" id="loginbtn" type="button">${esc(U.login)}</button>` : `<p class="notice">${esc(U.notConfigured)}</p>`}<ul>${U.heroList.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
    const b = $('loginbtn'); if (b) b.onclick = login;
    return;
  }
  const U = u(), ch = profile.characters.data[charId];
  const cls = U.classes[ch.classType] || '';
  const mx = maxPower(ch.classType);
  const sub = (profile.characterEquipment?.data?.[charId]?.items || []).find(i => i.bucketHash === SUB_BUCKET), sn = sub && gearDefs[sub.itemHash]?.n;
  const ttl = charTitle(cls, sn);
  Object.assign($('title').dataset, { full: ttl, short: sn || cls, cls }); $('title').textContent = ttl; $('title').title = `${U.races[ch.raceType] || ''} ${cls}`; document.title = ttl + ' · Destiny Checklist';
  renderGuardian(ch);
  $('eyebrow').dataset.base = member.name || ''; $('eyebrow').textContent = member.name || ''; $('eyebrow').title = member.name || ''; fitTitle();
  $('ghpw').hidden = false; $('pwv').textContent = ch.light; $('pwmax').textContent = mx && mx > ch.light ? `${U.max} ${mx}` : U.power;
  const many = Object.keys(profile.characters.data).length > 1;
  $('chars').innerHTML = (many ? Object.values(profile.characters.data).map(c => `<button class="char" type="button" data-char="${c.characterId}" aria-pressed="${c.characterId === charId}">${esc(U.classes[c.classType])}<span class="pw">${c.light}</span></button>`).join('') : '') + `<button class="char findbtn" type="button" id="findbtn" title="${esc(U.w.find)}" aria-label="${esc(U.w.find)}">${FIND_ICON}<span>${esc(U.w.findShort)}</span></button>`;
  $('chars').hidden = false;
  $('tabs').innerHTML = GROUPS.map(g => `<button class="tab" type="button" data-group="${g.id}" aria-current="${groupOf(tab)?.id === g.id}">${esc(U.tabs[g.id])}</button>`).join('');
  const g = groupOf(tab), st = $('subtabs');
  if (g && g.subs.length > 1) { st.hidden = false; st.innerHTML = g.subs.map(id => `<button class="sub" type="button" data-sub="${id}" aria-pressed="${id === tab}">${esc(U.subs[id])}</button>`).join(''); }
  else { st.hidden = true; st.innerHTML = ''; }
  $('ldbtn').setAttribute('aria-pressed', tab === 'ld'); $('ldbtn').textContent = tab === 'ld' ? U.checklist : U.loadouts;
  document.body.classList.toggle('on-ld', tab === 'ld'); document.body.classList.toggle('no-clears', !OPTS.clears);
  $('overall').hidden = tab === 'gd' || tab === 'vend';
  if (tab === 'gd') { $('list').innerHTML = gdHTML(); if (!GD && have.a) loadGuardian(gen); if (!VAULT && have.c) loadVault(gen); return; }
  if (tab === 'ld') {
    showMessage(stage < 1 || !have.c ? `<p class="empty-msg">${esc(U.loadingDefs)}</p>` : LOADOUTS.length ? LOADOUTS.map(l => `<article class="ld"><div class="ld-head"><h2>${esc(l.name)}</h2></div><ul class="items">${l.items.map(n => `<li>${esc(n)}</li>`).join('')}</ul><div class="ld-actions"><a class="ld-btn" href="https://app.destinyitemmanager.com/" target="_blank" rel="noopener">${esc(U.openDim)}</a></div></article>`).join('') : `<p class="empty-msg">${esc(U.noLoadouts)}</p>`);
    $('ovcount').textContent = U.ld(LOADOUTS.length); $('ovbar').style.width = '0';
    return;
  }
  const secs = SECTIONS.filter(x => x.tab === tab);
  // O que já foi concluído fica no fim da lista, minimizado.
  const secDone = x => x.items.length > 0 && x.items.every(isDone);
  secs.sort((a, b) => secDone(a) - secDone(b));
  $('list').innerHTML = `<div class="panel">${secs.map(sec => {
    if (sec.html) return sec.id === 'vendors' ? vendorsHTML() : '';
    if (sec.empty) return `<p class="empty-msg">${esc(sec.note)}</p>`;
    if (!sec.items.length) return `<section data-sec="${sec.id}"><div class="sec-head"><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2></div></div><p>${esc(sec.note)}</p></div></section>`;
    const keep = true, coll = sec.coll || ((tab === 'exo' || tab === 'cat') && sec.items?.length) || (keep && secDone(sec)), open = openSecs.has(sec.id);
    return `<section data-sec="${sec.id}" class="${keep ? 'keep' : ''}${coll ? ` coll${open ? '' : ' collapsed'}` : ''}">
      <div class="sec-head"${coll ? ` data-coll="${sec.id}" role="button" tabindex="0" aria-expanded="${open}"` : ''}><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2>${sec.kind ? secMeta(sec) : ''}</div><span class="count" data-sc="${sec.id}"></span>${coll ? '<span class="chev" aria-hidden="true"></span>' : ''}</div>
      ${sec.note ? `<p>${esc(sec.note)}</p>` : ''}<div class="sec-bar"><i data-sb="${sec.id}"></i></div></div>
      <ul>${sec.items.map(i => {
        const cid = 'c-' + i.id.replace(/[^a-z0-9]+/gi, '-'), first = i.c[0], rest = i.c.slice(1), more = !!(i.d || rest.length || i.loc);
        const head = `<span class="t">${esc(i.t)}</span>${first ? `<span class="chip ${chipClass(first)}">${esc(first)}</span>` : ''}`;
        return `<li data-li="${esc(i.id)}" data-search="${esc([i.t, i.d, i.loc, ...i.c, sec.title].join(' ').toLowerCase())}"><div class="row"><label class="ck" for="${cid}"><input type="checkbox" id="${cid}" data-id="${esc(i.id)}" aria-label="${esc(i.t)}"${i.auto ? ' checked disabled' : ''}></label>${more ? `<button class="it" type="button" aria-expanded="false">${head}<span class="chev" aria-hidden="true"></span></button>` : `<span class="it">${head}</span>`}</div>${more ? `<div class="more">${i.loc ? `<div class="loc"><span class="loc-k">${esc(U.where)}</span> ${esc(i.loc)}</div>` : ''}${i.d ? `<div class="d">${esc(i.d)}</div>` : ''}${rest.length ? `<div class="chips">${rest.map(x => `<span class="chip ${chipClass(x)}">${esc(x)}</span>`).join('')}</div>` : ''}</div>` : ''}</li>`;
      }).join('')}</ul></section>`;
  }).join('')}<p class="donebar" id="donebar" hidden><span id="donetxt"></span><button class="reset" id="togglecomplete" type="button"></button></p></div>`;
  document.querySelectorAll('#list li[data-li]').forEach(li => { if (openItems.has(li.dataset.li)) { li.classList.add('open'); li.querySelector('button.it')?.setAttribute('aria-expanded', 'true'); } });
  update(); filter();
}
const isDone = i => i.auto || marks.has(i.id);
function update() {
  const U = u();
  document.querySelectorAll('#list input[data-id]').forEach(cb => { const it = findItem(cb.dataset.id); const d = it ? isDone(it) : false; cb.checked = d; cb.closest('li').classList.toggle('is-done', d); });
  let full = 0;
  for (const sec of SECTIONS) {
    const el = document.querySelector(`[data-sc="${sec.id}"]`); if (!el) continue;
    const n = sec.items.filter(isDone).length, t = sec.items.length;
    el.textContent = (t && n === t ? '✓ ' : '') + `${n}/${t}`;
    document.querySelector(`[data-sb="${sec.id}"]`).style.width = (t ? n / t * 100 : 0) + '%';
    const complete = t > 0 && n === t; const secEl = el.closest('section'); secEl.classList.toggle('complete', complete); if (complete && !secEl.classList.contains('keep')) full++;
  }
  const bar = $('donebar');
  if (bar) { bar.hidden = full === 0; const sh = document.body.classList.contains('show-complete'); $('donetxt').textContent = U.panels(full, sh); $('togglecomplete').textContent = sh ? U.hideDone : U.show; }
  const secs = SECTIONS.filter(x => x.tab === tab && !x.empty && !x.html);
  let n, t, label;
  if (tab === 'raid' || tab === 'dg') { t = secs.length; n = secs.filter(x => isDone(x.items[0])).length; label = U[tab](n, t); }
  else if (tab === 'tit') { t = secs.length; n = secs.filter(x => x.items.every(isDone)).length; label = U.tit(n, t); }
  else if (tab === 'camp') { t = secs.length; n = 0; label = U.camp(t); }
  else { const items = secs.flatMap(x => x.items); t = items.length; n = items.filter(isDone).length; label = U.done1(n, t); }
  $('ovcount').textContent = label; $('ovbar').style.width = (t ? n / t * 100 : 0) + '%';
}
let itemIndex = null;
function findItem(id) { if (!itemIndex || itemIndex.v !== SECTIONS) { itemIndex = { v: SECTIONS, m: new Map() }; for (const s of SECTIONS) for (const i of s.items) itemIndex.m.set(i.id, i); } return itemIndex.m.get(id); }
function filter() {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('#list li').forEach(li => li.classList.toggle('no-match', !!q && !li.dataset.search.includes(q)));
  document.querySelectorAll('#list section').forEach(sec => { sec.classList.toggle('empty', !!q && !sec.querySelector('li:not(.no-match)')); sec.classList.toggle('q-open', !!q); });
}

/* ---------- eventos ---------- */
function go(t) { tab = t; const g = groupOf(t); if (g) { lastSub[g.id] = t; LS.set('dc-subs', lastSub); } LS.set('dc-tab', t); render(); }
$('tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; const g = GROUPS.find(x => x.id === b.dataset.group); go(g.subs.includes(lastSub[g.id]) ? lastSub[g.id] : g.subs[0]); });
$('subtabs').addEventListener('click', e => { const b = e.target.closest('.sub'); if (b) go(b.dataset.sub); });
$('chars').addEventListener('click', e => { if (e.target.closest('#findbtn')) { openFind(); return; } const b = e.target.closest('.char'); if (!b || b.dataset.char === charId) return; charId = b.dataset.char; LS.set('dc-char-' + member.id, charId); resetChar(); buildOpen && renderBuild(); hydrate(); });
$('ldbtn').addEventListener('click', () => { if (tab === 'ld') go(prevTab || 'obj'); else { prevTab = tab; go('ld'); } });
$('themebtn').addEventListener('click', () => { const t = curTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; LS.set('dc-theme', t); applyTheme(); });
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch {}
$('langbtn').addEventListener('click', () => { lang = lang === 'en' ? 'pt' : 'en'; LS.set('dc-lang', lang); if (profile) hydrate(); else render(); });
$('refresh').addEventListener('click', () => start());
$('logout').addEventListener('click', logout);
$('hide').addEventListener('change', e => { document.body.classList.toggle('hide-done', e.target.checked); LS.set('dc-hide2', e.target.checked); });
$('searchbtn').addEventListener('click', () => { const q = $('q'), show = q.hidden; q.hidden = !show; $('searchbtn').setAttribute('aria-expanded', show); if (show) q.focus(); else { q.value = ''; query = ''; filter(); } });
$('q').addEventListener('input', e => { query = e.target.value; filter(); });
const toggleSec = h => { const id = h.dataset.coll, sec = h.closest('section'); const o = sec.classList.toggle('collapsed') === false; o ? openSecs.add(id) : openSecs.delete(id); h.setAttribute('aria-expanded', o); };
$('list').addEventListener('keydown', e => { const h = e.target.closest && e.target.closest('.sec-head[data-coll]'); if (h && e.target === h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSec(h); } });
$('list').addEventListener('click', e => {
  const hd = e.target.closest('.sec-head[data-coll]'); if (hd) { toggleSec(hd); return; }
  const it = e.target.closest('button.it'); if (it) { const li = it.closest('li'); const o = li.classList.toggle('open'); it.setAttribute('aria-expanded', o); o ? openItems.add(li.dataset.li) : openItems.delete(li.dataset.li); return; }
  if (e.target.id === 'togglecomplete') { document.body.classList.toggle('show-complete'); update(); }
});
$('list').addEventListener('change', e => { const k = e.target.dataset.opt; if (k) { OPTS[k] = e.target.checked; LS.set('dc-opts', OPTS); render(); return; } const id = e.target.dataset.id; if (!id || !member) return; e.target.checked ? marks.add(id) : marks.delete(id); LS.set('dc-marks-' + member.id, [...marks]); update(); });
$('week').addEventListener('click', e => { const b = e.target.closest('.wk'); if (!b) return; const w = WK[+b.dataset.wk]; if (w && w.to) jumpTo(w.to[0], w.to[1]); });
$('gear').addEventListener('click', toggleBuild);
$('buildbtn').addEventListener('click', toggleBuild);
$('build').addEventListener('click', e => { if (e.target.closest('.b-cam')) openShare(ownCtx()); const lk = e.target.closest('.b-link'); if (lk && member?.name) copyLink(member.name, lk); });
$('gear').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBuild(); } });
setInterval(() => { if (document.visibilityState === 'visible' && profile && tab === 'obj') { build(); render(); } }, 60000);


/* ---------- buscar outro guardião e ver a build dele ---------- */
const FIND_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
async function bungiePost(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`HTTP ${r.status}`);
  if (j.ErrorCode !== 1) throw new Error(j.Message || j.ErrorStatus);
  return j.Response;
}
const pickMembership = list => list.find(m => m.crossSaveOverride && m.crossSaveOverride === m.membershipType) || list.find(m => !m.crossSaveOverride) || list[0];
const fullName = (n, c) => `${n}#${String(c || 0).padStart(4, '0')}`;
async function searchPlayers(q) {
  const m = q.match(/^(.+?)\s*#\s*(\d{1,4})$/);
  if (m) {
    const r = await bungiePost('/Destiny2/SearchDestinyPlayerByBungieName/-1/', { displayName: m[1].trim(), displayNameCode: +m[2] });
    if (!r?.length) return [];
    const p = pickMembership(r); return [{ name: fullName(p.bungieGlobalDisplayName, p.bungieGlobalDisplayNameCode), type: p.membershipType, id: p.membershipId }];
  }
  // A busca da Bungie só acha o nome completo (sem o #código) e traz todo mundo com esse nome
  const list = []; for (let i = 0; i < 3; i++) { const r = await bungiePost(`/User/Search/GlobalName/${i}/`, { displayNamePrefix: q }); list.push(...(r?.searchResults || [])); if (!r?.hasMore) break; }
  return list.filter(x => x.destinyMemberships?.length).slice(0, 25).map(x => { const p = pickMembership(x.destinyMemberships); return { name: fullName(x.bungieGlobalDisplayName, x.bungieGlobalDisplayNameCode), type: p.membershipType, id: p.membershipId }; });
}
const FD = { q: '', results: null, status: '', sel: null, p: null, cid: null, B: null, seq: 0 };
let fdTimer = null;
function openFind(sel) {
  const d = $('finddlg'), W = u().w;
  d.innerHTML = `<div class="fd-box"><button class="sh-x fd-x" type="button" aria-label="${esc(W.shareClose)}" title="${esc(W.shareClose)}">×</button><h2 class="fd-t">${esc(W.find)}</h2><input class="search fd-q" id="fdq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(W.findPh)}" aria-label="${esc(W.find)}" value="${esc(FD.q)}"><div id="fdbody"></div></div>`;
  if (!d.open) d.showModal();
  if (sel) showPlayer(sel); else { renderFind(); setTimeout(() => $('fdq')?.focus(), 30); }
}
function renderFind() {
  const W = u().w, b = $('fdbody'); if (!b) return;
  if (FD.sel) {
    const p = FD.p, chars = p ? Object.values(p.characters?.data || {}).sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed)) : [];
    const ch = p?.characters?.data?.[FD.cid];
    let body;
    if (FD.status === 'loading') body = `<p class="fd-msg">${esc(W.findLoadingP)}</p>`;
    else if (!ch) body = `<p class="fd-msg">${esc(W.privateP)}</p>`;
    else {
      const eq = p.characterEquipment?.data?.[FD.cid]?.items || [], sub = eq.find(i => i.bucketHash === SUB_BUCKET), sn = FD.B?.loc?.[sub?.itemHash]?.n;
      const el = ELEMENTS[FD.B?.en?.[sub?.itemHash]?.dt] || '', [a1, a2] = ELEMENT_ACC[el] || ELEMENT_ACC.arc;
      const r = rtf(), ago = ch.dateLastPlayed && r ? (() => { const d = (Date.parse(ch.dateLastPlayed) - Date.now()) / 1000, a = Math.abs(d); return a < 3600 ? r.format(Math.round(d / 60), 'minute') : a < 86400 ? r.format(Math.round(d / 3600), 'hour') : r.format(Math.round(d / 86400), 'day'); })() : '';
      body = `<div class="fd-hero" style="--a1:${a1};--a2:${a2}"><div class="fd-band"${ch.emblemBackgroundPath ? ` style="background-image:url('${BNET}${ch.emblemBackgroundPath}')"` : ''}><div class="fd-id"><div class="fd-who"><span>${esc(FD.sel.name)}</span><button type="button" class="fd-fav" aria-pressed="${isFav(FD.sel)}" title="${esc(isFav(FD.sel) ? W.unfav : W.fav)}" aria-label="${esc(isFav(FD.sel) ? W.unfav : W.fav)}">${STAR_ICON(isFav(FD.sel))}</button></div><div class="fd-ttl">${esc(charTitle(u().classes[ch.classType] || '', sn))}</div></div><div class="fd-pw"><b>${ch.light}</b><span>${esc(ago ? W.lastPlayed(ago) : u().power)}</span></div></div>
        ${chars.length > 1 ? `<div class="fd-chars">${chars.map(c => `<button type="button" class="char" data-fdc="${c.characterId}" aria-pressed="${c.characterId === FD.cid}">${esc(u().classes[c.classType])}<span class="pw">${c.light}</span></button>`).join('')}</div>` : ''}
        ${FD.B ? `<div class="fd-act"><span class="fd-act-k">${esc(FD.cmp ? W.cmpOn : W.subclass)}</span>${profile ? `<button type="button" class="fd-ib fd-cmpbtn" aria-pressed="${!!FD.cmp}" title="${esc(FD.cmp ? W.cmpClose : W.compare)}" aria-label="${esc(FD.cmp ? W.cmpClose : W.compare)}">${FD.cmp ? CLOSE_ICON : CMP_ICON}</button>` : ''}<button type="button" class="fd-ib fd-link" title="${esc(W.copyLink)}" aria-label="${esc(W.copyLink)}">${LINK_ICON}</button><a class="fd-ib fd-dim" href="${esc(dimLink(fdCtx()))}" target="_blank" rel="noopener" title="${esc(W.toDim)}" aria-label="${esc(W.toDim)}">${EXPORT_ICON}<span>DIM</span></a><button type="button" class="fd-ib fd-cam b-cam" title="${esc(W.share)}" aria-label="${esc(W.share)}">${CAM_ICON}</button></div>` : ''}
        ${!profile && FD.B ? `<p class="fd-pub">${esc(W.publicNote)}</p>` : ''}${FD.cmp && FD.B && BUILD ? cmpSrcHTML() + (cmpMine() ? compareHTML(cmpMine(), fdCtx()) : `<p class="fd-msg fd-pad">${esc(FD.ldErr ? W.ldEmpty : W.loadingLd)}</p>`) : `<div class="build fd-build">${FD.B ? buildHTML(fdCtx()) : `<p class="b-note">${esc(W.findLoadingP)}</p>`}</div>`}</div>`;
    }
    b.innerHTML = `<button type="button" class="reset fd-back">← ${esc(FD.cmp ? W.backBuild : W.back)}</button>${body}`;
    return;
  }
  const res = FD.results;
  b.innerHTML = FD.status === 'loading' ? `<p class="fd-msg">${esc(W.findLoading)}</p>` : FD.status === 'error' ? `<p class="fd-msg">${esc(W.findErr)}</p>` : res == null ? favsHTML() + `<p class="fd-msg">${esc(W.findHint)}</p>` : !res.length ? `<p class="fd-msg">${esc(W.findNone)}</p>` : `<ul class="fd-res">${res.map((x, i) => { const k = x.name.lastIndexOf('#'); return `<li><button type="button" data-fdr="${i}"><span>${esc(x.name.slice(0, k))}</span><small>${esc(x.name.slice(k))}</small></button></li>`; }).join('')}</ul>`;
}
const fdCtx = () => ({ p: FD.p, cid: FD.cid, B: FD.B, name: FD.sel?.name || '' });
/* favoritos: ficam salvos neste navegador e aparecem como atalho na busca */
const favs = () => LS.get('dc-favs', []);
const isFav = sel => !!sel && favs().some(f => f.id === sel.id);
function favInfo() { const ch = FD.p?.characters?.data?.[FD.cid]; if (!ch) return {}; const sub = (FD.p.characterEquipment?.data?.[FD.cid]?.items || []).find(i => i.bucketHash === SUB_BUCKET); return { t: charTitle(u().classes[ch.classType] || '', FD.B?.loc?.[sub?.itemHash]?.n), pw: ch.light, at: Date.now() }; }
function toggleFav(sel) { const l = favs(), i = l.findIndex(f => f.id === sel.id); if (i >= 0) l.splice(i, 1); else l.unshift({ name: sel.name, type: sel.type, id: sel.id, ...favInfo() }); LS.set('dc-favs', l.slice(0, 30)); if (tab === 'gd') render(); }
// ao abrir um favorito, guarda a classe/subclasse e a luz de agora para mostrar na lista
function touchFav() { const l = favs(), f = l.find(x => x.id === FD.sel?.id); if (!f || !FD.B) return; Object.assign(f, favInfo()); LS.set('dc-favs', l); }
function favsHTML() {
  const l = favs(); if (!l.length) return '';
  return `<div class="fd-k">${esc(u().w.favT)}</div><ul class="fd-res fd-favs">${l.map((x, i) => { const k = x.name.lastIndexOf('#'); return `<li><button type="button" data-fdv="${i}"><span class="fd-star" aria-hidden="true">★</span><span>${esc(k > 0 ? x.name.slice(0, k) : x.name)}</span><small>${esc(k > 0 ? x.name.slice(k) : '')}</small></button></li>`; }).join('')}</ul>`;
}
/* link público: ?jogador=Nome#1234 abre a build dessa pessoa, sem precisar entrar */
const playerLink = name => `${location.origin}/?jogador=${encodeURIComponent(name)}`;
async function copyLink(name, btn) {
  const url = playerLink(name);
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: name + ' · Destiny Checklist', url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); } catch { prompt('', url); return; }
  if (btn) { btn.classList.add('ok'); btn.dataset.tip = u().w.linkOk; setTimeout(() => { btn.classList.remove('ok'); delete btn.dataset.tip; }, 1600); }
}
/* comparar com um dos seus loadouts salvos no jogo, além da build equipada */
const LDCTX = {};
function cmpSrcHTML() {
  const W = u().w, ls = profile.characterLoadouts?.data?.[charId]?.loadouts || [];
  const opts = ls.map((l, i) => [i, l]).filter(([, l]) => (l.items || []).some(x => x.itemInstanceId && x.itemInstanceId !== '0'));
  if (!opts.length) return '';
  const cur = FD.src ?? -1, nm = (l, i) => loadoutNames[l.nameHash]?.n || `Loadout ${i + 1}`;
  return `<div class="fd-src"><span class="fd-act-k">${esc(W.cmpWith)}</span><div class="fd-src-l"><button type="button" class="char" data-src="-1" aria-pressed="${cur === -1}">${esc(W.equippedNow)}</button>${opts.map(([i, l]) => `<button type="button" class="char" data-src="${i}" aria-pressed="${cur === i}">${esc(nm(l, i))}</button>`).join('')}</div></div>`;
}
function cmpMine() { const s = FD.src ?? -1; if (s < 0) return ownCtx(); const c = LDCTX[charId + ':' + s + ':' + lang]; if (!c && !FD.ldErr && FD.ldBusy !== s) { FD.ldBusy = s; loadLdCtx(s).catch(() => { FD.ldErr = true; }).then(() => { FD.ldBusy = null; if (FD.cmp && FD.src === s) { renderFind(); loadCmpOwnership(); } }); } return c && c.B ? c : null; }
async function loadLdCtx(i) {
  const key = charId + ':' + i + ':' + lang; FD.ldErr = false;
  if (LDCTX[key]) return;
  const l = profile.characterLoadouts?.data?.[charId]?.loadouts?.[i]; if (!l) return;
  const all = {}; const add = (items, own) => { for (const it of items || []) if (it.itemInstanceId) all[it.itemInstanceId] = it; };
  add(profile.profileInventory?.data?.items); for (const v of Object.values(profile.characterInventories?.data || {})) add(v.items); for (const v of Object.values(profile.characterEquipment?.data || {})) add(v.items);
  const ORDER = [SUB_BUCKET, ...WEAPON_B, ...ARMOR_B], picked = [];
  (l.items || []).forEach((x, k) => { const it = all[x.itemInstanceId]; if (it) picked.push({ it, k, plugs: x.plugItemHashes || [] }); });
  if (!picked.length) { FD.ldErr = true; return; }
  const en = await entities('DestinyInventoryItemDefinition', picked.map(x => x.it.itemHash), 'en');
  const sk = profile.itemComponents?.sockets?.data || {}, items = [], sockets = {};
  for (const { it, k, plugs } of picked) {
    const bucket = en[it.itemHash]?.b || ORDER[k] || it.bucketHash;
    items.push({ itemHash: it.itemHash, itemInstanceId: it.itemInstanceId, bucketHash: bucket });
    const base = (sk[it.itemInstanceId]?.sockets || []).map(s => ({ ...s }));
    plugs.forEach((h, j) => { if (!h || h === 2166136261 || h === 4294967295) return; base[j] = { plugHash: h, isVisible: true, isEnabled: true }; });
    sockets[it.itemInstanceId] = { sockets: Array.from(base, s => s || {}) };
  }
  // o artefato não faz parte do loadout: mantém o que está equipado agora
  const art = (profile.characterEquipment?.data?.[charId]?.items || []).find(i => i.bucketHash === ARTIFACT_BUCKET);
  if (art) { items.push(art); sockets[art.itemInstanceId] = sk[art.itemInstanceId]; }
  const p = { characters: profile.characters, characterEquipment: { data: { [charId]: { items } } }, itemComponents: { sockets: { data: sockets }, instances: profile.itemComponents?.instances } };
  const B = await fetchBuild(p, charId);
  LDCTX[key] = { p, cid: charId, B, name: loadoutNames[l.nameHash]?.n || member?.name || '' };
}
async function doSearch(q) {
  const my = ++FD.seq; FD.sel = null;
  if (q.length < 2 && !q.includes('#')) { FD.results = null; FD.status = ''; renderFind(); return; }
  FD.status = 'loading'; renderFind();
  try { const r = await searchPlayers(q); if (my !== FD.seq) return; FD.results = r; FD.status = ''; }
  catch { if (my !== FD.seq) return; FD.status = 'error'; }
  renderFind();
}
async function showPlayer(sel) {
  const my = ++FD.seq; FD.cmp = false; FD.src = -1; FD.sel = sel; FD.p = null; FD.B = null; FD.cid = null; FD.status = 'loading'; renderFind();
  try {
    const p = await bungie(`/Destiny2/${sel.type}/Profile/${sel.id}/?components=200,205,300,305`, false); if (my !== FD.seq) return;
    FD.p = p; const chars = Object.values(p.characters?.data || {}).sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed));
    FD.cid = chars[0]?.characterId || null; FD.status = ''; renderFind();
    if (FD.cid) { FD.B = await fetchBuild(p, FD.cid); if (my === FD.seq) { renderFind(); touchFav(); } }
  } catch { if (my !== FD.seq) return; FD.status = ''; FD.p = {}; renderFind(); }
}
async function pickFdChar(cid) {
  const my = ++FD.seq; FD.cmp = false; FD.cid = cid; FD.B = null; renderFind();
  const b = await fetchBuild(FD.p, cid); if (my === FD.seq) { FD.B = b; renderFind(); }
}
$('finddlg').addEventListener('input', e => { if (e.target.id !== 'fdq') return; FD.q = e.target.value.trim(); clearTimeout(fdTimer); fdTimer = setTimeout(() => doSearch(FD.q), 600); });
$('finddlg').addEventListener('keydown', e => { if (e.target.id === 'fdq' && e.key === 'Enter') { clearTimeout(fdTimer); doSearch(FD.q); } });
$('finddlg').addEventListener('click', e => {
  const d = $('finddlg');
  if (e.target === d || e.target.closest('.fd-x')) { d.close(); return; }
  if (e.target.closest('.fd-back')) { if (FD.cmp) { FD.cmp = false; renderFind(); return; } FD.sel = null; FD.seq++; renderFind(); return; }
  if (e.target.closest('.fd-cmpbtn')) { if (FD.cmp) { FD.cmp = false; renderFind(); return; } if (!BUILD && have.g) loadBuild(gen); FD.cmp = true; renderFind(); loadCmpOwnership(); $('finddlg').querySelector('.fd-box').scrollTop = 0; return; }
  if (e.target.closest('.fd-fav')) { toggleFav(FD.sel); renderFind(); return; }
  const lk = e.target.closest('.fd-link'); if (lk) { copyLink(FD.sel.name, lk); return; }
  const sr = e.target.closest('[data-src]'); if (sr) { FD.src = +sr.dataset.src; FD.ldErr = false; renderFind(); return; }
  const fv = e.target.closest('[data-fdv]'); if (fv) { const x = favs()[+fv.dataset.fdv]; if (x) showPlayer(x); return; }
  const r = e.target.closest('[data-fdr]'); if (r) { const x = FD.results[+r.dataset.fdr]; if (x) showPlayer(x); return; }
  const c = e.target.closest('[data-fdc]'); if (c && c.dataset.fdc !== FD.cid) { pickFdChar(c.dataset.fdc); return; }
  if (e.target.closest('.b-cam')) openShare(fdCtx());
});
$('list').addEventListener('click', e => { const b = e.target.closest('.cl-p'); if (b && b.dataset.mid) { FD.q = ''; FD.results = null; openFind({ name: b.dataset.name, type: +b.dataset.mt, id: b.dataset.mid }); } });


/* ---------- comparar builds e levar para o DIM ---------- */
const CLOSE_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CAM_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
const CMP_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M16 7H4M4 7l3-3M4 7l3 3M4 13h12M16 13l-3-3M16 13l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR_ICON = on => `<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M10 2.6l2.3 4.7 5.1.7-3.7 3.6.9 5.1L10 14.3l-4.6 2.4.9-5.1L2.6 8l5.1-.7z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const LINK_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5L10 5.5M11.5 8.5a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5L10 14.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EXPORT_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M8 4H4v12h12v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WEAPON_B = [1498876634, 2465295065, 953998645], ARMOR_B = [3448274439, 3551918588, 14239492, 20886954, 1585787867];
function buildParts(C) {
  const B = C.B, eq = C.p.characterEquipment?.data?.[C.cid]?.items || [], sk = C.p.itemComponents?.sockets?.data || {};
  const plugs = i => (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => { const e = B.en[h]; return e?.n && !SKIP_NAME.test(e.n) && !SKIP_TYPE.test(e.tl); });
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), ps = sub ? plugs(sub) : [], t = h => B.en[h]?.tl || '';
  return {
    sub: sub?.itemHash, sup: ps.filter(h => /Super/.test(t(h))), asp: ps.filter(h => /Aspect/.test(t(h))), fr: ps.filter(h => /Fragment/.test(t(h))),
    ab: ps.filter(h => !/Super|Aspect|Fragment/.test(t(h))),
    w: WEAPON_B.map(b => eq.find(i => i.bucketHash === b)?.itemHash || 0),
    xa: eq.filter(i => ARMOR_B.includes(i.bucketHash)).map(i => i.itemHash).find(h => B.en[h]?.tt === 6) || 0,
    sets: (B.sets || []).map(s => s.n + ' · ' + s.count),
    art: B.art?.perks || [],
  };
}
// Algo da build do outro que você também pode usar: aspectos/fragmentos/habilidades pelos seus conjuntos de encaixes; armas e armaduras pela sua coleção
function iOwnPlug(h) {
  const has = list => (list || []).some(p => p.plugItemHash === h && p.canInsert !== false);
  for (const list of Object.values(profile.profilePlugSets?.data?.plugs || {})) if (has(list)) return true;
  for (const c of Object.values(profile.characterPlugSets?.data || {})) for (const list of Object.values(c.plugs || {})) if (has(list)) return true;
  return false;
}
function iOwnItem(h) { const c = COLL[h]; if (c === undefined) return null; return c ? colAcquired([c]) : null; }
async function loadCmpOwnership() {
  const P = buildParts(fdCtx()), need = [...P.w, P.xa].filter(h => h && COLL[h] === undefined);
  if (!need.length) return;
  await Promise.all(need.map(h => bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false).then(d => { COLL[h] = d.collectibleHash || 0; }).catch(() => { COLL[h] = 0; })));
  if (FD.cmp) renderFind();
}
function compareHTML(A, Bc) {
  const W = u().w, a = buildParts(A), b = buildParts(Bc);
  const nmA = h => A.B.loc[h]?.n || A.B.en[h]?.n || '', nmB = h => Bc.B.loc[h]?.n || Bc.B.en[h]?.n || '';
  const icA = h => A.B.loc[h]?.ic || A.B.en[h]?.ic, icB = h => Bc.B.loc[h]?.ic || Bc.B.en[h]?.ic;
  const cell = (h, nm, ic, cls) => h ? `<span class="${cls}">${ic(h) ? `<img src="${BNET}${ic(h)}" alt="" loading="lazy">` : ''}${esc(nm(h))}</span>` : `<span class="${cls} none">—</span>`;
  const own = (h, kind) => { if (kind === 'na') return ''; const o = kind === 'plug' ? iOwnPlug(h) : iOwnItem(h); return o === true ? 'have' : o === false ? 'miss' : 'unk'; };
  const row = (ha, hb, kind, exA, exB) => {
    if (ha && hb && (ha === hb || (nmA(ha) && nmA(ha) === nmB(hb)))) return `<div class="cmp-row same">${cell(ha, nmA, icA, 'mine' + (exA ? ' ex' : ''))}${cell(hb, nmB, icB, 'theirs' + (exB ? ' ex' : ''))}</div>`;
    return `<div class="cmp-row diff">${cell(ha, nmA, icA, 'mine' + (exA ? ' ex' : ''))}${cell(hb, nmB, icB, 'theirs ' + (hb ? own(hb, kind) : '') + (exB ? ' ex' : ''))}</div>`;
  };
  // alinha listas (aspectos, fragmentos): iguais primeiro, depois o resto lado a lado
  const pairs = (la, lb) => { const k = h => nmA(h) || h, kb = h => nmB(h) || h, ka = la.map(k), kbl = lb.map(kb); const same = la.filter(h => kbl.includes(k(h))), ra = la.filter(h => !kbl.includes(k(h))), rb = lb.filter(h => !ka.includes(kb(h))), out = same.map(h => [h, lb[kbl.indexOf(k(h))]]); for (let i = 0; i < Math.max(ra.length, rb.length); i++) out.push([ra[i] || 0, rb[i] || 0]); return out; };
  const grp = (t, rows) => rows ? `<div class="cmp-r"><div class="cmp-k">${esc(t)}</div>${rows}</div>` : '';
  const exW = (C, h) => C.B.en[h]?.tt === 6;
  const chA = A.p.characters.data[A.cid], chB = Bc.p.characters.data[Bc.cid];
  const ttlA = charTitle(u().classes[chA.classType] || '', A.B.loc[a.sub]?.n), ttlB = charTitle(u().classes[chB.classType] || '', Bc.B.loc[b.sub]?.n);
  const [ca] = ELEMENT_ACC[ELEMENTS[A.B.en[a.sub]?.dt]] || ELEMENT_ACC.arc, [cb] = ELEMENT_ACC[ELEMENTS[Bc.B.en[b.sub]?.dt]] || ELEMENT_ACC.arc;
  return `<div class="cmp">
    <div class="cmp-h"><div style="--c:${ca}"><small>${esc(W.you)} · ${esc(String(A.name).replace(/#\d+$/, ''))}</small><b>${esc(ttlA)}</b></div><div style="--c:${cb}"><small>${esc(String(Bc.name).replace(/#\d+$/, ''))}</small><b>${esc(ttlB)}</b></div></div>
    ${grp('Super', row(a.sup[0], b.sup[0], 'plug'))}
    ${grp(W.abilities, pairs(a.ab, b.ab).map(([x, y]) => row(x, y, 'plug')).join(''))}
    ${grp(W.aspects, pairs(a.asp, b.asp).map(([x, y]) => row(x, y, 'plug')).join(''))}
    ${grp(W.frags, pairs(a.fr, b.fr).map(([x, y]) => row(x, y, 'plug')).join(''))}
    ${grp(W.weapons, a.w.map((h, k) => row(h, b.w[k], 'item', exW(A, h), exW(Bc, b.w[k]))).join(''))}
    ${grp(W.exoArmor, row(a.xa, b.xa, 'item', true, true))}
    ${a.art.length || b.art.length ? grp(W.artT, pairs(a.art, b.art).map(([x, y]) => row(x, y, 'na')).join('')) : ''}
    ${a.sets.length || b.sets.length ? grp(W.setT, `<div class="cmp-row ${a.sets.join() === b.sets.join() ? 'same' : 'diff'}"><span class="mine">${esc(a.sets.join(', ') || '—')}</span><span class="theirs">${esc(b.sets.join(', ') || '—')}</span></div>`) : ''}
    <p class="cmp-leg"><span class="li"><span class="lg have"></span>${esc(W.lgHave)}</span><span class="li"><span class="lg miss"></span>${esc(W.lgMiss)}</span><span class="li"><span class="lg same">=</span>${esc(W.lgSame)}</span></p></div>`;
}
function dimLink(C) {
  const eq = C.p.characterEquipment?.data?.[C.cid]?.items || [], sk = C.p.itemComponents?.sockets?.data || {}, ch = C.p.characters.data[C.cid], B = C.B;
  const equipped = [], mods = [];
  for (const i of eq) {
    if (i.bucketHash === SUB_BUCKET) { const so = {}; (sk[i.itemInstanceId]?.sockets || []).forEach((s, k) => { if (s.plugHash && s.isVisible !== false && !SKIP_NAME.test(B.en[s.plugHash]?.n || '')) so[k] = s.plugHash; }); equipped.push({ hash: i.itemHash, socketOverrides: so }); }
    else if (WEAPON_B.includes(i.bucketHash)) equipped.push({ hash: i.itemHash });
    else if (ARMOR_B.includes(i.bucketHash)) { equipped.push({ hash: i.itemHash }); for (const s of sk[i.itemInstanceId]?.sockets || []) { const e = B.en[s.plugHash]; if (s.plugHash && e && /Mod$/.test(e.tl) && !SKIP_NAME.test(e.n) && !/Empty|Default/i.test(e.n)) mods.push(s.plugHash); } }
  }
  const sn = B.loc[eq.find(i => i.bucketHash === SUB_BUCKET)?.itemHash]?.n;
  const lo = { name: `${String(C.name).replace(/#\d+$/, '')} · ${charTitle(u().classes[ch.classType] || '', sn)}`, classType: ch.classType, clearSpace: false, equipped, unequipped: [], parameters: { mods } };
  return 'https://app.destinyitemmanager.com/loadouts?loadout=' + encodeURIComponent(JSON.stringify(lo));
}

/* ---------- início ---------- */
async function start() {
  try {
    status(u().loading);
    await loadAccount();
  } catch (e) {
    if (e.message === 'auth') { status(''); render(); return; }
    status('');
    showMessage(`<p class="notice">${esc(e.message === 'maintenance' ? u().maintenance : u().apiError(e.message))}</p>`);
  }
}
// instala como app (ícone na tela inicial, abre sem a barra do navegador e funciona sem internet)
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
(async function init() {
  if (LS.get('dc-hide2', false)) { $('hide').checked = true; document.body.classList.add('hide-done'); }
  applyUI();
  const h = readHash();
  try {
    [cfg, defs, ITEMS] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/data/defs.json', { cache: 'no-cache' }).then(r => r.json()), fetch('/data/items.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}))]);
  } catch { cfg = { configured: false }; showMessage(`<p class="notice">${esc(u().notConfigured)}</p>`); return; }
  if (h?.error) { render(); $('list').insertAdjacentHTML('afterbegin', `<p class="notice">${esc(u().authError(h.error))}</p>`); return; }
  if (h?.auth) { auth = h.auth; LS.set('dc-auth', auth); }
  const pub = new URLSearchParams(location.search).get('jogador') || new URLSearchParams(location.search).get('player');
  if (auth) { render(); if (pub) openPublic(pub); await start(); if ($('finddlg').open) renderFind(); } else { render(); if (pub) openPublic(pub); }
})();
async function openPublic(name) {
  FD.q = name; FD.results = null; openFind();
  history.replaceState(null, '', location.pathname + location.hash); // o endereço volta a ser o do site; quem abriu continua vendo a build
  try { const r = await searchPlayers(name); if (r.length === 1) showPlayer(r[0]); else { FD.results = r; renderFind(); } } catch { FD.status = 'error'; renderFind(); }
}
})();
