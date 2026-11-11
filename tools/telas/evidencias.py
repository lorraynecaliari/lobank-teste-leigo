"""Dados do documento "Evidencias de telas.md": de onde cada tela veio no Studio, o que mudou e por quê.

Fontes: boards do Studio do projeto LoBank (lidos pelo MCP cel_agents em 11/11/2026), comentários
da usuária no Studio e as decisões registradas em docs/friction-log.md.

Ao incluir ou alterar uma tela: acrescente a entrada em ALTERACOES (chave: pasta e título do shot) e,
se a tela do Studio foi deixada de fora, em FORA_DO_APP.
"""

# Telas do Studio por id (8 primeiros caracteres): (board, título no Studio)
STUDIO = {
    # Onboarding - PF
    'f5b2ed63': ('Onboarding - PF', 'Splashscreen'), '125fefda': ('Onboarding - PF', 'Onboarding v.1'),
    '92fc57f5': ('Onboarding - PF', 'Onboarding v.2'), '96e789f9': ('Onboarding - PF', 'Onboarding v.3'),
    'e622e12c': ('Onboarding - PF', 'Onboarding v.4'), 'b5afc529': ('Onboarding - PF', 'Cadastro | Tipo de conta'),
    '29b9c98a': ('Onboarding - PF', 'Cadastro | Termos de uso'), '8c68c085': ('Onboarding - PF', 'Cadastro | CPF | Empty'),
    '4ce68921': ('Onboarding - PF', 'Cadastro | Nome Completo'), '9ce47319': ('Onboarding - PF', 'Cadastro | Nome Completo | Nome Social'),
    'e4896803': ('Onboarding - PF', 'Cadastro | Data de Nascimento'), '32f1dda4': ('Onboarding - PF', 'Cadastro | Nome da mãe'),
    '6c59f729': ('Onboarding - PF', 'Cadastro | Informações Financeiras'), 'e6d262a4': ('Onboarding - PF', 'Cadastro | Profissão'),
    'd2d983a6': ('Onboarding - PF', 'Cadastro | PPE'), '14f9c591': ('Onboarding - PF', 'Cadastro | E-mail'),
    '88f00de4': ('Onboarding - PF', 'Cadastro | Telefone'), 'e4f1f437': ('Onboarding - PF', 'Cadastro | Telefone | Autenticação'),
    '8ad720e3': ('Onboarding - PF', 'Cadastro | Endereço | Seleção'), '5e8d2cef': ('Onboarding - PF', 'Cadastro | Endereço | Confirmação'),
    '21fce59c': ('Onboarding - PF', 'Cadastro | Endereço | Complete o endereço'),
    'aa4e8aab': ('Onboarding - PF', 'Cadastro | Endereço | Preencher endereço manualmente'),
    '8258942a': ('Onboarding - PF', 'Cadastro | Endereço | Encontre seu CEP'),
    'a2602f33': ('Onboarding - PF', 'Cadastro | Endereço | Encontre seu CEP | Selecione seu endereço'),
    '152226d7': ('Onboarding - PF', 'Cadastro | Criar senha'), 'abe9e59d': ('Onboarding - PF', 'Cadastro | Confirmar senha'),
    'c0c0f928': ('Onboarding - PF', 'Cadastro | Criar senha transferência'), '6095742f': ('Onboarding - PF', 'Cadastro | Sucesso'),
    # Onboarding - PJ
    '73a7bfd2': ('Onboarding - PJ', 'Tipo de conta'), 'c1ad4ca7': ('Onboarding - PJ', 'Tipo de empresa'),
    '2562ee5b': ('Onboarding - PJ', 'CNPJ'), 'b0dac0a4': ('Onboarding - PJ', 'CNPJ | Modal | Por que o CNPJ'),
    '3ae92d6a': ('Onboarding - PJ', 'Razão social'), '0acf6c9a': ('Onboarding - PJ', 'Nome da empresa'),
    '3e11977a': ('Onboarding - PJ', 'Faturamento'), '728d5ec6': ('Onboarding - PJ', 'Quem está preenchendo'),
    '277d3802': ('Onboarding - PJ', 'Seus dados'), 'a631c7eb': ('Onboarding - PJ', 'Adicionar sócios'),
    '0f726f1e': ('Onboarding - PJ', 'Modal | Adicionar sócio'), '31bef6d3': ('Onboarding - PJ', 'Procuração'),
    '58d0ae68': ('Onboarding - PJ', 'Termos de uso'),
    # Chaves Pix
    'd2539788': ('Chaves Pix', 'Chave de telefone cadastrada'), '7d55908c': ('Chaves Pix', 'Verificação do código SMS'),
    '0f284a3b': ('Chaves Pix', 'Cadastrar chave Celular'), 'cc1d6094': ('Chaves Pix', 'Chave aleatória cadastrada'),
    'aa9efe84': ('Chaves Pix', 'Chave vinculada a outro usuário'), '9a00faf8': ('Chaves Pix', 'Confirmação de criação de chave (v.1)'),
    '508e7b00': ('Chaves Pix', 'Confirmação de criação de chave (v.2)'), '0ca32d33': ('Chaves Pix', 'Chave não cadastrada'),
    '7be5f818': ('Chaves Pix', 'Minhas chaves Pix'), '2486800e': ('Chaves Pix', 'Portabilidade de chave'),
    '894ea412': ('Chaves Pix', 'Portabilidade criada'), '47ad8c5f': ('Chaves Pix', 'Reivindicação de chave'),
    # Receber
    'c3a90386': ('Receber', 'Home | Único'), 'ec14cb1b': ('Receber', 'Home | Múltiplos'),
    '29121fb6': ('Receber', 'Único | Inserir valor'), 'a982a6e1': ('Receber', 'Único | Revisar cobrança'),
    '58fb0fdd': ('Receber', 'Único | Revisar cobrança | Editar | Descrição'),
    '0402a8fc': ('Receber', 'Único | Revisar cobrança | Editar | CPF / CNPJ'),
    'aeebab09': ('Receber', 'Único | Revisar cobrança | Editar | Nome do pagador'),
    '0a001283': ('Receber', 'Único | QR Code estático'), 'acceba30': ('Receber', 'Múltiplos | Inserir valor'),
    'a5984aa8': ('Receber', 'Múltiplos | Revisar cobrança | Com Valor'), '4013d617': ('Receber', 'Múltiplos | Revisar cobrança | Sem Valor'),
    '8416a740': ('Receber', 'Múltiplos | QR Code estático | Sem Valor'), '576af395': ('Receber', 'Múltiplos | QR Code estático | Com Valor'),
    # Transferir
    '5196768b': ('Transferir', 'Chave Pix | Informar chave'), '02f83ffc': ('Transferir', 'Chave Pix | Valor da transferência'),
    '1eacb221': ('Transferir', 'Chave Pix | Modal | Erro na transação'), '14c51fac': ('Transferir', 'Agência e conta | Selecionar banco'),
    '59759b3d': ('Transferir', 'Agência e conta | Dados da conta destino | Novo | Outra conta'),
    '21e4f9bf': ('Transferir', 'Agência e conta | Dados da conta destino | Novo | Minha conta'),
    'ef13b03b': ('Transferir', 'Agência e conta | Dados da conta destino | Favoritos'),
    '340b345d': ('Transferir', 'Agência e conta | Valor da transferência'), 'cf9dcbd7': ('Transferir', 'Agência e conta | Confirmação da operação'),
    'b14ad19f': ('Transferir', 'Chave Pix | Informar chave | Erro'), '2b4b209e': ('Transferir', 'Chave Pix | Informar chave | Preenchido'),
    '733b240c': ('Transferir', 'Chave Pix | Revisão e saldo'), 'a49d2b21': ('Transferir', 'Chave Pix | Saldo insuficiente'),
    '81a5edd9': ('Transferir', 'Chave Pix | Agendar data'), '3dfd07a8': ('Transferir', 'Chave Pix | Agendar data | Selecionado'),
    'a4bbf9fd': ('Transferir', 'Chave Pix | Revisão e saldo | Agendamento'), 'caca6a53': ('Transferir', 'Chave Pix | Sucesso'),
    '2ea377b0': ('Transferir', 'Chave Pix | Sucesso | Visualizar comprovante'), '6570ae3c': ('Transferir', 'Tipo de conta do destinatário'),
    # Relatórios
    '13e383e5': ('Relatórios', 'Extrato completo'), 'f1da7b30': ('Relatórios', 'Modal | Baixar Extrato'),
    '77833a7b': ('Relatórios', 'Filtrar relatório | Estado inicial'), '92b424a3': ('Relatórios', 'Filtrar relatório | Outro Período | Selecionar período'),
    'e620afcc': ('Relatórios', 'Extrato completo | Filtros aplicados'), '8c4474c1': ('Relatórios', 'Filtrar relatório'),
    # Área Pix
    '08689cca': ('Área Pix', 'Home'),
    # Wallet
    '82e58028': ('Wallet', 'Home'), '2d3d03ce': ('Wallet', 'Minha conta'), 'd5ea723e': ('Wallet', 'Minha conta | Editar dados'),
    '7c2160b2': ('Wallet', 'Extrato'), 'd63ba699': ('Wallet', 'Extrato | Filtrar extrato'), '5fa7806f': ('Wallet', 'Extrato | Filtrar | Modal | Período'),
    '8d31755d': ('Wallet', 'Extrato | Filtrar | Modal | Período personalizado'), '50e1845b': ('Wallet', 'Extrato | Filtrar | Modal | Tipo de transação'),
    '8480a338': ('Wallet', 'Extrato | Filtrar | Modal | Categoria'), '9fc2cf9b': ('Wallet', 'Extrato | Detalhes da transação'),
    'ddce4015': ('Wallet', 'Extrato | Comprovante de pagamento'),
    # Pagamento de Contas
    'e742f777': ('Pagamento de Contas', 'Formas de Pagamento'), '38cf65a5': ('Pagamento de Contas', 'Digitar código manualmente'),
    'f3aec588': ('Pagamento de Contas', 'Leitor de Códigos | Horizontal'), '22c1b6ba': ('Pagamento de Contas', 'Leitor de códigos | Vertical'),
    '677ed32f': ('Pagamento de Contas', 'Conta de pagamento'), 'f9d7afdc': ('Pagamento de Contas', 'Informar valor e data de pagamento'),
    'deb4ee82': ('Pagamento de Contas', 'Confirmar Valor'), '94e36ffe': ('Pagamento de Contas', 'Confirmar Valor | Agendamento'),
    '96d29742': ('Pagamento de Contas', 'Pagamento concluído'), '034d1958': ('Pagamento de Contas', 'Pagamento agendado'),
    '5b258936': ('Pagamento de Contas', 'Falha no pagamento'), 'b4e95469': ('Pagamento de Contas', 'Comprovante de pagamento | Pagamento pendente'),
    'b548a175': ('Pagamento de Contas', 'Comprovante de pagamento | Pagamento agendado'), '26e3d931': ('Pagamento de Contas', 'Comprovante de pagamento'),
}

