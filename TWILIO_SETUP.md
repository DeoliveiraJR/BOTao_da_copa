# Integração Twilio WhatsApp Sandbox

Este guia te leva passo a passo para conectar o BOTao da Copa com WhatsApp real via Twilio, começando com o Sandbox (gratuito) e depois escalar para produção.

## Parte 1: Criar Conta Twilio (Gratuito, 5 min)

1. Acesse https://www.twilio.com/console/whatsapp/learn
2. Clique em "Get Started" (verde).
3. Preencha dados básicos (email, senha, nome).
4. Confirme email.
5. Twilio vai pedir um telefone — adicione o seu (BR +55).
6. Pronto! Você tem $15 de crédito para testar.

## Parte 2: Ativar WhatsApp Sandbox (3 min)

1. No console Twilio, vá para **Messaging** > **Try it out** > **Send an SMS**.
2. No lado esquerdo, clique em **Sandbox**.
3. Você verá um número tipo: `+1 415 523 8886`.
4. Também terá um código de ativação tipo: `join XXXXX`.

### Adicionar seu número ao Sandbox
1. Abra WhatsApp no seu celular.
2. Envie uma mensagem para o número mostrado com o código.
   - Exemplo: `join XXXXX`
3. Twilio responde com confirmação: `You are now connected to the Twilio WhatsApp Sandbox`.

Pronto! Seu número está registrado e pode testar.

## Parte 3: Pegar Credenciais do Twilio (2 min)

Volte ao console Twilio:

1. Vá para **Account** > **API Keys & Tokens** (lado esquerdo).
2. Procure por:
   - **Account SID** — começa com "AC"
   - **Auth Token** — string longa
3. Copie e guarde em local seguro.

Também precisa do número sandbox WhatsApp:

1. Volte a **Messaging** > **Sandbox**.
2. Procure por "Sandbox Phone Number" — tipo `+1 415 523 8886`.
3. Copie.

## Parte 4: Configurar .env Local (2 min)

Abra `.env` no projeto:

```bash
# Existentes (Google Sheets)
PERSISTENCE_PROVIDER=google_sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1Lt0s6fVwDvkdZHDNuOkD5B8bsIdnkkp17DCW4cAiF2M
GOOGLE_SERVICE_ACCOUNT_EMAIL=botao-sheets-agent@...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="..."

# Novos (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+1 415 523 8886
```

## Parte 5: Expor Webhook Localmente com ngrok (5 min)

Twilio precisa de uma URL pública para chamar seu webhook. Localmente, usamos ngrok.

### Instalar ngrok
```bash
# macOS
brew install ngrok

# Windows (via Chocolatey)
choco install ngrok

# Linux
curl https://bin.equinox.io/c/4VmDzA7iaHg/ngrok-stable-linux-amd64.zip -o ngrok.zip
unzip ngrok.zip
```

### Rodar ngrok
```bash
ngrok http 3000
```

Você verá algo assim:
```
Forwarding   https://abc123def456.ngrok.io -> http://localhost:3000
```

Copie a URL `https://abc123def456.ngrok.io` — essa é sua URL pública.

## Parte 6: Registrar Webhook no Twilio (3 min)

1. No console Twilio, vá para **Messaging** > **Sandbox**.
2. Procure por "When a message comes in" (When messages arrive).
3. Mude para `POST` (se não estiver).
4. No campo de URL, coloque:
   ```
   https://abc123def456.ngrok.io/twilio/webhook
   ```
5. Clique **Save**.

Twilio vai fazer um GET para confirmar — se receber 200, ativa.

## Parte 7: Rodar API Localmente (1 min)

```bash
npm run dev
```

Você deve ver:
```
BOTao da Copa API rodando na porta 3000
```

## Parte 8: Testar (2 min)

1. Abra WhatsApp no seu celular.
2. Vá para a conversa com o número Twilio Sandbox (tipo +1 415 523 8886).
3. Envie uma mensagem: `BRA 2x1 ARG`
4. Você deve receber resposta: `Palpite registrado: BRA 2x1 ARG`
5. Abra o Google Sheets — linha nova deve aparecer em "Palpites".

✅ Funcionando!

## Checklist Rápido

- [ ] Conta Twilio criada
- [ ] WhatsApp Sandbox ativado
- [ ] Número registrado no Sandbox
- [ ] Credenciais no `.env`
- [ ] ngrok rodando
- [ ] Webhook registrado no Twilio
- [ ] API rodando localmente
- [ ] Palpite testado no WhatsApp
- [ ] Linha apareceu no Google Sheets

## Passando para Produção (depois)

Quando estiver pronto para escalar:

1. Comprar número WhatsApp Business no Twilio (~$1-5/mês).
2. Mudar TWILIO_WHATSAPP_NUMBER para o número real.
3. Fazer deploy da API em servidor permanente (Render, Heroku, etc.).
4. Atualizar URL do webhook para URL de produção.
5. Twilio cobra ~$0.005 por mensagem enviada/recebida.

## Troubleshooting

| Problema | Solução |
|---|---|
| "Webhook retornou erro 404" | Confirma que ngrok está rodando e URL está certa |
| "Mensagem não chega no WhatsApp" | Verifica se App está escutando na porta 3000 |
| "Não consigo enviar para o Sandbox" | Confirma se seu número foi registrado com `join XXXXX` |
| Credenciais erradas | Copia direto do console Twilio sem espaços |

## Contato / Suporte

Se travar em alguma etapa, verifique:
- Twilio docs: https://www.twilio.com/docs/sms/whatsapp/api
- Status do Twilio: https://status.twilio.com/
