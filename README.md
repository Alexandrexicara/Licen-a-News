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
