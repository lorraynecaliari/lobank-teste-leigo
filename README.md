# LoBank — app (Fase 1, Rodada 0)

App de conta digital **PF** sobre o BaaS da Celcoin, **somente sandbox**. Construído a partir das telas do projeto LoBank no Studio e dos comentários deixados nelas.

## Como abrir

Pré-requisito: Node.js 22.13 ou mais novo (o app usa o SQLite embutido no Node; não precisa compilar nada).

> **Windows:** não coloque o projeto dentro do OneDrive. A sincronização trava os arquivos da `node_modules` e o `npm install` falha com `EPERM`. Use uma pasta como `C:\dev\lobank`.

```bash
npm install
cp .env.example .env      # preencha CELCOIN_CLIENT_ID e CELCOIN_CLIENT_SECRET (sandbox)
npm start
```

Abra **http://localhost:3000** no navegador. As telas foram desenhadas para celular (360×800); no computador elas aparecem numa moldura desse tamanho.

> Nunca cole as credenciais no chat nem faça commit do `.env`.

### Modo simulado (sem Celcoin)

Para mexer nas telas sem credenciais: `CELCOIN_MODE=mock npm start`. Todas as telas mostram a faixa **MODO SIMULADO** e nada fala com a Celcoin. Nesse modo há botões extras para simular a documentoscopia aprovada e um crédito de saldo.

### Testes automatizados

`npm test` roda o fluxo completo do backend no modo simulado.

## O que a Fase 1 faz

| Fluxo | Telas | Integração Celcoin |
|---|---|---|
| Login com CPF/CNPJ e senha | Login (**nova**: não existe no Studio) | Própria do app; a Celcoin não autentica o usuário final |
| Abertura de conta PF | Tipo de conta, Termos, CPF, Nome (e nome social), Nascimento, Mãe, Financeiras, Profissão, PPE, E-mail, Celular, Endereço (CEP ou manual), Senha, Confirmar senha, Senha de transferência, Sucesso | `POST /onboarding/v1/onboarding-proposal/natural-person` |
| Validação de identidade | Validação (**nova**) | Redireciona para a URL de documentoscopia devolvida pela Celcoin e acompanha a proposta até `RESOURCE_CREATED` |
| Saldo | Home | `GET /baas/v2/wallet/balance` |
| Chave Pix aleatória | Área Pix, Minhas chaves | `POST /baas/v2/pix/dict/entry` (sem `key`) e conferência por `GET` |
| Enviar Pix por chave | Informar chave (com erro), Valor, Revisão, Senha, Saldo insuficiente, Erro, Em processamento/Sucesso, Comprovante | DICT `GET /baas/v2/pix/dict/entry/external/{conta}`, `POST /baas/v2/pix/payment`, status `GET /baas/v2/pix/payment/status` |
| Cobrar com Pix | Receber, Revisar cobrança, QR Code | `POST /pix/v1/brcode/static` com a chave aleatória |
| Extrato | Extrato, Detalhes, Comprovante | `GET /baas-walletreports/v1/wallet/movement` |

**Fora desta fase:** conta PJ, transferência por agência e conta, receber "múltiplos", relatórios e filtros, Minha conta.

**Retirado por decisão ou comentário no Studio:** procuração, portabilidade, reivindicação, chaves CPF/celular/e-mail, verificação por SMS, agendamento de Pix, Pix Automático, Minha agenda Pix, cartão e crédito, splash e onboarding v.1–v.4.

## Regras seguidas

- **Sem sessão, sem acesso; sem conta, sem dinheiro.** Rotas de dinheiro respondem `409 NO_ACCOUNT` enquanto a conta não existe, e nunca há conta padrão.
- **`200 PROCESSING` não é sucesso.** A tela de confirmação mostra "em processamento" e consulta o desfecho com recuo progressivo.
- **Saldo é checado antes do Pix**, porque a Celcoin aceita o pedido mesmo sem saldo e só recusa depois.
- **Chave DICT de uso único:** o `endToEndId` não é reaproveitado. Os dados do recebedor vão para o `creditParty` exatamente como o DICT devolveu, inclusive mascarados.
- **Mutação ambígua não é reenviada:** se a conexão cair no envio do Pix, o app guarda o `clientCode` e mostra "confirmando com a Celcoin".
- **Senhas com scrypt**, sessão em cookie `httpOnly`, bloqueio após 5 erros de login e senha de transferência separada.
- **O app se recusa a iniciar apontando para produção.**

## Limitações conhecidas

- **Webhook:** rodando em `localhost`, a Celcoin não consegue chamar o app. O desfecho do Pix vem pela consulta de status.
- **Pix recebido:** no sandbox, em 10/11/2026, um Pix recebido apareceu na consulta de recebimentos, mas **não** no saldo nem no extrato da conta. O app mostra o que o extrato da Celcoin devolve.
- **Fonte Inter:** servida localmente (`@fontsource/inter`), porque a URL de fonte do Studio só funciona dentro do Studio.
