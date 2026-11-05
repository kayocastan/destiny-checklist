# AGENTS.md — Destiny 2 Clan Discord Bot

Estas instruções orientam o ChatGPT/Codex ao desenvolver este bot. Aplique-as junto às instruções mais específicas de cada diretório, quando existirem. Não presuma que arquivos, serviços ou decisões não descritos aqui já existam no repositório: inspecione o projeto antes de alterar sua estrutura.

## Objetivo do projeto

Construir e operar um bot de Discord para um clã de Destiny 2. O bot deve ajudar a organizar atividades, inscrições e vagas, consultar dados de jogadores na Bungie quando necessário e oferecer uma experiência clara para membros e administradores. Priorize uma implementação prática, confiável e fácil de manter por uma equipe pequena.

## Stack escolhida

- Python, com tipagem estática e suporte assíncrono.
- `discord.py` para comandos, eventos e interações do Discord.
- SQLite como banco de dados persistente em arquivo.
- SQLAlchemy 2.x no estilo moderno, com API assíncrona para operações no caminho assíncrono.
- Alembic para migrações de esquema.
- `aiohttp` para chamadas HTTP assíncronas à API da Bungie.
- `pytest` e `pytest-asyncio` (ou configuração equivalente compatível com as versões adotadas) para testes.
- Docker Compose para executar localmente o bot, as migrações, a carga inicial e o arquivo SQLite em volume persistente.
- Oracle Cloud Free Tier como alvo inicial de hospedagem. Confirme disponibilidade, limites e custos atuais na conta antes de depender de qualquer recurso específico.

Use versões estáveis e compatíveis, fixadas no arquivo de dependências e, quando aplicável, na imagem de contêiner. Não introduza uma segunda biblioteca ou serviço para uma função que a stack já atende sem explicar o benefício.

## Arquitetura e limites entre componentes

Mantenha responsabilidades separadas, sem criar camadas cerimoniais:

1. **Interface Discord**: comandos, views, botões, modais e formatação de respostas. Deve validar a entrada, chamar os serviços e apresentar resultados; não deve conter regras de negócio extensas nem SQL ad hoc.
2. **Serviços de aplicação/domínio**: regras de atividades, inscrições, elegibilidade, limites de vagas e autorização administrativa. Devem ser testáveis sem conexão real com Discord ou Bungie sempre que possível.
3. **Persistência**: modelos SQLAlchemy, sessões, consultas e repositórios quando estes realmente simplificarem o código. Delimite transações nas operações que precisam ser atômicas.
4. **Integração Bungie**: cliente `aiohttp` isolado, responsável por autenticação, timeouts, tratamento de respostas, limites e conversão dos dados externos para estruturas internas tipadas.
5. **Configuração e inicialização**: carregue configurações num ponto claro, valide-as no início e injete dependências necessárias. Evite estado global mutável.

Prefira módulos organizados por domínio ou funcionalidade, como atividades, membros e integração Bungie. Mantenha o ponto de entrada pequeno. Não adicione filas, cache distribuído, microsserviços ou abstrações genéricas até haver requisito concreto.

## Regras de inscrição e elegibilidade

- Cada atividade deve poder definir capacidade total e vagas reservadas para iniciantes. A regra deve ser configurável por atividade e persistida no banco; não fixe um limite universal no código.
- O administrador deve definir explicitamente qual atividade/histórico conta e o limite de clears que classifica alguém como iniciante. Por padrão, a pessoa é iniciante quando tem de **0 até o limite inclusivo** de clears; acima do limite, é veterana. Deixe o limite visível na configuração e na resposta do bot.
- Vagas reservadas para iniciantes fazem parte da capacidade total. Vagas não reservadas formam a capacidade restante. Valide que a soma não excede a capacidade e defina claramente o comportamento de vagas ociosas (por exemplo, se e quando podem ser liberadas), sem liberar automaticamente por uma regra implícita.
- Um iniciante só pode ocupar uma vaga reservada para iniciante; se todas estiverem preenchidas, informe que essa categoria está lotada, mesmo que haja vagas gerais disponíveis, salvo se a política de vagas ociosas configurada permitir o contrário.
- Veteranos só podem ocupar vagas gerais. Não os conte como iniciantes para preencher a reserva.
- Evite inscrições duplicadas e condições de corrida: a checagem de elegibilidade, capacidade e gravação devem ocorrer de forma transacional/atômica, com restrições de banco quando apropriado. Dois cliques simultâneos não podem exceder a capacidade.
- Guarde na inscrição os dados necessários para explicar a decisão (categoria atribuída e, se útil, contagem e instante da verificação), sem tratar uma contagem antiga como verdade permanente. Defina se revalidação ocorre no ingresso, na atualização da inscrição ou por ação administrativa; não mude inscrições existentes silenciosamente.
- Se a Bungie estiver indisponível ou não houver dados suficientes, não invente contagens nem classifique por suposição. Informe a falha e não confirme a inscrição que dependa da verificação. Ofereça uma via administrativa explícita, auditável e autorizada se o produto precisar de exceção manual.
- Teste limites inclusivos, zero clears, um acima do limite, reservas lotadas, vagas gerais, capacidade total, jogadores sem identidade vinculada, atividade encerrada e tentativas concorrentes.

