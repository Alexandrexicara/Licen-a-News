# Transferência do protótipo original

## Origem localizada

Projeto Floot: **Licença News** (projeto identificado no workspace conectado). A leitura do código-fonte foi limitada pelo teto diário de ações da conta em 04/11/2026. Foram lidos e identificados arquivos de páginas, componentes, helpers e endpoints; a cópia integral ainda não foi realizada.

## O que já foi identificado na origem

- Interface React/TypeScript com navegação, painel e autenticação.
- Perfil de titular e comprador com verificação.
- Cadastro de artigos, fotografias, vídeos e áudios com declaração/evidência de direitos.
- Catálogo de ofertas com finalidade, preço, território, prazo e exclusividade.
- Solicitação e consulta de licenças.
- Verificação pública de licença.
- Chaves e integração de API.
- Auditoria e revisão administrativa.
- Fluxo de checkout Stripe no protótipo original.

## Regra de preservação

A importação deve manter os recursos e a estrutura originais sempre que compatíveis com a arquitetura final. Não substituir o projeto original por uma demonstração simplificada. Comparar os arquivos do protótipo com os arquivos existentes neste repositório e migrar em lotes, sem sobrescrever melhorias sem revisão.

**Pagamentos:** o fluxo Stripe encontrado na origem não deve ser ativado nem conectado. O usuário ainda vai informar qual provedor será utilizado e confirmou que a plataforma não deve receber diretamente os pagamentos. Manter cobrança e emissão automática desativadas até definição do fluxo de repasse aos titulares.

## Trabalho já feito diretamente no GitHub

- Repositório criado com frontend estático inicial e API Express/PostgreSQL.
- Autenticação local com senha bcrypt e JWT.
- Cadastro agora grava usuário e perfil em uma única transação SQL.
- Validação básica de e-mail no cadastro.
- Catálogo público, envio de conteúdo, ofertas, endpoints administrativos, verificação de licença e geração de chave API.
- Documentação de rotas em `docs/API.md`.

## Próxima etapa da transferência

1. Quando o limite de leitura do Floot liberar, copiar a árvore completa de arquivos e dependências para uma área de importação.
2. Inventariar os arquivos originais e mapear componentes, páginas, helpers, schemas e endpoints.
3. Comparar cada recurso com a implementação atual; preservar o que já funciona e integrar o que falta.
4. Migrar autenticação e persistência para PostgreSQL/Neon, ajustando nomes e tipos do schema.
5. Remover dependências exclusivas do ambiente Floot sem perder os comportamentos da aplicação.
6. Manter o checkout original desativado até o usuário definir o provedor e o modelo de repasse.
7. Executar build, testes e revisão de segurança antes de qualquer publicação.

## Situação

A documentação e alguns ajustes de segurança foram adicionados ao GitHub. **A importação do código original ainda está pendente** porque a origem bloqueou novas leituras até o reset diário informado pelo Floot.
