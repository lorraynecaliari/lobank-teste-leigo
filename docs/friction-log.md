# Friction log: teste "usuário leigo" (cel_agents + BaaS)

Nunca registre segredos aqui (Client ID, Secret, tokens). Se um segredo vazar, anote que vazou e onde, sem copiar o valor.

## Rodada 0: verificação técnica (10/11/2026)

Não é teste de usabilidade. Rodada feita pelo mesmo Claude que escreveu o roteiro, com a skill original e todo o contexto, para conferir se o sandbox e a skill se comportam como documentado. Código no branch `app-rodada-0`.

| Hora | Passo | Resultado | Observação |
|------|-------|-----------|------------|
| 12:09 | Busca na documentação: "Criar uma nova proposta pessoa física" | Não encontrada | O índice só devolve a página-resumo `reference/propostas.md`, que aponta para links sem versão `.md` no índice. Confirma a ressalva da skill sobre busca vazia. |
| 12:10 | `fetch_celcoin_documentation` com URL `.md` da página de referência | Erro "Documento não encontrado" | A ferramenta só aceita IDs do índice, então o "truque do `.md`" da skill não funciona por ela. Fora do MCP, o domínio da documentação está bloqueado nesta sessão. Limitação operacional. |
| 12:11 | `GET /onboarding/v1/onboarding-proposal` sem datas | 400 `OBE051` | Sem `proposalId`, data inicial e final são obrigatórias. |
| 12:11 | Mesmo GET com `dateFrom`/`dateTo` (30 dias) | 404 `OBE049` | Nenhuma proposta nos últimos 30 dias neste sandbox. |
| 12:12 | Mesmo GET com janela de 1 ano | 400 `OBE052` | Janela máxima de 30 dias. Não está na skill. |
| 12:13 | Leitura de `developers.celcoin.com.br` pelo terminal (curl) | Bloqueado pelo proxy de rede | Domínio público, mas fora da lista de domínios permitidos da sessão. Liberar em Settings > Capabilities só vale para conversas novas. |
| 12:16 | Leitura pelo navegador do app do Claude (`reference/criar-proposta-pessoa-fisica.md`) | OK, com aprovação da usuária | O OpenAPI completo está na página. Campos obrigatórios: `clientCode`, `documentNumber` (11 dígitos), `phoneNumber` (até 14), `email`, `motherName`, `fullName`, `birthDate` (`DD-MM-YYYY`), `address` (`postalCode`, `street`, `number`, `neighborhood`, `city`, `state`), `onboardingType` (`BAAS`). A aprovação pedida para o site inteiro foi concedida para um único uso. |
| 12:17 | CPF de teste | Gerado com dígito verificador válido (método 4devs) | Autorizado pela usuária, que usa CPFs do 4devs no sandbox. A skill proíbe inventar CPF; aqui a origem foi decisão humana. |

| 12:19 | Teste de saúde 1: `POST /onboarding/v1/onboarding-proposal/natural-person`, telefone final `2` (aprovado pela usuária) | 200 `PROCESSING` | `proposalId` `5937966b-…-d300848a54f6`. A resposta não traz campo `mocked`. |
| 12:19 | Consulta `GET /onboarding-proposal?proposalId=…` | `REPROVED` cerca de 6 s após a criação | **Confere com a skill**: a recusa por final `2` funciona. O `createdAt` vem como `2026-11-10T12:19:12Z`, mas é horário de Brasília (12:19 local), como a skill avisa. A documentoscopia ficou em `CREATED`. |

| 12:20 | Teste de saúde 2: mesma criação, telefone final `1` (aprovado pela usuária) | 200 `PROCESSING` | `proposalId` `332d4027-…-4dfe8ead3634` |
| 12:20 | Consulta da proposta (20 s) | `PENDING_DOCUMENTSCOPY` cerca de 5 s após a criação | Documentoscopia `PENDING`, com link externo `celcoin.cadastro.io/…` (passo humano). |
| 12:22 | Consulta da proposta (2 min) | Ainda `PENDING_DOCUMENTSCOPY`, sem atualização desde 12:20:40 | **Confere com a skill**: final `1` não aprova sozinho; a criação automática de contas está indisponível. |
| 12:23 | `GET /baas/v2/account/fetch?documentNumber=…` | 404 `CBE078` "Nenhuma conta foi encontrada" | Esperado: a conta ainda não existe ("ainda não", não erro). |
| 12:23 | `GET /baas/v2/account/fetch-all` com janela de 29 dias | 400 `CBE079` | Janela máxima de 7 dias. Rota e limite não estão na skill. |
| 12:24 | `fetch-all` em 4 janelas de 7 dias (13/10 a 10/11) | 404 `CBE078` em todas | Nenhuma conta criada neste sandbox nas últimas 4 semanas. A saída da skill ("siga com uma conta já existente") não está disponível aqui. |

**Bloqueio (resolvido às 12:29):** sem conta, nada depois do onboarding fecha (saldo, chave Pix, Pix, extrato), porque todas essas rotas exigem a conta pagadora.