## Bungie API, documentação e segurança

- Antes de implementar ou alterar uma chamada, consulte a documentação oficial atual da Bungie para endpoint, escopos, autenticação, parâmetros, paginação, semântica e limites. Não deduza comportamento de nomes de campos, exemplos antigos, bibliotecas de terceiros ou respostas observadas uma única vez.
- Se um detalhe necessário não estiver documentado ou houver ambiguidade, pare essa decisão, explique a incerteza e proponha como verificá-la. Não afirme que a API fornece um histórico ou métrica específicos sem comprovação documental.
- Cumpra limites e políticas de uso da Bungie. Trate `429` e cabeçalhos de limite conforme documentação; aplique backoff limitado quando apropriado. Configure timeouts de conexão/leitura e feche corretamente sessões `aiohttp`.
- Nunca registre API keys, tokens de acesso/renovação, cabeçalhos de autorização ou segredos. Redija esses valores de logs e mensagens de erro.
- Armazene credenciais apenas em variáveis de ambiente/secrets do ambiente de execução. Use o mínimo de permissões OAuth necessário. Não peça nem armazene senha Bungie.
- Valide e normalize entradas e identificadores antes de montar URLs ou consultas. Use parâmetros SQLAlchemy, não concatenação de SQL. Trate respostas externas como dados não confiáveis e valide o formato antes de usá-las.
- Não solicite dados privados que não sejam necessários ao recurso. Defina retenção e remoção de vínculos de conta de forma explícita.

## Padrões de código

- Use `async`/`await` de ponta a ponta nas operações de rede e banco chamadas por handlers assíncronos. Não bloqueie o event loop com I/O síncrono ou trabalho pesado.
- Tipar funções, parâmetros, retornos, configurações e modelos de dados relevantes. Prefira tipos explícitos e estruturas pequenas a `Any`; isole e justifique exceções de tipagem.
- Use nomes claros, funções coesas e tratamento explícito de erros. Não use `except Exception` para ocultar falhas; capture exceções esperadas e preserve contexto.
- Mantenha mudanças pequenas e focadas. Evite refatorações não relacionadas, duplicação de regra de negócio e abstrações prematuras.
- Use `Decimal` ou inteiros para quantidades que exijam exatidão; armazene datas e horas com timezone, usando UTC internamente e apresentando horários conforme configuração do servidor/usuário.
- Não inclua segredos, dados pessoais ou conteúdo de interação em logs sem necessidade. Evite mensagens de erro internas diretamente visíveis a usuários.

## Discord e experiência de uso

- Respeite permissões e escopos do Discord; valide autorização no servidor para toda ação administrativa, não apenas escondendo botões.
- Responda interações dentro do prazo do Discord usando deferimento quando necessário. Trate interações repetidas, mensagens apagadas e permissões ausentes sem encerrar o processo.
- Use mensagens claras e efêmeras quando o resultado for privado ou operacional. Mostre capacidade, vagas restantes, categoria e regra aplicada ao confirmar ou negar inscrição.
- Atualize mensagens de atividade de forma segura após mudanças. Considere limites de tamanho, componentes expirados e reinicialização do bot; persista no banco o estado necessário para reconstruir a interface.
- Não faça `sync` destrutivo de comandos globais em cada inicialização sem decisão explícita; use fluxo apropriado para desenvolvimento e produção.

## Banco de dados e migrações

- Use SQLAlchemy 2.x com sessões curtas, transações explícitas e descarte/fechamento previsível. Para SQLite, habilite chaves estrangeiras e serialize transações de escrita concorrentes.
- Toda mudança de esquema deve vir com migração Alembic revisada. Não dependa de `create_all()` em produção para evoluir o esquema.
- Migrações devem ser pequenas, reversíveis quando viável e seguras para dados existentes. Examine o SQL/autogenerate antes de aceitar uma revisão.
- Use chaves estrangeiras, índices e constraints para invariantes importantes. Considere unicidade por atividade e usuário para impedir inscrição duplicada.
- Nunca execute migrações automaticamente em paralelo por múltiplas réplicas. Defina um passo único de migração no processo de implantação.

