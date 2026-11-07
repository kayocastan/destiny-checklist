# Proposta: tiers e bônus de conjunto de armadura no DPI

Análise da planilha "Armor Set Bonuses" (We Chosen Few, créditos LowCo + Azra; números do Destiny Data Compendium) e de como trazer esses dados para o site. Feita em 07/11/2026.

## O que a planilha tem

| Aba | Conteúdo | Tamanho |
|---|---|---|
| Armour Sets | 56 conjuntos com bônus de 2 e 4 peças: nome, descrição, **números detalhados**, **nota (S a E, PVP)**, origem e tipo de origem | ~45 KB em JSON |
| Backend Calculation | 12 arquétipos de armadura T5 (Gunner, Bulwark, Paragon…) com os dois atributos principais (30 e 25) | 1 KB |
| Exotics | 120 exóticos por classe e espaço, com a vantagem e um resumo | ~25 KB |
| Armour Planner | Calculadora de atributos: arquétipo + terciário + mod + ajuste T5 + obra-prima, somando 5 peças | lógica, não dados |

A conversão para JSON está em `docs/armor-sets.sample.json`. Ela é gerada por `docs/armor-sets-convert.py` a partir da exportação da planilha.

## O que a Bungie já dá (e não precisa vir da planilha)

- **Nome e descrição dos bônus de conjunto**: `DestinyEquipableItemSetDefinition`, com `setPerks` e quantas peças cada um exige, **em português**.
- **Arquétipo e atributos de cada peça** do jogador: vêm nos sockets/plugs da própria armadura.
- **Exóticos e suas vantagens**: o manifesto já tem, também traduzidos.

**Só existe na planilha:** os números detalhados (duração, % de resistência, recargas), a nota de cada bônus e a origem resumida ("Kepler · Destino", "Cripta · Incursão").

## Arquitetura recomendada

1. **Fonte de verdade em duas partes**
   - Manifesto da Bungie: nomes, descrições, hashes e arquétipos, em PT/EN. Já é baixado e guardado no aparelho.
   - Planilha: só os campos extras (números, nota, origem), ligados ao conjunto pelo hash do `DestinyEquipableItemSetDefinition`.
2. **Arquivo estático em vez de Cloudflare KV**
   - O dado é pequeno (~50 KB), só de leitura e muda poucas vezes por temporada.
   - Por isso fica como `data/armor-sets.json` no repositório, servido pela CDN da Vercel e guardado pelo service worker, igual ao `defs.json`.
   - O KV só valeria se fosse preciso editar sem publicar, e mesmo assim a página `/videos` mostra que o D1 resolve isso.
3. **Atualização automática**
   - Uma ação do GitHub semanal (ou manual) baixa a planilha como CSV pelo link público de exportação.
   - Ela converte com o script, casa cada conjunto com o hash do manifesto (pelo nome em inglês) e abre um PR se algo mudou.
   - Assim ninguém precisa mexer no JSON à mão.
4. **No site**
   - **Montagem de build:** mostra os bônus ativos (2 e 4 peças) com a descrição em PT, a nota e os números ao tocar, e avisa "falta 1 peça de X para o bônus de 4".
   - **Inventário:** selo do conjunto em cada armadura, e um filtro "conjunto: Seventh Seraph".
   - **Planejador de atributos:** recria a lógica da aba Armour Planner (arquétipo 30/25 + terciário + mod + T5 + obra-prima) com os dados das peças que a pessoa tem.

## Antes de publicar

- **Permissão de uso:** as notas e os números são trabalho dos autores (LowCo, Azra e Destiny Data Compendium). Vale pedir permissão e manter os créditos visíveis no site. Por isso o JSON ficou em `docs/` e ainda não está publicado.
- **As notas são subjetivas**, e alguns conjuntos novos não foram testados (aviso da própria planilha). No site, as notas devem aparecer como "opinião da comunidade".
