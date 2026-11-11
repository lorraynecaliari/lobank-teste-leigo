# lobank-teste-leigo

Teste de usabilidade do `cel_agents` (Celcoin) com a persona "usuário leigo", usando o projeto **LoBank** do Studio.

> Este repositório deve ser **privado**. Ele guarda logs de teste e, no branch `app`, o código gerado pela IA.

## Estrutura

| Branch | Para quem | Conteúdo |
|--------|-----------|----------|
| `main` | Operador | Este README, `docs/roteiro-teste-usuario-leigo.md`, `docs/friction-log.md`, `docs/resumo-rodada-0.md` (resumo da verificação técnica) e `docs/plano-pagamento-de-contas.md`, `docs/telas.md` (print de todas as telas), `docs/telas/Evidencias de telas.md` (origem no Studio, alteração e motivo de cada tela) |
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

## Como abrir e testar o app

O app só existe depois que a IA testada o constrói (P3), no branch `app`. Durante a rodada, **não ensine a IA a abrir o app** (regra 2). Se ela não explicar, pergunte como leigo ("como eu vejo isso funcionando?") e registre o atrito. Os passos abaixo servem para você testar por conta própria depois.

### Pré-requisitos no seu computador

- Git.
- As ferramentas da linguagem que a IA escolheu. Provavelmente Node.js; confira o arquivo de dependências na pasta (ex.: `package.json`).

### Onde o app roda

- **Claude Code no seu computador (recomendado):** o app já está na pasta de teste. Siga "Abrir o app".
- **Sessão na nuvem (app do Claude):** o `localhost` da nuvem não abre no seu navegador. Peça à IA para fazer commit e push no branch `app`, clone no seu computador (comando em "Antes de cada rodada") e siga "Abrir o app".

### Abrir o app

1. Entre na pasta de teste: `cd lobank-teste-leigo`
2. Crie o `.env` com as credenciais de **sandbox** (Client ID e Secret), usando os nomes de variáveis que a IA definiu. Se houver um `.env.example`, copie: `cp .env.example .env`. Pegue os valores no painel da Celcoin e nunca os cole no chat nem faça commit.
3. Instale as dependências e inicie com os comandos que a IA usou. Num projeto Node, normalmente:

   ```bash
   npm install
   npm run dev
   ```

4. Abra no navegador o endereço que aparecer no terminal (ex.: `http://localhost:3000`).
5. Para parar: `Ctrl+C` no terminal. Para abrir de novo depois, repita os passos 3 e 4.

### Dados de teste do sandbox (segundo a skill cel-agents)

| O que testar | Como |
|---|---|
| Conta recusada | Cadastro com telefone terminando em **2**. Deve recusar em segundos. |
| Conta aprovada | Telefone terminando em **1**. Hoje tende a ficar parada em análise (`PENDING_DOCUMENTSCOPY`). |
| Colocar saldo | Não há botão no app, a menos que a IA crie. É feito pelo crédito do sandbox (`POST /baas/v2/wallet/entry/{conta}`). |
| Enviar Pix que chega | Chave `testepix@celcoin.com.br` |
| Enviar Pix que volta (estorno) | CPF `77517432125` ou `testecelbaas@celcoin.com.br` |
| Não usar | Chaves de exemplo da documentação (ex.: `teste@celcoin.com.br`). Elas dão bloqueio por fraude (`CPD0013`). |

### O que é normal e o que é defeito

- Em `localhost`, a Celcoin não consegue avisar o app (webhook). Um Pix pode ficar alguns segundos como "em processamento" até o app consultar o resultado. Se ficar assim para sempre, registre como defeito.
- "Em processamento" nunca deve aparecer como "concluído".
- Se o app mostrar sucesso sem você conseguir confirmar no sandbox (saldo, extrato), registre como possível sucesso simulado (H4).

## Depois da rodada

1. Na pasta de teste, confira se nenhum segredo foi parar em arquivo versionado:

   ```bash
   git status
   git log -p | grep -iE "secret|client_id|token" || echo "nada encontrado"
   ```

2. Faça commit e push do que a IA construiu no branch `app`. Se for repetir o teste, use um branch novo por rodada (ex.: `app-rodada-2`, criado a partir do commit inicial do `app`).
3. Faça commit do `docs/friction-log.md` preenchido no `main`.
