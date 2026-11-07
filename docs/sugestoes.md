# DPI · Sugestões para apresentar depois

Ideias aprovadas para discutir com o clã, mas ainda não implementadas. Atualizado em 05/11/2026.

## 1. Lembrete antes da atividade (Orla Bot)

- **O que é:** 30 minutos antes do início, o bot responde à mensagem da grade no #lfg-destiny marcando os titulares ("Começa em 30 min: Fim de Crota às 21h").
- **Por que:** diminui quem confirma e esquece; quem é substituto também fica sabendo se subiu.
- **Como:** a tarefa do bot que já roda a cada minuto confere as grades que começam em 30 min e ainda não foram lembradas (uma coluna `lembrado` na grade).
- **Custo:** praticamente zero; uma consulta pequena por minuto e uma mensagem por grade.
- **Decidir antes:** quanto tempo antes (15, 30 ou 60 min) e se substitutos também são marcados.

## 2. Grade recorrente

- **O que é:** "toda sexta às 21h, Cripta da Pedra Profunda". O bot cria a grade da semana sozinho, com o mesmo criador, vagas e descrição.
- **Por que:** grupos fixos não precisam remarcar toda semana.
- **Como:** tabela de modelos (atividade, dia da semana, hora, vagas, criador); a tarefa do bot cria a grade com X dias de antecedência. O criador pausa ou apaga o modelo pelo site.
- **Decidir antes:** com quantos dias de antecedência a grade aparece; o que fazer se ninguém entrar (apagar sozinha?).

## 3. Mensagem para quem ainda não registrou o Discord

- **O que é:** o bot manda uma mensagem privada única para quem está no clã e ainda não ligou o Discord à Bungie.
- **Por que:** hoje 68 de 70 não registraram; sem registro não dá para entrar nas grades.
- **Decidir antes:** texto da mensagem e se é melhor um aviso no canal em vez de mensagem privada.