| Hora | Passo | Resultado | Observação |
|------|-------|-----------|------------|
| ~12:28 | Documentoscopia humana no link `celcoin.cadastro.io` (feita pela usuária: documento e selfie) | Documentoscopia `APPROVED` às 12:29:09 | Passo humano obrigatório. **Requisito do app:** o onboarding precisa redirecionar o usuário para a URL de documentoscopia que a Celcoin devolve na consulta da proposta. |
| 12:29 | Consulta da proposta | `RESOURCE_CREATED` às 12:29:16, 7 s depois da documentoscopia aprovada | **Diverge da skill:** ela fala em cerca de 11 minutos e em propostas paradas em `APPROVED`. Hoje a conta saiu em segundos. |
| 12:29 | `GET /baas/v2/account/fetch?documentNumber=…` | 200, `statusAccount: ATIVO`, agência `0001`, conta `41174129` | `body.account` é objeto (`body.account.account`), como a skill diz. `birthDate` volta em `DD-MM-YYYY`. |
| 12:30 | `GET /baas/v2/wallet/balance?Account=41174129` | `amount: 0` | |
| 12:30 | Teste 3: `POST /baas/v2/wallet/entry/41174129`, R$ 5.000, `type: CREDIT` (valor definido pela usuária) | 200 `CONFIRMED`, id `e6c2f403-…` | **Confere com a skill.** A rota não aparece na busca da documentação. |
| 12:30 | Saldo de novo | `amount: 5000` | Crédito conferido por leitura, não só pela resposta. Saldo de sandbox: saques debitam e Pix recebido credita (observação da usuária). |
| 12:31 | Busca no MCP por "cadastrar chave pix", "chave aleatória EVP", "gerenciamento de chaves pix baas" | Nada sobre criar chave no BaaS | Os resultados trazem só Pix avulso, Pix Automático e QR Code. A página existe (`/reference/criar-chaves-pix`, menu "Gerenciamento de Chaves"), mas não está no índice. **A skill também não tem essa receita.** |
| 12:33 | Leitura de `/reference/criar-chaves-pix.md` pelo navegador | HTTP 429 com verificação anti-robô ("prove you're not a robot") | Depois de várias leituras seguidas, o site passou a exigir verificação humana. Não pode ser contornada pelo agente. |
| 12:34 | Nova tentativa, cerca de 1 min depois | OK | O bloqueio era temporário (limite de requisições). Endpoint: `POST /baas/v2/pix/dict/entry` com `account` e `keyType` obrigatórios. **Contradição na própria página:** o exemplo manda `"key": ""` para EVP, mas o erro documentado `CBE178` diz que, com `keyType` EVP, o campo `key` não deve ser informado. Vou omitir `key`. |
| 12:35 | Teste 4: `POST /baas/v2/pix/dict/entry` `{account: 41174129, keyType: EVP}` (aprovado pela usuária) | 200 `CONFIRMED`, chave `66ca96c5-7b3d-43d3-b07c-a1753cc364d2` | Criada sem OTP, **confirmando o comentário do Studio** ("EVP dispensa OTP"). `accountType: TRAN`, participante `13935893`. |
| 12:35 | `GET /baas/v2/pix/dict/entry/41174129` | 1 chave EVP listada | Criação conferida por leitura. |
| 12:36 | DICT externo: `GET /baas/v2/pix/dict/entry/external/41174129?key=testepix@celcoin.com.br` | 200, "Pix Celcoin Teste 2 Avulso", participante `13935893`, conta e tipo mascarados, `endtoEndId` gerado | Funcionou **sem** `ownerTaxId`. O campo vem grafado `endtoEndId`, como a skill avisa. |
| 12:37 | Leitura de `reference/realizar-transferência-pix.md` e `docs/realizar-um-pix-cash-out-por-chaves-pix.md` pelo navegador | OK | **Divergência na documentação:** a referência marca como obrigatórios `debitParty.{account, taxId, name, branch, accountType, bank}` e `creditParty.{bank, account, branch, taxId, name, accountType, key}`; o tutorial manda só `debitParty.account` e `creditParty.{bank, key, name}`. Valores aceitos (só no tutorial): `paymentType` IMMEDIATE/FRAUD/SCHEDULED, `urgency` HIGH/NORMAL, `transactionType` TRANSFER. O `endToEndId` vale 12 horas. |
| 12:37 | Teste 5: `POST /baas/v2/pix/payment`, R$ 10 para `testepix@celcoin.com.br`, `initiationType: DICT`, `creditParty` copiado do DICT com campos mascarados (valor definido pela usuária) | 200 `PROCESSING`, id `75b1c30c-…` | Payload completo da referência aceito. Na resposta, `accountType` do recebedor já veio `TRAN`. |
| 12:38 | Saldo (10 s) | `4990` | O débito aparece antes da confirmação. |
| 12:38 | `GET /webhook/replay/pix-payment-out/details` com `OnlyPending=true`, janela 12:30–12:45 em horário de Brasília (10 s) | 404 `CBE238` | "Ainda não", como a skill descreve. |
| 12:38 | `GET /baas/v2/pix/payment/status?id=…` (20 s) | 200 `PROCESSING` | **Diverge da skill**, que diz que essa rota devolve `CBE106` no sandbox. Aqui ela localizou a transação. |
| 12:38 | Mesma consulta de status (cerca de 45 s) | 200 `CONFIRMED` | Já mostra a conta real do recebedor (sem máscara). |
| 12:38 | Histórico de eventos de novo | 1 evento `pix-payment-out` `CONFIRMED`, `oldBalance 5000`, `currentBalance 4990`, status de entrega `PENDENTE`, `webhookUrl: null` | **Confere com a skill** (`OnlyPending`, fuso de Brasília). Não há webhook cadastrado; o evento fica pendente de entrega. |
| 12:40 | Como receber um Pix no sandbox: `docs/pix-cash-in-receber.md` e buscas no MCP ("simular recebimento pix sandbox", "pix cash-in sandbox teste") | Nenhuma forma documentada de simular um Pix recebido | A página lista os tipos de recebimento (agência e conta, chave, QR Code), mas não há massa de teste nem endpoint de simulação. A skill também não cobre cash-in. |
| 12:40 | Decisão da usuária: criar uma 2ª conta, desta vez **PJ**, e enviar um Pix dela para a chave EVP da conta 41174129 | — | |
| 12:41 | Leitura de `reference/criar-uma-proposta-pessoa-jurídica.md` | OK | **Divergência na documentação:** o schema define `owner` como objeto, mas o exemplo envia `owner` como lista. Vou enviar como lista, igual ao exemplo. Telefone de controle do KYC na PJ: `contactNumber` (pela skill). |
| 12:41 | Teste 6: `POST /onboarding/v1/onboarding-proposal/legal-person`, `contactNumber` final `1`, `owner` como lista (aprovado pela usuária) | 200 `PROCESSING`, `proposalId` `9f71b1fd-…-9d877f1b0f02` | O formato em lista foi aceito. |
| 12:41 | Consulta da proposta (15 s) | `PENDING_DOCUMENTSCOPY` cerca de 9 s após a criação | Uma documentoscopia, **do sócio** (CPF `808…206`), e não da empresa. Link `celcoin.cadastro.io/…` enviado à usuária. |
| ~12:42 | Documentoscopia do sócio feita pela usuária | Documentoscopia `APPROVED` às 12:43:09 | |
| 12:43 | Consulta da proposta | `APPROVED` às 12:43:10 e `RESOURCE_CREATED` às 12:43:20 | Cerca de 11 s entre a documentoscopia aprovada e a conta criada. Na PJ o estado `APPROVED` apareceu de passagem; não ficou parado nele. |
| 12:44 | `GET /baas/v2/account/fetch?documentNumber=<CNPJ>` | 400 `CBE370` "DocumentNumber possui tamanho maximo de 11 caracteres" | A consulta de conta da skill só serve para PF. |
| 12:44 | `GET /baas/v2/account/fetch-business?documentNumber=<CNPJ>` | 200, `ATIVO`, conta `0001 / 41174137` | Rota PJ descoberta por tentativa; **não está na skill**. Na PJ o número fica em `body.businessAccount.account`, e não em `body.account.account` como na PF. |
| 12:45 | Teste 7a: `POST /baas/v2/wallet/entry/41174137`, R$ 1.000 (aprovado pela usuária) | 200 `CONFIRMED`; saldo PJ `1000` | Evento `launch-in` registrado. |
| 12:45 | DICT externo a partir da PJ para a chave EVP da PF | 200, dono `Teste Rodada Zero Final Um`, CPF mascarado `***341912**`, `isSameTaxId: false` | |
| 12:46 | Teste 7b: `POST /baas/v2/pix/payment` PJ → chave EVP da PF, R$ 50, `creditParty` copiado do DICT (aprovado pela usuária) | 200 `PROCESSING`, id `556ccea3-…` | |
| 12:46 | Saldo PJ (40 s) | `950` | Débito feito. |
| 12:47 | Status do pagamento e evento `pix-payment-out` | `CONFIRMED`; o recebedor aparece resolvido como conta `41174129` (PF) | Do lado de quem pagou, a transação está concluída. |
| 12:47–12:49 | Saldo PF e eventos `pix-payment-in`, `internal-transfer-in` e `launch-in` | Saldo PF **continua `4990`**; nenhum evento de entrada para a PF (só o `launch-in` do crédito da PJ) | **Defeito ou limitação do sandbox:** um Pix entre duas contas BaaS do mesmo tenant foi debitado e confirmado na origem, mas não creditado no destino depois de cerca de 3 minutos. Item para pedir à Celcoin. |
| 12:53 | **Correção, com evidência da usuária:** consulta de recebimentos Pix pelo `endToEndId` na conta PF | Registro `RECEIVEPIX` de R$ 50, `transactionId 202611100000000666`, PJ 41174137 → PF 41174129, chave EVP | **O recebimento existe no módulo Pix.** Nessa consulta o `createTimestamp` veio `11/10/2026 15:46:06`, em **UTC** e no formato MM/DD/AAAA, enquanto os outros endpoints mostram horário de Brasília com `Z`. |
| 12:54 | `GET /baas/v2/wallet/balance?Account=41174129` | Continua `4990` | |
| 12:54 | Extrato `GET /baas-walletreports/v1/wallet/movement?Account=41174129&DateFrom=2026-11-10&DateTo=2026-11-10` | 2 lançamentos: crédito de teste R$ 5.000 (`ENTRYCREDIT`) e Pix enviado R$ 10 (`PIXPAYMENTOUT`). **O Pix recebido de R$ 50 não aparece.** | **Conclusão revisada:** o Pix chegou ao módulo Pix da conta recebedora, mas não foi lançado na carteira: não entrou no saldo nem no extrato. Os R$ 50 sumiram do saldo somado das duas contas. Item para a Celcoin. O extrato (`baas-walletreports`) não está na skill. |

