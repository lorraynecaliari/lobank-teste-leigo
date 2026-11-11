# QA de homologação pelo cel_agents (11/11/2026)

**O que foi.** Roteiro de QA de homologação do MCP `cel_agents` (Celcoin), rodado pelo agente (Claude) em modo **audit**: só leitura e avaliação, sem mudar o código e sem executar o app contra o sandbox. O projeto no painel do cel_agents se chama `lobank-teste-leigo` (id `3b22722d-2da1-44f6-91c6-542580efe74f`).

| | |
|---|---|
| Discovery | 18:33–18:34 (run `8c116f97`) |
| Avaliação | 18:35–18:52 (run `da95aad6`), `scope=all`, todos os itens do roteiro |
| Código avaliado | branch `app-rodada-0`, commit `dbfee48` |
| Branch registrado no projeto | `main` (só documentação). Ver "Pontos de atenção". |
| Evidências usadas | código do app e este `friction-log.md` |

## Produtos

O discovery encontrou dois produtos, e a usuária escolheu avaliar os dois:

- **BaaS Conta Única** (`baas-conta-unica`): abertura de conta PF e PJ do tipo BaaS, saldo, extrato detalhado, chaves Pix, Pix enviado e QR Code estático.
- **DDA (Embedded Solutions)** (`embedded-dda`): adesão, saída e boletos de teste.

**Não detectados:** CobranSaaS, Core Banking/KYC 2.0, Débitos Veiculares, Crédito do Trabalhador e os produtos Embedded de Pagamento de Contas, Pix Cash-in, Pix Cash-out, TED, Recargas e Saques/Depósitos. O boleto do app é o do BaaS (`POST /baas/v2/billpayment`), não o Embedded.

**Em aberto:** "BaaS + Onboarding (RH001 v12)" usa as mesmas rotas de abertura de conta que a Conta Única. Pelo código não dá para saber qual dos dois é o contratado, então ficou fora da avaliação.

## Resultado

| Produto | Itens | Conforme | Não conforme | Precisa de ação humana | Proposto "Não se aplica" |
|---|---|---|---|---|---|
| BaaS Conta Única | 57 | 0 | 25 | 20 | 12 |
| DDA | 12 | 0 | 0 | 12 | 0 |

**Por que nenhum item ficou conforme.** O roteiro só aceita como prova uma chamada feita **pela própria aplicação** ao sandbox, com requisição e resposta registradas. Chamada avulsa pelo MCP, por ferramenta externa ou pelo modo simulado não conta. Nesta auditoria o app não foi executado. Os testes registrados neste log têm o resultado, mas não a requisição e a resposta, e parte deles foi feita pelo MCP antes de o app existir.

### Não conforme (25)

- **O app não recebe nem trata webhooks do BaaS** (17 itens). Não existe rota que receba avisos, e o leitor do webhook.site (`src/dda-events.js`) descarta tudo que não é DDA. O resultado de um Pix vem só da consulta de status. Itens afetados:
  - conta criada;
  - Pix enviado confirmado e rejeitado, por agência e conta, chave, QR estático, QR dinâmico imediato e QR com vencimento;
  - Pix recebido por QR estático, por chave e por agência e conta;
  - deduplicação por `endToEndId`, resposta HTTP 200 e conferência do valor recebido.
- **Funções que faltam no app:**
  - ativar/desativar conta, encerrar conta e listar contas;
  - devolução de Pix enviado e o aviso de devolução;
  - consulta do QR dinâmico imediato antes de pagar;
  - regras do QR com vencimento (multa, juros, desconto). Como o Copia e Cola aceita qualquer código, um QR com vencimento seria pago pelo valor bruto.

### Precisa de ação humana (32)

O código está implementado e boa parte foi testada pelo app, mas falta a chamada da aplicação registrada:

- **BaaS (20):**
  - abrir conta PJ, saldo, extrato detalhado e editar conta;
  - criar e excluir chave EVP;
  - Pix por agência e conta e por chave (consulta ao DICT e envio);
  - QR estático: ler o código, consultar a chave e pagar; gerar QR estático para receber;
  - consulta de status confirmado e rejeitado;
  - QR dinâmico imediato (ler, consultar a chave e pagar) e QR com vencimento (ler e consultar a chave): nunca foram testados, e não dá para saber se a leitura do código traz o que o app precisa.