# Comentários da usuária no Studio (citados nos motivos)
C_PROCURACAO = 'comentário no Studio: "Essa tela não deve ser criada no app"'
C_EVP = 'comentário no Studio: "Quero oferecer somente chave Aleatoria EVP dessa forma não é necessario validação OTP"'
C_PORT = 'comentário no Studio: "Como terá somente chave EVP não é necessario desenvolver o fluxo de portabilidade"'
C_AREA = 'comentário no Studio: "Retirar Pix Automatico e minha agenda pix"'
C_HOME = 'comentário no Studio: "Não deve ter a parte de cartão de credito nem solicitar um credito"'
C_LEITOR = 'comentário no Studio: "Não deve essa função"'
C_CONTA = 'comentário no Studio: "Celcoin somente tem conta pagamento"'

MODELO = ('Montada com o modelo comum das telas do Studio (mesma estrutura, componentes e textos de apoio); o HTML próprio desta tela não foi lido.',
          'Cada tela do Studio tem cerca de 25 KB de HTML e não cabia ler todas na sessão: só 9 telas-base foram lidas por inteiro e as outras seguiram o modelo delas.')
IGUAL = ('Sem mudança de conteúdo: segue o HTML do Studio, que foi lido por inteiro.', '—')

# (pasta, título do shot) -> (o que mudou em relação ao Studio, motivo)
ALTERACOES = {
    # ---------------- acesso
    ('acesso', 'Login'): ('Tela nova, no mesmo visual (entrada com CPF ou CNPJ e senha).', 'Nenhum board do Studio traz tela de login, e o app precisa de uma para a pessoa voltar à conta.'),
    ('acesso', 'Tipo de conta'): ('Ganhou a opção "Conta empresarial", que leva ao cadastro PJ.', 'A Fase 2 incluiu abertura de conta PJ (MEI e LTDA).'),
    ('acesso', 'Termos'): ('Texto próprio do app, avisando que é conta de teste no sandbox.', 'Os termos do Studio são um modelo; não há termos jurídicos reais para uma conta de teste.'),
    ('acesso', 'CPF'): IGUAL,
    ('acesso', 'Nome completo'): MODELO,
    ('acesso', 'Data de nascimento'): MODELO,
    ('acesso', 'Nome da mãe'): MODELO,
    ('acesso', 'Dados financeiros'): IGUAL,
    ('acesso', 'Dados financeiros: escolher renda'): ('Modal de escolha da faixa de renda, no padrão de modal do Studio.', 'A tela do Studio mostra o campo; a lista de faixas precisava de um seletor.'),
    ('acesso', 'Profissão'): MODELO,
    ('acesso', 'Pessoa politicamente exposta'): MODELO,
    ('acesso', 'E-mail'): MODELO,
    ('acesso', 'Celular'): ('Igual ao modelo, mas **sem** a etapa seguinte de código por SMS.', 'A Celcoin não envia SMS no sandbox e a skill proíbe usar código fixo; decisão da usuária na Rodada 0.'),
    ('acesso', 'Endereço: buscar ou digitar'): ('"Permitir localização" virou "Buscar pelo CEP"; a opção "Digitar manualmente" continua.', 'O app não tem serviço de endereço por coordenadas; o CEP é consultado no ViaCEP.'),
    ('acesso', 'Endereço: CEP encontrado'): ('Junta "Encontre seu CEP" e "Confirmação" numa tela só.', 'Com o CEP, o endereço já aparece; a etapa de confirmação separada ficou redundante.'),
    ('acesso', 'Endereço: número e complemento'): MODELO,
    ('acesso', 'Endereço manual'): MODELO,
    ('acesso', 'Senha de acesso'): MODELO,
    ('acesso', 'Confirmar senha'): MODELO,
    ('acesso', 'Senha de transferência'): MODELO,
    ('acesso', 'Cadastro enviado (espera de 10 s)'): ('Base no "Sucesso" do Studio, com contagem de 10 s antes de liberar "Validar identidade".', 'No teste, a validação deu erro logo depois da proposta porque a Celcoin ainda não tinha processado; pedido da usuária.'),
    ('acesso', 'Validação de identidade'): ('Tela nova: leva ao link de documentoscopia (celcoin.cadastro.io) e acompanha o status da proposta.', 'O Studio não tem a etapa de validação; a Celcoin exige a documentoscopia para abrir a conta.'),
    # ---------------- pj
    ('pj', 'Tipo de conta PJ'): ('Mesma tela do cadastro PF, com "Conta empresarial" marcada.', 'O app usa uma tela de tipo de conta para os dois fluxos.'),
    ('pj', 'Termos PJ'): ('Texto próprio do app, como no PF.', 'Conta de teste no sandbox.'),
    ('pj', 'Tipo de empresa'): ('Mostra os 6 tipos do Studio, mas envia à Celcoin só MEI ou PJ.', 'A API de proposta PJ só aceita `companyType` PJ ou MEI.'),
    ('pj', 'CNPJ'): MODELO,
    ('pj', 'Por que pedimos o CNPJ'): MODELO,
    ('pj', 'Razão social'): MODELO,
    ('pj', 'Nome fantasia'): MODELO,
    ('pj', 'Faturamento'): MODELO,
    ('pj', 'Contato da empresa'): ('Tela nova, no mesmo visual (e-mail e telefone da empresa).', 'O Studio não coleta esses dados e a Celcoin exige.'),
    ('pj', 'Endereço da empresa'): ('Tela nova, no mesmo visual, com busca por CEP.', 'O Studio não coleta o endereço da empresa e a Celcoin exige.'),
    ('pj', 'Quem está abrindo a conta'): ('No MEI só aparece "Sou sócio".', 'A Celcoin recusa MEI com mais de um sócio ou com representante ("o campo owner deve conter apenas um SOCIO").'),
    ('pj', 'Seus dados (responsável)'): ('Acrescentou nome da mãe, nascimento, telefone e e-mail.', 'Campos exigidos pela Celcoin para cada pessoa da proposta.'),
    ('pj', 'Seu endereço'): ('Tela nova, no mesmo visual.', 'A Celcoin exige o endereço do responsável e o Studio não pede.'),
    ('pj', 'Sócios (vazio)'): MODELO,
    ('pj', 'Adicionar sócio PF'): ('O modal ganhou nascimento, mãe, telefone, e-mail e endereço; a participação (%) fica só no app.', 'A Celcoin exige esses dados de cada sócio e não tem campo de participação.'),
    ('pj', 'Adicionar sócio PJ'): ('A opção existe, mas avisa que sócio pessoa jurídica não pode ser cadastrado.', 'O `owner` da proposta só aceita CPF; item para validar com a Celcoin.'),
    ('pj', 'Sócios (lista)'): MODELO,
    ('pj', 'Cadastro PJ enviado'): ('Igual ao PF, com a espera de 10 s.', 'Mesmo motivo do PF.'),
    ('pj', 'Validação: link do responsável'): ('Mostra um link de documentoscopia só para o primeiro responsável.', 'No teste da LTDA com 2 sócios, a Celcoin gerou um único link, do primeiro owner.'),
    ('pj', 'Tipo de empresa: MEI'): ('Escolhendo MEI, o fluxo pula a tela de sócios.', 'Regra da Celcoin para MEI (um único sócio, o titular).'),
    # ---------------- home
    ('home', 'Home sem saldo'): ('Sem cartão de crédito, "Solicitar crédito" e atalhos que não funcionam; atalhos reorganizados.', C_HOME + '; e a regra "mostrar só o que funciona".'),
    ('home', 'Home'): ('Atalhos: Fazer Pix, Cobrar com Pix, Minhas chaves, Pagar contas e Extrato.', 'Mesma regra; "Pagar contas" entrou com o módulo de boleto.'),
    ('home', 'Fazer Pix: escolher forma'): ('Modal novo com chave, Copia e Cola e agência e conta.', 'Pedido da usuária: "Fazer Pix" só oferecia chave.'),
    ('home', 'Menu'): ('Menu da conta com "Minha conta" e "Sair" (e crédito simulado só no modo simulado).', 'Acesso aos dados da conta sem sair da Home.'),
    ('home', 'Minha conta'): ('Só Minhas chaves, Minhas senhas, Meus dados e Sair.', 'Saíram Gestão de usuário, Limites, Tarifas, DDA, Dúvidas e Cancelar conta: não há API usada para eles.'),
    ('home', 'Meus dados'): ('Só telefone, e-mail, endereço (e nome social na PF) podem ser alterados.', 'A Celcoin não deixa mudar nome, documento, mãe e nascimento (PF), nem razão social, nome fantasia e sócios (PJ).'),
    ('home', 'Minhas senhas'): ('Tela nova, no visual do Minha conta.', 'O item existe no Minha conta do Studio, mas a tela não.'),
    # ---------------- pix
    ('pix', 'Área Pix'): ('Sem Pix Automático e Minha agenda Pix; ganhou Copia e Cola e agência e conta.', C_AREA + '.'),
    ('pix', 'Minhas chaves (vazio)'): ('Só chave aleatória (EVP).', C_EVP + '.'),
    ('pix', 'Criar chave aleatória'): ('Confirmação simples, sem código OTP.', C_EVP + '.'),
    ('pix', 'Minhas chaves'): ('Ganhou o botão de excluir chave.', 'Pedido da usuária durante os testes.'),
    ('pix', 'Chave não encontrada'): IGUAL,
    ('pix', 'Chave do destinatário'): IGUAL,
    ('pix', 'Valor do Pix'): MODELO,
    ('pix', 'Revisão do Pix'): ('Sem agendamento e sem "Favoritar contato".', 'Agendamento retirado por decisão da usuária; favoritos sem dados reais.'),
    ('pix', 'Senha de transferência'): MODELO,
    ('pix', 'Pix: consultando em 10 s'): ('Estado novo de "em processamento" com contagem de 10 s.', 'O pagamento volta `PROCESSING`; a usuária pediu esperar 10 s com o tempo na tela antes de consultar.'),
    ('pix', 'Pix enviado'): MODELO,
    ('pix', 'Comprovante Pix'): ('Ganhou "Voltar ao início" abaixo de "Copiar comprovante".', 'Pedido da usuária.'),
    ('pix', 'Pix: saldo insuficiente'): MODELO,
    # ---------------- copia
    ('copia', 'Copia e Cola'): ('Tela nova, no modelo de "Informar chave".', 'O Studio não tem tela de pagar com Pix Copia e Cola.'),
    ('copia', 'Copia e Cola: código inválido'): ('Estado de erro no modelo de "Informar chave | Erro".', 'Mensagem simples quando o código não é um Pix válido.'),
    ('copia', 'Revisão com valor do QR Code'): ('Valor travado quando o QR Code já traz valor.', 'O QR Code estático com valor não permite mudar o valor.'),
    ('copia', 'Agência e conta: banco'): MODELO,
    ('copia', 'Agência e conta: buscar banco'): ('Lista com as 887 instituições do Pix, guardada por 24 h.', 'A lista vem de `GET /pix/v1/participants` e é grande demais para buscar a cada tela.'),
    ('copia', 'Agência e conta: dados (vazio)'): ('Sem a aba "Favoritos".', 'Não há dados reais de favoritos.'),
    ('copia', 'Agência e conta: dados'): ('Sem a aba "Favoritos".', 'Não há dados reais de favoritos.'),
    ('copia', 'Agência e conta: minha conta'): MODELO,
    ('copia', 'Agência e conta: tipo de conta'): MODELO,
    ('copia', 'Agência e conta: revisão'): ('Usa a revisão do Pix no lugar da "Confirmação da operação".', 'A transferência por agência e conta é um Pix manual na Celcoin; uma revisão única para os dois.'),
    ('copia', 'Comprovante por agência e conta'): ('Mesmo comprovante do Pix, com banco, agência e conta.', 'Mesmo motivo da revisão.'),
    # ---------------- receber
    ('receber', 'Receber: único ou múltiplos'): ('Texto do "Único" ajustado: não promete validade nem uso único.', 'O app gera QR Code estático nos dois modos; o dinâmico precisa de outra API, não encontrada na documentação.'),
    ('receber', 'Receber: valor'): MODELO,
    ('receber', 'Receber: revisar cobrança'): ('Só a descrição é editável; saíram CPF/CNPJ e nome do pagador.', 'O QR Code estático não carrega dados do pagador.'),
    ('receber', 'Receber: QR Code'): MODELO,
    ('receber', 'Receber múltiplos: valor'): MODELO,
    ('receber', 'Receber múltiplos: sem valor fixo'): IGUAL,
    # ---------------- extrato
    ('extrato', 'Extrato vazio'): ('Estado vazio novo.', 'O Studio não mostra o extrato sem lançamentos.'),
    ('extrato', 'Extrato'): ('Busca, filtros e download dos boards Relatórios e Wallet numa tela só; situação vinda do extrato detalhado (power-movement).', 'Dois boards desenhavam o mesmo extrato; o detalhado mostra Concluído/Em processamento em vez de "Saldo Bloqueado".'),
    ('extrato', 'Filtros'): ('Período limitado a 7 dias.', 'A Celcoin recusa consultas de extrato com mais de 7 dias.'),
    ('extrato', 'Filtros: período personalizado'): ('Datas de até 7 dias, com aviso.', 'Mesmo limite da Celcoin.'),
    ('extrato', 'Extrato filtrado'): MODELO,
    ('extrato', 'Baixar extrato'): ('PDF pela impressão do navegador, CSV no lugar de XLS, OFX montado no app; sem e-mail.', 'A Celcoin não oferece arquivo de extrato pronto nas rotas usadas.'),
    ('extrato', 'Extrato com diferença de saldo'): ('Linha nova "Diferença de saldo".', 'No sandbox, boletos recusados tiraram R$ 1.309,95 do saldo sem lançamento no extrato detalhado; o app mostra a diferença em vez de esconder.'),
    ('extrato', 'Detalhe da diferença de saldo'): ('Detalhe da transação do Studio aplicado à diferença de saldo.', 'Explica de quanto para quanto o saldo foi.'),
    # ---------------- boleto
    ('boleto', 'Formas de pagamento'): ('Só "Digitar código" e "Pix Copia e Cola"; dica para leitor USB ou bluetooth.', 'Leitores por câmera: ' + C_LEITOR + '; "Abrir PDF" retirado por decisão da usuária.'),
    ('boleto', 'Digitar código (incompleto)'): ('Contador de números e formatação da linha; aceita o código de 44 números do leitor.', 'Ajuda quem digita e quem usa leitor de código de barras.'),
    ('boleto', 'Código inválido'): ('Mensagem simples no campo.', 'A Celcoin devolve o erro 822.'),
    ('boleto', 'Dados incompletos do banco emissor'): ('Estado novo: não deixa pagar.', 'No sandbox, uma consulta veio sem os dados do boleto e o pagamento acabou recusado com o valor debitado.'),
    ('boleto', 'Confirmar valor: boleto vencido'): ('Aviso de vencido com multa e juros.', 'O valor a pagar é o atualizado pelo banco emissor (`totalUpdated`).'),
    ('boleto', 'Confirmar valor: ver mais'): ('"Ver mais" mostra valor original, desconto, multa, juros e "Pagar com" a conta de pagamento.', 'A tela "Conta de pagamento" saiu: ' + C_CONTA + '.'),
    ('boleto', 'Informar valor: fora do intervalo'): ('Sem a data de pagamento; só aparece quando o boleto deixa mudar o valor.', 'Agendamento retirado por decisão da usuária; o valor só muda quando a Celcoin permite.'),
    ('boleto', 'Confirmar valor'): IGUAL,
    ('boleto', 'Senha de transferência'): ('Mesmo modal de senha do Pix.', 'O Studio não desenha a senha do boleto.'),
    ('boleto', 'Pagamento em processamento'): ('Estado novo com contagem de 10 s.', 'O pagamento volta `PROCESSING`; mesma regra de consulta do Pix.'),
    ('boleto', 'Pagamento concluído'): MODELO,
    ('boleto', 'Comprovante do boleto'): ('Traz o recibo oficial da Celcoin (protocolo, autenticação, convênio); sem "Abrir PDF".', 'O recibo vem do evento billpayment; "Abrir PDF" retirado por decisão da usuária.'),
    ('boleto', 'Falha no pagamento com valor debitado'): ('Avisa quando o valor ficou debitado e esconde "Tentar de novo".', 'No sandbox, dois pagamentos recusados continuaram debitados; o app não pode dizer que nada foi debitado.'),
    ('boleto', 'Comprovante: pagamento não concluído'): ('Estado de falha do comprovante, novo.', 'Mesmo motivo.'),
    ('boleto', 'Saldo insuficiente'): ('Usa a tela de saldo insuficiente do Pix.', 'O Studio não desenha esse caso no boleto.'),
}

