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