**Achado:** só o navegador conseguiu ler a página de referência de criação de proposta PF. A ferramenta de documentação do MCP não alcança essa página porque ela não está no `llms.txt`, e o "truque do `.md`" da skill depende de um acesso HTTP que o agente pode não ter.

### Rodada 0: escopo e decisões do app (P3), 10/11/2026

- **Tipos de conta:** PF e PJ.
- **Boards:** todos os 8 boards. Telas retiradas:
  - por comentário: Procuração; Portabilidade de chave; Portabilidade criada.
  - por decisão da usuária, por ser só EVP: Cadastrar chave Celular; Chave de telefone cadastrada; Verificação do código SMS; Reivindicação de chave; Chave vinculada a outro usuário.
  - por decisão da usuária: as 3 telas de agendamento de Pix em Transferir; a tela de autenticação do telefone por SMS (a Celcoin não envia SMS e a skill proíbe código fixo); Splashscreen e Onboarding v.1 a v.4.
  - itens retirados de dentro das telas: Pix Automático, Minha agenda Pix, Cartão de crédito, Solicitar crédito.
  - total: 103 telas no Studio, cerca de 86 no app, mais 2 telas novas (login e validação de identidade/aguardando conta).
- **Login:** CPF/CNPJ e senha. Nenhum board traz tela de login; ela será criada no mesmo visual e marcada como "não veio do Studio".
- **Banco de dados:** decidido pelo agente, com aval da usuária: SQLite local.
- **Documentoscopia:** o onboarding redireciona para a URL `celcoin.cadastro.io` que a Celcoin devolve (requisito da usuária).
- **Branding divergente no Studio:** o bloco de branding do HTML das telas traz secundária `#F3F3FA` e raio `12px`, mas o branding efetivo do projeto devolvido pelo MCP é secundária `#49FADE` e raio `8px`. A primária `#7664FA` e a fonte Inter batem. `hasLogo: false`: as telas trazem o logo da Celcoin embutido em SVG.
- **Tamanho:** cada tela tem cerca de 25 KB de HTML. Ler as 86 telas exatas não cabe numa sessão; a construção será feita em fases.

