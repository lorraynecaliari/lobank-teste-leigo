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

## Dados da rodada

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
