# Licença News

Marketplace de licenciamento de conteúdo jornalístico e de criadores.

## Modelo do produto

- Dois públicos: quem publica conteúdo (jornalistas, jornais, editoras e influenciadores) e quem licencia (empresas, veículos e plataformas de IA).
- Conteúdos: artigos, fotografias, vídeos e áudio.
- Fluxo editorial: envio, análise/moderação e publicação no catálogo.
- Licenciamento: ofertas por finalidade, território, prazo, exclusividade e condições.
- Licenças emitidas com código verificável e trilha de auditoria.
- API para pesquisa e verificação de licenças.
- Painel administrativo para moderação, usuários e auditoria.

## Arquitetura de hospedagem definida

- **Frontend:** Netlify (site estático/SPA).
- **Backend:** Render (API Node.js).
- **Banco:** Neon PostgreSQL, projeto `licenca-news`, região São Paulo, banco `licenca_news`, branch `main`.
- **Pagamentos:** fora do escopo desta etapa. Nenhum gateway deve ser ativado até a escolha do provedor e do fluxo jurídico/financeiro.

## Banco de dados

O esquema inicial criado no Neon está versionado em:

`database/migrations/0001_initial_schema.sql`

Tabelas incluídas: perfis de publicadores, contas de pagamento preparatórias, conteúdos, ofertas, pedidos, licenças emitidas, eventos de webhook, credenciais de API, livro-razão e auditoria.

A migração é para provisionar um banco novo. O banco Neon já criado não deve receber essa migração novamente.

## Segurança e configuração

- Nunca commitar `.env`, senhas, tokens ou chaves.
- A API deve ler `DATABASE_URL` somente no backend do Render.
- Usar conexão Neon com pooler para tráfego da aplicação; conexão direta apenas para migrações.
- CORS deve permitir somente o domínio de produção do frontend e os previews necessários.
- Uploads devem usar armazenamento de objetos; não gravar arquivos no disco efêmero do serviço Render.
- O gateway de pagamento ficará desativado até decisão posterior.

## Estado da transferência

Este repositório foi preparado para receber a aplicação migrada. A transferência do código da aplicação existente e a implementação do deploy serão feitas preservando as funcionalidades já construídas, após liberar o acesso de leitura/edição ao projeto de origem.


## Estrutura atual do repositório

```text
backend/
  package.json
  .env.example
  src/
    db.js
    auth.js
    server.js
frontend/
  index.html
  styles.css
  app.js
database/
  README.md
  migrations/
    0001_initial_schema.sql
    0002_app_users.sql
netlify.toml
render.yaml
```

## Funcionalidades iniciais no código

- Página institucional responsiva e catálogo público.
- Cadastro e login com senha armazenada por hash bcrypt.
- Token JWT para sessões autenticadas.
- Perfil do usuário.
- Envio e listagem dos próprios conteúdos.
- Catálogo público somente com conteúdo aprovado.
- Criação de ofertas para conteúdos aprovados.
- Área administrativa por endpoints protegidos para revisão editorial.
- Endpoint de verificação de licença.
- Geração de chave de API com armazenamento somente do hash.
- Endpoint de solicitação de licença intencionalmente bloqueado enquanto pagamentos não forem definidos.

## Migrações

Aplicar em banco novo nesta ordem:

1. `database/migrations/0001_initial_schema.sql`
2. `database/migrations/0002_app_users.sql`

O Neon existente já contém a migração inicial (0001). A migração 0002 ainda precisa ser aplicada no Neon quando a etapa de banco for retomada.

## Desenvolvimento local

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Configure `DATABASE_URL`, `JWT_SECRET` e `CORS_ORIGIN` no arquivo local `.env`. Nunca envie esse arquivo ao GitHub.

Frontend: servir a pasta `frontend` com um servidor estático local. O proxy de produção em `netlify.toml` encaminhará `/api/*` ao serviço Render após substituir o endereço de exemplo pelo endereço real da API.

## Limitações conhecidas desta etapa

- O código original do protótipo Floot ainda não foi importado; esta é a implementação inicial versionada diretamente neste repositório.
- A integração de autenticação externa Google/GitHub não está implementada nesta primeira versão.
- Upload de mídia precisa de serviço de armazenamento de objetos antes da produção.
- Revisão editorial usa endpoints administrativos; a criação inicial do primeiro administrador deve ser feita por procedimento seguro no banco.
- Nenhuma cobrança, split ou transferência Pix está habilitada.
- Não declarar produção pronta antes de aplicar a migração 0002, configurar segredos, executar testes automatizados e validar os fluxos completos.


## Documentação adicional

- [Rotas e contratos da API](docs/API.md)
- [Controle da importação do protótipo original](docs/IMPORT_STATUS.md)
