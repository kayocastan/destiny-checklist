# DPI · Destiny Parallel Interface

Site que lê a conta Bungie.net de quem entrar e monta um checklist de Destiny 2: missões em andamento, campanhas, incursões, masmorras, títulos, exóticos e catalisadores que faltam, do mais fácil para o mais difícil. Tem versão em português e inglês com os nomes oficiais do jogo.

- O site só **lê** os dados (API oficial da Bungie). Não altera nada no jogo.
- A senha fica na Bungie. O site recebe só uma autorização de leitura.
- As marcações manuais ficam no navegador de cada pessoa.

## Como funciona

| Parte | Onde |
|---|---|
| Página, estilos e lógica | `index.html`, `styles.css`, `site.css`, `app.js` |
| Login com a Bungie (troca do código pelo token) | `api/callback.js`, `api/refresh.js` |
| Chave pública da API para o navegador | `api/config.js` |
| Nomes de exóticos, catalisadores, títulos, incursões e masmorras (EN/PT) | `data/defs.json` |

## Configuração (uma vez)

### 1. Registrar o aplicativo na Bungie
1. Acesse https://www.bungie.net/en/Application e clique em **Create New App**.
2. Preencha:
   - **Application Name**: DPI (ou outro nome)
   - **Website**: o endereço do site na Vercel (ex.: `https://destinyparallel.vercel.app`)
   - **OAuth Client Type**: **Confidential**
   - **Redirect URL**: `https://SEU-ENDERECO.vercel.app/api/callback`
   - **Scope**: marque apenas **Read your Destiny 2 information (Vault, Inventory, and Vendors)...**
   - **Origin Header**: `https://SEU-ENDERECO.vercel.app`
3. Aceite os termos e crie. Anote **API Key**, **OAuth client_id** e **OAuth client_secret**.

### 2. Variáveis de ambiente na Vercel
No projeto da Vercel: **Settings > Environment Variables**, adicione:

| Nome | Valor |
|---|---|
| `BUNGIE_API_KEY` | API Key |
| `BUNGIE_CLIENT_ID` | OAuth client_id |
| `BUNGIE_CLIENT_SECRET` | OAuth client_secret |

Depois, em **Deployments**, clique em **Redeploy** para valer.

## Atualizar os nomes do jogo
`data/defs.json` é gerado a partir do manifesto oficial da Bungie. Quando sair conteúdo novo (exóticos, títulos), ele precisa ser regerado.

## Backlog (ideias aprovadas, ainda não feitas)

Detalhes em `docs/sugestoes.md`.

- **Lembretes do Orla Bot:** 30 minutos antes da grade, o bot marca os titulares na mensagem do #lfg-destiny (a tarefa por minuto do bot já existe; falta a coluna "lembrado" e o texto).
- **Grade recorrente:** modelos do tipo "toda sexta às 21h, Cripta" que o bot cria sozinho com alguns dias de antecedência; o criador pausa ou apaga pelo site.
- **Mensagem para quem não registrou o Discord:** aviso único para os membros do clã que ainda não ligaram o Discord à Bungie.
- **Bônus de conjunto e tiers de armadura:** proposta em `docs/armaduras.md`.
- **Separar o app.js em módulos:** medição e plano em `docs/desempenho.md`.

## Páginas e serviços extras

| Endereço | O que é |
|---|---|
| `/estado` | status público: site, servidor, Orla Bot e API da Bungie |
| `/grade` | grades do clã (Orla Bot), só membros da Orla |
| `/guias` | edição dos guias de cada atividade: vídeos, imagens e guia por encontro (só o dono do site; `/videos` redireciona para cá) |
| `/status` | uso do servidor (só o dono do site) |