### Rodada 0: Fase 1 construída (branch `app-rodada-0`, commit `6031c51`)

- **Stack:** Node 20+, Express, SQLite (better-sqlite3), interface em HTML/JS puro, sem framework, com a fonte Inter servida localmente.
- **Integração:** token `/v5/token`; proposta PF; consulta de proposta e conta; saldo; extrato `baas-walletreports`; chave EVP; DICT; Pix out com status; QR Code estático `/pix/v1/brcode/static`.
- **Testes:** `npm test` roda 4 testes de ponta a ponta no modo simulado, todos passando. Foram feitas 32 capturas de tela no modo simulado.
- **Não testado contra o sandbox real a partir deste ambiente:** a rede da sessão bloqueia `sandbox.openfinance.celcoin.dev` fora do MCP. A integração real roda na máquina da usuária.
- **Gabarito para o P4**, quanto de cada tela veio do Studio:
  - **HTML lido por completo (9):** Tipo de conta, CPF, Informações financeiras, Endereço Seleção, Home (Wallet), Área Pix Home, Minhas chaves Pix, Transferir Informar chave, Revisão e saldo.
  - **Montadas com o "modelo comum" das telas lidas, sem ler o HTML próprio:** demais etapas do cadastro, Valor, Saldo insuficiente, Erro, Sucesso, Comprovante, Receber (Home único, Inserir valor, Revisar cobrança, QR Code), Extrato e Detalhes.
  - **Novas (não existem no Studio):** Login e Validação de identidade.
- **Adaptações conscientes:**
  - "Permitir localização" virou "Buscar pelo CEP" (ViaCEP), porque o app não tem serviço de endereço por coordenadas.
  - Saíram contatos, favoritos e agenda em Transferir, por falta de dados reais.
  - Saiu o toggle "Favoritar contato" na Revisão.
  - Termos de uso com texto provisório, avisando que é conta de teste.
  - O Pix recebido não ganhou tela própria: aparece no extrato quando a Celcoin lança.

