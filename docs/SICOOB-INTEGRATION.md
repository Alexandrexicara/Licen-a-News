# Sicoob Pix por publicador — Licença News

## Modelo de conexão

Cada jornalista, jornal, editora ou influenciador conecta a própria conta Sicoob no painel Minha área. O Licença News não usa uma única credencial da plataforma para acessar contas de terceiros.

1. O publicador precisa ter conta Sicoob ativa e ser cooperado para solicitar o aplicativo de produção, conforme as regras do banco.
2. Faz cadastro no Portal Developers Sicoob como Pessoa Física ou Jurídica.
3. Cria um aplicativo com Pix Recebimentos e obtém Client ID, Client Secret e certificado PFX/P12 aceito pelo banco.
4. Informa essas credenciais e sua chave Pix no painel Licença News.
5. O backend valida o token OAuth/mTLS e armazena cada credencial cifrada por usuário no PostgreSQL.

Portal: https://developers.sicoob.com.br/portal/cadastro

O portal disponibiliza cadastro PF/PJ. O guia do Sicoob de julho de 2024 informa que o aplicativo PF fica ativo após a criação; o aplicativo PJ pode ficar pendente até autorização dos responsáveis. O titular precisa ter conta Sicoob e certificado ICP-Brasil correspondente (e-CPF para PF ou e-CNPJ para PJ, conforme aceitação do banco). Confirme com a cooperativa os escopos Pix Recebimentos e os requisitos de produção.

## Como a confirmação automática funciona

- O comprador solicita uma licença e o publicador aprova.
- O Licença News cria uma cobrança Pix dinâmica (Cob) com TXID único usando as credenciais do próprio publicador e a chave Pix dele.
- O dinheiro é recebido diretamente na conta Sicoob do publicador. A plataforma não recebe, guarda ou repassa valores.
- O backend consulta periodicamente o endpoint oficial de Pix recebidos `GET /pix` da conta conectada (janela móvel de 24 horas, a cada 60 segundos).
- A API procura o TXID exato, confere o valor e o E2E ID, marca o pedido como pago e emite a licença uma única vez.
- O painel do publicador atualiza os pedidos periodicamente e mostra a confirmação do Pix.

A API Pix do Sicoob documenta `GET /pix` para consultar a relação de Pix recebidos e conciliar pagamentos; também disponibiliza webhook por chave. A consulta periódica é o mecanismo principal de confirmação nesta implementação, evitando depender do callback de entrada para a conciliação. Fonte: Manual Sicoob Pix, seção Gerenciamento de Pix Recebidos: https://www.sicoob.com.br/documents/61112012/64877374/Sicoob%2BPix%2B%E2%80%93%2BManual%2Bpara%2Butiliza%C3%A7%C3%A3o%2Bda%2BAPI%2BPix.pdf

## Segurança

- Credenciais, segredo e PFX são criptografados com AES-256-GCM usando `SICOOB_ENCRYPTION_KEY`.
- Nunca enviar credenciais ou certificados ao GitHub nem armazená-los no frontend.
- O certificado é enviado uma vez por HTTPS ao backend e fica cifrado no banco.
- Cada cobrança usa a chave Pix e as credenciais do próprio publicador.
- O TXID é único; a confirmação verifica recebedor, TXID, valor e E2E ID.
- A emissão de licença é protegida por transação e restrição única por pedido.

## Rotas

- GET `/api/v1/sicoob/me` — status da conexão.
- POST `/api/v1/sicoob/me` — validar e conectar credenciais próprias.
- DELETE `/api/v1/sicoob/me` — desconectar.
- POST `/api/v1/sicoob/orders/:id/charge` — criar cobrança na conta do publicador.
- GET `/api/v1/sicoob/orders/:id/charge` — consultar cobrança.
- POST `/api/v1/webhooks/sicoob/:userId/:token` — callback complementar.

## Configuração e pendências

- Aplicar migration `0004_sicoob_per_publisher.sql` depois de 0001, 0002 e 0003.
- Configurar `SICOOB_ENCRYPTION_KEY` (mínimo 24 caracteres aleatórios) e `PUBLIC_API_URL` no Render.
- Manter `SICOOB_ENABLE_CHARGES=false` até homologar com uma conta real e verificar o formato do certificado PF/PJ, escopos, GET /pix, cobrança dinâmica e conciliação.
- O polling consulta os últimos 24h a cada 60 segundos. Antes de escalar para muitos publicadores, implementar cursor persistente e paginação completa, além de controle de concorrência distribuído.
- Nenhuma migration foi aplicada no Neon e nenhum deploy ou pagamento real foi executado por esta alteração.
