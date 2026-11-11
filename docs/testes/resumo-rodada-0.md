# Resumo da Rodada 0: verificação técnica (10/11/2026)

**O que foi esta rodada.** A Rodada 0 foi uma verificação técnica, não o teste com usuário leigo, que ainda não aconteceu. Quem testou foi o mesmo agente (Claude) que escreveu o roteiro, com a skill `cel-agents` original e todo o contexto. As chamadas foram feitas no sandbox da Celcoin: pelo MCP `cel_agents` e pelo app LoBank, rodando na máquina da usuária. O app está no branch `app-rodada-0`. O detalhe de cada passo, com horário, está em [`friction-log.md`](friction-log.md).

**Contas criadas no sandbox**

| Conta | Tipo | Agência / conta | Como foi aberta |
|---|---|---|---|
| Teste Rodada Zero Final Um | PF | 0001 / 41174129 | pelo MCP (12:20–12:29) |
| LoBank Teste Rodada Zero LTDA | PJ | 0001 / 41174137 | pelo MCP (12:41–12:43) |
| Lorrayne Caliari (CPF 736.918.010-72) | PF | 0001 / 41174228 | pelo app (13:53) |
| Teste MEI (CNPJ 23.014.491/0001-25) | PJ, MEI | 0001 / 41174517 | pelo app (17:04) |
| Padaria Fase Dois (CNPJ 46.013.634/0001-80) | PJ, LTDA, 2 sócios | 0001 / 41174608 | pelo app (17:46) |

---

## 1. Testes realizados

### Com sucesso

| Fluxo | Por onde | Observação |
|---|---|---|
| Onboarding PF com recusa (telefone final 2) | MCP | `REPROVED` em cerca de 6 s |
| Onboarding PF com documentoscopia (telefone final 1) | MCP e app | conta criada segundos depois da selfie aprovada |
| Onboarding PJ MEI e PJ LTDA com 2 sócios | MCP e app | conta por `fetch-business`; login por CNPJ ok |
| Crédito de teste (`wallet/entry`) | MCP | 5 créditos, todos conferidos pelo saldo |
| Saldo | MCP e app | |
| Extrato (até 7 dias), com filtros e arquivos PDF, CSV e OFX | MCP e app | |
| Criar e excluir chave aleatória (EVP) | MCP e app | sem OTP, como dizia o comentário do Studio |
| Pix por chave (`DICT`) para `testepix@celcoin.com.br` | MCP e app | confirmado em cerca de 34 a 45 s |
| Pix por agência e conta (`MANUAL`) | app | confirmado em cerca de 34 s |
| Pix Copia e Cola (`STATIC_QRCODE`) | app | aceito com `transactionIdentification: "***"` |
| QR Code estático (cobrança com valor) | app | o código traz chave, valor e nome; a cobrança sem valor ("Vários recebimentos") só foi testada no simulado |
| Erros comuns (chave inexistente, saldo insuficiente) | app | mensagens claras |
| Meus dados PF e PJ (`PUT /baas/v2/account/...`) | app | conferido na Celcoin |
| Cadastro e consulta de webhooks | MCP | `pix-payment-out` entregue ao webhook.site |

### Com erro ou inconsistência

| Fluxo | O que aconteceu | Situação |
|---|---|---|
| **Pix recebido entre duas contas da mesma empresa (tenant)** | O pagamento é confirmado e debitado de quem paga. Existe um registro `RECEIVEPIX`, mas o valor **não entra** no saldo nem no extrato de quem recebe. Aconteceu nas **4 tentativas**: 12:46, 14:53, 16:24 e 17:32 | **sem solução**. É o item 1 para a Celcoin |
| Cadastrar webhooks `pix-payment-in` e `pix-payment-out` para resolver o item acima | A saída passou a ser notificada, mas o recebimento **nem gerou** o evento `pix-payment-in` | a hipótese foi derrubada às 16:27 |
| Extrato no app com janela de 30 dias | Recusado pela Celcoin: máximo de 7 dias | corrigido |
| Minhas chaves com a conta sem chave | A Celcoin responde 404 `CBE180`, e não uma lista vazia | tratado no app |
| Cadastro MEI com sócio a mais | Recusado: MEI aceita um único `SOCIO` | corrigido |
| Copia e Cola com espaços no código | O app tirava os espaços e a Celcoin recusava por CRC inválido | corrigido |
| Meus dados de uma PJ | A Celcoin exigiu `owners` no `PUT` | corrigido |
| "Validar identidade" logo depois do cadastro | A Celcoin ainda não tinha o link de documentoscopia | corrigido com espera de 10 s |

### Não testado ou fora do escopo

- QR Code dinâmico, com validade e uso único.
- Sócio pessoa jurídica.
- Envio do extrato por e-mail.
- Agendamento de Pix, portabilidade e reivindicação de chave, que foram retirados por decisão da usuária.
- A rodada com o usuário leigo, adiada pela usuária às 17:58.