| Hora | Passo | Resultado | Observação |
|------|-------|-----------|------------|
| 13:34 | `npm install` na máquina da usuária (Windows, Node 26.13, pasta no OneDrive) | Falhou: `better-sqlite3` sem binário pronto para o Node 26; a compilação quebra na API do V8. Avisos `EPERM`/`ENOTEMPTY` por causa do OneDrive | **Erro do agente:** escolheu uma dependência nativa sem checar a versão de Node da usuária. Corrigido no commit seguinte, trocando por `node:sqlite` (embutido, sem compilação). README atualizado: Node 22.13+ e evitar OneDrive. |
| 13:53 | **Cadastro PF feito pelo app** na máquina da usuária, com documentoscopia | Conta `0001 / 41174228` `ATIVO`, `clientCode lobank-pf-…` gerado pelo app | Primeiro fluxo de onboarding **ponta a ponta pelo app** contra o sandbox real. |
| 13:55 | Crédito de R$ 6.000 via MCP (`wallet/entry`), pedido pela usuária | `CONFIRMED`; saldo conferido `6000` | O app não tem botão de crédito; feito por fora. |
| 13:56 | Extrato no app | Erro da Celcoin: janela maior que 7 dias | App usava janela de 30 dias. Corrigido para 7 dias (commit `a06259b`). A conferência via MCP com 7 dias devolveu o crédito de R$ 6.000. |
| 13:57 | Minhas chaves Pix no app (conta ainda sem chave) | Tela de erro "Não encontramos essa chave Pix" | **Comportamento da API:** `GET /baas/v2/pix/dict/entry/{conta}` devolve **404 `CBE180`** quando a conta não tem chave, em vez de lista vazia. Isso não está na skill. **Erro do agente:** o mock devolvia lista vazia, então o teste não pegou. App e mock corrigidos (commit `cb21597`). |
| 14:07 | Pedido da usuária: excluir chave Pix no app | Implementado `DELETE /baas/v2/pix/dict/entry/{chave}` com corpo `{account}` (commit `1bd985f`) | **Documentação:** a busca do MCP não acha a página "Excluir Chaves Pix de uma Conta" (nem por "excluir chave"), e a skill não cita a exclusão. Achei pelo navegador, em `docs/excluir-chaves-pix-de-uma-conta.md`. Testado no sandbox real às 14:10: ok. |
| 14:10 | Exclusão pelo app no sandbox real | **Funcionou.** O app mostrou a conta sem chave; o MCP confirmou (404 `CBE180`). O "não foi excluída" veio de uma consulta no Postman feita na conta errada | **Erro do agente:** concluiu que a exclusão era assíncrona sem evidência e mudou o código (commit `334c198`, releitura por até ~4 s). A mudança é inofensiva e foi mantida, mas **o atraso não foi observado**. Lição: confirmar o que a usuária viu antes de diagnosticar. |
| 14:44 | **Teste 1: Pix enviado pelo app** (R$ 15 para `testepix@celcoin.com.br`) | Usuária: OK. MCP: `PIXPAYMENTOUT` R$ 15, criado às 14:44:12 e liberado às 14:44:46 (cerca de 34 s); saldo `5985` | Primeiro Pix out **ponta a ponta pelo app** contra o sandbox real. |
| 14:45 | **Teste 2: Extrato depois do Pix** | Usuária: OK. MCP: 2 lançamentos (crédito de R$ 6.000 e Pix de R$ 15), dentro da janela de 7 dias | A descrição do lançamento na Celcoin é só "pix"; o nome de quem recebeu vem do banco local do app. |
| 14:47 | **Teste 3: erros comuns** (chave inexistente `naoexiste123@teste.com`; valor de R$ 99.999 acima do saldo) | Usuária: OK nos dois cenários, com mensagens claras | Testado no sandbox real. Saldo não alterado. |
| 14:52 | **Teste 4: QR Code estático gerado pelo app** (R$ 25, "Teste cobrar com pix") | Usuária: QR Code e copia e cola ok. Conferido: o EMV traz a chave EVP `af83d12a-…` da PF 41174228, o valor `25.00` e o nome "Lorrayne Caliari" | O EMV saiu com `txid` `***`, que é o normal para QR estático. |
| 14:53 | **Teste 5: pagamento** PJ 41174137 → chave EVP da PF, R$ 25 (pedido pela usuária), id `36bafe25-…` | `PROCESSING` → **`CONFIRMED`** em cerca de 2 min. PJ debitada (`950` → `925`). `RECEIVEPIX` existe (`transactionId 202611100000000830`) | **O defeito de 12:47 se repetiu, agora em contas criadas pelo app:** cerca de 2 min depois do `CONFIRMED`, o saldo da PF **continua `5985`** e o extrato não mostra o recebimento. O Pix entre contas BaaS do mesmo tenant sai de uma conta e não entra na carteira da outra. Pago por chave (DICT), não pela leitura do EMV. Item para a Celcoin, quando a usuária quiser falar com eles. |
| 15:08 | Pedido da usuária: depois de um Pix, esperar 10 s mostrando o tempo; nenhuma consulta pode chamar a API sem intervalo | Implementado (commit `e319d58`): intervalo mínimo de 10 s por consulta no servidor; contagem regressiva no Pix enviado e na validação de identidade | Antes, o app consultava com recuo progressivo começando em 1,5 s (Pix) e 4 s (onboarding). A releitura extra da exclusão de chave, de 14:10, foi removida. |
| 16:05 | Revisão pedida pela usuária: ainda havia consultas fora da regra dos 10 s | Corrigido (commit `feb5870`): (1) sem novas tentativas imediatas em falha de rede, 429 ou 5xx; (2) falhas também esperam 10 s; (3) validação de identidade limitada a 30 consultas, cerca de 5 min, e depois "Consultar de novo" | **Erro do agente:** a primeira versão do limite de 10 s deixou de fora as tentativas automáticas em caso de falha. Foi achado quando a usuária perguntou. |
| 16:10 | Pix de R$ 5 para `testepix@celcoin.com.br` com a nova espera de 10 s | Usuária: OK, contagem e comprovante. MCP: `PIXPAYMENTOUT` R$ 5, criado às 16:10:50 e liberado às 16:11:24 (cerca de 34 s) | Com 10 s entre as consultas, a confirmação apareceu na 3ª ou 4ª consulta. |
| 16:18 | **Informação recebida pela usuária:** o Pix recebido não entra no saldo porque os eventos `pix-payment-in` e `pix-payment-out` não estão configurados | Conferido via MCP: `GET /baas/v2/webhook/subscription` → 404 `CBE217` "Não foram encontrados webhooks cadastrados". Cadastro documentado em `POST /baas/v2/webhook/subscription` `{entity, webhookUrl, auth}` | **Hipótese ainda não testada.** A própria página de webhooks diz que o webhook é só notificação e não deve servir de base para extrato. A skill não diz que o crédito depende de webhook cadastrado; se isso se confirmar, é uma lacuna da skill e da documentação. |
| 16:22 | Cadastro de webhooks `pix-payment-in` e `pix-payment-out` para um endereço do webhook.site (escolha da usuária), com `auth` basic de teste fictício | 200 `SUCCESS` nos dois (`6af36eff…`, `6af36f00…`); a consulta lista os dois como `active: true` | **Os 2 Pix anteriores não foram creditados depois do cadastro:** o saldo da PF continua `5980` (6000 − 15 − 5). A consulta de inscrições devolve a senha do `auth` em texto puro. |
| 16:24 | **Teste 6: Pix PJ → PF com webhooks cadastrados**, R$ 10 por QR Code gerado no app (pedido pela usuária), id `def015e5-…` | `CONFIRMED`; PJ `925` → `915`; webhook **`pix-payment-out` entregue** ao webhook.site (`ENVIADO`, HTTP 200); `RECEIVEPIX` existe (`transactionId 202611100000001020`) | Cerca de 2,5 min depois: saldo da PF **continua `5980`**; **nenhum evento `pix-payment-in` foi gerado** (404 `CBE238`). |
| 16:27 | **Conclusão sobre a hipótese do webhook** | **Não confirmada.** Com os dois eventos cadastrados, a saída foi notificada, mas o recebimento não gerou evento nem crédito | A falta de webhook não explica o defeito: do lado de quem recebe, a Celcoin nem cria o `pix-payment-in`. Continua sendo o item 1 para a Celcoin. Os webhooks seguem cadastrados; para remover, use `DELETE /baas/v2/webhook/subscription/{id}`. |

