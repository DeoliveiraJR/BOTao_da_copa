# Guia de Setup e Testes — BOTao da Copa

---

## PARTE 1 — Testar agora, sem Google Sheets, sem nada externo

Esta parte você consegue fazer em 5 minutos com o que já tem instalado.

### Pré-requisito: Node.js 18+

```bash
node -v   # deve aparecer v18.x ou superior
```

Se não tiver, baixe em https://nodejs.org

---

### 1. Instalar dependências

```bash
cd BOTao_da_copa
npm install
```

---

### 2. Criar arquivo .env

```bash
# Windows PowerShell
Copy-Item .env.example .env

# ou bash
cp .env.example .env
```

O `.env` já vem configurado para modo memória (`PERSISTENCE_PROVIDER=in_memory`).
Não precisa preencher nada do Google por enquanto.

---

### 3. Rodar os testes

```bash
npm test
```

Resultado esperado: **16 testes passando**.

```
✔ parses a prediction with x separator
✔ parses a prediction with dash separator and flexible spacing
...
✔ detects ranking intent
✔ detects games intent
ℹ pass 16
ℹ fail 0
```

---

### 4. Subir a API localmente

```bash
npm run dev
```

Você verá:
```
BOTao da Copa API rodando na porta 3000
```

---

### 5. Testar os endpoints (em outro terminal)

**Health check** — só para confirmar que está rodando:
```bash
curl http://localhost:3000/health
# resposta: {"ok":true,"service":"botao-da-copa"}
```

**Registrar um palpite:**
```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d "{\"participantId\":\"seu-nome\",\"text\":\"BRA 2x1 ARG\"}"

# resposta: {"ok":true,"reply":"Palpite registrado: BRA 2x1 ARG"}
```

**Tentar palpite duplicado** (deve bloquear):
```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d "{\"participantId\":\"seu-nome\",\"text\":\"BRA 2x1 ARG\"}"

# resposta: "Voce ja tem palpite para BRA x ARG..."
```

**Pedir ranking:**
```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d "{\"participantId\":\"seu-nome\",\"text\":\"ranking\"}"

# resposta: "Ranking vazio. Faca seu palpite primeiro!"
# (fica populado após consolidar resultados)
```

**Pedir ajuda:**
```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d "{\"participantId\":\"seu-nome\",\"text\":\"ajuda\"}"
```

**Ver todos os palpites registrados:**
```bash
curl http://localhost:3000/predictions
```

**Ver ranking:**
```bash
curl http://localhost:3000/ranking
```

