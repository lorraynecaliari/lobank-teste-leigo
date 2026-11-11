# Plano: módulo DDA (Débito Direto Autorizado)

Board do Studio: **DDA (Débito Direto Autorizado)**, `ce24e772`, criado em 11/11/2026 às 12:16, com 9 telas e nenhum comentário. Validações feitas em 11/11/2026 entre 12:20 e 12:35, só com leituras.

## 1. Telas do Studio

| # | Tela | id | Obrigatória |
|---|---|---|---|
| 1 | Aderir ao DDA › Termos de uso | `b86afc13` | sim |
| 2 | Aderir ao DDA › Cadastro | `12b7e262` | sim |
| 3 | Aderir ao DDA › Cadastro › Processamento | `0feb0a07` | opcional |
| 4 | Aderir ao DDA › Cadastro › Sucesso | `b138a51b` | opcional |
| 5 | Aderir ao DDA › Cadastro › Erro | `4e85d7cd` | opcional |
| 6 | Meus boletos › Vazia | `c2ec3a50` | sim |
| 7 | Meus boletos › Preenchida | `2fa3c1ee` | sim |
| 8 | Meus boletos › Detalhe do boleto | `b45f3550` | sim |
| 9 | EXCLUIR | `46b9c2d6` | opcional |

A tela **Cadastro** pede nome, CPF ou CNPJ, e-mail, telefone e CEP. A API de adesão só recebe documento e nome (`clientName`). Os outros dados o app já tem da conta, então podem vir preenchidos.

## 2. O que a documentação diz

Fontes: guia `docs/sobre-dda.md` (atualizado em 20/08/2026), referências "Cadastrar usuário", "Excluir usuário" e "Gerar boleto", e a recipe "DDA". O guia e as referências **não aparecem na busca do MCP**: a busca só devolve a recipe. Achei as páginas pelo `llms.txt`, no navegador.

| Ação | Endpoint | Retorno |
|---|---|---|
| Configurar webhook (um por evento: `Subscription`, `Deletion`, `Invoice`) | `POST /dda-servicewebhook-webservice/v1/webhook/register` | 201 |
| Consultar webhooks | `GET /dda-servicewebhook-webservice/v1/webhook/routes` | 200 |
| Aderir (cadastrar usuário) | `POST /dda-subscription-webservice/v1/subscription/Register` `{document, clientName, clientRequestId}` | 201 `PROCESSING` + `subscriptionId` |
| Sair do DDA (excluir usuário) | `DELETE /dda-subscription-webservice/v1/subscription/Register` `{document, clientRequestId}` | 201 `PROCESSING` |
| Gerar boleto de teste (só sandbox, até 20 documentos) | `POST /dda-serviceinvoice-webservice/v1/invoice/register` `{document: [...]}` | 201, `Success` ou `Fail` por documento |

Regras importantes:
- **Tudo é assíncrono e só por webhook.** O resultado da adesão (`Created` ou `Error`), da exclusão (`Inactive` ou `Inactive_failed`) e **os boletos** chegam por webhook. **Não existe consulta** de status da adesão nem lista de boletos.
- Adesão e exclusão só funcionam em **dias úteis, das 6h às 22h**. Fora disso, ficam para o próximo dia útil.
- É obrigatório **coletar o aceite do termo de adesão** e guardá-lo. A Celcoin ou o Bacen podem pedir.
- No sandbox, os webhooks podem levar até 10 minutos. Massa de teste: CPF `71929784007` simula adesão com sucesso (mas não recebe boletos) e CPF `26817625025` simula erro.
- Os boletos chegam com status de 01 (Aberto) a 07 (baixas). A própria Celcoin **não recomenda usar o DDA para saber se um boleto foi pago**.
- O pagamento usa a API de pagamento de contas que o app já tem (`authorize` + `billpayment`).

## 3. Validações no sandbox (só leitura)

| Hora | Chamada | Resultado | Observação |
|---|---|---|---|
| 12:25 | `GET /dda-servicewebhook-webservice/v1/webhook/routes` | **401** `CDDA001` "Nenhum webhook cadastrado" | O acesso ao DDA funciona: a mensagem é de negócio. Mas a lista vazia volta como **HTTP 401**, não como 200 ou 404. |
| 12:30 | Leitura do webhook.site `cf4221a7-…` pela API pública (`/token/{id}/requests`) | 200, últimos eventos disponíveis | O app consegue ler os eventos sem servidor público. O endereço é público: só serve para o sandbox. |

### Escritas no sandbox (aprovadas pela usuária às 12:22)

