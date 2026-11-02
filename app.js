/* DPI · Destiny Parallel Interface — lê a conta Bungie.net da pessoa e monta o checklist.
   Tudo roda no navegador; o servidor só troca o código do login pelos tokens. */
(() => {
'use strict';
const API = 'https://www.bungie.net/Platform';
const QUEST_BUCKET = 1345459588;
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} if (LS.hook) LS.hook(k); },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
/* ---------- troca de endereço: destiny-checklist.vercel.app → destinyparallel.vercel.app ----------
   O endereço antigo repassa o retorno do login e, quando a Bungie passa a recusar a chave nele (erro 2107),
   envia o que falta sincronizar e leva a pessoa ao novo com login, preferências e marcações (#move=).
   No endereço novo, #move= só preenche o que ainda não existe aqui. */
const OLD_HOST = 'destiny-checklist.vercel.app', NEW_ORIGIN = 'https://destinyparallel.vercel.app';
const LEAVING = location.host === OLD_HOST && /[#&]auth(_error)?=/.test(location.hash);
if (LEAVING) location.replace(NEW_ORIGIN + location.pathname + location.search + location.hash);
(() => {
  if (!location.hash.startsWith('#move=')) return;
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(6).replace(/-/g, '+').replace(/_/g, '/')))));
    for (const [k, v] of Object.entries(o)) if (/^dc-/.test(k) && typeof v === 'string' && localStorage.getItem(k) == null) localStorage.setItem(k, v);
  } catch {}
  history.replaceState(null, '', location.pathname + location.search);
})();
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- textos da interface ---------- */
const UI = {
  pt: {
    hide: 'Ocultar feitos', search: 'Buscar por nome ou origem', refresh: 'Atualizar', logout: 'Sair',
    newsLink: 'Novidades e sugestões', newsShort: 'Novidades', sugNew: n => n === 1 ? '1 sugestão nova' : `${n} sugestões novas`, disclaimer: 'Dados lidos da sua conta pela API oficial da Bungie. Este site não é afiliado à Bungie.',
    loadouts: 'Loadouts', checklist: 'Central', outQ: 'Confirmar?', liveT: 'Ao vivo', liveYou: 'você', liveSince: t => `desde ${t}`, livePriv: 'Build privada', liveTap: 'Toque para ver a build completa', statsT: 'Atributos', glT: 'Metas de build', ssRec: 'Novo recorde', ssRecBest: 'seu melhor tempo até hoje', ssRecSub: (o, d) => `antes ${o} · ${d} mais rápido`, ssSolo: 'Solo', ssSoloFl: 'Solo sem morrer', wkFeatT: 'Em destaque', wkFull: 'Abrir página', wkAllDone: 'Tudo feito aqui.', wkRwSt: { red: 'resgatada', earn: 'pronta para resgatar', todo: 'falta fazer' }, wkKind: { ch: 'Desafio', rw: 'Recompensas', q: 'Missão' }, glNote: 'Builds que você quer montar: cada item se marca sozinho quando você libera ou pega.', glAdd: n => `Faltam ${n} itens para você usar esta build.`, glBtn: '＋ Virar objetivo', glDone: 'Já é um objetivo', glView: 'Ver build', glDel: 'Remover', glAt: d => `adicionada em ${d}`, glSet: (n, k) => `Conjunto ${n}: ${k} ${k === 1 ? 'peça' : 'peças'}`, glSetSrc: 'qualquer peça do conjunto, para os bônus', glRef: 'Atributos da build', glYou: 'você', glNone: 'Nenhuma meta ainda. Na comparação de builds, use “Virar objetivo” no que falta.', glSrcPlug: 'Liberar no menu da subclasse', glG: { asp: 'Aspectos', fr: 'Fragmentos', ab: 'Habilidades', w: 'Armas', a: 'Armadura' }, tsK: 'Ordenar', ytGuide: 'Guia em vídeo', postT: 'Correios', lbT: 'Montador de loadout', lbNote: 'Escolha o exótico e a ordem dos atributos: o DPI testa as combinações das suas armaduras (cofre e personagens) e manda a escolhida para o DIM.', lbLoad: 'Carregar minhas armaduras', lbLoading: 'Lendo as armaduras e os atributos de cada peça…', lbErr: 'Não deu para ler as armaduras agora.', lbExo: 'Exótico', lbExoAny: 'Qualquer um', lbExoNone: 'Nenhum', lbSet: 'Bônus de conjunto', lbSetAny: 'Não importa', lbNeed: 'Peças do conjunto', lbPrio: 'Atributos em ordem de importância (mínimo opcional)', lbMin: 'mín.', lbRun: 'Buscar combinações', lbRunning: 'Testando…', lbPieces: n => `${n} peças desta classe`, lbReload: 'Recarregar armaduras', lbMeta: (n, s) => `${n} combinações testadas em ${s} s · 10 melhores`, lbNone: 'Nenhuma combinação atende aos mínimos escolhidos.', lbNoSet: 'Sem bônus de conjunto', lbDim: 'Abrir no DIM', lbVault: 'Cofre', lbEquipped: 'Equipada', pfNotFound: n => `Não encontrei o guardião ${n}.`, pfErr: 'Não deu para carregar o perfil agora.', pfRank: n => `Patente de Guardião ${n}`, pfCmp: 'Comparar comigo', pfCopy: 'Copiar link', pfPlayed: d => `jogou em ${d}`, pfClears: 'conclusões no total', pfSeals: 'títulos completos', pfHours: 'Horas jogadas', pfAllChars: 'em todos os personagens', pfActs: 'Incursões e masmorras', pfAct: 'Atividade', pfClearsH: 'Conclusões', pfFast: 'Mais rápida', pfNone: 'Nenhuma incursão ou masmorra concluída ainda (ou perfil privado).', pfRest: n => `${n} ainda não concluídas não aparecem aqui.`, pfPriv: 'Triunfos privados.', pfBuild: 'Build atual', pfBuildNote: 'O que está equipado agora no personagem jogado por último, com perks e mods.', pfBuildBtn: 'Ver build completa', pfFoot: 'Dados ao vivo da API da Bungie.', pubB: 'Link público da build', pubWait: 'Gerando link…', pubImg: 'Gerando a prévia…', pubOk: 'Link copiado!', pubRepl: t => `Link copiado · substituiu o mais antigo (${t})`, pubErr: 'Não deu certo, tente de novo', shrT: 'Compartilhar', shrPub: 'Link desta build', shrPubD: 'Fica igual para sempre e mostra prévia no Discord. Até 5 por conta: o 6º substitui o mais antigo.', shrProf: 'Link do perfil', shrProfD: 'Sempre mostra a build que está em uso no momento.', shrImg: 'Imagem da build', shrImgD: 'Gera uma imagem para mandar como foto.', wishT: 'Lista de desejos', wishHave: 'já tem na coleção', focT: 'Foco', focNote: 'O que você marcou com ☆ em títulos, incursões, masmorras, missões, exóticos e catalisadores.', focMore: n => `+ ${n} itens`, focDone: 'Tudo feito!', wishAny: 'Qualquer', wishSt1: 'Atributo principal', wishSt2: 'Secundário', wishNoSrc: 'Fonte não informada pela Bungie.', wishObjNote: 'Armas e armaduras que você marcou com ☆: o rolo ou os atributos que você quer e onde dropam.', wishOnSaleN: n => n === 1 ? '1 está à venda agora!' : `${n} estão à venda agora!`, wishShort: 'Desejo', wishNote: 'Toque na ☆ de uma arma nos vendedores para guardar aqui. Quando ela estiver à venda, aparece em Hoje.', wishNone: 'Nada na lista ainda.', wishSale: who => `à venda agora com ${who}`, todayT: 'Hoje', todayReset: t => `Reseta em ${t} (14h de Brasília).`, todayNone: 'Nenhuma arma nova nos vendedores hoje.', todayNote: 'Armas que os vendedores trocam todo dia; ☆ guarda na lista de desejos.', clckT: 'Checklist do clã', clckNote: 'Quem do clã já fez cada incursão e masmorra, para montar grupos de primeira vez.', clckBtn: n => `Carregar (${n} membros)`, clckLoading: (a, b) => `Carregando ${a}/${b}…`, clckNever: 'Nunca fizeram:', clckAll: 'Todo mundo já fez.', clckPriv: n => n ? `${n} com perfil privado ficaram de fora.` : '', clckRe: 'Atualizar', clckAllF: 'Todas', fgT: 'Grupo de primeira vez', fgAnyAll: 'Nunca fez nenhuma incursão nem masmorra', fgAnyRaid: 'Nunca fez nenhuma incursão', fgAnyDg: 'Nunca fez nenhuma masmorra', fgNote: 'Escolha a incursão ou masmorra: aparece quem do clã nunca fez (online primeiro) e quem já fez e pode guiar.', fgLoad: 'Carregar dados do clã', fgMe: 'Você também nunca fez esta: boa hora para montar o grupo!', fgOn: n => `Online agora e nunca fizeram (${n})`, fgNoneOn: 'Ninguém online que nunca fez.', fgOff: 'Nunca fizeram (jogaram por último)', fgGuides: n => `Já fizeram e podem guiar (${n})`, cmpgT: 'Comparar guardiões', cmpgNote: 'Conclusões de cada incursão e masmorra, lado a lado.', cmpgPick: 'Escolha um favorito ou alguém do clã…', cmpgYou: 'Você', cmpgTot: 'Total', cmpgPriv: 'Esse guardião tem o perfil privado.', postEmpty: 'Nada parado nos correios dos seus personagens.', postFull: 'Correio quase cheio: com 21 itens, o que chegar depois se perde.', postNote: 'Pegue no Postmaster, na Torre. Os exóticos aparecem em dourado.', newsT: t => `Destiny 2 atualizou: ${t.replace(/^Destiny 2\s*/i, '')}`, newsAgo: d => d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`, newsRead: 'Ler as notas ↗', ytMany: n => `Vídeos (${n})`, giBtn: n => `Imagens (${n})`, giFull: 'Tamanho original', giClose: 'Fechar', tsO: { tier: 'Dificuldade', wpn: 'Falta arma', cat: 'Falta catalisador', near: 'Quase lá', low: 'Menos feitos', name: 'A–Z' }, tsNone: 'Nada aqui com esse filtro.', statsHi: 'acima de 100: bônus extra',
    tabs: { obj: 'Objetivos', act: 'Atividades', drops: 'Arsenal', gd: 'Guardião' },
    subs: { obj: 'Principal', prog: 'Em andamento', camp: 'Campanhas', raid: 'Incursões', dg: 'Masmorras', xm: 'Missões exóticas', tit: 'Títulos', tri: 'Triunfos', exo: 'Exóticos', cat: 'Catalisadores', vend: 'Vendedores', gd: 'Builds', gcl: 'Clã', grep: 'Relatórios', gst: 'Estatísticas' },
    heroTitle: 'Central do Guardião', heroText: 'Entre com a sua conta Bungie.net para verificar seus objetivos, acompanhar a rotação semanal, completar seu arsenal exótico e compartilhar suas builds.', lsQ: 'Buscar guardião: Nome#1234', lsBtn: 'Buscar', lsHint: 'Veja a build equipada de qualquer jogador, sem precisar entrar.',
    heroList: ['O site só lê os seus dados; não altera nada no jogo.', 'Sua senha fica na Bungie; o site nunca vê.', 'Marcações, favoritos e builds salvas sincronizam entre celular e PC.'],
    login: 'Entrar com Bungie.net', notConfigured: 'O site ainda não foi configurado: faltam as chaves da Bungie nas variáveis de ambiente da Vercel.',
    loading: 'Carregando sua conta…', loadingDefs: 'Buscando nomes de missões e itens…', loadingPlaces: 'Buscando locais das missões…', cached: t => `Mostrando dados das ${t}; atualizando…`, updated: t => `Atualizado às ${t}`,
    relogNote: 'Atualizamos o acesso do site com a Bungie: entre de novo, uma vez, para continuar (suas marcações e favoritos continuam salvos).', authError: m => `Não deu para entrar: ${m}. Tente de novo.`, apiError: m => `Erro ao falar com a Bungie: ${m}`,
    maintenance: 'A API da Bungie está em manutenção agora. Tente de novo em alguns minutos.',
    noChars: 'Nenhum personagem de Destiny 2 encontrado nesta conta.',
    done1: (n, t) => `${n} de ${t} feitos`, dg: (n, t) => `${n} de ${t} masmorras concluídas`, raid: (n, t) => `${n} de ${t} incursões concluídas`,
    tit: (n, t) => `${n} de ${t} títulos conquistados`, camp: n => `${n} campanha${n === 1 ? '' : 's'} em andamento`, xm: (n, t) => `${n} de ${t} missões exóticas concluídas`, campDone: (n, t) => `${n} de ${t} campanhas concluídas em todas as dificuldades`, ld: n => `${n} loadout${n === 1 ? '' : 's'} no jogo`,
    panels: (n, sh) => n === 1 ? '1 painel concluído ' + (sh ? 'aparecendo.' : 'oculto.') : `${n} painéis concluídos ${sh ? 'aparecendo.' : 'ocultos.'}`,
    show: 'Mostrar', hideDone: 'Ocultar concluídos',
    s: {
      contracts: 'Contratos ativos', contractsNote: 'Contratos e recompensas que estão com você agora.', noContracts: 'Nenhum contrato ativo agora. Pegue novos com os Sindicatos ou vendedores.', expires: h => h >= 48 ? `Expira em ${Math.round(h / 24)} dias.` : `Expira em ${h} h.`,
      loadingQuests: 'Carregando missões e contratos…', loadingRecords: 'Carregando títulos e catalisadores…',
      quests: 'Missões em andamento', questsNote: 'Do seu registro de missões, das mais adiantadas para as menos.',
      nearCats: 'Catalisadores quase prontos', nearCatsNote: 'Já passaram da metade.',
      nearTitles: 'Títulos quase prontos', nearTitlesNote: 'Faltam poucos triunfos.',
      noCamp: 'Nenhuma campanha em andamento no registro deste personagem. Campanhas concluídas não aparecem.',
      campNote: (a, b) => `Passo ${a} de ${b}.`, campStep: n => `Passo atual: ${n}`, xmClear: n => `Concluir ${n}`, xmTri: 'Triunfos da missão', xmHow: 'Como liberar', xmNext: 'Missões seguintes', xmSteps: n => `${n} passos`, raidTri: 'Triunfos da incursão', dgTri: 'Triunfos da masmorra', campNormal: 'Concluir a campanha', campNotStarted: 'Não iniciada', campLeg: 'Todas as missões no Lendário', campMaster: 'Uma missão no Mestre', campIn: 'Em andamento.', campAll: 'Concluída em todas as dificuldades.', campLegLeft: 'Concluída; falta o Lendário.', campMasterLeft: 'Lendário feito; falta o Mestre.', campNone: 'Ainda não concluída.', current: 'Passo atual',
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
      find: 'Buscar guardião', findShort: 'Buscar', findPh: 'Nome Bungie (ex.: Fulano#1234)', findHint: 'Digite o nome Bungie completo, como aparece no jogo (ex.: Fulano). O #código é opcional: sem ele aparecem todos com esse nome.', findNone: 'Ninguém com esse nome exato. Confira se o nome está completo, com espaços e acentos.', findErr: 'Não deu para buscar agora. Tente de novo em instantes.', findLoading: 'Buscando…', findLoadingP: 'Carregando a build…', back: 'Voltar', privateP: 'Não deu para ver o equipamento desse guardião agora.', seeBuild: 'Ver a build', compare: 'Comparar com a minha build', cmpClose: 'Fechar a comparação', cmpOn: 'Comparando com a sua', artT: 'Artefato', toDim: 'Levar esta build para o DIM (abre como loadout para salvar)', backBuild: 'Voltar para a build', you: 'Você', abilities: 'Habilidades', exoArmor: 'Armadura exótica', armorCmp: 'Armadura', lgHave: 'diferente, e você tem', lgMiss: 'diferente, e você não tem', lgSame: 'igual nas duas', vendT: 'Vendedores da semana', vendNote: t => `Xûr, Banshee-44 e Ada-1 na Torre. Armas com o rolo que está à venda; em dourado as vantagens principais.${t ? ' Muda em ' + t + '.' : ''}`, notOwned: 'Não tem', nFocus: n => `${n} armas para focar`, focusT: 'Foco da semana', focusNote: 'Armas que dá para escolher com engrama e reputação nesta semana (o rolo sai aleatório).', notHeld: 'Fora do inventário', xurCats: 'Catalisadores', xurLeg: n => `Armas lendárias (${n})`, xurSub2: (n, t, c) => `${n} exóticos para ${c} · sai em ${t}`, xurGoneShort: 'Fora da Torre até sexta', missN: n => n === 1 ? '1 que falta' : `${n} que faltam`, nWeapons: n => n === 1 ? '1 arma' : `${n} armas`, nOther: n => n === 1 ? '1 item' : `${n} itens`, changesIn: t => `muda em ${t}`, perksGold: 'Em dourado, as duas vantagens principais do rolo à venda.', xurLeaves: t => `exóticos · sai em ${t}`, coins: 'moedas', coinsHave: n => `Você tem ${n} Moedas Estranhas.`, xurGone: 'O Xûr não está na Torre agora. Ele volta na sexta, às 14h.', shaders: (n, o) => o === n ? `Também vende ${n} tonalizadores, e você já tem todos.` : `Também vende ${n} tonalizadores; você tem ${o}.`, vaultT: 'Limpeza do cofre', of: 'de', slots: 'espaços usados', dupExo: 'Exóticos repetidos', dupLeg: 'Lendários repetidos', andMore: n => `E mais ${n}.`, vaultNote: 'Itens iguais guardados mais de uma vez. Para liberar espaço, desmonte as cópias que não usa, no jogo ou no DIM.', vaultClean: 'Nenhum item repetido no cofre.', statsT: 'Estatísticas de jogo', crucible: 'Crisol', eff: 'Eficiência', winsOf: (w, g) => `Vitórias (${w} de ${g})`, bestGame: 'Mais abates numa partida', cleared: 'Atividades concluídas', played: 'Tempo jogado', noTrials: 'Desafios de Osíris: você ainda não jogou.', trialsLine: (g, w, kd) => `Desafios de Osíris: ${g} partidas, ${w} vitórias, K/D ${kd}.`, recentT: 'Esquadrão recente', recentNote: 'Quem jogou no seu esquadrão nas últimas atividades. Toque num nome para ver a build.', recentNone: 'Ninguém no seu esquadrão nas últimas atividades.', together: n => n === 1 ? '1 atividade juntos' : `${n} atividades juntos`, clanTip: 'Toque num nome para ver a build da pessoa.', lastPlayed: d => `jogou ${d}`, fav: 'Favoritar este guardião', unfav: 'Tirar dos favoritos', favGT: 'Guardiões favoritos', favNone: 'Toque na estrela ao lado do nome de alguém (na busca, no clã ou no esquadrão recente) para guardar aqui.', seenAgo: t => `visto ${t}`, saveB: 'Salvar esta build', unsaveB: 'Tirar das builds salvas', savedT: 'Builds salvas', savedNone: 'Toque no marcador de página numa build (a sua, a de um loadout ou a de outro guardião) para guardar como ela está agora. Ela fica aqui mesmo que a pessoa troque de equipamento.', savedOn: d => `salva ${d}`, svName: t => `Nome da build (ex.: ${t} – Mestre)`, svNameL: 'Nome da build', svNote: 'Anotação (opcional)', xmT: 'Missões exóticas', xmNote: 'Todas as suas missões exóticas, somando os personagens: quantas vezes fez, o tempo mais rápido, a arma que cada uma dá e os triunfos.', xmNot: 'ainda não', xmCat: 'catalisador pendente', xmTri: 'Triunfos', xmLeft: 'Faltam', xmDone: 'missões feitas', xmClears: 'conclusões', xmLeftN: 'ainda não feitas', ahFast: 'Mais rápida', ahCp: 'pegou do checkpoint', ahFirst: 'Primeira conclusão', ahWith: 'Com', ahTries: 'Tentativas', ahOf: (c, t) => `${c} concluídas de ${t}`, ahKD: (k, d, kd) => `${k} abates · ${d} mortes · K/D ${kd}`, kills: 'abates', deaths: 'mortes', today: 'hoje', yesterday: 'ontem', ssT: 'Sua última sessão', ssMore: n => n === 1 ? 'Ver mais 1 da sessão' : `Ver mais ${n} da sessão`, ssNoDrop: x => `${x} ainda não caiu: cada conclusão é uma nova chance`, ssSeal: n => `+${n} ${n === 1 ? 'triunfo' : 'triunfos'}`, ssCatDone: 'Pronto para aplicar na arma', ssNewExo: 'Exótico novo na coleção', ssClaim: (n, t) => n === 1 ? `1 triunfo de ${t} para resgatar` : `${n} triunfos para resgatar (${t})`, ssClaimSub: 'Já concluídos; falta só resgatar no jogo', ssTitle: (a, b) => `Título: ${a} de ${b}`, ssBadge: { seal: 'Progresso em título', sealDone: 'Título completo!', cat: 'Progresso em catalisador', catDone: 'Catalisador completo!', first: 'Primeira conclusão!', exo: 'Exótico novo!', claim: 'Para resgatar', raid: 'Incursão concluída', dg: 'Masmorra concluída', done: 'Concluída' }, ssMode: { 3: 'Missão', 46: 'Anoitecer', 16: 'Anoitecer', 18: 'Assalto', 6: 'Patrulha', 5: 'Crisol', 63: 'Artimanha', 84: 'Desafios de Osíris' }, svSave: 'Salvar', svSaved: 'Salvo', svDirty: 'Alterações não salvas', svFail: 'Não deu para salvar', ldNote: 'Toque num loadout para ver a build completa, comparar com o que está equipado, aplicar na conta ou gerar a imagem.', ldEq: 'equipado agora', wkExo: n => `Dá para pegar esta semana (${n})`, wkExoNone: 'Nada que falta sai de atividade em destaque ou do Xûr esta semana.', wkExoTip: 'Mostra só os exóticos que faltam e saem de incursão/masmorra em destaque ou do Xûr.', weaponFrom: 'Arma:', favT: 'Favoritos', copyLink: 'Copiar o link desta build', myLink: 'Copiar o link da sua build', linkOk: 'Link copiado', cmpWith: 'Comparar com', equippedNow: 'Equipada agora', ldEmpty: 'Esse loadout está vazio.', loadingLd: 'Carregando o loadout…', publicNote: 'Você está vendo a build pública deste guardião. Entre com a sua conta para comparar com a sua.',
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
    newsLink: "What's new & suggestions", newsShort: "What's new", sugNew: n => n === 1 ? '1 new suggestion' : `${n} new suggestions`, disclaimer: 'Data read from your account through the official Bungie API. This site is not affiliated with Bungie.',
    loadouts: 'Loadouts', checklist: 'Hub', outQ: 'Confirm?', liveT: 'Live', liveYou: 'you', liveSince: t => `since ${t}`, livePriv: 'Private build', liveTap: 'Tap to see the full build', statsT: 'Stats', glT: 'Build goals', ssRec: 'New record', ssRecBest: 'your best time ever', ssRecSub: (o, d) => `was ${o} · ${d} faster`, ssSolo: 'Solo', ssSoloFl: 'Solo flawless', wkFeatT: 'Featured', wkFull: 'Open page', wkAllDone: 'All done here.', wkRwSt: { red: 'claimed', earn: 'ready to claim', todo: 'to do' }, wkKind: { ch: 'Challenge', rw: 'Rewards', q: 'Quest' }, glNote: 'Builds you want to put together: each item checks itself off when you unlock or get it.', glAdd: n => `You're missing ${n} items to run this build.`, glBtn: '＋ Make it a goal', glDone: 'Already a goal', glView: 'View build', glDel: 'Remove', glAt: d => `added ${d}`, glSet: (n, k) => `${n} set: ${k} ${k === 1 ? 'piece' : 'pieces'}`, glSetSrc: 'any piece of the set, for the bonuses', glRef: 'Build stats', glYou: 'you', glNone: 'No goals yet. In build comparison, use “Make it a goal” on what is missing.', glSrcPlug: 'Unlock in the subclass menu', glG: { asp: 'Aspects', fr: 'Fragments', ab: 'Abilities', w: 'Weapons', a: 'Armor' }, tsK: 'Sort', ytGuide: 'Video guide', postT: 'Postmaster', lbT: 'Loadout builder', lbNote: 'Pick the exotic and the stat order: DPI tests the combinations of your armor (vault and characters) and sends the one you pick to DIM.', lbLoad: 'Load my armor', lbLoading: 'Reading your armor and each piece stats…', lbErr: "Couldn't read your armor right now.", lbExo: 'Exotic', lbExoAny: 'Any', lbExoNone: 'None', lbSet: 'Set bonus', lbSetAny: "Doesn't matter", lbNeed: 'Set pieces', lbPrio: 'Stats in order of importance (optional minimum)', lbMin: 'min.', lbRun: 'Find combinations', lbRunning: 'Testing…', lbPieces: n => `${n} pieces for this class`, lbReload: 'Reload armor', lbMeta: (n, s) => `${n} combinations tested in ${s} s · top 10`, lbNone: 'No combination meets the chosen minimums.', lbNoSet: 'No set bonus', lbDim: 'Open in DIM', lbVault: 'Vault', lbEquipped: 'Equipped', pfNotFound: n => `Couldn't find the guardian ${n}.`, pfErr: "Couldn't load the profile right now.", pfRank: n => `Guardian Rank ${n}`, pfCmp: 'Compare with me', pfCopy: 'Copy link', pfPlayed: d => `played ${d}`, pfClears: 'total clears', pfSeals: 'titles completed', pfHours: 'Hours played', pfAllChars: 'across all characters', pfActs: 'Raids and dungeons', pfAct: 'Activity', pfClearsH: 'Clears', pfFast: 'Fastest', pfNone: 'No raid or dungeon clears yet (or private profile).', pfRest: n => `${n} not cleared yet are hidden.`, pfPriv: 'Triumphs are private.', pfBuild: 'Current build', pfBuildNote: 'What is equipped right now on the last played character, with perks and mods.', pfBuildBtn: 'See full build', pfFoot: 'Live data from the Bungie API.', pubB: 'Public build link', pubWait: 'Creating link…', pubImg: 'Making the preview…', pubOk: 'Link copied!', pubRepl: t => `Link copied · replaced the oldest (${t})`, pubErr: 'Something went wrong, try again', shrT: 'Share', shrPub: 'Link to this build', shrPubD: 'Stays the same forever and shows a preview on Discord. Up to 5 per account: the 6th replaces the oldest.', shrProf: 'Profile link', shrProfD: 'Always shows the build in use right now.', shrImg: 'Build image', shrImgD: 'Makes an image to send as a picture.', wishT: 'Wishlist', wishHave: 'already in collection', focT: 'Focus', focNote: 'What you starred in titles, raids, dungeons, missions, exotics and catalysts.', focMore: n => `+ ${n} more`, focDone: 'All done!', wishAny: 'Any', wishSt1: 'Primary stat', wishSt2: 'Secondary', wishNoSrc: 'No source listed by Bungie.', wishObjNote: 'Weapons and armor you starred: the roll or stats you want and where they drop.', wishOnSaleN: n => n === 1 ? '1 is for sale now!' : `${n} are for sale now!`, wishShort: 'Wish', wishNote: 'Tap the ☆ on a vendor weapon to save it here. When it is for sale, it shows up in Today.', wishNone: 'Nothing on the list yet.', wishSale: who => `for sale now at ${who}`, todayT: 'Today', todayReset: t => `Resets in ${t} (17:00 UTC).`, todayNone: 'No new weapons at the vendors today.', todayNote: 'Weapons the vendors swap every day; ☆ saves to your wishlist.', clckT: 'Clan checklist', clckNote: 'Who in the clan has done each raid and dungeon, to build first-timer groups.', clckBtn: n => `Load (${n} members)`, clckLoading: (a, b) => `Loading ${a}/${b}…`, clckNever: 'Never done:', clckAll: 'Everyone has done it.', clckPriv: n => n ? `${n} with private profiles left out.` : '', clckRe: 'Refresh', clckAllF: 'All', fgT: 'First-timer group', fgAnyAll: 'Never done any raid or dungeon', fgAnyRaid: 'Never done any raid', fgAnyDg: 'Never done any dungeon', fgNote: 'Pick the raid or dungeon: see who in the clan has never done it (online first) and who has and can guide.', fgLoad: 'Load clan data', fgMe: 'You have never done this one either: good time to build the group!', fgOn: n => `Online now, never done (${n})`, fgNoneOn: 'Nobody online who has never done it.', fgOff: 'Never done (most recently played)', fgGuides: n => `Done it and can guide (${n})`, cmpgT: 'Compare guardians', cmpgNote: 'Clears for every raid and dungeon, side by side.', cmpgPick: 'Pick a favorite or a clanmate…', cmpgYou: 'You', cmpgTot: 'Total', cmpgPriv: 'This guardian has a private profile.', postEmpty: 'Nothing waiting at the Postmaster on your characters.', postFull: 'Postmaster almost full: at 21 items, anything new is lost.', postNote: 'Pick them up from the Postmaster in the Tower. Gold ones are exotics.', newsT: t => `Destiny 2 updated: ${t.replace(/^Destiny 2\s*/i, '')}`, newsAgo: d => d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`, newsRead: 'Read the notes ↗', ytMany: n => `Videos (${n})`, giBtn: n => `Images (${n})`, giFull: 'Full size', giClose: 'Close', tsO: { tier: 'Difficulty', wpn: 'Missing weapon', cat: 'Missing catalyst', near: 'Almost done', low: 'Least done', name: 'A–Z' }, tsNone: 'Nothing here with this filter.', statsHi: 'above 100: extra bonus',
    tabs: { obj: 'Objectives', act: 'Activities', drops: 'Arsenal', gd: 'Guardian' },
    subs: { obj: 'Main', prog: 'In progress', camp: 'Campaigns', raid: 'Raids', dg: 'Dungeons', xm: 'Exotic missions', tit: 'Titles', tri: 'Triumphs', exo: 'Exotics', cat: 'Catalysts', vend: 'Vendors', gd: 'Builds', gcl: 'Clan', grep: 'Reports', gst: 'Stats' },
    heroTitle: 'Guardian Hub', heroText: 'Sign in with your Bungie.net account to check your goals, follow the weekly rotation, complete your exotic arsenal and share your builds.', lsQ: 'Search guardian: Name#1234', lsBtn: 'Search', lsHint: "See any player's equipped build, no sign-in needed.",
    heroList: ['The site only reads your data; it never changes anything in the game.', 'Your password stays with Bungie; the site never sees it.', 'Checkmarks, favorites and saved builds sync between phone and PC.'],
    login: 'Sign in with Bungie.net', notConfigured: "The site isn't configured yet: the Bungie keys are missing from the Vercel environment variables.",
    loading: 'Loading your account…', loadingDefs: 'Fetching quest and item names…', loadingPlaces: 'Fetching quest locations…', cached: t => `Showing data from ${t}; updating…`, updated: t => `Updated at ${t}`,
    relogNote: 'We updated the site access with Bungie: sign in again, once, to continue (your marks and favorites are still saved).', authError: m => `Couldn't sign in: ${m}. Please try again.`, apiError: m => `Error talking to Bungie: ${m}`,
    maintenance: 'The Bungie API is down for maintenance. Try again in a few minutes.',
    noChars: 'No Destiny 2 characters found on this account.',
    done1: (n, t) => `${n} of ${t} done`, dg: (n, t) => `${n} of ${t} dungeons cleared`, raid: (n, t) => `${n} of ${t} raids cleared`,
    tit: (n, t) => `${n} of ${t} titles earned`, camp: n => `${n} campaign${n === 1 ? '' : 's'} in progress`, xm: (n, t) => `${n} of ${t} exotic missions cleared`, campDone: (n, t) => `${n} of ${t} campaigns done on every difficulty`, ld: n => `${n} in-game loadout${n === 1 ? '' : 's'}`,
    panels: (n, sh) => `${n} completed panel${n === 1 ? '' : 's'} ${sh ? 'shown.' : 'hidden.'}`,
    show: 'Show', hideDone: 'Hide completed',
    s: {
      contracts: 'Active contracts', contractsNote: 'Contracts and bounties you are holding right now.', noContracts: 'No active contracts right now. Pick up new ones from the Syndicates or vendors.', expires: h => h >= 48 ? `Expires in ${Math.round(h / 24)} days.` : `Expires in ${h} h.`,
      loadingQuests: 'Loading quests and contracts…', loadingRecords: 'Loading titles and catalysts…',
      quests: 'Quests in progress', questsNote: 'From your quest log, most advanced first.',
      nearCats: 'Catalysts almost done', nearCatsNote: 'Already past halfway.',
      nearTitles: 'Titles almost done', nearTitlesNote: 'Only a few triumphs left.',
      noCamp: 'No campaign in progress in this character\'s quest log. Finished campaigns are not shown.',
      campNote: (a, b) => `Step ${a} of ${b}.`, campStep: n => `Current step: ${n}`, xmClear: n => `Complete ${n}`, xmTri: 'Mission triumphs', xmHow: 'How to unlock', xmNext: 'Follow-up missions', xmSteps: n => `${n} steps`, raidTri: 'Raid triumphs', dgTri: 'Dungeon triumphs', campNormal: 'Finish the campaign', campNotStarted: 'Not started', campLeg: 'All missions on Legendary', campMaster: 'One mission on Master', campIn: 'In progress.', campAll: 'Done on every difficulty.', campLegLeft: 'Done; Legendary is left.', campMasterLeft: 'Legendary done; Master is left.', campNone: 'Not finished yet.', current: 'Current step',
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
      find: 'Find a guardian', findShort: 'Search', findPh: 'Bungie Name (e.g. Someone#1234)', findHint: 'Type the full Bungie Name as it shows in game (e.g. Someone). The #code is optional: without it you see everyone with that name.', findNone: 'No one with that exact name. Check that the name is complete, with spaces and accents.', findErr: "Couldn't search right now. Try again in a moment.", findLoading: 'Searching…', findLoadingP: 'Loading the build…', back: 'Back', privateP: "Couldn't see this guardian's gear right now.", seeBuild: 'See their build', compare: 'Compare with my build', cmpClose: 'Close comparison', cmpOn: 'Comparing with yours', artT: 'Artifact', toDim: 'Take this build to DIM (opens as a loadout to save)', backBuild: 'Back to the build', you: 'You', abilities: 'Abilities', exoArmor: 'Exotic armor', armorCmp: 'Armor', lgHave: 'different, and you have it', lgMiss: "different, and you don't have it", lgSame: 'same on both', vendT: "This week's vendors", vendNote: t => `Xûr, Banshee-44 and Ada-1 in the Tower. Weapons with the roll for sale; main perks in gold.${t ? ' Changes in ' + t + '.' : ''}`, notOwned: 'Not owned', nFocus: n => `${n} weapons to focus`, focusT: 'Focus this week', focusNote: 'Weapons you can pick with engrams and rank this week (random roll).', notHeld: 'Not in inventory', xurCats: 'Catalysts', xurLeg: n => `Legendary weapons (${n})`, xurSub2: (n, t, c) => `${n} exotics for ${c} · leaves in ${t}`, xurGoneShort: 'Away until Friday', missN: n => `${n} missing`, nWeapons: n => n === 1 ? '1 weapon' : `${n} weapons`, nOther: n => n === 1 ? '1 item' : `${n} items`, changesIn: t => `changes in ${t}`, perksGold: 'In gold, the two main perks of the roll for sale.', xurLeaves: t => `exotics · leaves in ${t}`, coins: 'coins', coinsHave: n => `You have ${n} Strange Coins.`, xurGone: "Xûr isn't in the Tower right now. He's back Friday at 17:00 UTC.", shaders: (n, o) => o === n ? `Also sells ${n} shaders, and you own all of them.` : `Also sells ${n} shaders; you own ${o}.`, vaultT: 'Vault cleanup', of: 'of', slots: 'slots used', dupExo: 'Duplicate exotics', dupLeg: 'Duplicate legendaries', andMore: n => `And ${n} more.`, vaultNote: 'Identical items stored more than once. To free space, dismantle the copies you don\'t use, in game or in DIM.', vaultClean: 'No duplicate items in the vault.', statsT: 'Game stats', crucible: 'Crucible', eff: 'Efficiency', winsOf: (w, g) => `Wins (${w} of ${g})`, bestGame: 'Most kills in a match', cleared: 'Activities cleared', played: 'Time played', noTrials: "Trials of Osiris: you haven't played yet.", trialsLine: (g, w, kd) => `Trials of Osiris: ${g} matches, ${w} wins, K/D ${kd}.`, recentT: 'Recent fireteam', recentNote: 'People in your fireteam in your latest activities. Tap a name to see their build.', recentNone: 'No one in your fireteam in your latest activities.', together: n => n === 1 ? '1 activity together' : `${n} activities together`, clanTip: 'Tap a name to see their build.', lastPlayed: d => `played ${d}`, fav: 'Favorite this guardian', unfav: 'Remove from favorites', favGT: 'Favorite guardians', favNone: "Tap the star next to someone's name (in search, your clan or recent fireteam) to keep them here.", seenAgo: t => `seen ${t}`, saveB: 'Save this build', unsaveB: 'Remove from saved builds', savedT: 'Saved builds', savedNone: 'Tap the bookmark on a build (yours, a loadout or another guardian) to keep it as it is right now. It stays here even if they change gear.', savedOn: d => `saved ${d}`, svName: t => `Build name (e.g. ${t} – Master)`, svNameL: 'Build name', svNote: 'Note (optional)', xmT: 'Exotic missions', xmNote: 'All your exotic missions across characters: clears, fastest time, the weapon each one gives and its triumphs.', xmNot: 'not yet', xmCat: 'catalyst missing', xmTri: 'Triumphs', xmLeft: 'Left', xmDone: 'missions done', xmClears: 'clears', xmLeftN: 'not done yet', ahFast: 'Fastest', ahCp: 'from checkpoint', ahFirst: 'First clear', ahWith: 'With', ahTries: 'Attempts', ahOf: (c, t) => `${c} cleared of ${t}`, ahKD: (k, d, kd) => `${k} kills · ${d} deaths · K/D ${kd}`, kills: 'kills', deaths: 'deaths', today: 'today', yesterday: 'yesterday', ssT: 'Your last session', ssMore: n => `See ${n} more from the session`, ssNoDrop: x => `${x} hasn't dropped: every clear is another shot`, ssSeal: n => `+${n} ${n === 1 ? 'triumph' : 'triumphs'}`, ssCatDone: 'Ready to insert in the weapon', ssNewExo: 'New exotic in your collection', ssClaim: (n, t) => n === 1 ? `1 ${t} triumph to claim` : `${n} triumphs to claim (${t})`, ssClaimSub: 'Already done; just claim them in game', ssTitle: (a, b) => `Title: ${a} of ${b}`, ssBadge: { seal: 'Title progress', sealDone: 'Title complete!', cat: 'Catalyst progress', catDone: 'Catalyst complete!', first: 'First clear!', exo: 'New exotic!', claim: 'To claim', raid: 'Raid cleared', dg: 'Dungeon cleared', done: 'Completed' }, ssMode: { 3: 'Mission', 46: 'Nightfall', 16: 'Nightfall', 18: 'Strike', 6: 'Patrol', 5: 'Crucible', 63: 'Gambit', 84: 'Trials of Osiris' }, svSave: 'Save', svSaved: 'Saved', svDirty: 'Unsaved changes', svFail: "Couldn't save", ldNote: 'Tap a loadout to see the full build, compare it with what you have equipped, apply it to your account or make the image.', ldEq: 'equipped now', wkExo: n => `Obtainable this week (${n})`, wkExoNone: 'Nothing you are missing drops from featured activities or Xûr this week.', wkExoTip: 'Shows only missing exotics that drop from the featured raid/dungeon or Xûr.', weaponFrom: 'Weapon:', favT: 'Favorites', copyLink: 'Copy the link to this build', myLink: 'Copy the link to your build', linkOk: 'Link copied', cmpWith: 'Compare with', equippedNow: 'Equipped now', ldEmpty: 'This loadout is empty.', loadingLd: 'Loading the loadout…', publicNote: "You're viewing this guardian's public build. Sign in to compare it with yours.",
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
const chipClass = x => /^(Exótico|Exotic)$/.test(x) ? 'exo' : /^(Fácil|Easy)$/.test(x) ? 'easy' : /^(Médio|Medium)$/.test(x) ? 'mid' : /^(Difícil|Hard|Muito difícil|Very hard)$/.test(x) ? 'hard' : /%$/.test(x) ? 'hot' : '';

/* ---------- estado ---------- */
let APIW = null; // endereço do servidor (Cloudflare), em data/api.json
let cfg = null, defs = null, ITEMS = null, auth = LS.get('dc-auth', null), profile = null, member = null;
let charId = null, tab = LS.get('dc-tab', 'obj'), prevTab = 'obj', query = '';
const lastSub = LS.get('dc-subs', {});
let marks = new Set(), SECTIONS = [], LOADOUTS = [], loadedAt = null;
const openSecs = new Set(), openItems = new Set();
const GROUPS = [{ id: 'obj', subs: ['obj'] }, { id: 'act', subs: ['camp', 'raid', 'dg', 'xm', 'tit', 'tri'] }, { id: 'drops', subs: ['exo', 'cat', 'vend'] }, { id: 'gd', subs: ['gd', 'gcl', 'grep', 'gst'] }];
const isGd = () => tab === 'gd' || tab === 'gcl' || tab === 'gst' || tab === 'grep'; // Guardião: builds/favoritos/clã e estatísticas
// Página de teste (/beta): só para o dono do site; recursos novos aparecem aqui antes de ir para todos
const BETA = location.pathname.replace(/\/+$/, '') === '/beta'; // página de testes do dono (/beta)
const FX = true; // recursos que passaram pelo /beta e agora valem para todos
if (FX) GROUPS[0].subs = ['obj', 'prog'];
const groupOf = t => GROUPS.find(g => g.subs.includes(t));
// aba salva que não existe mais (ex.: Padrões, que foi retirada) volta para Objetivos
if (tab !== 'ld' && !groupOf(tab)) { tab = 'obj'; LS.set('dc-tab', 'obj'); }
for (const [k, v] of Object.entries(lastSub)) if (!GROUPS.find(g => g.id === k)?.subs.includes(v)) delete lastSub[k];

/* ---------- status ---------- */
function status(msg) { $('status').textContent = msg || ''; }
/* telas largas: duas colunas independentes (abrir uma ilha não empurra a outra coluna) */
const WIDE = matchMedia('(min-width:1100px)');
function layoutCols() {
  const P = $('list').firstElementChild; if (!WIDE.matches || !P || !P.classList.contains('panel') || P.querySelector(':scope>.pcols')) return;
  const kids = [...P.children], full = el => getComputedStyle(el).gridColumnEnd === '-1', box = kids.filter(el => !full(el) && !el.hidden);
  if (box.length < 2) return;
  const wrap = document.createElement('div'), cols = [document.createElement('div'), document.createElement('div')], h = [0, 0];
  wrap.className = 'pcols'; cols.forEach(c => { c.className = 'pcol'; wrap.append(c); });
  const hs = box.map(el => el.offsetHeight); P.insertBefore(wrap, box[0]);
  box.forEach((el, i) => { const k = h[0] <= h[1] ? 0 : 1; cols[k].append(el); h[k] += hs[i] + 18; });
}
new MutationObserver(layoutCols).observe($('list'), { childList: true });
WIDE.addEventListener?.('change', () => typeof render === 'function' && render());
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
function logout() { resetChar(); PLUGS = null; plugsP = null; buildOpen = false; if (member) idbDel('profile-' + member.id); LS.del('dc-auth'); LS.del('dc-member'); LS.del('dc-synct'); SY.t = {}; SY.dirty.clear(); clearInterval(LIVE.timer); LIVE.timer = null; LIVE.on = false; LIVE.mem = []; LS.del('dc-el'); auth = null; profile = null; member = null; render(); }
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
  if (j.ErrorCode === 2107 && location.host === OLD_HOST) { moveToNew(); throw new Error('moving'); }
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
async function entity(type, hash, lc, needPc) {
  const key = type + ':' + hash, store = entCache[lc];
  if (store[key] && (store[key].n || !/LoadoutName/.test(type)) && (!needPc || store[key].pc !== undefined)) return store[key];
  try {
    const url = `/Destiny2/Manifest/${type}/${hash >>> 0}/?lc=${lc === 'pt' ? 'pt-br' : 'en'}`;
    const d = await bungie(url, false).catch(() => new Promise(r => setTimeout(r, 700)).then(() => bungie(url, false)));
    if (type === 'DestinyInventoryItemDefinition' && !IDEF[hash]) { IDEF[hash] = { a: d.equippingBlock?.ammoType || 0, s: d.equippingBlock?.equipableItemSetHash || 0, c: d.collectibleHash || 0 }; clearTimeout(idefT); idefT = setTimeout(() => { try { LS.set('dc-idef1', IDEF); } catch {} }, 500); }
    const v = { n: d.displayProperties?.name || d.name || '', d: d.displayProperties?.description || '', ql: d.setData?.questLineName || '', il: (d.setData?.itemList || []).map(x => x.itemHash), b: d.inventory?.bucketTypeHash || 0, it: d.itemType || 0, tl: d.itemTypeDisplayName || '', su: d.inventory?.stackUniqueLabel || '', ob: d.objectives?.objectiveHashes || [], lh: d.locationHash || 0, lr: (d.locationReleases || []).map(r => [r.destinationHash || 0, r.activityHash || 0]).slice(-1)[0] || null, ic: d.displayProperties?.icon || '', tt: d.inventory?.tierType || 0, dt: d.talentGrid?.hudDamageType || 0, ...(type === 'DestinyInventoryItemDefinition' ? { pc: d.plug?.plugCategoryIdentifier || '', st: d.itemSubType || 0, tr: (d.traitIds || []).includes('item.plug.aspect') ? 'a' : (d.traitIds || []).includes('item.plug.fragment') ? 'f' : '' } : {}) };
    store[key] = v; entDirty = true;
    return v;
  } catch { return { n: '', d: '', ql: '', il: [], b: 0, it: 0, tl: '', su: '', ob: [], lh: 0, lr: null }; }
}
function saveEnt() { if (entDirty) { LS.set('dc-ent4-en', entCache.en); LS.set('dc-ent4-pt', entCache.pt); entDirty = false; } }
async function pool(list, fn, n) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) await fn(list[i++]); })); }
/* Nomes em lote pelo servidor: um pedido para até 25 itens, guardados lá para todos os visitantes.
   O que o servidor não responder (fora do ar, limite do dia) é buscado direto na Bungie, como antes. */
const SRV_TYPES = new Set(['DestinyInventoryItemDefinition', 'DestinyObjectiveDefinition', 'DestinyLocationDefinition', 'DestinyActivityDefinition', 'DestinyMilestoneDefinition', 'DestinyLoadoutNameDefinition', 'DestinyRecordDefinition', 'DestinyCollectibleDefinition', 'DestinyPresentationNodeDefinition', 'DestinyDestinationDefinition', 'DestinyStatDefinition']);
let srvDown = 0;
const entOk = (type, v, needPc) => v && (v.n || !/LoadoutName/.test(type)) && (!needPc || v.pc !== undefined);
async function entities(type, hashes, lc, needPc, onChunk) {
  const out = {}, store = entCache[lc], need = [];
  for (const h of new Set(hashes)) { const v = store[type + ':' + h]; if (entOk(type, v, needPc)) out[h] = v; else need.push(h); }
  if (need.length && APIW && SRV_TYPES.has(type) && Date.now() > srvDown) {
    const chunks = []; for (let i = 0; i < need.length; i += 12) chunks.push(need.slice(i, i + 12));
    await Promise.all(chunks.map(async c => {
      try {
        const r = await fetch(APIW + '/defs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey }, body: JSON.stringify({ t: type, lc, h: c }) });
        if (!r.ok) { if (r.status >= 500 || r.status === 429) srvDown = Date.now() + (r.status === 503 ? 3600000 : 120000); return; } // 503 = freio de gastos
        const j = await r.json();
        for (const [h, v] of Object.entries(j.d || {})) {
          if (v.x) { if (!IDEF[h]) { IDEF[h] = v.x; clearTimeout(idefT); idefT = setTimeout(() => { try { LS.set('dc-idef1', IDEF); } catch {} }, 500); } delete v.x; }
          store[type + ':' + h] = v; entDirty = true; out[h] = v;
        }
        if (onChunk) onChunk(out);
      } catch { srvDown = Date.now() + 120000; }
    }));
  }
  await pool(need.filter(h => !entOk(type, out[h], needPc)), async h => { out[h] = await entity(type, h, lc, needPc); if (onChunk) onChunk(out); }, 10);
  saveEnt();
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
const TAB_PART = { xm: 'a', vend: 'a', obj: 'q', camp: 'q', raid: 'a', dg: 'a', exo: 'a', cat: 'b', tit: 'b', tri: 'b', ld: 'c', gd: 'a' };
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
  syncPull();
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
    else { build(); render(); if (k === 'a' && hydrated) { loadMilestones(gen); if (!VEND && tab === 'vend') loadVendors(gen); if (isGd()) loadGuardian(gen); } }
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
  const [dN, aN] = await Promise.all([entities('DestinyDestinationDefinition', dests, lang), entities('DestinyActivityDefinition', acts, lang)]);
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
// destaca nomes de lugares nas descrições (texto já escapado)
const PLACE_RE = new RegExp('(?<![\\p{L}-])(' + [...new Set(PLACE.flatMap(x => [x[1], x[2]]).concat(['Cosmódromo', 'Cosmodrome', 'Zona Morta Europeia', 'European Dead Zone', 'Mundo-Trono', 'Mercúrio', 'Mercury', 'Marte', 'Mars', 'Titã', 'Titan', 'Netuno', 'Neptune', 'Cidade Onírica', 'Portal', 'Enclave', 'Eternidade', 'Eternity']))].sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}-])', 'gu');
const hiLoc = h => h.replace(PLACE_RE, '<span class="plc">$1</span>');
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
  if (doneMsg !== 'keep' && GD && Date.now() - (GD.at || 0) > 300000) { GD = null; VAULT = null; } if (have.g) loadBuild(my); loadXur(my); if (have.a && tab === 'vend' && !VEND) loadVendors(my); if (have.a) loadMilestones(my); if (isGd() && have.a) loadGuardian(my);
  if (tab === 'ld' && have.c) loadLoadouts(my); // na aba Loadouts, os nomes não esperam as missões
  if (!weekT) weekT = setTimeout(() => { weekReady.x = weekReady.m = true; if (my === gen) { build(); render(); } }, 6000);
  status(u().loadingDefs);
  const quests = [];
  for (const inv of Object.values(p.characterInventories?.data || {})) for (const it of inv.items || []) if (it.bucketHash === QUEST_BUCKET) quests.push(it.itemHash);
  const [qEn, qPt] = await Promise.all([entities('DestinyInventoryItemDefinition', quests, 'en'), lang === 'pt' ? entities('DestinyInventoryItemDefinition', quests, 'pt') : null]); if (my !== gen) return;
  const qLang = qPt || qEn;
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
  for (const l of p.characterLoadouts?.data?.[charId]?.loadouts || []) { if (l.nameHash !== 2166136261) ldNames.push(l.nameHash); for (const i of l.items || []) if (inst[i.itemInstanceId]) ldItems.push(inst[i.itemInstanceId]); }
  const [ln, it] = await Promise.all([entities('DestinyLoadoutNameDefinition', ldNames, lang), entities('DestinyInventoryItemDefinition', ldItems, lang)]); if (my !== gen) return;
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
/* Tela inicial sem login: cabeçalho com a imagem de uma incursão ou masmorra (troca a cada visita) */
let LAND = null;
function landing(on) {
  const gh = $('gh'), cap = $('ghcap'); gh.classList.toggle('landing', !!on);
  if (!on) { cap.hidden = true; return; }
  if (!LAND) { const pool = [...(defs?.raids || []), ...(defs?.dungeons || [])].filter(x => x.img); LAND = pool[Math.floor(Math.random() * pool.length)] || null; }
  if (!LAND) return;
  $('ghband').style.backgroundImage = `url("${BNET}${LAND.img}")`;
  cap.textContent = L(LAND.n); cap.hidden = false;
}
function renderGuardian(ch) {
  const gh = $('gh');
  if (ch) landing(false);
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
// item à venda (Xûr): pelo colecionável, que não depende do idioma; o nome (inglês ou português) fica de reserva
const exoOf = x => (x.c && defs.exotics.find(e => e.h.includes(x.c))) || defs.exotics.find(e => e.n.includes(x.n));
// arma de um catalisador cujo nome não bate exato (ex.: "Jade Rabbit" → "The Jade Rabbit", "Skyburner" → "Skyburner's Oath")
const catWeapon = k => { if (!k) return null; const n = s => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, ''); const kk = n(k); return defs.exotics.find(e => e.t === 'w' && n(e.n[0]) === kk) || defs.exotics.find(e => e.t === 'w' && n(e.n[0]).startsWith(kk)) || defs.exotics.find(e => e.t === 'w' && n(e.n[0]).includes(kk)) || null; };
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
  // Campanhas: cada expansão com Normal, Lendário e Mestre (pelos triunfos), e o passo atual quando ainda está no registro
  const camps = qItems.filter(x => x.isCamp), used = new Set();
  for (const c of defs.camps || []) {
    const re = new RegExp(c.re, 'i'), q = camps.find(x => re.test(x.q.ql)); if (q) used.add(q);
    const st = h => h ? recState(h) : null, ok = h => recDone(st(h));
    const legDone = recOK && ok(c.rL), normDone = recOK && (ok(c.rN) || legDone);
    const items = [];
    if (q) { const idx = Math.max(0, q.q.il.indexOf(q.it.itemHash)) + 1, tot = q.q.il.length || 1; items.push(I('cp-' + q.it.itemHash, s.campStep(q.qd.n || q.q.n), q.qd.d, [`${idx}/${tot}`], false)); }
    else items.push(I('cpn-' + c.k, s.campNormal, null, [normDone ? '' : s.campNotStarted].filter(Boolean), normDone));
    // progresso do Lendário: missões feitas somando os objetivos (do triunfo principal ou das partes)
    const cnt = hs => { let a = 0, b = 0; for (const h of hs) for (const o of recObjs(st(h))) { b++; if (o.complete) a++; } return b > 1 ? `${a}/${b}` : ''; };
    const lp = legDone ? '' : (cnt([c.rL]) || cnt(c.parts || []));
    items.push(I('cpl-' + c.k, s.campLeg, L(c.where), [lp || U.chip['Difícil']], legDone));
    if (c.rM) items.push(I('cpm-' + c.k, s.campMaster, L(c.where), [U.chip['Muito difícil']], recOK && ok(c.rM)));
    const mDone = !c.rM || (recOK && ok(c.rM));
    out.push(S('camp', 'cpx-' + c.k, L(c.n), q ? s.campIn : normDone ? (legDone ? (mDone ? s.campAll : s.campMasterLeft) : s.campLegLeft) : s.campNone, items, { camp: c }));
  }
  for (const x of camps.filter(x => !used.has(x))) {
    const idx = Math.max(0, x.q.il.indexOf(x.it.itemHash)) + 1, tot = x.q.il.length || 1;
    out.push(S('camp', 'cp-' + x.it.itemHash, x.qd.ql || x.q.ql, s.campNote(idx, tot), [I('cp-' + x.it.itemHash, x.qd.n || x.q.n, x.qd.d, [`${idx}/${tot}`], false)]));
  }
  // Atividades: missões exóticas, uma seção por missão (como as masmorras); triunfos num item que abre a lista
  for (const m of defs.xmissions || []) {
    const o = ACTH?.x?.[m.k], items = [I(`xm-${m.k}-clear`, s.xmClear(L(m.n)), m.note ? L(m.note) : null, [], !!o?.c)];
    (m.w || []).forEach((n, i) => {
      const e = exoticByName(n); if (!e) return; const has = colAcquired(e.h);
      items.push(I(`xm-${m.k}-w${i}`, L(e.n), L(e.s), [U.chip['Exótico']], has, { isEx: true }));
      const c = defs.cats.find(x => x.n[0] === n + ' Catalyst'), cs = c && recState(c.h);
      if (has && c && recOK) items.push(I(`xm-${m.k}-c${i}`, L(c.n), L(c.d), [progText(cs) || (cs ? Math.round(pct(cs) * 100) + '%' : '')].filter(Boolean), recDone(cs), { isCat: true }));
    });
    if (m.steps) items.push(I(`xm-${m.k}-how`, s.xmHow, m.steps.map(x => L(x[0])).join(' '), [s.xmSteps(m.steps.length)], false, { tl: m.steps.map(([n, dd]) => ({ ok: false, n: L(n), d: L(dd) })) }));
    if (m.next) items.push(I(`xm-${m.k}-next`, s.xmNext, m.next.map(x => L(x[0])).join(' '), [s.xmSteps(m.next.length)], false, { tl: m.next.map(([n, dd]) => ({ ok: false, n: L(n), d: L(dd) })) }));
    const recs = recOK ? (m.r || []).map(h => [h, recState(h)]).filter(([, st]) => st) : [];
    if (recs.length) {
      const rd = recs.filter(([, st]) => recDone(st)).length;
      // pendentes primeiro, com a descrição; os feitos embaixo, em verde
      const tl = recs.map(([h, st]) => ({ ok: recDone(st), n: XMREC?.[h]?.n || '…', d: XMREC?.[h]?.d || '' })).sort((a, b) => a.ok - b.ok);
      items.push(I(`xm-${m.k}-tri`, s.xmTri, tl.map(x => x.n).join(' '), [`${rd}/${recs.length}`], rd === recs.length, { tl }));
    }
    out.push(S('xm', 'xm-' + m.k, L(m.n), '', items, { firstIsClear: true, xm: m }));
  }
  // Atividades: incursões e masmorras
  for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) {
    for (const a of list) {
      const items = [I(`${kind}-${a.k}-clear`, s.clear(L(a.n)), null, [U.chip[a.d]], a.m && metric(a.m) > 0)];
      const ex = a.x && exoticByName(a.x);
      if (ex) items.push(I(`${kind}-${a.k}-x`, s.exotic(L(ex.n)), L(ex.s), [U.chip['Exótico']], colAcquired(ex.h), { isEx: true, exName: L(ex.n) }));
      // triunfos da atividade (lista pronta no defs.json), num item que abre a lista
      if (recOK && a.tr?.length) {
        const tl = a.tr.map(([h, n, d]) => ({ st: recState(h), n: L(n), d: L(d) })).filter(x => x.st && !(x.st.state & 16) && x.n).map(x => { const ok = recDone(x.st); return { ok, n: x.n, d: x.d, pr: ok ? '' : progText(x.st) }; });
        if (tl.length) { const rd = tl.filter(x => x.ok).length; tl.sort((p, q) => p.ok - q.ok); items.push(I(`${kind}-${a.k}-tri`, kind === 'raid' ? s.raidTri : s.dgTri, tl.map(x => x.n).join(' '), [`${rd}/${tl.length}`], rd === tl.length, { tl })); }
      }
      out.push(S(kind, `${kind}-${a.k}`, L(a.n), L([a.note[1], a.note[0]]), items, { firstIsClear: true, kind, key: a.k, metric: a.m }));
    }
  }
  // Títulos
  if (!recOK) out.push(S('tit', 'tit-wait', '', s.loadingRecords, [], { empty: true }), S('cat', 'cat-wait', '', s.loadingRecords, [], { empty: true }));
  const ordered = sealStats.slice().sort((a, b) => (a.se.tier - b.se.tier) || (b.done / b.total - a.done / a.total));
  for (const x of ordered) {
    const items = x.recs.map(r => { const st = recState(r[0]); return I('t-' + r[0], L(r[1]), L(r[2]), [progText(st) || U.chip[['Fácil', 'Médio', 'Difícil', 'Muito difícil', 'Evento'][x.se.tier - 1]]].filter(Boolean), recDone(st)); });
    out.push(S('tit', 'seal-' + x.se.cr, L(x.se.t), s.tierNote[x.se.tier - 1] + '. ' + L(x.se.ds), items, { coll: true, titleSeal: true, tier: x.se.tier }));
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
  const catSrc = c => { const k = c.n[0].replace(/ Catalyst$/, ''); if (defs.catsrc[k]) return defs.catsrc[k][lang === 'pt' ? 0 : 1]; const e = catWeapon(k); return e ? u().w.weaponFrom + ' ' + L(e.s).replace(/^(Fonte|Source):\s*/, '') : ''; };
  const prog = catRows.filter(x => !recDone(x.r) && pct(x.r) > 0).sort((a, b) => pct(b.r) - pct(a.r));
  const fresh = catRows.filter(x => !recDone(x.r) && pct(x.r) === 0);
  if (prog.length) out.push(S('cat', 'cat-prog', s.catProg, s.catProgNote, prog.map(x => I('c-' + x.c.h, L(x.c.n), L(x.c.d), [progText(x.r) || Math.round(pct(x.r) * 100) + '%'], false))));
  if (fresh.length) out.push(S('cat', 'cat-new', s.catNew, s.catNewNote, fresh.map(x => I('c-' + x.c.h, L(x.c.n), [catSrc(x.c), L(x.c.d)].filter(Boolean).join(' '), [], false))));
  if (FX) {
    for (const x of out) if (x.tab === 'obj' && /^(contracts|quests|nearcats|neartitles)/.test(x.id)) x.tab = 'prog';
    out.push(S('obj', 'goals', '', null, [], { html: true }));
    out.push(S('obj', 'grank', '', null, [], { html: true }));
    out.push(S('obj', 'focus', '', null, [], { html: true }));
    out.push(S('obj', 'wishobj', '', null, [], { html: true }));
    out.push(S('obj', 'post', '', null, [], { html: true }));
  }
  SECTIONS = out; SECTIONS_PREV = out;
  // Loadouts
  const inst = instanceMap();
  LOADOUTS = (p.characterLoadouts?.data?.[charId]?.loadouts || []).map((l, i) => ({ i, name: loadoutNames[l.nameHash]?.n || `Loadout ${i + 1}`, items: (l.items || []).map(x => itemNames[inst[x.itemInstanceId]]?.n).filter(Boolean) })).filter(l => l.items.length);
}

/* ---------- novidades: faixa da semana, build, conclusões e aba Guardião ---------- */
const XUR_VENDOR = 2190858386, XUR_GEAR = 3751514131, STRANGE_COIN = 800069450; // XUR_GEAR: "Ofertas de equipamento estranhas" (armas exóticas, catalisadores e lendárias)
const RANK_PROGS = [457612306, 3011295063, 1807348350, 689153319, 584850370];
const COUNT_METRICS = [740213466, 2959623395, 26751835, 3264536674];
const OPTS = Object.assign({ week: true, clears: true, build: true }, LS.get('dc-opts', {}));
const ARTIFACT_BUCKET = 1506418338;
const AMMO = {};
/* Dados de item que não mudam (munição, conjunto de armadura, coleção): uma busca por item, guardada neste navegador.
   Antes cada build buscava de novo, e várias builds ao mesmo tempo repetiam a mesma busca. */
const IDEF = LS.get('dc-idef1', {}), IDEF_P = new Map(); let idefT = null;
function idef(h) {
  if (IDEF[h]) return Promise.resolve(IDEF[h]);
  if (!IDEF_P.has(h)) IDEF_P.set(h, bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false).then(d => { IDEF[h] = { a: d.equippingBlock?.ammoType || 0, s: d.equippingBlock?.equipableItemSetHash || 0, c: d.collectibleHash || 0 }; clearTimeout(idefT); idefT = setTimeout(() => { try { LS.set('dc-idef1', IDEF); } catch {} }, 500); return IDEF[h]; }).catch(() => ({ a: 0, s: 0, c: 0 })));
  return IDEF_P.get(h);
}
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
  // fora da Torre (terça a sexta) não há o que buscar; e não repete a busca a cada etapa do carregamento
  if (Date.now() >= xurLeaves()) { XUR = { until: new Date(xurLeaves()).toISOString(), items: [] }; weekReady.x = true; return; }
  if (XUR && XUR.k === charId + lang && Date.now() - XUR.at < 600000) { weekReady.x = true; return; }
  try {
    // a tela principal do Xûr só tem a armadura; armas, catalisadores e lendárias ficam na sub-loja de equipamento
    const [r, g] = await Promise.all([bungie(`/Destiny2/${member.type}/Profile/${member.id}/Character/${charId}/Vendors/${XUR_VENDOR}/?components=400,402`), bungie(`/Destiny2/${member.type}/Profile/${member.id}/Character/${charId}/Vendors/${XUR_GEAR}/?components=402`).catch(() => null)]);
    const seen = new Set(), sales = [...Object.values(r.sales?.data || {}), ...Object.values(g?.sales?.data || {})].filter(s => !seen.has(s.itemHash) && seen.add(s.itemHash));
    const hs = sales.map(s => s.itemHash);
    const loc = await entities('DestinyInventoryItemDefinition', hs, lang === 'pt' ? 'pt' : 'en', true); if (my !== gen) return;
    const kind = s => loc[s.itemHash]?.it, cost = s => (s.costs || []).find(c => c.itemHash === STRANGE_COIN)?.quantity || 0;
    const row = s => ({ h: s.itemHash, c: IDEF[s.itemHash]?.c || 0, ic: loc[s.itemHash]?.ic, tl: loc[s.itemHash]?.tl || '', n: loc[s.itemHash]?.n || '', cost: cost(s) });
    const exo = sales.filter(s => loc[s.itemHash]?.tt === 6 && (kind(s) === 2 || kind(s) === 3)); await Promise.all(exo.map(s => idef(s.itemHash))); if (my !== gen) return;
    // o Xûr vai embora no reset de terça; a data de "renovação" da API (sexta) não é a saída dele
    XUR = { k: charId + lang, at: Date.now(), until: new Date(xurLeaves()).toISOString(), items: exo.map(row), cats: sales.filter(s => kind(s) === 19).map(row), leg: sales.filter(s => loc[s.itemHash]?.tt === 5 && kind(s) === 3).map(row) };
  } catch { XUR = null; }
  if (my === gen) { weekReady.x = true; build(); render(); }
}
const coins = () => { let n = 0; for (const it of profile.profileInventory?.data?.items || []) if (it.itemHash === STRANGE_COIN) n += it.quantity || 0; for (const it of profile.profileCurrencies?.data?.items || []) if (it.itemHash === STRANGE_COIN) n += it.quantity || 0; return n; };
// o que o Xûr vende e você não tem: nunca pegou (coleção) ou não está em nenhum personagem nem no cofre
const heldSet = () => { const s = new Set(); for (const it of profile.profileInventory?.data?.items || []) s.add(it.itemHash); for (const d of [profile.characterInventories?.data, profile.characterEquipment?.data]) for (const c of Object.values(d || {})) for (const it of c.items || []) s.add(it.itemHash); return s; };
const xurCatMissing = x => { const c = defs.cats.find(k => k.n.includes(x.n)), r = c && recState(c.h); return r ? !!(r.state & 16) : false; };
function xurMissing() {
  if (!XUR || !have.a) return [];
  const cls = profile.characters.data[charId].classType, held = have.c ? heldSet() : null;
  return XUR.items.filter(x => { const e = exoOf(x); if (!e || !(e.t === 'w' || e.c === cls)) return false; x.why = colMissing(e.h) ? 'col' : held && !held.has(x.h) ? 'held' : ''; return !!x.why; });
}
const xurCatsMissing = () => (XUR?.cats || []).filter(xurCatMissing);
/* Rotação: incursões e masmorras com desafios ativos nos marcos do personagem */
async function loadMilestones(my) {
  const ms = profile.characterProgressions?.data?.[charId]?.milestones; if (!ms) { weekReady.m = true; build(); render(); return; }
  const hs = Object.keys(ms).map(Number), acts = Object.values(ms).flatMap(m => (m.activities || []).filter(a => (a.challenges || []).length).map(a => a.activityHash));
  const [d, an] = await Promise.all([entities('DestinyMilestoneDefinition', hs, lang), entities('DestinyActivityDefinition', acts, lang)]); if (my !== gen) return;
  const dl = d; ACTN = an;
  MSN = d; MSL = dl; weekReady.m = true; build(); render();
}
function featured() {
  const ms = profile.characterProgressions?.data?.[charId]?.milestones || {}, out = { raid: new Set(), dg: new Set(), ends: null };
  for (const m of Object.values(ms)) {
    const name = (MSN[m.milestoneHash]?.n || '').toLowerCase(), ah = (m.activities || []).filter(a => (a.challenges || []).length).map(a => a.activityHash);
    if (!ah.length) continue;
    // pela atividade (não depende do idioma); o nome fica de reserva
    for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) { const a = list.find(x => (x.ah || []).some(h => ah.includes(h))) || (name && list.find(x => x.n.some(n => n.toLowerCase() === name))); if (a) { out[kind].add(a.k); if (m.endDate) out.ends = Math.min(out.ends || Infinity, Date.parse(m.endDate)); } }
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
      items.push(I(`wk-${m.milestoneHash}-${a.activityHash}-${o.objectiveHash || 0}`, W.wkChallenge(an), W.wkChallengeD, [`${Math.min(o.progress || 0, cv)}/${cv}`, U_CHIP_WEEK()], !!o.complete, { wk: { ms: m.milestoneHash, obj: o.objectiveHash, k: 'ch', act: an, h: a.activityHash, a: Math.min(o.progress || 0, cv), b: cv } }));
    }
    const rw = (m.rewards || []).flatMap(r => r.entries || []);
    if (rw.length) { const red = rw.filter(e => e.redeemed).length, earn = rw.filter(e => e.earned).length; items.push(I(`wk-${m.milestoneHash}-rw`, W.wkRewardT(name), earn > red ? W.wkClaim(earn - red) : W.wkRewardsD, [`${red}/${rw.length}`, U_CHIP_WEEK()], red === rw.length, { wk: { ms: m.milestoneHash, rw: rw.map(e => [e.rewardEntryHash, e.earned ? 1 : 0, e.redeemed ? 1 : 0]), k: 'rw', act: name, h: (m.activities || [])[0]?.activityHash, a: red, b: rw.length, claim: earn > red } })); }
    for (const q of m.availableQuests || []) if (q.status) items.push(I(`wk-${m.milestoneHash}-q`, name, W.wkQuestD, [q.status.completed ? '✓' : q.status.started ? W.wkStarted : W.wkNew], !!q.status.completed, { wk: { ms: m.milestoneHash, k: 'q', act: name, h: (m.activities || [])[0]?.activityHash } }));
  }
  const miss = xurMissing();
  // o Xûr fica em Arsenal → Vendedores
  const f = featured(), feat = [...[...f.raid].map(k => 'raid-' + k), ...[...f.dg].map(k => 'dg-' + k)].map(id => SECTIONS_PREV.find(s => s.id === id)).filter(Boolean);
  const featTxt = feat.length ? ' ' + W.featured + feat.map(s => s.title).join(' · ') + '.' : '';
  const waiting = !(have.a && weekReady.m && weekReady.x);
  return S('obj', 'week', W.week, (waiting ? u().loadingDefs + ' ' : '') + W.resetNote(cd(nextReset() - t)) + featTxt, items.sort((a, b) => a.auto - b.auto), { weekly: true, coll: true, feat, nr: (waiting ? u().loadingDefs + ' ' : '') + W.resetNote(cd(nextReset() - t)) });
}
const U_CHIP_WEEK = () => u().w.weeklyChip;
let SECTIONS_PREV = [];
let WK = [];
function weekItems() {
  const W = u().w, it = [], t = Date.now();
  const miss = [...xurMissing(), ...(have.b ? xurCatsMissing() : [])];
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
// ordem escolhida em Títulos, Incursões, Masmorras e Missões exóticas (guardada por aba)
const SORT_TABS = ['tit', 'raid', 'dg', 'xm'], TSORT = { v: Object.assign({ tit: LS.get('dc-titsort', 'tier') }, LS.get('dc-sorts', {})) };
const TIER_N = { 'Fácil': 1, 'Médio': 2, 'Difícil': 3, 'Muito difícil': 4 };
const secTier = sec => sec.tier || (sec.kind && TIER_N[(sec.kind === 'raid' ? defs.raids : defs.dungeons).find(x => x.k === sec.key)?.d]) || 0;
const secPct = sec => sec.items.length ? sec.items.filter(isDone).length / sec.items.length : 0;
// opções de cada página (missões exóticas ainda sem dificuldade nos dados)
const TS_OPTS = { tit: ['tier', 'near', 'name'], raid: ['tier', 'wpn', 'near', 'low', 'name'], dg: ['tier', 'wpn', 'near', 'low', 'name'], xm: ['wpn', 'cat', 'near', 'low', 'name'] };
const sortOf = t => { const v = TSORT.v[t], o = TS_OPTS[t] || []; return o.includes(v) ? v : o[0]; };
function titMeta(sec) {
  const t = secTier(sec), lbl = u().chip[['Fácil', 'Médio', 'Difícil', 'Muito difícil', 'Evento'][t - 1]], cls = ['easy', 'mid', 'hard', 'hard', 'feat'][t - 1];
  const p = Math.round(secPct(sec) * 100);
  return `${t ? `<span class="chip ${cls}">${esc(lbl || '')}</span>` : ''}<span class="chip">${p}%</span>`;
}
// guia em vídeo (YouTube) da incursão/masmorra, quando houver
const actDefOf = (kind, key) => (kind === 'raid' ? defs.raids : kind === 'dg' ? defs.dungeons : kind === 'xm' ? (defs.xmissions || []) : []).find(x => x.k === key);
// vídeos: um link ou uma lista [url, nome pt, nome en]; com mais de um, abre uma lista para escolher
const YT_OK = x => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(x || '');
const ytList = a => (Array.isArray(a?.yt) ? a.yt : a?.yt ? [[a.yt]] : []).filter(x => YT_OK(x[0]));
const ytId = url => { try { const x = new URL(url); return x.hostname === 'youtu.be' ? x.pathname.slice(1) : x.searchParams.get('v') || ''; } catch { return ''; } };
const actYt = (kind, key) => { const a = actDefOf(kind, key); if (!a) return ''; const yl = ytList(a);
  const v = yl.length === 1 ? `<a class="chip yt" href="${esc(yl[0][0])}" target="_blank" rel="noopener">▶ ${esc(u().ytGuide)}</a>` : yl.length > 1 ? `<button type="button" class="chip yt" data-ytl="${kind}:${esc(key)}">▶ ${esc(u().ytMany(yl.length))}</button>` : ''; return v + (a.gi?.length ? `<button type="button" class="chip gi" data-gal="${kind}:${esc(key)}">🖼 ${esc(u().giBtn(a.gi.length))}</button>` : ''); };
/* galeria de imagens do guia: só baixa as imagens quando abre */
const GAL = { l: [], i: 0, t: '', seq: 0 };
function galOpen(kind, key, i = 0) {
  const a = actDefOf(kind, key); if (!a?.gi?.length) return;
  GAL.l = a.gi; GAL.i = i; GAL.t = L(a.n);
  let d = $('galdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'galdlg'; d.className = 'gal'; document.body.append(d); galWire(d); }
  galDraw(); if (!d.open) d.showModal();
}
// a estrutura é montada uma vez; ao trocar, a próxima imagem é decodificada antes de aparecer (sem piscar nem travar)
const GALC = new Map();
const galPre = src => {
  if (!GALC.has(src)) { const im = new Image(); im.decoding = 'async';
    const loaded = new Promise(r => { im.onload = im.onerror = r; }); im.src = src;
    // espera carregar e tenta decodificar antes de mostrar, mas nunca fica preso (aba em segundo plano, navegador antigo)
    GALC.set(src, loaded.then(() => Promise.race([im.decode ? im.decode().catch(() => {}) : null, new Promise(r => setTimeout(r, 400))]))); }
  return Promise.race([GALC.get(src), new Promise(r => setTimeout(r, 4000))]);
};
function galDraw() {
  const d = $('galdlg'), n = GAL.l.length, W = u(); if (!d || !n) return;
  d.innerHTML = `<div class="gal-top"><b>${esc(GAL.t)}</b><span class="gal-c"></span><a class="gal-full" target="_blank" rel="noopener">${esc(W.giFull)}</a><button type="button" class="gal-x" aria-label="${esc(W.giClose)}">✕</button></div>
    <div class="gal-st">${n > 1 ? `<button type="button" class="gal-nav gal-p" aria-label="‹">‹</button>` : ''}<img decoding="async" alt="">${n > 1 ? `<button type="button" class="gal-nav gal-n" aria-label="›">›</button>` : ''}</div>
    <p class="gal-cap"></p>${n > 1 ? `<div class="gal-dots">${GAL.l.map((_, i) => `<button type="button" data-gi="${i}" aria-label="${i + 1}"></button>`).join('')}</div>` : ''}`;
  GAL.l.forEach(g => galPre(g[0])); galShow();
}
async function galShow() {
  const d = $('galdlg'), g = GAL.l[GAL.i], n = GAL.l.length, my = ++GAL.seq; if (!d || !g) return;
  const cap = lang === 'en' ? g[2] : g[1];
  d.querySelector('.gal-c').textContent = `${GAL.i + 1}/${n}`; d.querySelector('.gal-cap').textContent = cap; d.querySelector('.gal-full').href = g[0];
  d.querySelectorAll('[data-gi]').forEach((b, i) => b.toggleAttribute('aria-current', i === GAL.i));
  const img = d.querySelector('.gal-st img'); img.classList.add('ld');
  await galPre(g[0]); if (my !== GAL.seq) return;
  img.width = g[3] || 0; img.height = g[4] || 0; img.src = g[0]; img.alt = cap; img.classList.remove('ld');
}
function galGo(k) { const n = GAL.l.length; GAL.i = (GAL.i + k + n) % n; galShow(); }
function galWire(d) {
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('.gal-x')) { d.close(); return; }
    if (e.target.closest('.gal-p')) return galGo(-1); if (e.target.closest('.gal-n')) return galGo(1);
    const b = e.target.closest('[data-gi]'); if (b) { GAL.i = +b.dataset.gi; galShow(); }
  });
  d.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') galGo(-1); if (e.key === 'ArrowRight') galGo(1); });
  let x0 = null; d.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  d.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) galGo(dx < 0 ? 1 : -1); });
}
function ytOpen(kind, key) {
  const a = actDefOf(kind, key), yl = ytList(a); if (!yl.length) return; const W = u();
  let d = $('ytdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'ytdlg'; d.className = 'gal ytl'; document.body.append(d); d.addEventListener('click', e => { if (e.target === d || e.target.closest('.gal-x')) d.close(); }); }
  d.innerHTML = `<div class="gal-top"><b>${esc(L(a.n))}</b><span>${esc(W.ytMany(yl.length))}</span><button type="button" class="gal-x" aria-label="${esc(W.giClose)}">✕</button></div><div class="ytl-l">${yl.map((x, i) => { const id = ytId(x[0]), n = (lang === 'en' ? x[2] : x[1]) || `${W.ytGuide} ${i + 1}`; return `<a class="ytl-i" href="${esc(x[0])}" target="_blank" rel="noopener">${id ? `<img src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180">` : ''}<span><b>${esc(n)}</b><small>YouTube ↗</small></span></a>`; }).join('')}</div>`;
  if (!d.open) d.showModal();
}
document.addEventListener('click', e => { const y = e.target.closest('[data-ytl]'); if (y) { e.stopPropagation(); const [k, key] = y.dataset.ytl.split(':'); ytOpen(k, key); } }, true);
document.addEventListener('click', e => { const b = e.target.closest('[data-gal]'); if (!b) return; e.stopPropagation(); const [k, key] = b.dataset.gal.split(':'); galOpen(k, key); }, true);
function secMeta(sec) {
  const W = u().w, c = [titMeta(sec)], f = featured(), n = metric(sec.metric);
  if (f[sec.kind].has(sec.key) && (!f.ends || f.ends > Date.now())) c.push(`<span class="chip feat">${esc(W.featWeek)}</span>`);
  if (n && have.a) c.push(`<span class="chip clr">${esc(W.clears(n))}</span>`);
  const yt = actYt(sec.kind, sec.key); if (yt) c.push(yt);
  if (typeof wOk === 'function' && wOk()) c.push(`<button type="button" class="chip prep" data-prep="${sec.id}">⚙ ${esc(lw().prep)}</button>`);
  return c.length ? `<div class="sec-meta">${c.join('')}</div>` : '';
}

/* Build equipada: abre ao tocar nos ícones do cabeçalho */
/* Nomes, ícones e munição de tudo que o personagem tem equipado (serve para você e para quem você buscar) */
/* Build de qualquer contexto. Os nomes chegam aos poucos: primeiro os itens (onProg desenha uma prévia),
   depois os encaixes em paralelo; o nome em português só é buscado para o que aparece na tela. */
async function fetchBuild(p, cid, onProg) {
  const eq = p.characterEquipment?.data?.[cid]?.items || [], sk = p.itemComponents?.sockets?.data;
  if (!sk || !eq.length) return null;
  const T = 'DestinyInventoryItemDefinition', L = lang === 'pt' ? 'pt' : 'en';
  const items = [...new Set(eq.map(i => i.itemHash))], iset = new Set(items);
  const plugs = []; for (const i of eq) for (const s of sk[i.itemInstanceId]?.sockets || []) if (s.plugHash && s.isVisible !== false && !iset.has(s.plugHash)) plugs.push(s.plugHash);
  // um idioma só (o do site): a classificação dos encaixes não depende do nome em inglês
  const en = {}, B = { en, loc: en, sets: [], art: null, partial: true };
  let tick = null; const bump = () => { if (onProg && !tick) tick = setTimeout(() => { tick = null; if (B.partial) onProg(B); }, 250); };
  Object.assign(en, await entities(T, items, L, true)); bump();
  const wh = eq.filter(i => WEAPON_B.includes(i.bucketHash)).map(i => i.itemHash).filter(h => AMMO[h] == null);
  const side = Promise.all([armorSets(eq).then(v => { B.sets = v; }), ...wh.map(h => idef(h).then(d => { AMMO[h] = d.a; }))]);
  if (onProg) onProg(B);
  Object.assign(en, await entities(T, plugs, L, true, part => { Object.assign(en, part); bump(); }));
  await side; saveEnt();
  // artefato: desde Monumento do Triunfo é um item equipado (7 artefatos para escolher); as vantagens escolhidas são os encaixes dele
  const ai = eq.find(i => i.bucketHash === ARTIFACT_BUCKET);
  const artPerks = ai ? (sk[ai.itemInstanceId]?.sockets || []).map(x => x.plugHash).filter(h => h && pShow(en[h])) : [];
  B.art = ai && artPerks.length ? { h: ai.itemHash, perks: artPerks } : null; B.partial = false;
  return B;
}
async function loadBuild(my) {
  const b = await fetchBuild(profile, charId, x => { if (my === gen && buildOpen) { BUILD = x; renderBuild(); } }); if (my !== gen || !b) return;
  BUILD = b; if (buildOpen) renderBuild(); if (FD.cmp) renderFind();
}
/* Bônus de conjunto da armadura: conta as peças equipadas de cada conjunto e marca os bônus ativos */
const SETOF = {}, SETDEF = LS.get('dc-sets1', {}), SETDEF_P = new Map();
// pelo servidor, que já devolve o conjunto com os bônus resolvidos (um pedido em vez de 3 a 5)
async function setSrv(h, lc) {
  if (!APIW || Date.now() < srvDown) return null;
  try { const r = await fetch(APIW + '/defs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey }, body: JSON.stringify({ t: 'DestinyEquipableItemSetDefinition', lc: lc === 'en' ? 'en' : 'pt', h: [h] }) }); if (!r.ok) return null; const v = (await r.json()).d?.[h]; return v && v.n ? v : null; } catch { return null; }
}
function setDef(h, lc) {
  const key = h + ':' + lc;
  if (!SETDEF_P.has(key)) SETDEF_P.set(key, (async () => { try { const sv = await setSrv(h, lc); if (sv) { SETDEF[key] = sv; try { LS.set('dc-sets1', SETDEF); } catch {} return sv; } const d = await bungie(`/Destiny2/Manifest/DestinyEquipableItemSetDefinition/${h}/?lc=${lc}`, false); const perks = await Promise.all((d.setPerks || []).map(p => bungie(`/Destiny2/Manifest/DestinySandboxPerkDefinition/${p.sandboxPerkHash}/?lc=${lc}`, false).then(sp => ({ c: p.requiredSetCount, n: sp.displayProperties?.name || '', d: sp.displayProperties?.description || '', ic: sp.displayProperties?.icon || '' })).catch(() => null))); const v = { n: d.displayProperties?.name || '', perks: perks.filter(Boolean).sort((a, b) => a.c - b.c) }; SETDEF[key] = v; try { LS.set('dc-sets1', SETDEF); } catch {} return v; } catch { SETDEF_P.delete(key); return null; } })());
  return SETDEF_P.get(key);
}
async function armorSets(eq) {
  const lc = lang === 'pt' ? 'pt-br' : 'en', arm = eq.filter(i => [3448274439, 3551918588, 14239492, 20886954, 1585787867].includes(i.bucketHash));
  await Promise.all(arm.filter(i => SETOF[i.itemHash] === undefined).map(i => idef(i.itemHash).then(d => { SETOF[i.itemHash] = d.s; })));
  const count = {}; for (const i of arm) { const h = SETOF[i.itemHash]; if (h) count[h] = (count[h] || 0) + 1; }
  const out = (await Promise.all(Object.entries(count).map(async ([h, n]) => {
    const key = h + ':' + lc, v = SETDEF[key] || await setDef(h, lc);
    return v && v.perks.some(p => n >= p.c) ? { n: v.n, count: n, perks: v.perks.map(p => ({ ...p, on: n >= p.c })) } : null; // conjunto sem bônus ativo não aparece
  }))).filter(Boolean);
  return out.sort((a, b) => b.count - a.count);
}
const ownCtx = () => ({ p: profile, cid: charId, B: BUILD, name: member?.name || '' });
const SKIP_NAME = /^(Empty|Default|Upgrade Armor|Locked|No |Restore Defaults|Kill Tracker|Tracker Disabled|Change Energy|Deepsight)/i;
const SKIP_TYPE = /Shader|Ornament|Memento|Tracker|Flair|Emote|Transmat|Projection/i;
/* Classificação dos encaixes sem depender do idioma: categoria do encaixe (plugCategoryIdentifier), subtipo e traços.
   Os nomes de encaixes vazios/padrão ficam nas duas línguas porque alguns só se distinguem pelo nome. */
const PSKIP = /skins|shader|emote|hologram|spawnfx|trackers|kill_vfx|mod_empty|empty_socket|transfusers|tiering\.plugs\.mods\.enhancers|^v460\.plugs\.armor\.masterworks|ornament/;
const SKIP_PT = /^(Soquete de mod vazio|Aprimorar (Armadura|Fantasma)$|Efeito Padrão|Sem Projeção|Tonalizador padrão|Ornamento padrão|Rastreador)|\bvazi[oa]$/i;
const pShow = e => !!e?.n && !(e.pc && PSKIP.test(e.pc)) && e.st !== 20 && e.st !== 21 && !SKIP_NAME.test(e.n) && !SKIP_PT.test(e.n) && (e.pc !== undefined || !SKIP_TYPE.test(e.tl));
const pKind = e => !e ? '' : /\.supers$/.test(e.pc) ? 'sup' : e.tr === 'a' || /\.(aspects|totems)$/.test(e.pc) ? 'asp' : e.tr === 'f' || /(fragments|trinkets)$/.test(e.pc) ? 'fr' : '';
const pMw = e => /masterworks|intrinsics/.test(e?.pc || '');
const pIntr = e => /intrinsics/.test(e?.pc || '');
const pArmorMod = e => /^enhancements\.(?!ghosts)|armor_tiering/.test(e?.pc || '');
function buildHTML(C = ownCtx()) {
  const W = u().w, B = C.B; if (!B) return `<p class="b-note wait" role="status">${esc(u().loadingDefs)}</p>`;
  const inst = C.p.itemComponents?.instances?.data || {}, sk = C.p.itemComponents?.sockets?.data || {};
  const eq = (C.p.characterEquipment?.data?.[C.cid]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).sort((a, b) => GEAR_BUCKETS.indexOf(a.bucketHash) - GEAR_BUCKETS.indexOf(b.bucketHash));
  const chip = (h, cls) => { const d = B.loc[h] || B.en[h] || {}; return `<span class="${cls || ''}">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : ''}${esc(d.n)}</span>`; };
  const plugsOf = i => { const own = B.en[i.itemHash]?.tl || ''; return (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => { const e = B.en[h]; return pShow(e) && e.tl !== own; }); };
  const row = (i, body) => { const d = B.loc[i.itemHash] || {}, pw = i.bucketHash === SUB_BUCKET ? 0 : inst[i.itemInstanceId]?.primaryStat?.value; return `<div class="b-row${d.tt === 6 ? ' exo' : ''}"><div class="b-name">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : ''}<div class="b-nt"><div class="b-nn"><span>${esc(d.n)}</span>${AMMO[i.itemHash] ? `<span class="ammo" title="${esc(u().w.ammo[AMMO[i.itemHash]])}" aria-label="${esc(u().w.ammo[AMMO[i.itemHash]])}">${ammoSVG(AMMO[i.itemHash])}</span>` : ''}</div><small>${esc(d.tl || '')}${pw && pw > 0 ? ` · <b>${pw}</b>` : ''}</small></div>${FX && ARMOR_BUCKETS.includes(i.bucketHash) ? wishBtn({ h: i.itemHash, n: d.n, ic: d.ic, tl: d.tl, a: 1, ...armArch(B, sk[i.itemInstanceId]) }) : ''}${FX && WEAPON_BUCKETS.includes(i.bucketHash) ? wishBtn({ h: i.itemHash, n: d.n, ic: d.ic, tl: d.tl, p: plugsOf(i).filter(h => !/masterworks/.test(B.en[h]?.pc || '')).slice(0, 8).map(h => ({ n: (B.loc[h] || B.en[h] || {}).n, ic: (B.loc[h] || B.en[h] || {}).ic })).filter(x => x.n) }) : ''}</div>${body}</div>`; };
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET);
  let html = '';
  if (sub) {
    const ps = plugsOf(sub), t = h => pKind(B.en[h]);
    const sup = ps.filter(h => t(h) === 'sup'), asp = ps.filter(h => t(h) === 'asp'), fr = ps.filter(h => t(h) === 'fr'), ab = ps.filter(h => !t(h));
    html += `<div class="b-grp">${row(sub, `<div class="b-perks">${sup.map(h => chip(h, 'mw')).join('')}${ab.map(h => chip(h)).join('')}</div>${asp.length ? `<div class="b-perks"><span class="k">${esc(W.aspects)}</span>${asp.map(h => chip(h)).join('')}</div>` : ''}${fr.length ? `<div class="b-perks"><span class="k">${esc(W.frags)}</span>${fr.map(h => chip(h)).join('')}</div>` : ''}`)}</div>`;
  }
  const grp = (k, list) => list.length ? `<div class="b-grp"><div class="b-k">${esc(k)}</div>${list.map(i => row(i, `<div class="b-perks">${plugsOf(i).map(h => { const e = B.en[h]; return chip(h, pMw(e) ? 'mw' : ''); }).join('')}</div>`)).join('')}</div>` : '';
  const sets = (B.sets || []).map(st => `<div class="b-set"><div class="b-set-h"><b>${esc(st.n)}</b><small>${esc(W.setPieces(st.count))}</small></div>${st.perks.map(pk => `<div class="b-set-p${pk.on ? ' on' : ''}"><span class="b-set-c">${esc(W.setReq(pk.c))}</span><span><b>${esc(pk.n)}</b>${pk.d ? `<small>${esc(pk.d)}</small>` : ''}</span></div>`).join('')}</div>`).join('');
  html += `<div class="b-cols">${grp(W.weapons, eq.filter(i => [1498876634, 2465295065, 953998645].includes(i.bucketHash)))}<div>${grp(W.armor, eq.filter(i => [3448274439, 3551918588, 14239492, 20886954, 1585787867].includes(i.bucketHash)))}${sets ? `<div class="b-grp b-sets"><div class="b-k">${esc(W.setT)}</div>${sets}</div>` : ''}</div></div>`;
  if (B.art) html += `<div class="b-grp"><div class="b-k">${esc(W.artT)}${B.art.h && B.loc[B.art.h]?.n ? ' · ' + esc(B.loc[B.art.h].n) : ''}</div><div class="b-row"><div class="b-perks">${B.art.perks.map(h => chip(h)).join('')}</div></div></div>`;
  const cam = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  return `<div class="b-top"><div class="b-k">${sub ? esc(W.subclass) : ''}</div><button class="b-link b-save" type="button" aria-pressed="${!!savedKey(C)}" title="${esc(savedKey(C) ? W.unsaveB : W.saveB)}" aria-label="${esc(savedKey(C) ? W.unsaveB : W.saveB)}">${SAVE_ICON(!!savedKey(C))}</button>${shareMenu('own', !B.partial, true)}</div>` + statsHTML(C) + html + (B.partial ? `<p class="b-note wait" role="status">${esc(u().loadingDefs)}</p>` : '');
}
/* ---------- imagem da build para compartilhar ----------
   Desenha o conteúdo numa tela transparente, anotando os cartões; no fim compõe:
   fundo + brilho da cor da subclasse, cartões, conteúdo, e corta na altura usada. */
const STAT_ORDER = [2996146975, 392767087, 1943323491, 1735777505, 144602215, 4244567218];
/* Atributos do personagem (vêm prontos no perfil: armadura + mods + artefato + afinação) */
let STATD = null, statLoading = null;
function loadStats() {
  if (STATD && STATD.lang === lang) return; if (statLoading) return;
  statLoading = entities('DestinyStatDefinition', STAT_ORDER, lang).then(d => { STATD = { lang, d }; statLoading = null; if (buildOpen) renderBuild(); if ($('finddlg').open) renderFind(); if ($('lbdlg')?.open) lbDraw(); renderLive(); }).catch(() => { statLoading = null; });
}
const statsOf = C => { if (!C?.p || C.p.ld) return null; const st = C.p.characters?.data?.[C.cid]?.stats; return st && STAT_ORDER.some(h => st[h] != null) ? st : null; };
function statsHTML(C) {
  const st = statsOf(C); if (!st) return ''; loadStats(); const D = STATD?.d || {}, U = u();
  const cell = h => { const v = st[h] || 0, d = D[h] || {}, cls = v > 100 ? ' hi' : v < 30 ? ' lo' : ''; return `<span class="b-sc${cls}" title="${esc(d.n || '')}">${d.ic ? `<img src="${BNET}${d.ic}" alt="">` : ''}<b>${v}</b><i><u style="width:${Math.min(100, v / 2)}%"></u></i></span>`; };
  const det = STAT_ORDER.map(h => { const v = st[h] || 0, d = D[h] || {}; return `<li${v > 100 ? ' class="hi"' : ''}>${d.ic ? `<img src="${BNET}${d.ic}" alt="">` : ''}<span><b>${esc(d.n || '')} · ${v}</b>${d.d ? `<small>${esc(d.d)}</small>` : ''}</span></li>`; }).join('');
  return `<details class="b-st"><summary aria-label="${esc(U.statsT)}">${STAT_ORDER.map(cell).join('')}</summary><ul>${det}</ul><p class="b-note">${esc(U.statsHi)}</p></details>`;
}
const imgCache = new Map();
function loadImg(path) {
  if (!path) return Promise.resolve(null);
  const get = u => fetch(u, { mode: 'cors', credentials: 'omit' }).then(r => r.ok ? r.blob() : null).then(b => b ? createImageBitmap(b) : null);
  // se a cópia guardada não servir (resposta opaca), busca de novo por outro endereço, direto da Bungie
  if (!imgCache.has(path)) imgCache.set(path, get(BNET + path).catch(() => null).then(im => im || get(BNET + path + '?s=1').catch(() => null)));
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
  const plugsOf = i => { const own = B.en[i.itemHash]?.tl || ''; return (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => { const e = B.en[h]; return pShow(e) && e.tl !== own; }); };
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
    const ps = plugsOf(sub), t = h => pKind(B.en[h]);
    const sup = ps.filter(h => t(h) === 'sup'), asp = ps.filter(h => t(h) === 'asp'), fr = ps.filter(h => t(h) === 'fr'), ab = ps.filter(h => !t(h));
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
      const end = await chips(plugsOf(i), IN + 112, top + 122, CW - 56 - 112, h => pMw(B.en[h]));
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
      const end = await chips(ps, IN + 92, top + 70, CW - 56 - 92, h => pIntr(B.en[h]), true);
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
  text('DPI · ' + location.host, PAD, y, F.m(22), '#c3ccda');
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
  dlg.innerHTML = `<div class="sh-box"><p class="sh-wait wait" role="status">${esc(W.shareMaking)}</p></div>`; dlg.showModal();
  // deixa a janela com o indicador aparecer antes de começar a desenhar
  await new Promise(r => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 80); }); // rAF não roda com a aba em segundo plano
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
  const out = { partial: true, pass: null, names: {}, metricNames: {}, commNames: {} };
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
      // relatórios de partida nunca mudam: guarda só quem estava em cada uma, para não buscar de novo
      const PC = LS.get('dc-pgcr1', {});
      const slim = r => ({ entries: (r.entries || []).map(e => ({ player: { destinyUserInfo: e.player?.destinyUserInfo && { membershipId: e.player.destinyUserInfo.membershipId, membershipType: e.player.destinyUserInfo.membershipType, displayName: e.player.destinyUserInfo.displayName, bungieGlobalDisplayName: e.player.destinyUserInfo.bungieGlobalDisplayName, bungieGlobalDisplayNameCode: e.player.destinyUserInfo.bungieGlobalDisplayNameCode }, characterClass: e.player?.characterClass }, values: { fireteamId: e.values?.fireteamId && { basic: { value: e.values.fireteamId.basic.value } }, team: e.values?.team && { basic: { value: e.values.team.basic.value } } } })) });
      const pgcr = id => PC[id] ? Promise.resolve(PC[id]) : fetch(`https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${id}/`, { headers: { 'X-API-Key': cfg.apiKey } }).then(r => r.json()).then(j => { if (j.ErrorCode !== 1) return null; PC[id] = slim(j.Response); return PC[id]; }).catch(() => null);
      const reps = await Promise.all(hist.map(a => pgcr(a.activityDetails.instanceId)));
      try { const keep = new Set(hist.map(a => a.activityDetails.instanceId)); LS.set('dc-pgcr1', Object.fromEntries(Object.entries(PC).filter(([k]) => keep.has(k)))); } catch {}
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
  // cada parte aparece assim que chega (o esquadrão recente, por exemplo, demora mais)
  let t = null; const show = () => { if (t) return; t = setTimeout(() => { t = null; if (charId === out.cid) { GD = out; if (isGd()) render(); } }, 150); };
  out.cid = charId; out.at = Date.now();
  await Promise.allSettled(tasks.map(x => x.then(show, show)));
  gdLoading = false; out.partial = false; clearTimeout(t); GD = out; if (isGd()) render();
}
function gdHTML() {
  const W = u().w, G = GD, p = profile, cp = p.characterProgressions?.data?.[charId];
  const pc = (a, b) => b ? Math.min(100, a / b * 100) : 100;
  const st = (big, label, bar) => `<div class="st"><b>${big}</b><span>${esc(label)}</span>${bar != null ? `<i><u style="width:${bar}%"></u></i>` : ''}</div>`;
  const wait = `<p class="gd-wait wait" role="status">${esc(u().loadingDefs)}</p>`, pend = k => !G || (G.partial && G[k] === undefined);
  const gr = p.profile?.data?.currentGuardianRank;
  const ranks = `<article class="gd"><div class="gd-head"><h2>${esc(W.ranksT)}</h2></div>${!have.a ? wait : `<div class="gd-grid">
    ${G?.pass ? st(G.pass.lvl, `${W.pass} ${G.pass.n}`, pc(G.pass.a, G.pass.b)) : ''}
    ${RANK_PROGS.map(h => { const x = cp?.progressions?.[h]; const n = G?.names?.[h]?.n; return x && n && (x.level || x.currentProgress) ? st(x.level, n, x.nextLevelAt ? pc(x.progressToNextLevel, x.nextLevelAt) : null) : ''; }).join('')}</div>`}</article>`;
  const rows = (kind, list) => { const done = list.filter(a => metric(a.m) > 0).sort((a, b) => metric(b.m) - metric(a.m)), z = list.length - done.length; return done.map(a => `<tr><td>${esc((kind === 'dg' ? W.dgW : W.raidW) + ' ' + L(a.n))}</td><td class="n">${fmtN(metric(a.m))}</td></tr>`).join('') + (z ? `<tr><td class="z">${esc(W.others(kind, z, done.length))}</td><td class="n z">${esc(W.noneYet)}</td></tr>` : ''); };
  const clears = `<article class="gd"><div class="gd-head"><h2>${esc(W.clearsT)}</h2></div>${!have.a ? wait : `<div class="gd-grid">${COUNT_METRICS.map(h => G?.metricNames?.[h]?.n ? st(fmtN(metric(h)), G.metricNames[h].n) : '').join('')}</div><table>${rows('dg', defs.dungeons)}${rows('raid', defs.raids)}</table>`}</article>`;
  const wp = `<article class="gd"><div class="gd-head"><h2>${esc(W.wpnT)}</h2></div><p>${esc(W.wpnNote)}</p>${pend('weapons') ? wait : G.weapons?.length ? `<table>${G.weapons.map(w => `<tr><td class="wn">${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : ''}${esc(w.n)}</td><td class="n">${fmtN(w.k)} ${esc(W.kills)}<small>${Math.round(w.p <= 1 ? w.p * 100 : w.p)}% ${esc(W.prec)}</small></td></tr>`).join('')}</table>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const c = G?.comm;
  const comm = `<article class="gd"><div class="gd-head"><h2>${esc(W.commT)}</h2></div>${pend('comm') ? wait : c ? `<div class="gd-grid">${st(fmtN(c.totalScore), W.commScore)}${Object.entries(c.commendationNodePercentagesByHash || {}).filter(([h]) => G.commNames[h]?.n).sort((a, b) => b[1] - a[1]).map(([h, v]) => st(v + '%', G.commNames[h].n, v)).join('')}</div>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const r = rtf(), ago = t => t && r ? (() => { const d = (t - Date.now()) / 1000; const a = Math.abs(d); return a < 3600 ? r.format(Math.round(d / 60), 'minute') : a < 86400 ? r.format(Math.round(d / 3600), 'hour') : r.format(Math.round(d / 86400), 'day'); })() : '';
  const clan = `<article class="gd"><div class="gd-head"><h2>${esc(G?.clan?.name || W.clanT)}</h2></div>${pend('clan') ? wait : G.clan?.none ? `<p>${esc(W.noClan)}</p>` : G.clan ? `<p>${esc(W.clanNote(G.clan.list.filter(x => x.on).length))}</p><div class="cl">${G.clan.list.slice(0, 12).map(x => `<button type="button" class="cl-p${x.on ? ' on' : ''}" data-mt="${x.mt}" data-mid="${esc(x.mid)}" data-name="${esc(x.full)}" title="${esc(W.seeBuild)}">${esc(x.n)}${x.on ? '' : ` · ${esc(ago(x.t))}`}</button>`).join('')}</div><p class="gd-tip">${esc(W.clanTip)}</p>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const opts = `<article class="gd"><div class="gd-head"><h2>${esc(W.optsT)}</h2></div><p>${esc(W.optsNote)}</p><div class="opts">${[['clears', W.optClears], ['build', W.optBuild]].map(([k, t]) => `<label><input type="checkbox" data-opt="${k}"${OPTS[k] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</div></article>`;
  const S2 = G?.stats, dec = n => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statsA = `<article class="gd"><div class="gd-head"><h2>${esc(W.statsT)}</h2></div>${pend('stats') ? wait : !S2 || (!S2.pvp && !S2.pve) ? `<p>${esc(W.unavailable)}</p>` : `
    ${S2.pvp?.games ? `<div class="gd-k">${esc(W.crucible)}</div><div class="gd-grid">${st(dec(S2.pvp.kd), 'K/D')}${st(dec(S2.pvp.eff), W.eff)}${st(Math.round(S2.pvp.wins / S2.pvp.games * 100) + '%', W.winsOf(S2.pvp.wins, S2.pvp.games))}${st(S2.pvp.best, W.bestGame)}</div>` : ''}
    ${S2.pve ? `<div class="gd-k">PvE</div><div class="gd-grid">${st(fmtN(S2.pve.kills), W.kills.replace(/^./, c => c.toUpperCase()))}${st(fmtN(S2.pve.cleared), W.cleared)}${st(fmtN(Math.round(S2.pve.secs / 3600)) + ' h', W.played)}</div>` : ''}
    <p>${S2.trials?.games ? esc(W.trialsLine(S2.trials.games, S2.trials.wins, dec(S2.trials.kd))) : esc(W.noTrials)}</p>`}</article>`;
  const rec = `<article class="gd"><div class="gd-head"><h2>${esc(W.recentT)}</h2></div><p>${esc(W.recentNote)}</p>${pend('recent') ? wait : !G.recent ? `<p>${esc(W.unavailable)}</p>` : !G.recent.length ? `<p>${esc(W.recentNone)}</p>` : `<ul class="sq">${G.recent.map(x => `<li><button type="button" class="cl-p sq-p" data-mt="${x.mt}" data-mid="${esc(x.mid)}" data-name="${esc(x.full)}" title="${esc(W.seeBuild)}"><span class="sq-n">${esc(x.n)}</span><span class="sq-s">${esc([x.cls, W.together(x.count), x.act, ago(x.t)].filter(Boolean).join(' · '))}</span></button></li>`).join('')}</ul>`}</article>`;
  const fl = favs();
  const fav = `<article class="gd"><div class="gd-head"><h2>${esc(W.favGT)}</h2></div>${fl.length ? `<ul class="sq">${fl.map(x => { const k = x.name.lastIndexOf('#'); return `<li><button type="button" class="cl-p sq-p fav-p" data-mt="${x.type}" data-mid="${esc(x.id)}" data-name="${esc(x.name)}" title="${esc(W.seeBuild)}"><span class="sq-n">${esc(k > 0 ? x.name.slice(0, k) : x.name)}<small>${esc(k > 0 ? x.name.slice(k) : '')}</small></span><span class="sq-s">${esc([x.t, x.pw ? '✦ ' + x.pw : '', x.at ? W.seenAgo(ago(x.at)) : ''].filter(Boolean).join(' · '))}</span></button></li>`; }).join('')}</ul>` : `<p>${esc(W.favNone)}</p>`}</article>`;
  const sv = savedList();
  const saved = `<article class="gd"><div class="gd-head"><h2>${esc(W.savedT)}</h2></div>${sv.length ? `<ul class="sq">${sv.map((x, i) => `<li><button type="button" class="cl-p sq-p sv-p" data-sv="${i}" title="${esc(W.seeBuild)}"><span class="sq-n">${esc(x.title || x.t)}</span><span class="sq-s">${esc([x.title ? x.t : '', x.name, '✦ ' + (x.p.characters.data[x.cid]?.light || ''), W.savedOn(ago(x.at))].filter(Boolean).join(' · '))}</span>${x.note ? `<span class="sq-s sv-note">${esc(x.note)}</span>` : ''}</button>${profile?.characters?.data?.[x.cid] ? wBtn(`data-svap="${i}"`) : member ? `<button type="button" class="lbd-btn sv-cp" data-svcp="${i}">${esc(cpt().short)}</button>` : ''}</li>`).join('')}</ul>` : `<p>${esc(W.savedNone)}</p>`}</article>`;
  if (tab === 'grep') return `<div class="panel">${repHTML()}</div>`;
  return tab === 'gst' ? `<div class="panel">${seasonHTML()}${grHTML()}${statsA}${clears}${wp}${comm}</div>` : tab === 'gcl' ? `<div class="panel">${clvHTML()}${clan}${FX ? firstHTML() + clanCkHTML() + cmpGHTML() : ''}</div>` : `<div class="panel">${lbHTML()}${lpaHTML()}${saved}${fav}${FX ? wishHTML() : ''}${rec}${vaultHTML()}${opts}</div>`;
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
const VENDORS = [[672118013, 'Banshee-44'], [3603221665, 'Lord Shaxx', false, 3459454558], [69482069, 'Zavala', false, 3756955867], [765357505, 'Saint-14', true, 142095858]]; // 4º: sub-loja "Armas" (foco da semana com engrama) // Saint-14 só nos fins de semana dos Desafios de Osíris (some quando não está)
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
      const loc = await entities('DestinyInventoryItemDefinition', all, lang === 'pt' ? 'pt' : 'en', true), en = loc;
      // coleção: só as armas e tonalizadores precisam (poucos itens)
      const need = hs.filter(h => (en[h]?.it === 3 || en[h]?.st === 20) && COLL[h] === undefined);
      await Promise.all(need.map(h => idef(h).then(d => { COLL[h] = d.c; })));
      const weapons = [], other = []; let sh = 0, shOwn = 0;
      for (const [i, x] of sales) {
        const e = en[x.itemHash], d = loc[x.itemHash]; if (!e?.n || !e.tl) continue;
        const owned = COLL[x.itemHash] ? colAcquired([COLL[x.itemHash]]) : null;
        if (e.st === 20) { sh++; if (owned) shOwn++; continue; }
        // materiais (0), moedas (1), engramas (8) e recompensas de facção (20 sem subtipo) ficam de fora
        if (e.it === 0 || e.it === 1 || e.it === 8 || (e.it === 20 && !e.st) || e.tt < 5 && e.it !== 3) continue;
        const cost = (x.costs || []).map(c => `${fmtN(c.quantity)} ${loc[c.itemHash]?.n || ''}`.trim()).join(' + ');
        if (e.it === 3) {
          const ps = (r.itemComponents?.sockets?.data?.[i]?.sockets || []).filter(sk => sk.plugHash && sk.isVisible !== false).map(sk => sk.plugHash).filter(h => pShow(en[h]));
          const kind = h => { const pc = en[h]?.pc || ''; return /intrinsics/.test(pc) ? 'k' : /^(frames|origins)$/.test(pc) ? 'tr' : /masterworks/.test(pc) ? 'mw' : ''; };
          weapons.push({ h: x.itemHash, n: d.n, tl: d.tl, ic: d.ic, dt: e.dt, owned, perks: ps.map(h => ({ n: loc[h]?.n || en[h].n, ic: loc[h]?.ic || en[h].ic, k: kind(h) })), cost });
        } else other.push({ n: d.n, d: (d.d || '').replace(/\{var:\d+\}/g, '…').split('\n')[0], ic: d.ic, cost });
      }
      // Shaxx e Zavala: as armas ficam na sub-loja de foco (escolher com engrama), sem rolo fixo; o resto da loja é emblema e material
      let focus = null; const fv = VENDORS[vi][3];
      if (fv) { try { const f = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/Character/${charId}/Vendors/${fv}/?components=402`); const fs = Object.values(f.sales?.data || {}), fl = await entities('DestinyInventoryItemDefinition', fs.map(x => x.itemHash), lang === 'pt' ? 'pt' : 'en');
        focus = fs.map(x => ({ x, d: fl[x.itemHash] })).filter(({ d }) => d?.n && d.tl && !/helmet|gauntlet|chest|leg|mark|bond|cloak|capacete|manopla|peitoral|perna|marca|v[íi]nculo|manto|armor|armadura|set|conjunto/i.test(d.tl)).map(({ x, d }) => ({ h: x.itemHash, n: d.n, tl: d.tl, ic: d.ic })); } catch { focus = null; } }
      out[vi] = { opt: VENDORS[vi][2], name: vname, until: r.vendor?.data?.nextRefreshDate, weapons, other: fv ? [] : other, focus, sh: fv ? 0 : sh, shOwn };
    } catch { out[vi] = { opt: VENDORS[vi][2], name: vname, failed: true }; }
  }));
  vendLoading = false; if (cid !== charId) return;
  VEND = out.filter(Boolean); if (tab === 'vend') render();
}
const COLL = {};
const EL_COLOR = { 1: '#d5dbe6', 2: 'var(--arc)', 3: 'var(--solar)', 4: '#b48cff', 6: '#6fa8ff', 7: 'var(--done)' };
function vendorsHTML() {
  const W = u().w, now = Date.now();
  // cada vendedor é um painel próprio, fechado por padrão; abre ao tocar
  const card = (id, title, sub, chip, body) => { const open = openSecs.has(id); return `<section data-sec="${id}" class="vend keep coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="${id}" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>${esc(title)}</h2><div class="sec-sub${/…$/.test(sub || '') ? ' wait' : ''}">${esc(sub)}</div></div>${chip ? `<span class="chip hot">${esc(chip)}</span>` : ''}<span class="chev" aria-hidden="true"></span></div></div><div class="vd-body">${body}</div></section>`; };
  // Xûr
  const cls = profile.characters.data[charId].classType, miss = xurMissing().map(x => x.h);
  const xu = XUR && XUR.items.length && (!XUR.until || Date.parse(XUR.until) > now);
  const xItems = xu ? XUR.items.filter(x => { const e = exoOf(x); return e && (e.t === 'w' || e.c === cls); }) : [];
  const xCats = xu ? XUR.cats || [] : [], xLeg = xu ? XUR.leg || [] : [];
  const xMiss = xItems.filter(x => miss.includes(x.h)).length + (have.b ? xCats.filter(xurCatMissing).length : 0);
  const xur = card('vd-xur', 'Xûr', xu ? W.xurSub2(xItems.length, cd(Date.parse(XUR.until) - now), u().classes[cls]) : (XUR ? W.xurGoneShort : u().loadingDefs), xMiss ? W.missN(xMiss) : '',
    xu ? `<div class="vd-x">${xItems.map(x => `<div class="vd-xi${miss.includes(x.h) ? ' miss' : ''}">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(x.n)}</b><small>${esc(x.tl)}${x.cost ? ` · ${x.cost} ${esc(W.coins)}` : ''}</small></div>${miss.includes(x.h) ? `<span class="chip hot">${esc(x.why === 'held' ? W.notHeld : W.notOwned)}</span>` : ''}</div>`).join('')}</div>${xCats.length ? `<div class="vd-k">${esc(W.xurCats)}</div><div class="vd-x">${xCats.map(x => { const m = have.b && xurCatMissing(x); return `<div class="vd-xi${m ? ' miss' : ''}">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(x.n)}</b><small>${x.cost ? `${x.cost} ${esc(W.coins)}` : ''}</small></div>${m ? `<span class="chip hot">${esc(W.notOwned)}</span>` : ''}</div>`; }).join('')}</div>` : ''}${xLeg.length ? `<details class="vd-more"><summary>${esc(W.xurLeg(xLeg.length))}</summary><div class="vd-x">${xLeg.map(x => `<div class="vd-xi">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(x.n)}</b><small>${esc(x.tl)}${x.cost ? ` · ${x.cost} ${esc(W.coins)}` : ''}</small></div></div>`).join('')}</div></details>` : ''}${have.c ? `<p class="vd-note">${esc(W.coinsHave(coins()))}</p>` : ''}` : `<p class="vd-note">${esc(XUR ? W.xurGone : u().loadingDefs)}</p>`);
  if (!VEND) return xur + VENDORS.filter(v => !v[2]).map(([, n], k) => card('vd-' + k, n, u().loadingDefs, '', '')).join('');
  const others = VEND.map((v, k) => {
    if (v.opt && (v.failed || (!v.weapons.length && !v.other.length && !v.focus?.length))) return '';
    if (v.failed) return card('vd-' + k, v.name, W.unavailable, '', '');
    const wm = v.weapons.filter(w => w.owned === false).length;
    const sub = [v.focus?.length ? W.nFocus(v.focus.length) : '', v.weapons.length ? W.nWeapons(v.weapons.length) : '', v.other.length ? W.nOther(v.other.length) : '', v.until ? W.changesIn(cd(Date.parse(v.until) - now)) : ''].filter(Boolean).join(' · ');
    const body = `${v.weapons.map(w => `<div class="vd-w${wishHas(w.h) ? ' wished' : ''}"><div class="vd-wh">${FX ? wishBtn(w) : ''}${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(w.n)}</b><small><span class="vd-el" style="--c:${EL_COLOR[w.dt] || 'var(--muted)'}"></span>${esc(w.tl)}${w.cost ? ' · ' + esc(w.cost) : ''}</small></div>${w.owned === false ? `<span class="chip hot">${esc(W.notOwned)}</span>` : ''}</div>
      <div class="vd-perks">${w.perks.map(p => `<span class="${p.k}">${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}${esc(p.n)}</span>`).join('')}</div></div>`).join('')}
      ${v.other.length ? `<table class="vd-t">${v.other.map(o => `<tr><td><b>${esc(o.n)}</b>${o.d ? `<small>${esc(o.d)}</small>` : ''}</td><td class="n">${esc(o.cost || '')}</td></tr>`).join('')}</table>` : ''}
      ${v.focus?.length ? `<div class="vd-k">${esc(W.focusT)}</div><div class="vd-f">${v.focus.map(f => `<div class="vd-fi${wishHas(f.h, f.n) ? ' wished' : ''}">${f.ic ? `<img src="${BNET}${f.ic}" alt="" loading="lazy">` : ''}<span><b>${esc(f.n)}</b><small>${esc(f.tl)}</small></span>${FX ? wishBtn(f) : ''}</div>`).join('')}</div><p class="vd-note">${esc(W.focusNote)}</p>` : ''}
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
  const loc = await entities('DestinyInventoryItemDefinition', dupH, lang === 'pt' ? 'pt' : 'en'), en = loc; if (my !== gen) return;
  const row = h => ({ n: loc[h]?.n || en[h]?.n || '', tl: loc[h]?.tl || '', ic: loc[h]?.ic || '', c: cnt[h], tt: en[h]?.tt, it: en[h]?.it });
  const dups = dupH.map(row).filter(x => x.n && (x.it === 2 || x.it === 3)).sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
  VAULT = { used: items.length, max: 600, exo: dups.filter(x => x.tt === 6), leg: dups.filter(x => x.tt !== 6) };
  if (isGd()) render();
}
function vaultHTML() {
  const W = u().w;
  if (!VAULT) return `<article class="gd"><div class="gd-head"><h2>${esc(W.vaultT)}</h2></div><p class="gd-wait wait" role="status">${esc(u().loadingDefs)}</p></article>`;
  const list = (t, a) => a.length ? `<div class="gd-k">${esc(t)}</div><table>${a.slice(0, 12).map(x => `<tr><td class="wn">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<span>${esc(x.n)}<small class="pv-s">${esc(x.tl)}</small></span></td><td class="n">×${x.c}</td></tr>`).join('')}</table>${a.length > 12 ? `<p>${esc(W.andMore(a.length - 12))}</p>` : ''}` : '';
  const pc = Math.round(VAULT.used / VAULT.max * 100);
  return `<article class="gd"><div class="gd-head"><h2>${esc(W.vaultT)}</h2></div>
    <div class="vb"><div><b>${VAULT.used}</b> ${esc(W.of)} ${VAULT.max} ${esc(W.slots)}</div><i><u style="width:${pc}%"></u></i></div>
    ${list(W.dupExo, VAULT.exo)}${list(W.dupLeg, VAULT.leg)}
    <p>${esc(VAULT.exo.length || VAULT.leg.length ? W.vaultNote : W.vaultClean)}</p>${member && lbAllowed() ? `<div class="vb-lc"><span><b>${esc(lw().lcIn)} <small class="lb-beta">beta</small></b><small>${esc(lw().lcInD)}</small></span><button type="button" class="lb-run" data-lcopen>${esc(lw().lcBtn)} ↗</button></div>` : ''}</article>`;
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
  renderWeek(); renderBuild(); renderLive();
  if (!cfg) return;
  if (!logged) {
    delete $('title').dataset.full; $('title').style.fontSize = ''; $('title').classList.remove('two'); $('title').textContent = 'Destiny Parallel Interface'; document.title = 'DPI · Destiny Parallel Interface'; $('eyebrow').textContent = 'Destiny 2'; renderGuardian(null); landing(!auth);
    $('subtabs').hidden = true;
    if (auth) return; // carregando
    const U = u();
    showMessage(`<form class="lsearch" id="lsearch" role="search"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" id="lsq" placeholder="${esc(U.lsQ)}" aria-label="${esc(U.lsQ)}" autocomplete="off" spellcheck="false"><button class="lsbtn" type="submit">${esc(U.lsBtn)}</button></form><p class="lshint">${esc(U.lsHint)}</p><section class="hero"><h2>${esc(U.heroTitle)}</h2><p>${esc(U.heroText)}</p>${cfg.configured ? `<button class="btn" id="loginbtn" type="button">${esc(U.login)}</button>` : `<p class="notice">${esc(U.notConfigured)}</p>`}<ul>${U.heroList.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
    const b = $('loginbtn'); if (b) b.onclick = login;
    $('lsearch').onsubmit = e => { e.preventDefault(); const q = $('lsq').value.trim(); if (q) openPublic(q); };
    return;
  }
  const U = u(), ch = profile.characters.data[charId];
  const cls = U.classes[ch.classType] || '';
  const mx = maxPower(ch.classType);
  const sub = (profile.characterEquipment?.data?.[charId]?.items || []).find(i => i.bucketHash === SUB_BUCKET), sn = sub && gearDefs[sub.itemHash]?.n;
  const ttl = charTitle(cls, sn);
  Object.assign($('title').dataset, { full: ttl, short: sn || cls, cls }); $('title').textContent = ttl; $('title').title = `${U.races[ch.raceType] || ''} ${cls}`; document.title = ttl + ' · DPI';
  renderGuardian(ch);
  $('eyebrow').dataset.base = member.name || ''; $('eyebrow').textContent = member.name || ''; $('eyebrow').title = member.name || ''; fitTitle();
  $('ghpw').hidden = false; $('ghout').querySelector('span').textContent = U.logout; $('ghout').classList.remove('ask'); $('pwv').textContent = ch.light; $('pwmax').textContent = mx && mx > ch.light ? `${U.max} ${mx}` : U.power;
  const many = Object.keys(profile.characters.data).length > 1;
  $('chars').innerHTML = (many ? Object.values(profile.characters.data).map(c => `<button class="char" type="button" data-char="${c.characterId}" aria-pressed="${c.characterId === charId}">${esc(U.classes[c.classType])}<span class="pw">${c.light}</span></button>`).join('') : '') + `<button class="char findbtn" type="button" id="findbtn" title="${esc(U.w.find)}" aria-label="${esc(U.w.find)}">${FIND_ICON}<span>${esc(U.w.findShort)}</span></button>`;
  $('chars').hidden = false;
  $('tabs').innerHTML = GROUPS.map(g => `<button class="tab" type="button" data-group="${g.id}" aria-current="${groupOf(tab)?.id === g.id}">${esc(U.tabs[g.id])}</button>`).join('');
  const g = groupOf(tab), st = $('subtabs');
  if (g && g.subs.length > 1) { st.hidden = false; st.innerHTML = g.subs.map(id => `<button class="sub" type="button" data-sub="${id}" aria-pressed="${id === tab}">${esc(U.subs[id])}</button>`).join(''); }
  else { st.hidden = true; st.innerHTML = ''; }
  $('ldbtn').setAttribute('aria-pressed', tab === 'ld'); $('ldbtn').textContent = tab === 'ld' ? U.checklist : U.loadouts;
  document.body.classList.toggle('on-ld', tab === 'ld'); document.body.classList.toggle('no-clears', !OPTS.clears);
  $('overall').hidden = isGd() || tab === 'vend' || tab === 'tri';
  if (tab === 'tri') { $('list').innerHTML = triHTML(); return; }
  if (tab === 'vend' && !VEND && have.a && member) loadVendors(gen);
  if (isGd()) { $('list').innerHTML = gdHTML(); if (!GD && have.a) loadGuardian(gen); if (!VAULT && have.c) loadVault(gen); return; }
  if (tab === 'ld') {
    showMessage(!have.c ? `<p class="empty-msg wait" role="status">${esc(U.loadingDefs)}</p>` : LOADOUTS.length ? ldListHTML() : `<p class="empty-msg">${esc(U.noLoadouts)}</p>`);
    if (have.c && LOADOUTS.length) ensureLdCtx();
    $('ovcount').textContent = U.ld(LOADOUTS.length); $('ovbar').style.width = '0';
    return;
  }
  const secs = SECTIONS.filter(x => x.tab === tab && secAvail(x));
  // O que já foi concluído fica no fim da lista, minimizado.
  const secDone = x => x.items.length > 0 && x.items.every(isDone);
  if (SORT_TABS.includes(tab)) {
    // a pessoa escolhe a ordem; concluídos sempre no fim
    const m = sortOf(tab), pct = secPct, idx = new Map(secs.map((x, i) => [x, i]));
    // "falta arma"/"falta catalisador": o que ainda falta primeiro (por dificuldade), o resto no fim
    const miss = x => m === 'wpn' || m === 'cat' ? (x.items.some(i => (m === 'wpn' ? i.isEx : i.isCat) && !isDone(i)) ? 0 : 1) : 0;
    secs.sort((a, b) => (miss(a) - miss(b)) || (m === 'near' ? pct(b) - pct(a) : m === 'low' ? pct(a) - pct(b) : m === 'name' ? a.title.localeCompare(b.title, lang === 'en' ? 'en' : 'pt-BR') : (secTier(a) - secTier(b)) || (pct(b) - pct(a))) || idx.get(a) - idx.get(b));
  }
  secs.sort((a, b) => secDone(a) - secDone(b));
  const tsBar = SORT_TABS.includes(tab) ? `<div class="tsort"><label class="tsort-k" for="tsortsel">${esc(U.tsK)}</label><select id="tsortsel" class="tsort-sel">${TS_OPTS[tab].map(k => `<option value="${k}"${sortOf(tab) === k ? ' selected' : ''}>${esc(U.tsO[k])}</option>`).join('')}</select></div>${secs.length ? '' : `<p class="empty-msg">${esc(U.tsNone)}</p>`}` : '';
  const wkBar = tab === 'exo' && have.a ? (() => { const n = weekExo().size; return `<div class="wkx"><button type="button" class="char wkx-b" id="wkxbtn" aria-pressed="${WKX.on}" title="${esc(U.w.wkExoTip)}">★ ${esc(U.w.wkExo(n))}</button></div><p class="empty-msg" id="wkxnone" hidden>${esc(U.w.wkExoNone)}</p>`; })() : '';
  if (tab === 'obj' && have.a && member && LIVE.checked && !LIVE.on) loadSession();
  if ((tab === 'raid' || tab === 'dg' || tab === 'xm') && have.a && member) loadActHist();
  if (tab === 'xm') loadXmRec();
  $('list').innerHTML = `<div class="panel">${tab === 'obj' ? newsHTML() : ''}${tab === 'obj' ? sessHTML() : ''}${wkBar}${tsBar}${secs.map(sec => {
    if (sec.html) return sec.id === 'vendors' ? vendorsHTML() : sec.id === 'xmissions' ? xmHTML() : sec.id === 'goals' ? goalsHTML() : sec.id === 'post' ? postHTML() : sec.id === 'wishobj' ? wishObjHTML() : sec.id === 'focus' ? focusHTML() : sec.id === 'grank' ? grObjHTML() : '';
    if (FX && sec.id === 'week' && sec.items.length) return weekHTML(sec);
    if (sec.empty) return `<p class="empty-msg${/…$/.test(sec.note || '') ? ' wait' : ''}">${esc(sec.note)}</p>`;
    if (!sec.items.length) return `<section data-sec="${sec.id}"><div class="sec-head"><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2></div></div><p>${esc(sec.note)}</p></div></section>`;
    const keep = true, coll = sec.coll || ((tab === 'exo' || tab === 'cat') && sec.items?.length) || (keep && secDone(sec)), open = openSecs.has(sec.id);
    const act = sec.camp || sec.xm || (sec.kind && (sec.kind === 'raid' ? defs.raids : defs.dungeons).find(x => x.k === sec.key));
    return `<section data-sec="${sec.id}"${act?.img ? ` style="--act-img:url('${BNET}${act.img}')"` : ''} class="${keep ? 'keep' : ''}${act?.img ? ' act-img' : ''}${sec.weekly ? ' wk-sec' : ''}${coll ? ` coll${open ? '' : ' collapsed'}` : ''}">
      <div class="sec-head"${coll ? ` data-coll="${sec.id}" role="button" tabindex="0" aria-expanded="${open}"` : ''}><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2>${sec.kind ? secMeta(sec) : sec.tier || sec.xm ? `<div class="sec-meta">${titMeta(sec)}${sec.xm ? actYt('xm', sec.xm.k) : ''}</div>` : ''}</div><span class="count" data-sc="${sec.id}"></span>${FOCUS_TABS.includes(sec.tab) ? focBtn('sec:' + sec.id) : ''}${coll ? '<span class="chev" aria-hidden="true"></span>' : ''}</div>
      ${sec.note ? `<p>${esc(sec.note)}</p>` : ''}${sec.kind ? actStrip(sec) : sec.xm ? xmStrip(sec.xm) : ''}<div class="sec-bar"><i data-sb="${sec.id}"></i></div></div>
      <ul>${sec.items.map(i => {
        const cid = 'c-' + i.id.replace(/[^a-z0-9]+/gi, '-'), first = i.c[0], rest = i.c.slice(1), more = !!(i.d || rest.length || i.loc);
        const ich = itemIch(sec, i);
        const head = `${ich ? `<span class="it-ic" data-ich="${ich}" aria-hidden="true"${ICONS[ich] ? ` style="background-image:url('${BNET}${ICONS[ich]}')"` : ''}></span>` : ''}<span class="t">${esc(i.t)}</span>${first ? `<span class="chip ${chipClass(first)}">${esc(first)}</span>` : ''}`;
        return `<li data-li="${esc(i.id)}" data-search="${esc([i.t, i.d, i.loc, ...i.c, sec.title].join(' ').toLowerCase())}"><div class="row"><label class="ck" for="${cid}"><input type="checkbox" id="${cid}" data-id="${esc(i.id)}" aria-label="${esc(i.t)}"${i.auto ? ' checked disabled' : ''}></label>${more ? `<button class="it" type="button" aria-expanded="false">${head}<span class="chev" aria-hidden="true"></span></button>` : `<span class="it">${head}</span>`}${FOCUS_ITEM_TABS.includes(sec.tab) && !isDone(i) ? focBtn('it:' + i.id) : ''}</div>${more ? `<div class="more">${i.loc ? `<div class="loc"><span class="loc-k">${esc(U.where)}</span> ${hiLoc(esc(i.loc))}</div>` : ''}${i.tl ? `<ul class="tl">${i.tl.map(x => `<li class="${x.ok ? 'ok' : ''}"><span class="tl-i" aria-label="${x.ok ? '✓' : '○'}">${x.ok ? '✓' : ''}</span><div><b>${esc(x.n)}${x.pr ? ` <span class="tl-p">${esc(x.pr)}</span>` : ''}</b>${x.d && !x.ok ? `<small>${hiLoc(esc(x.d))}</small>` : ''}</div></li>`).join('')}</ul>` : i.d ? `<div class="d">${hiLoc(esc(i.d))}</div>` : ''}${rest.length ? `<div class="chips">${rest.map(x => `<span class="chip ${chipClass(x)}">${esc(x)}</span>`).join('')}</div>` : ''}</div>` : ''}</li>`;
      }).join('')}</ul></section>`;
  }).join('')}<p class="donebar" id="donebar" hidden><span id="donetxt"></span><button class="reset" id="togglecomplete" type="button"></button></p></div>`;
  document.querySelectorAll('#list li[data-li]').forEach(li => { if (openItems.has(li.dataset.li)) { li.classList.add('open'); li.querySelector('button.it')?.setAttribute('aria-expanded', 'true'); } });
  update(); filter(); sideRail();
  if (tab === 'exo' || tab === 'cat' || tab === 'obj') window.requestIdleCallback ? window.requestIdleCallback(() => loadIcons(), { timeout: 800 }) : setTimeout(loadIcons, 200);
}
const isDone = i => i.auto || marks.has(i.id);
const itemIch = (sec, i) => sec?.tab === 'exo' && /^x-\d+$/.test(i.id) ? 'DestinyCollectibleDefinition:' + i.id.slice(2) : sec?.tab === 'cat' && /^c-\d+$/.test(i.id) ? catIcon(+i.id.slice(2)) : '';
// detalhes de um item (onde, passos, como pegar, etiquetas): o mesmo da lista, usado também nos cartões do Foco
function itemMore(i, rest) {
  const U = u();
  return `${i.loc ? `<div class="loc"><span class="loc-k">${esc(U.where)}</span> ${hiLoc(esc(i.loc))}</div>` : ''}${i.tl ? `<ul class="tl">${i.tl.map(x => `<li class="${x.ok ? 'ok' : ''}"><span class="tl-i" aria-label="${x.ok ? '✓' : '○'}">${x.ok ? '✓' : ''}</span><div><b>${esc(x.n)}${x.pr ? ` <span class="tl-p">${esc(x.pr)}</span>` : ''}</b>${x.d && !x.ok ? `<small>${hiLoc(esc(x.d))}</small>` : ''}</div></li>`).join('')}</ul>` : i.d ? `<div class="d">${hiLoc(esc(i.d))}</div>` : ''}${rest.length ? `<div class="chips">${rest.map(x => `<span class="chip ${chipClass(x)}">${esc(x)}</span>`).join('')}</div>` : ''}`;
}
/* ícones de exóticos e catalisadores: o texto aparece na hora e a imagem chega depois (guardada no navegador para as próximas visitas) */
const ICONS = LS.get('dc-icons', {});
// catalisador: o ícone da própria arma (o do triunfo é igual para todos); sem a arma, fica o do triunfo
const catIcon = rh => { const c = defs.cats.find(x => x.h === rh), e = c && catWeapon(c.n[0].replace(/ Catalyst$/, '')); return e?.h?.[0] ? 'DestinyCollectibleDefinition:' + e.h[0] : 'DestinyRecordDefinition:' + rh; };
let iconsBusy = false;
async function loadIcons() {
  if (iconsBusy) return; const els = [...document.querySelectorAll('#list [data-ich]')].filter(e => !e.style.backgroundImage); if (!els.length) return;
  iconsBusy = true; const by = {};
  for (const e of els) { const [t, h] = e.dataset.ich.split(':'); if (!ICONS[e.dataset.ich]) (by[t] = by[t] || new Set()).add(+h); }
  try { for (const [t, hs] of Object.entries(by)) { const d = await entities(t, [...hs], 'en'); for (const h of hs) if (d[h]?.ic) ICONS[t + ':' + h] = d[h].ic; } } catch {}
  try { LS.set('dc-icons', ICONS); } catch {}
  for (const e of document.querySelectorAll('#list [data-ich]')) { const ic = ICONS[e.dataset.ich]; if (ic && !e.style.backgroundImage) e.style.backgroundImage = `url('${BNET}${ic}')`; }
  iconsBusy = false;
}
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
  const secs = SECTIONS.filter(x => x.tab === tab && !x.empty && !x.html && secAvail(x));
  let n, t, label;
  if (tab === 'raid' || tab === 'dg' || tab === 'xm') { t = secs.length; n = secs.filter(x => isDone(x.items[0])).length; label = U[tab](n, t); }
  else if (tab === 'tit') { t = secs.length; n = secs.filter(x => x.items.every(isDone)).length; label = U.tit(n, t); }
  else if (tab === 'camp') { const cs = secs.filter(x => x.camp); t = cs.length; n = cs.filter(x => x.items.every(isDone)).length; label = U.campDone(n, t); }
  else { const items = secs.flatMap(x => x.items); t = items.length; n = items.filter(isDone).length; label = U.done1(n, t); }
  $('ovcount').textContent = label; $('ovbar').style.width = (t ? n / t * 100 : 0) + '%';
}
/* Exóticos: só o que falta e dá para pegar esta semana (incursão/masmorra em destaque e Xûr) */
const WKX = { on: false };
function weekExo() {
  const f = featured(), out = new Set();
  for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) for (const a of list) if (f[kind].has(a.k) && a.x) { const e = exoticByName(a.x); if (e && colMissing(e.h)) out.add('x-' + e.h[0]); }
  if (XUR?.until && Date.parse(XUR.until) > Date.now()) for (const x of xurMissing()) { const e = exoOf(x); if (e) out.add('x-' + e.h[0]); }
  return out;
}
let itemIndex = null;
function findItem(id) { if (!itemIndex || itemIndex.v !== SECTIONS) { itemIndex = { v: SECTIONS, m: new Map() }; for (const s of SECTIONS) for (const i of s.items) itemIndex.m.set(i.id, i); } return itemIndex.m.get(id); }
function filter() {
  const q = query.trim().toLowerCase(), wk = tab === 'exo' && WKX.on ? weekExo() : null;
  document.querySelectorAll('#list li[data-li]').forEach(li => li.classList.toggle('no-match', (!!q && !li.dataset.search.includes(q)) || (!!wk && !wk.has(li.dataset.li))));
  document.querySelectorAll('#list section').forEach(sec => { sec.classList.toggle('empty', (!!q || !!wk) && !sec.querySelector('li[data-li]:not(.no-match)')); sec.classList.toggle('q-open', !!q || !!wk); });
  const wn = $('wkxnone'); if (wn) wn.hidden = !wk || wk.size > 0;
}

/* ---------- eventos ---------- */
function go(t) { tab = t; const g = groupOf(t); if (g) { lastSub[g.id] = t; LS.set('dc-subs', lastSub); } LS.set('dc-tab', t); render(); }
$('tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; const g = GROUPS.find(x => x.id === b.dataset.group); go(g.subs.includes(lastSub[g.id]) ? lastSub[g.id] : g.subs[0]); });
$('subtabs').addEventListener('click', e => { const b = e.target.closest('.sub'); if (b) go(b.dataset.sub); });
$('chars').addEventListener('click', e => { if (e.target.closest('#findbtn')) { openFind(); return; } const b = e.target.closest('.char'); if (!b || b.dataset.char === charId) return; charId = b.dataset.char; LS.set('dc-char-' + member.id, charId); resetChar(); buildOpen && renderBuild(); hydrate(); });
$('ldbtn').addEventListener('click', () => { if (tab === 'ld') go(prevTab || 'obj'); else { prevTab = tab; go('ld'); } });
$('themebtn').addEventListener('click', () => { const t = curTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; LS.set('dc-theme', t); applyTheme(); });
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch {}
$('langbtn').addEventListener('click', () => { lang = lang === 'en' ? 'pt' : 'en'; LS.set('dc-lang', lang); for (const k in SVCTX) delete SVCTX[k]; GD = null; VEND = null; XUR = null; if (profile) hydrate(); else render(); });
$('refresh').addEventListener('click', () => { GD = null; VAULT = null; VEND = null; XUR = null; start(); });
$('logout').addEventListener('click', logout);
// Sair no cabeçalho: o primeiro toque pede confirmação (3 s); o segundo desconecta
let outT = null;
$('ghout').addEventListener('click', () => { const b = $('ghout'); if (b.classList.contains('ask')) { clearTimeout(outT); b.classList.remove('ask'); logout(); return; } b.classList.add('ask'); b.querySelector('span').textContent = u().outQ; outT = setTimeout(() => { b.classList.remove('ask'); b.querySelector('span').textContent = u().logout; }, 3000); });
$('hide').addEventListener('change', e => { document.body.classList.toggle('hide-done', e.target.checked); LS.set('dc-hide2', e.target.checked); });
$('searchbtn').addEventListener('click', () => { const q = $('q'), show = q.hidden; q.hidden = !show; $('searchbtn').setAttribute('aria-expanded', show); if (show) q.focus(); else { q.value = ''; query = ''; filter(); } });
$('q').addEventListener('input', e => { query = e.target.value; filter(); });
const toggleSec = h => { const id = h.dataset.coll, sec = h.closest('section'); const o = sec.classList.toggle('collapsed') === false; if (id === 'goals-x' || id === 'today-x' || id === 'wish-x' || id === 'foc-x') { o ? openSecs.delete(id) : openSecs.add(id); } else { o ? openSecs.add(id) : openSecs.delete(id); } h.setAttribute('aria-expanded', o); };
$('list').addEventListener('change', e => { if (e.target.id === 'tsortsel') { TSORT.v[tab] = e.target.value; LS.set('dc-sorts', TSORT.v); render(); } });
$('list').addEventListener('keydown', e => { const jb = e.target.closest && e.target.closest('[data-jump][role="button"]'); if (jb && e.target === jb && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); jb.click(); return; } const h = e.target.closest && e.target.closest('.sec-head[data-coll]'); if (h && e.target === h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSec(h); } });
$('list').addEventListener('click', e => {
  const hd = e.target.closest('.sec-head[data-coll]'); if (hd) { toggleSec(hd); return; }
  const it = e.target.closest('button.it'); if (it) { const li = it.closest('li'); const o = li.classList.toggle('open'); it.setAttribute('aria-expanded', o); o ? openItems.add(li.dataset.li) : openItems.delete(li.dataset.li); return; }
  if (e.target.id === 'togglecomplete') { document.body.classList.toggle('show-complete'); update(); }
  const wo = e.target.closest('[data-wko]'); if (wo) { const id = wo.dataset.wko; WKO.has(id) ? WKO.delete(id) : WKO.add(id); render(); return; }
  const jf = e.target.closest('[data-jump]'); if (jf) { const [t, id] = jf.dataset.jump.split(':'); jumpTo(t, id); return; }
  
  if (e.target.closest('#wkxbtn')) { WKX.on = !WKX.on; e.target.closest('#wkxbtn').setAttribute('aria-pressed', WKX.on); filter(); }
});
$('list').addEventListener('change', e => { const k = e.target.dataset.opt; if (k) { OPTS[k] = e.target.checked; LS.set('dc-opts', OPTS); render(); return; } const id = e.target.dataset.id; if (!id || !member) return; e.target.checked ? marks.add(id) : marks.delete(id); LS.set('dc-marks-' + member.id, [...marks]); update(); });
$('week').addEventListener('click', e => { const b = e.target.closest('.wk'); if (!b) return; const w = WK[+b.dataset.wk]; if (w && w.to) jumpTo(w.to[0], w.to[1]); });
$('gear').addEventListener('click', toggleBuild);
$('buildbtn').addEventListener('click', toggleBuild);
$('build').addEventListener('click', e => { if (e.target.closest('.b-cam')) openShare(ownCtx()); if (e.target.closest('.b-save')) { toggleSaved(ownCtx()); renderBuild(); return; } const lk = e.target.closest('.b-link'); if (lk && member?.name) copyLink(member.name, lk); });
$('gear').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBuild(); } });
setInterval(() => { if (document.visibilityState === 'visible' && profile && tab === 'obj') { build(); render(); } }, 60000);


/* ---------- buscar outro guardião e ver a build dele ---------- */
const FIND_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
async function bungiePost(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`HTTP ${r.status}`);
  if (j.ErrorCode === 2107 && location.host === OLD_HOST) { moveToNew(); throw new Error('moving'); }
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
let fdTimer = null, svT = null;
// grava nome e anotação da build salva (pelo botão, ou ao fechar/voltar com algo não salvo)
function commitSv(sv, show) {
  if (!sv || !sv.dataset.dirty) return; const l = savedList(), x = l.find(y => y.k === sv.dataset.svk); if (!x) return;
  x.title = sv.querySelector('.fd-svn').value.trim(); x.note = sv.querySelector('.fd-svd').value.trim();
  let ok = true; try { LS.set('dc-builds', l); ok = JSON.stringify(LS.get('dc-builds', []).find(y => y.k === x.k)?.note) === JSON.stringify(x.note); } catch { ok = false; }
  delete sv.dataset.dirty; if (isGd()) render();
  if (show) { const b = sv.querySelector('.fd-svok'); b.disabled = true; b.textContent = ok ? '✓ ' + u().w.svSaved : u().w.svFail; sv.querySelector('.fd-svs').textContent = ''; }
}
function openFind(sel) {
  const d = $('finddlg'), W = u().w;
  d.innerHTML = `<div class="fd-box"><button class="sh-x fd-x" type="button" aria-label="${esc(W.shareClose)}" title="${esc(W.shareClose)}">×</button><h2 class="fd-t">${esc(W.find)}</h2><input class="search fd-q" id="fdq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(W.findPh)}" aria-label="${esc(W.find)}" value="${esc(FD.q)}"><div id="fdbody"></div></div>`;
  if (!d.open) d.showModal();
  if (sel) showPlayer(sel); else { renderFind(); if (!FD.sel) setTimeout(() => $('fdq')?.focus(), 30); }
}
function renderFind() {
  const W = u().w, b = $('fdbody'); if (!b) return; commitSv(b.querySelector('.fd-sv[data-dirty]'));
  if (FD.sel) {
    const p = FD.p, chars = p ? Object.values(p.characters?.data || {}).sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed)) : [];
    const ch = p?.characters?.data?.[FD.cid];
    let body;
    if (FD.status === 'loading') body = `<p class="fd-msg wait" role="status">${esc(W.findLoadingP)}</p>`;
    else if (!ch) body = `<p class="fd-msg">${esc(W.privateP)}</p>`;
    else {
      const eq = p.characterEquipment?.data?.[FD.cid]?.items || [], sub = eq.find(i => i.bucketHash === SUB_BUCKET), sn = FD.B?.loc?.[sub?.itemHash]?.n;
      const el = ELEMENTS[FD.B?.en?.[sub?.itemHash]?.dt] || '', [a1, a2] = ELEMENT_ACC[el] || ELEMENT_ACC.arc;
      const r = rtf(), ago = ch.dateLastPlayed && r ? (() => { const d = (Date.parse(ch.dateLastPlayed) - Date.now()) / 1000, a = Math.abs(d); return a < 3600 ? r.format(Math.round(d / 60), 'minute') : a < 86400 ? r.format(Math.round(d / 3600), 'hour') : r.format(Math.round(d / 86400), 'day'); })() : '';
      body = `<div class="fd-hero" style="--a1:${a1};--a2:${a2}"><div class="fd-band"${ch.emblemBackgroundPath ? ` style="background-image:url('${BNET}${ch.emblemBackgroundPath}')"` : ''}><div class="fd-id"><div class="fd-who"><span>${esc(FD.sel.name)}</span>${FD.sel.id ? `<button type="button" class="fd-fav" aria-pressed="${isFav(FD.sel)}" title="${esc(isFav(FD.sel) ? W.unfav : W.fav)}" aria-label="${esc(isFav(FD.sel) ? W.unfav : W.fav)}">${STAR_ICON(isFav(FD.sel))}</button>` : ''}</div><div class="fd-ttl">${esc(charTitle(u().classes[ch.classType] || '', sn))}</div></div><div class="fd-pw"><b>${ch.light}</b><span>${esc(FD.sel.note || (ago ? W.lastPlayed(ago) : u().power))}</span></div></div>
        ${chars.length > 1 ? `<div class="fd-chars">${chars.map(c => `<button type="button" class="char" data-fdc="${c.characterId}" aria-pressed="${c.characterId === FD.cid}">${esc(u().classes[c.classType])}<span class="pw">${c.light}</span></button>`).join('')}</div>` : ''}
        ${FD.B ? `<div class="fd-act"><span class="fd-act-k">${esc(FD.cmp ? W.cmpOn : W.subclass)}</span>${profile ? `<button type="button" class="fd-ib fd-cmpbtn" aria-pressed="${!!FD.cmp}" title="${esc(FD.cmp ? W.cmpClose : W.compare)}" aria-label="${esc(FD.cmp ? W.cmpClose : W.compare)}">${FD.cmp ? CLOSE_ICON : CMP_ICON}</button>` : ''}<button type="button" class="fd-ib fd-save" aria-pressed="${!!savedKey(fdCtx())}" title="${esc(savedKey(fdCtx()) ? W.unsaveB : W.saveB)}" aria-label="${esc(savedKey(fdCtx()) ? W.unsaveB : W.saveB)}">${SAVE_ICON(!!savedKey(fdCtx()))}</button>${FD.sel?.ld != null ? '' : `<a class="fd-ib fd-dim" href="${esc(dimLink(fdCtx()))}" target="_blank" rel="noopener" title="${esc(W.toDim)}" aria-label="${esc(W.toDim)}">${EXPORT_ICON}<span>DIM</span></a>`}${!FD.cmp && member && profile?.characters && !profile.characters.data?.[FD.cid] && FD.B ? `<button type="button" class="fd-ib cp-btn" data-cpme>${esc(cpt().btn)}</button>` : ''}${!FD.cmp && wOk() && profile?.characters?.data?.[FD.cid] && (FD.sel?.k || FD.sel?.ld != null) ? `<button type="button" class="fd-ib wr-btn" data-wrfd>${esc(wt().apply)} <small>beta</small></button>` : ''}${shareMenu('fd', true, !!FD.sel.id)}</div>` : ''}
        ${FD.B && !FD.cmp && savedKey(fdCtx()) ? (() => { const x = savedList().find(y => y.k === savedKey(fdCtx())); return `<div class="fd-sv" data-svk="${esc(x.k)}"><input class="fd-svn" type="text" maxlength="40" value="${esc(x.title || '')}" placeholder="${esc(W.svName(x.t))}" aria-label="${esc(W.svNameL)}"><textarea class="fd-svd" rows="2" maxlength="200" placeholder="${esc(W.svNote)}" aria-label="${esc(W.svNote)}">${esc(x.note || '')}</textarea><div class="fd-svb"><span class="fd-svs" aria-live="polite"></span><button type="button" class="fd-svok" disabled>${esc(W.svSave)}</button></div></div>`; })() : ''}${!profile && FD.B ? `<p class="fd-pub">${esc(W.publicNote)}</p>` : ''}${FD.cmp && FD.B && BUILD ? cmpSrcHTML() + (cmpMine() ? compareHTML(cmpMine(), fdCtx()) : `<p class="fd-msg fd-pad${FD.ldErr ? '' : ' wait'}">${esc(FD.ldErr ? W.ldEmpty : W.loadingLd)}</p>`) : `<div class="build fd-build">${FD.B ? buildHTML(fdCtx()) : `<p class="b-note wait" role="status">${esc(W.findLoadingP)}</p>`}</div>`}</div>`;
    }
    b.innerHTML = `<button type="button" class="reset fd-back">← ${esc(FD.cmp ? W.backBuild : W.back)}</button>${body}`;
    return;
  }
  const res = FD.results;
  b.innerHTML = FD.status === 'loading' ? `<p class="fd-msg wait" role="status">${esc(W.findLoading)}</p>` : FD.status === 'error' ? `<p class="fd-msg">${esc(W.findErr)}</p>` : res == null ? favsHTML() + `<p class="fd-msg">${esc(W.findHint)}</p>` : !res.length ? `<p class="fd-msg">${esc(W.findNone)}</p>` : `<ul class="fd-res">${res.map((x, i) => { const k = x.name.lastIndexOf('#'); return `<li><button type="button" data-fdr="${i}"><span>${esc(x.name.slice(0, k))}</span><small>${esc(x.name.slice(k))}</small></button></li>`; }).join('')}</ul>`;
}
const fdCtx = () => ({ p: FD.p, cid: FD.cid, B: FD.B, name: FD.sel?.name || '', k: FD.sel?.k });
/* favoritos: ficam salvos neste navegador e aparecem como atalho na busca */
const favs = () => LS.get('dc-favs', []);
const isFav = sel => !!sel && favs().some(f => f.id === sel.id);
function favInfo() { const ch = FD.p?.characters?.data?.[FD.cid]; if (!ch) return {}; const sub = (FD.p.characterEquipment?.data?.[FD.cid]?.items || []).find(i => i.bucketHash === SUB_BUCKET); return { t: charTitle(u().classes[ch.classType] || '', FD.B?.loc?.[sub?.itemHash]?.n), pw: ch.light, at: Date.now() }; }
function toggleFav(sel) { const l = favs(), i = l.findIndex(f => f.id === sel.id); if (i >= 0) l.splice(i, 1); else l.unshift({ name: sel.name, type: sel.type, id: sel.id, ...favInfo() }); LS.set('dc-favs', l.slice(0, 30)); if (isGd()) render(); }
// ao abrir um favorito, guarda a classe/subclasse e a luz de agora para mostrar na lista
function touchFav() { const l = favs(), f = l.find(x => x.id === FD.sel?.id); if (!f || !FD.B) return; Object.assign(f, favInfo()); LS.set('dc-favs', l); }
function favsHTML() {
  const l = favs(); if (!l.length) return '';
  return `<div class="fd-k">${esc(u().w.favT)}</div><ul class="fd-res fd-favs">${l.map((x, i) => { const k = x.name.lastIndexOf('#'); return `<li><button type="button" data-fdv="${i}"><span class="fd-star" aria-hidden="true">★</span><span>${esc(k > 0 ? x.name.slice(0, k) : x.name)}</span><small>${esc(k > 0 ? x.name.slice(k) : '')}</small></button></li>`; }).join('')}</ul>`;
}
/* link público: ?jogador=Nome#1234 abre a build dessa pessoa, sem precisar entrar */
const profSlug = name => { const m = /^(.*)#(\d{1,4})$/.exec(name || ''); return m ? encodeURIComponent(m[1]) + '-' + m[2].padStart(4, '0') : encodeURIComponent(name || ''); };
const playerLink = name => `${location.origin}/g/${profSlug(name)}`; // perfil público (o ?jogador= antigo continua funcionando)
const slugName = sl => { const t = decodeURIComponent(sl || ''); const m = /^(.*)-(\d{4})$/.exec(t); return m ? m[1] + '#' + m[2] : t; };
/* ---------- Perfil público /g/<nome>-<código>: tudo lido ao vivo da Bungie por quem abre (nada no banco) ---------- */
const PF = { sel: null, p: null, clan: '', fast: null, rec: null, seq: 0 };
async function openProfile(name) {
  const d = $('profdlg'), my = ++PF.seq; Object.assign(PF, { sel: null, p: null, clan: '', fast: null, rec: null, name });
  pfRender(); if (!d.open) d.showModal();
  try {
    const r = await searchPlayers(name); if (my !== PF.seq) return; if (r.length !== 1) { PF.err = 'notfound'; pfRender(); return; }
    PF.sel = r[0]; const { type: mt, id: mid } = PF.sel;
    const [p, g] = await Promise.all([bungie(`/Destiny2/${mt}/Profile/${mid}/?components=100,200,1100`, false), bungie(`/GroupV2/User/${mt}/${mid}/0/1/`, false).catch(() => null)]); if (my !== PF.seq) return;
    PF.p = p; PF.clan = g?.results?.[0]?.group?.name || ''; pfRender();
    // depois: melhor tempo de cada incursão/masmorra (estatísticas por personagem) e triunfos dos títulos
    const cids = Object.keys(p.characters?.data || {}), keys = actKeys();
    Promise.all(cids.map(c => bungie(`/Destiny2/${mt}/Account/${mid}/Character/${c}/Stats/AggregateActivityStats/`, false).catch(() => null))).then(rs => { if (my !== PF.seq) return; const f = {}; for (const r of rs) for (const a of r?.activities || []) { const k = keys[a.activityHash]; if (!k) continue; const ms = a.values?.fastestCompletionMsForActivity?.basic?.value || 0; const id = k.kind + ':' + k.k; if (ms > 0 && (!f[id] || ms < f[id])) f[id] = ms; } PF.fast = f; pfRender(); });
    bungie(`/Destiny2/${mt}/Profile/${mid}/?components=900`, false).then(r => { if (my !== PF.seq) return; PF.rec = { p: r.profileRecords?.data?.records || {}, c: r.characterRecords?.data || {} }; pfRender(); }).catch(() => { PF.rec = { p: {}, c: {} }; pfRender(); });
  } catch { if (my === PF.seq) { PF.err = 'error'; pfRender(); } }
}
function pfRender() {
  const d = $('profdlg'), W = u(), P = PF.p, sel = PF.sel, close = `<button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button>`;
  if (PF.err) { d.innerHTML = `<div class="pf-box">${close}<p class="pf-msg">${esc(PF.err === 'notfound' ? W.pfNotFound(PF.name) : W.pfErr)}</p></div>`; return; }
  if (!P) { d.innerHTML = `<div class="pf-box">${close}<p class="pf-msg wait">${esc(W.loadingDefs)}</p></div>`; return; }
  const chars = Object.entries(P.characters?.data || {}).sort((a, b) => new Date(b[1].dateLastPlayed) - new Date(a[1].dateLastPlayed)), main = chars[0]?.[1];
  const mt = P.metrics?.data?.metrics || {}, met = h => mt[h]?.objectiveProgress?.progress || 0;
  const acts = ACT_METRICS().map(([k, a]) => ({ k, a, c: met(a.m), f: PF.fast?.[k + ':' + a.k] || 0 }));
  const raids = acts.filter(x => x.k === 'raid').reduce((t, x) => t + x.c, 0), dgs = acts.filter(x => x.k === 'dg').reduce((t, x) => t + x.c, 0);
  const hours = Math.round(chars.reduce((t, [, c]) => t + (+c.minutesPlayedTotal || 0), 0) / 60);
  const rs = h => { if (!PF.rec) return null; let r = PF.rec.p[h]; if (!r) for (const c of Object.values(PF.rec.c)) if (c.records?.[h]) { r = c.records[h]; break; } return r; };
  const seals = PF.rec ? defs.seals.map(s => { const st = (s.r || []).map(([h]) => rs(h)).filter(Boolean), done = st.filter(x => !!(x.state & 1) || !(x.state & 4)).length; return { s, done, tot: st.length }; }).filter(x => x.tot) : [];
  const sealsDone = seals.filter(x => x.done === x.tot).length, topSeals = seals.slice().sort((a, b) => (b.done / b.tot) - (a.done / a.tot)).slice(0, 6);
  const titleSeal = main?.titleRecordHash && defs.seals.find(s => s.cr === main.titleRecordHash);
  const name = sel.name.replace(/#\d+$/, ''), code = (sel.name.match(/#\d+$/) || [''])[0], gr = P.profile?.data?.currentGuardianRank;
  const done = acts.filter(x => x.c > 0).sort((a, b) => (a.k === b.k ? 0 : a.k === 'raid' ? -1 : 1) || b.c - a.c), rest = acts.length - done.length;
  d.innerHTML = `<div class="pf-box">${close}
    <section class="pf-hero"${main?.emblemBackgroundPath ? ` style="--pf-bg:url('${BNET}${main.emblemBackgroundPath}')"` : ''}><div class="pf-hd">${main?.emblemPath ? `<img class="pf-em" src="${BNET}${main.emblemPath}" alt="">` : ''}<div class="pf-id"><small>${esc([PF.clan, gr ? W.pfRank(gr) : ''].filter(Boolean).join(' · '))}</small><h1>${esc(name)}<span>${esc(code)}</span></h1>${titleSeal ? `<span class="pf-title">${esc(L(titleSeal.t))}</span>` : ''}</div>
      <div class="pf-acts"><button type="button" class="pf-cmp">${esc(W.pfCmp)}</button><button type="button" class="pf-link">${esc(W.pfCopy)}</button></div></div>
      <div class="pf-chars">${chars.map(([cid, c]) => `<button type="button" class="pf-ch" data-pfc="${cid}"><span><b>${esc(u().classes[c.classType] || '')}</b><small>${esc(W.pfPlayed(new Date(c.dateLastPlayed).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })))}</small></span><b class="pf-l">✦ ${c.light}</b></button>`).join('')}</div></section>
    <div class="pf-kpi">${[[W.subs.raid, fmtN(raids), W.pfClears], [W.subs.dg, fmtN(dgs), W.pfClears], [W.subs.tit, PF.rec ? fmtN(sealsDone) : '…', W.pfSeals], [W.pfHours, fmtN(hours), W.pfAllChars]].map(([k, v, s]) => `<div><small>${esc(k)}</small><b>${v}</b><span>${esc(s)}</span></div>`).join('')}</div>
    <div class="pf-cols"><section class="pf-card pf-tb"><h2>${esc(W.pfActs)}</h2>${done.length ? `<table><thead><tr><th>${esc(W.pfAct)}</th><th>${esc(W.pfClearsH)}</th><th>${esc(W.pfFast)}</th></tr></thead><tbody>${done.map(x => `<tr><td><small>${esc(x.k === 'raid' ? W.w.raidW : W.w.dgW)}</small>${esc(L(x.a.n))}</td><td>${fmtN(x.c)}</td><td>${PF.fast ? (x.f ? fmtDur(x.f) : '—') : '…'}</td></tr>`).join('')}</tbody></table>` : `<p class="pf-msg">${esc(W.pfNone)}</p>`}${rest && done.length ? `<p class="pf-note">${esc(W.pfRest(rest))}</p>` : ''}</section>
      <aside class="pf-side"><section class="pf-card"><h2>${esc(W.subs.tit)}</h2>${!PF.rec ? `<p class="pf-msg wait">${esc(W.loadingDefs)}</p>` : topSeals.length ? topSeals.map(x => `<div class="pf-t${x.done === x.tot ? ' ok' : ''}"><div><b>${esc(L(x.s.t))}</b><span>${x.done}/${x.tot}</span></div><i><u style="width:${Math.round(x.done / x.tot * 100)}%"></u></i></div>`).join('') : `<p class="pf-msg">${esc(W.pfPriv)}</p>`}</section>
      <section class="pf-card"><h2>${esc(W.pfBuild)}</h2><p class="pf-note">${esc(W.pfBuildNote)}</p><button type="button" class="pf-build">${esc(W.pfBuildBtn)}</button></section></aside></div>
    <p class="pf-foot">${esc(W.pfFoot)}</p></div>`;
}
$('profdlg').addEventListener('click', e => {
  const d = $('profdlg');
  if (e.target === d || e.target.closest('.pf-x')) { d.close(); return; }
  if (e.target.closest('.pf-link') && PF.sel) { copyLink(PF.sel.name, e.target.closest('.pf-link')); return; }
  const ch = e.target.closest('[data-pfc]');
  if ((e.target.closest('.pf-build') || ch) && PF.sel) { d.close(); FD.q = ''; FD.results = null; openFind(); showPlayer(PF.sel); return; }
  if (e.target.closest('.pf-cmp') && PF.sel) { d.close(); if (!auth) { login(); return; } CMPG.sel = { mt: PF.sel.type, mid: PF.sel.id, n: PF.sel.name.replace(/#\d+$/, '') }; guardianMetrics(PF.sel.type, PF.sel.id).then(() => { if (isGd()) render(); }); go('gcl'); }
});
$('profdlg').addEventListener('close', () => { if (/^\/g\//.test(location.pathname)) history.replaceState(null, '', '/'); });
/* ---------- Build pública: link curto /b/<código> com a foto da build (guardada no servidor) ---------- */
const PUB_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.8 10h14.4M10 2.8c2.2 2 3.2 4.4 3.2 7.2s-1 5.2-3.2 7.2c-2.2-2-3.2-4.4-3.2-7.2s1-5.2 3.2-7.2z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
// um botão "Compartilhar" com as três formas: link fixo desta build, link do perfil (sempre a build atual) e imagem
const SHARE_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 12.5V3.2M6.6 6.4 10 3l3.4 3.4M4.5 10.5v5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function shareMenu(where, ready, profileLink) {
  const W = u(), item = (attrs, ic, t, d) => `<button type="button" role="menuitem" ${attrs}><span class="shr-ic">${ic}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span></button>`;
  return `<div class="shr"><button type="button" class="${where === 'fd' ? 'fd-ib' : 'b-link'} shr-b" aria-haspopup="menu" aria-expanded="false" title="${esc(W.shrT)}" aria-label="${esc(W.shrT)}">${SHARE_ICON}${where === 'fd' ? `<span>${esc(W.shrT)}</span>` : ''}</button><div class="shr-m" role="menu" hidden>
    ${auth && ready ? item(`data-pub="${where}"`, PUB_ICON, W.shrPub, W.shrPubD) : ''}
    ${profileLink ? item(`class="${where === 'fd' ? 'fd-link' : 'b-link'}"`, LINK_ICON, W.shrProf, W.shrProfD) : ''}
    ${ready ? item('class="b-cam"', CAM_ICON, W.shrImg, W.shrImgD) : ''}</div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.shr-b'), open = document.querySelectorAll('.shr-m:not([hidden])');
  open.forEach(m => { if (!b || m.previousElementSibling !== b) { m.hidden = true; m.previousElementSibling?.setAttribute('aria-expanded', 'false'); } });
  if (b) { const m = b.nextElementSibling; m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); e.stopPropagation(); return; }
  const it = e.target.closest('.shr-m button'); if (it) { const m = it.closest('.shr-m'); setTimeout(() => { m.hidden = true; m.previousElementSibling?.setAttribute('aria-expanded', 'false'); }, 0); }
}, true);
async function pubMeta(C) {
  const B = C.B, ch = C.p.characters.data[C.cid], eq = C.p.characterEquipment.data[C.cid].items, d = h => B?.loc?.[h] || B?.en?.[h] || {};
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), exo = eq.filter(i => d(i.itemHash).tt === 6 && GEAR_BUCKETS.includes(i.bucketHash));
  const name = String(C.name || '').replace(/#\d+$/, '').split(' · ')[0], title = `${charTitle(u().classes[ch.classType] || '', d(sub?.itemHash).n)} · ${name}`;
  if (!STATD) { try { STATD = { lang, d: await entities('DestinyStatDefinition', STAT_ORDER, lang) }; } catch {} }
  const st = statsOf(C), stTxt = st ? STAT_ORDER.map(h => `${STATD?.d?.[h]?.n || ''} ${st[h] || 0}`.trim()).join(' · ') : '';
  const desc = [ch.light ? '✦ ' + ch.light : '', exo.map(i => d(i.itemHash).n).filter(Boolean).join(' + '), stTxt].filter(Boolean).join(' · ');
  let img = ''; for (const i of exo) { try { const x = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${i.itemHash}/`, false); if (x.screenshot) { img = BNET + x.screenshot; break; } } catch {} }
  return { t: title, d: desc, img };
}
// prévia 1200×630: o topo da imagem da build (cabeçalho, atributos, subclasse e armas), feita aqui no navegador e guardada no servidor
async function pubPreview(C, code) {
  try {
    const out = await previewCard(C); if (!out) return;
    let q = 0.88, blob; do { blob = await new Promise(r => out.toBlob(r, 'image/jpeg', q)); q -= 0.12; } while (blob && blob.size > 440000 && q > 0.4);
    if (!blob) return;
    const r = await fetch(APIW + '/pubimg/' + code, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', Authorization: 'Bearer ' + await token(), 'X-API-Key': cfg.apiKey }, body: blob });
    return r.ok;
  } catch { return false; }
}
// cartão 1200×630: emblema, nome, classe/subclasse e luz; os 9 itens equipados (exóticos com borda dourada); os 6 atributos; os exóticos por nome
async function previewCard(C) {
  const B = C.B, ch = C.p.characters.data[C.cid]; if (!B || !ch) return null;
  try { await Promise.all(['700 40px Rajdhani', '500 20px "IBM Plex Sans"', '600 20px "IBM Plex Sans"', '500 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch {}
  const def = h => B.loc[h] || B.en[h] || {}, statDefs = await entities('DestinyStatDefinition', STAT_ORDER, lang).catch(() => ({}));
  const eq = (C.p.characterEquipment?.data?.[C.cid]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).sort((a, b) => GEAR_BUCKETS.indexOf(a.bucketHash) - GEAR_BUCKETS.indexOf(b.bucketHash));
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), [acc] = ELEMENT_ACC[ELEMENTS[B.en[sub?.itemHash]?.dt]] || ELEMENT_ACC.arc;
  const emDef = EMBLEMS[ch.emblemHash] || (EMBLEMS[ch.emblemHash] = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${ch.emblemHash}/`, false).catch(() => ({})));
  const [bg, emIc, ...icons] = await Promise.all([loadImg(ch.emblemBackgroundPath), loadImg(emDef.displayProperties?.icon), ...eq.map(i => loadImg(def(i.itemHash).ic))]);
  const stIc = await Promise.all(STAT_ORDER.map(h => loadImg(statDefs[h]?.ic)));
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630; const g = cv.getContext('2d');
  g.fillStyle = '#0d1219'; g.fillRect(0, 0, 1200, 630);
  if (bg) { g.globalAlpha = .55; g.drawImage(bg, 0, 0, 1200, 1200 * bg.height / bg.width); g.globalAlpha = 1; }
  const grd = g.createLinearGradient(0, 0, 0, 630); grd.addColorStop(0, 'rgba(13,18,25,.35)'); grd.addColorStop(.42, 'rgba(13,18,25,.92)'); grd.addColorStop(1, '#0d1219'); g.fillStyle = grd; g.fillRect(0, 0, 1200, 630);
  g.fillStyle = acc; g.fillRect(0, 0, 1200, 6);
  // cabeçalho
  if (emIc) g.drawImage(emIc, 56, 52, 112, 112);
  const title = charTitle(u().classes[ch.classType] || '', def(sub?.itemHash).n), name = String(C.name || '').replace(/#\d+$/, '').split(' · ')[0];
  g.fillStyle = '#9fb0c2'; g.font = '500 22px "IBM Plex Mono"'; g.fillText(name.toUpperCase(), 192, 86);
  g.fillStyle = '#ffffff'; g.font = '700 64px Rajdhani'; g.fillText(title, 190, 148);
  g.textAlign = 'right'; g.fillStyle = '#f2d36b'; g.font = '700 64px Rajdhani'; g.fillText('✦ ' + (ch.light || ''), 1144, 130); g.textAlign = 'left';
  // itens equipados
  const S = 96, gap = 18, x0 = (1200 - (eq.length * S + (eq.length - 1) * gap)) / 2, y0 = 228;
  eq.forEach((i, k) => { const x = x0 + k * (S + gap), exo = def(i.itemHash).tt === 6; g.fillStyle = '#18222e'; g.fillRect(x, y0, S, S); if (icons[k]) g.drawImage(icons[k], x, y0, S, S); g.lineWidth = exo ? 4 : 2; g.strokeStyle = exo ? '#e8c06a' : 'rgba(255,255,255,.22)'; g.strokeRect(x + g.lineWidth / 2, y0 + g.lineWidth / 2, S - g.lineWidth, S - g.lineWidth); });
  // exóticos por nome
  const ex = eq.filter(i => def(i.itemHash).tt === 6 && i.bucketHash !== SUB_BUCKET).map(i => def(i.itemHash).n).filter(Boolean);
  if (ex.length) { g.textAlign = 'center'; g.fillStyle = '#e8c06a'; g.font = '600 26px "IBM Plex Sans"'; g.fillText(ex.join('  ·  '), 600, 372); g.textAlign = 'left'; }
  // atributos
  const st = statsOf(C);
  if (st) { const cw = 172, sx = (1200 - cw * 6 - 12 * 5) / 2; STAT_ORDER.forEach((h, k) => { const x = sx + k * (cw + 12), y = 418, v = st[h] || 0; g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, y, cw, 112); if (stIc[k]) g.drawImage(stIc[k], x + 16, y + 18, 34, 34); g.fillStyle = v > 100 ? '#f2d36b' : '#ffffff'; g.font = '700 46px Rajdhani'; g.fillText(String(v), x + 60, y + 52); g.fillStyle = '#9fb0c2'; g.font = '500 19px "IBM Plex Sans"'; g.fillText((statDefs[h]?.n || '').slice(0, 14), x + 16, y + 88); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 16, y + 98, cw - 32, 5); g.fillStyle = acc; g.fillRect(x + 16, y + 98, (cw - 32) * Math.min(1, v / 200), 5); }); }
  g.fillStyle = '#6f8091'; g.font = '500 18px "IBM Plex Mono"'; g.textAlign = 'right'; g.fillText('DPI · destinyparallel.vercel.app', 1144, 600); g.textAlign = 'left';
  return cv;
}
async function sharePub(C, item) {
  if (!C?.p || !C.B || !APIW) return; const W = u(), btn = item.closest('.shr')?.querySelector('.shr-b') || item;
  btn.disabled = true; btn.dataset.tip = W.pubWait;
  try {
    const snap = snapBuild(C, ''); snap.og = await pubMeta(C); snap.title = snap.og.t;
    const r = await fetch(APIW + '/pub', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token(), 'X-API-Key': cfg.apiKey }, body: JSON.stringify({ sig: String(C.name).replace(/#\d+$/, '') + '|' + C.cid + '|' + buildSig(C), snap }) });
    const j = await r.json(); if (!j.c) throw new Error(j.error || 'erro');
    const url = location.origin + '/b/' + j.c;
    // a imagem da prévia precisa existir antes de o link ser colado (o Discord lê uma vez e guarda); espera até 10 s
    btn.dataset.tip = W.pubImg; await Promise.race([pubPreview(C, j.c), new Promise(r => setTimeout(r, 10000))]);
    try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: snap.og.t, url }); btn.disabled = false; delete btn.dataset.tip; return; } } catch (e) { if (e?.name === 'AbortError') { btn.disabled = false; delete btn.dataset.tip; return; } }
    try { await navigator.clipboard.writeText(url); btn.dataset.tip = j.replaced ? W.pubRepl(j.replaced) : W.pubOk + (j.n ? ` · ${j.n}/${j.max}` : ''); } catch { prompt('', url); }
    btn.classList.add('ok');
  } catch { btn.dataset.tip = W.pubErr; }
  setTimeout(() => { btn.disabled = false; btn.classList.remove('ok'); delete btn.dataset.tip; }, 2200);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pub]'); if (!b) return; e.stopPropagation(); sharePub(b.dataset.pub === 'fd' ? fdCtx() : ownCtx(), b); }, true);
// quem abre /b/<código>: mostra a build guardada por cima do site (com login dá para comparar com a sua)
async function openPub() {
  const m = /^\/b\/([A-Za-z0-9]{6})\/?$/.exec(location.pathname); if (!m || !APIW) return;
  try {
    const j = await fetch(APIW + '/pub/' + m[1]).then(r => r.ok ? r.json() : null); if (!j?.snap) throw 0;
    FD.q = ''; FD.results = null; openSnap(j.snap, j.snap.title || j.snap.og?.t);
    const d = $('finddlg'); d.classList.add('pubview'); d.addEventListener('close', () => { d.classList.remove('pubview'); if (/^\/b\//.test(location.pathname)) history.replaceState(null, '', '/'); }, { once: true });
  } catch { history.replaceState(null, '', '/'); }
}
async function copyLink(name, btn) {
  btn = btn?.closest?.('.shr')?.querySelector('.shr-b') || btn;
  const url = playerLink(name);
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: name + ' · DPI', url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); } catch { prompt('', url); return; }
  if (btn) { btn.classList.add('ok'); btn.dataset.tip = u().w.linkOk; setTimeout(() => { btn.classList.remove('ok'); delete btn.dataset.tip; }, 1600); }
}
/* aba Loadouts: cada loadout como um cartão da build */
let ldBusy = false;
async function ensureLdCtx() {
  // só busca (e redesenha) se faltar algum; sem isso o desenho chamaria a busca de novo sem fim
  const miss = LOADOUTS.filter(l => !LDCTX[charId + ':' + l.i + ':' + lang]); if (ldBusy || !miss.length) return;
  ldBusy = true; const my = gen; let t = null;
  // cada loadout aparece assim que fica pronto, sem esperar os outros
  await Promise.all(miss.map(l => getLdCtx(l.i).then(() => { if (my === gen && tab === 'ld' && !t) t = setTimeout(() => { t = null; render(); }, 120); })));
  ldBusy = false;
}
let SVDEL = null;
function ldListHTML() {
  const W = u().w;
  const ok = member && lbAllowed(), T = lw(), mine = ok ? savedList().map((x, i) => ({ x, i })).filter(o => o.x.cid === charId) : [];
  const site = ok ? `<div class="ld-sec"><h3>${esc(T.onSite)} <small>${mine.length}</small></h3><p>${esc(T.onSiteN)}</p></div><div class="ld-grid">` + mine.map(({ x, i }) => `<div class="ld ldc ld-site"><div class="ldc-top"><div class="ldc-t"><small><span class="ld-tag site">${esc(T.onSite.replace(/^Criados no |^Made on the /, ''))}</span> ${esc(W.savedOn(new Date(x.at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit' })))}</small><h2>${esc(x.title || x.t)}</h2></div></div><div class="ld-acts"><button type="button" class="lbd-btn" data-sv="${i}">${esc(T.see)}</button>${wBtn(`data-svap="${i}"`)}${wBtn(`data-svgame="${i}"`, T.toGame)}<button type="button" class="lbd-btn ld-del${SVDEL === x.k ? ' on' : ''}" data-svdel="${i}" aria-label="${esc(T.del)}">${SVDEL === x.k ? esc(T.delQ) : '✕ ' + esc(T.del)}</button></div></div>`).join('') + '</div>' : '';
  return `<div class="ld-wrap"><p class="ld-intro">${esc(W.ldNote)}</p>${member && lbAllowed() ? `<div class="ld-short"><button type="button" class="lb-run" data-lbopen="man">＋ ${esc(lw().ldShort)}</button><small class="lb-beta">beta</small></div>` : ''}${ok ? `<div class="ld-sec"><h3>${esc(T.inGame)} <small>${LOADOUTS.length}</small></h3></div>` : ''}<div class="ld-grid">` + LOADOUTS.map(l => {
    const C = LDCTX[charId + ':' + l.i + ':' + lang], B = C?.B;
    if (!B) return `<button type="button" class="ld ldc" data-ldo="${l.i}"><div class="ld-head"><h2>${esc(l.name)}</h2></div><p class="ld-idea wait" role="status">${esc(u().loadingDefs)}</p></button>`;
    const eq = C.p.characterEquipment.data[C.cid].items, sub = eq.find(i => i.bucketHash === SUB_BUCKET), d = h => B.loc[h] || B.en[h] || {};
    const el = ELEMENTS[B.en[sub?.itemHash]?.dt] || 'arc', [a1] = ELEMENT_ACC[el] || ELEMENT_ACC.arc;
    const ws = WEAPON_B.map(b => eq.find(i => i.bucketHash === b)).filter(Boolean), xa = eq.find(i => ARMOR_B.includes(i.bucketHash) && B.en[i.itemHash]?.tt === 6);
    const ic = (i, cls = '') => { const x = d(i.itemHash); return `<span class="ldc-i ${cls}${B.en[i.itemHash]?.tt === 6 ? ' ex' : ''}" title="${esc(x.n || '')}">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}</span>`; };
    const same = buildSig(C) === buildSig(ownCtx());
    return `<button type="button" class="ld ldc" data-ldo="${l.i}" style="--el:${a1}"><div class="ldc-top">${sub ? ic(sub, 'ldc-sub') : ''}<div class="ldc-t"><small><span class="ld-tag game">${esc(lw().inGame)}</span> ${esc(l.name)}${same ? ` · <b>${esc(W.ldEq)}</b>` : ''}</small><h2>${esc(charTitle(u().classes[C.p.characters.data[C.cid].classType] || '', d(sub?.itemHash).n))}</h2></div><span class="chev" aria-hidden="true"></span></div>
      <div class="ldc-g">${ws.map(i => ic(i)).join('')}${xa ? ic(xa) : ''}<span class="ldc-n">${esc([...ws, xa].filter(Boolean).filter(i => B.en[i.itemHash]?.tt === 6).map(i => d(i.itemHash).n).join(' · '))}</span></div></button>`;
  }).join('') + '</div>' + site + '</div>';
}
/* builds salvas: uma cópia do equipamento daquele momento, guardada neste navegador */
const savedList = () => LS.get('dc-builds', []);
function buildSig(C) { const eq = C.p?.characterEquipment?.data?.[C.cid]?.items || []; return [C.p?.characters?.data?.[C.cid]?.classType, ...eq.filter(i => i.bucketHash === SUB_BUCKET || WEAPON_B.includes(i.bucketHash) || ARMOR_B.includes(i.bucketHash)).map(i => i.itemHash)].join('.'); }
const savedKey = C => { if (!C?.p || !C.B) return null; const k = C.k || String(C.name).replace(/#\d+$/, '') + '|' + buildSig(C); return savedList().some(x => x.k === k) ? k : null; };
// cópia da build como está agora (mesmo formato das builds salvas): serve para salvar e para as metas
function snapBuild(C, k) {
  const ch = C.p.characters.data[C.cid], eq = C.p.characterEquipment.data[C.cid].items, sk = C.p.itemComponents?.sockets?.data || {}, ins = C.p.itemComponents?.instances?.data || {};
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), so = {}, io = {};
  for (const it of eq) { if (sk[it.itemInstanceId]) so[it.itemInstanceId] = sk[it.itemInstanceId]; if (ins[it.itemInstanceId]) io[it.itemInstanceId] = { primaryStat: ins[it.itemInstanceId].primaryStat }; }
  const c = { characterId: C.cid, classType: ch.classType, raceType: ch.raceType, light: ch.light, emblemHash: ch.emblemHash, emblemPath: ch.emblemPath, emblemBackgroundPath: ch.emblemBackgroundPath, stats: ch.stats };
  return { k, name: String(C.name).replace(/#\d+$/, ''), t: charTitle(u().classes[ch.classType] || '', C.B?.loc?.[sub?.itemHash]?.n), at: Date.now(), cid: C.cid, p: { characters: { data: { [C.cid]: c } }, characterEquipment: { data: { [C.cid]: { items: eq } } }, itemComponents: { sockets: { data: so }, instances: { data: io } } } };
}
function openSnap(x, title) {
  const note = u().w.savedOn(new Date(x.at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit' }));
  openCtx({ name: title || (x.title ? `${x.name} · ${x.title}` : x.name), note, k: x.k }, { p: x.p, cid: x.cid, B: null });
  (async () => { const my = FD.seq, B = await fetchBuild(x.p, x.cid, b => { if (my === FD.seq) { FD.B = b; renderFind(); } }); if (my === FD.seq) { FD.B = B; renderFind(); } })();
}
function toggleSaved(C) {
  if (!C?.p || !C.B) return;
  const l = savedList(), k = C.k || String(C.name).replace(/#\d+$/, '') + '|' + buildSig(C), i = l.findIndex(x => x.k === k);
  if (i >= 0) l.splice(i, 1);
  else l.unshift(snapBuild(C, k));
  try { LS.set('dc-builds', l.slice(0, 30)); } catch {}
  if (isGd()) render();
}
// abre uma build qualquer (loadout ou salva) no mesmo visualizador da busca
function openCtx(sel, C) { FD.seq++; FD.cmp = false; FD.src = -1; FD.sel = sel; FD.p = C.p; FD.cid = C.cid; FD.B = C.B; FD.status = ''; openFind(); }
async function openSaved(i) {
  const x = savedList()[i]; if (!x) return; openSnap(x);
}
async function openLoadout(i) {
  const C = await getLdCtx(i); if (!C) return;
  openCtx({ name: `${(member?.name || '').replace(/#\d+$/, '')} · ${C.name}`, note: 'Loadout', ld: i, ldn: C.name }, { ...C, name: C.name });
}
async function getLdCtx(i) { const k = charId + ':' + i + ':' + lang; try { await loadLdCtx(i); } catch {} if (!LDCTX[k]) LDCTX[k] = { p: null, B: null, name: '' }; return LDCTX[k].B ? LDCTX[k] : null; }
/* comparar com um dos seus loadouts salvos no jogo, além da build equipada */
const LDCTX = {};
function cmpSrcHTML() {
  const W = u().w, ls = profile.characterLoadouts?.data?.[charId]?.loadouts || [];
  const opts = ls.map((l, i) => [i, l]).filter(([, l]) => (l.items || []).some(x => x.itemInstanceId && x.itemInstanceId !== '0'));
  const sv = savedList().filter(x => x.k !== savedKey(fdCtx()));
  if (!opts.length && !sv.length) return '';
  const cur = FD.src ?? -1, nm = (l, i) => loadoutNames[l.nameHash]?.n || `Loadout ${i + 1}`;
  return `<div class="fd-src"><span class="fd-act-k">${esc(W.cmpWith)}</span><div class="fd-src-l"><button type="button" class="char" data-src="-1" aria-pressed="${cur === -1}">${esc(W.equippedNow)}</button>${opts.map(([i, l]) => `<button type="button" class="char" data-src="${i}" aria-pressed="${cur === i}">${esc(nm(l, i))}</button>`).join('')}${sv.map(x => `<button type="button" class="char sv-src" data-src="s:${esc(x.k)}" aria-pressed="${cur === 's:' + x.k}" title="${esc(u().w.savedT)}">${SAVE_ICON(true)}${esc(x.title || x.t)}</button>`).join('')}</div></div>`;
}
const SVCTX = {};
function cmpMine() {
  const s = FD.src ?? -1;
  if (typeof s === 'string') { // build salva
    const x = savedList().find(y => 's:' + y.k === s); if (!x) return ownCtx();
    const key = s + ':' + lang, c = SVCTX[key];
    if (!c) { SVCTX[key] = { pending: true }; fetchBuild(x.p, x.cid).then(B => { SVCTX[key] = { p: x.p, cid: x.cid, B, name: x.title || x.name }; if (FD.cmp && FD.src === s) { renderFind(); loadCmpOwnership(); } }); return null; }
    return c.B ? c : null;
  }
  if (s < 0) return ownCtx(); const c = LDCTX[charId + ':' + s + ':' + lang]; if (!c && !FD.ldErr && FD.ldBusy !== s) { FD.ldBusy = s; loadLdCtx(s).catch(() => { FD.ldErr = true; }).then(() => { FD.ldBusy = null; if (FD.cmp && FD.src === s) { renderFind(); loadCmpOwnership(); } }); } return c && c.B ? c : null; }
async function loadLdCtx(i) {
  const key = charId + ':' + i + ':' + lang; FD.ldErr = false;
  if (LDCTX[key]) return;
  const l = profile.characterLoadouts?.data?.[charId]?.loadouts?.[i]; if (!l) return;
  const all = {}; const add = (items, own) => { for (const it of items || []) if (it.itemInstanceId) all[it.itemInstanceId] = it; };
  add(profile.profileInventory?.data?.items); for (const v of Object.values(profile.characterInventories?.data || {})) add(v.items); for (const v of Object.values(profile.characterEquipment?.data || {})) add(v.items);
  const ORDER = [SUB_BUCKET, ...WEAPON_B, ...ARMOR_B], picked = [];
  (l.items || []).forEach((x, k) => { const it = all[x.itemInstanceId]; if (it) picked.push({ it, k, plugs: x.plugItemHashes || [] }); });
  if (!picked.length) { FD.ldErr = true; LDCTX[key] = { p: null, B: null, name: '' }; return; }
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
  const p = { ld: 1, characters: { data: { [charId]: profile.characters.data[charId] } }, characterEquipment: { data: { [charId]: { items } } }, itemComponents: { sockets: { data: sockets }, instances: profile.itemComponents?.instances } };
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
    if (FD.cid) { const B = await fetchBuild(p, FD.cid, b => { if (my === FD.seq) { FD.B = b; renderFind(); } }); if (my === FD.seq) { FD.B = B; renderFind(); touchFav(); } }
  } catch { if (my !== FD.seq) return; FD.status = ''; FD.p = {}; renderFind(); }
}
async function pickFdChar(cid) {
  const my = ++FD.seq; FD.cmp = false; FD.cid = cid; FD.B = null; renderFind();
  const b = await fetchBuild(FD.p, cid, x => { if (my === FD.seq) { FD.B = x; renderFind(); } }); if (my === FD.seq) { FD.B = b; renderFind(); }
}
$('finddlg').addEventListener('input', e => {
  const sv = e.target.closest('.fd-sv');
  if (sv) { sv.dataset.dirty = '1'; const b = sv.querySelector('.fd-svok'); b.disabled = false; b.textContent = u().w.svSave; sv.querySelector('.fd-svs').textContent = u().w.svDirty; return; }
  if (e.target.id !== 'fdq') return; FD.q = e.target.value.trim(); clearTimeout(fdTimer); fdTimer = setTimeout(() => doSearch(FD.q), 600); });
$('finddlg').addEventListener('cancel', () => commitSv($('finddlg').querySelector('.fd-sv[data-dirty]')));
$('finddlg').addEventListener('keydown', e => { if (e.target.id === 'fdq' && e.key === 'Enter') { clearTimeout(fdTimer); doSearch(FD.q); } });
$('finddlg').addEventListener('click', e => {
  const d = $('finddlg');
  if (e.target === d || e.target.closest('.fd-x')) { commitSv(d.querySelector('.fd-sv[data-dirty]')); d.close(); return; }
  if (e.target.closest('.fd-back')) { if (FD.cmp) { FD.cmp = false; renderFind(); return; } FD.sel = null; FD.seq++; renderFind(); return; }
  if (e.target.closest('.fd-cmpbtn')) { if (FD.cmp) { FD.cmp = false; renderFind(); return; } if (!BUILD && have.g) loadBuild(gen); FD.cmp = true; renderFind(); loadCmpOwnership(); $('finddlg').querySelector('.fd-box').scrollTop = 0; return; }
  if (e.target.closest('.fd-fav')) { toggleFav(FD.sel); renderFind(); return; }
  if (e.target.closest('.fd-svok')) { commitSv(e.target.closest('.fd-sv'), true); return; }
  if (e.target.closest('.fd-save')) { toggleSaved(fdCtx()); renderFind(); return; }
  const lk = e.target.closest('.fd-link'); if (lk) { copyLink(FD.sel.name, lk); return; }
  const sr = e.target.closest('[data-src]'); if (sr) { const v = sr.dataset.src; FD.src = v.startsWith('s:') ? v : +v; FD.ldErr = false; renderFind(); return; }
  const fv = e.target.closest('[data-fdv]'); if (fv) { const x = favs()[+fv.dataset.fdv]; if (x) showPlayer(x); return; }
  const r = e.target.closest('[data-fdr]'); if (r) { const x = FD.results[+r.dataset.fdr]; if (x) showPlayer(x); return; }
  const c = e.target.closest('[data-fdc]'); if (c && c.dataset.fdc !== FD.cid) { pickFdChar(c.dataset.fdc); return; }
  if (e.target.closest('.b-cam')) openShare(fdCtx());
});
$('list').addEventListener('click', e => { const sv = e.target.closest('[data-sv]'); if (sv) { openSaved(+sv.dataset.sv); return; } const lo = e.target.closest('[data-ldo]'); if (lo) { openLoadout(+lo.dataset.ldo); return; } const b = e.target.closest('.cl-p'); if (b && b.dataset.mid) { FD.q = ''; FD.results = null; openFind({ name: b.dataset.name, type: +b.dataset.mt, id: b.dataset.mid }); } });


/* ---------- comparar builds e levar para o DIM ---------- */
const CLOSE_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CAM_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
const CMP_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M16 7H4M4 7l3-3M4 7l3 3M4 13h12M16 13l-3-3M16 13l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR_ICON = on => `<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M10 2.6l2.3 4.7 5.1.7-3.7 3.6.9 5.1L10 14.3l-4.6 2.4.9-5.1L2.6 8l5.1-.7z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const SAVE_ICON = on => `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 3h9a1 1 0 0 1 1 1v13l-5.5-3.6L4.5 17V4a1 1 0 0 1 1-1z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const LINK_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5L10 5.5M11.5 8.5a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5L10 14.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EXPORT_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M8 4H4v12h12v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WEAPON_B = [1498876634, 2465295065, 953998645], ARMOR_B = [3448274439, 3551918588, 14239492, 20886954, 1585787867];
function buildParts(C) {
  const B = C.B, eq = C.p.characterEquipment?.data?.[C.cid]?.items || [], sk = C.p.itemComponents?.sockets?.data || {};
  const plugs = i => (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => pShow(B.en[h]));
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), ps = sub ? plugs(sub) : [], t = h => pKind(B.en[h]);
  return {
    sub: sub?.itemHash, sup: ps.filter(h => t(h) === 'sup'), asp: ps.filter(h => t(h) === 'asp'), fr: ps.filter(h => t(h) === 'fr'),
    ab: ps.filter(h => !t(h)),
    w: WEAPON_B.map(b => eq.find(i => i.bucketHash === b)?.itemHash || 0),
    xa: eq.filter(i => ARMOR_B.includes(i.bucketHash)).map(i => i.itemHash).find(h => B.en[h]?.tt === 6) || 0,
    arm: ARMOR_B.map(b => eq.find(i => i.bucketHash === b)?.itemHash || 0),
    sets: (B.sets || []).map(s => s.n + ' · ' + s.count),
    art: B.art?.perks || [],
  };
}
// Algo da build do outro que você também pode usar: aspectos/fragmentos/habilidades pelos seus conjuntos de encaixes; armas e armaduras pela sua coleção
// conjuntos de encaixes da sua conta (aspectos, fragmentos, habilidades, vantagens de artefato)
let PLUGS = null, plugsP = null;
function loadPlugs() {
  // vêm com o componente de encaixes (305); busca uma vez, só quando a comparação precisa
  if (PLUGS || plugsP || !member) return plugsP;
  plugsP = bungie(`/Destiny2/${member.type}/Profile/${member.id}/?components=305`).then(r => { PLUGS = { p: r.profilePlugSets?.data?.plugs || {}, c: r.characterPlugSets?.data || {} }; if (FD.cmp) renderFind(); }).catch(() => { plugsP = null; });
  return plugsP;
}
function iOwnPlug(h) {
  if (!PLUGS) loadPlugs();
  if (!PLUGS) return null;
  const has = list => (list || []).some(p => p.plugItemHash === h && p.canInsert !== false);
  for (const list of Object.values(PLUGS.p)) if (has(list)) return true;
  for (const c of Object.values(PLUGS.c)) for (const list of Object.values(c.plugs || {})) if (has(list)) return true;
  return false;
}
function iOwnSub(h) {
  if (!h || !profile) return null;
  const lists = [...Object.values(profile.characterEquipment?.data || {}), ...Object.values(profile.characterInventories?.data || {})];
  return lists.some(c => (c.items || []).some(i => i.itemHash === h));
}
function iOwnItem(h) { const c = COLL[h]; if (c === undefined) return null; return c ? colAcquired([c]) : null; }
async function loadCmpOwnership() {
  loadPlugs();
  const P = buildParts(fdCtx()), need = [...P.w, ...P.arm].filter(h => h && COLL[h] === undefined);
  if (!need.length) return;
  await Promise.all(need.map(h => idef(h).then(d => { COLL[h] = d.c; })));
  if (FD.cmp) renderFind();
}
function compareHTML(A, Bc) {
  const W = u().w, a = buildParts(A), b = buildParts(Bc);
  const nmA = h => A.B.loc[h]?.n || A.B.en[h]?.n || '', nmB = h => Bc.B.loc[h]?.n || Bc.B.en[h]?.n || '';
  const icA = h => A.B.loc[h]?.ic || A.B.en[h]?.ic, icB = h => Bc.B.loc[h]?.ic || Bc.B.en[h]?.ic;
  const cell = (h, nm, ic, cls) => h ? `<span class="${cls}">${ic(h) ? `<img src="${BNET}${ic(h)}" alt="" loading="lazy">` : ''}${esc(nm(h))}</span>` : `<span class="${cls} none">—</span>`;
  // super: vem com a própria subclasse (não fica nos conjuntos de encaixes) → tem se você tem a mesma subclasse
  const own = (h, kind) => { if (kind === 'na') return ''; const o = kind === 'sup' ? iOwnSub(b.sub) : kind === 'plug' ? iOwnPlug(h) : iOwnItem(h); return o === true ? 'have' : o === false ? 'miss' : 'unk'; };
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
    ${(() => { const sa = statsOf(A), sb = statsOf(Bc); if (!sa || !sb) return ''; loadStats(); const D = STATD?.d || {};
      return grp(u().statsT, `<div class="cmp-st">${STAT_ORDER.map(h => { const x = sa[h] || 0, y = sb[h] || 0, df = y - x; return `<div><span class="cs-n">${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}${esc(D[h]?.n || '')}</span><b class="${x > 100 ? 'hi' : ''}">${x}</b><b class="${y > 100 ? 'hi' : ''}">${y}</b><small class="${df > 0 ? 'up' : df < 0 ? 'dn' : ''}">${df > 0 ? '+' + df : df || '='}</small></div>`; }).join('')}</div>`); })()}
    ${grp('Super', row(a.sup[0], b.sup[0], 'sup'))}
    ${grp(W.abilities, pairs(a.ab, b.ab).map(([x, y]) => row(x, y, 'plug')).join(''))}
    ${grp(W.aspects, pairs(a.asp, b.asp).map(([x, y]) => row(x, y, 'plug')).join(''))}
    ${grp(W.frags, pairs(a.fr, b.fr).map(([x, y]) => row(x, y, 'plug')).join(''))}
    ${grp(W.weapons, a.w.map((h, k) => row(h, b.w[k], 'item', exW(A, h), exW(Bc, b.w[k]))).join(''))}
    ${grp(W.armorCmp, a.arm.map((h, k) => row(h, b.arm[k], 'item', exW(A, h), exW(Bc, b.arm[k]))).join(''))}
    ${a.art.length || b.art.length ? grp(W.artT, pairs(a.art, b.art).map(([x, y]) => row(x, y, 'plug')).join('')) : ''}
    ${a.sets.length || b.sets.length ? grp(W.setT, `<div class="cmp-row ${a.sets.join() === b.sets.join() ? 'same' : 'diff'}"><span class="mine">${esc(a.sets.join(', ') || '—')}</span><span class="theirs">${esc(b.sets.join(', ') || '—')}</span></div>`) : ''}
    ${FX ? goalCta(A, Bc) : ''}
    <p class="cmp-leg"><span class="li"><span class="lg have"></span>${esc(W.lgHave)}</span><span class="li"><span class="lg miss"></span>${esc(W.lgMiss)}</span><span class="li"><span class="lg same">=</span>${esc(W.lgSame)}</span></p></div>`;
}
function dimLink(C) {
  const eq = C.p.characterEquipment?.data?.[C.cid]?.items || [], sk = C.p.itemComponents?.sockets?.data || {}, ch = C.p.characters.data[C.cid], B = C.B;
  const equipped = [], mods = [];
  for (const i of eq) {
    if (i.bucketHash === SUB_BUCKET) { const so = {}; (sk[i.itemInstanceId]?.sockets || []).forEach((s, k) => { if (s.plugHash && s.isVisible !== false && !SKIP_NAME.test(B.en[s.plugHash]?.n || '') && !SKIP_PT.test(B.en[s.plugHash]?.n || '')) so[k] = s.plugHash; }); equipped.push({ hash: i.itemHash, socketOverrides: so }); }
    else if (WEAPON_B.includes(i.bucketHash)) equipped.push({ hash: i.itemHash });
    else if (ARMOR_B.includes(i.bucketHash)) { equipped.push({ hash: i.itemHash }); for (const s of sk[i.itemInstanceId]?.sockets || []) { const e = B.en[s.plugHash]; if (s.plugHash && e && pArmorMod(e) && pShow(e)) mods.push(s.plugHash); } }
  }
  const sn = B.loc[eq.find(i => i.bucketHash === SUB_BUCKET)?.itemHash]?.n;
  const lo = { name: `${String(C.name).replace(/#\d+$/, '')} · ${charTitle(u().classes[ch.classType] || '', sn)}`, classType: ch.classType, clearSpace: false, equipped, unequipped: [], parameters: { mods } };
  return 'https://app.destinyitemmanager.com/loadouts?loadout=' + encodeURIComponent(JSON.stringify(lo));
}


/* ---------- histórico de incursões e masmorras (tempo mais rápido, primeira conclusão, com quem) ---------- */
const actKeys = () => { const m = {}; for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) for (const a of list) for (const h of a.ah || []) m[h] = { kind, k: a.k }; return m; };
const normN = s => String(s || '').toLowerCase().replace(/^(the|o|a)\s+/, '').replace(/["“”]/g, '');
// atividade → incursão/masmorra: primeiro pela lista conhecida, depois pelo nome em inglês
async function mapActs(hashes, modeOf) {
  const known = actKeys(), out = {}, rest = [];
  for (const h of hashes) if (known[h]) out[h] = known[h]; else rest.push(h);
  if (rest.length) {
    const en = await entities('DestinyActivityDefinition', rest, 'en');
    for (const h of rest) {
      const n = normN(en[h]?.n), md = modeOf?.(h);
      for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) {
        if (md && ((kind === 'raid' && md === 82) || (kind === 'dg' && md === 4))) continue;
        const a = list.find(x => n && n.startsWith(normN(x.n[0]))); if (a) { out[h] = { kind, k: a.k }; break; }
      }
    }
  }
  return out;
}
let ACTH = null, acthBusy = false;
const PGA = LS.get('dc-pgcrA', {});
async function pgcrTeam(id) {
  if (PGA[id]) return PGA[id];
  try {
    const j = await fetch(`https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${id}/`, { headers: { 'X-API-Key': cfg.apiKey } }).then(r => r.json());
    if (j.ErrorCode !== 1) return null; const r = j.Response, v = (e, k) => e?.values?.[k]?.basic?.value;
    const me = r.entries.find(e => e.player?.destinyUserInfo?.membershipId === member.id), fid = v(me, 'fireteamId');
    const team = r.entries.filter(e => e !== me && fid != null && v(e, 'fireteamId') === fid).map(e => e.player?.destinyUserInfo?.bungieGlobalDisplayName || e.player?.destinyUserInfo?.displayName).filter(Boolean);
    PGA[id] = { team: [...new Set(team)], fs: r.activityWasStartedFromBeginning !== false };
    try { LS.set('dc-pgcrA', PGA); } catch {}
    return PGA[id];
  } catch { return null; }
}
async function loadActHist() {
  if (acthBusy || !member) return; const key = 'dc-acth-' + member.id, cached = LS.get(key, null);
  if (!ACTH && cached) ACTH = cached;
  if (ACTH && ACTH.x && (!FX || Object.values(ACTH.d || {}).some(o => o.top)) && Date.now() - ACTH.t < 1800000) return;
  acthBusy = true; const mid = member.id;
  try {
    const chars = Object.keys(profile.characters?.data || {});
    const agg = (await Promise.all(chars.map(c => bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${c}/Stats/AggregateActivityStats/`, false).then(r => r.activities || []).catch(() => [])))).flat();
    const runs = (await Promise.all(chars.flatMap(c => [82, 4].map(m => bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${c}/Stats/Activities/?count=250&mode=${m}`, false).then(r => (r.activities || []).map(a => ({ ...a, _m: m }))).catch(() => []))))).flat();
    const modeOf = {}; for (const r of runs) modeOf[r.activityDetails.directorActivityHash || r.activityDetails.referenceId] = r._m;
    // só as atividades que são incursão/masmorra: as da lista conhecida e as que aparecem no histórico desses modos
    const map = await mapActs([...new Set(Object.keys(modeOf).map(Number))], h => modeOf[h]); Object.assign(map, actKeys(), map);
    const D = {}, get = k => (D[k] = D[k] || { c: 0, fast: 0, k: 0, d: 0, tries: 0, first: null, fastRun: null });
    const XMAP = {}; for (const m of defs.xmissions || []) for (const h of m.ah) XMAP[h] = m.k;
    const XD = {}; for (const a of agg) { const k = XMAP[a.activityHash]; if (!k) continue; const v = x => a.values?.[x]?.basic?.value || 0, o = (XD[k] = XD[k] || { c: 0, fast: 0, k: 0, d: 0 }); o.c += v('activityCompletions'); o.k += v('activityKills'); o.d += v('activityDeaths'); const f = v('fastestCompletionMsForActivity'); if (f > 0 && v('activityCompletions') > 0 && (!o.fast || f < o.fast)) o.fast = f; }
    for (const a of agg) { const m = map[a.activityHash]; if (!m) continue; const v = x => a.values?.[x]?.basic?.value || 0, o = get(m.k); o.c += v('activityCompletions'); o.k += v('activityKills'); o.d += v('activityDeaths'); const f = v('fastestCompletionMsForActivity'); if (f > 0 && (!o.fast || f < o.fast)) o.fast = f; }
    for (const r of runs) {
      const m = map[r.activityDetails.directorActivityHash || r.activityDetails.referenceId]; if (!m) continue; const o = get(m.k); o.tries++;
      if (r.values?.completed?.basic?.value === 1 && r.values?.completionReason?.basic?.value !== 2) {
        const t = Date.parse(r.period), dur = r.values?.activityDurationSeconds?.basic?.value || 0;
        if (!o.first || t < o.first.t) o.first = { t, id: r.activityDetails.instanceId };
        if (!o.fastRun || dur < o.fastRun.dur) o.fastRun = { dur, id: r.activityDetails.instanceId };
        o.top = (o.top || []).concat({ dur, id: r.activityDetails.instanceId }).sort((a, b) => a.dur - b.dur).slice(0, 4);
      }
    }
    // quem estava junto na primeira conclusão, e se a mais rápida começou do início (só 1 ou 2 relatórios por atividade, guardados)
    await Promise.all(Object.values(D).map(async o => { if (o.first) o.first.p = await pgcrTeam(o.first.id); if (o.fastRun) o.fastRun.p = await pgcrTeam(o.fastRun.id); }));
    for (const o of Object.values(D)) { if (o.tries < o.c) o.tries = o.c; }
    if (member?.id !== mid) return;
    ACTH = { t: Date.now(), d: D, x: XD }; try { LS.set(key, ACTH); } catch {}
  } finally { acthBusy = false; }
  if (tab === 'xm') build();
  if (tab === 'raid' || tab === 'dg' || tab === 'xm') render();
}
const fmtDur = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtDate = t => new Date(t).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
function xmStrip(m) {
  const W = u().w, o = ACTH?.x?.[m.k];
  if (!o) return ACTH?.x || !have.a ? '' : `<div class="ah"><p class="ah-wait wait">${esc(u().loadingDefs)}</p></div>`;
  if (!o.c) return '';
  const kd = (o.k / Math.max(1, o.d)).toFixed(1).replace('.', lang === 'en' ? '.' : ',');
  return `<div class="ah"><div class="ah-fast"><small>${esc(W.ahFast)}</small><b>${o.fast ? fmtDur(o.fast) : '—'}</b></div><div class="ah-rows"><div class="ah-row"><span>${esc(W.xmClears)}</span><b>${o.c}</b></div></div><div class="ah-kd">${esc(W.ahKD(o.k, o.d, kd))}</div></div>`;
}
function actStrip(sec) {
  const W = u().w, o = ACTH?.d?.[sec.key], a = (sec.kind === 'raid' ? defs.raids : defs.dungeons).find(x => x.k === sec.key);
  if (!o) return ACTH || !have.a ? '' : `<div class="ah"><p class="ah-wait wait">${esc(u().loadingDefs)}</p></div>`;
  const kd = (o.k / Math.max(1, o.d)).toFixed(1).replace('.', lang === 'en' ? '.' : ',');
  if (!o.c) return o.tries ? `<div class="ah"><div class="ah-row"><span>${esc(W.ahTries)}</span><b>${o.tries}</b></div><div class="ah-kd">${esc(W.ahKD(o.k, o.d, kd))}</div></div>` : '';
  const cp = o.fastRun && o.fastRun.p && !o.fastRun.p.fs && Math.abs(o.fastRun.dur * 1000 - o.fast) < 120000;
  const team = o.first?.p?.team || [];
  return `<div class="ah"><div class="ah-fast"><small>${esc(W.ahFast)}</small><b>${fmtDur(o.fast || (o.fastRun?.dur || 0) * 1000)}</b>${cp ? `<span class="ah-cp">${esc(W.ahCp)}</span>` : ''}</div>
    <div class="ah-rows">${o.first ? `<div class="ah-row"><span>${esc(W.ahFirst)}</span><b>${fmtDate(o.first.t)}</b></div>` : ''}${team.length ? `<div class="ah-row"><span>${esc(W.ahWith)}</span><b>${esc(team.join(lang === 'en' ? ', ' : ', '))}</b></div>` : ''}<div class="ah-row"><span>${esc(W.ahTries)}</span><b>${esc(W.ahOf(o.c, o.tries))}</b></div></div>
    <div class="ah-kd">${esc(W.ahKD(o.k, o.d, kd))}</div></div>`;
}


/* ---------- missões exóticas: conclusões, tempo mais rápido, arma/catalisador e triunfos ---------- */
let XMREC = null;
function loadXmRec() { if (XMREC || !have.b) return; XMREC = {}; entities('DestinyRecordDefinition', (defs.xmissions || []).flatMap(m => m.r || []), lang).then(d => { XMREC = d; if (tab === 'xm') { build(); render(); } }); }


/* ---------- sua última sessão: até 3 destaques, o resto recolhido ---------- */
let SESSION = null, sessBusy = false;
/* imagem de fundo de uma atividade: incursões, masmorras e missões exóticas pela lista do site; o resto pela definição da Bungie */
const ACTIMG = LS.get('dc-actimg', {}), actImgP = {};
function actImg(h, kind, key) {
  if (kind && key) { const d = (kind === 'raid' ? defs.raids : defs.dungeons).find(x => x.k === key); if (d?.img) return d.img; }
  for (const l of [defs.raids, defs.dungeons, defs.xmissions || []]) { const d = l.find(x => (x.ah || []).includes(h)); if (d?.img) return d.img; }
  if (!h) return '';
  if (ACTIMG[h] != null) return ACTIMG[h];
  if (!actImgP[h]) actImgP[h] = bungie(`/Destiny2/Manifest/DestinyActivityDefinition/${h}/`, false).then(d => { ACTIMG[h] = d.pgcrImage && !/missing_pgcr/i.test(d.pgcrImage) ? d.pgcrImage : ''; try { LS.set('dc-actimg', ACTIMG); } catch {} if (tab === 'obj') render(); }).catch(() => { ACTIMG[h] = ''; });
  return '';
}
// marcos semanais: imagem ou ícone oficial (quando a atividade não tem imagem)
const MSIMG = LS.get('dc-msimg', {}), msImgP = {};
function msImg(h) {
  if (!h) return {}; if (MSIMG[h]) return MSIMG[h];
  if (!msImgP[h]) msImgP[h] = bungie(`/Destiny2/Manifest/DestinyMilestoneDefinition/${h}/`, false).then(d => { MSIMG[h] = { img: d.image || '', ic: d.displayProperties?.icon || '' }; try { LS.set('dc-msimg', MSIMG); } catch {} if (tab === 'obj') render(); }).catch(() => { MSIMG[h] = {}; });
  return {};
}
async function loadSession() {
  if (sessBusy || !member || !have.a) return; if (SESSION && SESSION.cid === charId && Date.now() - SESSION.at < 600000) return;
  sessBusy = true; const mid = member.id;
  try {
    const chars = Object.keys(profile.characters?.data || {});
    const acts = (await Promise.all(chars.map(c => bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${c}/Stats/Activities/?count=20&mode=0`, false).then(r => (r.activities || []).map(a => ({ ...a, _c: c }))).catch(() => [])))).flat()
      .map(a => { const v = k => a.values?.[k]?.basic?.value || 0, st = Date.parse(a.period); return { h: a.activityDetails.directorActivityHash || a.activityDetails.referenceId, mode: a.activityDetails.mode, id: a.activityDetails.instanceId, st, end: st + v('activityDurationSeconds') * 1000, dur: v('activityDurationSeconds'), done: v('completed') === 1 && v('completionReason') !== 2, k: v('kills'), d: v('deaths'), pc: v('playerCount') }; })
      .sort((a, b) => b.st - a.st);
    // sem sessão recente: só atualiza a foto (exóticos, luz, títulos, catalisadores) para servir de ponto de partida da próxima
    const snapNow = () => { const recOn = have.b && !!profile.profileRecords?.data; return { t: Date.now(), light: Math.max(...Object.values(profile.characters.data).map(c => c.light || 0)), exo: defs.exotics.filter(e => colAcquired(e.h)).map(e => e.h[0]), ...(recOn ? { seal: Object.fromEntries(defs.seals.map(se => [se.cr, se.r.filter(r => recDone(recState(r[0]))).length])), cat: Object.fromEntries(defs.cats.map(c => { const r = recState(c.h); return r && !(r.state & 16) ? [c.h, recDone(r) ? 100 : Math.floor(pct(r) * 100)] : null; }).filter(Boolean)) } : {}) }; };
    if (!acts.length || Date.now() - acts[0].end > 24 * 3600e3) { try { LS.set('dc-snap-' + member.id, snapNow()); } catch {} SESSION = { cid: charId, at: Date.now(), none: true }; return; }
    const s = [acts[0]]; for (let i = 1; i < acts.length; i++) { if (s[s.length - 1].st - acts[i].end > 45 * 60e3) break; s.push(acts[i]); }
    const start = Math.min(...s.map(a => a.st)), end = Math.max(...s.map(a => a.end)), sid = s[s.length - 1].id;
    const names = await entities('DestinyActivityDefinition', s.map(a => a.h), lang);
    const map = await mapActs([...new Set(s.map(a => a.h))], h => s.find(a => a.h === h)?.mode);
    // exóticos novos e luz: compara com a foto da coleção tirada na visita anterior
    const exoNow = defs.exotics.filter(e => colAcquired(e.h)).map(e => e.h[0]), light = Math.max(...Object.values(profile.characters.data).map(c => c.light || 0));
    // títulos (triunfos feitos de cada um) e catalisadores (% de progresso): mesma foto, para mostrar o que andou na sessão
    const recOn = have.b && !!profile.profileRecords?.data;
    const sealNow = recOn ? Object.fromEntries(defs.seals.map(se => [se.cr, se.r.filter(r => recDone(recState(r[0]))).length])) : null;
    const catNow = recOn ? Object.fromEntries(defs.cats.map(c => { const r = recState(c.h); return r && !(r.state & 16) ? [c.h, recDone(r) ? 100 : Math.floor(pct(r) * 100)] : null; }).filter(Boolean)) : null;
    const snapK = 'dc-snap-' + member.id, sessK = 'dc-sess-' + member.id, snap = LS.get(snapK, null);
    let ex = LS.get(sessK, null); if (!ex || ex.sid !== sid) ex = { sid, newExo: [], from: null };
    if (snap && snap.t <= end) { const before = new Set(snap.exo); for (const h of exoNow) if (!before.has(h) && !ex.newExo.includes(h)) ex.newExo.push(h); if (ex.from == null && snap.t <= start) ex.from = snap.light; }
    // ponto de partida da sessão: a foto tirada antes dela começar (guardada na sessão para as próximas visitas)
    if (snap && snap.t <= start) { if (!ex.seal && snap.seal) ex.seal = snap.seal; if (!ex.cat && snap.cat) ex.cat = snap.cat; }
    try { LS.set(sessK, ex); LS.set(snapK, { t: Date.now(), light, exo: exoNow, ...(sealNow ? { seal: sealNow, cat: catNow } : {}) }); } catch {}
    // recordes usam o histórico de incursões/masmorras; sem ele ainda, mostra a sessão já e recalcula quando chegar
    if (FX && !ACTH) { const c = LS.get('dc-acth-' + member.id, null); if (c) ACTH = c; else loadActHist().then(() => { if (ACTH) { SESSION = null; if (tab === 'obj') loadSession(); } }).catch(() => {}); }
    const items = [];
    const runs = {}; for (const a of s) { const m = map[a.h]; if (m && a.done) (runs[m.k] = runs[m.k] || { m, list: [] }).list.push(a); }
    for (const { m, list } of Object.values(runs)) {
      const def = (m.kind === 'raid' ? defs.raids : defs.dungeons).find(x => x.k === m.k), total = metric(def.m), best = list.sort((a, b) => a.dur - b.dur)[0];
      const first = total > 0 && total <= list.length, x = def.x && exoticByName(def.x);
      // recorde: a melhor desta sessão contra as melhores de antes (histórico guardado das incursões/masmorras)
      const ids = new Set(list.map(r => r.id)), prev = (ACTH?.d?.[m.k]?.top || []).filter(r => !ids.has(r.id)).sort((a, b) => a.dur - b.dur)[0];
      // sem o tempo anterior no histórico (conclusões antigas), vale o melhor tempo geral da Bungie: se é o desta sessão, é recorde
      const fastAll = ACTH?.d?.[m.k]?.fast || 0;
      const rec = first ? null : prev ? (best.dur < prev.dur ? { o: fmtDur(prev.dur * 1000), d: fmtDur((prev.dur - best.dur) * 1000) } : null) : (fastAll && Math.abs(fastAll / 1000 - best.dur) < 2 && total > list.length ? { best: true } : null);
      const solo = list.find(r => r.pc === 1), fl = solo && list.some(r => r.pc === 1 && r.d === 0);
      items.push({ p: first ? 0 : rec ? 0.5 : solo ? 2.5 : 3, cls: first || rec ? 'gold' : solo ? 'solo' : '', badge: first ? 'first' : m.kind, rec, solo: solo ? (fl ? 'fl' : 'y') : '', img: def.img, dif: def.d, to: m.kind + '-' + m.k, n: L(def.n), sub: [fmtDur(best.dur * 1000), best.k + ' ' + u().w.kills, best.d + ' ' + u().w.deaths], foot: x && colMissing(x.h) ? u().w.ssNoDrop(L(x.n)) : '' });
    }
    if (sealNow && ex.seal) for (const se of defs.seals) { const a = ex.seal[se.cr], b = sealNow[se.cr], tot = se.r.length; if (a == null || b <= a) continue; const full = b >= tot; items.push({ p: full ? 1 : 2.2, cls: full ? 'gold' : 'prog', badge: full ? 'sealDone' : 'seal', n: L(se.t), sub: [u().w.ssSeal(b - a), `${b}/${tot}`], bar: b / tot, foot: '' }); }
    if (catNow && ex.cat) for (const c of defs.cats) { const a = ex.cat[c.h], b = catNow[c.h]; if (a == null || b == null || b <= a) continue; const full = b >= 100; items.push({ p: full ? 1.2 : 2.4, cls: full ? 'gold' : 'prog', badge: full ? 'catDone' : 'cat', n: L(c.n).replace(/^Catalisador d[aeo]s? |^Catalisador /, '').replace(/ Catalyst$/, ''), sub: full ? [u().w.ssCatDone] : [`${a}% → ${b}%`], bar: b / 100, foot: '' }); }
    for (const h of ex.newExo) { const e = defs.exotics.find(y => y.h[0] === h); if (e) items.push({ p: 1, cls: 'gold', badge: 'exo', n: L(e.n), sub: [u().w.ssNewExo], foot: '' }); }
    const claim = []; for (const se of defs.seals) { const c = se.r.filter(r => { const st = recState(r[0]); return st && !(st.state & 1) && !(st.state & 4); }).length; if (c) { const done = se.r.filter(r => recDone(recState(r[0]))).length; claim.push({ se, c, done }); } }
    if (claim.length) { const top = claim.sort((a, b) => b.c - a.c)[0], n = claim.reduce((t, x) => t + x.c, 0); items.push({ p: 2, cls: 'claim', badge: 'claim', n: u().w.ssClaim(n, L(top.se.t)), sub: [u().w.ssClaimSub], foot: u().w.ssTitle(top.done, top.se.r.length) }); }
    for (const a of s) { const m = map[a.h]; if (m || !a.done) continue; items.push({ p: 4, dur: a.dur, cls: '', h: a.h, to: (() => { const xm = (defs.xmissions || []).find(z => (z.ah || []).includes(a.h)); return xm ? 'xm-' + xm.k : ''; })(), badge: 'mode' + a.mode, n: names[a.h]?.n || '?', sub: [Math.round(a.dur / 60) + ' min', a.k + ' ' + u().w.kills], foot: '' }); }
    items.sort((a, b) => a.p - b.p || (b.dur || 0) - (a.dur || 0));
    if (member?.id !== mid) return;
    SESSION = { cid: charId, at: Date.now(), start, end, mins: Math.round(s.reduce((t, a) => t + a.dur, 0) / 60), from: ex.from, light, items };
  } catch { SESSION = { cid: charId, at: Date.now(), none: true }; } finally { sessBusy = false; }
  if (tab === 'obj') render();
}
// "Esta semana" em cartões: destaques com a imagem da atividade, desafios e recompensas com barra de progresso
// detalhes ao abrir um cartão da semana: descrição do marco, nomes das recompensas, texto do desafio
const WKD = { ms: {}, ob: {}, p: {} }, WKO = new Set();
function wkDetail(w) {
  const lc = lang === 'pt' ? 'pt-br' : 'en', need = [];
  if (w.ms && !WKD.ms[w.ms + lc]) need.push(['ms', w.ms, `/Destiny2/Manifest/DestinyMilestoneDefinition/${w.ms}/?lc=${lc}`, d => { const rw = {}; for (const c of Object.values(d.rewards || {})) for (const [eh, e] of Object.entries(c.rewardEntries || {})) rw[eh] = e.displayProperties?.name || ''; return { d: d.displayProperties?.description || '', rw }; }]);
  if (w.obj && !WKD.ob[w.obj + lc]) need.push(['ob', w.obj, `/Destiny2/Manifest/DestinyObjectiveDefinition/${w.obj}/?lc=${lc}`, d => ({ n: d.displayProperties?.name || d.progressDescription || '', d: d.displayProperties?.description || '' })]);
  for (const [k, h, url, f] of need) { const key = k + h + lc; if (WKD.p[key]) continue; WKD.p[key] = bungie(url, false).then(d => { WKD[k][h + lc] = f(d); }).catch(() => { WKD[k][h + lc] = {}; }).finally(() => { if (tab === 'obj') render(); }); }
  return { ms: WKD.ms[w.ms + lc], ob: WKD.ob[w.obj + lc], act: ACTN?.[w.h] };
}
// destaque aberto no lugar: só o que falta naquela incursão/masmorra, com atalho para a página completa
function wkFeatMore(f) {
  const sec = SECTIONS.find(x => x.id === f.id); if (!sec) return '';
  const left = sec.items.filter(i => !isDone(i)), W = u();
  return `<div class="wk-fm"><div class="wk-fm-h"><b>${esc(f.title)}</b><span>${sec.items.length - left.length}/${sec.items.length}</span>${actYt(sec.kind, sec.key)}<button type="button" class="wk-fm-go" data-jump="${f.tab}:${f.id}">${esc(W.wkFull)} →</button></div>${left.length ? `<ul>${left.map(i => `<li><span>${esc(i.t)}</span>${i.c[0] ? `<span class="chip ${chipClass(i.c[0])}">${esc(i.c[0])}</span>` : ''}</li>`).join('')}</ul>` : `<p>${esc(W.wkAllDone)}</p>`}</div>`;
}
function wkMore(i) {
  const w = i.wk || {}, D = wkDetail(w), U = u(), out = [];
  if (w.k === 'ch') {
    if (D.ob?.n) out.push(`<b class="wk-mt">${esc(D.ob.n)}</b>`);
    if (D.ob?.d) out.push(`<p>${esc(D.ob.d)}</p>`);
    if (D.act?.d) out.push(`<p class="wk-mm">${esc(D.act.d)}</p>`);
    out.push(`<p class="wk-mm">${esc(U.w.wkChallengeD)}</p>`);
  } else if (w.k === 'rw') {
    if (D.ms?.d) out.push(`<p>${esc(D.ms.d)}</p>`);
    if (w.rw?.length) out.push(`<ul class="wk-rw">${w.rw.map(([eh, ea, re]) => `<li class="${re ? 'red' : ea ? 'earn' : ''}"><i></i><span>${esc(D.ms?.rw?.[eh] || '…')}</span><small>${esc(re ? U.wkRwSt.red : ea ? U.wkRwSt.earn : U.wkRwSt.todo)}</small></li>`).join('')}</ul>`);
  } else {
    if (D.ms?.d) out.push(`<p>${esc(D.ms.d)}</p>`);
    out.push(`<p class="wk-mm">${esc(i.d || '')}</p>`);
  }
  return `<div class="wk-more">${out.join('') || `<p class="wait">${esc(U.loadingDefs)}</p>`}</div>`;
}
function weekHTML(sec) {
  const W = u().w, open = openSecs.has(sec.id), done = sec.items.filter(isDone).length;
  const feat = (sec.feat || []).map(f => { const d = (f.kind === 'raid' ? defs.raids : defs.dungeons).find(x => x.k === f.key); return `<button type="button" class="wk-f${WKO.has('f:' + f.id) ? ' on' : ''}" data-wko="f:${f.id}" aria-expanded="${WKO.has('f:' + f.id)}" style="--wk-img:url('${BNET}${d?.img || ''}')"><small>${esc(u().wkFeatT)}${d?.d ? ` · ${esc(u().chip[d.d] || d.d)}` : ''}</small><b>${esc(f.title)}</b></button>${WKO.has('f:' + f.id) ? wkFeatMore(f) : ''}`; }).join('');
  const card = i => { const w = i.wk || {}, mi = msImg(w.ms), im = (w.h ? actImg(w.h) : '') || mi.img || '', ic = !im && mi.ic, ok = isDone(i), p = w.b ? Math.round(w.a / w.b * 100) : ok ? 100 : 0;
    const op = WKO.has(i.id);
    return `<div class="wk-c${ok ? ' ok' : ''}${w.claim ? ' claim' : ''}${im ? ' wk-img' : ''}${op ? ' open' : ''}" data-wko="${esc(i.id)}" role="button" tabindex="0" aria-expanded="${op}"${im ? ` style="--wk-img:url('${BNET}${im}')"` : ''}>${ic ? `<img class="wk-ic" src="${BNET}${ic}" alt="">` : ''}<small>${esc(u().wkKind[w.k] || '')}</small><b>${esc(w.act || i.t)}</b>${w.b ? `<span class="wk-p"><i><u style="width:${p}%"></u></i><span>${w.a}/${w.b}</span></span>` : `<span class="wk-p"><span>${esc(i.c[0] || '')}</span></span>`}${w.claim ? `<span class="wk-claim">${esc(i.d)}</span>` : ''}${ok ? '<span class="wk-ok">✓</span>' : ''}${op ? wkMore(i) : ''}</div>`; };
  return `<section data-sec="${sec.id}" class="keep wk-sec coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="${sec.id}" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2></div><span class="count">${done}/${sec.items.length}</span><span class="chev" aria-hidden="true"></span></div>${sec.nr ? `<p>${esc(sec.nr)}</p>${(sec.feat || []).length ? `<ul class="wk-nl">${sec.feat.map(f => `<li><span>★ ${esc(u().wkFeatT)}</span> ${esc(f.title)}</li>`).join('')}</ul>` : ''}` : `<p>${esc(sec.note)}</p>`}<div class="sec-bar"><i style="width:${sec.items.length ? done / sec.items.length * 100 : 0}%"></i></div></div>
    <div class="wk-body">${feat ? `<div class="wk-fs">${feat}</div>` : ''}<div class="wk-g">${sec.items.map(card).join('')}</div></div></section>`;
}
function sessHTML() {
  // jogando agora (a Bungie mostra o grupo): a sessão ainda não terminou; aparece quando o jogo é fechado
  const S = SESSION, W = u().w; if (!LIVE.checked || LIVE.on || !S || S.none || !S.items?.length) return '';
  const tm = t => new Date(t).toLocaleTimeString(lang === 'en' ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = (() => { const d = new Date(S.start), n = new Date(); const y = new Date(n); y.setDate(n.getDate() - 1); return d.toDateString() === n.toDateString() ? W.today : d.toDateString() === y.toDateString() ? W.yesterday : d.toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit' }); })();
  const badge = b => W.ssBadge[b] || W.ssBadge[b.replace(/\d+$/, '')] || (/^mode/.test(b) ? (W.ssMode[+b.slice(4)] || W.ssBadge.done) : W.ssBadge.done);
  const card = t => { const im = FX ? (t.img || (t.h ? actImg(t.h) : '')) : '', go = t.to && SECTIONS.find(x => x.id === t.to); return `<div class="ss-c ${t.cls}${im ? ' ss-img' : ''}${go ? ' ss-go' : ''}"${go ? ` data-jump="${go.tab}:${go.id}" role="button" tabindex="0"` : ''}${im ? ` style="--ss-img:url('${BNET}${im}')"` : ''}><span class="ss-bs"><span class="ss-badge">${esc(badge(t.badge))}</span>${FX && t.rec ? `<span class="ss-badge rec">⏱ ${esc(u().ssRec)}</span>` : ''}${FX && t.solo ? `<span class="ss-badge solo">${esc(t.solo === 'fl' ? u().ssSoloFl : u().ssSolo)}</span>` : ''}${FX && t.dif ? `<span class="ss-dif chip ${{ 'Fácil': 'easy', 'Médio': 'mid', 'Difícil': 'hard' }[t.dif] || ''}">${esc(u().chip[t.dif] || t.dif)}</span>` : ''}</span><b class="ss-cn">${esc(t.n)}</b>${FX && t.rec ? `<small class="ss-rec">${esc(t.rec.best ? u().ssRecBest : u().ssRecSub(t.rec.o, t.rec.d))}</small>` : ''}<small>${esc(t.sub.filter(Boolean).join(' · '))}</small>${t.bar != null ? `<i class="ss-bar"><u style="width:${Math.round(t.bar * 100)}%"></u></i>` : ''}${t.foot ? `<span class="ss-foot">${esc(t.foot)}</span>` : ''}</div>`; };
  const top = S.items.slice(0, 3), rest = S.items.slice(3), h = Math.floor(S.mins / 60), m = S.mins % 60;
  return `<section class="ss keep" data-sec="session"><div class="ss-head"><h2>${esc(W.ssT)}</h2><div class="ss-meta"><span>${esc(day)}, ${tm(S.start)}–${tm(S.end)}</span><span>⏱ ${h ? h + 'h' + String(m).padStart(2, '0') : m + ' min'}</span>${S.from && S.light > S.from ? `<span class="ss-pw">✦ ${S.from} → <b>${S.light}</b></span>` : ''}</div></div>
    <div class="ss-top">${top.map(card).join('')}</div>${rest.length ? `<details class="ss-more"><summary>${esc(W.ssMore(rest.length))}</summary><div class="ss-top">${rest.map(card).join('')}</div></details>` : ''}</section>`;
}

/* ---------- início ---------- */
/* ---------- sincronização entre aparelhos (servidor da Cloudflare) ----------
   Favoritos, builds salvas, marcações e preferências ficam ligados à conta Bungie.
   Cada chave guarda a hora da última mudança; a mais nova vence. Na primeira vez num aparelho, listas são somadas. */
const SY = { t: LS.get('dc-synct', {}), dirty: new Set(), timer: null, applying: false, pulled: 0 };
const syKeys = () => member ? ['favs', 'builds', 'opts', 'hide2', 'goals', 'wish', 'focus', 'marks-' + member.id] : [];
LS.hook = k => {
  if (SY.applying || !member || !k.startsWith('dc-')) return; const n = k.slice(3);
  if (!syKeys().includes(n)) return;
  SY.t[n] = Date.now(); SY.dirty.add(n); try { localStorage.setItem('dc-synct', JSON.stringify(SY.t)); } catch {}
  clearTimeout(SY.timer); SY.timer = setTimeout(syncPush, 2500);
};
function syMerge(n, a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return b;
  if (n === 'favs') return [...a, ...b.filter(x => !a.some(y => y.id === x.id))].slice(0, 30);
  if (n === 'builds') return [...a, ...b.filter(x => !a.some(y => y.k === x.k))].slice(0, 30);
  if (n === 'goals') return [...a, ...b.filter(x => !a.some(y => y.id === x.id))].slice(0, 12);
  if (n === 'focus') return [...a, ...b.filter(x => !a.some(y => y.id === x.id))].slice(0, 30);
  if (n === 'wish') return [...a, ...b.filter(x => !a.some(y => y.h === x.h))].slice(0, 40);
  if (n.startsWith('marks-')) return [...new Set([...a, ...b])];
  return b;
}
async function syncPull() {
  if (!APIW || !auth || !member) return;
  try {
    const r = await fetch(APIW + '/sync', { headers: { Authorization: 'Bearer ' + await token(), 'X-API-Key': cfg.apiKey } });
    if (!r.ok) return; const remote = (await r.json()).d || {}; SY.pulled = Date.now();
    let changed = false; SY.applying = true;
    for (const n of syKeys()) {
      const lt = SY.t[n] || 0, rv = remote[n], local = LS.get('dc-' + n, null);
      if (rv && rv.t > lt) {
        if (!lt && local != null) { LS.set('dc-' + n, syMerge(n, local, rv.v)); SY.t[n] = Date.now(); SY.dirty.add(n); } // primeira vez neste aparelho: soma
        else { LS.set('dc-' + n, rv.v); SY.t[n] = rv.t; }
        changed = true;
      } else if (local != null && (!rv || lt > rv.t)) { if (!lt) SY.t[n] = Date.now(); SY.dirty.add(n); }
    }
    SY.applying = false; try { localStorage.setItem('dc-synct', JSON.stringify(SY.t)); } catch {}
    if (SY.dirty.size) await syncPush();
    if (changed) {
      marks = new Set(LS.get('dc-marks-' + member.id, [])); Object.assign(OPTS, LS.get('dc-opts', {}));
      const hd = LS.get('dc-hide2', false); $('hide').checked = hd; document.body.classList.toggle('hide-done', hd);
      if (profile) { build(); render(); }
    }
  } catch { SY.applying = false; }
}
async function syncPush(keepalive) {
  clearTimeout(SY.timer); if (!APIW || !auth || !member || !SY.dirty.size) return;
  const keys = [...SY.dirty], body = {}; for (const n of keys) body[n] = { v: LS.get('dc-' + n, null), t: SY.t[n] || Date.now() };
  try {
    const r = await fetch(APIW + '/sync', { method: 'PUT', keepalive: !!keepalive, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token(), 'X-API-Key': cfg.apiKey }, body: JSON.stringify(body) });
    if (r.ok) for (const n of keys) if (body[n].t === (SY.t[n] || body[n].t)) SY.dirty.delete(n);
  } catch {}
}
// ao sair da aba envia o que falta; ao voltar (depois de 1 min) busca o que mudou em outro aparelho
document.addEventListener('visibilitychange', () => { if (document.hidden) syncPush(true); else if (Date.now() - SY.pulled > 60000) syncPull(); });
// /beta: confere no servidor se é o dono; qualquer outra pessoa volta para o site normal
async function ownerSug() {
  if (!auth || !APIW) return; const chk = LS.get('dc-ownchk', null); if (chk && !chk.o && Date.now() - chk.t < 864e5) return;
  try {
    const j = await fetch(APIW + '/whoami', { headers: { Authorization: 'Bearer ' + await token(), 'X-API-Key': cfg.apiKey } }).then(r => r.json());
    LS.set('dc-ownchk', { o: !!j.owner, t: Date.now() }); if (!j.owner || !j.sug) return;
    let a = $('ownsug'); if (!a) { a = document.createElement('a'); a.id = 'ownsug'; a.className = 'themetoggle ownsug'; a.href = '/status'; $('newsbtn').before(a); }
    a.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="10.5" rx="1.6"/><path d="m3.5 6 6.5 5 6.5-5"/></svg><b>${j.sug}</b>`;
    a.title = a.ariaLabel = u().sugNew(j.sug);
  } catch {}
}
async function betaGate() {
  // só volta para o site normal quando o servidor responde que a conta não é a do dono; falha de rede não expulsa
  document.documentElement.classList.add('beta');
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch((APIW || 'https://dni-api.dni-site.workers.dev') + '/whoami', { headers: { Authorization: 'Bearer ' + await token(), 'X-API-Key': cfg.apiKey } });
      const j = await r.json().catch(() => null);
      if (j && j.owner === true) return;
      if (j && j.owner === false && j.uid) { location.replace('/'); return; }
      console.warn('[beta] resposta inesperada', r.status, j);
    } catch (e) { console.warn('[beta] não deu para confirmar o acesso', e?.message); if (e?.message === 'auth') { location.replace('/'); return; } }
    await new Promise(r => setTimeout(r, 1500));
  }
}
let moving = false;
async function moveToNew() {
  if (moving) return; moving = true;
  showMessage(`<p class="loading wait">${esc(lang === 'pt' ? 'O site mudou de endereço: levando você para destinyparallel.vercel.app…' : 'The site has moved: taking you to destinyparallel.vercel.app…')}</p>`);
  try { await Promise.race([syncPull(), new Promise(r => setTimeout(r, 6000))]); } catch {}
  const keep = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^dc-(auth|member|lang|theme|tab|subs|opts|hide2|favs|builds|el|marks-\d+|char-\d+)$/.test(k)) keep[k] = localStorage.getItem(k); }
  const pay = btoa(unescape(encodeURIComponent(JSON.stringify(keep)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  location.replace(NEW_ORIGIN + location.pathname + location.search + '#move=' + pay);
}
/* ---------- Ao vivo: o fireteam em que você está agora e a build de cada um ----------
   Lê o grupo pela sua conta (componente 1000) a cada 30 s com a aba aberta; a build de cada membro é pública
   (mesmos dados da busca de guardião). Fora do jogo, a faixa some. */
const LIVE = { checked: false, bt: 0, on: false, act: '', since: null, mem: [], seq: 0, timer: null, types: LS.get('dc-mtype', {}), busy: false };
async function memType(id) {
  if (LIVE.types[id]) return LIVE.types[id];
  if (id === member?.id) return member.type;
  try { const r = await bungie(`/User/GetMembershipsById/${id}/-1/`, false); const m = r.destinyMemberships || []; const pick = m.find(x => x.membershipId === id) || m[0]; if (pick) { LIVE.types[id] = pick.membershipType; LS.set('dc-mtype', LIVE.types); return pick.membershipType; } } catch {}
  return null;
}
async function liveMember(id, prev) {
  const type = await memType(id); if (!type) return null;
  const p = await bungie(`/Destiny2/${type}/Profile/${id}/?components=100,200,205,300,305`, false);
  const chars = Object.values(p.characters?.data || {}).sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed)), ch = chars[0]; if (!ch) return null;
  const u0 = p.profile?.data?.userInfo || {}, name = u0.bungieGlobalDisplayName ? fullName(u0.bungieGlobalDisplayName, u0.bungieGlobalDisplayNameCode) : (u0.displayName || '');
  const eq = p.characterEquipment?.data?.[ch.characterId]?.items || [], sig = eq.map(i => i.itemHash).join('.');
  const B = prev && prev.sig === sig && prev.cid === ch.characterId && prev.B ? prev.B : (eq.length && p.itemComponents?.sockets?.data ? await fetchBuild(p, ch.characterId) : null);
  return { id, type, name, p, cid: ch.characterId, ch, sig, B, priv: !eq.length || !p.itemComponents?.sockets?.data };
}
// atividade atual → página da incursão, masmorra ou missão exótica no site (para abrir o guia dela)
// botões de guia (vídeos e imagens) da atividade em que o grupo está
const liveGuides = id => { const m = /^(raid|dg|xm)-(.+)$/.exec(id || ''); return m ? actYt(m[1], m[2]) : ''; };
async function liveTarget(h, mode) {
  const xm = (defs.xmissions || []).find(m => (m.ah || []).includes(h)); let id = xm ? 'xm-' + xm.k : '';
  if (!id) { const k = (await mapActs([h], () => mode).catch(() => ({})))[h]; if (k) id = k.kind + '-' + k.k; }
  const sec = id && SECTIONS.find(x => x.id === id); return sec ? [sec.tab, id] : null;
}
/* atividades fora do jogo (guardadas no cofre de conteúdo): a Bungie só lista as disponíveis; aproveita a consulta do Ao vivo, sem pedido extra */
let AVAIL = (() => { const c = LS.get('dc-avail', null); return c && Date.now() - c.at < 7 * 864e5 ? new Set(c.h) : null; })();
function saveAvail(data) {
  const all = new Set(); for (const c of Object.values(data || {})) for (const a of c.availableActivities || []) all.add(a.activityHash);
  if (all.size < 50) return; // resposta incompleta: não esconde nada
  const mine = []; for (const l of [defs.raids, defs.dungeons, defs.xmissions || []]) for (const x of l) for (const h of x.ah || []) if (all.has(h)) mine.push(h);
  const changed = !AVAIL || AVAIL.size !== mine.length || mine.some(h => !AVAIL.has(h));
  AVAIL = new Set(mine); LS.set('dc-avail', { at: Date.now(), h: mine });
  if (changed && ['raid', 'dg', 'xm'].includes(tab)) render();
}
const secAvail = sec => { if (!AVAIL) return true; const d = sec.kind ? actDefOf(sec.kind, sec.key) : sec.xm; return !d?.ah?.length || d.ah.some(h => AVAIL.has(h)); };
async function livePoll() {
  if (LIVE.busy && Date.now() - LIVE.bt > 60000) LIVE.busy = false; // pedido travado: não deixa o Ao vivo preso
  if (LIVE.busy || !auth || !member || document.hidden) return; LIVE.busy = true; LIVE.bt = Date.now(); const my = ++LIVE.seq;
  try {
    const r = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/?components=1000,204`);
    saveAvail(r.characterActivities?.data);
    const prevTo = LIVE.to, ended = () => { if (prevTo) setTimeout(() => autoRefresh(), 45000); }; // saiu de incursão/masmorra/missão: a Bungie leva ~1 min para contar; depois recarrega
    const t = r.profileTransitoryData?.data, party = t?.partyMembers || [];
    if (!t || !party.length) { wPendingCheck(null); const was = LIVE.on; LIVE.on = false; LIVE.mem = []; LIVE.to = null; renderLive(); if (was) { SESSION = null; autoT = 0; setTimeout(() => autoRefresh(), 45000); if (tab === 'obj') render(); } else ended(); return; }
    const act = Object.values(r.characterActivities?.data || {}).sort((a, b) => new Date(b.dateActivityStarted) - new Date(a.dateActivityStarted))[0];
    wPendingCheck(act);
    LIVE.since = t.currentActivity?.startTime || act?.dateActivityStarted || null;
    if (act?.currentActivityHash) { const a = await entities('DestinyActivityDefinition', [act.currentActivityHash], lang); LIVE.act = a[act.currentActivityHash]?.n || ''; const prevId = LIVE.to?.[1]; LIVE.to = await liveTarget(act.currentActivityHash, act.currentActivityModeType); if (LIVE.to?.[1] !== prevId) { LIVE.x = false; LIVE.xo = new Set(); } } else { LIVE.act = ''; LIVE.to = null; }
    if (prevTo && (!LIVE.to || LIVE.to.join() !== prevTo.join())) ended();
    // você primeiro, depois o resto do grupo
    const ids = [...new Set([member.id, ...party.map(x => x.membershipId)])];
    const old = Object.fromEntries(LIVE.mem.map(m => [m.id, m]));
    const mem = (await Promise.all(ids.map(id => liveMember(id, old[id]).catch(() => old[id] || null)))).filter(Boolean);
    if (my !== LIVE.seq) return;
    const was = LIVE.on; LIVE.on = true; LIVE.mem = mem; renderLive(); if (!was && tab === 'obj') render();
  } catch { /* fora do ar ou sem permissão: tenta de novo no próximo ciclo */ }
  finally { if (my === LIVE.seq) LIVE.busy = false; if (!LIVE.checked) { LIVE.checked = true; if (tab === 'obj') render(); } }
}
function liveStart() { clearInterval(LIVE.timer); livePoll(); LIVE.timer = setInterval(livePoll, 30000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && LIVE.timer) livePoll(); if (!document.hidden && loadedAt && Date.now() - loadedAt > 5 * 60000) autoRefresh(); });
// recarrega os dados da conta sozinho: ao voltar para a aba depois de 5 min e logo depois de terminar uma atividade (no máximo a cada 2 min)
let autoT = 0;
function autoRefresh() {
  if (!auth || !member || document.hidden || Date.now() - autoT < 120000) return; autoT = Date.now();
  SESSION = null; if (ACTH) ACTH.t = 0; // histórico de incursões/masmorras também (tempo, conclusões)
  start();
}
function renderLive() {
  const el = $('live'); if (!el) return;
  if (!(auth && profile) || !LIVE.on || !LIVE.mem.length) { el.hidden = true; el.innerHTML = ''; return; }
  const U = u(), W = U.w, tm = LIVE.since ? new Date(LIVE.since).toLocaleTimeString(lang === 'en' ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const card = (m, i) => {
    const B = m.B, eq = m.p.characterEquipment?.data?.[m.cid]?.items || [], d = h => (B && (B.loc[h] || B.en[h])) || {};
    const sub = eq.find(x => x.bucketHash === SUB_BUCKET), el2 = B && sub ? ELEMENTS[B.en[sub.itemHash]?.dt] : null, [a1, a2] = ELEMENT_ACC[el2] || ELEMENT_ACC.arc;
    const exo = B ? eq.filter(x => (WEAPON_B.includes(x.bucketHash) || ARMOR_B.includes(x.bucketHash)) && B.en[x.itemHash]?.tt === 6) : []; // só armas e armaduras (fantasma, pardal e nave ficam de fora)
    const ws = B ? WEAPON_B.map(b => eq.find(x => x.bucketHash === b)).filter(Boolean) : [];
    const ic = (x, cls = '') => { const v = d(x.itemHash); return v.ic ? `<img class="${cls}" src="${BNET}${v.ic}" alt="" title="${esc(v.n || '')}" loading="lazy">` : ''; };
    const nm = m.name.replace(/#\d+$/, ''), you = m.id === member.id;
    return `<button class="lv-c" type="button" data-lv="${i}" style="--a1:${a1};--a2:${a2}" title="${esc(U.liveTap)}">
      <span class="lv-b" style="background-image:url('${BNET}${m.ch.emblemBackgroundPath || ''}')"><span class="lv-n"><b>${esc(nm)}</b>${you ? `<small>${esc(U.liveYou)}</small>` : ''}</span><span class="lv-pw">${m.ch.light}</span></span>
      <span class="lv-g">${sub ? ic(sub, 'lv-sub') : ''}<span class="lv-cls">${esc((sub && d(sub.itemHash).n) || U.classes[m.ch.classType] || '')}</span>${m.priv ? `<span class="lv-priv">${esc(U.livePriv)}</span>` : ''}</span>
      ${(() => { const st = m.ch.stats; if (!st || !STAT_ORDER.some(h => st[h] != null)) return ''; loadStats(); const D = STATD?.d || {}; return `<span class="lv-sts">${STAT_ORDER.map(h => `<span class="${(st[h] || 0) > 100 ? 'hi' : ''}" title="${esc(D[h]?.n || '')}">${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}<b>${st[h] || 0}</b></span>`).join('')}</span>`; })()}
      ${m.priv || !B ? '' : `<span class="lv-eq"><span class="lv-row">${WEAPON_B.map(b => eq.find(x => x.bucketHash === b)).map(x => x ? ic(x, B.en[x.itemHash]?.tt === 6 ? 'ex' : '') : '<i></i>').join('')}</span><span class="lv-row arm">${ARMOR_B.map(b => eq.find(x => x.bucketHash === b)).map(x => x ? ic(x, B.en[x.itemHash]?.tt === 6 ? 'ex' : '') : '<i></i>').join('')}</span></span>`}</button>`;
  };
  el.innerHTML = `<div class="lv-h"><span class="lv-dot" aria-hidden="true"></span><b>${esc(U.liveT)}</b>${LIVE.act ? (LIVE.to ? `<button type="button" class="lv-go" data-lvx aria-expanded="${!!LIVE.x}">${esc(LIVE.act)} <i class="lv-car${LIVE.x ? ' on' : ''}" aria-hidden="true"></i></button>` : `<span>${esc(LIVE.act)}</span>`) : ''}${LIVE.to ? `<span class="lv-g">${liveGuides(LIVE.to[1])}</span>` : ''}${tm ? `<small>${esc(U.liveSince(tm))}</small>` : ''}</div>${lpaLive()}${LIVE.x && LIVE.to ? liveDetail() : ''}<div class="lv-l">${LIVE.mem.map(card).join('')}</div>`;
  el.hidden = false;
}
// atividade do Ao vivo aberta no próprio painel: progresso, histórico e cada encontro/desafio com os detalhes (começa fechada)
function liveDetail() {
  const U = u(), W = U.w, sec = SECTIONS.find(x => x.id === LIVE.to[1]); if (!sec) return '';
  const items = sec.items || [], done = items.filter(isDone).length, xo = LIVE.xo || (LIVE.xo = new Set());
  const rows = items.map(i => { const ok = isDone(i), more = !!(i.d || i.loc || i.tl || i.c.length > 1), op = xo.has(i.id);
    return `<li class="lvx-i${ok ? ' ok' : ''}${op ? ' open' : ''}"><button type="button" class="lvx-b" ${more ? `data-lvi="${esc(i.id)}" aria-expanded="${op}"` : 'disabled'}><span class="tl-i" aria-label="${ok ? '✓' : '○'}">${ok ? '✓' : ''}</span><span class="lvx-t">${esc(i.t)}</span>${i.c[0] ? `<span class="chip ${chipClass(i.c[0])}">${esc(i.c[0])}</span>` : ''}${more ? '<span class="chev" aria-hidden="true"></span>' : ''}</button>${op ? `<div class="lvx-m">${itemMore(i, i.c.slice(1))}</div>` : ''}</li>`; }).join('');
  return `<div class="lvx"><div class="lvx-h"><b>${esc(sec.title)}</b><span class="lvx-n">${done}/${items.length}</span><i class="fo-bar"><u style="width:${items.length ? done / items.length * 100 : 0}%"></u></i></div>
    ${sec.note ? `<p class="lvx-note">${esc(sec.note)}</p>` : ''}${sec.kind ? actStrip(sec) : sec.xm ? xmStrip(sec.xm) : ''}${rows ? `<ul class="lvx-l">${rows}</ul>` : ''}
    <button type="button" class="linkb lvx-go" data-jump="${LIVE.to.join(':')}">${esc(W.wkFull)} →</button></div>`;
}
$('live').addEventListener('click', e => {
  if (e.target.closest('[data-lvx]')) { LIVE.x = !LIVE.x; renderLive(); return; }
  const li = e.target.closest('[data-lvi]'); if (li) { const xo = LIVE.xo || (LIVE.xo = new Set()), id = li.dataset.lvi; xo.has(id) ? xo.delete(id) : xo.add(id); renderLive(); return; }
  const jf = e.target.closest('[data-jump]'); if (jf) { const [t, id] = jf.dataset.jump.split(':'); jumpTo(t, id); return; }
  const b = e.target.closest('[data-lv]'); if (!b) return; const m = LIVE.mem[+b.dataset.lv]; if (!m) return;
  FD.q = ''; FD.results = null;
  openCtx({ name: m.name, type: m.type, id: m.id }, { p: m.p, cid: m.cid, B: m.B });
  if (!m.B && !m.priv) fetchBuild(m.p, m.cid).then(B => { m.B = B; if (FD.sel?.id === m.id) { FD.B = B; renderFind(); } });
});
/* ---------- Beta: lista de desejos ---------- */
// arquétipo da armadura (encaixe "armor_archetypes"): a descrição em inglês diz o atributo primário e o secundário
const STAT_EN = { weapons: 2996146975, health: 392767087, class: 1943323491, grenade: 1735777505, super: 144602215, melee: 4244567218 };
const archParse = (t, n) => { const g = re => STAT_EN[(re.exec(t || '')?.[1] || '').toLowerCase()] || null; return { an: n || '', s1: g(/Primary Stat:\s*(\w+)/i), s2: g(/Secondary Stat:\s*(\w+)/i) }; };
function armArch(B, sockets) {
  const all = (sockets?.sockets || []).map(x => x.plugHash).filter(Boolean), h = all.find(x => B.en[x]?.pc === 'armor_archetypes');
  const r = h && B.en[h].d ? archParse(B.en[h].d, (B.loc[h] || B.en[h]).n) : {};
  return { ...r, pl: all }; // sem a descrição ainda: o clique na estrela busca o encaixe
}
const WEAPON_BUCKETS = [1498876634, 2465295065, 953998645], ARMOR_BUCKETS = [3448274439, 3551918588, 14239492, 20886954, 1585787867];
const wishList = () => LS.get('dc-wish', []);
const wishKey = n => String(n || '').toLowerCase().replace(/\s*\((adept|adepta)\)$/, '');
const wishHas = (h, n) => (!!h || !!n) && wishList().some(x => x.h === h || (n && wishKey(x.n) === wishKey(n)));
const wishBtn = w => `<button type="button" class="wish-b" data-wish="${w.h}" data-wn="${esc(w.n)}" data-wi="${esc(w.ic || '')}" data-wt="${esc(w.tl || '')}"${w.a ? ` data-wa="1" data-ws="${w.s1 || ''},${w.s2 || ''}" data-wan="${esc(w.an || '')}" data-wpl="${(w.pl || []).join(',')}"` : ''}${(w.p || w.perks)?.length ? ` data-wp="${esc(JSON.stringify((w.p || w.perks).filter(x => x.k !== 'mw').slice(0, 8).map(x => ({ n: x.n, ic: x.ic }))))}"` : ''} aria-pressed="${wishHas(w.h, w.n)}" title="${esc(u().wishT)}">${wishHas(w.h, w.n) ? '★' : '☆'}</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-wish]'); if (!b) return; e.stopPropagation();
  const h = +b.dataset.wish, l = wishList(), i = l.findIndex(x => x.h === h || (b.dataset.wn && wishKey(x.n) === wishKey(b.dataset.wn)));
  if (i >= 0) l.splice(i, 1); else { let p = []; try { p = JSON.parse(b.dataset.wp || '[]'); } catch {} const [s1, s2] = (b.dataset.ws || '').split(',').map(x => +x || null); l.unshift({ h, n: b.dataset.wn, ic: b.dataset.wi, tl: b.dataset.wt, p, ...(b.dataset.wa ? { a: 1, s1, s2, an: b.dataset.wan || '' } : {}), at: Date.now() }); }
  LS.set('dc-wish', l.slice(0, 40));
  // armadura sem o arquétipo conhecido: lê o encaixe agora (definição em inglês, que traz "Primary Stat"/"Secondary Stat") e completa a entrada
  if (i < 0 && b.dataset.wa && !l[0].s1 && b.dataset.wpl) { const hs = b.dataset.wpl.split(',').map(Number); entities('DestinyInventoryItemDefinition', hs, 'en', true).then(async en => { const a = hs.find(x => en[x]?.pc === 'armor_archetypes'); if (!a) return; const loc = lang === 'en' ? en : await entities('DestinyInventoryItemDefinition', [a], 'pt').catch(() => en); const r = archParse(en[a].d, (loc[a] || en[a]).n); const L2 = wishList(), e2 = L2.find(x => x.h === h); if (!e2) return; Object.assign(e2, r); LS.set('dc-wish', L2); if (tab === 'obj' || isGd()) render(); }).catch(() => {}); }
  // a estrela pode estar fora da lista principal (tela da build, busca de guardião): atualiza todas na hora
  document.querySelectorAll('[data-wish]').forEach(x => { const on = wishHas(+x.dataset.wish, x.dataset.wn); x.setAttribute('aria-pressed', on); if (x.dataset.wn) x.textContent = on ? '★' : '☆'; x.closest('.vd-w,.vd-fi,.b-row')?.classList.toggle('wished', on); });
  if (!b.closest('#build,#finddlg')) render(); else if (isGd() || tab === 'vend') render();
}, true);
// tudo que está à venda agora (vendedores carregados + Xûr) que está na lista
function wishOnSale() {
  const out = [], l = wishList(); if (!l.length) return out;
  for (const v of VEND || []) for (const w of [...(v.weapons || []), ...(v.focus || [])]) if (wishHas(w.h, w.n)) out.push({ ...w, who: v.name });
  for (const x of [...(XUR?.items || []), ...(XUR?.leg || [])]) if (wishHas(x.h, x.n)) out.push({ ...x, who: 'Xûr' });
  return out;
}
// armadura: atributo principal e secundário que você quer na peça
function wishStatSel(x) {
  if ((!STATD || STATD.lang !== lang) && !wishStatSel.busy) { wishStatSel.busy = true; entities('DestinyStatDefinition', STAT_ORDER, lang).then(d => { STATD = { lang, d }; if (tab === 'obj' || isGd()) render(); }).finally(() => { wishStatSel.busy = false; }); }
  const D = STATD?.d || {}, W = u();
  const sel = (k, lbl) => `<label class="wo-st"><small>${esc(lbl)}</small><select class="tsort-sel" data-wst="${k}" data-wh="${x.h}"><option value="">${esc(W.wishAny)}</option>${STAT_ORDER.map(h => `<option value="${h}"${x[k] === h ? ' selected' : ''}>${esc(D[h]?.n || '…')}</option>`).join('')}</select></label>`;
  return `<div class="wo-sts">${sel('s1', W.wishSt1)}${sel('s2', W.wishSt2)}</div>`;
}
const wishStatTxt = x => { const D = STATD?.d || {}; return x.a && (x.s1 || x.s2) ? [x.s1 && D[x.s1]?.n, x.s2 && D[x.s2]?.n].filter(Boolean).join(' + ') : ''; };
document.addEventListener('change', e => { const s = e.target.closest('[data-wst]'); if (!s) return; const l = wishList(), x = l.find(y => y.h === +s.dataset.wh); if (!x) return; x[s.dataset.wst] = +s.value || null; LS.set('dc-wish', l); });
// roll desejado editável: colunas de perks possíveis da arma (definição + conjuntos de encaixe, guardados no aparelho)
const WCOLS = LS.get('dc-wcols', {}), WRT = { pt: { edit: 'Editar roll', done: 'Pronto', any: 'qualquer', note: 'Toque nos perks que servem em cada coluna (pode marcar mais de um). Coluna sem nada marcado = qualquer.', none: 'Esta arma não tem perks aleatórios.', or: ' ou ' }, en: { edit: 'Edit roll', done: 'Done', any: 'any', note: 'Tap the perks you accept in each column (you can pick more than one). An empty column = any.', none: 'This weapon has no random perks.', or: ' or ' } };
const wrt = () => WRT[lang === 'pt' ? 'pt' : 'en'];
let WED = 0; const WCP = new Map();
const WSKIP_PC = /tracker|masterwork|shader|ornament|skins|mod|intrinsic|memento|catalyst|empty/i;
function wishCols(h) {
  if (WCOLS[h]) return WCOLS[h]; if (WCP.has(h)) return null;
  WCP.set(h, (async () => {
    const d = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false), so = d.sockets || {};
    const idx = (so.socketCategories || []).find(c => c.socketCategoryHash === 4241085061)?.socketIndexes || [];
    const cols = (await Promise.all(idx.map(async k => { const e = so.socketEntries?.[k] || {}, ps = e.randomizedPlugSetHash || e.reusablePlugSetHash;
      if (ps) { try { const p = await bungie(`/Destiny2/Manifest/DestinyPlugSetDefinition/${ps}/`, false); return [...new Set((p.reusablePlugItems || []).filter(x => x.currentlyCanRoll !== false).map(x => x.plugItemHash))]; } catch { return []; } }
      return [...new Set((e.reusablePlugItems || []).map(x => x.plugItemHash))]; }))).filter(c => c.length > 1);
    const en = await entities('DestinyInventoryItemDefinition', cols.flat(), lang === 'pt' ? 'pt' : 'en', true);
    // perk + versão aprimorada com o mesmo ícone: fica um só; colunas de rastreador, ornamento etc. saem
    WCOLS[h] = cols.map(c => { const seen = new Set(); return c.map(x => en[x]).map((e, i) => e && { h: c[i], n: e.n, ic: e.ic, pc: e.pc }).filter(e => e && e.n && !WSKIP_PC.test(e.pc || '') && !seen.has(e.ic) && seen.add(e.ic)).map(({ h, n, ic }) => ({ h, n, ic })); }).filter(c => c.length > 1);
    try { LS.set('dc-wcols', WCOLS); } catch {}
    if (tab === 'obj') render();
  })().catch(() => { WCOLS[h] = []; }));
  return null;
}
function wishSetRoll(h, fn) { const l = wishList(), x = l.find(y => y.h === h); if (!x) return; fn(x); LS.set('dc-wish', l); render(); }
function wishEditor(x) {
  const T = wrt(), cols = wishCols(x.h); if (!cols) return `<p class="wr-n wait">${esc(u().loadingDefs)}</p>`; if (!cols.length) return `<p class="wr-n">${esc(T.none)}</p>`;
  const r = x.r || cols.map(c => c.filter(o => (x.p || []).some(p => p.ic && p.ic === o.ic)));
  return `<div class="wr-ed"><p class="wr-n">${esc(T.note)}</p>${cols.map((c, k) => `<div class="wr-col">${c.map(o => { const on = (r[k] || []).some(y => y.h === o.h); return `<button type="button" class="wr-p${on ? ' on' : ''}" data-wrp="${x.h}:${k}:${o.h}" aria-pressed="${on}" title="${esc(o.n)}">${o.ic ? `<img src="${BNET}${o.ic}" alt="">` : ''}<span>${esc(o.n)}</span></button>`; }).join('')}</div>`).join('')}</div>`;
}
document.addEventListener('click', e => {
  const ed = e.target.closest('[data-wre]'); if (ed) { const h = +ed.dataset.wre; WED = WED === h ? 0 : h; render(); return; }
  const b = e.target.closest('[data-wrp]'); if (!b) return; const [h, k, ph] = b.dataset.wrp.split(':').map(Number), cols = WCOLS[h]; if (!cols) return;
  wishSetRoll(h, x => { const r = x.r || cols.map(c => c.filter(o => (x.p || []).some(p => p.ic && p.ic === o.ic))); const col = r[k] = r[k] || [], i = col.findIndex(y => y.h === ph); if (i >= 0) col.splice(i, 1); else { const o = cols[k].find(y => y.h === ph); if (o) col.push(o); } x.r = r; });
});
const wishRoll = x => x.r ? `<span class="wish-roll wr">${x.r.filter(c => c?.length).map(c => `<span>${c.map(p => `${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}${esc(p.n)}`).join(`<i>${esc(wrt().or)}</i>`)}</span>`).join('')}</span>` : x.p?.length ? `<span class="wish-roll">${x.p.map(p => `<span>${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}${esc(p.n)}</span>`).join('')}</span>` : '';
/* Objetivos: armas da lista de desejos com o rolo guardado, onde dropam (fonte da coleção) e se estão à venda agora */
let wishLoading = false;
function wishObjHTML() {
  const l = wishList(); if (!l.length) return '';
  const W = u(), open = !openSecs.has('wish-x'), sale = wishOnSale();
  const need = l.filter(x => COLL[x.h] === undefined || (COLL[x.h] && CSRC[COLL[x.h] + ':' + lang] == null));
  if (need.length && !wishLoading) { wishLoading = true; Promise.all(need.map(x => (COLL[x.h] === undefined ? idef(x.h).then(d => { COLL[x.h] = d.c; }) : Promise.resolve()).then(() => collSrc(x.h)))).finally(() => { wishLoading = false; if (tab === 'obj') render(); }); }
  if (!VEND && !vendLoading && have.a) setTimeout(() => { if (!VEND && !vendLoading) loadVendors(gen); }, 2000);
  const card = x => { const s = sale.find(y => y.h === x.h || wishKey(y.n) === wishKey(x.n)), src = COLL[x.h] ? CSRC[COLL[x.h] + ':' + lang] : ''; const own = COLL[x.h] ? colAcquired([COLL[x.h]]) : null;
    return `<div class="wo-c${s ? ' sale' : ''}"><div class="wo-h">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<span><b>${esc(x.n)}</b><small>${esc([x.tl, x.an].filter(Boolean).join(' · '))}${own ? ` · ${esc(W.wishHave)}` : ''}</small></span><button type="button" class="wish-b" data-wish="${x.h}" aria-pressed="true" aria-label="${esc(W.glDel)}">★</button></div>${x.a ? wishStatSel(x) : `${wishRoll(x)}<button type="button" class="linkb wr-btn" data-wre="${x.h}" aria-expanded="${WED === x.h}">${esc(WED === x.h ? wrt().done : wrt().edit)}</button>${WED === x.h ? wishEditor(x) : ''}`}${s ? `<p class="wo-sale">◆ ${esc(W.wishSale(s.who))}</p>` : ''}<p class="wo-src">${src ? esc(src) : esc(wishLoading ? W.loadingDefs : W.wishNoSrc)}</p></div>`; };
  return `<section data-sec="wishobj" class="keep wo coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="wish-x" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>★ ${esc(W.wishT)}</h2></div><span class="count">${l.length}</span><span class="chev" aria-hidden="true"></span></div><p>${esc(sale.length ? W.wishOnSaleN(sale.length) : W.wishObjNote)}</p></div><div class="wo-g">${l.map(card).join('')}</div></section>`;
}
function wishHTML() {
  const W = u(), l = wishList(), sale = wishOnSale();
  return `<article class="gd"><div class="gd-head"><h2>★ ${esc(W.wishT)}</h2></div><p>${esc(W.wishNote)}</p>${l.length ? `<ul class="sq wish-l">${l.map(x => { const s = sale.find(y => y.h === x.h || wishKey(y.n) === wishKey(x.n)); return `<li class="${s ? 'on' : ''}">${x.ic ? `<img src="${BNET}${x.ic}" alt="" loading="lazy">` : ''}<span class="sq-n">${esc(x.n)}<small>${esc(s ? W.wishSale(s.who) : [x.tl, wishStatTxt(x)].filter(Boolean).join(' · '))}</small>${wishRoll(x)}</span><button type="button" class="wish-x" data-wish="${x.h}" aria-label="${esc(W.glDel)}">✕</button></li>`; }).join('')}</ul>` : `<p class="wish-none">${esc(W.wishNone)}</p>`}</article>`;
}
/* ---------- Beta: Hoje (rotação diária): o que muda no reset diário, a partir das lojas ---------- */
const dailyReset = () => { const d = new Date(); d.setUTCHours(17, 0, 0, 0); if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); };
function todayHTML() {
  if (!have.a || !member) return '';
  if (!VEND && !vendLoading) setTimeout(() => { if (!VEND && !vendLoading) loadVendors(gen); }, 1500);
  const W = u(), now = Date.now(), open = !openSecs.has('today-x');
  const sale = wishOnSale(), xm = xurMissing();
  const day = (VEND || []).filter(v => !v.failed && v.until && Date.parse(v.until) - now < 26 * 3600e3 && v.weapons?.length);
  const rows = day.flatMap(v => v.weapons.map(w => ({ ...w, who: v.name }))).sort((a, b) => (wishHas(b.h) - wishHas(a.h)) || ((a.owned === false ? 0 : 1) - (b.owned === false ? 0 : 1)));
  const card = w => `<div class="td-w${wishHas(w.h) ? ' wished' : ''}${w.owned === false ? ' miss' : ''}">${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : ''}<div><b>${esc(w.n)}</b><small>${esc(w.who)} · ${esc(w.tl)}</small></div>${wishHas(w.h) ? `<span class="chip hot">★ ${esc(W.wishShort)}</span>` : w.owned === false ? `<span class="chip hot">${esc(W.w.notOwned)}</span>` : ''}${wishBtn(w)}</div>`;
  return `<section data-sec="today" class="keep today coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="today-x" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>${esc(W.todayT)}</h2></div><span class="chev" aria-hidden="true"></span></div>
    <p>${esc(W.todayReset(cd(dailyReset() - now)))}</p>${sale.length ? `<ul class="wk-nl">${sale.map(x => `<li><span>★ ${esc(W.wishShort)}</span> ${esc(x.n)} · ${esc(x.who)}</li>`).join('')}</ul>` : ''}</div>
    <div class="td-body">${!VEND ? `<p class="vd-note wait">${esc(W.loadingDefs)}</p>` : rows.length ? `<div class="td-g">${rows.map(card).join('')}</div>` : `<p class="vd-note">${esc(W.todayNone)}</p>`}${xm.length && XUR?.until && Date.parse(XUR.until) > now ? `<p class="td-x" data-jump="vend:vendors" role="button" tabindex="0">◆ ${esc(W.w.xurSells(xm.map(x => x.n).join(', ')))} →</p>` : ''}<p class="vd-note">${esc(W.todayNote)}</p></div></section>`;
}
/* ---------- Beta: métricas de outros guardiões (conclusões de incursões/masmorras), com cache de 1 dia ---------- */
const GMET = LS.get('dc-gmet', {});
const ACT_METRICS = () => [...defs.raids.map(a => ['raid', a]), ...defs.dungeons.map(a => ['dg', a])].filter(([, a]) => a.m);
async function guardianMetrics(mt, mid) {
  const c = GMET[mid]; if (c && Date.now() - c.at < 864e5) return c;
  let v;
  try { const r = await bungie(`/Destiny2/${mt}/Profile/${mid}/?components=100,1100`, false); const m = r.metrics?.data?.metrics; v = { at: Date.now(), priv: !m, gr: r.profile?.data?.currentGuardianRank || 0, m: m ? Object.fromEntries(ACT_METRICS().map(([, a]) => [a.m, m[a.m]?.objectiveProgress?.progress || 0])) : {} }; }
  catch { v = { at: Date.now(), priv: true, m: {} }; }
  GMET[mid] = v; try { LS.set('dc-gmet', GMET); } catch {} return v;
}
const CLCK = { busy: false, n: 0, open: LS.get('dc-clck-open', true), f: LS.get('dc-clck-f', 'all') };
async function loadClanCk() {
  const list = GD?.clan?.list || []; if (CLCK.busy || !list.length) return; CLCK.busy = true; CLCK.n = 0; render();
  let i = 0; const next = async () => { while (i < list.length) { const x = list[i++]; await guardianMetrics(x.mt, x.mid); CLCK.n++; if (CLCK.n % 4 === 0 && isGd()) render(); } };
  await Promise.all(Array.from({ length: 5 }, next)); CLCK.busy = false; CLCK.done = true; if (isGd()) render();
}
function clanCkHTML() {
  const W = u(), list = GD?.clan?.list || []; if (!list.length) return '';
  const got = list.filter(x => GMET[x.mid]), pub = got.filter(x => !GMET[x.mid].priv);
  const head = `<article class="gd clck-a${CLCK.open ? '' : ' shut'}"><button type="button" class="gd-head clck-h" data-clcko aria-expanded="${CLCK.open}"><h2>${esc(W.clckT)}</h2><span class="chev" aria-hidden="true"></span></button>${CLCK.open ? '' : `<p>${esc(W.clckNote)}</p></article>`}`;
  if (!CLCK.open) return head;
  if (!got.length || CLCK.busy && !CLCK.done) return head + `<p>${esc(W.clckNote)}</p><button type="button" class="char clck-b" data-clck ${CLCK.busy ? 'disabled' : ''}>${esc(CLCK.busy ? W.clckLoading(CLCK.n, list.length) : W.clckBtn(list.length))}</button></article>`;
  const rows = ACT_METRICS().filter(([k]) => CLCK.f === 'all' || CLCK.f === k).map(([k, a]) => { const done = pub.filter(x => GMET[x.mid].m[a.m] > 0), never = pub.filter(x => !(GMET[x.mid].m[a.m] > 0)); return { k, a, done, never }; });
  const fb = [['all', W.clckAllF], ['raid', W.subs.raid], ['dg', W.subs.dg]].map(([k, t]) => `<button type="button" class="char" data-clckf="${k}" aria-pressed="${CLCK.f === k}">${esc(t)}</button>`).join('');
  return head + `<div class="clck-fb">${fb}</div><div class="clck">${rows.map(r => `<details class="clck-r"><summary><span class="clck-n">${esc((r.k === 'raid' ? W.w.raidW : W.w.dgW) + ' ' + L(r.a.n))}</span><span class="clck-c">${r.done.length}/${pub.length}</span><i style="--p:${pub.length ? r.done.length / pub.length * 100 : 0}%"></i></summary>${r.never.length ? `<p><b>${esc(W.clckNever)}</b> ${r.never.map(x => `<span class="clck-p">${esc(x.n)}</span>`).join('')}</p>` : `<p>${esc(W.clckAll)}</p>`}</details>`).join('')}</div><p class="clck-f">${esc(W.clckPriv(got.length - pub.length))} <button type="button" class="linkb" data-clck>${esc(W.clckRe)}</button></p></article>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-clcko]')) { CLCK.open = !CLCK.open; LS.set('dc-clck-open', CLCK.open); render(); return; }
  const f = e.target.closest('[data-clckf]'); if (f) { CLCK.f = f.dataset.clckf; LS.set('dc-clck-f', CLCK.f); render(); return; }
  if (e.target.closest('[data-clck]')) { for (const x of GD?.clan?.list || []) delete GMET[x.mid]; CLCK.done = false; loadClanCk(); } });
/* ---------- Beta: montador de loadout ----------
   Lê as armaduras, armas, subclasses e artefatos (cofre + personagens) direto da Bungie, só quando a ferramenta é aberta;
   testa as combinações aqui no navegador e manda a escolhida para o DIM (o DPI não equipa nada).
   Abre numa janela própria (tela cheia no celular): controles à esquerda, resultados à direita. */
const LBT = {
  pt: { open: 'Abrir montador', card: 'Monte a melhor combinação de armaduras para qualquer personagem, com subclasse, armas, mods e artefato, e mande para o DIM.', s1: '1. Personagem e subclasse', s2: '2. Exótico', s3: '3. Atributos que importam', s3n: 'Use as setas para ordenar; o mínimo é opcional.', s4: '4. Bônus de conjunto', s6: '8. Artefato', s7: '9. Mods', ch: 'Personagem', sub: 'Subclasse', subCur: n => `${n} (equipada)`, subNone: 'Não levar subclasse', subTap: 'Toque num encaixe para trocar.', subG: { 309722977: 'Habilidades', 457473665: 'Super', 2140934067: 'Aspectos', 1313488945: 'Fragmentos' }, frag: n => `Fragmentos (${n} encaixes pelos aspectos)`, used: 'já em uso', wpCur: 'Equipadas', wpPick: 'Escolher', wpNone: 'Não levar', wpSlot: ['Cinética', 'Energética', 'Pesada'], wpNo: 'Não levar', wpNoD: 'o DIM mantém a arma que estiver equipada', wpBack: 'Voltar à equipada', mods: 'Levar os mods de armadura atuais', modsN: n => `${n} mods: o DIM redistribui nas peças novas`, art: 'Levar artefato', artNo: 'Nenhum artefato encontrado.', artTap: 'Toque numa vantagem para trocar. Os pontos do artefato continuam valendo no jogo.', res: 'Melhores combinações', meta: (n, s) => `${n} testadas em ${s} s · 4 melhores`, cur: 'Atual', idle: 'Escolha as opções e toque em “Buscar combinações”.', restNote: 'Os totais somam a armadura com o que o personagem já ganha fora dela (subclasse, fragmentos, artefato) hoje. Trocar fragmentos ou artefato pode mudar esses valores no jogo.', foot: '“Aplicar” (beta) monta direto na sua conta, sempre com confirmação antes.', wpExo: 'Duas armas exóticas: o DIM só vai equipar uma.', reset: 'Voltar ao que está equipado', eqd: 'equipada', save: 'Salvar', saved: 'Salva ✓', savedT: n => `Montador · ${n}`, copy: 'Copiar link do DIM', copied: 'Link copiado!', setOn: 'ativo', setOff: c => `com ${c} peças`, clan: 'Em teste, por enquanto só para o clã Orla Emaranhada. Pode ter erros: confira o resultado no jogo.', mMan: 'Montar', mOpt: 'Otimizar armaduras', mT: 'Montagem de build', mCard: 'Monte sua build peça por peça (subclasse, armas, armaduras, artefato e mods) ou deixe o DPI achar a melhor combinação de armaduras. Dá para salvar e aplicar direto na conta.', mOpenMan: 'Montar build', mOpenOpt: 'Otimizar armaduras', aSlot: ['Capacete', 'Manoplas', 'Peitoral', 'Botas', 'Item de classe'], aNo: 'Nenhuma peça desta classe aqui.', sumT: 'Sua build', toOpt: 'Otimizar armaduras →', use: 'Montar com esta', exo2: 'Duas armaduras exóticas: o jogo só deixa usar uma.', ldShort: 'Montar loadout', tot: 'total', nmPh: 'Nome da build', nmOk: 'Salvar', nmX: 'Cancelar', lcIn: 'Limpeza do cofre', lcInD: 'Ache armaduras piores em tudo e armas repetidas, e leve para o personagem para desmontar.', lcBtn: 'Abrir limpeza', inGame: 'No jogo', onSite: 'Criados no site', onSiteN: 'Builds que você salvou no DPI (montagem, otimizador ou de uma build sua). Aplique na conta ou grave num loadout do jogo para usar até no console.', toGame: 'Gravar no jogo', slotT: 'Gravar em qual loadout do jogo?', slotE: n => `Espaço ${n} · vazio`, slotNote: 'O DPI aplica a build e grava no espaço escolhido (substitui o que estiver lá). Nome e ícone você escolhe no jogo.', see: 'Ver a build', del: 'Apagar', delQ: 'Apagar mesmo?', prep: 'Preparar', prepT: n => `Preparar: ${n}`, prepNone: 'Nenhuma build ligada a esta atividade ainda. Escolha uma para ligar:', prepAdd: 'Ligar', prepMore: 'Ligar outra build' },
  en: { open: 'Open builder', card: 'Build the best armor combination for any character, with subclass, weapons, mods and artifact, and send it to DIM.', s1: '1. Character and subclass', s2: '2. Exotic', s3: '3. Stats that matter', s3n: 'Use the arrows to sort; the minimum is optional.', s4: '4. Set bonus', s6: '8. Artifact', s7: '9. Mods', ch: 'Character', sub: 'Subclass', subCur: n => `${n} (equipped)`, subNone: "Don't include a subclass", subTap: 'Tap a socket to change it.', subG: { 309722977: 'Abilities', 457473665: 'Super', 2140934067: 'Aspects', 1313488945: 'Fragments' }, frag: n => `Fragments (${n} slots from aspects)`, used: 'already in use', wpCur: 'Equipped', wpPick: 'Choose', wpNone: "Don't include", wpSlot: ['Kinetic', 'Energy', 'Power'], wpNo: "Don't include", wpNoD: 'DIM keeps whatever is equipped', wpBack: 'Back to equipped', mods: 'Bring current armor mods', modsN: n => `${n} mods: DIM reassigns them to the new pieces`, art: 'Bring artifact', artNo: 'No artifact found.', artTap: 'Tap a perk to change it. Artifact points still apply in game.', res: 'Best combinations', meta: (n, s) => `${n} tested in ${s} s · top 4`, cur: 'Current', idle: 'Pick your options and tap “Find combinations”.', restNote: 'Totals add the armor to what the character gets outside it today (subclass, fragments, artifact). Changing fragments or artifact can change those values in game.', foot: '“Apply” (beta) sets it up right on your account, always with a confirmation first.', wpExo: 'Two exotic weapons: DIM will only equip one.', reset: 'Back to what is equipped', eqd: 'equipped', save: 'Save', saved: 'Saved ✓', savedT: n => `Builder · ${n}`, copy: 'Copy DIM link', copied: 'Link copied!', setOn: 'active', setOff: c => `with ${c} pieces`, clan: 'In testing, for now only for the Orla Emaranhada clan. It may have bugs: check the result in game.', mMan: 'Build', mOpt: 'Optimize armor', mT: 'Build editor', mCard: 'Build piece by piece (subclass, weapons, armor, artifact and mods) or let DPI find the best armor combination. Save it or apply it right to your account.', mOpenMan: 'Build manually', mOpenOpt: 'Optimize armor', aSlot: ['Helmet', 'Gauntlets', 'Chest', 'Legs', 'Class item'], aNo: 'No piece for this class here.', sumT: 'Your build', toOpt: 'Optimize armor →', use: 'Build with this', exo2: 'Two exotic armor pieces: the game only allows one.', ldShort: 'Build a loadout', tot: 'total', nmPh: 'Build name', nmOk: 'Save', nmX: 'Cancel', lcIn: 'Vault cleanup', lcInD: 'Find armor that is worse in everything and duplicate weapons, and move them to the character to dismantle.', lcBtn: 'Open cleanup', inGame: 'In game', onSite: 'Made on the site', onSiteN: 'Builds you saved in DPI (editor, optimizer or one of your builds). Apply them or store them in an in-game loadout to use even on console.', toGame: 'Store in game', slotT: 'Store in which in-game loadout?', slotE: n => `Slot ${n} · empty`, slotNote: 'DPI applies the build and stores it in the chosen slot (replacing what is there). Pick the name and icon in game.', see: 'See the build', del: 'Delete', delQ: 'Really delete?', prep: 'Prepare', prepT: n => `Prepare: ${n}`, prepNone: 'No build linked to this activity yet. Pick one to link:', prepAdd: 'Link', prepMore: 'Link another build' },
};
const lw = () => LBT[lang === 'pt' ? 'pt' : 'en'];
const LBO = LS.get('dc-lb-opt', {});
const LB = { st: 'idle', pieces: null, cid: null, exo: 'any', prio: LS.get('dc-lb-prio', STAT_ORDER.slice()), min: LS.get('dc-lb-min', {}), set: '', need: 2, res: null, n: 0, ms: 0,
  mode: 'man', a: {}, sub: 'cur', wp: LBO.wp || 'cur', w: {}, mods: LBO.mods !== false, art: LBO.art !== false, artSel: '', so: {}, ao: {}, pick: '',
  wpns: [], subs: {}, arts: {}, eq: {}, sk: {}, en: {}, pp: {}, cp: {}, season: 0 };
const lbWEq = s => (LB.eq[LB.cid] || []).find(i => i.bucketHash === WEAPON_B[s])?.itemInstanceId || '';
// última configuração de cada personagem (só neste aparelho): exótico, conjunto, subclasse e encaixes, armas, artefato
const LBCFG = LS.get('dc-lb-cfg', {});
function lbCfgSave() {
  if (!LB.cid || LB.st !== 'ready') return;
  LBCFG[LB.cid] = { exo: LB.exo, set: LB.set, need: LB.need, sub: LB.sub, w: LB.w, a: LB.a, artSel: LB.artSel, so: LB.so, ao: LB.ao };
  try { LS.set('dc-lb-cfg', LBCFG); } catch {}
}
function lbCfgLoad() {
  const c = LBCFG[LB.cid] || {}, has = id => !id || id === 'cur' || Object.values(LB.subs).flat().concat(Object.values(LB.arts).flat()).some(x => x.itemInstanceId === id);
  LB.exo = c.exo || 'any'; LB.set = c.set || ''; LB.need = c.need || 2; LB.sub = has(c.sub) ? (c.sub ?? 'cur') : 'cur'; LB.artSel = has(c.artSel) ? c.artSel || '' : '';
  LB.so = Object.assign(LB.so, c.so || {}); LB.ao = Object.assign(LB.ao, c.ao || {});
  LB.w = {}; for (const [k, id] of Object.entries(c.w || {})) if (!id || LB.wpns.some(w => w.id === id)) LB.w[k] = id; lbWDef();
  LB.a = {}; for (const [k, id] of Object.entries(c.a || {})) if (!id || LB.pieces.some(p => p.id === id)) LB.a[k] = id; lbADef();
}
const lbADef = () => { for (const s of [0, 1, 2, 3, 4]) if (LB.a[s] === undefined) LB.a[s] = (LB.pieces || []).find(p => p.slot === s && p.eqc === LB.cid)?.id || ''; };
const lbWDef = () => { for (const s of [0, 1, 2]) if (LB.w[s] === undefined) LB.w[s] = lbWEq(s); };
const LBCOL = Object.assign({ w0: 1, w1: 1, w2: 1, s6: 1, s7: 1 }, LS.get('dc-lb-col', {}));
// cabeçalho de seção recolhível: fechada, mostra só o título e o resumo da escolha atual
const lbSec = (k, title, sum, body, extra = '') => `<section class="lbd-s${LBCOL[k] ? ' col' : ''}"><div class="lbd-th" data-lbcol="${k}"><h2><button type="button" aria-expanded="${LBCOL[k] ? 'false' : 'true'}">${esc(title)}</button></h2>${LBCOL[k] && sum ? `<span class="lbd-sum">${sum}</span>` : ''}${extra}<i class="lbd-car" aria-hidden="true"></i></div>${body}</section>`;
// munição das armas: vem junto com o nome (cache do servidor); o que faltar busca aos poucos e fica guardado
function lbAmmo() {
  const need = [...new Set(LB.wpns.map(w => w.h))].filter(h => !IDEF[h]); if (!need.length || lbReq.has('ammo')) return; lbReq.add('ammo'); let i = 0;
  Promise.all(Array.from({ length: 6 }, async () => { while (i < need.length) { try { await idef(need[i++]); } catch {} } })).then(() => { lbReq.delete('ammo'); lbDraw(); if ($('lcdlg')?.open) lcDraw(); });
}
const lbSaveOpt = () => { try { LS.set('dc-lb-opt', { wp: LB.wp, mods: LB.mods, art: LB.art }); } catch {} };
const ADEF = LS.get('dc-adef', {}), SOCKD = LS.get('dc-sockdef', {}), ACAP = LS.get('dc-acap', {}), lbReq = new Set();
async function armorDef(h) {
  if (ADEF[h]) return ADEF[h];
  try { const d = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false); ADEF[h] = { k: d.classType, s: d.equippingBlock?.equipableItemSetHash || 0, t: d.inventory?.tierType || 0, b: d.inventory?.bucketTypeHash || 0, n: d.displayProperties?.name || '', ic: d.displayProperties?.icon || '' }; } catch { ADEF[h] = null; }
  return ADEF[h];
}
// encaixes de subclasse/artefato: categorias e o conjunto de opções de cada encaixe (definição pequena, guardada no aparelho)
function sockDef(h) {
  if (SOCKD[h] || lbReq.has('s' + h)) return SOCKD[h] || null; lbReq.add('s' + h);
  bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false).then(d => { SOCKD[h] = { c: (d.sockets?.socketCategories || []).map(c => [c.socketCategoryHash, c.socketIndexes]), p: (d.sockets?.socketEntries || []).map(e => e.reusablePlugSetHash || e.randomizedPlugSetHash || 0) }; try { LS.set('dc-sockdef', SOCKD); } catch {} lbDraw(); }).catch(() => {});
  return null;
}
// quantos fragmentos cada aspecto libera
function aspCap(h) {
  if (ACAP[h] != null) return ACAP[h]; if (!h || lbReq.has('a' + h)) return null; lbReq.add('a' + h);
  bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false).then(d => { ACAP[h] = d.plug?.energyCapacity?.capacityValue || 0; try { LS.set('dc-acap', ACAP); } catch {} lbDraw(); }).catch(() => {});
  return null;
}
function lbNames(hs) {
  const need = [...new Set(hs)].filter(h => h && !LB.en[h] && !lbReq.has('e' + h)); if (!need.length) return;
  need.forEach(h => lbReq.add('e' + h));
  entities('DestinyInventoryItemDefinition', need, lang === 'pt' ? 'pt' : 'en').then(r => { Object.assign(LB.en, r); lbDraw(); if ($('lcdlg')?.open) lcDraw(); }).catch(() => {});
}
const lbOpts = ps => { const l = (LB.cp[LB.cid] || {})[ps] || LB.pp[ps] || []; return [...new Set(l.filter(x => x.canInsert !== false && x.enabled !== false).map(x => x.plugItemHash))]; };
const lbChar = () => profile?.characters?.data?.[LB.cid] || profile?.characters?.data?.[charId];
async function lbLoad() {
  if (LB.st === 'loading') return; LB.st = 'loading'; LB.res = null; LC.base = null; LB.cid = LB.cid || charId; lbDraw();
  try {
    const r = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/?components=102,201,205,300,304,305`);
    const stats = r.itemComponents?.stats?.data || {}, raw = [], wraw = [], L = lang === 'pt' ? 'pt' : 'en';
    LB.sk = r.itemComponents?.sockets?.data || {}; LB.eq = {}; LB.subs = {}; LB.arts = {};
    LB.pp = r.profilePlugSets?.data?.plugs || {}; LB.cp = Object.fromEntries(Object.entries(r.characterPlugSets?.data || {}).map(([c, v]) => [c, v.plugs || {}]));
    const put = (m, cid, it, first) => { (m[cid] = m[cid] || [])[first ? 'unshift' : 'push'](it); };
    for (const it of r.profileInventory?.data?.items || []) if (it.itemInstanceId) { const c = ITEMS[it.itemHash]; if (c != null && Math.floor(c / 100) <= 2) wraw.push({ it, slot: Math.floor(c / 100) }); else raw.push({ it, where: 'v' }); }
    for (const [cid, c] of Object.entries(r.characterInventories?.data || {})) for (const it of c.items || []) if (it.itemInstanceId) {
      if (ARMOR_BUCKETS.includes(it.bucketHash)) raw.push({ it, where: cid }); else if (WEAPON_B.includes(it.bucketHash)) wraw.push({ it, slot: WEAPON_B.indexOf(it.bucketHash) });
      else if (it.bucketHash === SUB_BUCKET) put(LB.subs, cid, it); else if (it.bucketHash === ARTIFACT_BUCKET) put(LB.arts, cid, it);
    }
    for (const [cid, c] of Object.entries(r.characterEquipment?.data || {})) { LB.eq[cid] = c.items || []; for (const it of c.items || []) if (it.itemInstanceId) {
      if (ARMOR_BUCKETS.includes(it.bucketHash)) raw.push({ it, where: cid, eq: cid }); else if (WEAPON_B.includes(it.bucketHash)) wraw.push({ it, slot: WEAPON_B.indexOf(it.bucketHash), eq: cid });
      else if (it.bucketHash === SUB_BUCKET) put(LB.subs, cid, it, true); else if (it.bucketHash === ARTIFACT_BUCKET) put(LB.arts, cid, it, true);
    } }
    // a tabela de itens do site já diz espaço/classe da maioria: só busca a definição do que é armadura (ou desconhecido)
    const cand = raw.filter(x => { if (!stats[x.it.itemInstanceId]?.stats) return false; const code = ITEMS[x.it.itemHash]; return code == null || Math.floor(code / 100) >= 3; });
    const hs = [...new Set(cand.map(x => x.it.itemHash))]; let i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => { while (i < hs.length) await armorDef(hs[i++]); }));
    try { LS.set('dc-adef', ADEF); } catch {}
    LB.pieces = cand.map(x => { const d = ADEF[x.it.itemHash]; if (!d || d.k > 2 || !ARMOR_BUCKETS.includes(d.b)) return null; const sv = stats[x.it.itemInstanceId].stats; return { id: x.it.itemInstanceId, h: x.it.itemHash, k: d.k, slot: ARMOR_BUCKETS.indexOf(d.b), set: d.s, exo: d.t === 6, n: d.n, ic: d.ic, where: x.where, eqc: x.eq || '', lk: !!(x.it.state & 1), st: STAT_ORDER.map(h => sv[h]?.value || 0) }; }).filter(Boolean);
    // nomes de armas, subclasses, artefatos e encaixes atuais: uma leva só, quase tudo já está no cache
    const plugs = [], holders = [...Object.values(LB.eq).flat().filter(it => ARMOR_BUCKETS.includes(it.bucketHash)), ...Object.values(LB.subs).flat(), ...Object.values(LB.arts).flat()];
    for (const it of holders) for (const s of LB.sk[it.itemInstanceId]?.sockets || []) if (s.plugHash) plugs.push(s.plugHash);
    const names = [...wraw.map(x => x.it.itemHash), ...Object.values(LB.subs).flat().map(x => x.itemHash), ...Object.values(LB.arts).flat().map(x => x.itemHash)];
    const [a, b] = await Promise.all([entities('DestinyInventoryItemDefinition', names, L), entities('DestinyInventoryItemDefinition', plugs, L, true)]);
    Object.assign(LB.en, a, b);
    const inst = LB.inst = r.itemComponents?.instances?.data || {};
    LB.wpns = wraw.map(x => { const ii = inst[x.it.itemInstanceId] || {}; return { id: x.it.itemInstanceId, h: x.it.itemHash, slot: x.slot, eqc: x.eq || '', lk: !!(x.it.state & 1), n: LB.en[x.it.itemHash]?.n || '', ic: LB.en[x.it.itemHash]?.ic || '', exo: LB.en[x.it.itemHash]?.tt === 6, pw: ii.primaryStat?.value || 0, el: ELEMENTS[ii.damageType] || '' }; }).filter(w => w.n && w.slot >= 0).sort((p, q) => (q.exo - p.exo) || (q.pw - p.pw) || p.n.localeCompare(q.n));
    const sh = profile?.profile?.data?.currentSeasonHash;
    if (sh && !LB.season) bungie(`/Destiny2/Manifest/DestinySeasonDefinition/${sh}/`, false).then(d => { LB.season = d?.seasonNumber || 0; }).catch(() => {});
    LB.st = 'ready'; lbCfgLoad(); lbAmmo();
    for (const s of new Set(LB.pieces.map(p => p.set).filter(Boolean))) if (!SETDEF[s + ':' + (lang === 'pt' ? 'pt-br' : 'en')]) setDef(s, lang === 'pt' ? 'pt-br' : 'en').then(lbDraw);
  } catch (e) { LB.st = 'err'; }
  lbDraw(); if ($('lcdlg')?.open) lcDraw();
}
// o resto (subclasse, fragmentos, artefato) = atributos do personagem menos o que a armadura equipada dá
function lbRest() {
  const ch = lbChar(), st = ch?.stats || {}, cur = STAT_ORDER.map(h => st[h] || 0), eqP = (LB.pieces || []).filter(p => p.eqc === LB.cid);
  return { cur, rest: cur.map((v, k) => v - eqP.reduce((t, p) => t + p.st[k], 0)) };
}
async function lbRun() {
  if (!LB.pieces) return; LB.st = 'running'; lbDraw(); await new Promise(r => setTimeout(r, 30));
  const t0 = performance.now(), W8 = [32, 16, 8, 4, 2, 1], prioIdx = LB.prio.map(h => STAT_ORDER.indexOf(h)), wOf = new Array(6).fill(0); prioIdx.forEach((k, r) => { wOf[k] = W8[r]; });
  const mins = STAT_ORDER.map(h => +LB.min[h] || 0), setH = +LB.set || 0, need = LB.need, cls = lbChar()?.classType;
  const score = st => st.reduce((t, v, k) => t + v * wOf[k], 0), mine = LB.pieces.filter(p => p.k === cls);
  // por espaço: tira peças piores em tudo que outra do mesmo conjunto/exótico; fica com as melhores
  const slots = [0, 1, 2, 3, 4].map(sl => {
    let l = mine.filter(p => p.slot === sl && (LB.exo === 'none' ? !p.exo : true));
    if (LB.exo !== 'any' && LB.exo !== 'none') { const ex = mine.find(p => p.exo && p.n === LB.exo); if (ex && ex.slot === sl) l = l.filter(p => p.exo && p.n === LB.exo); else l = l.filter(p => !p.exo); }
    l = l.filter(p => !l.some(q => q !== p && q.set === p.set && q.exo === p.exo && q.st.every((v, k) => v >= p.st[k]) && q.st.some((v, k) => v > p.st[k])));
    return l.sort((a, b) => score(b.st) - score(a.st)).slice(0, 22);
  });
  const top = [], keep = 4; let n = 0;
  const [A, Bs, C, D, E] = slots, R = lbRest().rest;
  for (let a = 0; a < A.length; a++) {
    for (const b of Bs) { for (const c of C) { for (const d of D) { for (const e of E) {
      const ps = [A[a], b, c, d, e]; let ex = 0; for (const p of ps) if (p.exo) ex++; if (ex > 1) continue;
      n++;
      if (setH) { let k = 0; for (const p of ps) if (p.set === setH) k++; if (k < need) continue; }
      const tot = [0, 0, 0, 0, 0, 0]; for (const p of ps) for (let k = 0; k < 6; k++) tot[k] += p.st[k];
      let ok = true; for (let k = 0; k < 6; k++) { tot[k] += R[k]; if (tot[k] < mins[k]) { ok = false; break; } } if (!ok) continue;
      const sc = score(tot); if (top.length === keep && sc <= top[keep - 1].sc) continue;
      top.push({ sc, ps, tot }); top.sort((x, y) => y.sc - x.sc); if (top.length > keep) top.pop();
    } } } }
    if (a % 2 === 1) await new Promise(r => setTimeout(r, 0)); // deixa a tela respirar
  }
  LB.res = top; LB.saved = {}; LB.n = n; LB.ms = Math.round(performance.now() - t0); LB.st = 'ready'; lbDraw();
}
const lbSkip = e => !e?.n || SKIP_NAME.test(e.n) || SKIP_PT.test(e.n);
const lbEqOf = b => (LB.eq[LB.cid] || []).find(i => i.bucketHash === b);
function lbMods() { const out = []; for (const it of LB.eq[LB.cid] || []) if (ARMOR_BUCKETS.includes(it.bucketHash)) for (const s of LB.sk[it.itemInstanceId]?.sockets || []) { const e = LB.en[s.plugHash]; if (s.plugHash && e && pArmorMod(e) && pShow(e)) out.push(s.plugHash); } return out; }
// subclasse escolhida e seus encaixes (o que está nela agora + o que você trocou aqui)
function lbSubInst() { if (LB.sub === '') return null; const list = LB.subs[LB.cid] || []; return LB.sub === 'cur' ? lbEqOf(SUB_BUCKET) || list[0] : list.find(x => x.itemInstanceId === LB.sub) || null; }
function lbArtInst() { const list = LB.arts[LB.cid] || []; return list.find(x => x.itemInstanceId === LB.artSel) || lbEqOf(ARTIFACT_BUCKET) || list[0] || null; }
const lbPlug = (it, ov, k) => ov?.[k] ?? LB.sk[it.itemInstanceId]?.sockets?.[k]?.plugHash ?? 0;
// grupos de encaixe que dá para trocar: [categoria, índices]; fragmentos limitados ao que os aspectos liberam
function lbSubGroups(it) {
  const sd = sockDef(it.itemHash); if (!sd) return null; const ov = LB.so[it.itemInstanceId] || {};
  const out = []; let cap = null;
  for (const [c, idx] of sd.c) {
    let ix = idx.filter(k => sd.p[k] && lbOpts(sd.p[k]).length > 1);
    if (c === 2140934067) { const caps = ix.map(k => aspCap(lbPlug(it, ov, k))); cap = caps.some(x => x == null) ? null : caps.reduce((t, x) => t + x, 0); }
    if (c === 1313488945) { const filled = ix.filter(k => !lbSkip(LB.en[lbPlug(it, ov, k)])).length; ix = ix.slice(0, cap == null ? Math.max(filled, 2) : cap); out.push([c, ix, cap ?? filled]); continue; }
    if (ix.length) out.push([c, ix]);
  }
  return out;
}
function lbSubItem() {
  const it = lbSubInst(); if (!it) return null; const ov = LB.so[it.itemInstanceId] || {}, so = {}, g = lbSubGroups(it);
  const frag = g?.find(x => x[0] === 1313488945), allF = (sockDef(it.itemHash)?.c || []).find(c => c[0] === 1313488945)?.[1] || [];
  (LB.sk[it.itemInstanceId]?.sockets || []).forEach((s, k) => { const h = lbPlug(it, ov, k); if (frag && allF.includes(k) && !frag[1].includes(k)) return; if (h && s.isVisible !== false && !lbSkip(LB.en[h])) so[k] = h; });
  return { id: it.itemInstanceId, hash: it.itemHash, socketOverrides: so };
}
function lbArtGroups(it) { const sd = sockDef(it.itemHash); if (!sd) return null; return sd.c.map(([c, idx]) => [c, idx.filter(k => sd.p[k] && lbOpts(sd.p[k]).length > 1)]).filter(x => x[1].length); }
function lbArt() { const it = lbArtInst(); if (!it) return []; const ov = LB.ao[it.itemInstanceId] || {}; return (LB.sk[it.itemInstanceId]?.sockets || []).map((s, k) => lbPlug(it, ov, k)).filter(h => h && pShow(LB.en[h])); }
function lbWeapons() {
  return [0, 1, 2].map(s => LB.wpns.find(w => w.id === LB.w[s])).filter(Boolean).map(w => ({ id: w.id, hash: w.h }));
}
function lbDim(r) {
  const ch = lbChar(), sub = lbSubItem(), art = LB.art ? lbArtInst() : null, parameters = {};
  const equipped = [...(sub ? [sub] : []), ...lbWeapons(), ...r.ps.map(p => ({ id: p.id, hash: p.h })), ...(art ? [{ id: art.itemInstanceId, hash: art.itemHash }] : [])];
  if (LB.mods) { const m = lbMods(); if (m.length) parameters.mods = m; }
  if (art && LB.season) { const a = lbArt(); if (a.length) parameters.artifactUnlocks = { unlockedItemHashes: a, seasonNumber: LB.season }; }
  const sn = sub && LB.en[sub.hash]?.n;
  const lo = { name: 'DPI · ' + (u().classes[ch.classType] || '') + (sn ? ' · ' + sn : ''), classType: ch.classType, clearSpace: false, equipped, unequipped: [], parameters };
  return 'https://app.destinyitemmanager.com/loadouts?loadout=' + encodeURIComponent(JSON.stringify(lo));
}
// salva a combinação em "Builds salvas" no mesmo formato das outras (subclasse e artefato já com as trocas feitas aqui)
function lbSnap(r) {
  const ch = lbChar(), items = [], so = {}, io = {}, inst = LB.inst || {};
  const add = (it, b, ov) => { items.push({ itemHash: it.itemHash ?? it.h, itemInstanceId: it.itemInstanceId ?? it.id, bucketHash: b }); const id = it.itemInstanceId ?? it.id, sk = LB.sk[id]; if (sk) so[id] = ov ? { sockets: sk.sockets.map((x, k) => ov[k] ? { ...x, plugHash: ov[k] } : x) } : sk; if (inst[id]) io[id] = { primaryStat: inst[id].primaryStat }; };
  const sub = lbSubInst(); if (sub) add(sub, SUB_BUCKET, LB.so[sub.itemInstanceId]);
  for (const w of lbWeapons()) { const x = LB.wpns.find(y => y.id === w.id); if (x) add(x, WEAPON_B[x.slot]); }
  for (const p of r.ps) add(p, ARMOR_BUCKETS[p.slot]);
  const art = LB.art ? lbArtInst() : null; if (art) add(art, ARTIFACT_BUCKET, LB.ao[art.itemInstanceId]);
  const stats = Object.fromEntries(STAT_ORDER.map((h, k) => [h, r.tot[k]]));
  const c = { characterId: LB.cid, classType: ch.classType, raceType: ch.raceType, light: ch.light, emblemHash: ch.emblemHash, emblemPath: ch.emblemPath, emblemBackgroundPath: ch.emblemBackgroundPath, stats };
  const sn = sub && LB.en[sub.itemHash]?.n, t = lw().savedT(charTitle(u().classes[ch.classType] || '', sn));
  return { k: 'lb|' + Date.now(), name: String(member?.name || '').replace(/#\d+$/, ''), t, at: Date.now(), cid: LB.cid, p: { characters: { data: { [LB.cid]: c } }, characterEquipment: { data: { [LB.cid]: { items } } }, itemComponents: { sockets: { data: so }, instances: { data: io } } } };
}
// salvar com nome: o botão vira um campo com o nome sugerido
const lbNameForm = (key, r) => LB.nm === key ? `<span class="lbd-nm"><input id="lbnm" type="text" maxlength="40" value="${esc(lbSnap(r).t)}" aria-label="${esc(lw().nmPh)}" placeholder="${esc(lw().nmPh)}"><button type="button" class="lbd-btn on" data-lbnameok>${esc(lw().nmOk)}</button><button type="button" class="lbd-btn" data-lbnamex aria-label="${esc(lw().nmX)}">✕</button></span>` : '';
function lbSaveNamed() {
  const key = LB.nm, r = key === 'm' ? LB.mres : LB.res?.[+key]; if (!r) return;
  const x = lbSnap(r), n = ($('lbnm')?.value || '').trim(); x.title = n || x.t;
  const l = savedList(); l.unshift(x); try { LS.set('dc-builds', l.slice(0, 30)); } catch {}
  if (key === 'm') LB.msaved = true; else (LB.saved = LB.saved || {})[key] = 1;
  LB.nm = null; lbDraw(); if (isGd()) render();
}
// plano de aplicação de um resultado do montador: armaduras, armas escolhidas, subclasse com as trocas e os mods atuais por espaço
function lbPlan(r) {
  const items = [...r.ps.map(p => ({ id: p.id, h: p.h, b: ARMOR_BUCKETS[p.slot] })), ...lbWeapons().map(w => { const x = LB.wpns.find(y => y.id === w.id); return { id: w.id, h: w.hash, b: WEAPON_B[x?.slot ?? 0] }; })];
  const s = lbSubItem(), mods = {};
  if (LB.mods) for (const it of LB.eq[LB.cid] || []) { const sl = ARMOR_BUCKETS.indexOf(it.bucketHash); if (sl < 0) continue; const tgt = r.ps.find(p => p.slot === sl); if (!tgt) continue; (LB.sk[it.itemInstanceId]?.sockets || []).forEach((x, k) => { const e = LB.en[x.plugHash]; if (x.plugHash && e && /^enhancements\.(?!ghosts)/.test(e.pc || '') && pShow(e)) (mods[tgt.id] = mods[tgt.id] || {})[k] = x.plugHash; }); }
  const sn = s && LB.en[s.hash]?.n, ch = lbChar();
  return { cid: LB.cid, name: lw().savedT(charTitle(u().classes[ch.classType] || '', sn)), items, sub: s ? { id: s.id, h: s.hash, so: s.socketOverrides } : null, mods, art: !!LB.art };
}
// cartão pequeno na aba Builds: o montador em si abre na janela
// liberado para o clã Orla Emaranhada (e o dono no /beta); a lista do clã vem com a aba Guardião e fica lembrada no aparelho
const LB_CLAN = 'orla emaranhada';
function lbAllowed() {
  if (BETA) return true; if (!FX) return false;
  const n = GD?.clan?.name; if (n != null || GD?.clan?.none) { const ok = !!n && n.trim().toLowerCase() === LB_CLAN; try { LS.set('dc-lbclan', ok ? member.id : ''); } catch {} return ok; }
  return LS.get('dc-lbclan', '') === member.id;
}
function lbHTML() {
  if (!have.a || !member || !lbAllowed()) return '';
  const T = lw();
  return `<article class="gd lb lb-card"><div class="gd-head"><h2>${esc(T.mT)} <small class="lb-beta">beta</small></h2></div><p>${esc(T.mCard)}</p><p class="lb-clan">${esc(T.clan)}</p><div class="lb-two"><button type="button" class="lb-run" data-lbopen="man">${esc(T.mOpenMan)}</button><button type="button" class="lbd-btn" data-lbopen="opt">${esc(T.mOpenOpt)} ↗</button></div></article>`;
}
function lbOpen(mode) { const d = $('lbdlg'); if (mode) LB.mode = mode; LB.cid = LB.cid || charId; loadStats(); lbDraw(); if (!d.open) d.showModal(); if (LB.st === 'idle' || LB.st === 'err') lbLoad(); }
const lbIc = (h, cls = '') => { const e = LB.en[h]; return e?.ic ? `<img src="${BNET}${e.ic}" alt=""${cls}>` : ''; };
// encaixe clicável (subclasse/artefato) e a grade de opções que abre embaixo do grupo
function lbSockRow(kind, it, ix, ov) {
  return ix.map(k => { const h = lbPlug(it, ov, k), id = kind + ':' + k; return `<button type="button" class="lbd-sk${LB.pick === id ? ' on' : ''}${ov[k] ? ' chg' : ''}" data-lbsk="${id}" title="${esc(LB.en[h]?.n || '')}" aria-label="${esc(LB.en[h]?.n || '')}">${lbIc(h)}</button>`; }).join('');
}
function lbPicker(kind, it, ix, ov, sd) {
  const k = +LB.pick.split(':')[1]; if (!LB.pick.startsWith(kind + ':') || !ix.includes(k)) return '';
  const T = lw(), opts = lbOpts(sd.p[k]), cur = lbPlug(it, ov, k), others = new Set(ix.filter(j => j !== k).map(j => lbPlug(it, ov, j)));
  lbNames(opts);
  const list = opts.filter(h => !LB.en[h] || !lbSkip(LB.en[h]) || h === cur);
  return `<div class="lbd-pk">${list.map(h => { const e = LB.en[h], dup = others.has(h) && !lbSkip(e); return `<button type="button" class="lbd-po${h === cur ? ' on' : ''}" data-lbpk="${kind}:${k}:${h}"${dup ? ' disabled' : ''} title="${esc((e?.n || '…') + (dup ? ' · ' + T.used : ''))}">${lbIc(h)}<span>${esc(e?.n || '…')}</span></button>`; }).join('')}</div>`;
}
function lbDraw() {
  const d = $('lbdlg'); if (!d) return;
  const W = u(), T = lw(), D = STATD?.d || {}, lc = lang === 'pt' ? 'pt-br' : 'en', ch = lbChar();
  const close = `<button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button>`;
  const MAN = LB.mode !== 'opt', tt = x => MAN ? String(x).replace(/^\d+\.\s*/, '') : x;
  const modeSw = `<div class="lbd-mode" role="group"><button type="button" data-lbmode="man" aria-pressed="${MAN}">${esc(T.mMan)}</button><button type="button" data-lbmode="opt" aria-pressed="${!MAN}">${esc(T.mOpt)}</button></div>`;
  const head = `<header class="lbd-hd"><div><small>${esc(T.mT)} · beta</small><h1>${esc(MAN ? T.mT : W.lbT)}</h1></div>${modeSw}${LB.pieces && ch ? `<span>${esc((u().classes[ch.classType] || '') + ' · ' + W.lbPieces(LB.pieces.filter(p => p.k === ch.classType).length))}</span>` : ''}</header>`;
  if (LB.st === 'idle' || LB.st === 'loading' || LB.st === 'err') { d.innerHTML = `<div class="pf-box lbd-box">${close}${head}${LB.st === 'err' ? `<p class="lb-err">${esc(W.lbErr)}</p><button type="button" class="lb-run" data-lb="load">${esc(W.lbLoad)}</button>` : `<p class="pf-msg wait">${esc(W.lbLoading)}</p>`}</div>`; return; }
  const box = d.querySelector('.lbd-box'), y1 = box?.scrollTop || 0, y2 = d.querySelector('.lbd-res')?.scrollTop || 0, y3 = d.querySelector('.lbd-ctl')?.scrollTop || 0;
  const cls = ch.classType, ps = LB.pieces.filter(p => p.k === cls), { cur } = lbRest(), stN = h => D[h]?.n || '…';
  // 1. personagem e subclasse (com aspectos, fragmentos e habilidades)
  const chars = Object.entries(profile.characters.data).sort((a, b) => new Date(b[1].dateLastPlayed) - new Date(a[1].dateLastPlayed));
  const subs = LB.subs[LB.cid] || [], curSub = lbEqOf(SUB_BUCKET), subN = it => LB.en[it.itemHash]?.n || '…', si = lbSubInst();
  let subBody = '';
  if (si) {
    const ov = LB.so[si.itemInstanceId] || {}, g = lbSubGroups(si), sd = SOCKD[si.itemHash];
    subBody = !g ? `<p class="lbd-n wait">${esc(W.loadingDefs)}</p>` : `<p class="lbd-n">${esc(T.subTap)}</p>` + g.map(([c, ix, cap]) => `<div class="lbd-sg"><small>${esc(c === 1313488945 ? T.frag(cap) : T.subG[c] || '')}</small><div class="lbd-sks">${lbSockRow('sub', si, ix, ov)}</div>${lbPicker('sub', si, ix, ov, sd)}</div>`).join('')
      + (Object.keys(ov).length ? `<button type="button" class="linkb" data-lbreset="sub">${esc(T.reset)}</button>` : '');
  }
  const s1 = lbSec('s1', tt(T.s1), `${si ? lbIc(si.itemHash, ' class="lbd-si"') : ''}${esc((u().classes[ch.classType] || '') + (si ? ' · ' + subN(si) : ''))}`, `
    <div class="lbd-chars">${chars.map(([cid, c]) => `<button type="button" class="lbd-ch${cid === LB.cid ? ' on' : ''}" data-lbch="${cid}"${c.emblemBackgroundPath ? ` style="--em:url('${BNET}${c.emblemBackgroundPath}')"` : ''}><b>${esc(u().classes[c.classType] || '')}</b><small>✦ ${c.light}</small></button>`).join('')}</div>
    <div class="lbd-subs">${subs.map(x => { const on = si && x.itemInstanceId === si.itemInstanceId, id = curSub && x.itemInstanceId === curSub.itemInstanceId ? 'cur' : x.itemInstanceId; return `<button type="button" class="lbd-subb${on ? ' on' : ''}" data-lbsub="${id}" title="${esc(id === 'cur' ? T.subCur(subN(x)) : subN(x))}">${lbIc(x.itemHash)}<span>${esc(subN(x))}</span></button>`; }).join('')}<button type="button" class="lbd-subb none${LB.sub === '' ? ' on' : ''}" data-lbsub="" title="${esc(T.subNone)}"><span>∅</span></button></div>
    ${subBody}`);
  // 2. exótico (ícones, como no jogo)
  const exos = [...new Map(ps.filter(p => p.exo).map(p => [p.n, p])).values()].sort((a, b) => a.slot - b.slot || a.n.localeCompare(b.n));
  const s2 = lbSec('s2', T.s2, esc(LB.exo === 'any' ? W.lbExoAny : LB.exo === 'none' ? W.lbExoNone : LB.exo), `<div class="lbd-chips"><button type="button" class="lbd-chip${LB.exo === 'any' ? ' on' : ''}" data-lbexob="any">${esc(W.lbExoAny)}</button><button type="button" class="lbd-chip${LB.exo === 'none' ? ' on' : ''}" data-lbexob="none">${esc(W.lbExoNone)}</button></div>
    <div class="lbd-exos">${exos.map(p => `<button type="button" class="lbd-exo${LB.exo === p.n ? ' on' : ''}" data-lbexob="${esc(p.n)}" title="${esc(p.n)}" aria-label="${esc(p.n)}">${p.ic ? `<img src="${BNET}${p.ic}" alt="">` : esc(p.n.slice(0, 2))}</button>`).join('')}</div>
    ${LB.exo !== 'any' && LB.exo !== 'none' ? `<p class="lbd-sel">${esc(LB.exo)}</p>` : ''}`);
  // 3. atributos
  const prio = LB.prio.map((h, r) => `<div class="lb-p" data-lbh="${h}"><b>${r + 1}</b><span>${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}${esc(stN(h))}</span><button type="button" data-lbup="${r}" aria-label="↑" ${r ? '' : 'disabled'}>↑</button><button type="button" data-lbdn="${r}" aria-label="↓" ${r < 5 ? '' : 'disabled'}>↓</button><label>${esc(W.lbMin)}<input type="number" min="0" max="250" step="5" data-lbmin="${h}" value="${LB.min[h] || ''}" aria-label="${esc(W.lbMin + ' ' + stN(h))}"></label></div>`).join('');
  const s3 = lbSec('s3', T.s3, esc(LB.prio.slice(0, 3).map(stN).join(' › ')), `<p class="lbd-n">${esc(T.s3n)}</p><div class="lb-prio">${prio}</div>`);
  // 4. conjunto
  const sets = [...new Set(ps.map(p => p.set).filter(Boolean))].map(h => ({ h, n: SETDEF[h + ':' + lc]?.n || '…', c: ps.filter(p => p.set === h).length })).filter(x => x.c >= 2).sort((a, b) => a.n.localeCompare(b.n));
  const s4 = lbSec('s4', T.s4, esc(LB.set ? (sets.find(x => String(x.h) === String(LB.set))?.n || '') + ' · ' + LB.need : W.lbSetAny), `<div class="lbd-row"><label class="lb-f"><small>${esc(W.lbSet)}</small><select class="tsort-sel" data-lbset><option value="">${esc(W.lbSetAny)}</option>${sets.map(x => `<option value="${x.h}"${String(LB.set) === String(x.h) ? ' selected' : ''}>${esc(x.n)} (${x.c})</option>`).join('')}</select></label>
    ${LB.set ? `<label class="lb-f lb-f-s"><small>${esc(W.lbNeed)}</small><select class="tsort-sel" data-lbneed><option value="2"${LB.need === 2 ? ' selected' : ''}>2</option><option value="4"${LB.need === 4 ? ' selected' : ''}>4</option></select></label>` : ''}</div>${LB.set && SETDEF[LB.set + ':' + lc]?.perks?.length ? `<ul class="lbd-perks">${SETDEF[LB.set + ':' + lc].perks.map(pk => `<li class="${LB.need >= pk.c ? 'on' : ''}">${pk.ic ? `<img src="${BNET}${pk.ic}" alt="">` : ''}<span><b>${esc(pk.n)}</b> <small>${pk.c}/5</small>${pk.d ? `<em>${esc(pk.d)}</em>` : ''}</span></li>`).join('')}</ul>` : ''}`);
  // 5. armas: quadradinhos por espaço, como as armaduras
  // 5–7. armas: cada espaço na sua seção, em quadradinhos com o poder (como no DIM); começa pelas equipadas
  const wTile = (s, w, sel) => `<button type="button" class="lbd-wt${w.exo ? ' exo' : ''}${sel === w ? ' on' : ''}${w.eqc === LB.cid ? ' eqd' : ''}" data-lbwt="${s}:${w.id}" title="${esc(w.n + (w.pw ? ' · ' + w.pw : '') + (IDEF[w.h]?.a ? ' · ' + (W.w.ammo[IDEF[w.h].a] || '') : '') + (w.eqc === LB.cid ? ' · ' + T.eqd : ''))}" aria-label="${esc(w.n)}">${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : esc(w.n.slice(0, 2))}${IDEF[w.h]?.a ? `<span class="lbd-am a${IDEF[w.h].a}">${ammoSVG(IDEF[w.h].a)}</span>` : ''}${w.pw ? `<i class="lbd-pw"${w.el ? ` style="--el:${ELEMENT_ACC[w.el]?.[0] || '#c9d3dd'}"` : ''}>${w.pw}</i>` : ''}</button>`;
  const wSec = s => {
    const sel = LB.wpns.find(w => w.id === LB.w[s]), list = LB.wpns.filter(w => w.slot === s), eqId = lbWEq(s), chg = (LB.w[s] || '') !== eqId;
    const pick = sel ? `<div class="lbd-wsel${sel.exo ? ' exo' : ''}">${sel.ic ? `<img src="${BNET}${sel.ic}" alt="">` : ''}<span><b>${esc(sel.n)}</b><small>${sel.pw ? `<i style="--el:${ELEMENT_ACC[sel.el]?.[0] || '#c9d3dd'}"></i>${sel.pw}` : ''}${IDEF[sel.h]?.a ? ` · ${ammoSVG(IDEF[sel.h].a)}${esc(W.w.ammo[IDEF[sel.h].a] || '')}` : ''}${sel.eqc === LB.cid ? ' · ' + esc(T.eqd) : ''}</small></span></div>` : `<div class="lbd-wsel none"><span class="lbd-wnone">∅</span><span><b>${esc(T.wpNo)}</b><small>${esc(T.wpNoD)}</small></span></div>`;
    return lbSec('w' + s, MAN ? T.wpSlot[s] : `${5 + s}. ${T.wpSlot[s]}`, '', `${pick}<div class="lbd-wg"><button type="button" class="lbd-wt none${!sel ? ' on' : ''}" data-lbwt="${s}:" title="${esc(T.wpNo)}">∅</button>${list.map(w => wTile(s, w, sel)).join('')}</div>`, chg && eqId ? `<button type="button" class="linkb" data-lbwt="${s}:${eqId}">${esc(T.wpBack)}</button>` : '');
  };
  const pickExo = [0, 1, 2].map(s => LB.wpns.find(w => w.id === LB.w[s])).filter(w => w?.exo).length > 1;
  const s5 = [0, 1, 2].map(wSec).join('') + (pickExo ? `<p class="lb-err">${esc(T.wpExo)}</p>` : '');
  // 6. artefato: qual dos artefatos e quais vantagens
  const arts = LB.arts[LB.cid] || [], ai = lbArtInst();
  let artBody = '';
  if (LB.art && ai) {
    const ov = LB.ao[ai.itemInstanceId] || {}, g = lbArtGroups(ai), sd = SOCKD[ai.itemHash];
    artBody = `<div class="lbd-subs">${arts.map(x => `<button type="button" class="lbd-subb art${x === ai ? ' on' : ''}" data-lbart="${x.itemInstanceId}" title="${esc(subN(x))}">${lbIc(x.itemHash)}<span>${esc(subN(x))}</span></button>`).join('')}</div>`
      + (!g ? `<p class="lbd-n wait">${esc(W.loadingDefs)}</p>` : `<p class="lbd-n">${esc(T.artTap)}</p><div class="lbd-sg"><div class="lbd-sks art">${g.map(([, ix]) => `<span class="lbd-col">${lbSockRow('art', ai, ix, ov)}</span>`).join('')}</div>${g.map(([, ix]) => lbPicker('art', ai, ix, ov, sd)).join('')}</div>`)
      + (Object.keys(ov).length ? `<button type="button" class="linkb" data-lbreset="art">${esc(T.reset)}</button>` : '');
  }
  const s6 = lbSec('s6', tt(T.s6), LB.art && ai ? `${lbIc(ai.itemHash, ' class="lbd-si"')}${esc(subN(ai))}` : esc(T.wpNo), `${arts.length ? `<label class="lbd-ck"><input type="checkbox" data-lbartck${LB.art ? ' checked' : ''}><span>${esc(T.art)}</span></label>${artBody}` : `<p class="lbd-n">${esc(T.artNo)}</p>`}`);
  const mods = lbMods();
  const s7 = lbSec('s7', tt(T.s7), esc(LB.mods ? T.modsN(mods.length).split(':')[0] : T.wpNo), `<label class="lbd-ck"><input type="checkbox" data-lbmods${LB.mods ? ' checked' : ''}><span>${esc(T.mods)}<small>${esc(T.modsN(mods.length))}</small></span></label>`);
  const go = `<button type="button" class="lb-run lbd-go" data-lb="run" ${LB.st === 'running' ? 'disabled' : ''}>${esc(LB.st === 'running' ? W.lbRunning : W.lbRun)}</button><button type="button" class="linkb" data-lb="load">${esc(W.lbReload)}</button>`;
  // resultados
  const where = p => p.eqc === LB.cid ? W.lbEquipped : p.where === 'v' ? W.lbVault : (u().classes[profile.characters.data[p.where]?.classType] || '');
  const curRow = `<div class="lb-st lbd-cur"><em>${esc(T.cur)}</em>${STAT_ORDER.map((h, k) => `<span>${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}<b>${cur[k]}</b></span>`).join('')}</div>`;
  const res = !LB.res ? `<p class="lbd-idle">${esc(T.idle)}</p>` : !LB.res.length ? `<p class="lb-err">${esc(W.lbNone)}</p>` : LB.res.map((r, i) => {
    const sc = r.ps.filter(p => p.set).reduce((m, p) => (m[p.set] = (m[p.set] || 0) + 1, m), {}), setTxt = Object.entries(sc).filter(([, c]) => c >= 2).map(([h, c]) => `${SETDEF[h + ':' + lc]?.n || ''} ${c}/5`).join(' · ');
    const perks = Object.entries(sc).filter(([, c]) => c >= 2).flatMap(([h, c]) => (SETDEF[h + ':' + lc]?.perks || []).map(pk => ({ ...pk, on: c >= pk.c })));
    const saved = LB.saved?.[i];
    return `<article class="lb-r"><div class="lb-rh"><b>#${i + 1}</b><span>${esc(setTxt || W.lbNoSet)}</span><span class="lbd-acts">${lbNameForm(String(i), r) || `<button type="button" class="lbd-btn" data-lbname="${i}"${saved ? ' disabled' : ''}>${esc(saved ? T.saved : T.save)}</button>`}<button type="button" class="lbd-btn" data-lbuse="${i}">${esc(T.use)}</button>${wBtn(`data-lbapply="${i}"`)}</span></div>
      ${perks.length ? `<ul class="lbd-perks">${perks.map(pk => `<li class="${pk.on ? 'on' : ''}">${pk.ic ? `<img src="${BNET}${pk.ic}" alt="">` : ''}<span><b>${esc(pk.n)}</b> <small>${esc(pk.c + '/5 · ' + (pk.on ? T.setOn : T.setOff(pk.c)))}</small>${pk.d ? `<em>${esc(pk.d)}</em>` : ''}</span></li>`).join('')}</ul>` : ''}
      <div class="lb-ps">${r.ps.map(p => `<div class="lb-pc${p.exo ? ' exo' : ''}${p.eqc === LB.cid ? ' eq' : ''}">${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}<b>${esc(p.n)}</b><small>${esc(where(p))}</small></div>`).join('')}</div>
      <div class="lb-st">${STAT_ORDER.map((h, k) => { const v = r.tot[k], dd = v - cur[k]; return `<span${v >= 100 ? ' class="hi"' : ''} title="${esc(stN(h))}">${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}<b>${v}</b><small class="${dd > 0 ? 'up' : dd < 0 ? 'dn' : ''}">${dd ? (dd > 0 ? '+' : '') + dd : '='}</small></span>`; }).join('')}</div></article>`;
  }).join('');
  const meta = LB.res && LB.res.length ? `<span>${esc(T.meta(fmtN(LB.n), (LB.ms / 1000).toFixed(1).replace('.', lang === 'pt' ? ',' : '.')))}</span>` : '';
  if (MAN) {
    // montagem manual: uma seção por peça de armadura (quadradinhos com o total de atributos), resumo à direita
    lbADef();
    const tot = p => p.st.reduce((t, v) => t + v, 0), stTip = p => STAT_ORDER.map((h, k) => `${stN(h)} ${p.st[k]}`).join(' · ');
    const aSec = sl => {
      const list = ps.filter(p => p.slot === sl).sort((a, b) => (b.exo - a.exo) || tot(b) - tot(a)), sel = ps.find(p => p.id === LB.a[sl]), eqP = ps.find(p => p.slot === sl && p.eqc === LB.cid), chg = (LB.a[sl] || '') !== (eqP?.id || '');
      const pick = sel ? `<div class="lbd-wsel${sel.exo ? ' exo' : ''}">${sel.ic ? `<img src="${BNET}${sel.ic}" alt="">` : ''}<span><b>${esc(sel.n)}</b><span class="lbd-ast">${STAT_ORDER.map((h, k) => `<span title="${esc(stN(h))}">${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}${sel.st[k]}</span>`).join('')}</span><small>${tot(sel)} ${esc(T.tot)}${sel.eqc === LB.cid ? ' · ' + esc(T.eqd) : ''}</small></span></div>` : `<div class="lbd-wsel none"><span class="lbd-wnone">∅</span><span><b>${esc(T.wpNo)}</b><small>${esc(T.wpNoD)}</small></span></div>`;
      const grid = list.length ? `<div class="lbd-wg"><button type="button" class="lbd-wt none${!sel ? ' on' : ''}" data-lbat="${sl}:" title="${esc(T.wpNo)}">∅</button>${list.map(p => `<button type="button" class="lbd-wt${p.exo ? ' exo' : ''}${sel === p ? ' on' : ''}${p.eqc === LB.cid ? ' eqd' : ''}" data-lbat="${sl}:${p.id}" title="${esc(p.n + ' · ' + stTip(p))}" aria-label="${esc(p.n)}">${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : esc(p.n.slice(0, 2))}<i class="lbd-pw">${tot(p)}</i></button>`).join('')}</div>` : `<p class="lbd-n">${esc(T.aNo)}</p>`;
      return lbSec('a' + sl, T.aSlot[sl], '', pick + grid, chg && eqP ? `<button type="button" class="linkb" data-lbat="${sl}:${eqP.id}">${esc(T.wpBack)}</button>` : '');
    };
    const selP = [0, 1, 2, 3, 4].map(sl => ps.find(p => p.id === LB.a[sl])).filter(Boolean), R0 = lbRest().rest;
    const mt = STAT_ORDER.map((h, k) => R0[k] + selP.reduce((t, p) => t + p.st[k], 0)), mr = { ps: selP, tot: mt };
    const sc = selP.filter(p => p.set).reduce((m, p) => (m[p.set] = (m[p.set] || 0) + 1, m), {});
    const perks = Object.entries(sc).filter(([, c]) => c >= 2).flatMap(([h, c]) => (SETDEF[h + ':' + lc]?.perks || []).map(pk => ({ ...pk, on: c >= pk.c })));
    const wsel = [0, 1, 2].map(x => LB.wpns.find(w => w.id === LB.w[x])).filter(Boolean);
    const summary = `<article class="lb-r lbd-msum"><div class="lb-rh"><b>${esc(T.sumT)}</b><span>${esc(Object.entries(sc).filter(([, c]) => c >= 2).map(([h, c]) => `${SETDEF[h + ':' + lc]?.n || ''} ${c}/5`).join(' · ') || W.lbNoSet)}</span><span class="lbd-acts">${lbNameForm('m', mr) || `<button type="button" class="lbd-btn" data-lbname="m"${LB.msaved ? ' disabled' : ''}>${esc(LB.msaved ? T.saved : T.save)}</button>`}${wBtn('data-lbmapply')}</span></div>
      <div class="lbd-sum-g">${si ? `<span class="lbd-sum-i sub" title="${esc(subN(si))}">${lbIc(si.itemHash)}</span>` : ''}${wsel.map(w => `<span class="lbd-sum-i${w.exo ? ' exo' : ''}" title="${esc(w.n)}">${w.ic ? `<img src="${BNET}${w.ic}" alt="">` : ''}</span>`).join('')}</div>
      <div class="lb-ps">${[0, 1, 2, 3, 4].map(sl => { const p = ps.find(x => x.id === LB.a[sl]); return p ? `<div class="lb-pc${p.exo ? ' exo' : ''}${p.eqc === LB.cid ? ' eq' : ''}">${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}<b>${esc(p.n)}</b><small>${esc(where(p))}</small></div>` : `<div class="lb-pc none"><b>${esc(T.aSlot[sl])}</b><small>∅</small></div>`; }).join('')}</div>
      ${selP.filter(p => p.exo).length > 1 ? `<p class="lb-err">${esc(T.exo2)}</p>` : ''}${pickExo ? `<p class="lb-err">${esc(T.wpExo)}</p>` : ''}
      <div class="lb-st">${STAT_ORDER.map((h, k) => { const v = mt[k], dd = v - cur[k]; return `<span${v >= 100 ? ' class="hi"' : ''} title="${esc(stN(h))}">${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}<b>${v}</b><small class="${dd > 0 ? 'up' : dd < 0 ? 'dn' : ''}">${dd ? (dd > 0 ? '+' : '') + dd : '='}</small></span>`; }).join('')}</div>
      ${perks.length ? `<ul class="lbd-perks">${perks.map(pk => `<li class="${pk.on ? 'on' : ''}">${pk.ic ? `<img src="${BNET}${pk.ic}" alt="">` : ''}<span><b>${esc(pk.n)}</b> <small>${esc(pk.c + '/5 · ' + (pk.on ? T.setOn : T.setOff(pk.c)))}</small>${pk.d ? `<em>${esc(pk.d)}</em>` : ''}</span></li>`).join('')}</ul>` : ''}</article>`;
    LB.mres = mr;
    d.innerHTML = `<div class="pf-box lbd-box">${close}${head}<div class="lbd-cols"><aside class="lbd-ctl">${s1}${[0, 1, 2, 3, 4].map(aSec).join('')}${s5}${s6}${s7}<div class="lbd-gobar"><button type="button" class="lb-run lbd-go" data-lbmode="opt">${esc(T.toOpt)}</button><button type="button" class="linkb" data-lb="load">${esc(W.lbReload)}</button></div></aside>
      <section class="lbd-res"><div class="lbd-rh"><h2>${esc(T.sumT)}</h2></div>${curRow}${summary}<p class="lbd-n">${esc(T.restNote)}</p><p class="lbd-n lb-clan">${esc(T.clan)}</p></section></div></div>`;
  } else d.innerHTML = `<div class="pf-box lbd-box">${close}${head}<div class="lbd-cols"><aside class="lbd-ctl">${s1}${s2}${s3}${s4}${s5}${s6}${s7}<div class="lbd-gobar">${go}</div></aside>
    <section class="lbd-res"><div class="lbd-rh"><h2>${esc(T.res)}</h2>${meta}</div>${curRow}${res}<p class="lbd-n">${esc(T.restNote)}</p><p class="lbd-n">${esc(T.foot)}</p><p class="lbd-n lb-clan">${esc(T.clan)}</p></section></div></div>`;
  const nb = d.querySelector('.lbd-box'); if (nb) nb.scrollTop = y1; const nr = d.querySelector('.lbd-res'); if (nr) nr.scrollTop = y2; const nc = d.querySelector('.lbd-ctl'); if (nc) nc.scrollTop = y3; lbCfgSave();
}
// animação ao reordenar os atributos: cada linha desliza da posição antiga para a nova (FLIP) e as duas trocadas piscam
function lbSwap(k, j) {
  const d = $('lbdlg'), before = {}; d.querySelectorAll('.lb-p[data-lbh]').forEach(el => { before[el.dataset.lbh] = el.getBoundingClientRect().top; });
  const moved = [LB.prio[k], LB.prio[j]];
  [LB.prio[k], LB.prio[j]] = [LB.prio[j], LB.prio[k]]; LS.set('dc-lb-prio', LB.prio); LB.res = null; lbDraw();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  d.querySelectorAll('.lb-p[data-lbh]').forEach(el => {
    const h = el.dataset.lbh, dy = (before[h] ?? 0) - el.getBoundingClientRect().top; if (!dy) return;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
  d.querySelectorAll('.lb-p[data-lbh]').forEach(el => { if (moved.includes(+el.dataset.lbh)) el.classList.add('lbd-flash'); });
  const btn = d.querySelector(`.lb-p[data-lbh="${moved[0]}"] [data-lb${j < k ? 'up' : 'dn'}]`); if (btn && !btn.disabled) btn.focus();
}
document.addEventListener('click', e => { const o = e.target.closest('[data-lbopen]'); if (o) { e.stopPropagation(); lbOpen(o.dataset.lbopen || 'man'); } }, true);
$('lbdlg').addEventListener('click', e => {
  const d = $('lbdlg'), q = s => e.target.closest(s);
  if (e.target === d || q('.pf-x')) { d.close(); return; }
  const b = q('[data-lb]'); if (b) { if (b.dataset.lb === 'load') lbLoad(); else lbRun(); return; }
  const c = q('[data-lbch]'); if (c) { if (c.dataset.lbch !== LB.cid) { LB.cid = c.dataset.lbch; lbCfgLoad(); LB.pick = ''; LB.res = null; lbDraw(); } return; }
  const x = q('[data-lbexob]'); if (x) { LB.exo = x.dataset.lbexob; LB.res = null; lbDraw(); return; }
  const sb = q('[data-lbsub]'); if (sb) { LB.sub = sb.dataset.lbsub; LB.pick = ''; lbDraw(); return; }
  const ab = q('[data-lbart]'); if (ab) { LB.artSel = ab.dataset.lbart; LB.pick = ''; lbDraw(); return; }
  const sk = q('[data-lbsk]'); if (sk) { LB.pick = LB.pick === sk.dataset.lbsk ? '' : sk.dataset.lbsk; lbDraw(); return; }
  const pk = q('[data-lbpk]'); if (pk) {
    const [kind, k, h] = pk.dataset.lbpk.split(':'), it = kind === 'sub' ? lbSubInst() : lbArtInst(); if (!it) return;
    const store = kind === 'sub' ? LB.so : LB.ao, ov = store[it.itemInstanceId] = store[it.itemInstanceId] || {};
    if (+h === LB.sk[it.itemInstanceId]?.sockets?.[+k]?.plugHash) delete ov[k]; else ov[k] = +h; LB.pick = ''; lbDraw(); return;
  }
  const rs = q('[data-lbreset]'); if (rs) { const it = rs.dataset.lbreset === 'sub' ? lbSubInst() : lbArtInst(); if (it) delete (rs.dataset.lbreset === 'sub' ? LB.so : LB.ao)[it.itemInstanceId]; LB.pick = ''; lbDraw(); return; }
  const wt = q('[data-lbwt]'); if (wt) { const [s, id] = wt.dataset.lbwt.split(':'); LB.w[+s] = id; lbDraw(); return; }
  const up = q('[data-lbup]'), dn = q('[data-lbdn]'); const k = up ? +up.dataset.lbup : dn ? +dn.dataset.lbdn : -1;
  if (k >= 0) { const j = up ? k - 1 : k + 1; if (j < 0 || j > 5) return; lbSwap(k, j); return; }
  const md = q('[data-lbmode]'); if (md) { LB.mode = md.dataset.lbmode; LB.pick = ''; lbDraw(); return; }
  const at = q('[data-lbat]'); if (at) { const [sl, id] = at.dataset.lbat.split(':'); LB.a[+sl] = id; LB.msaved = false; lbDraw(); return; }
  const us = q('[data-lbuse]'); if (us) { const r = LB.res?.[+us.dataset.lbuse]; if (r) { for (const p of r.ps) LB.a[p.slot] = p.id; LB.mode = 'man'; LB.msaved = false; lbDraw(); } return; }
  if (q('[data-lbmapply]')) { if (LB.mres) wOpen(lbPlan(LB.mres)); return; }
  const nm = q('[data-lbname]'); if (nm) { LB.nm = nm.dataset.lbname; lbDraw(); const f = $('lbnm'); if (f) { f.focus(); f.select(); } return; }
  if (q('[data-lbnameok]')) { lbSaveNamed(); return; }
  if (q('[data-lbnamex]')) { LB.nm = null; lbDraw(); return; }
  if (q('[data-lbmsave]')) { if (!LB.mres) return; const l = savedList(); l.unshift(lbSnap(LB.mres)); try { LS.set('dc-builds', l.slice(0, 30)); } catch {} LB.msaved = true; lbDraw(); if (isGd()) render(); return; }
  const ap = q('[data-lbapply]'); if (ap) { const r = LB.res?.[+ap.dataset.lbapply]; if (r) wOpen(lbPlan(r)); return; }
  const sv = q('[data-lbsave]'); if (sv) { const i = +sv.dataset.lbsave, r = LB.res?.[i]; if (!r) return; const l = savedList(); l.unshift(lbSnap(r)); try { LS.set('dc-builds', l.slice(0, 30)); } catch {} (LB.saved = LB.saved || {})[i] = 1; lbDraw(); if (isGd()) render(); return; }
  const cp = q('[data-lbcopy]'); if (cp) { const r = LB.res?.[+cp.dataset.lbcopy]; if (!r) return; navigator.clipboard?.writeText(lbDim(r)).then(() => { cp.textContent = lw().copied; setTimeout(() => { cp.textContent = lw().copy; }, 1800); }).catch(() => {}); return; }
  const cl = q('[data-lbcol]'); if (cl) { const key = cl.dataset.lbcol; if (LBCOL[key]) delete LBCOL[key]; else LBCOL[key] = 1; LB.pick = ''; try { LS.set('dc-lb-col', Object.assign({ w0: 0, w1: 0, w2: 0, s6: 0, s7: 0 }, LBCOL)); } catch {} lbDraw(); }
});
$('lbdlg').addEventListener('keydown', e => { if (e.target.id === 'lbnm') { if (e.key === 'Enter') { e.preventDefault(); lbSaveNamed(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); LB.nm = null; lbDraw(); } } });
$('lbdlg').addEventListener('change', e => {
  const t = e.target, keepRes = t.matches('[data-lbmods],[data-lbartck]'); // o que só muda o link do DIM não refaz a busca
  if (t.matches('[data-lbset]')) LB.set = t.value; else if (t.matches('[data-lbneed]')) LB.need = +t.value; else if (t.matches('[data-lbmin]')) { LB.min[t.dataset.lbmin] = +t.value || 0; LS.set('dc-lb-min', LB.min); }
  else if (t.matches('[data-lbmods]')) { LB.mods = t.checked; lbSaveOpt(); } else if (t.matches('[data-lbartck]')) { LB.art = t.checked; LB.pick = ''; lbSaveOpt(); } else return;
  if (!keepRes) LB.res = null; if (!t.matches('[data-lbmin]')) lbDraw();
});
/* ---------- Limpeza do cofre (beta, clã) ----------
   Usa os mesmos dados do montador. Armadura: aponta peças piores em todos os atributos que outra da mesma classe, espaço
   e conjunto (exótico só contra o mesmo exótico), comparando os atributos de base (sem os mods encaixados).
   Armas: cópias repetidas da mesma arma, com os perks de cada uma, para você escolher qual fica.
   Nada é desmontado aqui: o DPI gera a busca para colar no DIM. Trancadas e equipadas nunca entram. */
const LCT = {
  pt: { t: 'Limpeza do cofre', card: 'Encontra armaduras piores em tudo que outra que você já tem e armas repetidas, e monta a busca pronta para o DIM.', open: 'Abrir limpeza', arm: 'Armaduras que dá para desmontar', armN: 'Cada peça abaixo tem atributos iguais ou menores em todos os 6 que outra do mesmo espaço, classe e conjunto. Os mods encaixados não contam.', wp: 'Armas repetidas', wpN: 'Você tem mais de uma cópia destas armas. Marque as que podem sair; a de maior poder vem desmarcada.', worse: 'pior que', none: 'Nada para limpar aqui.', locked: n => n ? `${n} trancadas ficaram de fora.` : '', sel: n => `${n} selecionadas`, copy: 'Copiar busca', copied: 'Busca copiada!', dim: n => `Abrir ${n} no DIM ↗`, move: n => `Levar ${n} para o personagem`, moveN: '“Levar para o personagem” (beta) põe os itens marcados no inventário do personagem atual, até 9 por tipo: aí é só desmontar no jogo. A Bungie não deixa desmontar pelo site (nem pelo DIM).', how: 'O link abre o Organizador do DIM (no computador) já filtrado com os itens marcados: lá dá para conferir e desmontar em lote. No celular o Organizador não abre; use “Copiar busca” e cole na busca do DIM.', all: 'Todas', noneB: 'Nenhuma', mods: 'Calculando os atributos sem os mods…', tot: 'total' },
  en: { t: 'Vault cleanup', card: 'Finds armor that is worse in everything than another piece you already own and duplicate weapons, and builds the search for DIM.', open: 'Open cleanup', arm: 'Armor you can dismantle', armN: 'Each piece below has equal or lower values in all 6 stats than another of the same slot, class and set. Socketed mods are not counted.', wp: 'Duplicate weapons', wpN: 'You own more than one copy of these. Check the ones that can go; the highest power copy starts unchecked.', worse: 'worse than', none: 'Nothing to clean here.', locked: n => n ? `${n} locked items were left out.` : '', sel: n => `${n} selected`, copy: 'Copy search', copied: 'Search copied!', dim: n => `Open ${n} in DIM ↗`, move: n => `Move ${n} to the character`, moveN: '“Move to the character” (beta) puts the checked items in the current character inventory, up to 9 per type: then just dismantle them in game. Bungie does not allow dismantling from the site (nor from DIM).', how: 'The link opens the DIM Organizer (on desktop) already filtered to the checked items: check them there and dismantle in bulk. The Organizer does not open on phones; use “Copy search” and paste it in DIM search.', all: 'All', noneB: 'None', mods: 'Working out stats without mods…', tot: 'total' },
};
const lcw = () => LCT[lang === 'pt' ? 'pt' : 'en'];
const LC = { off: new Set(), on: new Set(), base: null, busy: false };
const MODST = LS.get('dc-modst', {});
// atributos de base de cada peça: tira o que os mods encaixados (enhancements.*) somam
async function lcBase() {
  if (LC.base || LC.busy || !LB.pieces) return; LC.busy = true;
  try {
    const L = lang === 'pt' ? 'pt' : 'en', plugs = new Set();
    for (const p of LB.pieces) for (const s of LB.sk[p.id]?.sockets || []) if (s.plugHash) plugs.add(s.plugHash);
    Object.assign(LB.en, await entities('DestinyInventoryItemDefinition', [...plugs], L, true));
    const mods = [...plugs].filter(h => /^enhancements\.(?!ghosts)/.test(LB.en[h]?.pc || '') && !MODST[h]); let i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (i < mods.length) { const h = mods[i++]; try { const d = await bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${h}/`, false); MODST[h] = Object.fromEntries((d.investmentStats || []).filter(x => STAT_ORDER.includes(x.statTypeHash)).map(x => [x.statTypeHash, x.value])); } catch { MODST[h] = {}; } } }));
    try { LS.set('dc-modst', MODST); } catch {}
    LC.base = {};
    for (const p of LB.pieces) { const st = p.st.slice(); for (const s of LB.sk[p.id]?.sockets || []) { const m = /^enhancements\.(?!ghosts)/.test(LB.en[s.plugHash]?.pc || '') && MODST[s.plugHash]; if (m) STAT_ORDER.forEach((h, k) => { st[k] -= m[h] || 0; }); } LC.base[p.id] = st; }
  } catch {}
  LC.busy = false; lcDraw();
}
const lcEq = id => Object.values(LB.eq).flat().some(i => i.itemInstanceId === id);
function lcArmor() {
  const B = LC.base, out = []; let locked = 0;
  for (const p of LB.pieces) {
    if (p.eqc || lcEq(p.id)) continue; const a = B[p.id]; if (a.reduce((t, v) => t + v, 0) < 10) continue; // sem atributos (itens antigos/cosméticos): fora
    let best = null;
    for (const q of LB.pieces) {
      if (q === p || q.k !== p.k || q.slot !== p.slot || q.exo !== p.exo || (p.exo && q.h !== p.h) || (p.set && q.set !== p.set)) continue;
      const b = B[q.id]; if (!b.every((v, k) => v >= a[k])) continue;
      if (b.every((v, k) => v === a[k]) && q.id > p.id && q.set === p.set) continue; // iguais: fica uma das duas
      if (!best || b.reduce((t, v) => t + v, 0) > B[best.id].reduce((t, v) => t + v, 0)) best = q;
    }
    if (!best) continue; if (p.lk) { locked++; continue; }
    out.push({ p, q: best });
  }
  return { list: out.sort((x, y) => x.p.k - y.p.k || x.p.slot - y.p.slot), locked };
}
function lcWeapons() {
  const by = {}; let locked = 0;
  for (const w of LB.wpns) (by[w.h] = by[w.h] || []).push(w);
  const groups = Object.values(by).filter(g => g.length > 1).map(g => g.sort((a, b) => b.pw - a.pw)).sort((a, b) => a[0].n.localeCompare(b[0].n));
  for (const g of groups) for (const w of g) if (w.lk) locked++;
  return { groups, locked };
}
const LC_PERK = /^(barrels|magazines|magazines_gl|frames|scopes|guards|blades|tubes|arrows|batteries|bowstrings|grips|hafts|stocks|origins)$/;
function lcPerks(w) { return (LB.sk[w.id]?.sockets || []).map(s => s.plugHash).filter(h => h && LC_PERK.test(LB.en[h]?.pc || '')); }
function lcSelected() {
  const sel = [];
  if (LC.base) for (const { p } of lcArmor().list) if (!LC.off.has(p.id)) sel.push(p.id);
  for (const g of lcWeapons().groups) g.forEach((w, i) => { if (!w.lk && !lcEq(w.id) && (LC.on.has(w.id) || (i > 0 && !LC.off.has(w.id)))) sel.push(w.id); });
  return sel;
}
// link para o Organizador do DIM já filtrado (categoria: 1 armas; 22 Titã, 23 Caçador, 21 Arcano)
const LC_CAT = [22, 23, 21];
const lcDimUrl = (ids, cat) => `https://app.destinyitemmanager.com/${member.id}/d2/organizer?${new URLSearchParams({ category: String(cat), search: ids.map(id => 'id:' + id).join(' or ') })}`;
const lcLink = (ids, cat) => ids.length ? `<a class="lcd-dim" href="${esc(lcDimUrl(ids, cat))}" target="_blank" rel="noopener">${esc(lcw().dim(ids.length))}</a>` : '';
function lcHTML() {
  if (!have.a || !member || !lbAllowed()) return '';
  const W = u(), T = lcw();
  return `<article class="gd lb lb-card"><div class="gd-head"><h2>${esc(T.t)} <small class="lb-beta">beta</small></h2></div><p>${esc(T.card)}</p><p class="lb-clan">${esc(lw().clan)}</p><button type="button" class="lb-run" data-lcopen>${esc(T.open)} ↗</button></article>`;
}
function lcOpen() { const d = $('lcdlg'); LB.cid = LB.cid || charId; loadStats(); lcDraw(); if (!d.open) d.showModal(); if (LB.st === 'idle' || LB.st === 'err') lbLoad(); else lcBase(); }
function lcDraw() {
  const d = $('lcdlg'); if (!d) return;
  const W = u(), T = lcw(), D = STATD?.d || {};
  const close = `<button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button>`, head = `<header class="lbd-hd"><div><small>${esc(T.t)} · beta</small><h1>${esc(T.t)}</h1></div></header>`;
  if (LB.st !== 'ready' && LB.st !== 'running') { d.innerHTML = `<div class="pf-box lbd-box lcd-box">${close}${head}${LB.st === 'err' ? `<p class="lb-err">${esc(W.lbErr)}</p>` : `<p class="pf-msg wait">${esc(W.lbLoading)}</p>`}</div>`; return; }
  if (!LC.base) { lcBase(); d.innerHTML = `<div class="pf-box lbd-box lcd-box">${close}${head}<p class="pf-msg wait">${esc(T.mods)}</p></div>`; return; }
  const y = d.querySelector('.lcd-scroll')?.scrollTop || 0;
  const where = p => p.where === 'v' ? W.lbVault : (u().classes[profile.characters.data[p.where]?.classType] || '');
  const stl = (st, ref) => `<span class="lcd-st">${STAT_ORDER.map((h, k) => `<span title="${esc(D[h]?.n || '')}"${ref && st[k] < ref[k] ? ' class="dn"' : ''}>${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}${st[k]}</span>`).join('')}<b>${st.reduce((t, v) => t + v, 0)} <small>${esc(T.tot)}</small></b></span>`;
  const piece = (p, ref) => `<span class="lcd-pc${p.exo ? ' exo' : ''}">${p.ic ? `<img src="${BNET}${p.ic}" alt="" loading="lazy">` : ''}<span><b>${esc(p.n)}</b><small>${esc(where(p))}</small>${stl(LC.base[p.id], ref)}</span></span>`;
  const A = lcArmor(), WP = lcWeapons(), sel = new Set(lcSelected());
  const byCls = [0, 1, 2].map(c => A.list.filter(x => x.p.k === c)).map((l, c) => l.length ? `<h3 class="lcd-h3">${esc(u().classes[c])} · ${l.length}${lcLink(l.map(x => x.p.id).filter(id => sel.has(id)), LC_CAT[c])}</h3>` + l.map(({ p, q }) => `<label class="lcd-row"><input type="checkbox" data-lcid="${p.id}"${sel.has(p.id) ? ' checked' : ''}>${piece(p, LC.base[q.id])}<em>${esc(T.worse)}</em>${piece(q)}</label>`).join('') : '').join('');
  const wrows = WP.groups.map(g => `<div class="lcd-wg"><h3 class="lcd-h3">${g[0].ic ? `<img src="${BNET}${g[0].ic}" alt="">` : ''}${esc(g[0].n)} · ${g.length}</h3>${g.map(w => { const dis = w.lk || lcEq(w.id), pk = lcPerks(w); return `<label class="lcd-row lcd-w${dis ? ' dis' : ''}"><input type="checkbox" data-lcid="${w.id}"${sel.has(w.id) ? ' checked' : ''}${dis ? ' disabled' : ''}><span class="lcd-pw">${w.pw || ''}${IDEF[w.h]?.a ? ammoSVG(IDEF[w.h].a) : ''}</span><span class="lcd-perks">${pk.map(h => `<span title="${esc(LB.en[h]?.n || '')}">${LB.en[h]?.ic ? `<img src="${BNET}${LB.en[h].ic}" alt="">` : ''}<small>${esc(LB.en[h]?.n || '')}</small></span>`).join('')}</span><small class="lcd-where">${esc(w.eqc ? W.lbEquipped : w.lk ? '🔒' : '')}</small></label>`; }).join('')}</div>`).join('');
  lbNames(WP.groups.flat().flatMap(w => (LB.sk[w.id]?.sockets || []).map(s => s.plugHash)));
  const wIds = WP.groups.flat().map(w => w.id).filter(id => sel.has(id));
  const bar = `<div class="lcd-bar"><span>${esc(T.sel(sel.size))}</span><button type="button" class="lbd-btn" data-lcall="1">${esc(T.all)}</button><button type="button" class="lbd-btn" data-lcall="0">${esc(T.noneB)}</button><button type="button" class="lbd-btn" data-lccopy${sel.size ? '' : ' disabled'}>${esc(T.copy)}</button>${sel.size ? wBtn('data-lcmove', T.move(sel.size)) : ''}</div>${wOk() ? `<p class="lbd-n">${esc(T.moveN)}</p>` : ''}`;
  d.innerHTML = `<div class="pf-box lbd-box lcd-box">${close}${head}${bar}<div class="lcd-scroll"><p class="lbd-n">${esc(T.how)}</p>
    <div class="lcd-cols"><section class="lbd-s"><h2>${esc(T.arm)} <small>${A.list.length}</small></h2><p class="lbd-n">${esc(T.armN)}</p>${byCls || `<p class="lbd-idle">${esc(T.none)}</p>`}${A.locked ? `<p class="lbd-n">${esc(T.locked(A.locked))}</p>` : ''}</section>
    <section class="lbd-s"><div class="lcd-sh"><h2>${esc(T.wp)} <small>${WP.groups.length}</small></h2>${lcLink(wIds, 1)}</div><p class="lbd-n">${esc(T.wpN)}</p>${wrows || `<p class="lbd-idle">${esc(T.none)}</p>`}</section></div>
    <p class="lbd-n lb-clan">${esc(lw().clan)}</p></div></div>`;
  const nb = d.querySelector('.lcd-scroll'); if (nb) nb.scrollTop = y;
}
document.addEventListener('click', e => { if (e.target.closest('[data-lcopen]')) lcOpen(); });
$('lcdlg').addEventListener('click', e => {
  const d = $('lcdlg'); if (e.target === d || e.target.closest('.pf-x')) { d.close(); return; }
  const all = e.target.closest('[data-lcall]'); if (all) { const on = all.dataset.lcall === '1'; LC.off.clear(); LC.on.clear(); if (!on) { for (const { p } of lcArmor().list) LC.off.add(p.id); for (const g of lcWeapons().groups) for (const w of g) LC.off.add(w.id); } else for (const g of lcWeapons().groups) for (const w of g) LC.on.add(w.id); lcDraw(); return; }
  if (e.target.closest('[data-lcmove]')) { const ids = lcSelected(), items = ids.map(id => { const p = LB.pieces.find(x => x.id === id); if (p) return { id, h: p.h, b: ARMOR_BUCKETS[p.slot] }; const w = LB.wpns.find(x => x.id === id); return w ? { id, h: w.h, b: WEAPON_B[w.slot] } : null; }).filter(Boolean); if (items.length) wOpen({ cid: charId, name: lcw().t, items, only: true }); return; }
  const cp = e.target.closest('[data-lccopy]'); if (cp) { const ids = lcSelected(); if (!ids.length) return; navigator.clipboard?.writeText(ids.map(id => 'id:' + id).join(' or ')).then(() => { cp.textContent = lcw().copied; setTimeout(() => { cp.textContent = lcw().copy; }, 2200); }).catch(() => {}); }
});
$('lcdlg').addEventListener('change', e => { const t = e.target.closest('[data-lcid]'); if (!t) return; const id = t.dataset.lcid; if (t.checked) { LC.off.delete(id); LC.on.add(id); } else { LC.on.delete(id); LC.off.add(id); } lcDraw(); });
/* ---------- Beta (clã): ações na conta — trazer do cofre, equipar, subclasse e mods, loadouts do jogo ----------
   Tudo pela API da Bungie, direto do navegador (nada passa pelo Cloudflare). Precisa da permissão "mover e equipar itens":
   sem ela a Bungie recusa (2108) e o site pede para entrar de novo. Equipar só funciona em órbita, na Torre ou offline (1671):
   aí o site traz os itens para o inventário e deixa o resto para quando você voltar à órbita. */
const WRT_ = {
  pt: { t: 'Aplicar na conta', beta: 'beta', apply: 'Aplicar', applyN: n => `Aplicar ${n}`, confirm: 'Confirmar e aplicar', cancel: 'Cancelar', close: 'Fechar', reading: 'Lendo a sua conta…',
    sum: 'O que vai mudar', move: n => `Trazer ${n} ${n === 1 ? 'item' : 'itens'} para o personagem`, equip: n => `Equipar ${n} ${n === 1 ? 'item' : 'itens'}`, sub: n => `Subclasse: ${n} ${n === 1 ? 'encaixe' : 'encaixes'}`, mods: n => `Mods de armadura: ${n}`, ld: n => `Equipar o loadout do jogo “${n}”`, toChar: n => `Levar ${n} ${n === 1 ? 'item' : 'itens'} para o personagem`,
    already: 'Tudo isso já está equipado.', done: 'Pronto!', ok: 'feito', skip: 'já estava', fail: 'falhou', run: 'aplicando…', wait: 'na fila',
    e: { 2108: 'O DPI ainda não tem permissão para mexer no equipamento.', 1671: 'Dentro de uma atividade a Bungie não deixa equipar.', 1642: 'Sem espaço no destino.', 1623: 'Item não encontrado (foi movido ou desmontado?).', 1641: 'Só dá para usar um exótico desse tipo.', 1640: 'Este item não pode ser equipado agora.', 1663: 'A Bungie não permite esta ação.', 1678: 'Este encaixe não pode ser trocado agora.', eqOther: 'Está equipado em outro personagem e não há outro item para pôr no lugar.', full: 'O inventário está cheio e não há o que mandar para o cofre.', other: 'Não deu certo.' },
    perm: 'Para o DPI aplicar loadouts, a Bungie precisa da sua permissão para mover e equipar itens. Saia e entre de novo para autorizar.', relog: 'Sair e entrar de novo',
    inAct: 'Os itens já foram trazidos para o personagem. Equipe pelo menu do jogo ou deixe para quando você voltar à órbita.', later: 'Aplicar ao voltar à órbita', laterOn: 'Combinado: aplico quando você voltar à órbita.', pendT: 'Aplicação pendente', pendGo: 'Voltou à órbita: aplicando o loadout que ficou pendente.',
    art: 'Vantagens do artefato: troque no jogo (a Bungie não deixa pelo site).', snap: n => `Gravar no loadout ${n} do jogo`, note: 'Beta: confira o resultado no jogo. Nada é desmontado ou apagado.' },
  en: { t: 'Apply to account', beta: 'beta', apply: 'Apply', applyN: n => `Apply ${n}`, confirm: 'Confirm and apply', cancel: 'Cancel', close: 'Close', reading: 'Reading your account…',
    sum: 'What will change', move: n => `Bring ${n} ${n === 1 ? 'item' : 'items'} to the character`, equip: n => `Equip ${n} ${n === 1 ? 'item' : 'items'}`, sub: n => `Subclass: ${n} ${n === 1 ? 'socket' : 'sockets'}`, mods: n => `Armor mods: ${n}`, ld: n => `Equip the in-game loadout “${n}”`, toChar: n => `Move ${n} ${n === 1 ? 'item' : 'items'} to the character`,
    already: 'All of this is already equipped.', done: 'Done!', ok: 'done', skip: 'already there', fail: 'failed', run: 'applying…', wait: 'queued',
    e: { 2108: 'DPI does not have permission to change your gear yet.', 1671: 'Bungie does not allow equipping inside an activity.', 1642: 'No room at the destination.', 1623: 'Item not found (moved or dismantled?).', 1641: 'Only one exotic of this kind can be equipped.', 1640: 'This item cannot be equipped right now.', 1663: 'Bungie does not allow this action.', 1678: 'This socket cannot be changed right now.', eqOther: 'Equipped on another character with nothing to put in its place.', full: 'Inventory is full and there is nothing to send to the vault.', other: 'Something went wrong.' },
    perm: 'To apply loadouts, Bungie needs your permission for DPI to move and equip items. Sign out and back in to authorize.', relog: 'Sign out and back in',
    inAct: 'The items are already on the character. Equip them from the game menu or leave it for when you are back in orbit.', later: 'Apply when back in orbit', laterOn: 'Got it: I will apply when you are back in orbit.', pendT: 'Pending apply', pendGo: 'Back in orbit: applying the pending loadout.',
    art: 'Artifact perks: change them in game (Bungie does not allow it from the site).', snap: n => `Store in in-game loadout ${n}`, note: 'Beta: check the result in game. Nothing is dismantled or deleted.' },
};
const wt = () => WRT_[lang === 'pt' ? 'pt' : 'en'];
const WR = { plan: null, steps: [], st: 'idle', err: '', pending: null, fresh: null };
const wSleep = ms => new Promise(r => setTimeout(r, ms));
const wErr = (code, msg) => Object.assign(new Error(msg || String(code)), { code });
const wMsg = e => wt().e[e?.code] || wt().e[e?.why] || (e?.message && !/^\d+$/.test(e.message) ? e.message : wt().e.other);
const wExo = h => { const c = ITEMS?.[h]; return c != null ? c % 2 === 1 : LB.en?.[h]?.tt === 6; };
// POST de ação com espera quando a Bungie pede calma
async function wPost(path, body) {
  for (let t = 0; t < 6; t++) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() }, body: JSON.stringify({ ...body, membershipType: member.type }) });
    const j = await r.json().catch(() => null);
    if (!j) throw wErr('http', `HTTP ${r.status}`);
    if (j.ErrorCode === 1) { await wSleep(120); return j.Response; }
    if ([31, 35, 36, 37, 1672].includes(j.ErrorCode)) { await wSleep(Math.max(1000, (j.ThrottleSeconds || 1) * 1000)); continue; }
    if (j.ErrorCode === 2108) { WR.needPerm = true; }
    throw wErr(j.ErrorCode, j.Message);
  }
  throw wErr(36);
}
// foto atual da conta: onde está cada item (cofre, inventário ou equipado em qual personagem) e os encaixes
async function wFresh() {
  const r = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/?components=102,201,205,305`);
  const loc = {}, inv = {}, eq = {};
  for (const it of r.profileInventory?.data?.items || []) if (it.itemInstanceId) loc[it.itemInstanceId] = { w: 'v', it };
  for (const [cid, c] of Object.entries(r.characterInventories?.data || {})) for (const it of c.items || []) if (it.itemInstanceId) { loc[it.itemInstanceId] = { w: cid, it }; ((inv[cid] = inv[cid] || {})[it.bucketHash] = inv[cid][it.bucketHash] || []).push(it); }
  for (const [cid, c] of Object.entries(r.characterEquipment?.data || {})) for (const it of c.items || []) if (it.itemInstanceId) { loc[it.itemInstanceId] = { w: cid, eq: true, it }; (eq[cid] = eq[cid] || {})[it.bucketHash] = it; }
  return { loc, inv, eq, sk: r.itemComponents?.sockets?.data || {} };
}
// plano a partir de uma build (sua atual, salva ou do montador): itens, subclasse com encaixes e mods por peça
function wPlanFromCtx(C, name) {
  const eqs = C.p.characterEquipment?.data?.[C.cid]?.items || [], sk = C.p.itemComponents?.sockets?.data || {}, en = C.B?.en || {};
  const items = eqs.filter(i => i.itemInstanceId && (WEAPON_B.includes(i.bucketHash) || ARMOR_B.includes(i.bucketHash))).map(i => ({ id: i.itemInstanceId, h: i.itemHash, b: i.bucketHash }));
  const s = eqs.find(i => i.bucketHash === SUB_BUCKET), so = {};
  if (s) (sk[s.itemInstanceId]?.sockets || []).forEach((x, k) => { const e = en[x.plugHash]; if (x.plugHash && x.isVisible !== false && e && !SKIP_NAME.test(e.n || '') && !SKIP_PT.test(e.n || '')) so[k] = x.plugHash; });
  const mods = {}; for (const i of items) if (ARMOR_B.includes(i.b)) (sk[i.id]?.sockets || []).forEach((x, k) => { const e = en[x.plugHash]; if (x.plugHash && e && pArmorMod(e) && pShow(e)) (mods[i.id] = mods[i.id] || {})[k] = x.plugHash; });
  return { cid: C.cid, name, items, sub: s ? { id: s.itemInstanceId, h: s.itemHash, so } : null, mods };
}
// confere o plano contra a conta agora e diz o que vai mudar
function wDiff(plan, F) {
  const cid = plan.cid, here = id => F.loc[id]?.w === cid, on = id => here(id) && F.loc[id]?.eq;
  const move = plan.items.filter(i => !here(i.id)), equip = plan.items.filter(i => !on(i.id)).length + (plan.sub && !on(plan.sub.id) ? 1 : 0);
  const cur = plan.sub ? F.sk[plan.sub.id]?.sockets || [] : [], sub = plan.sub ? Object.entries(plan.sub.so || {}).filter(([k, h]) => cur[k]?.plugHash !== h).length : 0;
  let mods = 0; for (const [id, m] of Object.entries(plan.mods || {})) { const c = F.sk[id]?.sockets || []; for (const [k, h] of Object.entries(m)) if (c[k]?.plugHash !== h) mods++; }
  return { move, equip, sub, mods };
}
async function wOpen(plan) {
  WR.plan = plan; WR.st = 'reading'; WR.steps = []; WR.err = ''; WR.diff = null; wDraw(); const d = $('wrdlg'); if (!d.open) d.showModal();
  try { WR.fresh = await wFresh(); if (plan.ld == null && !plan.only) WR.diff = wDiff(plan, WR.fresh); WR.st = 'confirm'; } catch (e) { WR.st = 'err'; WR.err = wMsg(e); }
  wDraw();
}
const wStep = (t) => { const s = { t, st: 'wait', m: '' }; WR.steps.push(s); return s; };
// garante espaço no inventário do personagem para aquele tipo de item (manda um que não é do plano para o cofre)
async function wRoom(F, cid, b, keep) {
  const l = (F.inv[cid] = F.inv[cid] || {})[b] = F.inv[cid][b] || [];
  if (l.length < 9) return;
  const v = l.find(x => !keep.has(x.itemInstanceId) && !(x.state & 1)) || l.find(x => !keep.has(x.itemInstanceId)); if (!v) throw wErr('full');
  await wPost('/Destiny2/Actions/Items/TransferItem/', { itemReferenceHash: v.itemHash, stackSize: 1, transferToVault: true, itemId: v.itemInstanceId, characterId: cid });
  l.splice(l.indexOf(v), 1); F.loc[v.itemInstanceId] = { w: 'v', it: v };
}
async function wMove(F, i, cid, keep) {
  const L = F.loc[i.id]; if (!L) throw wErr(1623);
  if (L.w === cid) return false;
  if (L.w !== 'v') {
    if (L.eq) { // equipado em outro personagem: põe outro no lugar antes
      const alt = (F.inv[L.w]?.[i.b] || []).find(x => !keep.has(x.itemInstanceId) && !wExo(x.itemHash)); if (!alt) throw wErr('eqOther');
      await wPost('/Destiny2/Actions/Items/EquipItem/', { itemId: alt.itemInstanceId, characterId: L.w });
      F.inv[L.w][i.b].splice(F.inv[L.w][i.b].indexOf(alt), 1); F.loc[alt.itemInstanceId] = { w: L.w, eq: true, it: alt };
    } else { const l = F.inv[L.w]?.[i.b] || []; const k = l.findIndex(x => x.itemInstanceId === i.id); if (k >= 0) l.splice(k, 1); }
    await wPost('/Destiny2/Actions/Items/TransferItem/', { itemReferenceHash: i.h, stackSize: 1, transferToVault: true, itemId: i.id, characterId: L.w });
    F.loc[i.id] = { w: 'v', it: L.it };
  }
  await wRoom(F, cid, i.b, keep);
  await wPost('/Destiny2/Actions/Items/TransferItem/', { itemReferenceHash: i.h, stackSize: 1, transferToVault: false, itemId: i.id, characterId: cid });
  F.inv[cid][i.b].push(L.it); F.loc[i.id] = { w: cid, it: L.it };
  return true;
}
async function wRun() {
  const T = wt(), plan = WR.plan, F = WR.fresh || await wFresh(), cid = plan.cid; WR.st = 'run'; WR.steps = []; wDraw();
  const keep = new Set([...(plan.items || []).map(i => i.id), plan.sub?.id].filter(Boolean));
  let inAct = false;
  try {
    // loadout salvo no próprio jogo: um pedido só
    if (plan.ld != null) { const s = wStep(T.ld(plan.name)); s.st = 'run'; wDraw(); try { await wPost('/Destiny2/Actions/Loadouts/EquipLoadout/', { loadoutIndex: plan.ld, characterId: cid }); s.st = 'ok'; } catch (e) { s.st = 'fail'; s.m = wMsg(e); if (e.code === 1671) inAct = true; } return wEnd(inAct); }
    // 1. trazer os itens para o personagem
    const toMove = plan.items.filter(i => F.loc[i.id]?.w !== cid);
    const sMove = toMove.length ? wStep(plan.only ? T.toChar(toMove.length) : T.move(toMove.length)) : null; let moved = 0, mFail = '';
    if (sMove) { sMove.st = 'run'; wDraw(); for (const i of toMove) { try { await wMove(F, i, cid, keep); moved++; sMove.t = (plan.only ? T.toChar(toMove.length) : T.move(toMove.length)) + ` · ${moved}/${toMove.length}`; wDraw(); } catch (e) { mFail = wMsg(e); } } sMove.st = mFail ? (moved ? 'part' : 'fail') : 'ok'; sMove.m = mFail; wDraw(); }
    if (plan.only) return wEnd(false);
    // 2. equipar (subclasse primeiro; exóticos por último para não brigar com o exótico que sai)
    const ids = [plan.sub?.id, ...plan.items.filter(i => !wExo(i.h)).map(i => i.id), ...plan.items.filter(i => wExo(i.h)).map(i => i.id)].filter(id => id && F.loc[id]?.w === cid && !F.loc[id]?.eq);
    if (ids.length) {
      const s = wStep(T.equip(ids.length)); s.st = 'run'; wDraw();
      try { const r = await wPost('/Destiny2/Actions/Items/EquipItems/', { itemIds: ids, characterId: cid }); const bad = (r?.equipResults || []).filter(x => x.equipStatus !== 1); if (bad.some(x => x.equipStatus === 1671)) inAct = true; s.st = bad.length ? (bad.length === ids.length ? 'fail' : 'part') : 'ok'; if (bad.length) s.m = wMsg({ code: bad[0].equipStatus }); }
      catch (e) { s.st = 'fail'; s.m = wMsg(e); if (e.code === 1671) inAct = true; }
      wDraw();
    }
    if (inAct) return wEnd(true);
    // 3. subclasse: aspectos antes dos fragmentos (os fragmentos dependem dos aspectos)
    if (plan.sub && Object.keys(plan.sub.so || {}).length) {
      const cur = F.sk[plan.sub.id]?.sockets || [], ch = Object.entries(plan.sub.so).filter(([k, h]) => cur[k]?.plugHash !== h);
      if (ch.length) { const s = wStep(T.sub(ch.length)); s.st = 'run'; wDraw(); let ok = 0, er = '';
        for (const [k, h] of ch) { try { await wPost('/Destiny2/Actions/Items/InsertSocketPlugFree/', { plug: { socketIndex: +k, socketArrayType: 0, plugItemHash: h }, itemId: plan.sub.id, characterId: cid }); ok++; } catch (e) { er = wMsg(e); if (e.code === 1671) { inAct = true; break; } } }
        s.st = er ? (ok ? 'part' : 'fail') : 'ok'; s.m = er; wDraw(); }
    }
    // 4. mods de cada peça
    const mods = Object.entries(plan.mods || {}).flatMap(([id, m]) => Object.entries(m).map(([k, h]) => [id, +k, h])).filter(([id, k, h]) => F.sk[id]?.sockets?.[k]?.plugHash !== h);
    if (mods.length && !inAct) { const s = wStep(T.mods(mods.length)); s.st = 'run'; wDraw(); let ok = 0, er = '';
      for (const [id, k, h] of mods) { try { await wPost('/Destiny2/Actions/Items/InsertSocketPlugFree/', { plug: { socketIndex: k, socketArrayType: 0, plugItemHash: h }, itemId: id, characterId: cid }); ok++; s.t = T.mods(mods.length) + ` · ${ok}/${mods.length}`; wDraw(); } catch (e) { er = wMsg(e); if (e.code === 1671) { inAct = true; break; } } }
      s.st = er ? (ok ? 'part' : 'fail') : 'ok'; s.m = er; wDraw(); }
    // 5. gravar no loadout do jogo (o que está equipado agora vira aquele loadout)
    if (plan.slot != null && !inAct) { const s = wStep(wt().snap(plan.slot + 1)); s.st = 'run'; wDraw(); try { await wPost('/Destiny2/Actions/Loadouts/SnapshotLoadout/', { loadoutIndex: plan.slot, characterId: cid }); s.st = 'ok'; } catch (e) { s.st = 'fail'; s.m = wMsg(e); if (e.code === 1671) inAct = true; } wDraw(); }
    return wEnd(inAct);
  } catch (e) { WR.st = 'err'; WR.err = wMsg(e); wDraw(); }
}
function wEnd(inAct) { WR.st = inAct ? 'inact' : 'done'; WR.fresh = null; wDraw(); setTimeout(() => { if (typeof start === 'function' && !document.hidden) { SESSION = null; autoT = 0; autoRefresh(); } }, 1500); }
function wDraw() {
  const d = $('wrdlg'); if (!d) return; const T = wt(), W = u(), P = WR.plan;
  const close = `<button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button>`;
  const head = `<header class="wr-hd"><small>${esc(T.t)} · ${esc(T.beta)}</small><h1>${esc(P?.name || '')}</h1>${P?.cid && profile?.characters?.data?.[P.cid] ? `<span>${esc(u().classes[profile.characters.data[P.cid].classType] || '')}</span>` : ''}</header>`;
  let body = '';
  if (WR.needPerm || (WR.st === 'err' && /permiss/i.test(WR.err))) body = `<p class="wr-warn">${esc(T.perm)}</p><div class="wr-acts"><button type="button" class="lb-run" data-wrrelog>${esc(T.relog)}</button></div>`;
  else if (WR.st === 'reading') body = `<p class="pf-msg wait">${esc(T.reading)}</p>`;
  else if (WR.st === 'err') body = `<p class="lb-err">${esc(WR.err)}</p>`;
  else if (WR.st === 'confirm') {
    const D = WR.diff, rows = P.ld != null ? [T.ld(P.name)] : P.only ? [T.toChar(P.items.filter(i => WR.fresh.loc[i.id]?.w !== P.cid).length)] : [D.move.length && T.move(D.move.length), D.equip && T.equip(D.equip), D.sub && T.sub(D.sub), D.mods && T.mods(D.mods), P.slot != null && T.snap(P.slot + 1)].filter(Boolean);
    body = rows.length ? `<b class="wr-k">${esc(T.sum)}</b><ul class="wr-l">${rows.map(r => `<li><span class="tl-i"></span><span>${esc(r)}</span></li>`).join('')}</ul>${P.art ? `<p class="lbd-n">${esc(T.art)}</p>` : ''}<p class="lbd-n">${esc(T.note)}</p><div class="wr-acts"><button type="button" class="lb-run" data-wrgo>${esc(T.confirm)}</button><button type="button" class="lbd-btn" data-wrx>${esc(T.cancel)}</button></div>` : `<p>${esc(T.already)}</p><div class="wr-acts"><button type="button" class="lbd-btn" data-wrx>${esc(T.close)}</button></div>`;
  } else {
    const ic = s => s === 'ok' ? '✓' : s === 'fail' ? '✕' : s === 'part' ? '!' : '';
    body = `<ul class="wr-l">${WR.steps.map(s => `<li class="${s.st}"><span class="tl-i">${ic(s.st)}</span><span>${esc(s.t)}${s.m ? `<small>${esc(s.m)}</small>` : ''}</span><small class="wr-s">${esc(s.st === 'run' ? T.run : s.st === 'wait' ? T.wait : s.st === 'ok' ? T.ok : T.fail)}</small></li>`).join('')}</ul>`
      + (WR.st === 'done' ? `<p class="wr-ok">${esc(T.done)}</p><div class="wr-acts"><button type="button" class="lbd-btn" data-wrx>${esc(T.close)}</button></div>` : '')
      + (WR.st === 'inact' ? `<p class="wr-warn">${esc(T.e[1671])} ${esc(T.inAct)}</p><div class="wr-acts">${WR.pending === P ? `<span class="wr-ok">${esc(T.laterOn)}</span>` : `<button type="button" class="lb-run" data-wrlater>${esc(T.later)}</button>`}<button type="button" class="lbd-btn" data-wrx>${esc(T.close)}</button></div>` : '');
  }
  d.innerHTML = `<div class="pf-box wr-box">${close}${head}${body}<p class="lbd-n lb-clan">${esc(lw().clan)}</p></div>`;
}
document.addEventListener('click', async e => {
  const dl = e.target.closest('[data-svdel]'); if (dl) { e.stopPropagation(); const l = savedList(), x = l[+dl.dataset.svdel]; if (!x) return;
    if (SVDEL !== x.k) { SVDEL = x.k; render(); setTimeout(() => { if (SVDEL === x.k) { SVDEL = null; render(); } }, 5000); return; }
    l.splice(+dl.dataset.svdel, 1); try { LS.set('dc-builds', l); } catch {} SVDEL = null;
    const n = LPA.list.length; LPA.list = LPA.list.filter(a => a.src !== 's:' + x.k); if (LPA.list.length !== n) lpaSave(); render(); return; }
  const sg = e.target.closest('[data-svgame]'); if (sg) { e.stopPropagation(); wSlotPick(+sg.dataset.svgame); return; }
  const sk = e.target.closest('[data-wrslot]'); if (sk) { e.stopPropagation(); const x = savedList()[+sk.dataset.wrslotb]; if (!x) return; const B = await fetchBuild(x.p, x.cid); const pl = wPlanFromCtx({ p: x.p, cid: x.cid, B }, x.title || x.t); pl.slot = +sk.dataset.wrslot; wOpen(pl); return; }
  const sa = e.target.closest('[data-svap]'); if (sa) { e.stopPropagation(); const x = savedList()[+sa.dataset.svap]; if (!x) return; const B = await fetchBuild(x.p, x.cid); wOpen(wPlanFromCtx({ p: x.p, cid: x.cid, B }, x.title || x.t)); }
}, true);
document.addEventListener('click', e => {
  if (!e.target.closest('[data-wrfd]')) return;
  if (FD.sel?.ld != null) wOpen({ cid: FD.cid, name: FD.sel.ldn || FD.sel.name, ld: FD.sel.ld });
  else wOpen(wPlanFromCtx(fdCtx(), FD.sel?.title || FD.sel?.name || ''));
});
$('wrdlg').addEventListener('click', e => {
  const d = $('wrdlg'), q = s => e.target.closest(s);
  if (e.target === d || q('.pf-x') || q('[data-wrx]')) { if (WR.st !== 'run') d.close(); return; }
  if (q('[data-wrgo]')) { wRun(); return; }
  if (q('[data-wrlater]')) { WR.pending = WR.plan; wDraw(); return; }
  if (q('[data-wrrelog]')) { WR.needPerm = false; logout(); login(); }
});
// salvar a build de outra pessoa no seu personagem: usa as suas cópias dos mesmos itens; o que você não tem fica com o que está equipado hoje
const CPT = { pt: { btn: 'Salvar no meu personagem', short: 'Copiar para mim', t: 'Salvar no meu personagem', noCls: c => `Você não tem um personagem ${c}.`, have: 'você tem', miss: e => `você não tem · fica: ${e}`, none: 'vazio', ok: 'Salva em “Criados no site” (botão Loadouts).', okN: n => n ? `${n} ${n === 1 ? 'item ficou' : 'itens ficaram'} com o que você usa hoje.` : 'Você tem todos os itens desta build.', sub: 'Subclasse e fragmentos vêm da build; o que você ainda não liberou fica de fora ao aplicar.', apply: 'Aplicar agora', name: n => `${n} (cópia)` },
  en: { btn: 'Save to my character', short: 'Copy to me', t: 'Save to my character', noCls: c => `You don't have a ${c} character.`, have: 'you have it', miss: e => `you don't have it · keeping: ${e}`, none: 'empty', ok: 'Saved in “Made on the site” (Loadouts button).', okN: n => n ? `${n} ${n === 1 ? 'item kept' : 'items kept'} what you use today.` : 'You have every item in this build.', sub: 'Subclass and fragments come from the build; anything you have not unlocked is skipped when applying.', apply: 'Apply now', name: n => `${n} (copy)` } };
const cpt = () => CPT[lang === 'pt' ? 'pt' : 'en'];
async function copyToMe(C, title, from) {
  const T = cpt(), W = u(), d = $('wrdlg'), B = C.B || {}, nm = h => (B.loc?.[h] || B.en?.[h] || {}).n || '…';
  const cls = C.p.characters.data[C.cid]?.classType, cid = profile.characters.data[charId]?.classType === cls ? charId : Object.keys(profile.characters.data).find(k => profile.characters.data[k].classType === cls);
  WR.st = 'pick'; WR.plan = null;
  const box = body => { d.innerHTML = `<div class="pf-box wr-box"><button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button><header class="wr-hd"><small>${esc(T.t)}</small><h1>${esc(title)}</h1></header>${body}</div>`; if (!d.open) d.showModal(); };
  if (!cid) { box(`<p class="lb-err">${esc(T.noCls(u().classes[cls] || ''))}</p>`); return; }
  box(`<p class="pf-msg wait">${esc(wt().reading)}</p>`);
  let F; try { F = await wFresh(); } catch (e) { box(`<p class="lb-err">${esc(wMsg(e))}</p>`); return; }
  const theirs = C.p.characterEquipment.data[C.cid].items, tsk = C.p.itemComponents?.sockets?.data || {}, en = B.en || {};
  // o mesmo item pode ter outro número (versões diferentes): compara pelo número e, se não achar, pelo nome no mesmo espaço e classe
  const mine = Object.values(F.loc).filter(L => { const c = ITEMS[L.it.itemHash]; if (c == null) return false; const sl = Math.floor(c / 100), k = Math.floor(c / 10) % 10; return sl <= 2 || k === 3 || k === cls; });
  const MN = await entities('DestinyInventoryItemDefinition', [...new Set([...mine.map(L => L.it.itemHash), ...Object.values(F.eq[cid] || {}).map(i => i.itemHash)])], lang === 'pt' ? 'pt' : 'en').catch(() => ({}));
  const key = n => String(n || '').toLowerCase().replace(/\s*\((adept|adepta|aprimorad[ao])\)$/, '').trim();
  const pick = l => l.sort((a, b) => (b.w === cid) - (a.w === cid) || (b.eq ? 1 : 0) - (a.eq ? 1 : 0))[0];
  const mineByHash = (h, b) => { const sl = ITEMS[h] != null ? Math.floor(ITEMS[h] / 100) : null, sameSlot = L => sl == null || Math.floor(ITEMS[L.it.itemHash] / 100) === sl;
    return pick(mine.filter(L => L.it.itemHash === h)) || pick(mine.filter(L => sameSlot(L) && key(MN[L.it.itemHash]?.n) && key(MN[L.it.itemHash]?.n) === key(nm(h)))); };
  const rows = [], items = [], so = {}, io = {}; let missing = 0;
  for (const b of [SUB_BUCKET, ...WEAPON_B, ...ARMOR_B]) {
    const t = theirs.find(i => i.bucketHash === b); if (!t) continue;
    let L = b === SUB_BUCKET ? Object.values(F.loc).find(x => x.it.itemHash === t.itemHash && x.w === cid) : mineByHash(t.itemHash, b), got = !!L;
    if (!L) { const cur = F.eq[cid]?.[b]; missing++; rows.push({ n: nm(t.itemHash), ok: false, e: cur ? (MN[cur.itemHash]?.n || LB.en?.[cur.itemHash]?.n || '?') : T.none }); if (!cur) continue; L = { it: cur, w: cid, eq: true }; }
    else rows.push({ n: nm(t.itemHash), ok: true });
    const it = L.it, id = it.itemInstanceId; items.push({ itemHash: it.itemHash, itemInstanceId: id, bucketHash: b });
    const mySk = F.sk[id]?.sockets || [];
    if (got && b === SUB_BUCKET) { so[id] = { sockets: mySk.map((x, k) => { const th = tsk[t.itemInstanceId]?.sockets?.[k]?.plugHash, e = en[th]; return th && e && !SKIP_NAME.test(e.n || '') && !SKIP_PT.test(e.n || '') ? { ...x, plugHash: th } : x; }) }; }
    else if (ARMOR_B.includes(b)) { so[id] = { sockets: mySk.map((x, k) => { const th = tsk[t.itemInstanceId]?.sockets?.[k]?.plugHash, e = en[th]; return th && e && pArmorMod(e) && pShow(e) ? { ...x, plugHash: th } : x; }) }; }
    else if (mySk.length) so[id] = { sockets: mySk };
  }
  const ch = profile.characters.data[cid], c = { characterId: cid, classType: ch.classType, raceType: ch.raceType, light: ch.light, emblemHash: ch.emblemHash, emblemPath: ch.emblemPath, emblemBackgroundPath: ch.emblemBackgroundPath, stats: ch.stats };
  const x = { k: 'cp|' + Date.now(), name: String(member?.name || '').replace(/#\d+$/, ''), t: T.name(title), title: T.name(title), at: Date.now(), cid, p: { characters: { data: { [cid]: c } }, characterEquipment: { data: { [cid]: { items } } }, itemComponents: { sockets: { data: so }, instances: { data: io } } } };
  x.from = from || ''; const l = savedList().filter(y => !(x.from && y.from === x.from)); l.unshift(x); try { LS.set('dc-builds', l.slice(0, 30)); } catch {}
  if (isGd()) render();
  box(`<ul class="wr-l">${rows.map(r => `<li class="${r.ok ? 'ok' : 'part'}"><span class="tl-i">${r.ok ? '✓' : '!'}</span><span>${esc(r.n)}<small>${esc(r.ok ? T.have : T.miss(r.e))}</small></span></li>`).join('')}</ul>
    <p class="wr-ok">${esc(T.ok)}</p><p class="lbd-n">${esc(T.okN(missing))} ${esc(T.sub)}</p>
    <div class="wr-acts">${wOk() ? `<button type="button" class="lb-run" data-cpapply>${esc(T.apply)}</button>` : ''}<button type="button" class="lbd-btn" data-wrx>${esc(W.giClose)}</button></div>`);
  CP_LAST = x;
}
let CP_LAST = null;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-cpme]'); if (b) { e.stopPropagation(); const C = fdCtx(); copyToMe(C, (FD.sel?.name || '').replace(/#\d+$/, ''), FD.sel?.k || (String(C.name).replace(/#\d+$/, '') + '|' + buildSig(C))); return; }
  const sc = e.target.closest('[data-svcp]'); if (sc) { e.stopPropagation(); const x = savedList()[+sc.dataset.svcp]; if (!x) return; const B = await fetchBuild(x.p, x.cid); copyToMe({ p: x.p, cid: x.cid, B, name: x.name }, `${x.title || x.t} · ${x.name}`, x.k); return; }
  const a = e.target.closest('[data-cpapply]'); if (a && CP_LAST) { e.stopPropagation(); const B = await fetchBuild(CP_LAST.p, CP_LAST.cid); wOpen(wPlanFromCtx({ p: CP_LAST.p, cid: CP_LAST.cid, B }, CP_LAST.title)); }
}, true);
// escolher o espaço de loadout do jogo onde gravar uma build salva
function wSlotPick(i) {
  const x = savedList()[i]; if (!x) return; const T = lw(), W = u(), d = $('wrdlg');
  const ls = profile.characterLoadouts?.data?.[x.cid]?.loadouts || [];
  const nm = (l, k) => (l.items || []).some(y => y.itemInstanceId && y.itemInstanceId !== '0') ? (loadoutNames[l.nameHash]?.n || `Loadout ${k + 1}`) : T.slotE(k + 1);
  WR.st = 'pick'; WR.plan = null;
  d.innerHTML = `<div class="pf-box wr-box"><button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button><header class="wr-hd"><small>${esc(wt().t)} · beta</small><h1>${esc(x.title || x.t)}</h1></header><b class="wr-k">${esc(T.slotT)}</b><div class="wr-slots">${ls.map((l, k) => `<button type="button" class="lbd-btn" data-wrslot="${k}" data-wrslotb="${i}"><b>${k + 1}</b> ${esc(nm(l, k))}</button>`).join('')}</div><p class="lbd-n">${esc(T.slotNote)}</p><p class="lbd-n lb-clan">${esc(T.clan)}</p></div>`;
  if (!d.open) d.showModal();
}
// aplicação pendente: roda sozinha quando o Ao vivo vê que você saiu da atividade (órbita, Torre ou jogo fechado)
const W_SOCIAL = new Set([82913930]); // órbita
function wPendingCheck(act) {
  if (!WR.pending || WR.st === 'run') return;
  const free = !act || !act.currentActivityHash || W_SOCIAL.has(act.currentActivityHash) || act.currentActivityModeType === 40;
  if (!free) return;
  const p = WR.pending; WR.pending = null; WR.plan = p;
  const d = $('wrdlg'); if (!d.open) d.showModal(); wFresh().then(F => { WR.fresh = F; wRun(); }).catch(() => {});
}
const wOk = () => !!member && lbAllowed();
const wBtn = (attr, label) => wOk() ? `<button type="button" class="wr-btn" ${attr}>${esc(label || wt().apply)} <small>beta</small></button>` : '';

/* Loadouts por atividade: você associa builds salvas ou loadouts do jogo a incursões, masmorras e missões; o Ao vivo oferece na hora */
const LPA = { list: LS.get('dc-actlo', []) }; // [{a: 'raid-xxx', src: 's:<chave>' | 'ld:<i>:<cid>', n: 'nome', enc: 'encontro opcional'}]
const lpaSave = () => { try { LS.set('dc-actlo', LPA.list); } catch {} };
const LPT = { pt: { t: 'Loadouts por atividade', note: 'Associe uma build salva ou um loadout do jogo a uma incursão, masmorra ou missão: no Ao vivo ele aparece na hora, para trazer do cofre ou aplicar.', src: 'Build ou loadout', act: 'Atividade', enc: 'Encontro (opcional)', encPh: 'ex.: Templários', add: 'Associar', none: 'Nenhuma associação ainda.', del: 'Remover', live: 'Loadout desta atividade', bring: 'Trazer do cofre', apply: 'Aplicar', orbit: 'Aplicar agora', pick: 'Próxima atividade', ldG: 'Loadouts do jogo', svG: 'Builds salvas' },
  en: { t: 'Loadouts by activity', note: 'Link a saved build or an in-game loadout to a raid, dungeon or mission: Live shows it right away, to bring from the vault or apply.', src: 'Build or loadout', act: 'Activity', enc: 'Encounter (optional)', encPh: 'e.g. Templar', add: 'Link', none: 'No links yet.', del: 'Remove', live: 'Loadout for this activity', bring: 'Bring from vault', apply: 'Apply', orbit: 'Apply now', pick: 'Next activity', ldG: 'In-game loadouts', svG: 'Saved builds' } };
const lpt = () => LPT[lang === 'pt' ? 'pt' : 'en'];
const lpaActs = () => [...(defs.raids || []).map(a => ['raid-' + a.k, L(a.n)]), ...(defs.dungeons || []).map(a => ['dg-' + a.k, L(a.n)]), ...(defs.xmissions || []).map(a => ['xm-' + a.k, L(a.n)])];
function lpaSrcs() {
  const out = [];
  for (const x of savedList()) if (profile?.characters?.data?.[x.cid]) out.push({ v: 's:' + x.k, n: x.title || x.t || x.name, g: 's' });
  for (const [cid, c] of Object.entries(profile?.characterLoadouts?.data || {})) (c.loadouts || []).forEach((l, i) => { if ((l.items || []).some(x => x.itemInstanceId && x.itemInstanceId !== '0')) out.push({ v: `ld:${i}:${cid}`, n: `${u().classes[profile.characters.data[cid]?.classType] || ''} · ${loadoutNames[l.nameHash]?.n || 'Loadout ' + (i + 1)}`, g: 'l' }); });
  return out;
}
// transforma uma associação num plano de aplicação
async function lpaPlan(x, only) {
  if (x.src.startsWith('ld:')) { const [, i, cid] = x.src.split(':'); return { cid, name: x.n, ld: +i }; }
  const s = savedList().find(y => 's:' + y.k === x.src); if (!s) return null;
  const B = await fetchBuild(s.p, s.cid); const plan = wPlanFromCtx({ p: s.p, cid: s.cid, B }, x.n);
  if (only) { plan.only = true; delete plan.sub; plan.mods = {}; }
  return plan;
}
function lpaHTML() {
  if (!wOk()) return ''; const T = lpt(), acts = lpaActs(), srcs = lpaSrcs(), an = Object.fromEntries(acts);
  const opt = (g, label) => { const l = srcs.filter(s => s.g === g); return l.length ? `<optgroup label="${esc(label)}">${l.map(s => `<option value="${esc(s.v)}">${esc(s.n)}</option>`).join('')}</optgroup>` : ''; };
  const rows = LPA.list.map((x, i) => `<li><span><b>${esc(an[x.a] || x.a)}</b>${x.enc ? ` <small>· ${esc(x.enc)}</small>` : ''}<small>${esc(x.n)}</small></span><button type="button" class="wr-btn" data-lpago="${i}">${esc(T.apply)} <small>beta</small></button><button type="button" class="lbd-btn" data-lpadel="${i}" aria-label="${esc(T.del)}">✕</button></li>`).join('');
  return `<article class="gd lb lpa"><div class="gd-head"><h2>${esc(T.t)} <small class="lb-beta">beta</small></h2></div><p>${esc(T.note)}</p>
    <div class="lpa-f"><label class="lb-f"><small>${esc(T.src)}</small><select class="tsort-sel" id="lpasrc">${opt('s', T.svG)}${opt('l', T.ldG)}</select></label><label class="lb-f"><small>${esc(T.act)}</small><select class="tsort-sel" id="lpaact">${acts.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></label><label class="lb-f"><small>${esc(T.enc)}</small><input class="lpa-in" id="lpaenc" type="text" maxlength="40" placeholder="${esc(T.encPh)}"></label><button type="button" class="lb-run" data-lpaadd${srcs.length ? '' : ' disabled'}>${esc(T.add)}</button></div>
    ${rows ? `<ul class="lpa-l">${rows}</ul>` : `<p class="lbd-n">${esc(T.none)}</p>`}<p class="lb-clan">${esc(lw().clan)}</p></article>`;
}
// Preparar (nas páginas de incursão/masmorra): as builds ligadas àquela atividade, para trazer do cofre ou aplicar; sem nenhuma, liga uma ali mesmo
function prepOpen(id) {
  const d = $('wrdlg'), T = lw(), P = lpt(), W = u(), an = Object.fromEntries(lpaActs()), l = LPA.list.map((x, i) => ({ x, i })).filter(o => o.x.a === id), srcs = lpaSrcs();
  const opt = (g, label) => { const s = srcs.filter(x => x.g === g); return s.length ? `<optgroup label="${esc(label)}">${s.map(x => `<option value="${esc(x.v)}">${esc(x.n)}</option>`).join('')}</optgroup>` : ''; };
  const form = `<div class="lpa-f"><label class="lb-f"><small>${esc(P.src)}</small><select class="tsort-sel" id="lpasrc">${opt('s', P.svG)}${opt('l', P.ldG)}</select></label><label class="lb-f"><small>${esc(P.enc)}</small><input class="lpa-in" id="lpaenc" type="text" maxlength="40" placeholder="${esc(P.encPh)}"></label><input type="hidden" id="lpaact" value="${esc(id)}"><button type="button" class="lb-run" data-lpaadd data-prepre="${esc(id)}"${srcs.length ? '' : ' disabled'}>${esc(T.prepAdd)}</button></div>`;
  WR.st = 'pick'; WR.plan = null;
  d.innerHTML = `<div class="pf-box wr-box"><button type="button" class="pf-x" aria-label="${esc(W.giClose)}">✕</button><header class="wr-hd"><small>${esc(T.prep)} · beta</small><h1>${esc(an[id] || id)}</h1></header>
    ${l.length ? `<ul class="lpa-l">${l.map(({ x, i }) => `<li><span><b>${esc(x.n)}</b>${x.enc ? `<small>${esc(x.enc)}</small>` : ''}</span>${x.src.startsWith('s:') ? `<button type="button" class="lbd-btn" data-lpabring="${i}">${esc(P.bring)}</button>` : ''}<button type="button" class="wr-btn" data-lpago="${i}">${esc(P.apply)} <small>beta</small></button></li>`).join('')}</ul><details class="prep-more"><summary>${esc(T.prepMore)}</summary>${form}</details>` : `<p>${esc(T.prepNone)}</p>${form}`}
    <p class="lbd-n lb-clan">${esc(T.clan)}</p></div>`;
  if (!d.open) d.showModal();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-prep]'); if (b) { e.stopPropagation(); e.preventDefault(); prepOpen(b.dataset.prep); } }, true);
// no Ao vivo: os loadouts associados à atividade em que você está
function lpaLive() {
  if (!wOk() || !LIVE.to) return ''; const l = LPA.list.map((x, i) => ({ x, i })).filter(o => o.x.a === LIVE.to[1]); if (!l.length) return ''; const T = lpt();
  return `<div class="lpa-live"><b>${esc(T.live)}</b>${l.map(({ x, i }) => `<span class="lpa-c"><span>${esc(x.n)}${x.enc ? ` <small>· ${esc(x.enc)}</small>` : ''}</span>${x.src.startsWith('s:') ? `<button type="button" class="lbd-btn" data-lpabring="${i}">${esc(T.bring)}</button>` : ''}<button type="button" class="wr-btn" data-lpago="${i}">${esc(T.apply)} <small>beta</small></button></span>`).join('')}</div>`;
}
document.addEventListener('click', async e => {
  const q = s => e.target.closest(s);
  const add = q('[data-lpaadd]'); if (add) { const s = $('lpasrc'), a = $('lpaact'), en = $('lpaenc'); if (!s?.value) return; LPA.list.push({ a: a.value, src: s.value, n: s.selectedOptions[0]?.textContent || '', enc: (en.value || '').trim().slice(0, 40) }); lpaSave(); if (add.dataset.prepre) prepOpen(add.dataset.prepre); render(); return; }
  const del = q('[data-lpadel]'); if (del) { LPA.list.splice(+del.dataset.lpadel, 1); lpaSave(); render(); return; }
  const go = q('[data-lpago]'), br = q('[data-lpabring]'); if (go || br) { const x = LPA.list[+(go || br).dataset[go ? 'lpago' : 'lpabring']]; if (!x) return; const p = await lpaPlan(x, !!br); if (p) wOpen(p); return; }
}, true);
/* ---------- Triunfos: todas as categorias do jogo, com busca ao lado e ☆ para o Foco ----------
   Nomes e árvore vêm dos arquivos do manifesto da Bungie (direto do CDN deles, uma vez por versão do jogo),
   enxugados e guardados no aparelho (IndexedDB). O progresso é o dos triunfos que o site já carrega. */
const TRT = { pt: { load: 'Baixando a lista de triunfos da Bungie (só na primeira vez de cada atualização do jogo)…', err: 'Não deu para baixar a lista de triunfos agora.', retry: 'Tentar de novo', q: 'Buscar triunfo', cats: 'Categorias', hide: 'Esconder concluídos', res: q => `Resultados para “${q}”`, n: n => `${n} triunfo${n === 1 ? '' : 's'}`, more: n => `Mostrar mais ${n}`, pins: '★ Acompanhando (aparecem no Foco, em Objetivos)', pinNo: 'Toque na ☆ de um triunfo para acompanhar aqui e no Foco.', none: 'Nada aqui com esse filtro.', all: 'Tudo concluído nesta categoria!', wait: 'Carregando seus triunfos…' },
  en: { load: 'Downloading the triumph list from Bungie (only the first time after each game update)…', err: "Couldn't download the triumph list right now.", retry: 'Try again', q: 'Search triumphs', cats: 'Categories', hide: 'Hide completed', res: q => `Results for “${q}”`, n: n => `${n} triumph${n === 1 ? '' : 's'}`, more: n => `Show ${n} more`, pins: '★ Tracking (shown in Focus, on Main)', pinNo: 'Tap the ☆ on a triumph to track it here and in Focus.', none: 'Nothing here with this filter.', all: 'All done in this category!', wait: 'Loading your triumphs…' } };
const trt = () => TRT[lang === 'pt' ? 'pt' : 'en'];
const TRI = { st: null, lc: '', cats: [], R: {}, cat: LS.get('dc-tri-cat', 0), q: '', hide: LS.get('dc-tri-hide', true), lim: 80 };
async function triLoad() {
  const lc = lang === 'pt' ? 'pt-br' : 'en'; if (TRI.st === 'load' || (TRI.st === 'ok' && TRI.lc === lc)) return;
  TRI.st = 'load'; TRI.lc = lc;
  try {
    const m = await bungie('/Destiny2/Manifest/', false), ver = m.version + ':' + lc;
    let c = await idbGet('tri1');
    if (!c || c.v !== ver) {
      const p = m.jsonWorldComponentContentPaths[lc];
      const [RD, ND] = await Promise.all([fetch(BNET + p.DestinyRecordDefinition).then(r => r.json()), fetch(BNET + p.DestinyPresentationNodeDefinition).then(r => r.json())]);
      const rootH = profile.profileRecords?.data?.recordCategoriesRootNodeHash, root = ND[rootH];
      const kids = n => (n?.children?.presentationNodes || []).map(x => ND[x.presentationNodeHash]).filter(x => x && !x.redacted);
      const top = kids(root), cats = [], R = {};
      // 1º filho = Triunfos (suas categorias viram as da lateral); depois Medalhas etc., menos Histórias (lore) e Catalisadores (já têm aba)
      const catNodes = [...kids(top[0]), ...top.slice(1).filter(n => !(n.children?.presentationNodes || []).some(c => (ND[c.presentationNodeHash]?.children?.records || []).some(r => RD[r.recordHash]?.loreHash)) && !/catal/i.test(n.displayProperties?.name || ''))];
      for (const cn of catNodes) {
        const recs = [], paths = [], seen = new Set();
        const walk = (n, path, d) => { if (d > 6) return; for (const r of n.children?.records || []) { const x = RD[r.recordHash]; if (!x || x.redacted || !x.displayProperties?.name || seen.has(r.recordHash)) continue; seen.add(r.recordHash); if (!R[r.recordHash]) R[r.recordHash] = { n: x.displayProperties.name, d: x.displayProperties.description || '', ic: x.displayProperties.icon || '' }; let pi = paths.indexOf(path); if (pi < 0) pi = paths.push(path) - 1; recs.push([r.recordHash, pi]); } for (const k of kids(n)) walk(k, path ? path + ' › ' + k.displayProperties.name : k.displayProperties.name, d + 1); };
        walk(cn, '', 0);
        if (recs.length) cats.push({ n: cn.displayProperties.name, ic: cn.displayProperties.icon || '', recs, paths });
      }
      c = { v: ver, cats, R }; idbSet('tri1', c);
    }
    TRI.cats = c.cats; TRI.R = c.R; TRI.st = 'ok'; if (TRI.cat >= TRI.cats.length) TRI.cat = 0;
  } catch (e) { console.warn('triunfos', e); TRI.st = 'err'; }
  if (tab === 'tri') render();
}
const triVis = h => { const r = recState(h); return r && !(r.state & 16) ? r : null; };
function triRow(h, path) {
  const x = TRI.R[h], r = triVis(h); if (!x || !r) return '';
  const ok = recDone(r), w = ok ? 100 : Math.floor(pct(r) * 100), pt = progText(r);
  const ext = ` data-focn="${esc(x.n)}" data-foci="${esc(x.ic)}" data-focd="${esc(x.d.slice(0, 140))}"`;
  return `<li class="tr-r${ok ? ' ok' : ''}">${x.ic ? `<span class="tr-ic" aria-hidden="true" style="background-image:url('${BNET}${x.ic}')"></span>` : '<span class="tr-ic" aria-hidden="true"></span>'}<span class="tr-t"><b>${esc(x.n)}</b><small>${esc(x.d)}</small>${path ? `<small class="tr-p">${esc(path)}</small>` : ''}</span><span class="tr-v"><small>${ok ? '✓' : pt || w + '%'}</small><i class="sea-bar"><u style="width:${w}%"></u></i></span>${focBtn('tri:' + h, ext)}</li>`;
}
function triList() {
  const T = trt(), q = TRI.q.trim().toLowerCase(); let rows = [];
  if (q.length >= 2) { for (const c of TRI.cats) for (const [h, pi] of c.recs) { const x = TRI.R[h]; if (x && (x.n + ' ' + x.d).toLowerCase().includes(q)) rows.push([h, c.n + (c.paths[pi] ? ' › ' + c.paths[pi] : '')]); } rows = rows.filter((r, i, a) => a.findIndex(y => y[0] === r[0]) === i); }
  else { const c = TRI.cats[TRI.cat]; if (c) rows = c.recs.map(([h, pi]) => [h, c.paths[pi]]); }
  rows = rows.filter(([h]) => { const r = triVis(h); return r && (!TRI.hide || !recDone(r)); });
  if (!q) rows.sort((a, b) => pct(triVis(b[0])) - pct(triVis(a[0])));
  const shown = rows.slice(0, TRI.lim).map(([h, p]) => triRow(h, p)).join('');
  const head = `<div class="tr-hd"><h2>${esc(q.length >= 2 ? T.res(TRI.q.trim()) : TRI.cats[TRI.cat]?.n || '')}</h2><small>${esc(T.n(rows.length))}</small><label class="tr-hide"><input type="checkbox" id="trhide"${TRI.hide ? ' checked' : ''}> ${esc(T.hide)}</label></div>`;
  return head + (rows.length ? `<ul class="tr-l">${shown}</ul>${rows.length > TRI.lim ? `<button type="button" class="char tr-more" data-trmore>${esc(T.more(Math.min(100, rows.length - TRI.lim)))}</button>` : ''}` : `<p class="empty-msg">${esc(!q && TRI.hide ? T.all : T.none)}</p>`);
}
function triPinsHTML() {
  const T = trt(), l = focList().filter(f => f.id.startsWith('tri:'));
  return `<div class="tr-pins"><span class="sea-k">${esc(T.pins)}</span>${l.length ? `<ul class="tr-l">${l.map(f => triRow(+f.id.slice(4), '')).join('')}</ul>` : `<small class="sea-l">${esc(T.pinNo)}</small>`}</div>`;
}
function triPins() { const e = document.querySelector('#list .tr-pins'); if (e) e.outerHTML = triPinsHTML(); }
function triHTML() {
  const T = trt();
  if (!have.b) return `<div class="panel"><p class="empty-msg wait">${esc(T.wait)}</p></div>`;
  if (TRI.st !== 'ok' || TRI.lc !== (lang === 'pt' ? 'pt-br' : 'en')) { if (TRI.st !== 'load' && TRI.st !== 'err') setTimeout(triLoad); return `<div class="panel">${TRI.st === 'err' ? `<p class="empty-msg">${esc(T.err)} <button type="button" class="char" data-trretry>${esc(T.retry)}</button></p>` : `<p class="empty-msg wait" role="status">${esc(T.load)}</p>`}</div>`; }
  const catPct = c => { let a = 0, b = 0; for (const [h] of c.recs) { const r = triVis(h); if (r) { b++; if (recDone(r)) a++; } } return b ? Math.floor(a / b * 100) : 0; };
  return `<div class="panel tr-wrap"><aside class="tr-side"><label class="tr-q">${esc(T.q)}<input type="search" id="trq" value="${esc(TRI.q)}" autocomplete="off"></label><span class="sea-k">${esc(T.cats)}</span><div class="tr-cats">${TRI.cats.map((c, i) => `<button type="button" class="tr-cat" data-trcat="${i}" aria-pressed="${i === TRI.cat && TRI.q.trim().length < 2}">${c.ic ? `<span class="tr-cic" aria-hidden="true" style="background-image:url('${BNET}${c.ic}')"></span>` : ''}<span>${esc(c.n)}</span><small>${catPct(c)}%</small></button>`).join('')}</div></aside>
    <section class="tr-main">${triPinsHTML()}<div class="tr-box" id="trbox">${triList()}</div></section></div>`;
}
const triRedraw = () => { const b = $('trbox'); if (b) b.innerHTML = triList(); };
document.addEventListener('input', e => { if (e.target.id !== 'trq') return; TRI.q = e.target.value; TRI.lim = 80; triRedraw(); document.querySelectorAll('[data-trcat]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.trcat === TRI.cat && TRI.q.trim().length < 2)); });
document.addEventListener('change', e => { if (e.target.id !== 'trhide') return; TRI.hide = e.target.checked; LS.set('dc-tri-hide', TRI.hide); TRI.lim = 80; triRedraw(); });
document.addEventListener('click', e => {
  const c = e.target.closest('[data-trcat]'); if (c) { TRI.cat = +c.dataset.trcat; LS.set('dc-tri-cat', TRI.cat); TRI.q = ''; TRI.lim = 80; const q = $('trq'); if (q) q.value = ''; document.querySelectorAll('[data-trcat]').forEach(b => b.setAttribute('aria-pressed', b === c)); triRedraw(); if (innerWidth < 760) $('trbox')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (e.target.closest('[data-trmore]')) { TRI.lim += 100; triRedraw(); return; }
  if (e.target.closest('[data-trretry]')) { TRI.st = null; render(); }
});
/* ---------- Busca ao lado (Títulos, Exóticos, Catalisadores): campo de busca + atalhos para cada seção ---------- */
const SIDE_TABS = ['tit', 'exo', 'cat'];
function sideRail() {
  if (!SIDE_TABS.includes(tab)) return; const pnl = $('list').querySelector(':scope > .panel'); if (!pnl) return;
  const secs = [...pnl.querySelectorAll(':scope > section[data-sec]')].filter(x => x.querySelector('h2') && x.querySelector('li[data-li]')); if (secs.length < 2) return;
  const T = trt(), wrap = document.createElement('div'); wrap.className = 'sr-wrap';
  const side = document.createElement('aside'); side.className = 'tr-side sr-side';
  side.innerHTML = `<label class="tr-q">${esc(u().search)}<input type="search" id="srq" value="${esc(query)}" autocomplete="off"></label><span class="sea-k">${esc(T.cats)}</span><div class="tr-cats">${secs.map(x => { const n = x.querySelectorAll('li[data-li]').length, d = [...x.querySelectorAll('li[data-li]')].filter(li => li.querySelector('input[type=checkbox]')?.checked).length; return `<button type="button" class="tr-cat" data-srjump="${esc(x.dataset.sec)}"><span>${esc(x.querySelector('h2').textContent)}</span><small>${d}/${n}</small></button>`; }).join('')}</div>`;
  pnl.before(wrap); wrap.append(side, pnl);
}
document.addEventListener('input', e => { if (e.target.id !== 'srq') return; query = e.target.value; const q = $('q'); if (q) q.value = query; filter(); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-srjump]'); if (!b) return;
  const sec = document.querySelector(`#list section[data-sec="${CSS.escape(b.dataset.srjump)}"]`); if (!sec) return;
  if (sec.classList.contains('collapsed')) { const h = sec.querySelector('.sec-head[data-coll]'); if (h) toggleSec(h); }
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
/* ---------- Temporada: passe, artefato, poder e reputações num cartão só (topo de Estatísticas) ---------- */
const SEAT = { pt: { t: 'Temporada', ends: d => d > 0 ? `termina em ${d} dias` : 'termina hoje', reset: t => `reset semanal em ${t}`, pass: 'Passe de recompensas', next: p => `${p}% para o próximo nível`, art: 'Artefato', artP: 'poder extra', artN: (p, n) => `${p}% para o próximo · ${n} pontos de vantagem`, pw: 'Poder', base: n => `base ${n}`, max: n => `máximo com o que você tem: ${n}`, reps: 'Reputações', lvl: n => `nível ${n}`, resets: n => n ? ` · ${n} reset${n === 1 ? '' : 's'}` : '' },
  en: { t: 'Season', ends: d => d > 0 ? `ends in ${d} days` : 'ends today', reset: t => `weekly reset in ${t}`, pass: 'Rewards pass', next: p => `${p}% to the next level`, art: 'Artifact', artP: 'bonus power', artN: (p, n) => `${p}% to the next · ${n} perk points`, pw: 'Power', base: n => `base ${n}`, max: n => `max with what you own: ${n}`, reps: 'Reputations', lvl: n => `level ${n}`, resets: n => n ? ` · ${n} reset${n === 1 ? '' : 's'}` : '' } };
const SEA = { p: null, busy: false, def: null };
function seasonHTML() {
  const T = SEAT[lang === 'pt' ? 'pt' : 'en'], W = u(), G = GD, cp = profile?.characterProgressions?.data?.[charId], ch = profile?.characters?.data?.[charId]; if (!ch) return '';
  if (!SEA.p && !SEA.busy && member) { SEA.busy = true; Promise.all([bungie(`/Destiny2/${member.type}/Profile/${member.id}/?components=104`).then(r => { SEA.p = r.profileProgression?.data || {}; }).catch(() => { SEA.p = {}; }), (async () => { const h = profile.profile?.data?.currentSeasonHash; if (h) SEA.def = await bungie(`/Destiny2/Manifest/DestinySeasonDefinition/${h}/?lc=${lang === 'pt' ? 'pt-br' : 'en'}`, false).catch(() => null); })()]).finally(() => { SEA.busy = false; if (tab === 'gst') render(); }); }
  const pct = (a, b) => b ? Math.min(100, Math.round(a / b * 100)) : 0;
  const left = t => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? `${d}d ${h}h` : `${h}h ${m % 60}min`; };
  const end = SEA.def?.endDate ? Date.parse(SEA.def.endDate) : 0, days = end && end - Date.now() < 400 * 864e5 ? Math.ceil((end - Date.now()) / 864e5) : null;
  const art = SEA.p?.seasonalArtifact, pb = art?.powerBonus || 0, mp = maxPower(ch.classType);
  const card = (k, big, small, bar, lines, color) => `<div class="sea-c"><span class="sea-k">${esc(k)}</span><b class="sea-b">${big}${small ? ` <small>${esc(small)}</small>` : ''}</b>${bar != null ? `<i class="sea-bar"><u style="width:${bar}%;background:${color}"></u></i>` : ''}${lines.filter(Boolean).map(l => `<small class="sea-l">${esc(l)}</small>`).join('')}</div>`;
  const pass = G?.pass ? card(T.pass, G.pass.lvl, G.pass.n, pct(G.pass.a, G.pass.b), [T.next(pct(G.pass.a, G.pass.b))], 'var(--acc)') : '';
  const artC = art && (pb || art.pointsAcquired) ? card(T.art, '+' + pb, T.artP, pct(art.powerBonusProgression?.progressToNextLevel, art.powerBonusProgression?.nextLevelAt), [T.artN(pct(art.powerBonusProgression?.progressToNextLevel, art.powerBonusProgression?.nextLevelAt), art.pointsAcquired ?? 0)], 'var(--exotic)') : '';
  const pwC = card(T.pw, ch.light, pb ? T.base(ch.light - pb) : '', null, [mp ? T.max(mp) : ''], '');
  const reps = RANK_PROGS.map(h => { const x = cp?.progressions?.[h], n = G?.names?.[h]?.n; return x && n && (x.level || x.currentProgress) ? `<div class="sea-r"><span><b>${esc(n)}</b><small>${esc(T.lvl(x.level) + T.resets(x.currentResetCount || 0))}</small></span><i class="sea-bar"><u style="width:${x.nextLevelAt ? pct(x.progressToNextLevel, x.nextLevelAt) : 100}%"></u></i><small class="sea-v">${x.nextLevelAt ? pct(x.progressToNextLevel, x.nextLevelAt) + '%' : '✓'}</small></div>` : ''; }).join('');
  return `<article class="gd sea"><div class="gd-head"><h2>${esc(T.t)}${SEA.def?.displayProperties?.name ? ` <small>${esc(SEA.def.displayProperties.name)}${days != null ? ' · ' + esc(T.ends(days)) : ''}</small>` : ''}</h2><span class="sea-reset">${esc(T.reset(left(nextReset())))}</span></div>
    <div class="sea-g">${pass}${artC}${pwC}</div>${reps ? `<span class="sea-k">${esc(T.reps)}</span><div class="sea-rg">${reps}</div>` : ''}</article>`;
}
/* ---------- Relatórios: incursões e masmorras recentes, com o relatório completo de cada partida ----------
   A lista vem do histórico (um pedido por personagem e tipo); o relatório só é buscado ao abrir a partida. */
const REPT = { pt: { t: 'Relatórios', note: 'Suas incursões e masmorras recentes. Toque numa para ver o relatório completo da partida.', all: 'Todas', raid: 'Incursões', dg: 'Masmorras', onlyDone: 'Só concluídas', load: 'Lendo o histórico…', none: 'Nenhuma incursão ou masmorra recente.', pick: 'Escolha uma partida.', done: 'concluída', left: 'saiu antes do fim', fresh: 'do começo', cp: 'a partir de checkpoint', players: n => `grupo de ${n}`, k: 'Abates', d: 'Mortes', a: 'Assist.', kd: 'K/D', tp: 'Tempo', pr: 'Precisão', ab: 'Super / granada / corpo a corpo', abS: 'Sup. / gran. / CaC', wp: 'Armas mais usadas', team: 'Equipe', rec: 'Seu recorde nesta atividade!', build: 'Ver build atual', buildN: 'O relatório mostra as armas que cada um usou na partida; a build aberta pelo botão é a que a pessoa usa agora.', ext: 'Ver no', kind: { raid: 'Incursão', dg: 'Masmorra' } },
  en: { t: 'Reports', note: 'Your recent raids and dungeons. Tap one to see the full match report.', all: 'All', raid: 'Raids', dg: 'Dungeons', onlyDone: 'Completed only', load: 'Reading history…', none: 'No recent raid or dungeon.', pick: 'Pick a match.', done: 'completed', left: 'left before the end', fresh: 'fresh start', cp: 'from checkpoint', players: n => `fireteam of ${n}`, k: 'Kills', d: 'Deaths', a: 'Assists', kd: 'K/D', tp: 'Time', pr: 'Precision', ab: 'Super / grenade / melee', abS: 'Sup. / gren. / melee', wp: 'Most used weapons', team: 'Team', rec: 'Your record for this activity!', build: 'See current build', buildN: 'The report shows the weapons each player used in the match; the button opens the build they use now.', ext: 'See on', kind: { raid: 'Raid', dg: 'Dungeon' } } };
const rept = () => REPT[lang === 'pt' ? 'pt' : 'en'];
const REP = { list: null, busy: false, f: 'all', done: false, sel: null, pg: {}, names: {}, wn: {} };
async function repLoad() {
  if (REP.busy || !member) return; REP.busy = true;
  try {
    const chars = Object.keys(profile.characters?.data || {}), all = [];
    await Promise.all(chars.flatMap(c => [4, 82].map(m => bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${c}/Stats/Activities/?count=20&mode=${m}`, false).then(r => { for (const a of r.activities || []) all.push({ a, m }); }).catch(() => {}))));
    const seen = new Set(), list = [];
    for (const { a, m } of all.sort((x, y) => Date.parse(y.a.period) - Date.parse(x.a.period))) { const id = a.activityDetails.instanceId; if (seen.has(id)) continue; seen.add(id); const v = k => a.values?.[k]?.basic?.value || 0;
      list.push({ id, h: a.activityDetails.directorActivityHash || a.activityDetails.referenceId, m, at: Date.parse(a.period), dur: v('activityDurationSeconds'), ok: v('completed') === 1 && v('completionReason') !== 2, k: v('kills'), d: v('deaths'), pc: v('playerCount') }); }
    REP.list = list.slice(0, 40);
    const hs = [...new Set(REP.list.map(x => x.h))];
    Object.assign(REP.names, await entities('DestinyActivityDefinition', hs, lang).catch(() => ({})));
    const mk = await mapActs(hs, h => REP.list.find(x => x.h === h)?.m).catch(() => ({})); for (const x of REP.list) x.kk = mk[x.h];
  } catch { REP.list = REP.list || []; }
  REP.busy = false; if (tab === 'grep') render();
}
async function repOpen(id) {
  REP.sel = id; render(); if (REP.pg[id]) return;
  try {
    const j = await fetch(`https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${id}/`, { headers: { 'X-API-Key': cfg.apiKey } }).then(r => r.json()); if (j.ErrorCode !== 1) throw 0;
    const P = j.Response, by = {};
    for (const e of P.entries || []) { const u0 = e.player?.destinyUserInfo || {}, mid = u0.membershipId, v = k => e.values?.[k]?.basic?.value || 0, x = e.extended?.values || {}, xv = k => x[k]?.basic?.value || 0;
      const p = by[mid] = by[mid] || { mid, mt: u0.membershipType, n: u0.bungieGlobalDisplayName || u0.displayName || '?', full: u0.bungieGlobalDisplayName ? `${u0.bungieGlobalDisplayName}#${String(u0.bungieGlobalDisplayNameCode || 0).padStart(4, '0')}` : (u0.displayName || ''), cls: (u().classes[{ Titan: 0, Hunter: 1, Warlock: 2 }[e.player?.characterClass]] ?? e.player?.characterClass) || '', l: e.player?.lightLevel || 0, em: e.player?.destinyUserInfo?.iconPath || '', k: 0, d: 0, a: 0, t: 0, pr: 0, su: 0, gr: 0, me: 0, ok: false, w: {} };
      p.k += v('kills'); p.d += v('deaths'); p.a += v('assists'); p.t += v('timePlayedSeconds'); p.pr += xv('precisionKills'); p.su += xv('weaponKillsSuper'); p.gr += xv('weaponKillsGrenade'); p.me += xv('weaponKillsMelee'); if (v('completed') === 1) p.ok = true;
      for (const w of e.extended?.weapons || []) p.w[w.referenceId] = (p.w[w.referenceId] || 0) + (w.values?.uniqueWeaponKills?.basic?.value || 0); }
    const pl = Object.values(by).sort((a, b) => b.k - a.k), wh = [...new Set(pl.flatMap(p => Object.keys(p.w)))].map(Number);
    Object.assign(REP.wn, await entities('DestinyInventoryItemDefinition', wh.filter(h => !REP.wn[h]), lang).catch(() => ({})));
    REP.pg[id] = { pl, fresh: P.activityWasStartedFromBeginning !== false && !P.startingPhaseIndex, at: Date.parse(P.period) };
  } catch { REP.pg[id] = { err: true }; }
  if (tab === 'grep') render();
}
function repHTML() {
  const T = rept(), W = u(); if (!member) return '';
  if (!REP.list) { if (!REP.busy) setTimeout(repLoad, 0); return `<article class="gd rep"><div class="gd-head"><h2>${esc(T.t)}</h2></div><p class="wait">${esc(T.load)}</p></article>`; }
  const fmt = t => new Date(t).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const kindOf = x => x.kk?.kind || (x.m === 4 ? 'raid' : 'dg');
  const vis = REP.list.filter(x => (REP.f === 'all' || kindOf(x) === REP.f) && (!REP.done || x.ok));
  if (!REP.sel && vis[0]) setTimeout(() => repOpen(vis[0].id), 0);
  const chip = (v, t) => `<button type="button" class="lbd-chip${REP.f === v ? ' on' : ''}" data-repf="${v}">${esc(t)}</button>`;
  const img = x => actImg(x.h, x.kk?.kind, x.kk?.k);
  const side = `<aside class="rep-side"><div class="lbd-chips">${chip('all', T.all)}${chip('raid', T.raid)}${chip('dg', T.dg)}</div><label class="lbd-ck"><input type="checkbox" data-repdone${REP.done ? ' checked' : ''}><span>${esc(T.onlyDone)}</span></label>
    ${vis.length ? vis.map(x => { const im = img(x); return `<button type="button" class="rep-i${REP.sel === x.id ? ' on' : ''}" data-rep="${x.id}"><span class="rep-im"${im ? ` style="background-image:url('${BNET}${im}')"` : ''}></span><span class="rep-it"><b>${esc(REP.names[x.h]?.n || '…')}</b><small>${esc(fmt(x.at) + ' · ' + T.players(x.pc || 1))}</small></span><small class="rep-r ${x.ok ? 'ok' : 'no'}">${x.ok ? fmtDur(x.dur * 1000) : '✕'}</small></button>`; }).join('') : `<p class="lbd-n">${esc(T.none)}</p>`}</aside>`;
  const x = REP.list.find(y => y.id === REP.sel), P = x && REP.pg[x.id];
  let main = `<p class="lbd-n">${esc(T.pick)}</p>`;
  if (x) {
    const im = img(x), kind = kindOf(x), best = ACTH?.d?.[x.kk?.k]?.fast, rec = x.ok && best && Math.abs(best / 1000 - x.dur) < 2;
    const head = `<div class="rep-hd"${im ? ` style="--rep-img:url('${BNET}${im}')"` : ''}><small>${esc(T.kind[kind] + ' · ' + (x.ok ? T.done : T.left) + ' · ' + fmt(x.at))}</small><h2>${esc(REP.names[x.h]?.n || '…')}</h2><div class="rep-meta"><span>⏱ <b>${fmtDur(x.dur * 1000)}</b></span><span>${esc(T.players(x.pc || 1))}</span>${P?.pl ? `<span>${P.pl.reduce((t, p) => t + p.k, 0)} ${esc(T.k.toLowerCase())} · ${P.pl.reduce((t, p) => t + p.d, 0)} ${esc(T.d.toLowerCase())}</span><span>${esc(P.fresh ? T.fresh : T.cp)}</span>` : ''}${rec ? `<span class="rep-rec">⏱ ${esc(T.rec)}</span>` : ''}</div></div>`;
    const wIc = h => REP.wn[h]?.ic ? `<img src="${BNET}${REP.wn[h].ic}" alt="" title="${esc(REP.wn[h]?.n || '')}">` : '';
    const rows = !P ? `<p class="wait">${esc(W.loadingDefs)}</p>` : P.err ? `<p class="lb-err">${esc(W.unavailable)}</p>` : `<div class="rep-tb"><div class="rep-th"><span>${esc(T.team)}</span><span>${esc(T.k)}</span><span>${esc(T.d)}</span><span>${esc(T.a)}</span><span>${esc(T.kd)}</span><span>${esc(T.pr)}</span><span>${esc(T.ab)}</span><span>${esc(T.wp)}</span></div>${P.pl.map(p => { const ws = Object.entries(p.w).sort((a, b) => b[1] - a[1]).slice(0, 3); return `<div class="rep-tr${p.mid === member.id ? ' me' : ''}${p.ok ? '' : ' left'}"><button type="button" class="rep-p" data-mt="${p.mt}" data-mid="${esc(p.mid)}" data-name="${esc(p.full)}" title="${esc(T.build)}"><span class="rep-em"${p.em ? ` style="background-image:url('${BNET}${p.em}')"` : ''}></span><span><b>${esc(p.n)}</b><small>${esc([p.cls, p.l ? '✦ ' + p.l : '', fmtDur(p.t * 1000)].filter(Boolean).join(' · '))}</small></span></button><b data-l="${esc(T.k)}">${p.k}</b><b data-l="${esc(T.d)}">${p.d}</b><span data-l="${esc(T.a)}">${p.a}</span><span data-l="${esc(T.kd)}">${(p.k / Math.max(1, p.d)).toFixed(1)}</span><span data-l="${esc(T.pr)}">${p.pr}</span><span data-l="${esc(T.abS)}">${p.su} / ${p.gr} / ${p.me}</span><span class="rep-w">${ws.map(([h, k]) => `<span>${wIc(h)}<small>${esc(REP.wn[h]?.n || '')} · ${k}</small></span>`).join('')}</span></div>`; }).join('')}</div>`;
    main = `${head}${rows}<p class="lbd-n">${esc(T.buildN)}</p><p class="rep-ext">${esc(T.ext)} <a href="https://${kind === 'raid' ? 'raid' : 'dungeon'}.report/pgcr/${x.id}" target="_blank" rel="noopener">${kind === 'raid' ? 'raid' : 'dungeon'}.report ↗</a></p>`;
  }
  return `<article class="gd rep"><div class="gd-head"><h2>${esc(T.t)}</h2></div><p>${esc(T.note)}</p><div class="rep-cols">${side}<section class="rep-main">${main}</section></div></article>`;
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-repf]'); if (f) { REP.f = f.dataset.repf; REP.sel = null; render(); return; }
  const r = e.target.closest('[data-rep]'); if (r) { repOpen(r.dataset.rep); return; }
  const p = e.target.closest('.rep-p'); if (p) { FD.q = ''; FD.results = null; openFind({ name: p.dataset.name, type: +p.dataset.mt, id: p.dataset.mid }); }
});
document.addEventListener('change', e => { if (e.target.matches('[data-repdone]')) { REP.done = e.target.checked; REP.sel = null; render(); } });
/* ---------- Clã ao vivo: o que cada membro online está jogando agora ----------
   Só busca quando a página do clã está aberta (um pedido à Bungie por membro online) e atualiza a cada minuto. */
const CLVT = { pt: { t: 'Clã ao vivo', on: (a, b) => `${a} online de ${b}`, note: 'O que cada um está jogando agora. Atualiza sozinho a cada minuto com esta página aberta; toque num cartão para ver a build.', all: 'Todos', act: 'Em incursão/masmorra', soc: 'Na órbita/Torre', none: 'Ninguém do clã online agora.', priv: 'perfil privado', together: 'Jogando juntos', orbit: 'Órbita ou Torre', solo: 'solo', grp: n => `grupo de ${n}`, since: t => `há ${t}`, load: 'Lendo o que o clã está jogando…', none2: 'Ninguém neste filtro.' },
  en: { t: 'Clan live', on: (a, b) => `${a} online of ${b}`, note: 'What everyone is playing right now. Refreshes every minute while this page is open; tap a card to see the build.', all: 'All', act: 'In raid/dungeon', soc: 'In orbit/Tower', none: 'Nobody from the clan is online right now.', priv: 'private profile', together: 'Playing together', orbit: 'Orbit or Tower', solo: 'solo', grp: n => `fireteam of ${n}`, since: t => `${t} ago`, load: 'Reading what the clan is playing…', none2: 'Nobody in this filter.' } };
const clvt = () => CLVT[lang === 'pt' ? 'pt' : 'en'];
const CLV = { at: 0, busy: false, rows: {}, f: 'all', names: {}, kinds: {} };
const W_SOC = new Set([82913930]);
async function clvLoad(force) {
  const list = (GD?.clan?.list || []).filter(x => x.on); if (CLV.busy || (!force && Date.now() - CLV.at < 55000)) return;
  CLV.busy = true; CLV.at = Date.now();
  try {
    const out = {}; let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => { while (i < list.length) { const x = list[i++]; try {
      const p = await bungie(`/Destiny2/${x.mt}/Profile/${x.mid}/?components=100,200,204,1000`, false);
      const ch = Object.values(p.characters?.data || {}).sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))[0];
      const a = ch && p.characterActivities?.data?.[ch.characterId], pm = p.profileTransitoryData?.data?.partyMembers || [];
      out[x.mid] = ch ? { ch, h: a?.currentActivityHash || 0, mode: a?.currentActivityModeType, st: a?.dateActivityStarted ? Date.parse(a.dateActivityStarted) : 0, party: pm.map(m => m.membershipId), priv: !a } : { priv: true };
    } catch { out[x.mid] = { priv: true }; } } }));
    const hs = [...new Set(Object.values(out).map(r => r.h).filter(Boolean))];
    Object.assign(CLV.names, await entities('DestinyActivityDefinition', hs.filter(h => !CLV.names[h]), lang).catch(() => ({})));
    Object.assign(CLV.kinds, await mapActs(hs.filter(h => !CLV.kinds[h]), h => Object.values(out).find(r => r.h === h)?.mode).catch(() => ({})));
    CLV.rows = out;
  } catch {}
  CLV.busy = false; if (isGd() && tab === 'gcl') render();
}
setInterval(() => { if (!document.hidden && isGd() && tab === 'gcl' && GD?.clan?.list) clvLoad(); }, 60000);
function clvHTML() {
  const T = clvt(), W = u(), list = GD?.clan?.list || []; if (!list.length) return '';
  const on = list.filter(x => x.on); if (on.length && !CLV.at) setTimeout(() => clvLoad(), 0);
  const rows = on.map(x => ({ x, r: CLV.rows[x.mid] })).map(o => { const r = o.r || {}, k = CLV.kinds[r.h], soc = !r.h || W_SOC.has(r.h) || r.mode === 40 || !CLV.names[r.h]?.n; return { ...o, k, soc }; });
  const vis = rows.filter(o => CLV.f === 'all' || (CLV.f === 'act' ? !!o.k : o.soc)).sort((a, b) => (!!b.k - !!a.k) || ((a.r?.st || 0) - (b.r?.st || 0)));
  const mins = t => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
  const card = o => { const r = o.r || {}, ch = r.ch, nm = (r.h && CLV.names[r.h]?.n) || T.orbit, raid = !!o.k, sz = (r.party || []).length;
    return `<button type="button" class="clv-c${raid ? ' raid' : ''}" data-mt="${o.x.mt}" data-mid="${esc(o.x.mid)}" data-name="${esc(o.x.full)}"><span class="clv-em"${ch?.emblemBackgroundPath ? ` style="background-image:url('${BNET}${ch.emblemBackgroundPath}')"` : ''}></span><span class="clv-t"><b>${esc(o.x.n)}</b><span class="clv-a">${esc(r.priv ? T.priv : nm || '—')}</span><small>${esc([ch ? u().classes[ch.classType] : '', sz > 1 ? T.grp(sz) : sz === 1 ? T.solo : ''].filter(Boolean).join(' · '))}</small></span><span class="clv-r">${ch ? `<b>✦ ${ch.light}</b>` : ''}${r.st ? `<small>${esc(T.since(mins(r.st)))}</small>` : ''}</span></button>`; };
  // jogando juntos: membros do clã no mesmo grupo (pela lista do grupo; sem ela, mesma incursão/masmorra)
  const groups = [], seen = new Set();
  for (const o of rows.filter(o => !o.soc && o.r?.h)) { if (seen.has(o.x.mid)) continue; const mates = rows.filter(p => !p.soc && p.r?.h === o.r.h && (o.r.party?.includes(p.x.mid) || p.r.party?.includes(o.x.mid) || (!o.r.party?.length && o.k && Math.abs((p.r.st || 0) - (o.r.st || 0)) < 600000))); if (mates.length > 1) { mates.forEach(p => seen.add(p.x.mid)); groups.push({ h: o.r.h, k: o.k, m: mates.map(p => p.x.n), sz: Math.max(...mates.map(p => p.r.party?.length || 0)) }); } }
  const chip = (v, t) => `<button type="button" class="lbd-chip${CLV.f === v ? ' on' : ''}" data-clvf="${v}">${esc(t)}</button>`;
  const body = !on.length ? `<p class="lbd-n">${esc(T.none)}</p>` : !CLV.at || (CLV.busy && !Object.keys(CLV.rows).length) ? `<p class="wait">${esc(T.load)}</p>` : `<div class="clv-g">${vis.map(card).join('') || `<p class="lbd-n">${esc(T.none2)}</p>`}</div>${groups.length ? `<div class="clv-tog"><span>${esc(T.together)}</span>${groups.map(g => `<p><b>${esc(CLV.names[g.h]?.n || '')}:</b> ${g.m.map(esc).join(', ')}${g.sz ? ` · ${g.m.length}/${g.sz > 6 ? 6 : Math.max(g.sz, g.m.length)}` : ''} ${g.k ? actYt(g.k.kind, g.k.k) : ''}</p>`).join('')}</div>` : ''}`;
  return `<article class="gd clv"><div class="gd-head"><h2><i class="clv-dot" aria-hidden="true"></i>${esc(T.t)} <small>${esc(T.on(on.length, list.length + 1))}</small></h2></div><p>${esc(T.note)}</p><div class="lbd-chips">${chip('all', T.all)}${chip('act', T.act)}${chip('soc', T.soc)}</div>${body}</article>`;
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-clvf]'); if (f) { CLV.f = f.dataset.clvf; render(); return; }
  const c = e.target.closest('.clv-c'); if (c) { FD.q = ''; FD.results = null; openFind({ name: c.dataset.name, type: +c.dataset.mt, id: c.dataset.mid }); }
});
/* ---------- Menu (hambúrguer) e tamanho da letra ----------
   O menu leva a qualquer página do site num toque; o tamanho da letra amplia o site todo (fica salvo neste aparelho). */
const FZ = [0.9, 1, 1.1, 1.2, 1.35];
const NVT = { pt: { t: 'Menu', go: 'Ir para', more: 'Atalhos', ld: 'Loadouts', find: 'Buscar guardião', news: 'Novidades e sugestões', fz: 'Tamanho da letra', fzD: 'Aumenta ou diminui o site todo, só neste aparelho.', theme: 'Tema claro/escuro', lang: 'English', out: 'Sair', close: 'Fechar', smaller: 'Diminuir a letra', bigger: 'Aumentar a letra' },
  en: { t: 'Menu', go: 'Go to', more: 'Shortcuts', ld: 'Loadouts', find: 'Find a guardian', news: "What's new & suggestions", fz: 'Text size', fzD: 'Makes the whole site bigger or smaller, on this device only.', theme: 'Light/dark theme', lang: 'Português', out: 'Sign out', close: 'Close', smaller: 'Smaller text', bigger: 'Bigger text' } };
const nvt = () => NVT[lang === 'pt' ? 'pt' : 'en'];
function fzApply() { const z = LS.get('dc-fz', 1); document.querySelector('.wrap').style.zoom = z === 1 ? '' : String(z); }
function navDraw() {
  const d = $('navdlg'), T = nvt(), U = u(), cur = tab, z = LS.get('dc-fz', 1), zi = FZ.indexOf(z);
  d.innerHTML = `<div class="nav-box"><div class="nav-hd"><b>${esc(T.t)}</b><button type="button" class="nav-x" data-navx aria-label="${esc(T.close)}">✕</button></div>
    <div class="nav-g nav-fzg"><span class="nav-gt">${esc(T.fz)}</span><div class="nav-fz"><button type="button" class="nav-fzb" data-navfz="-1" aria-label="${esc(T.smaller)}"${zi <= 0 ? ' disabled' : ''}>A−</button><b>${Math.round(z * 100)}%</b><button type="button" class="nav-fzb big" data-navfz="1" aria-label="${esc(T.bigger)}"${zi >= FZ.length - 1 ? ' disabled' : ''}>A+</button></div><small>${esc(T.fzD)}</small></div>
    <nav class="nav-l" aria-label="${esc(T.go)}">${GROUPS.map(g => `<div class="nav-g"><span class="nav-gt">${esc(U.tabs[g.id])}</span>${g.subs.map(sb => `<button type="button" class="nav-i${sb === cur ? ' on' : ''}" data-navgo="${sb}"${sb === cur ? ' aria-current="page"' : ''}>${esc(g.subs.length === 1 ? U.tabs[g.id] : (U.subs[sb] || sb))}</button>`).join('')}</div>`).join('')}</nav>
    <div class="nav-g"><span class="nav-gt">${esc(T.more)}</span>${have.c ? `<button type="button" class="nav-i${cur === 'ld' ? ' on' : ''}" data-navgo="ld">${esc(T.ld)}</button>` : ''}<button type="button" class="nav-i" data-navfind>${esc(T.find)}</button><a class="nav-i" href="/novidades">${esc(T.news)}</a></div>
    <div class="nav-g nav-row"><button type="button" class="nav-i" data-navtheme>${esc(T.theme)}</button><button type="button" class="nav-i" data-navlang>${esc(T.lang)}</button>${auth ? `<button type="button" class="nav-i out" data-navout>${esc(T.out)}</button>` : ''}</div></div>`;
}
$('menubtn').hidden = false; fzApply();
$('menubtn').addEventListener('click', () => { navDraw(); $('navdlg').showModal(); });
$('navdlg').addEventListener('click', e => {
  const d = $('navdlg'), q = s => e.target.closest(s);
  if (e.target === d || q('[data-navx]')) { d.close(); return; }
  const g = q('[data-navgo]'); if (g) { d.close(); const t = g.dataset.navgo; if (t === 'ld') { if (tab !== 'ld') { prevTab = tab; go('ld'); } } else go(t); window.scrollTo({ top: 0 }); return; }
  if (q('[data-navfind]')) { d.close(); openFind(); return; }
  const f = q('[data-navfz]'); if (f) { const i = Math.max(0, Math.min(FZ.length - 1, FZ.indexOf(LS.get('dc-fz', 1)) + +f.dataset.navfz)); LS.set('dc-fz', FZ[i] ?? 1); fzApply(); navDraw(); return; }
  if (q('[data-navtheme]')) { $('themebtn').click(); return; }
  if (q('[data-navlang]')) { d.close(); $('langbtn').click(); return; }
  if (q('[data-navout]')) { d.close(); $('logout').click(); }
});
/* ---------- Clã: grupo de primeira vez (quem nunca fez a atividade escolhida, online primeiro, e quem pode guiar) ---------- */
const FIRST = { k: LS.get('dc-first', '') };
function firstHTML() {
  const W = u(), list = GD?.clan?.list || []; if (!list.length) return '';
  const acts = ACT_METRICS(), f = featured(), def = acts.find(([k, a]) => f[k]?.has?.(a.k)) || acts[0], key = FIRST.k && (/^(raid|dg|all):\*$/.test(FIRST.k) || acts.some(([k, a]) => k + ':' + a.k === FIRST.k)) ? FIRST.k : def[0] + ':' + def[1].k;
  const [kind, ak] = key.split(':'), all = ak === '*', ms = all ? acts.filter(([k]) => kind === 'all' || k === kind).map(([, x]) => x.m) : [acts.find(([k, x]) => k === kind && x.k === ak)[1].m];
  const cnt = mid => ms.reduce((t, m) => t + (GMET[mid].m[m] || 0), 0);
  const sel = `<select class="tsort-sel fg-s" id="firstsel"><option value="all:*"${key === 'all:*' ? ' selected' : ''}>${esc(W.fgAnyAll)}</option>${[['raid', W.subs.raid], ['dg', W.subs.dg]].map(([k, t]) => `<optgroup label="${esc(t)}"><option value="${k}:*"${key === k + ':*' ? ' selected' : ''}>${esc(k === 'raid' ? W.fgAnyRaid : W.fgAnyDg)}</option>${acts.filter(([kk]) => kk === k).map(([kk, x]) => `<option value="${kk}:${x.k}"${kk + ':' + x.k === key ? ' selected' : ''}>${esc(L(x.n))}${f[kk]?.has?.(x.k) ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const got = list.filter(x => GMET[x.mid] && !GMET[x.mid].priv);
  let body;
  if (!got.length) body = `<button type="button" class="char clck-b" data-clck ${CLCK.busy ? 'disabled' : ''}>${esc(CLCK.busy ? W.clckLoading(CLCK.n, list.length) : W.fgLoad)}</button>`;
  else {
    const never = got.filter(x => !(cnt(x.mid) > 0)), did = got.filter(x => cnt(x.mid) > 0).sort((p, q) => cnt(q.mid) - cnt(p.mid));
    const meNever = !(ms.reduce((t, m) => t + (metric(m) || 0), 0) > 0), on = never.filter(x => x.on), off = never.filter(x => !x.on).sort((p, q) => q.t - p.t).slice(0, 12);
    const chip = (x, extra) => `<span class="clck-p${x.on ? ' on' : ''}">${x.on ? '<i class="fg-on" aria-hidden="true"></i>' : ''}${esc(x.n)}${extra ? ` <small>${esc(extra)}</small>` : ''}</span>`;
    body = `${meNever ? `<p class="fg-me">${esc(W.fgMe)}</p>` : ''}
      <div class="fg-k">${esc(W.fgOn(on.length))}</div><p class="fg-l">${on.length ? on.map(x => chip(x)).join('') : `<span class="fg-none">${esc(W.fgNoneOn)}</span>`}</p>
      ${off.length ? `<div class="fg-k">${esc(W.fgOff)}</div><p class="fg-l">${off.map(x => chip(x)).join('')}</p>` : ''}
      ${all ? '' : `<div class="fg-k">${esc(W.fgGuides(did.length))}</div><p class="fg-l">${did.filter(x => x.on).concat(did.filter(x => !x.on)).slice(0, 10).map(x => chip(x, '×' + cnt(x.mid))).join('') || `<span class="fg-none">—</span>`}</p>`}`;
  }
  return `<article class="gd"><div class="gd-head"><h2>${esc(W.fgT)}</h2></div><p>${esc(W.fgNote)}</p>${sel}${body}</article>`;
}
document.addEventListener('change', e => { if (e.target.id !== 'firstsel') return; FIRST.k = e.target.value; LS.set('dc-first', FIRST.k); render(); });
/* ---------- Beta: comparar guardiões (conclusões de cada atividade, lado a lado) ---------- */
const CMPG = { sel: null };
function cmpGHTML() {
  const W = u(), opts = [...favs().map(f => ({ n: f.name.replace(/#\d+$/, ''), mt: f.type, mid: f.id })), ...(GD?.clan?.list || []).map(x => ({ n: x.n, mt: x.mt, mid: x.mid }))].filter((x, i, l) => l.findIndex(y => y.mid === x.mid) === i).sort((a, b) => a.n.localeCompare(b.n, lang === 'en' ? 'en' : 'pt-BR', { sensitivity: 'base' }));
  const o = CMPG.sel && GMET[CMPG.sel.mid];
  let body = '';
  if (CMPG.sel && !o) body = `<p class="wait">${esc(W.loadingDefs)}</p>`;
  else if (o?.priv) body = `<p>${esc(W.cmpgPriv)}</p>`;
  else if (o) {
    const rows = ACT_METRICS().map(([k, a]) => ({ k, a, me: metric(a.m), him: o.m[a.m] || 0 })).filter(r => r.me || r.him);
    const tot = (f) => rows.reduce((t, r) => t + f(r), 0);
    body = `<table class="cmpg"><thead><tr><th></th><th>${esc(W.cmpgYou)}</th><th>${esc(CMPG.sel.n)}</th></tr></thead><tbody>${profile.profile?.data?.currentGuardianRank ? `<tr><td>${esc(W.w.gRank)}</td>${cmpCell(profile.profile.data.currentGuardianRank, o.gr)}</tr>` : ''}${rows.map(r => `<tr><td>${esc(L(r.a.n))}</td>${cmpCell(r.me, r.him)}</tr>`).join('')}<tr class="tot"><td>${esc(W.cmpgTot)}</td>${cmpCell(tot(r => r.me), tot(r => r.him))}</tr></tbody></table>`;
  }
  return `<article class="gd"><div class="gd-head"><h2>${esc(W.cmpgT)}</h2></div><p>${esc(W.cmpgNote)}</p><select class="tsort-sel cmpg-s" id="cmpgsel"><option value="">${esc(W.cmpgPick)}</option>${opts.map(x => `<option value="${esc(x.mt + ':' + x.mid)}"${CMPG.sel?.mid === x.mid ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select>${body}</article>`;
}
const cmpCell = (a, b) => `<td class="${a > b ? 'win' : ''}">${fmtN(a)}</td><td class="${b > a ? 'win' : ''}">${fmtN(b)}</td>`;
document.addEventListener('change', e => { if (e.target.id !== 'cmpgsel') return; const [mt, mid] = e.target.value.split(':'); const n = e.target.selectedOptions[0]?.textContent || ''; CMPG.sel = mid ? { mt: +mt, mid, n } : null; render(); if (mid) guardianMetrics(+mt, mid).then(() => { if (isGd()) render(); }); });
/* ---------- Foco: títulos, incursões, masmorras, missões, exóticos e catalisadores marcados com ☆ aparecem em destaque nos Objetivos ---------- */
const FOCUS_TABS = ['tit', 'raid', 'dg', 'xm'], FOCUS_ITEM_TABS = ['exo', 'cat'];
const focList = () => LS.get('dc-focus', []);
const focHas = id => focList().some(x => x.id === id);
const focBtn = (id, ext = '') => `<button type="button" class="foc-b" data-foc="${esc(id)}"${ext} aria-pressed="${focHas(id)}" title="${esc(u().focT)}" aria-label="${esc(u().focT)}">${focHas(id) ? '★' : '☆'}</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-foc]'); if (!b) return; e.stopPropagation(); e.preventDefault();
  const id = b.dataset.foc, l = focList(), i = l.findIndex(x => x.id === id);
  if (i >= 0) l.splice(i, 1); else l.unshift({ id, at: Date.now(), ...(b.dataset.focn ? { n: b.dataset.focn, ic: b.dataset.foci || '', d: b.dataset.focd || '' } : {}) });
  LS.set('dc-focus', l.slice(0, 30));
  document.querySelectorAll(`[data-foc="${CSS.escape(id)}"]`).forEach(x => { const on = i < 0; x.setAttribute('aria-pressed', on); x.textContent = on ? '★' : '☆'; });
  if (tab === 'obj') render(); if (tab === 'tri') triPins();
}, true);
function focusHTML() {
  const l = focList(); if (!l.length) return '';
  const W = u(), open = !openSecs.has('foc-x');
  const cards = l.map(f => {
    const [k, id] = [f.id.slice(0, f.id.indexOf(':')), f.id.slice(f.id.indexOf(':') + 1)];
    if (k === 'tri') {
      const r = recState(+id), ok = recDone(r), pt = progText(r);
      return `<div class="fo-c fo-it${ok ? ' ok' : ''}"><div class="fo-h">${f.ic ? `<span class="it-ic fo-ic" aria-hidden="true" style="background-image:url('${BNET}${f.ic}')"></span>` : ''}<span><small>${esc(u().subs.tri)}</small><b>${esc(f.n || '')}</b></span><span class="fo-n">${ok ? '✓' : pt || Math.floor(pct(r) * 100) + '%'}</span>${focBtn(f.id)}</div><i class="fo-bar"><u style="width:${ok ? 100 : Math.floor(pct(r) * 100)}%"></u></i>${f.d ? `<p class="fo-d">${esc(f.d)}</p>` : ''}</div>`;
    }
    if (k === 'sec') {
      const sec = SECTIONS.find(x => x.id === id); if (!sec) return '';
      const done = sec.items.filter(isDone).length, left = sec.items.filter(i => !isDone(i));
      return `<div class="fo-c${left.length ? '' : ' ok'}"><div class="fo-h"><span><small>${esc(u().subs[sec.tab] || '')}</small><b>${esc(sec.title)}</b></span><span class="fo-n">${done}/${sec.items.length}</span>${focBtn(f.id)}</div><i class="fo-bar"><u style="width:${sec.items.length ? done / sec.items.length * 100 : 0}%"></u></i>${left.length ? `<ul>${left.slice(0, 4).map(i => `<li>${esc(i.t)}${i.c[0] ? ` <span class="chip ${chipClass(i.c[0])}">${esc(i.c[0])}</span>` : ''}</li>`).join('')}${left.length > 4 ? `<li class="fo-more">${esc(W.focMore(left.length - 4))}</li>` : ''}</ul>` : `<p class="fo-done">✓ ${esc(W.focDone)}</p>`}<button type="button" class="fo-go" data-jump="${sec.tab}:${sec.id}">${esc(W.wkFull)} →</button></div>`;
    }
    const it = findItem(id), sec = it && SECTIONS.find(x => x.items.includes(it)); if (!it) return '';
    const ok = isDone(it);
    const ich = itemIch(sec, it);
    return `<div class="fo-c fo-it${ok ? ' ok' : ''}"><div class="fo-h">${ich ? `<span class="it-ic fo-ic" data-ich="${ich}" aria-hidden="true"${ICONS[ich] ? ` style="background-image:url('${BNET}${ICONS[ich]}')"` : ''}></span>` : ''}<span><small>${esc(u().subs[sec?.tab] || '')}${sec ? ' · ' + esc(sec.title) : ''}</small><b>${esc(it.t)}</b></span>${it.c[0] ? `<span class="chip ${chipClass(it.c[0])}">${esc(it.c[0])}</span>` : ''}${focBtn(f.id)}</div>${ok ? `<p class="fo-done">✓ ${esc(W.focDone)}</p>` : `<div class="fo-more">${itemMore(it, it.c.slice(1))}</div>`}</div>`;
  }).join('');
  return `<section data-sec="focus" class="keep fo coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="foc-x" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>★ ${esc(W.focT)}</h2></div><span class="count">${l.length}</span><span class="chev" aria-hidden="true"></span></div><p>${esc(W.focNote)}</p></div><div class="fo-g">${cards}</div></section>`;
}
/* ---------- Patente de Guardião: nível atual e o que falta para o próximo ----------
   O progresso vem dos triunfos que o site já carrega; nomes e imagens da Bungie, uma vez por patente, guardados no aparelho. */
const GRT = { pt: { t: 'Patente de Guardião', cur: 'Atual', hi: n => `maior já alcançada: ${n}`, next: n => `Para a patente ${n}`, left: n => n ? `Faltam ${n} ${n === 1 ? 'objetivo' : 'objetivos'}` : 'Tudo pronto: a patente sobe ao entrar no jogo', max: 'Você está na patente máxima.', note: 'O que falta para subir de patente, com o seu progresso.' },
  en: { t: 'Guardian Rank', cur: 'Current', hi: n => `highest reached: ${n}`, next: n => `For rank ${n}`, left: n => n ? `${n} ${n === 1 ? 'objective' : 'objectives'} left` : 'All done: the rank goes up when you log in', max: 'You are at the highest rank.', note: 'What is left to rank up, with your progress.' } };
const grt = () => GRT[lang === 'pt' ? 'pt' : 'en'];
const GRD = LS.get('dc-grank1', {}), grdP = {};
function grDef(n) {
  const lc = lang === 'pt' ? 'pt-br' : 'en', k = n + ':' + lc; if (GRD[k]) return GRD[k]; if (grdP[k]) return null;
  grdP[k] = (async () => {
    const d = await bungie(`/Destiny2/Manifest/DestinyGuardianRankDefinition/${n}/?lc=${lc}`, false);
    const groups = [];
    if (d.presentationNodeHash) {
      const node = await bungie(`/Destiny2/Manifest/DestinyPresentationNodeDefinition/${d.presentationNodeHash}/?lc=${lc}`, false);
      for (const c of node.children?.presentationNodes || []) {
        const g = await bungie(`/Destiny2/Manifest/DestinyPresentationNodeDefinition/${c.presentationNodeHash}/?lc=${lc}`, false);
        const recs = await Promise.all((g.children?.records || []).map(r => bungie(`/Destiny2/Manifest/DestinyRecordDefinition/${r.recordHash}/?lc=${lc}`, false).then(rd => ({ h: r.recordHash, n: rd.displayProperties?.name || '', d: rd.displayProperties?.description || '', ic: rd.displayProperties?.icon || '' })).catch(() => null)));
        groups.push({ n: g.displayProperties?.name || '', recs: recs.filter(Boolean) });
      }
    }
    GRD[k] = { n: d.displayProperties?.name || '', d: d.displayProperties?.description || '', img: d.foregroundImagePath || '', groups };
    try { LS.set('dc-grank1', GRD); } catch {}
    if (tab === 'obj' || isGd()) render();
  })().catch(() => { delete grdP[k]; });
  return null;
}
// estado de cada objetivo: feito, progresso (a/b) ou sem informação
function grRec(h) { const r = recState(h); if (!r) return { na: true }; const o = (r.objectives || [])[0]; return { ok: recDone(r), a: o?.progress ?? 0, b: o?.completionValue ?? 0 }; }
function grInfo() {
  const pd = profile?.profile?.data, cur = pd?.currentGuardianRank; if (!cur) return null;
  const next = cur < 11 ? grDef(cur + 1) : null, me = grDef(cur);
  const left = next ? next.groups.flatMap(g => g.recs).filter(r => { const x = grRec(r.h); return !x.na && !x.ok; }).length : 0;
  return { cur, hi: pd.lifetimeHighestGuardianRank || cur, me, next, nextN: cur + 1, max: cur >= 11, left };
}
function grList(G) {
  return G.next.groups.filter(g => g.recs.length).map(g => `<div class="gr-g"><small>${esc(g.n)}</small><ul>${g.recs.map(r => { const x = grRec(r.h), p = x.b ? Math.min(100, x.a / x.b * 100) : x.ok ? 100 : 0;
    return `<li class="${x.ok ? 'ok' : ''}${x.na ? ' na' : ''}" title="${esc(r.d)}"><span class="tl-i">${x.ok ? '✓' : ''}</span><span class="gr-n"><b>${esc(r.n)}</b>${r.d && !x.ok ? `<small>${esc(r.d)}</small>` : ''}</span>${x.na ? '<span class="gr-v">—</span>' : `<span class="gr-v">${fmtN(x.a)}/${fmtN(x.b)}</span>`}${x.na ? '' : `<i class="gr-bar"><u style="width:${p}%"></u></i>`}</li>`; }).join('')}</ul></div>`).join('');
}
// Guardião › Estatísticas: cartão completo
function grHTML() {
  const G = grInfo(); if (!G) return ''; const T = grt(), W = u();
  const head = `<div class="gr-hd">${G.me?.img ? `<img src="${BNET}${G.me.img}" alt="">` : `<span class="gr-num">${G.cur}</span>`}<span><small>${esc(T.cur)}</small><b>${G.cur} · ${esc(G.me?.n || '')}</b><small>${esc(T.hi(G.hi))}</small></span></div>`;
  const body = G.max ? `<p>${esc(T.max)}</p>` : !G.next ? `<p class="wait">${esc(W.loadingDefs)}</p>` : `<div class="gr-nx"><b>${esc(T.next(G.nextN))} · ${esc(G.next.n)}</b><span class="gr-left${G.left ? '' : ' ok'}">${esc(T.left(G.left))}</span></div>${grList(G)}`;
  return `<article class="gd gr"><div class="gd-head"><h2>${esc(T.t)}</h2></div>${head}${body}</article>`;
}
// Objetivos: o que falta para a próxima patente (recolhível, fechado mostra o resumo)
function grObjHTML() {
  const G = grInfo(); if (!G || G.max) return ''; const T = grt(), W = u(), open = openSecs.has('grank-x');
  return `<section data-sec="grank" class="keep gr coll${open ? '' : ' collapsed'}"><div class="sec-head" data-coll="grank-x" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>${esc(T.t)} ${G.cur} → ${G.nextN}${G.next ? ' · ' + esc(G.next.n) : ''}</h2></div><span class="count">${G.next ? esc(T.left(G.left).replace(/:.*/, '')) : ''}</span><span class="chev" aria-hidden="true"></span></div><p>${esc(T.note)}</p></div>${G.next ? `<div class="gr-body">${grList(G)}</div>` : `<p class="wait">${esc(W.loadingDefs)}</p>`}</section>`;
}
/* ---------- Correios (beta): o que está parado no Postmaster de cada personagem; usa o inventário já carregado ---------- */
const POST_BUCKET = 215593132, POSTN = {};
function postHTML() {
  if (!have.c || !profile?.characterInventories?.data) return '';
  const W = u(), chars = Object.entries(profile.characters.data), per = chars.map(([cid, ch]) => ({ cid, ch, items: (profile.characterInventories.data[cid]?.items || []).filter(i => i.bucketHash === POST_BUCKET) }));
  const total = per.reduce((t, x) => t + x.items.length, 0);
  if (!total) return '';
  const need = [...new Set(per.flatMap(x => x.items.map(i => i.itemHash)))].filter(h => !POSTN[h]);
  if (need.length && !postHTML.busy) { postHTML.busy = true; entities('DestinyInventoryItemDefinition', need, lang === 'pt' ? 'pt' : 'en').then(m => { Object.assign(POSTN, m); postHTML.busy = false; if (tab === 'obj') render(); }).catch(() => { postHTML.busy = false; }); }
  const open = openSecs.has('post'), full = per.some(x => x.items.length >= 15);
  return `<section data-sec="post" class="keep post coll${open ? '' : ' collapsed'}${full ? ' warn' : ''}"><div class="sec-head" data-coll="post" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>✉ ${esc(W.postT)}</h2></div><span class="count">${total}</span><span class="chev" aria-hidden="true"></span></div>
    <p class="post-sum">${per.map(x => `<span class="${x.items.length >= 15 ? 'hot' : ''}">${esc(W.classes[x.ch.classType] || '')} <b>${x.items.length}/21</b></span>`).join('')}</p>${full ? `<p class="post-warn">${esc(W.postFull)}</p>` : ''}</div>
    <div class="post-body">${per.filter(x => x.items.length).map(x => `<div class="post-c"><div class="post-k">${esc(W.classes[x.ch.classType] || '')} · ${x.items.length}/21</div><div class="post-l">${x.items.map(i => { const d = POSTN[i.itemHash] || {}; return `<div class="post-i${d.tt === 6 ? ' exo' : ''}" title="${esc(d.n || '')}">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : '<span class="post-noic"></span>'}<span><b>${esc(d.n || '…')}</b>${i.quantity > 1 ? `<small>×${i.quantity}</small>` : d.tl ? `<small>${esc(d.tl)}</small>` : ''}</span></div>`; }).join('')}</div></div>`).join('')}<p class="post-note">${esc(W.postNote)}</p></div></section>`;
}
/* ---------- Novidades da Bungie (beta): notas de atualização do Destiny 2 dos últimos dias; uma consulta a cada 3 h ---------- */
let NEWS = LS.get('dc-news', null);
function newsHTML() {
  if (!cfg?.apiKey) return '';
  if ((!NEWS || Date.now() - NEWS.at > 3 * 3600e3) && !newsHTML.busy) { newsHTML.busy = true; fetch(BNET + '/Platform/Content/Rss/NewsArticles/0/?includebody=false', { headers: { 'X-API-Key': cfg.apiKey } }).then(r => r.json()).then(j => { const l = (j.Response?.NewsArticles || []).filter(x => /destiny/i.test(x.Title) && !/marathon/i.test(x.Title)).slice(0, 6).map(x => ({ t: x.Title, l: x.Link, d: x.PubDate, s: x.Description || '', id: x.UniqueIdentifier || x.Link })); NEWS = { at: Date.now(), l }; LS.set('dc-news', NEWS); if (tab === 'obj') render(); }).catch(() => {}).finally(() => { newsHTML.busy = false; }); }
  const hid = new Set(LS.get('dc-newsx', [])), W = u();
  const up = (NEWS?.l || []).filter(x => /update|hotfix|atualiza/i.test(x.t) && Date.now() - Date.parse(x.d) < 14 * 864e5 && !hid.has(x.id))[0];
  if (!up) return '';
  const days = Math.floor((Date.now() - Date.parse(up.d)) / 864e5), link = BNET + up.l.replace('/7/en/', lang === 'pt' ? '/7/pt-br/' : '/7/en/');
  return `<div class="news" role="status"><span class="news-ic" aria-hidden="true">⟳</span><div><b>${esc(W.newsT(up.t))}</b><small>${esc(W.newsAgo(days))}${up.s ? ' · ' + esc(up.s) : ''}</small></div><a href="${esc(link)}" target="_blank" rel="noopener">${esc(W.newsRead)}</a><button type="button" class="news-x" data-newsx="${esc(up.id)}" aria-label="${esc(W.giClose)}">✕</button></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-newsx]'); if (!b) return; const l = LS.get('dc-newsx', []); l.push(b.dataset.newsx); LS.set('dc-newsx', l.slice(-20)); render(); });
/* ---------- Metas de build (beta) ----------
   Na comparação, o que falta vira uma meta: encaixes (aspectos, fragmentos, habilidades) pelos seus conjuntos de encaixes;
   armas e exóticas pela coleção; armadura lendária de conjunto vira "N peças do conjunto" (qualquer peça serve). */
const goals = () => LS.get('dc-goals', []);
const GLC = new Set(LS.get('dc-glc', [])); // metas recolhidas (só neste aparelho)
const SETITEMS = LS.get('dc-setitems', {}); let setItemsP = {};
function setItems(h) {
  if (SETITEMS[h]) return Promise.resolve(SETITEMS[h]);
  if (!setItemsP[h]) setItemsP[h] = (async () => {
    const d = await bungie(`/Destiny2/Manifest/DestinyEquipableItemSetDefinition/${h}/`, false);
    const list = d.setItems || [];
    const info = await Promise.all(list.map(x => bungie(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${x}/`, false).then(i => [x, i.classType, i.inventory?.bucketTypeHash || 0]).catch(() => null)));
    SETITEMS[h] = info.filter(Boolean); try { LS.set('dc-setitems', SETITEMS); } catch {} return SETITEMS[h];
  })().catch(() => { delete setItemsP[h]; return null; });
  return setItemsP[h];
}
function goalFromCmp(A, Bc) {
  const a = buildParts(A), b = buildParts(Bc), B = Bc.B, d = h => B.loc[h] || B.en[h] || {}, items = [];
  const plug = (g, list) => { for (const h of list) if (h && iOwnPlug(h) === false) items.push({ g, k: 'plug', h, n: d(h).n, ic: d(h).ic }); };
  plug('ab', b.ab); plug('asp', b.asp); plug('fr', b.fr);
  for (const h of b.w) if (h && iOwnItem(h) === false) items.push({ g: 'w', k: 'item', h, n: d(h).n, ic: d(h).ic, tt: B.en[h]?.tt });
  const sets = {};
  for (const h of b.arm) {
    if (!h) continue;
    const sh = SETOF[h];
    if (B.en[h]?.tt !== 6 && sh) { sets[sh] = (sets[sh] || 0) + 1; continue; }
    if (iOwnItem(h) === false) items.push({ g: 'a', k: 'item', h, n: d(h).n, ic: d(h).ic, tt: B.en[h]?.tt });
  }
  for (const [sh, cnt] of Object.entries(sets)) { if (cnt < 2) continue; const nm = SETDEF[sh + ':' + (lang === 'pt' ? 'pt-br' : 'en')]?.n || ''; items.push({ g: 'a', k: 'set', h: +sh, need: cnt, n: nm, cls: Bc.p.characters.data[Bc.cid].classType }); }
  const ch = Bc.p.characters.data[Bc.cid];
  return { id: (FD.sel?.id || '') + ':' + Bc.cid + ':' + buildSig(Bc), sel: FD.sel ? { name: FD.sel.name, type: FD.sel.type, id: FD.sel.id } : null, title: `${String(Bc.name || '').replace(/#\d+$/, '')} · ${charTitle(u().classes[ch.classType] || '', B.loc[b.sub]?.n)}`, cls: ch.classType, el: ELEMENTS[B.en[b.sub]?.dt] || '', at: Date.now(), st: ch.stats ? Object.fromEntries(STAT_ORDER.map(h => [h, ch.stats[h] || 0])) : null, items };
}
function goalCta(A, Bc) {
  if (!PLUGS) { loadPlugs(); return ''; }
  const g = goalFromCmp(A, Bc), n = g.items.length; if (!n) return '';
  const exists = goals().some(x => x.id === g.id), W = u();
  return `<div class="gl-cta"><small>${esc(W.glAdd(n))}</small><button type="button" class="gl-add" ${exists ? 'disabled' : ''}>${esc(exists ? W.glDone : W.glBtn)}</button></div>`;
}
function goalState(it, ownedSets) {
  if (it.k === 'plug') return iOwnPlug(it.h);
  if (it.k === 'item') return iOwnItem(it.h);
  if (it.k === 'set') { const got = ownedSets[it.h]; return got == null ? null : got >= it.need; }
  return null;
}
// peças de conjunto que você tem (inventário, cofre ou equipadas), por espaço de armadura e classe
function ownedSetSlots(list, cls) {
  const have = new Set(), all = [...(profile.profileInventory?.data?.items || []), ...Object.values(profile.characterInventories?.data || {}).flatMap(c => c.items || []), ...Object.values(profile.characterEquipment?.data || {}).flatMap(c => c.items || [])].map(i => i.itemHash);
  const hs = new Set(all); for (const [h, c, b] of list) if ((c === cls || c === 3) && hs.has(h)) have.add(b);
  return have.size;
}
let goalLoading = false;
const CSRC = LS.get('dc-csrc', {});
function collSrc(h) { // "Fonte: ..." da coleção, no idioma do site
  const c = COLL[h], k = c + ':' + lang; if (!c) return Promise.resolve('');
  if (CSRC[k] != null) return Promise.resolve(CSRC[k]);
  return bungie(`/Destiny2/Manifest/DestinyCollectibleDefinition/${c}/?lc=${lang === 'pt' ? 'pt-br' : 'en'}`, false).then(d => { CSRC[k] = d.sourceString || ''; try { LS.set('dc-csrc', CSRC); } catch {} return CSRC[k]; }).catch(() => '');
}
function goalsHTML() {
  const W = u(), G = goals();
  const open = !openSecs.has('goals-x'), head = (n, note) => `<div class="sec-head" data-coll="goals-x" role="button" tabindex="0" aria-expanded="${open}"><div class="sec-title"><div class="sec-name"><h2>${esc(W.glT)}</h2></div>${n != null ? `<span class="count">${n}</span>` : ''}<span class="chev" aria-hidden="true"></span></div><p>${esc(note)}</p></div>`;
  if (!G.length) return `<section data-sec="goals" class="keep coll${open ? '' : ' collapsed'}">${head(null, W.glNone)}</section>`;
  // carrega o que falta para conferir (encaixes, coleção, peças de conjunto) e redesenha uma vez
  if (!goalLoading) {
    const need = G.flatMap(g => g.items.filter(i => i.k === 'item' && COLL[i.h] === undefined).map(i => i.h)), sets = [...new Set(G.flatMap(g => g.items.filter(i => i.k === 'set' && !SETITEMS[i.h]).map(i => i.h)))];
    const srcs = G.flatMap(g => g.items.filter(i => i.k === 'item' && COLL[i.h] && CSRC[COLL[i.h] + ':' + lang] == null).map(i => i.h));
    if (!PLUGS || need.length || sets.length || srcs.length) { goalLoading = true; Promise.all([loadPlugs(), ...need.map(h => idef(h).then(x => { COLL[h] = x.c; return collSrc(h); })), ...sets.map(setItems), ...srcs.map(collSrc)]).finally(() => { goalLoading = false; if (tab === 'obj') render(); }); }
  }
  const D = STATD?.d || {}; loadStats();
  const myCh = Object.values(profile.characters?.data || {});
  const card = (g, gi) => {
    const owned = {}; for (const it of g.items) if (it.k === 'set' && SETITEMS[it.h]) owned[it.h] = ownedSetSlots(SETITEMS[it.h], g.cls);
    const st = g.items.map(it => goalState(it, owned)), done = st.filter(x => x === true).length;
    const groups = ['asp', 'fr', 'ab', 'w', 'a'].map(k => [k, g.items.map((it, i) => [it, st[i]]).filter(([it]) => it.g === k)]).filter(([, l]) => l.length);
    const mine = myCh.find(c => c.classType === g.cls)?.stats;
    const ref = g.st ? `<div class="gl-ref"><small>${esc(W.glRef)}</small><div>${STAT_ORDER.map(h => `<span title="${esc(D[h]?.n || '')}">${D[h]?.ic ? `<img src="${BNET}${D[h].ic}" alt="">` : ''}<b>${g.st[h]}</b>${mine ? `<i>${esc(W.glYou)} ${mine[h] || 0}</i>` : ''}</span>`).join('')}</div></div>` : '';
    const [a1] = ELEMENT_ACC[g.el] || ELEMENT_ACC.arc;
    const shut = GLC.has(g.id);
    return `<div class="gl-c${shut ? ' shut' : ''}" style="--a1:${a1}"><div class="gl-h" data-glt="${esc(g.id)}" role="button" tabindex="0" aria-expanded="${!shut}"><span class="gl-dot"></span><span class="gl-t"><b>${esc(g.title)}</b><small>${esc(W.glAt(new Date(g.at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit' })))}</small></span><span class="gl-n">${done}/${g.items.length}</span><span class="gl-acts">${g.sel || g.sig ? `<button type="button" data-glv="${gi}">${esc(W.glView)}</button>` : ''}<button type="button" data-gld="${gi}">${esc(W.glDel)}</button></span><span class="chev" aria-hidden="true"></span></div>
      <div class="gl-bar"><u style="width:${g.items.length ? done / g.items.length * 100 : 0}%"></u></div>
      <div class="gl-body">${ref}
      ${groups.map(([k, l]) => `<div class="gl-g"><small>${esc(W.glG[k])}</small>${l.map(([it, ok]) => `<div class="gl-it${ok ? ' ok' : ''}${ok == null ? ' unk' : ''}"><i></i>${it.ic ? `<img src="${BNET}${it.ic}" alt="" loading="lazy">` : '<span class="gl-noic"></span>'}<span><b>${esc(it.k === 'set' ? W.glSet(it.n || '?', it.need) : it.n || '')}</b><small>${esc(it.k === 'plug' ? W.glSrcPlug : it.k === 'set' ? `${owned[it.h] ?? '…'}/${it.need} · ${W.glSetSrc}` : (CSRC[COLL[it.h] + ':' + lang] || ''))}</small></span></div>`).join('')}</div>`).join('')}</div></div>`;
  };
  const tot = G.reduce((a, g) => a + g.items.length, 0);
  return `<section data-sec="goals" class="keep coll${open ? '' : ' collapsed'}">${head(G.length, W.glNote)}<div class="gl-l">${G.map(card).join('')}</div></section>`;
}
document.addEventListener('click', e => {
  const add = e.target.closest('.gl-add'); if (add && !add.disabled) { const C = fdCtx(), mine = cmpMine(); if (!mine) return; const g = goalFromCmp(mine, C); g.sig = buildSig(C); const l = goals().filter(x => x.id !== g.id); l.unshift(g); LS.set('dc-goals', l.slice(0, 12)); try { const sn = LS.get('dc-goalsnap', {}); sn[g.id] = snapBuild(C, ''); for (const id of Object.keys(sn)) if (!l.slice(0, 12).some(x => x.id === id)) delete sn[id]; LS.set('dc-goalsnap', sn); } catch {} add.disabled = true; add.textContent = u().glDone; if (tab === 'obj') render(); return; }
  const glt = e.target.closest('[data-glt]'); if (glt && !e.target.closest('button')) { const id = glt.dataset.glt, c = glt.closest('.gl-c'), shut = c.classList.toggle('shut'); shut ? GLC.add(id) : GLC.delete(id); glt.setAttribute('aria-expanded', !shut); LS.set('dc-glc', [...GLC]); return; }
  const del = e.target.closest('[data-gld]'); if (del) { if (!del.classList.contains('ask')) { del.classList.add('ask'); del.textContent = u().outQ; setTimeout(() => { if (del.isConnected) { del.classList.remove('ask'); del.textContent = u().glDel; } }, 3000); return; } const l = goals(); l.splice(+del.dataset.gld, 1); LS.set('dc-goals', l); render(); return; }
  const v = e.target.closest('[data-glv]'); if (v) { const g = goals()[+v.dataset.glv]; const sn = g && (LS.get('dc-goalsnap', {})[g.id] || (g.sig && savedList().find(x => x.k.endsWith('|' + g.sig)))); if (sn) { FD.q = ''; FD.results = null; openSnap(sn, g.title); return; } if (g?.sel) { FD.q = ''; FD.results = null; openFind(); showPlayer(g.sel); } }
});
// acesso único do dia (para o painel de status): um sinal por dia por navegador; logado, conta como a conta (vários aparelhos = 1)
function sendHit() {
  try {
    if (!APIW || Date.now() < srvDown) return;
    if (auth && !member?.id && (sendHit.n = (sendHit.n || 0) + 1) < 12) { setTimeout(sendHit, 5000); return; } // logado: espera a conta carregar
    const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), k = member?.id ? 'm' : 'a', last = LS.get('dc-hit', '');
    if (last === day + k || (k === 'a' && last.startsWith(day))) return;
    let vid = LS.get('dc-vid', ''); if (!vid) { vid = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^\w-]/g, ''); LS.set('dc-vid', vid); }
    fetch(APIW + '/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: k === 'm' ? 'm:' + member.id : 'a:' + vid }), keepalive: true }).then(r => { if (r.ok) LS.set('dc-hit', day + k); }).catch(() => {});
  } catch {}
}
async function start() {
  try {
    status(u().loading);
    if (BETA) betaGate();
    await loadAccount();
    liveStart();
  } catch (e) {
    if (e.message === 'moving') return;
    if (e.message === 'auth') { status(''); render(); return; }
    status('');
    showMessage(`<p class="notice">${esc(e.message === 'maintenance' ? u().maintenance : u().apiError(e.message))}</p>`);
  }
}
// instala como app (ícone na tela inicial, abre sem a barra do navegador e funciona sem internet)
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
(async function init() {
  if (LEAVING) return;
  if (LS.get('dc-hide2', false)) { $('hide').checked = true; document.body.classList.add('hide-done'); }
  applyUI();
  const h = readHash();
  try {
    [cfg, defs, ITEMS, APIW] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/data/defs.json', { cache: 'no-cache' }).then(r => r.json()), fetch('/data/items.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({})), fetch('/data/api.json', { cache: 'no-cache' }).then(r => r.json()).then(j => j.api || null).catch(() => null)]);
  } catch { cfg = { configured: false }; showMessage(`<p class="notice">${esc(u().notConfigured)}</p>`); return; }
  if (h?.error) { render(); $('list').insertAdjacentHTML('afterbegin', `<p class="notice">${esc(u().authError(h.error))}</p>`); return; }
  if (h?.auth) { auth = h.auth; LS.set('dc-auth', auth); }
  // versão do acesso: quando o site passa a pedir uma permissão nova da Bungie, quem entrou antes precisa entrar de novo (uma vez)
  const AUTH_V = 2; // 2: mover e equipar itens (nov/2026)
  let relog = false;
  if (h?.auth) LS.set('dc-authv', AUTH_V);
  else if (auth && LS.get('dc-authv', 1) < AUTH_V) { relog = true; LS.set('dc-authv', AUTH_V); logout(); }
  else if (!auth) LS.set('dc-authv', AUTH_V);
  if (relog) setTimeout(() => $('list').insertAdjacentHTML('afterbegin', `<p class="notice">${esc(u().relogNote)}</p>`), 0);
  if (location.host === OLD_HOST && !auth) bungie('/GlobalAlerts/', false).catch(() => {});
  setTimeout(sendHit, 5000);
  // dono do site: aviso de sugestões novas (envelope com o número, leva ao painel); a conta é conferida uma vez por dia nos outros navegadores
  setTimeout(ownerSug, 3000);
  // botão Novidades no topo: ponto aceso quando há uma semana nova que você ainda não viu
  setTimeout(() => fetch('/data/changelog.json', { cache: 'no-cache' }).then(r => r.json()).then(l => { const id = l[0]?.id; if (id && LS.get('dc-cl-seen', '') !== id) document.documentElement.classList.add('cl-new'); }).catch(() => {}), 2500);
  { const nb = $('newsbtn'); nb.setAttribute('aria-label', u().newsLink); nb.title = u().newsLink; }
  if (/^\/b\//.test(location.pathname)) setTimeout(openPub, auth ? 1200 : 300);
  if (/^\/g\/.+/.test(location.pathname)) setTimeout(() => openProfile(slugName(location.pathname.slice(3).replace(/\/$/, ''))), auth ? 900 : 200);
  const pub = new URLSearchParams(location.search).get('jogador') || new URLSearchParams(location.search).get('player');
  if (auth) { render(); if (pub) openPublic(pub); await start(); if ($('finddlg').open) renderFind(); } else { render(); if (pub) openPublic(pub); }
})();
async function openPublic(name) {
  FD.q = name; FD.results = null; openFind();
  history.replaceState(null, '', location.pathname + location.hash); // o endereço volta a ser o do site; quem abriu continua vendo a build
  try { const r = await searchPlayers(name); if (r.length === 1) showPlayer(r[0]); else { FD.results = r; renderFind(); } } catch { FD.status = 'error'; renderFind(); }
}
/* ---------- Barra compacta: quando o cabeçalho sai da tela, aparece uma barra fina no topo com os botões de utilidade ---------- */
(function miniBar() {
  const gh = $('gh'); if (!gh) return;
  const bar = document.createElement('div'); bar.className = 'ghm'; bar.id = 'ghm'; bar.setAttribute('aria-hidden', 'true'); document.body.append(bar);
  const ico = (d) => `<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
  const fill = () => {
    const logged = !$('menubtn').hidden, U = u();
    const pw = $('pwv')?.textContent || '', nm = $('title').dataset.short || $('title').textContent || 'DPI';
    const em = getComputedStyle($('ghband')).backgroundImage;
    const grp = GROUPS.map(g => `<button type="button" class="ghm-t" data-ghtab="${g.id}" aria-current="${groupOf(tab)?.id === g.id}">${esc(U.tabs[g.id])}</button>`).join('');
    bar.innerHTML = `${logged ? `<button type="button" class="ghm-b" data-ghp="menubtn" aria-label="Menu">${ico('<path d="M3 5h14M3 10h14M3 15h14"/>')}</button>` : ''}
      <button type="button" class="ghm-id" data-ghtop aria-label="Topo"><span class="ghm-em"${em && em !== 'none' ? ` style="background-image:${em.replace(/"/g, "'")}"` : ''}></span><span class="ghm-n">${esc(nm)}</span>${pw ? `<b class="ghm-pw">✦ ${esc(pw)}</b>` : ''}</button>
      ${logged ? `<nav class="ghm-tabs">${grp}</nav>` : ''}<span class="ghm-sp"></span>
      ${logged && !$('ldbtn').hidden ? `<button type="button" class="ghm-b ghm-ld${tab === 'ld' ? ' on' : ''}" data-ghp="ldbtn">${esc($('ldbtn').textContent)}</button>` : ''}
      <button type="button" class="ghm-b" data-ghp="searchbtn" aria-label="${esc(U.search)}">${ico('<circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/>')}</button>
      <button type="button" class="ghm-b" data-ghp="themebtn" aria-label="Tema">${$('themebtn').innerHTML}</button>
      <button type="button" class="ghm-b ghm-lang" data-ghp="langbtn">${$('langbtn').innerHTML}</button>
      <button type="button" class="ghm-b" data-ghtop aria-label="Topo">${ico('<path d="M10 16V4M5 9l5-5 5 5"/>')}</button>`;
  };
  let on = false;
  let raf = 0;
  const check = () => { raf = 0; const n = gh.getBoundingClientRect().bottom < 0; if (n === on) return; on = n; if (on) fill(); bar.classList.toggle('on', on); bar.setAttribute('aria-hidden', String(!on)); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(check); }, { passive: true }); addEventListener('resize', check); check();
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ghtop !== undefined) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (b.dataset.ghtab) { document.querySelector(`#tabs [data-group="${b.dataset.ghtab}"]`)?.click(); scrollTo({ top: 0 }); return; }
    const t = $(b.dataset.ghp); if (!t) return;
    if (b.dataset.ghp === 'searchbtn') { scrollTo({ top: 0 }); if ($('q').hidden) t.click(); else $('q').focus(); return; }
    if (b.dataset.ghp === 'ldbtn') scrollTo({ top: 0 });
    t.click(); setTimeout(() => { if (on) fill(); }, 50);
  });
  const mo = new MutationObserver(() => { if (on) fill(); }); mo.observe($('title'), { childList: true, characterData: true, subtree: true });
})();

})();
