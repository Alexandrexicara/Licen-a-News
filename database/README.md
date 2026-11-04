# Neon PostgreSQL

- Projeto Neon: `licenca-news`
- Região: `aws-sa-east-1` (São Paulo)
- Banco: `licenca_news`
- Branch: `main`
- PostgreSQL: 18

## Connection

Configure `DATABASE_URL` como variável secreta no serviço de backend do Render. Não coloque a URL de conexão no frontend nem no GitHub.

Para as requisições normais do backend, use a URL pooled do Neon (hostname contendo `-pooler`). Para executar migrações, use a URL direta, sem `-pooler`.

## Schema

A migração `migrations/0001_initial_schema.sql` documenta o esquema inicial já criado no Neon. Ela deve ser usada apenas ao provisionar um banco novo. Não execute sobre o banco existente.
