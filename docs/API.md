# Licença News — API v1

Base local: `http://localhost:4000`. A API usa JSON e, quando indicado, token JWT no cabeçalho `Authorization: Bearer <token>`.

## Estado atual

- Autenticação por e-mail e senha: implementada.
- Catálogo e envio de conteúdo: implementados.
- Ofertas de licenciamento: implementadas.
- Revisão administrativa: endpoints implementados; ainda falta o procedimento seguro de criação do primeiro administrador.
- Verificação pública de licença: implementada.
- Pagamento direto entre comprador e publicador: fluxo de solicitação e aprovação implementado; cobrança automática Sicoob permanece bloqueada até homologação.
- Login Google/GitHub e armazenamento de mídia: ainda não implementados.
- Chaves de API: geração implementada; autenticação de chamadas usando essas chaves ainda não implementada.

## Saúde e informações

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health` | Público |
| GET | `/api/v1/info` | Público |

## Autenticação e perfil

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/v1/auth/register` | Público |
| POST | `/api/v1/auth/login` | Público |
| GET | `/api/v1/me` | JWT |
| PATCH | `/api/v1/me/profile` | JWT |

Exemplo de cadastro:

```json
{
  "name": "Nome do titular",
  "email": "titular@exemplo.com",
  "password": "senha-com-pelo-menos-10",
  "accountType": "journalist",
  "organizationName": "",
  "websiteUrl": "",
  "contactPhone": ""
}
```

Valores aceitos em `accountType`: `journalist`, `publisher`, `influencer`, `buyer`, `both`.

## Conteúdo

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/v1/content?q=&type=&limit=` | Público; somente aprovados |
| POST | `/api/v1/content` | JWT |
| GET | `/api/v1/content/mine` | JWT |
| POST | `/api/v1/content/:id/offers` | JWT; titular e conteúdo aprovado |

Tipos: `article`, `photo`, `video`, `audio`.

## Ofertas e licenças

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/v1/offers` | Público |
| POST | `/api/v1/licenses/request` | JWT; cria solicitação de licença |
| GET | `/api/v1/licenses/verify/:code` | Público |

Finalidades aceitas para uma oferta: `indexing`, `summary`, `snippet`, `reproduction`, `ai_training`.

## Administração e desenvolvedores

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/v1/admin/content` | JWT com papel admin |
| PATCH | `/api/v1/admin/content/:id` | JWT com papel admin |
| POST | `/api/v1/developer/api-keys` | JWT |

Status editoriais aceitos: `approved`, `rejected`, `suspended`, `pending_review`.

## Configuração

Copie `backend/.env.example` para `.env` local e configure `DATABASE_URL`, `JWT_SECRET` (segredo aleatório forte com pelo menos 32 caracteres), `NODE_ENV`, `PORT` e `CORS_ORIGIN`. Nunca versione o arquivo `.env`.

Migrações: em banco novo, execute 0001 e depois 0002. No Neon já provisionado, 0001 já existe; aplicar somente 0002 uma única vez antes de iniciar a API.

## Verificações obrigatórias antes de produção

1. Aplicar 0002 no banco Neon.
2. Configurar segredos fora do GitHub.
3. Testar cadastro, login, perfil, catálogo, conteúdo, ofertas e revisão editorial com banco de teste.
4. Criar o primeiro administrador por procedimento operacional restrito, sem endpoint público de promoção.
5. Implementar autenticação por API key, upload seguro e fluxo do provedor de pagamento escolhido.
6. Validar política de privacidade, termos, titularidade, direitos autorais e regras de repasse.

## Sicoob Pix por publicador (preparado; cobrança bloqueada até homologação)

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/v1/sicoob/me` | JWT do publicador |
| POST | `/api/v1/sicoob/me` | JWT; conecta Client ID, Client Secret, PFX/P12 e chave Pix próprios |
| DELETE | `/api/v1/sicoob/me` | JWT; desconecta |
| POST | `/api/v1/sicoob/orders/:id/charge` | JWT do comprador; pedido aceito |
| GET | `/api/v1/sicoob/orders/:id/charge` | JWT de comprador ou publicador |
| POST | `/api/v1/webhooks/sicoob/:userId/:token` | Callback complementar |

Cada publicador conecta sua própria conta Sicoob e suas próprias credenciais. O backend consulta `GET /pix` a cada 60 segundos, identifica o TXID do pedido, confere valor e E2E ID, marca como pago e emite a licença. O dinheiro é recebido diretamente pelo publicador; a plataforma não recebe nem repassa valores.

O endpoint de cobrança retorna 503 enquanto `SICOOB_ENABLE_CHARGES` não for `true`. Consulte [SICOOB-INTEGRATION.md](./SICOOB-INTEGRATION.md). A migration `0004_sicoob_per_publisher.sql` precisa ser aplicada após 0003.
