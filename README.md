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
   - **Application Name**: Destiny Checklist (ou outro nome)
   - **Website**: o endereço do site na Vercel (ex.: `https://destiny-checklist.vercel.app`)
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