- **DDA (12):**
  - todos os itens, incluindo o registro e a consulta dos webhooks, que foram feitos pelo MCP, fora do app;
  - os avisos de erro (`ERROR`, `INACTIVE_FAILED`) só foram vistos no modo simulado;
  - os dois itens de tela pedem um print anexado, e o MCP não envia arquivos. Os prints estão em `docs/telas/dda/`: 01 e 02 para o termo e os dados, 07 e 11 para os boletos.

### Proposto "Não se aplica" (12)

O app não oferece estes fluxos:

- transferência entre contas BaaS (4 itens);
- cobrança Pix dinâmica para receber, imediata e com vencimento (6 itens);
- devolução de Pix recebido (2 itens).

Se a Celcoin exigir algum deles no contrato, os itens dele viram não conformes.

## Correção do agente

Em três avaliações enviadas ao painel, a observação diz que não há execução pelo app no sandbox. **Isso está errado**: este log registra os testes pelo app.

- **Abrir conta PJ:** MEI às 17:04 e LTDA com 2 sócios às 17:46.
- **Editar conta:** PF às 17:35 (Teste D) e PJ às 17:50.
- **Pix por agência e conta:** 17:16 (Teste B).

O veredito ("precisa de ação humana") continua certo, porque ainda falta a requisição e a resposta capturadas. Só a observação deve ser corrigida numa próxima rodada.

## Pontos de atenção

- **Branch:** o projeto ficou ligado à `main` (o agente usou o branch padrão no cadastro), mas o código está na `app-rodada-0`. Cada avaliação registra o branch e o commit avaliados. Vale decidir se o projeto deve apontar para a `app-rodada-0`.
- **webhook.site:** o endereço usado pelo DDA expira em 17/11 às 16:20.
- **Pendências com a Celcoin** (já registradas neste log):
  - o Pix entre contas do mesmo tenant não é creditado no destino e não gera `pix-payment-in`;
  - o aviso de saída do DDA da LTDA (13:37) nunca chegou.

## Testes pelo app com evidência (11/11, 19:17–19:30)

Depois da auditoria, o agente rodou os fluxos **pelo próprio app**, ligado na máquina da usuária com `EVIDENCIAS=1` (app `app-rodada-0`, commit `e92ab77`). O app gravou **58 chamadas reais ao sandbox**, todas mascaradas: [relatório](evidencias/evidencias-qa-2026-11-11.md) e [arquivo bruto](evidencias/evidencias-qa-2026-11-11.jsonl). A usuária fez as duas documentoscopias; o resto foi feito pelo agente no navegador do app do Claude.

| Fluxo | Resultado |
|---|---|
| Abertura de conta PF | `RESOURCE_CREATED`, conta `0001 / …621` |
| Abertura de conta PJ LTDA | `RESOURCE_CREATED`, conta `0001 / …639` |
| Saldo, extrato detalhado, Meus dados e edição (PF e PJ) | ok; `PUT` aceito nas duas |
| Chave EVP: criar, listar e excluir (PF e PJ) | ok; exclusão conferida pela releitura (404) |
| Pix por chave (DICT) | R$ 1, `CONFIRMED` |
| Pix por agência e conta (MANUAL) | R$ 1, `CONFIRMED` |
| QR estático: gerar (PJ), ler, consultar e pagar (PF) | R$ 1, `CONFIRMED` |
| Consulta de status do Pix | 4 consultas, todas `CONFIRMED` |
| DDA: adesão, boletos de teste, lista, detalhe e saída | os 5 avisos chegaram e foram registrados; print da lista em [`print-dda-boletos-2026-11-11.jpg`](evidencias/print-dda-boletos-2026-11-11.jpg) |

**Não fechou com evidência:**

