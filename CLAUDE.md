# Regras do projeto LoBank (branch app-rodada-0)

- **Catálogo de telas:** toda tela nova ou alterada entra em `tools/telas/capturar.py` (um `shot(...)` no fluxo do módulo) e o catálogo é gerado de novo, respeitando a regra da versão final abaixo:
  `python3 tools/telas/capturar.py ../lobank-teste-leigo/docs`, depois commit de `docs/telas/` na branch `main` (resumo em `docs/telas/telas.md`).
  O fim de `docs/telas/telas.md` lista as rotas sem print e os erros de captura: os dois precisam ficar vazios.
- **Evidências de telas:** o mesmo script gera `docs/telas/Evidencias de telas.md` (por pasta: print, origem no Studio, o que mudou e o motivo). Toda tela nova ou alterada precisa de entrada em `tools/telas/evidencias.py` (`ALTERACOES`, e `FORA_DO_APP` se uma tela do Studio ficar de fora). O script lista no fim as telas sem texto: precisa sair vazio. Cada tela leva no `data-studio` o id da tela do Studio de origem, ou `novo:`.
- **Só depois da versão final:** uma tela nova ou alterada só entra (ou é atualizada) no catálogo e nas evidências **depois que a usuária confirmar que chegamos na versão final daquela tela**. Até lá, a tela pode ser construída e testada, mas `capturar.py` não é rodado para o repositório `main` nem `evidencias.py` ganha o texto dela. Como o script recaptura todas as telas, se houver outra tela ainda sem confirmação, perguntar antes de gerar o catálogo.
- Segredos (Client ID/Secret) nunca vão para o repositório nem para logs: só `.env`.
- Sandbox apenas, nunca produção. Confirmar com a usuária antes de qualquer escrita no sandbox ou no Studio.