| Hora | Chamada | Resultado | Observação |
|---|---|---|---|
| 12:24 | `POST webhook/register` para `Subscription`, `Deletion` e `Invoice`, sem autenticação, no webhook.site `cf4221a7-…` | 201 nos três; `GET webhook/routes` agora devolve 200 com os três | A resposta devolve o tipo **em minúsculas** (`subscription`), diferente do que foi enviado. |
| 12:24 | `POST subscription/Register` da LTDA `46013634000180` e da PF `73691801072` | 201 `PROCESSING`, subscriptionId `0db64b51-…` (LTDA) e `7c9329d2-…` (PF) | |
| 12:25 | Webhooks `Subscription` | `Created` para os dois, **cerca de 1 minuto depois** | O corpo não traz o tipo do evento (`entity`): adesão e exclusão têm o mesmo formato e só o `status` diferencia. |
| 12:26 | `POST invoice/register` com os dois documentos | 200, `Success` para os dois | A documentação diz 201. |
| 12:26 | Webhooks `Invoice` | **3 boletos para cada documento**, não 1 | Valores em **centavos** (`originalValue: 11341` = R$ 113,41). Vencimento no dia seguinte. Uma das linhas da PF tem **48 números**. |
| 12:28 | `authorize` com a linha digitável de um boleto da LTDA | 400 **`822`** "Erro na conversão de linha digitável" | |
| 12:28 | `authorize` com o código de barras do mesmo boleto | 400 **`623`** "Máximo de R$ 1.000.000,00" | O valor dentro do código (R$ 31.993.301,13) não bate com o `originalValue` (R$ 113,41). **Os boletos de teste do DDA não podem ser pagos no sandbox.** |

## 4. Divergências encontradas na documentação

1. A busca do MCP não acha o guia nem as referências do DDA: só a recipe.
2. No guia, "Simular cadastro com sucesso" manda usar "qualquer CPF válido" e mostra o CPF `22444699050` no pedido, mas a resposta traz `71929784007`. A referência diz que o CPF de sucesso é `71929784007`.
3. A recipe chama a adesão de "criação da proposta" e diz que ela "retorna proposalId". A API devolve `subscriptionId`.
4. No exemplo do webhook de sucesso da recipe, o campo `status` traz "Customer Teste" em vez de `Created`.
5. Os erros vêm em `erro` (em português), e não em `error` como no resto do BaaS.
6. Consultar webhooks sem nenhum cadastrado devolve HTTP 401.
7. "Gerar boleto" devolve HTTP 200 (a referência diz 201) e gera 3 boletos por documento, não 1.
8. As linhas dos boletos de teste não são válidas (dígitos e valor), então o pagamento não pode ser testado ponta a ponta com o DDA no sandbox.

## 5. Decisões da usuária (11/11, 12:22)

- Eventos pelo **webhook.site**, lido pelo app.
- Adesão da **LTDA e da PF**.
- **Sair do DDA** entra, como item em Minha conta.

## 6. Construção (commit `cba22f1`, 11/11 12:44)

- **Receber os eventos:** registrar os 3 webhooks do DDA no webhook.site que já usamos. O app lê os eventos pela API do webhook.site, no máximo a cada 10 s, e guarda o estado da adesão e os boletos no banco local.
- **Entrada:** "Meus boletos (DDA)" em Pagar contas e "Débito Direto Autorizado (DDA)" em Minha conta. Sem adesão, abre os Termos.
- **Adesão:** Termos (aceite guardado com data, hora e versão do termo) → Cadastro (dados da conta já preenchidos; documento sem edição) → Processamento (contagem de 10 s e "Consultar de novo"; avisa que pode levar até 10 minutos no sandbox) → Sucesso ou Erro.
- **Meus boletos:** lista com os boletos em aberto vindos do evento `Invoice`, com vencimento e valor → Detalhe → **Pagar** reaproveita o fluxo do boleto, a partir de "Confirmar valor", com o `authorize` da linha digitável.
- **Botão de teste (só sandbox):** "Gerar boletos de teste", em Meus boletos vazia e no menu Opções.
- **Sair do DDA:** em Minha conta e em "Cancelar DDA" no menu Opções do Studio, com senha de transferência.
- **Pagar:** fluxo real pelo authorize; no sandbox aparece "O banco emissor não reconheceu o código deste boleto" (decisão da usuária).
- **Configuração:** `DDA_WEBHOOK_SITE_TOKEN` no `.env` com o identificador do webhook.site.
- **Mock:** o modo simulado imita a adesão assíncrona, os boletos e os erros, como nos outros módulos.

## 7. Roteiro de testes (depois de construído)

| # | Teste | Esperado |
|---|---|---|
| D1 | Aderir com a conta escolhida | Processamento e, em até cerca de 10 minutos, Sucesso |
| D2 | Aderir com o CPF de erro `26817625025` (só pelo MCP) | Webhook `Error` com `CDDA101` |
| D3 | Gerar boleto de teste e abrir Meus boletos | O boleto aparece com valor, vencimento e beneficiário |
| D4 | Detalhe do boleto → Pagar | `authorize` com a linha do DDA. **Incerto:** os boletos gerados pelo sandbox podem não ser pagáveis (linha fictícia) |
| D5 | Meus boletos sem adesão ou sem boletos | Tela vazia correta |
| D6 | Adesão fora da janela (antes das 6h, depois das 22h ou em dia não útil) | O app avisa que fica para o próximo dia útil |
| D7 | Sair do DDA (se entrar no escopo) | `Inactive` por webhook |
