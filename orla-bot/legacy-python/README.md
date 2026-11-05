# Orla Bot

Bot de Discord para organização de atividades de um clã de Destiny 2.

## Estrutura

- `src/orla_bot/`: aplicação, organizada por funcionalidade.
- `alembic/`: migrações do SQLite.
- `tests/`: testes automatizados.
- `compose.yaml`: migração, carga inicial e bot com banco SQLite persistente.

## Desenvolvimento local com Docker

1. Copie `.env.example` para `.env` e `.env.secrets.example` para `.env.secrets`.
2. Preencha `.env.secrets` com o token do Discord e a chave Bungie, se já estiver usando a integração. Configure `DISCORD_GUILD_ID` em `.env` com o ID do servidor onde o comando será publicado.
3. Inicie os serviços com `docker compose up --build --force-recreate --remove-orphans -d`. Isso remove containers antigos que não fazem mais parte do Compose.
4. O Compose cria `./data/orla.sqlite3` na pasta do projeto, aplica as migrações, carrega os dados essenciais de `scripts/essential-data.sql` e só então inicia o bot.

Use `--build` para reconstruir a imagem quando as dependências ou os arquivos do bot mudarem. `--force-recreate` recria os serviços de migração e carga inicial para executá-los novamente. A carga inicial é idempotente. `docker compose down --remove-orphans` preserva `./data/orla.sqlite3`; apagar essa pasta remove o banco local. Dados que estejam somente no banco anterior não são copiados para o SQLite.

## Integração Bungie

Depois de configurar `BUNGIE_API_KEY` em `.env.secrets`, atualize o catálogo de definições de atividades com:

```sh
docker compose run --rm bot python -m orla_bot.bungie.sync_activities
```

O comando baixa as definições do manifesto inglês da Bungie e grava em `bungie_activities` somente atividades classificadas como Raid ou Dungeon. Essa tabela é o catálogo bruto de definições da Bungie: cada hash fica em uma linha, e `eligibility_group` é a única chave de agrupamento, usada na classificação de habilidade. Exceções explícitas podem somar variantes; o relatório continua distinguindo-as pelo nome da definição Bungie. A importação atualiza ou insere essas definições; ela não apaga linhas antigas.

As opções que aparecem para os usuários ficam em `curated_bungie_activities`, separadas do catálogo bruto. O serviço `seed` carrega `scripts/essential-data.sql` após a migração e antes da inicialização do bot. Esse arquivo inclui as opções curadas e definições Bungie de referência; sua execução é idempotente. O `eligibility_group` da opção curada define as definições brutas cujos clears serão somados para classificá-la. O catálogo bruto também pode ser atualizado pelo comando acima.

Não há outros dados estáticos necessários para a inicialização. Usuários vinculados, progresso, atividades criadas e inscrições são dados operacionais e surgem conforme o bot é usado; não devem ser inseridos no script de dados essenciais.

Ao criar a grade ou entrar como titular (`+`) ou reserva (`?`) numa grade do catálogo, o bot tenta atualizar os clears Bungie quando há vínculo e integração configurados. Títulos livres e registros com `eligibility_group = 'orla:0'` não consultam clears. A consulta usa `GetLinkedProfiles` para descobrir os perfis Destiny vinculados ao Bungie Name e `GetDestinyAggregateActivityStats` para cada personagem de cada perfil, independentemente do tipo de membro/plataforma. Os resultados somam `activityCompletions` por `activityHash`. O relatório mantém cada variante separada pelo nome Bungie; a classificação soma os hashes associados ao `eligibility_group` curado. Por exemplo, Last Wish Level 55, Level 58 e Normal contam juntos para habilidade, enquanto Master permanece separado. `rookie` corresponde a 0–4 clears, `veteran` a 5–10 e `master` acima de 10. Os dados são guardados em `player_activities` com o instante da última consulta.

Para consultar esse histórico, o bot usa apenas a chave pública da API (não usa OAuth nem pede senha). Se uma atividade do catálogo exigir classificação e não for possível verificar alguém numa grade com limite de novatos, a pessoa entra na fila de substitutos. Títulos livres ou atividades sem consulta de histórico ignoram o limite de novatos e seguem a fila normal de titulares até a capacidade, depois substitutos. Sem limite configurado, a inscrição segue e o bot avisa que o histórico não foi atualizado.

## Deploy na Discloud com SQLite

O bot usa SQLite tanto localmente quanto na Discloud. Na Discloud, o banco fica em `data/orla.sqlite3`; mantenha cópias de segurança desse arquivo.