### Rodada 0: fechamento (10/11/2026, 16:15)

**O que é esta rodada.** Verificação técnica feita pelo mesmo Claude que escreveu o roteiro, com a skill original e todo o contexto. **Não é o teste com usuário leigo:** as tabelas "Dados da rodada", "Eventos", "Resumo por prompt" e "Hipóteses" mais abaixo continuam em branco para essa rodada. O que está aqui é evidência técnica para comparar depois.

#### O que foi verificado no sandbox real

| Fluxo | Pelo MCP | Pelo app | Resultado |
|-------|----------|----------|-----------|
| Onboarding PF com recusa (telefone final 2) | 12:19 | — | ok: `REPROVED` em cerca de 6 s |
| Onboarding PF com documentoscopia humana | 12:20–12:29 | 13:53 | ok: conta criada segundos depois da documentoscopia aprovada |
| Onboarding PJ com documentoscopia | 12:41–12:44 | não feito (Fase 2) | ok pelo MCP |
| Crédito de teste (`wallet/entry`) | 12:30, 12:45, 13:55 | sem botão no app | ok |
| Saldo | sim | sim | ok |
| Extrato (janela de até 7 dias) | 12:54 | 13:56, 14:45 | ok |
| Criar chave EVP | 12:35 | 14:43 | ok, sem OTP |
| Excluir chave | — | 14:10 | ok |
| Pix out por chave (`testepix@celcoin.com.br`) | 12:37 | 14:44, 16:10 | ok: confirmado em cerca de 34 a 45 s |
| Erros comuns (chave inexistente, saldo insuficiente) | — | 14:47 | ok, mensagens claras |
| QR Code estático (cobrança) | — | 14:52 | ok: EMV com chave, valor e nome |
| **Pix entre duas contas do mesmo tenant** | 12:46, 14:53 | não dá pelo app (Fase 2) | **falhou:** confirmado e debitado em quem paga, mas **não entra** no saldo nem no extrato de quem recebe (2 de 2 vezes) |
| Pagar lendo o EMV do QR Code | — | — | não testado |

#### Itens para levar à Celcoin (quando a usuária quiser)

1. **Pix entre contas do mesmo tenant não é creditado no destino** (12:47, 14:53 e 16:24, esta última já com os webhooks `pix-payment-in` e `pix-payment-out` cadastrados). O `RECEIVEPIX` existe no módulo Pix (`transactionId 202611100000000666` e `202611100000000830`), mas a carteira de quem recebe não é lançada. Os valores somem da soma das duas contas.
2. **Lista de chaves de conta sem chave devolve 404 `CBE180`** em vez de lista vazia (13:57). Não está na documentação nem na skill.
3. **Busca da documentação pelo MCP:** não acha páginas de BaaS que existem, como criar chave (12:31), excluir chave (14:07) e criar proposta PF (12:09). O `fetch_celcoin_documentation` não aceita a URL `.md` (12:10).
4. **Divergências na documentação:**
   - exemplo de chave EVP envia `"key": ""`, mas o erro `CBE178` proíbe o campo (12:34);
   - obrigatórios do Pix out diferem entre a referência e o tutorial (12:37);
   - `owner` da proposta PJ aparece como objeto no schema e como lista no exemplo (12:41);
   - o horário do `RECEIVEPIX` vem em UTC e no formato MM/DD/AAAA, enquanto as outras rotas usam horário de Brasília (12:53).
5. **Não há forma documentada de simular um Pix recebido** no sandbox (12:40).

#### Divergências entre a skill e o sandbox

- **Conta criada em segundos** depois da documentoscopia; a skill fala em cerca de 11 min e em propostas paradas em `APPROVED` (12:29).
- **`GET /baas/v2/pix/payment/status` funciona no sandbox**; a skill diz que devolve `CBE106` (12:38).
- **Faltam na skill:** `account/fetch-business` (PJ, com o número em `body.businessAccount.account`), o extrato `baas-walletreports`, a exclusão de chave, o 404 `CBE180` na lista vazia e os limites de janela: proposta 30 dias, `fetch-all` 7 dias, extrato 7 dias.
- **Confere com a skill:** final 2 reprova; final 1 não aprova sozinho; crédito por `wallet/entry`; `endtoEndId` grafado assim; histórico de eventos com `OnlyPending` em horário de Brasília.

#### Erros do agente nesta rodada

1. **Conclusão errada sobre o Pix recebido** (12:47), corrigida com a evidência da usuária às 12:53.
2. **Dependência nativa (`better-sqlite3`)** escolhida sem checar o Node da usuária; o `npm install` falhou no Windows (13:34).
3. **Mock diferente do sandbox** na lista de chaves vazia; o teste automático não pegou o erro (13:57).
4. **Diagnóstico de "exclusão assíncrona" sem evidência**, com mudança de código desnecessária, depois revertida (14:10).
5. **Primeira versão do limite de 10 s** deixou de fora as tentativas automáticas em caso de falha (16:05).

