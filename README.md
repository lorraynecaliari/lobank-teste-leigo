# lobank-teste-leigo

Teste de usabilidade do `cel_agents` (Celcoin) com a persona "usuário leigo", usando o projeto **LoBank** do Studio.

> Este repositório deve ser **privado**. Ele guarda logs de teste e, no branch `app`, o código gerado pela IA.

## Estrutura

| Branch | Para quem | Conteúdo |
|--------|-----------|----------|
| `main` | Operador | Este README, `docs/roteiro-teste-usuario-leigo.md` e `docs/friction-log.md` |
| `app` | IA testada | Só o `.gitignore`. É onde a IA constrói o app durante o teste |

Os dois branches não compartilham histórico (o `app` é órfão). A IA testada nunca pode ver o `main`: o roteiro diz o que se espera dela, e isso contamina o teste.

## Antes de cada rodada

1. Leia `docs/roteiro-teste-usuario-leigo.md` e preencha a seção "Retrato antes do teste" do `docs/friction-log.md`.
2. Crie a pasta de teste clonando **só** o branch `app`:

   ```bash
   git clone --branch app --single-branch git@github.com:lorraynecaliari/lobank-teste-leigo.git lobank-teste-leigo
   cd lobank-teste-leigo
   git log --oneline   # deve mostrar só o commit inicial do app
   git branch -a       # não deve listar o main
   ```

   O nome da pasta é igual ao do repositório, porque o P8 avalia como a IA identifica o projeto.

3. Coloque as credenciais de sandbox num `.env` nessa pasta, se a variante exigir. O `.gitignore` já impede o commit. Nunca cole os valores no chat.
4. Abra uma sessão nova da IA **dentro dessa pasta** e confira a conexão (regra 6 do roteiro).

## Durante a rodada

- Rode os prompts na ordem, copiados sem edição.
- Registre cada evento no `docs/friction-log.md` do `main`, num clone separado do operador. Não registre na pasta de teste.

## Depois da rodada

1. Na pasta de teste, confira se nenhum segredo foi parar em arquivo versionado:

   ```bash
   git status
   git log -p | grep -iE "secret|client_id|token" || echo "nada encontrado"
   ```

2. Faça commit e push do que a IA construiu no branch `app`. Se for repetir o teste, use um branch novo por rodada (ex.: `app-rodada-2`, criado a partir do commit inicial do `app`).
3. Faça commit do `docs/friction-log.md` preenchido no `main`.