- **Status rejeitado:** o Pix para `testecelbaas@celcoin.com.br`, que a skill indica como não liquidável, foi `CONFIRMED`. O app bloqueia falta de saldo antes de chamar a Celcoin, então não há como provocar um Pix recusado pelo app.
- **Pagar boleto do DDA:** o `authorize` respondeu `623`, como esperado para boleto de teste.
- **Crédito de teste** (R$ 100 em cada conta) entrou pelo MCP, fora do app.
- **Correções nas máscaras** feitas durante a análise: `externalTerminal` (conta usada no `authorize`) e os identificadores da correlação (commits `c66e175` e `dea8302`). Na cópia publicada aqui o campo já está mascarado.

## Rodada 2: correção do código (11/11, 19:48–19:59)

QA no modo **remediate**, escopo aberto (57 itens: 45 do BaaS e 12 do DDA). Código avaliado: `app-rodada-0`, commit `008c4b9`. As evidências de execução são as das 19:17–19:30 (commit `dea8302`). Nenhuma escrita foi feita no sandbox nesta rodada.

| Produto | Conforme | Precisa de ação humana | Não se aplica | Não conforme |
|---|---|---|---|---|
| BaaS Conta Única | 14 | 31 | 12 | 0 |
| DDA | 6 | 6 | 0 | 0 |

**O que entrou no app:**

- **Webhooks do BaaS** em `POST /webhooks/celcoin`, com autenticação básica opcional:
  - `onboarding-create`
  - `pix-payment-out` e `pix-payment-in`
  - `pix-reversal-out` e `pix-reversal-in`

  O app guarda cada aviso uma vez só (pelo `endToEndId`), responde 200 e confere se o valor recebido no QR é o valor cobrado.
- **Gestão de conta:**
  - bloquear e desbloquear a conta;
  - encerrar a conta, só com saldo zero;
  - listar contas.
- **Devolução de um Pix recebido:** motivo e valor, sem passar do valor recebido.
- **QR dinâmico:** o app consulta o payload, usa valor, chave e `txid` da cobrança e recusa uma cobrança que não está ativa.
  - **COB:** imediato.
  - **COBV:** com vencimento, juros, multa e desconto.
- **Ferramenta administrativa** `tools/celcoin-admin.js`:
  - consulta e cadastro dos webhooks do BaaS e do DDA;
  - listagem de contas.

  Ela só escreve no sandbox com `--sim`.

**Conformes no DDA:** adesão, aviso `Created`, geração de boletos, aviso `Invoice`, saída e aviso `Inactive`.

**Precisa de ação humana, e quem precisa fornecer:**

1. **Usuária: autorizar e rodar no sandbox as funções novas**, com `EVIDENCIAS=1`. Envolve:
   - bloquear e encerrar uma conta;
   - devolver um Pix;
   - pagar QR dinâmico;
   - cadastrar os webhooks.

   Hoje elas existem só no código e nos testes simulados, e ainda **não têm tela**.
2. **Usuária: definir o endereço de entrega dos webhooks do BaaS**, para os avisos chegarem ao app.
3. **Celcoin: massa para os casos de rejeição.** Nenhum foi provocado:
   - Pix `ERROR`;
   - adesão `ERROR`;
   - saída `INACTIVE_FAILED`.
4. **Celcoin: confirmar o que foi deduzido da documentação:**
   - a rota do payload do COB;
   - os valores de status da conta;
   - os campos do cadastro de webhook do DDA;
   - o formato do aviso `onboarding-create`.
5. **Usuária: anexar no painel** os prints do termo e dos dados do DDA (`docs/telas/dda/01` e `02`) e o print da lista de boletos.

## Próximos passos

1. **Rodar o app com o `.env` do sandbox** e repetir os fluxos, guardando a requisição e a resposta mascaradas e o log do servidor. Isso deve fechar a maior parte dos 32 itens que precisam de ação humana.
2. **Anexar no painel os prints do DDA** (termo, dados e boletos).
3. **Refazer a consulta das URLs do DDA** (`GET webhook/routes`) e guardar a resposta.
4. ~~Decidir se o app vai tratar os webhooks do BaaS.~~ Feito na rodada 2 (commit `008c4b9`): falta só o endereço de entrega e a execução real.
