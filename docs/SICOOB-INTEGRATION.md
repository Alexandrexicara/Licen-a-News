# Integração Sicoob Pix — Licença News

## Implementado nesta branch

- Cliente HTTP do Sicoob com OAuth 2.0 Client Credentials, certificado mTLS PFX e cache de token conforme expires_in.
- API Pix Recebimentos: criação e consulta de cobrança imediata (PUT/GET /cob/{txid}).
- Cadastro de chave Pix do publicador com criptografia AES-256-GCM no PostgreSQL.
- Registro de webhook Pix por chave.
- Recepção idempotente por estado do pedido, conferência do TXID e do valor recebido, atualização do pedido para pago e emissão automática da licença com trilha de auditoria.
- A cobrança é bloqueada por padrão: SICOOB_ENABLE_CHARGES=false.

## Endpoints internos

- GET /api/v1/sicoob/status — estado da configuração (JWT).
- PUT /api/v1/sicoob/me/pix-key — cadastrar/atualizar chave Pix do titular (JWT).
- POST /api/v1/sicoob/me/webhook — registrar URL de webhook da chave Pix no Sicoob (JWT).
- POST /api/v1/sicoob/orders/:id/charge — criar cobrança para pedido aceito (JWT).
- GET /api/v1/sicoob/orders/:id/charge — consultar cobrança do pedido (JWT).
- POST /api/v1/webhooks/sicoob/:token — receber notificações do Sicoob.

## Endpoints oficiais Sicoob Pix

- OAuth: https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token
- API Pix v2: https://api.sicoob.com.br/pix/api/v2
- Cobrança imediata: PUT /cob/{txid}; consulta: GET /cob/{txid}
- Webhook por chave Pix: PUT /webhook/{chave}

A integração usa TLS 1.2+, OAuth 2.0 Client Credentials, mTLS com certificado X.509 e header client_id. O Sicoob exige canal mTLS também nas notificações de webhook. Consulte o Portal Developers para os escopos e parâmetros liberados para a aplicação específica.

## Variáveis de ambiente no Render

```env
SICOOB_ENVIRONMENT=production
SICOOB_AUTH_URL=https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token
SICOOB_API_BASE_URL=https://api.sicoob.com.br/pix/api/v2
SICOOB_CLIENT_ID=
SICOOB_CLIENT_SECRET=
SICOOB_MTLS_PFX_BASE64=
SICOOB_MTLS_PFX_PASSWORD=
SICOOB_SCOPES=cob.read cob.write pix.read webhook.write webhook.read
SICOOB_ENCRYPTION_KEY=
SICOOB_PIX_EXPIRATION_SECONDS=3600
SICOOB_WEBHOOK_TOKEN=
SICOOB_ENABLE_CHARGES=false
PUBLIC_API_URL=https://licenca-news-api.onrender.com
```

- SICOOB_MTLS_PFX_BASE64: conteúdo Base64 do PFX da aplicação.
- SICOOB_ENCRYPTION_KEY: segredo aleatório forte e exclusivo para criptografar as chaves Pix dos publicadores.
- SICOOB_WEBHOOK_TOKEN: segredo aleatório longo usado no caminho da URL de callback.
- Não commitar segredos, PFX ou senhas no GitHub.

## Banco de dados

Aplicar `database/migrations/0003_sicoob_pix.sql` depois das migrations 0001 e 0002. A migration 0001 já foi aplicada no Neon existente; a 0002 estava pendente conforme o README anterior. Confirmar o histórico do Neon antes de aplicar qualquer migration, e aplicar 0002 antes de 0003.

## Importante sobre o modelo de recebimento

A cobrança Pix só pode ser emitida para uma chave Pix que o Sicoob aceite na conta vinculada ao aplicativo/certificado usado na API. Uma chave Pix de outro banco ou de outra titularidade pode ser recusada. Se cada jornalista/veículo receber diretamente em sua própria conta Sicoob, cada recebedor poderá precisar de sua própria aplicação/credenciais/certificado e autorização; uma única credencial da plataforma não deve ser presumida como autorização para cobrar em contas de terceiros.

Pix Recebimentos não faz split nem Pix Out. Esta implementação não transfere valores para jornalistas nem cobra comissão da plataforma. Ela cria cobrança Pix e, após confirmação válida, atualiza o pedido e emite a licença. A titularidade da chave e o fluxo jurídico/comercial de pagamento devem ser confirmados antes de habilitar cobranças.

## Requisitos para produção

1. Aplicar migrations 0002 e 0003, verificando primeiro o estado real do Neon.
2. Configurar credenciais e certificado no Render.
3. Configurar uma camada de entrada que valide mTLS nos callbacks Sicoob antes de encaminhar ao Render. O token aleatório na URL é uma defesa adicional, não substitui mTLS.
4. Confirmar escopos, webhook, chave Pix e autorização do aplicativo no Portal Developers.
5. Testar criação, consulta, pagamento real controlado, webhook duplicado, valor divergente e emissão única da licença.
6. Somente então alterar SICOOB_ENABLE_CHARGES para true.
