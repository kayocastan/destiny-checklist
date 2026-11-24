# Tutoriais do DPI (imagens 1080×1350)

Uma imagem por parte do site, para mandar no Discord ou no WhatsApp:

| Arquivo | Parte |
|---|---|
| 00-comecando.png | Entrar, navegar, avisos e preferências |
| 01-hoje.png | Hoje: Principal, Desafios, Calendário |
| 02-progresso.png | Progresso: atividades, títulos, colecionáveis |
| 03-arsenal.png | Arsenal: inventário, Avaliar rolls, coleção, vendedores, loadouts |
| 04-guardiao.png | Guardião: builds, relatórios, estatísticas |
| 05-cla.png | Clã: membros, placar, grupos, administração |
| 06-grade.png | Grade: criar e editar |

## Como refazer
`fonte/tut.json` tem os textos; `fonte/tut.py tut.json` gera um HTML por imagem e `fonte/grade-howto.html` é a da Grade.
Fontes: Rajdhani, IBM Plex Sans e IBM Plex Mono (troque os caminhos `@font-face` pelos da sua máquina).
Renderize cada HTML em 1080×1350 com deviceScaleFactor 2 (Playwright: screenshot do elemento `.c`).
Quando uma tela mudar, atualize o texto em `tut.json` e gere de novo.