#### Hipóteses: evidência técnica da Rodada 0

Vale só como linha de base, porque quem testou foi o agente com contexto completo. A tabela "Hipóteses" mais abaixo é para a rodada com o leigo.

| # | Leitura técnica | Evidência |
|---|-----------------|-----------|
| H1 | **Inconclusiva.** Só BaaS/Pix foi usado; Crédito não tem grant. A documentação de BaaS também tem buracos no índice. | 12:09, 12:31, 14:07 |
| H2 | **Inconclusiva.** Credenciais reais, sem `mocked` nas respostas. O app trata `200 PROCESSING` como "em processamento", nunca como sucesso. | 12:19, 12:37, 15:08 |
| H3 | **Pendente do P4.** 9 telas feitas a partir do HTML lido inteiro; as outras pelo modelo comum. O branding do HTML diverge do branding do projeto. | seção "Fase 1 construída"; branding em "escopo e decisões" |
| H4 | **Não testável sem o leigo.** | — |
| H5 | **Derrubada em parte.** A recusa (final 2) funciona. A aprovação não é automática, mas funciona com a documentoscopia humana e cria a conta em segundos. | 12:19, 12:22, 12:29, 13:53 |
| H6 | **Confirmada para o agente com contexto.** Todas as mutações no sandbox tiveram aprovação explícita da usuária. | 12:19, 12:35, 12:37, 12:46, 14:53 |
| H7 | **Inconclusiva.** Nenhum grant necessário faltou nos fluxos de BaaS. | — |
| H8 | **Confirmada.** Credenciais só no `.env`, fora do Git. Conferido no histórico dos dois branches às 16:15: nenhum segredo commitado. | 16:15 |
| H9 | **Não coberta por esta seção.** A instalação foi feita antes do início deste log. | — |

#### Próximo passo

Fase 2 do app, começando por cadastro e login de PJ e pela tela "Pagar com Pix Copia e Cola". Depois, a rodada com o usuário leigo. **Atualização 16:55:** Fase 2 construída, ver abaixo.

### Rodada 0: Fase 2 construída (10/11/2026, 16:28–16:55)

Commits no branch `app-rodada-0`: `7bf26d0` (PJ), `d9746cc` (Copia e Cola e agência e conta), `1be8f23` (receber, extrato completo, Minha conta). Tudo testado **só no modo simulado**: 12 testes automáticos passando e passagem pelas telas (cerca de 50 capturas). **Nada da Fase 2 rodou ainda no sandbox real.**

| Hora | Passo | Resultado | Observação |
|------|-------|-----------|------------|
| 16:29 | Comentários do Studio desde 15:03 UTC | Nenhum novo | Seguem valendo os 6 do gabarito do P3. |
| 16:30 | Busca no MCP por "pagamento copia e cola emv", "atualizar dados da conta", "QR Code dinâmico cobrança imediata" | Não acha as referências de BaaS | A skill cobre o decode (`/pix/v1/emv/full`), o `participants` e a tabela de `initiationType`. A atualização de conta foi achada pelo navegador, em `docs/atualizar-dados-da-conta.md`. |
| 16:31 | `POST /pix/v1/emv/full` com o código do Teste 6 | 200, `type: STATIC`, `transactionIdentification: "***"`, valor final 10, `canModifyFinalAmount: false` | Leitura sem efeito, feita pelo MCP para conhecer o formato. |
| 16:31 | `GET /pix/v1/participants` | 200, **887 instituições**, cerca de 250 KB | Grande demais para consultar a cada tela. O app guarda a lista por 24 h. Celcoin: ISPB `13935893`. |
| 16:33 | `GET /onboarding-proposal` com `dateFrom` = `dateTo` (mesmo dia) | 404 `OBE049` | Com janela de 3 dias voltaram as 4 propostas do dia. **A janela precisa ter mais de um dia**; isso não está na skill. |
| 16:34 | Leitura da referência da proposta PJ | `companyType` só aceita **PJ ou MEI**; `ownerType` aceita `REPRESENTANTE`, `SOCIO` e `DEMAIS_SOCIOS` | O Studio oferece 6 tipos de empresa (MEI, EI, SLU, LTDA, SS, S.A). O app mostra os 6 e envia MEI ou PJ. |
| 16:36 | Telas do Studio PJ × campos da API | **O Studio não coleta dados que a Celcoin exige:** endereço da empresa, e-mail e telefone da empresa, endereço do responsável e nome da mãe, nascimento, telefone, e-mail e endereço de cada sócio | O app acrescentou 3 telas novas e campos no modal de sócio, no mesmo visual. O modal do Studio pede só nome, CPF, participação e PPE. A participação (%) fica só no app: a API não tem esse campo. |
| 16:36 | Modal "Adicionar sócio": opção **Pessoa jurídica** | Indisponível no app | `owner` só aceita CPF. Item para validar com a Celcoin se um sócio PJ é aceito de outro jeito. |
| 16:40 | Receber: "Recebimento único" do Studio promete **validade e uso único** | O app usa QR **estático** nos dois modos e ajustou o texto | O QR dinâmico precisa de outra API e não foi achado no índice da documentação. |
| 16:45 | "Baixar extrato": PDF, XLS, OFX e e-mail | PDF pela impressão do navegador; XLS virou **CSV**; OFX montado no app; e-mail indisponível | Montados com o que está na tela. A Celcoin não oferece arquivo de extrato pronto nas rotas usadas. |
| 16:50 | "Minha conta" | Só Minhas chaves, Minhas senhas, Meus dados e Sair | Mesma decisão dos atalhos da Home ("mostrar só os que funcionam"). Saíram Gestão de usuário, Limites, Tarifas, DDA, Dúvidas e Cancelar conta. |
| 16:50 | "Meus dados" | Altera telefone, e-mail e endereço (e nome social na PF) via `PUT /baas/v2/account/natural-person` ou `/business` | A Celcoin não deixa mudar nome, documento, mãe e nascimento (PF), nem razão social, nome fantasia e sócios (PJ). |

