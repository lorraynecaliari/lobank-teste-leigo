# Regras do projeto LoBank (branch main: documentação)

- **Catálogo de telas:** `docs/telas/telas.md` (resumo) e `docs/telas/Evidencias de telas.md` (detalhamento) mostram todas as telas do app. Quando uma tela for incluída ou alterada na branch `app-rodada-0`, rode `python3 tools/telas/capturar.py ../lobank-teste-leigo/docs` no app e faça o commit do catálogo aqui. As seções "Rotas sem print" e "Erros na captura" precisam ficar vazias.
- **Evidências de telas:** `docs/telas/Evidencias de telas.md` é gerado junto e diz, para cada tela, a origem no Studio, o que foi alterado e o motivo. Atualizar sempre que uma tela entrar ou mudar (textos em `tools/telas/evidencias.py` no app).
- **Só depois da versão final:** registrar uma tela nova, ou atualizar uma que já existe, no catálogo e nas evidências **somente depois que a usuária confirmar que chegamos na versão final daquela tela**. Antes disso, nada dessa tela entra em `docs/telas/`.
- Registrar no `docs/testes/friction-log.md` cada teste e cada correção, com horário.
- Segredos nunca vão para o repositório, o log ou documentos. Sandbox apenas.