# Telas do Studio que não entraram no app, por pasta: (id, motivo)
FORA_DO_APP = {
    'acesso': [('f5b2ed63', 'Decisão da usuária na Rodada 0.'), ('125fefda', 'Decisão da usuária na Rodada 0.'),
               ('92fc57f5', 'Decisão da usuária na Rodada 0.'), ('96e789f9', 'Decisão da usuária na Rodada 0.'),
               ('e622e12c', 'Decisão da usuária na Rodada 0.'),
               ('e4f1f437', 'A Celcoin não envia SMS no sandbox e a skill proíbe código fixo; decisão da usuária.'),
               ('5e8d2cef', 'Juntada com "Encontre seu CEP".'), ('a2602f33', 'O ViaCEP devolve um endereço por CEP; não há lista para escolher.')],
    'pj': [('31bef6d3', C_PROCURACAO + '.')],
    'pix': [('d2539788', 'Só chave aleatória: ' + C_EVP + '.'), ('7d55908c', 'Sem OTP: ' + C_EVP + '.'),
            ('0f284a3b', 'Só chave aleatória.'), ('aa9efe84', 'Só chave aleatória, que não pode estar com outro usuário.'),
            ('9a00faf8', 'Ficou a v.2 da confirmação.'), ('2486800e', C_PORT + '.'), ('894ea412', C_PORT + '.'),
            ('47ad8c5f', 'Só chave aleatória: não há reivindicação.'),
            ('1eacb221', 'O erro aparece na tela de resultado, não em modal.'),
            ('81a5edd9', 'Agendamento retirado por decisão da usuária.'), ('3dfd07a8', 'Agendamento retirado por decisão da usuária.'),
            ('a4bbf9fd', 'Agendamento retirado por decisão da usuária.')],
    'copia': [('ef13b03b', 'Sem dados reais de favoritos.'), ('340b345d', 'Usa a mesma tela de valor do Pix.'),
              ('cf9dcbd7', 'Usa a revisão do Pix.')],
    'receber': [('0402a8fc', 'O QR Code estático não carrega dados do pagador.'), ('aeebab09', 'O QR Code estático não carrega dados do pagador.')],
    'extrato': [('ddce4015', 'O comprovante abre pelo módulo de origem (Pix ou boleto).')],
    'boleto': [('f3aec588', C_LEITOR + '.'), ('22c1b6ba', C_LEITOR + '.'), ('677ed32f', C_CONTA + '.'),
               ('94e36ffe', 'Agendamento retirado por decisão da usuária.'), ('034d1958', 'Agendamento retirado por decisão da usuária.'),
               ('b548a175', 'Agendamento retirado por decisão da usuária.')],
}