---

## 2. Pontos para levar à Celcoin

1. **Pix entre contas do mesmo tenant não é creditado no destino.** Aconteceu 4 de 4 vezes: PJ→PF e MEI→PF, por chave e por QR Code, com e sem webhooks cadastrados.
   - Registros `RECEIVEPIX`: `202611100000000666`, `202611100000000830`, `202611100000001020`, `202611100000001150`.
   - Os valores somem da soma das duas contas: R$ 50, R$ 25, R$ 10 e R$ 7.
   - Pergunta para a Celcoin: isso é uma limitação do sandbox? Existe configuração para habilitar o crédito entre contas do mesmo tenant?
2. **Lista de chaves de uma conta sem chave** devolve 404 `CBE180`, e não lista vazia. A documentação não diz isso.
3. **MEI aceita um único owner `SOCIO`.** A regra só aparece na mensagem de erro, não na documentação da proposta.
4. **Proposta PJ com 2 sócios gerou uma única documentoscopia**, a do 1º owner. Pergunta: o sócio nunca precisa validar? Isso muda em produção?
5. **`owners` é obrigatório no `PUT /baas/v2/account/business`**, mesmo sem mudar sócios. Ao mesmo tempo, a documentação diz que mudar sócios só é possível pelo Compliance.
6. **Sócio pessoa jurídica:** o `owner` só aceita CPF. Pergunta: como cadastrar uma empresa que tem outra empresa como sócia?
7. **Não há forma documentada de simular um Pix recebido** no sandbox, nem massa de teste para cash-in.
8. **A consulta de inscrições de webhook devolve a senha do `auth` em texto puro.**
9. **Ferramenta de documentação do MCP:**
   - a busca não acha páginas de BaaS que existem: criar proposta PF, criar e excluir chave, atualizar dados da conta, gerenciamento de webhooks;
   - o `fetch_celcoin_documentation` não aceita a URL `.md`.

---

## 3. Pontos que não estão na documentação ou que estão incorretos

### Na documentação da Celcoin

| Ponto | Onde |
|---|---|
| O exemplo de chave EVP manda `"key": ""`, mas o erro `CBE178` diz que o campo não deve ser enviado | Cadastrar chave Pix |
| Os campos obrigatórios do Pix out diferem entre a referência e o tutorial | Realizar transferência Pix |
| `owner` da proposta PJ aparece como objeto no schema e como lista no exemplo; o sandbox aceita lista | Proposta PJ |
| `companyType` só aceita PJ ou MEI, mas não diz como tratar EI, SLU, LTDA, SS e S.A. | Proposta PJ |
| Regra do MEI (um único `SOCIO`) ausente | Proposta PJ |
| `owners` obrigatório no `PUT` da PJ: aparece no exemplo, mas não está marcado como obrigatório | Atualizar dados da conta |
| O horário do `RECEIVEPIX` vem em UTC e no formato MM/DD/AAAA; as outras rotas usam horário de Brasília | Consulta de recebimento Pix |
| O erro do decode de Copia e Cola vem como `code 999`, com o JSON escapado em `description` e o código real em `errors[0]` | `POST /pix/v1/emv/full` |
| A consulta de propostas por data exige janela de mais de um dia; com `dateFrom` igual a `dateTo` responde 404 | Consulta de propostas |
| Não há página de criação de QR Code dinâmico no índice | QR Code / cobrança |

### Na skill `cel-agents` (divergências com o sandbox e ausências)

- **Diverge:**
  - a conta sai em segundos depois da documentoscopia; a skill fala em cerca de 11 min e em propostas paradas em `APPROVED`;
  - `GET /baas/v2/pix/payment/status` funciona no sandbox; a skill diz que responde `CBE106`.
- **Falta:**
  - consulta de conta PJ: `account/fetch-business`, com o número em `body.businessAccount.account`;
  - extrato: `baas-walletreports`;
  - exclusão de chave;
  - o 404 `CBE180` na lista de chaves vazia;
  - os limites de janela: proposta 30 dias e mais de um dia, `fetch-all` 7 dias, extrato 7 dias;
  - a regra do MEI;
  - uma documentoscopia só na PJ;
  - `owners` no `PUT` da PJ;
  - atualizar dados da conta;
  - cadastro de webhooks.
- **Confere com a skill:**
  - final 2 reprova;
  - final 1 não aprova sozinho;
  - crédito por `wallet/entry`;
  - copiar o DICT para o `creditParty`, inclusive os campos mascarados;
  - grafia `endtoEndId`;
  - `200 PROCESSING` não é sucesso;
  - tabela de `initiationType`;
  - `participants` sem código de compensação;
  - histórico de eventos em horário de Brasília.