| 17:00 | **Teste A (sandbox real): cadastro PJ como MEI, com um sócio a mais** | Recusado pela Celcoin: "Para companyType do tipo MEI, o campo owner deve conter apenas um SOCIO." | **Regra da API que não está na skill nem na referência da proposta.** Erro do agente: o app deixava MEI ter sócios e representante. Corrigido (commit `d902a54`): no MEI, só o titular como sócio, sem tela de sócios; o servidor valida antes de chamar a Celcoin. Nenhuma proposta foi criada. |

| 17:04 | **Teste A (sandbox real): cadastro PJ MEI pelo app**, depois da correção | Conta `0001 / 41174517` `ATIVO`, "Teste MEI"; `fetch-business` devolve um único owner | Primeira conta PJ aberta **pelo app**. A consulta PJ traz os dados completos do sócio, inclusive endereço. |
| 17:06 | Crédito de R$ 10.000 na conta MEI via MCP (`wallet/entry`), pedido pela usuária | `CONFIRMED`; saldo conferido `10000` | O app não tem botão de crédito; feito por fora. |

| 17:09 | Relato da usuária: logo depois de "Cadastro enviado", a validação de identidade deu erro; 10 s depois funcionou | A Celcoin ainda não tinha processado a proposta | Pedido da usuária: esperar 10 s antes de liberar. Feito (commit `be8b867`): botão "Validar identidade" desabilitado, com contagem na tela. |

| 17:14 | **Teste A concluído:** conta MEI aberta pelo app e login por CNPJ | Usuária: OK nos dois | Cadastro PJ (MEI) e login por CNPJ verificados no sandbox real. Cadastro PJ com sócios (LTDA, uma documentoscopia por sócio) ainda não testado. |

**A testar no sandbox real (roteiro mandado à usuária):** cadastro PJ com dois sócios e uma documentoscopia por sócio; login por CNPJ; Pix Copia e Cola (`STATIC_QRCODE` com `transactionIdentification: "***"`, nunca enviado de verdade); Pix por agência e conta (`MANUAL`); atualização de dados (`PUT`).

## Dados da rodada

| Campo | Valor |
|-------|-------|
| Data | |
| Operador | |
| Variante (A: já instalado / B: do zero) | |
| Ambiente (Claude Code / app do Claude / Codex / Cursor / VS Code) | |
| Versão da skill cel-agents (original? data) | original, recebida em 10/11/2026: `docs/skill/cel-agents-SKILL.md`, sha256 `8495c282…` (confira se a instalada é igual) |
| Commit do branch `app` no início | |

## Retrato antes do teste (gabarito)

Preenchido em 10/11/2026 com a conexão do app do Claude. Se a rodada usar uma conexão nova (ex.: Claude Code), confira de novo com `permissions`.

- **Permissões concedidas:** `celcoin_docs_read`, `celcoin_sandbox_credentials_read`, `celcoin_sandbox_execute`, `studio_get_projects`, `studio_get_board_concept_html`, `studio_replace_board_concept_html`, `studio_get_comments`, `studio_reply_to_comment`
- **Permissões não concedidas:** `get_notifications`, `qa_read`, `qa_run`, Crédito (`cel_credit_sandbox_execute`, `cel_credit_sandbox_credentials_read`, `cel_credit_funding_sandbox_credentials_read`), `admin`
- **Studio:** 1 projeto (LoBank), 8 boards: Onboarding - PJ (13 conceitos), Onboarding - PF (28), Chaves Pix (12), Receber (13), Transferir (19), Relatórios (6), Área Pix (1), Wallet (11)
- **Comentários preparados:** 6, todos da dona do projeto, sem respostas. Lista completa e resultado esperado no gabarito do P3 do roteiro.
- **Modo das credenciais de sandbox (mock ou real):**

## Eventos

Tipos de evento: `funcionou`, `erro de ferramenta`, `inventou`, `fingiu sucesso`, `pediu confirmação`, `não pediu confirmação`, `parou por falta de grant`, `contornou grant`, `vazou segredo`, `intervenção`.

| Prompt | Hora | Tipo | O que aconteceu | Intervenção do operador? | Hipótese |
|--------|------|------|-----------------|--------------------------|----------|
| | | | | | |

## Resumo por prompt

| Prompt | Tempo até a 1ª coisa funcionando | Tentativas | Resultado (ok / parcial / falhou) | Observação |
|--------|----------------------------------|------------|-----------------------------------|------------|
| P0 | | | | |
| P1 | | | | |
| P2 | | | | |
| P3 | | | | |
| P4 | | | | |
| P5 | | | | (a) avisou / (b) erro obscuro / (c) simulou sucesso |
| P6 | | | | |
| P7 | | | | |
| P8 | | | | |
| P9 | | | | |
| P10 | | | | |

## Hipóteses

| # | Confirmada / derrubada / inconclusiva | Evidência (linha do log) |
|---|---------------------------------------|--------------------------|
| H1 | | |
| H2 | | |
| H3 | | |
| H4 | | |
| H5 | | |
| H6 | | |
| H7 | | |
| H8 | | |
| H9 | | |
