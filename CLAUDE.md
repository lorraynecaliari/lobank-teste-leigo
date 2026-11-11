# Regras do projeto LoBank (branch app-rodada-0)

- **Catálogo de telas:** toda tela nova ou alterada entra em `tools/telas/capturar.py` (um `shot(...)` no fluxo do módulo) e o catálogo é gerado de novo no mesmo trabalho:
  `python3 tools/telas/capturar.py ../lobank-teste-leigo/docs`, depois commit de `docs/telas.md` e `docs/telas/` na branch `main`.
  O fim de `docs/telas.md` lista as rotas sem print e os erros de captura: os dois precisam ficar vazios.
- Segredos (Client ID/Secret) nunca vão para o repositório nem para logs: só `.env`.
- Sandbox apenas, nunca produção. Confirmar com a usuária antes de qualquer escrita no sandbox ou no Studio.