### No Studio (telas × API)

- **As telas de cadastro PJ não pedem dados que a Celcoin exige:**
  - endereço, e-mail e telefone da empresa;
  - endereço do responsável;
  - nome da mãe, nascimento, telefone, e-mail e endereço de cada sócio.

  O app criou 3 telas novas e acrescentou campos no modal de sócio.
- O Studio oferece 6 tipos de empresa; a API só aceita PJ ou MEI.
- "Recebimento único" promete validade e uso único, o que exige QR dinâmico. O app usa QR estático e ajustou o texto.
- O branding do HTML das telas (secundária `#F3F3FA`, raio 12 px) difere do branding do projeto devolvido pelo MCP (secundária `#49FADE`, raio 8 px).
- O comentário "Teste" em "Tipo de conta" é só ruído, não um requisito.

---

## 4. Pontos em que o agente errou

| # | Erro | Como foi percebido | Correção |
|---|---|---|---|
| 1 | Concluiu que o Pix "não foi recebido", sem olhar o módulo Pix | A usuária mostrou o registro `RECEIVEPIX` | conclusão revisada: o Pix existe no módulo Pix, mas não entra no saldo |
| 2 | Usou a dependência nativa `better-sqlite3` sem checar o Node da usuária | O `npm install` falhou no Windows | trocada por `node:sqlite` |
| 3 | Usou janela de 30 dias no extrato | Erro da Celcoin na tela | limitado a 7 dias |
| 4 | O modo simulado devolvia lista vazia de chaves, diferente do sandbox | Erro em "Minhas chaves" | app e simulação corrigidos |
| 5 | Diagnosticou "exclusão assíncrona" sem evidência e mudou o código | A usuária tinha consultado a conta errada no Postman | mudança desfeita depois |
| 6 | A primeira versão do intervalo de 10 s deixou de fora as tentativas automáticas em caso de falha | Pergunta da usuária | sem tentativas rápidas; falhas também esperam 10 s |
| 7 | Permitiu MEI com sócios e representante | Recusa da Celcoin | MEI só com o titular |
| 8 | Tirava todos os espaços do código Copia e Cola, o que quebrava o CRC; a simulação não conferia o CRC | "HTTP_400" na tela | espaços mantidos; a simulação passou a conferir o CRC |
| 9 | Supôs "uma validação por sócio" a partir de uma PJ que tinha um sócio só | A proposta LTDA gerou uma validação só | textos, simulação e teste corrigidos |
| 10 | Não mandava os sócios no `PUT` da PJ | Recusa da Celcoin | o app reenvia os sócios atuais |

**Padrão dos erros:** a maioria veio de supor o comportamento da API, ou de deixar a simulação diferente do sandbox, em vez de confirmar antes. Nos itens 4, 8 e 9, os testes automáticos passavam porque a simulação refletia a suposição errada.

---

## 5. Outros pontos relevantes

- **Pedidos da usuária implementados no app:**
  - espera de 10 s, com o tempo na tela, depois de um Pix e antes da validação de identidade;
  - nenhuma consulta à Celcoin se repete antes de 10 s, nem em caso de falha;
  - exclusão de chave;
  - extrato limitado a 7 dias;
  - "Voltar ao início" no comprovante;
  - atalhos e "Minha conta" mostrando só o que funciona.
- **Webhooks seguem cadastrados** (`pix-payment-in` e `pix-payment-out`) apontando para o webhook.site da usuária, com login e senha de teste fictícios. Para remover: `DELETE /baas/v2/webhook/subscription/{id}`.
- **Segredos:** as credenciais ficam só no `.env`, fora do Git. O histórico dos dois branches foi conferido às 16:15 e não há segredo commitado.
- **Acesso à documentação:** o install.md e várias páginas de referência só foram lidas pelo navegador do app do Claude, com aprovação da usuária. O site aplica limite de leituras, e depois de várias seguidas pediu verificação anti-robô, que passou sozinha em cerca de 1 minuto.
- **`/pix/v1/participants`** devolve 887 instituições, cerca de 250 KB. O app guarda a lista por 24 h.
- **Tempo típico no sandbox:**
  - proposta → link de documentoscopia: cerca de 5 a 10 s;
  - documentoscopia aprovada → conta criada: 5 a 11 s;
  - Pix out confirmado: cerca de 34 s; entre contas do tenant, até cerca de 2 min.
- **Hipóteses do roteiro (leitura técnica, só como linha de base):**
  - **H6 e H8 confirmadas:** o agente pediu confirmação antes de toda mutação, e nenhum segredo vazou;
  - **H5 derrubada em parte:** a aprovação funciona, mas depende da documentoscopia feita por uma pessoa;
  - **as outras** ficam para a rodada com o leigo.
- **Próximo passo:** a rodada com o usuário leigo, quando a usuária quiser.
