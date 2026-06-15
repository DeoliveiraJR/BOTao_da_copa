# Supabase para Avatar de Participantes

Este diretório centraliza a estrutura para persistir avatar de usuário no Supabase.

## 1) Criar projeto no Supabase
1. Acesse https://supabase.com/dashboard/projects
2. Clique em `New project`
3. Escolha organização, nome (ex: `botao-copa-avatars`) e senha forte para o banco.
4. Aguarde provisionamento.

## 2) Criar bucket de storage
1. No menu do projeto, abra `Storage`.
2. Clique em `New bucket`.
3. Nome sugerido: `avatars`.
4. Defina como `Private`.

## 3) Criar tabela de perfis
No `SQL Editor`, execute:

```sql
create table if not exists participant_profiles (
  participant_id text primary key,
  display_name text not null,
  avatar_path text,
  updated_at timestamptz not null default now()
);
```

## 4) Políticas sugeridas (MVP)
Para backend/serviço usando service role key, pode iniciar sem RLS para simplificar.
Se quiser habilitar RLS depois, criar policies específicas.

## 5) Secrets no Streamlit Cloud
Adicionar em `Secrets`:

```toml
API_BASE_URL = "https://botao-da-copa-api.onrender.com"
CURRENT_USER_ID = "1"
CURRENT_USER_NAME = "Oliveira"
SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "SUA_SERVICE_ROLE_KEY"
SUPABASE_BUCKET = "avatars"
```

## 6) Observação
Nesta etapa, o app já funciona com fallback local em `streamlit_app/assets/avatars/`.
Quando os secrets acima forem adicionados, podemos ativar sincronização total no Supabase.
