# Regras do projeto LoBank (branch main: documentação)

- **Catálogo de telas:** `docs/telas.md` e `docs/telas/` mostram todas as telas do app. Quando uma tela for incluída ou alterada na branch `app-rodada-0`, rode `python3 tools/telas/capturar.py ../lobank-teste-leigo/docs` no app e faça o commit do catálogo aqui no mesmo trabalho. As seções "Rotas sem print" e "Erros na captura" precisam ficar vazias.
- **Evidências de telas:** `docs/telas/Evidencias de telas.md` é gerado junto e diz, para cada tela, a origem no Studio, o que foi alterado e o motivo. Atualizar sempre que uma tela entrar ou mudar (textos em `tools/telas/evidencias.py` no app).
- Registrar no `docs/friction-log.md` cada teste e cada correção, com horário.
- Segredos nunca vão para o repositório, o log ou documentos. Sandbox apenas.
