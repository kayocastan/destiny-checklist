# Desempenho no celular (4G): medição e plano de separação do app.js

Medido em 07/11/2026 no site publicado.

## O que o site baixa

| Arquivo | Tamanho | Compactado (gzip) | Quando |
|---|---|---|---|
| `app.js` | 712 KB | ~230 KB | toda primeira visita; depois só confere se mudou (304) |
| `data/defs.json` | 309 KB | ~70 KB | idem |
| `site.css` | 203 KB | ~35 KB | idem |
| `data/items.json` | 134 KB | ~30 KB | idem |

Numa visita repetida, quase nada é baixado de novo: o service worker e o cache do navegador respondem, e a página fica pronta em ~0,9 s.

**O que mais pesa numa visita nova não é o código.** São as definições de objetivos lidas uma a uma na Bungie depois de cada atualização do jogo (219 pedidos na primeira visita desta semana). Elas ficam guardadas no aparelho, e nas visitas seguintes são 0 pedidos.

## Quanto a separação economizaria

| Parte | Tamanho | Compactado |
|---|---|---|
| Administração + Discord do clã | 76 KB | ~26 KB |
| /grade (Orla Bot) | 40 KB | ~13 KB |
| Montador de loadout + Limpeza do cofre + ações na conta (beta) | 127 KB | ~39 KB |

Tirar Administração e /grade do carregamento inicial economiza ~26 KB compactados, cerca de 0,15 s num 4G bom, só na primeira visita.

## Por que não foi separado agora

O `app.js` é um bloco único em que todas as partes usam as mesmas variáveis internas (`esc`, `LS`, `render`, `GD`, `profile`…). Para carregar uma parte depois, existem dois caminhos:

1. **Expor um objeto de contexto** e reescrever as partes separadas para usá-lo. É um refactor grande e com risco de quebrar telas.
2. **Truques com `eval`/`with`.** Fazem o navegador desligar otimizações do arquivo inteiro e deixariam tudo mais lento.

Pelo ganho de ~0,15 s, o risco não compensa agora.

## Plano em etapas (quando valer a pena)

1. **Módulos ES com núcleo comum**
   - Criar `core.js` com estado, utilitários, autenticação e `render`, exportados.
   - As abas viram módulos (`admin.js`, `grade.js`, `loadout.js`) carregados com `import()` quando a aba abre.
   - Sem etapa de build: os navegadores atuais carregam módulos direto.
2. **Começar pelas partes menos ligadas**
   - Primeiro /grade e Discord do clã, que só conversam com o Orla Bot.
   - Depois Administração.
   - Por último o montador de loadout.
3. **Medir antes e depois** com o mesmo roteiro (primeira visita, 4G simulado, celular médio).

## O que já ajuda hoje

- Service worker com o app guardado: uma visita repetida não baixa o código de novo.
- Vercel entrega tudo compactado.
- Imagens só carregam quando aparecem (`loading="lazy"`) ou ao abrir a galeria.
- Definições da Bungie lidas em lote pelo servidor (`/defs`) e guardadas no aparelho.