## Configuração, segredos e ambiente

- Forneça `.env.example` apenas com nomes de variáveis e valores fictícios; mantenha `.env` fora do Git. Confirme `.gitignore` antes de adicionar arquivos com credenciais.
- Valide variáveis obrigatórias no início e falhe com uma mensagem segura que identifique a configuração ausente sem revelar valores.
- Separe configurações de desenvolvimento e produção. Não use credenciais de produção em testes ou ambiente local.
- Configure, no mínimo, token do Discord, credencial/API key Bungie conforme necessária, URL/caminho do SQLite, nível de log e parâmetros operacionais relevantes.
- No Docker Compose, guarde o arquivo SQLite em volume nomeado persistente e use política de reinício apropriada. Não inclua o banco ativo em imagens ou atualizações que possam sobrescrevê-lo.

## Testes e qualidade

- Escreva testes unitários para regras de domínio e testes de integração para persistência e limites transacionais relevantes. Use mocks/fakes para Discord e Bungie; testes comuns não devem depender de serviços externos, tokens reais ou internet.
- Cubra erros HTTP, dados inválidos, timeouts, rate limits e ausência de credenciais nos testes da integração Bungie.
- Teste migrações em um banco descartável quando a alteração de esquema afetar comportamento ou dados.
- Antes de concluir uma mudança, execute os testes e verificações disponíveis e relate exatamente o que foi executado e o que não foi. Não declare sucesso de testes que não foram executados.
- Não altere ou remova testes para fazer uma implementação inadequada parecer correta; atualize expectativas apenas quando o requisito mudou e explique por quê.

## Logs e observabilidade

- Use logging estruturado ou consistente, com níveis adequados e contexto útil (comando, operação, identificador não sensível e duração).
- Registre falhas de integração, transações e tarefas de fundo com contexto e stack trace no nível apropriado, sem expor segredos.
- Evite log por evento de alta frequência sem necessidade. Métricas e alertas externos são opcionais até existir necessidade operacional concreta.
- Diferencie indisponibilidade externa, erro de validação e erro interno para diagnóstico e resposta ao usuário.

## Docker, implantação e recuperação

- Mantenha uma forma documentada de iniciar localmente com Docker Compose e de aplicar migrações. Use imagem enxuta, usuário sem privilégios quando viável e build reproduzível.
- Para Oracle Cloud Free Tier, documente os recursos realmente selecionados e confirme os limites vigentes antes da implantação. Restrinja portas de entrada ao necessário e proteja SSH/Discord/Bungie secrets.
- Planeje atualização com backup antes de migrações arriscadas, healthcheck após implantação e procedimento de rollback compatível com a migração. Não prometa disponibilidade sem monitoramento.
- Configure backups periódicos do arquivo SQLite para armazenamento fora do volume/instância principal, proteja-os e defina retenção. Documente e teste a restauração; backup não validado não é estratégia de recuperação.
- Não execute ações irreversíveis em produção, apague dados ou altere recursos da nuvem sem instrução explícita do usuário.

## Colaboração com ChatGPT/Codex

- Inspecione primeiro os arquivos e convenções realmente presentes. Não invente estrutura, dependências, endpoints, comportamento da Bungie ou decisões já tomadas.
- Para mudanças significativas de arquitetura, esquema, segurança, integração externa ou experiência de uso, explique brevemente a proposta, as opções relevantes e os efeitos sobre dados/usuários antes de escrever o código. Aguarde alinhamento quando a escolha mudar requisitos ou tiver impacto difícil de reverter.
- Para tarefas pequenas e claramente especificadas, implemente diretamente, mantendo a alteração focada e explicando o resultado.
- Faça código tipado, incremental e fácil de revisar. Preserve trabalho existente e não sobrescreva mudanças do usuário.
- Ao encontrar requisito ambíguo, busque evidências no código e na documentação oficial; pergunte apenas quando a decisão não puder ser resolvida com segurança pelo contexto disponível.
- Ao finalizar, resuma arquivos e comportamento alterados, decisões importantes, verificações executadas e limitações conhecidas. Cite caminhos reais do repositório.


# Referências

- Bungie API: https://bungie-net.github.io/
- Discord API: https://docs.discord.com/developers/reference