> No Windows sem curl, use o Postman (baixe em https://www.postman.com) ou o Thunder Client (extensão do VS Code).

---

## PARTE 2 — Configurar Google Sheets (passo a passo)

### Passo 1: Criar a planilha

1. Acesse https://sheets.google.com
2. Clique em **+ Em branco**
3. Renomeie a planilha para `BOTao da Copa 2026`
4. Copie o ID da planilha da URL:
   ```
   https://docs.google.com/spreadsheets/d/ **SEU_ID_AQUI** /edit
   ```

---

### Passo 2: Criar Service Account no Google Cloud

1. Acesse https://console.cloud.google.com
2. Crie um projeto (ex: `botao-da-copa`) ou use um existente
3. No menu lateral: **APIs e Serviços → Biblioteca**
4. Pesquise `Google Sheets API` e clique em **Ativar**
5. No menu: **APIs e Serviços → Credenciais**
6. Clique em **+ Criar credenciais → Conta de serviço**
7. Preencha um nome (ex: `botao-sheets-agent`) e clique em **Criar e continuar**
8. Em permissões, selecione o papel **Editor** e clique em **Continuar**
9. Clique em **Concluído**

---

### Passo 3: Gerar a chave da Service Account

1. Na lista de Contas de Serviço, clique na que você criou
2. Clique na aba **Chaves**
3. Clique em **Adicionar chave → Criar nova chave**
4. Escolha **JSON** e clique em **Criar**
5. Um arquivo `.json` será baixado automaticamente

O arquivo JSON tem este formato:
```json
{
  "type": "service_account",
  "project_id": "...",
  "client_email": "botao-sheets-agent@....iam.gserviceaccount.com",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
}
```

---

### Passo 4: Compartilhar a planilha com a Service Account

1. Abra a planilha no Google Sheets
2. Clique em **Compartilhar** (canto superior direito)
3. Cole o `client_email` do JSON (ex: `botao-sheets-agent@....iam.gserviceaccount.com`)
4. Selecione permissão **Editor**
5. Clique em **Enviar**

---

### Passo 5: Preencher o .env

Abra o arquivo `.env` e preencha:

```env
PORT=3000
WHATSAPP_VERIFY_TOKEN=botao-verify-token
TIMEZONE=America/Sao_Paulo

PERSISTENCE_PROVIDER=google_sheets

GOOGLE_SHEETS_SPREADSHEET_ID=cole_aqui_o_id_da_planilha
GOOGLE_SHEETS_PREDICTIONS_RANGE=Palpites!A:G

GOOGLE_SERVICE_ACCOUNT_EMAIL=cole_aqui_o_client_email_do_json
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="cole_aqui_o_private_key_do_json_exatamente_como_esta"
```

> IMPORTANTE: o `private_key` tem quebras de linha `\n` no JSON. Cole-o entre aspas duplas, exatamente como aparece no JSON baixado.

---

### Passo 6: Criar as abas da planilha automaticamente

```bash
npm run bootstrap:sheets
```

Isso cria todas as abas com cabeçalhos:
- Regulamento
- Participantes
- Jogos
- Palpites
- Resultados
- Pontuacao por Jogo
- Ranking
- Rodadas-Resumo
- Config

---

### Passo 7: Testar com Google Sheets ativo

Com a API rodando (`npm run dev`), envie um palpite e confirme que ele aparece na aba **Palpites** da planilha:

```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d "{\"participantId\":\"joao\",\"text\":\"BRA 3x0 ARG\"}"
```

Abra a planilha e veja a nova linha na aba **Palpites**.

---

## PARTE 3 — Onde o AGNO entra (próximo passo)

O AGNO é o cérebro do agente que vai:
- Gerar análises pré-jogo
- Escrever sínteses sarcásticas pós-rodada
- Responder perguntas abertas dos participantes no WhatsApp

**O que já funciona sem AGNO:**
- Registro de palpites ✅
- Bloqueio de palpite duplicado ✅
- Verificação de prazo ✅
- Consulta de ranking ✅
- Listagem de jogos ✅

**O que o AGNO vai adicionar:**
- Mensagens com personalidade e contexto
- Análise inteligente dos dados antes/depois dos jogos
- Respostas a perguntas abertas

Para usar o AGNO você precisará de uma chave de API de um LLM (OpenAI ou outro).
Antes disso, vamos conectar o WhatsApp real via Twilio ou Meta Cloud API.

---

## Resumo do fluxo atual

```
Participante digita no WhatsApp (ou via curl por enquanto)
        ↓
POST /whatsapp/webhook
        ↓
Detecta intent: palpite / ranking / jogos / ajuda
        ↓
Salva na memória (ou Google Sheets se configurado)
        ↓
Retorna resposta de texto
```

---

## Problemas comuns

| Erro | Causa | Solução |
|---|---|---|
| `GOOGLE_SHEETS_SPREADSHEET_ID is required` | `.env` incompleto | Preencher ID da planilha |
| `Google Sheets API not enabled` | API não ativada no GCloud | Ativar nas configurações da API |
| `Permission denied` | Planilha não compartilhada | Compartilhar com o client_email |
| `Cannot find module` | `npm install` não rodou | `npm install` na pasta do projeto |
| Porta 3000 ocupada | Outro processo usando | Mudar `PORT=3001` no `.env` |
