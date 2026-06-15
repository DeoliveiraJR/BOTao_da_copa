# Supabase para Avatar de Participantes

Este diretório documenta a persistência do avatar e do perfil do participante no Supabase.

## O que já está implementado
- Upload da foto do participante para o bucket `avatars`.
- Gravação/atualização do perfil na tabela `participant_profiles`.
- Leitura prioritária do avatar no Supabase, com fallback local em `streamlit_app/assets/avatars/`.

## Estrutura esperada no Supabase
### 1) Projeto
Use o projeto com o `Project ID` exibido no dashboard.
A URL no `.env` deve seguir o formato:

```toml
SUPABASE_URL = "https://<project-id>.supabase.co"
```

### 2) Bucket
Crie um bucket privado chamado `avatars`.

### 3) Tabela
No SQL Editor, execute:

```sql
create table if not exists participant_profiles (
  participant_id text primary key,
  display_name text not null,
  avatar_path text,
  updated_at timestamptz not null default now()
);
```

### 4) Secrets / .env
Adicione estes valores no `.env` local e também nos Secrets do Streamlit Cloud:

```toml
API_BASE_URL = "https://botao-da-copa-api.onrender.com"
CURRENT_USER_ID = "1"
CURRENT_USER_NAME = "Oliveira"
SUPABASE_URL = "https://<project-id>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "<service_role_secret>"
SUPABASE_BUCKET = "avatars"
```

## Fluxo do app
1. O app identifica o participante via `CURRENT_USER_ID` e `CURRENT_USER_NAME`.
2. No upload da imagem, salva localmente e envia para o bucket `avatars`.
3. O perfil é atualizado na tabela `participant_profiles`.
4. Nas próximas leituras, o app busca o avatar no Supabase primeiro.

## Observação importante
Se a `service_role key` foi exibida em print/chat, gere uma nova chave no Supabase antes de seguir para produção.
