# Plano: módulo Pagamento de Contas (boleto)

Board do Studio: **Pagamento de Contas** (14 telas), criado em 10/11/2026 às 18:28. Plano montado às 18:45, antes de construir. Conta usada nos testes: **PJ LTDA** (CNPJ 46.013.634/0001-80, conta 41174608).

## 1. Comentários do Studio e decisões

| Tela | Comentário ou decisão | O app vai |
|---|---|---|
| Leitor de Códigos \| Horizontal | "Não deve essa função" | não ter leitor por câmera |
| Leitor de códigos \| Vertical | "Não deve essa função" | não ter leitor por câmera |
| Conta de pagamento | "Celcoin somente tem conta pagamento" | não ter a tela de escolher conta (corrente ou poupança). A conta usada aparece na confirmação |
| Confirmar Valor \| Agendamento, Pagamento agendado, Comprovante \| Pagamento agendado | Decisão da usuária (18:44): retirar, como no Pix | só pagamento na hora |
| Formas de Pagamento: "Abrir PDF" | Decisão da usuária (18:44): retirar | ficar só com "Digitar código" e "Pix Copia e Cola" |
| Formas de Pagamento: "Pix Copia e Cola" | já existe no app | levar para a tela de Copia e Cola já pronta |
| Formas de Pagamento: leitor USB ou bluetooth | a nota do Studio continua valendo | aceitar no campo de digitar, porque esses leitores digitam o código no campo |

**Telas que vão para o app (8):**
1. Formas de Pagamento
2. Digitar código manualmente
3. Informar valor, sem data: só aparece quando o boleto deixa mudar o valor
4. Confirmar Valor
5. Pagamento concluído
6. Falha no pagamento
7. Comprovante | Pagamento pendente
8. Comprovante de pagamento

**Entrada no app:** um atalho **"Pagar contas"** na Home.

## 2. Integração com a Celcoin (BaaS, não o produto avulso)

```
1. POST /v5/transactions/billpayments/authorize   → dados do boleto + transactionId   (errorCode "000" = ok)
2. POST /baas/v2/billpayment                      → 200 PROCESSING (não é sucesso)
3. GET  /baas/v2/billpayment/status?ClientRequestId=…  → CONFIRMED | ERROR   (a cada 10 s, com o tempo na tela)
```

**Regras que o app segue (da skill e do teste de saúde):**
- O valor a pagar é `registerData.totalUpdated`, e não o valor impresso no código. No caso de multa e juros, o código diz R$ 988,88 e o valor atualizado é R$ 987,93.
- Só deixa mudar o valor quando `allowChangeValue` for `true`, e dentro do intervalo `[minValue, maxValue]`.
- O vencimento vem de `registerData.dueDateRegister`.
- `errorCode` diferente de `"000"` é falha, mesmo com HTTP 200.
- **Sem trava de horário no app.** O `authorize` informa `initeHour` 07:00 e `endHour` 20:00, mas a usuária conferiu que o sandbox não aplica esse limite. O app não bloqueia por horário; se a Celcoin recusar, ele mostra o motivo que ela der.
- O saldo é conferido antes de pagar.
- Se aparecer `PCE088` ("Excede limite de saldo"), é limite do produto, não falta de saldo. O app mostra uma mensagem própria.
- **Comprovante oficial:** a consulta de status confirmada não traz o `receipt`, mas o evento `billpayment` traz: protocolo, autenticação, convênio e o recibo formatado. O app roda no computador da usuária e não recebe webhook, então busca o evento pela consulta de histórico `GET /baas/v2/webhook/replay/billpayment/details` (testado às 18:50: funciona) e localiza o pagamento pelo `clientRequestId`. Se o evento ainda não estiver lá, o comprovante mostra os dados do `authorize` e avisa que o recibo da Celcoin chega em instantes.

## 3. Teste de saúde (feito às 18:35, aprovado pela usuária)

