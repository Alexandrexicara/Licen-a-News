# Assistente virtual Licença News

O site inclui um robô flutuante no canto inferior direito. Ele apresenta uma saudação conforme o horário local, permanece em modo de descanso com os olhos fechados e abre a conversa quando o visitante clica nele.

## Componentes

- `frontend/assistant.js`: saudação, janela de conversa, histórico curto e reprodução de áudio.
- `frontend/assistant.css`: robô, animação de flutuação, foguete e painel responsivo.
- `backend/src/assistant.js`: rotas de conversa NVIDIA e voz ElevenLabs.
- Rotas montadas em `/api/v1/assistant`.

## Configuração segura no backend

Defina as variáveis abaixo no ambiente privado do serviço de API (Render ou ambiente equivalente). Não coloque chaves no frontend, HTML, JavaScript público ou GitHub.

- `NVIDIA_API_KEY`: chave da NVIDIA NIM.
- `NVIDIA_API_URL`: por padrão `https://integrate.api.nvidia.com/v1/chat/completions`.
- `NVIDIA_MODEL`: por padrão `meta/llama-3.3-70b-instruct`.
- `ELEVENLABS_API_KEY`: chave da ElevenLabs.
- `ELEVENLABS_VOICE_ID`: voz feminina Bella selecionada como padrão (`EXAVITQu4vr4xnSDxMaL`).
- `ELEVENLABS_MODEL_ID`: por padrão `eleven_multilingual_v2`.

A voz escolhida é uma configuração inicial. A disponibilidade e as permissões da voz dependem da conta ElevenLabs conectada.

## Endpoints

- `POST /api/v1/assistant/chat`: recebe `{ "messages": [{ "role": "user", "content": "..." }] }` e devolve `{ "reply": "..." }`.
- `POST /api/v1/assistant/speak`: recebe `{ "text": "..." }` e devolve áudio MPEG.

A conversa tem limite básico de 12 solicitações por minuto por endereço IP. O navegador mantém o histórico recente apenas durante a sessão da página.

## Limites e segurança

- O assistente informa que pagamentos e emissão de licenças continuam desativados.
- Ele não confirma cadastro, aprovação, pagamento ou emissão de licença sem consultar os sistemas correspondentes.
- Não enviar dados bancários, senhas ou informações sensíveis à conversa.
- As chaves devem ser adicionadas somente como variáveis privadas do backend.
- A integração depende da configuração das duas chaves e de implantação do backend para funcionar com IA e voz reais. O código foi versionado no GitHub, mas não foi publicado nem validado em produção nesta etapa.