1. No ambiente global ou nas variáveis da aplicação, configure `DISCORD_TOKEN`, `DISCORD_GUILD_ID`, `BUNGIE_API_KEY` (opcional), `LOG_LEVEL=INFO` e `TIMEZONE=America/Sao_Paulo`. O empacotador inclui um `.env` com `DATABASE_URL=sqlite+aiosqlite:///./data/orla.sqlite3`; o código carrega esse arquivo sem sobrescrever variáveis já fornecidas pelo ambiente.
2. Prepare o arquivo inicial do banco localmente antes do primeiro deploy. Em PowerShell, na raiz do projeto:

   ```powershell
   New-Item -ItemType Directory -Force data | Out-Null
   $env:PYTHONPATH = (Join-Path (Get-Location) "src")
   $env:DATABASE_URL = "sqlite+aiosqlite:///./data/orla.sqlite3"
   .\.venv\Scripts\python.exe -m alembic upgrade head
   .\.venv\Scripts\python.exe -m orla_bot.persistence.seed
   ```

3. Gere o ZIP inicial com `./scripts/package-discloud.ps1 -Mode Initial`. Ele cria `.build/orla-bot-inicial-<data-hora>.zip`, coloca `discloud.config` na raiz e inclui `main.py`, `requirements.txt`, `.env` (somente com a URL não secreta do SQLite), `src/`, `alembic/`, `alembic.ini`, `scripts/` e `data/orla.sqlite3`.
4. Envie o ZIP em **Aplicações → + Upload → Upload ZIP**. Confira os logs até o bot conectar e verifique `/orla grade` no servidor.
5. Guarde uma cópia de segurança do banco. Em atualizações futuras, gere o ZIP com `./scripts/package-discloud.ps1 -Mode Update`; ele cria `.build/orla-bot-atualizacao-<data-hora>.zip` com o mesmo `.env`, sem o banco de dados. Para novas migrações, aplique `alembic upgrade head` uma vez apontando para o banco persistente antes de atualizar o código.

As inscrições usam transações SQLite com bloqueio de escrita para serializar alterações concorrentes. A data é armazenada como UTC mesmo com SQLite. O importador de catálogo Bungie e a carga essencial aceitam SQLite; a carga pode ser executada com `python -m orla_bot.persistence.seed`.

## Comando `/orla grade`

O comando é `/orla grade`, registrado apenas no servidor indicado por `DISCORD_GUILD_ID` e disponível para qualquer membro desse servidor. O campo `atividade` sugere os nomes de `curated_bungie_activities.name` no autocomplete e também aceita um título livre; clears só são consultados quando a pessoa escolhe uma sugestão do catálogo curado. Os demais campos podem ser enviados diretamente ou usados para pré-preencher o formulário. Novos comandos do bot podem ser adicionados como subcomandos de `/orla`. `Início` aceita `YYYY-mm-DD HH:MM`, `DD/mm/YYYY HH:MM` e `DD/mm/YY HH:MM`, interpretados no fuso `TIMEZONE` (padrão `America/Sao_Paulo`). Também aceita ISO 8601 com fuso explícito, como `2026-10-10T20:30-03:00`. O horário precisa ser futuro e é armazenado em UTC no SQLite persistente. Aplique a migração antes de iniciar o bot.

O parâmetro opcional `novatos` define quantos novatos podem ficar como titulares: vazio (`null`) não aplica um limite específico, `0` encaminha novatos à fila de substitutos e valores positivos vão de 1 até a capacidade escolhida. A classificação usa 0–4 clears como novato, conforme o histórico da atividade selecionada no catálogo. Títulos livres ou atividades sem consulta de histórico ignoram esse limite e seguem a fila normal de titulares até a capacidade; se não for possível verificar os clears de uma atividade identificada que exige classificação, a pessoa entra em substitutos. A fila de substitutos preenche qualquer titular que saia, sem filtrar a categoria do substituto.

A mensagem da grade e seus botões são removidos automaticamente uma hora após o horário de início. A limpeza roda aproximadamente a cada minuto e também é retomada quando o bot inicia; se o Discord estiver indisponível ou o bot não tiver permissão para apagar a mensagem, a remoção será tentada novamente. A grade também é removida do banco após a mensagem ser apagada.

## Comando `/orla registrar`

Use `/orla registrar` com seu Bungie Name completo no formato `Nome#1234` para vincular a conta Bungie ao membro Discord que executou o comando. O bot valida o nome na API da Bungie e salva o vínculo, usando o mesmo fluxo de vinculação solicitado ao criar uma grade sem identidade Bungie conectada. Se ainda não houver vínculo, ele será criado; se já houver, os dados Bungie vinculados serão atualizados, permitindo corrigir um nome informado incorretamente.