| Passo | Resultado |
|---|---|
| `authorize` da linha base `23793381286008301352856000063307789840000150000` | `errorCode "000"`, R$ 1.500, vence hoje, `allowChangeValue: false` |
| `POST /baas/v2/billpayment` R$ 1.500 pela conta LTDA | `200 PROCESSING` |
| Status cerca de 40 s depois | **`CONFIRMED`**, `hasOccurrence: false`, `paymentDate 18:35:34` |
| Saldo LTDA | R$ 10.000 → **R$ 8.500** |

**O pagamento de contas está liberado neste sandbox.** Pode construir o fluxo inteiro.

## 4. Massa de teste consultada (`authorize`, 18:45)

| Caso | Linha digitável | Banco | Valor original | Ajustes | **A pagar** | Mudar valor? |
|---|---|---|---|---|---|---|
| Base | `23793381286008301352856000063307789840000150000` | Bradesco | 1.500,00 | — | **1.500,00** | não |
| Desconto | `34198862666531252277792218900006890430000039322` | Itaú | 436,92 | desconto 43,70 | **393,22** | não |
| Multa e juros (vencido 09/11) | `00190000090100159000700117369173390420000098888` | Banco do Brasil | 957,24 | multa 28,71 + juros 1,98 | **987,93** | não |
| Multa e vencido (09/11) | `23790124009217400000702005449802190400000191577` | Bradesco | 1.915,77 | multa 19,15 | **1.934,92** | não |
| Valor mínimo e máximo | `34191570070404695481642042200008290440000032202` | Itaú | 322,02 | juros 1,22 | **323,24** | **sim**, de 305,92 a 338,12 |
| Inválida (último dígito trocado) | `23793381286008301352856000063307789840000150001` | — | — | — | erro **822** "Erro na conversão de linha digitável" | — |

Na massa de teste, o vencimento vem sempre como hoje ou ontem, o que confere com a skill.

## 5. Roteiro de testes no sandbox real (depois de construído)

Use a conta **LTDA** (saldo R$ 8.500) e anote o horário de cada um.

| # | Teste | Como | Esperado |
|---|---|---|---|
| B1 | Pagar boleto com desconto | Home → Pagar contas → Digitar código → linha do **Desconto** | A confirmação mostra o valor original 436,92, o desconto 43,70 e **a pagar 393,22**. Depois: Pagamento concluído, comprovante e saldo −393,22 |
| B2 | Pagar boleto vencido com multa e juros | linha de **Multa e juros** | Aviso de **vencido**, multa e juros na tela e **a pagar 987,93**, não 988,88 |
| B3 | Valor que pode mudar | linha de **Valor mínimo e máximo** | Abre "Informar valor" com o intervalo 305,92 a 338,12. Tentar 400 é barrado no app. Pagar 310,00 conclui |
| B4 | Código inválido | linha **Inválida** | Mensagem clara de código inválido, sem tela de erro técnica |
| B5 | Saldo insuficiente | linha de **Multa e vencido** (1.934,92) numa conta com saldo menor que isso. Hoje todas as contas com login no app têm mais de R$ 5.900. Então: testar no modo simulado, ou abrir uma conta nova com pouco saldo | O app barra antes de enviar: "Saldo insuficiente" |
| B6 | Mesmo boleto duas vezes | repetir a linha do B1 | Ver o que a Celcoin faz (bloqueio de duplicidade ou novo pagamento) e registrar |
| B7 | Espera e comprovante | em qualquer pagamento | Contagem de 10 s na tela "Pagamento em processamento", depois "Pagamento concluído". O comprovante traz o **recibo oficial da Celcoin** (protocolo e autenticação), botão de copiar e "Voltar ao início" |
| B8 | Extrato | depois de B1 a B3 | Os pagamentos aparecem no extrato com o nome de "Pagamento de conta" |
| B9 | Pix Copia e Cola pela tela de boleto | Pagar contas → Pix Copia e Cola | Abre o Copia e Cola que já existe |

**Fica de fora:** boleto de convênio (contas de água, luz e afins, linha que começa com 8). A massa de teste dele não foi conferida ainda. Também ficam de fora o agendamento, o leitor por câmera e o "Abrir PDF".
