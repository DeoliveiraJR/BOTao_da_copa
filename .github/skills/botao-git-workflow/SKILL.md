---
name: botao-git-workflow
description: "Use when: realizar commits, pushes, criar ou trocar branches, sincronizar com remoto, revisar git status ou executar qualquer operacao Git no projeto BOTao da Copa. Exige confirmacao explicita do usuario antes de commit e push."
version: 1.0.0
owner: BOTaoDaCopa
lastUpdated: 2026-06-11
---

# BOTao da Copa Git Workflow

## Visao geral

Este documento define o workflow de versionamento do BOTao da Copa. Sempre consulte esta skill antes de executar qualquer operacao Git que altere o repositorio local ou remoto.

## Regra principal de autorizacao

Antes de executar `git commit` ou `git push`, e obrigatorio:

1. Concluir implementacao e validacoes da tarefa.
2. Apresentar ao usuario um resumo dos arquivos alterados e das validacoes executadas.
3. Perguntar explicitamente: **"A tarefa esta finalizada e voce tem certeza de que posso realizar o commit e o push?"**
4. Aguardar uma resposta afirmativa e inequivoca do usuario.

Sem essa confirmacao, nao executar commit nem push. Uma autorizacao antiga nao vale para uma nova tarefa ou para alteracoes feitas depois da confirmacao.

Se o usuario autorizar apenas o commit, nao realizar push. Se autorizar apenas o push, verificar primeiro se existe commit local pronto para envio e confirmar o destino.

## Estrutura do repositorio

```text
c:\Users\morai\Desktop\devoJR\freelas\BOTaoDaCopa\
|-- .github\                         # Configuracoes externas ao clone; nao versionadas
`-- BOTao_da_copa\                  # Repositorio Git real
    |-- .git\
    |-- .github\skills\             # Skills versionadas do projeto
    |-- src\
    |-- README.md
    |-- package.json
    `-- tsconfig.json
```

## Regra de diretorio

Todas as operacoes Git devem ser executadas em:

```bash
cd "c:/Users/morai/Desktop/devoJR/freelas/BOTaoDaCopa/BOTao_da_copa"
```

Nunca executar operacoes Git na pasta pai `BOTaoDaCopa`, pois ela nao e o repositorio clonado.

## Repositorio e branch principal

- Remote: `origin`
- URL: `https://github.com/DeoliveiraJR/BOTao_da_copa.git`
- Branch de producao: `main`

Nao criar branch, trocar branch, fazer merge, rebase ou force push sem solicitacao ou aprovacao explicita do usuario.

## Padrao de commits

Usar Conventional Commits no formato:

```text
tipo(escopo): descricao curta no imperativo
```

Tipos permitidos:

| Tipo | Uso |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correcao de comportamento |
| `docs` | Documentacao e skills sem codigo funcional |
| `test` | Testes novos ou corrigidos |
| `refactor` | Mudanca interna sem alterar comportamento |
| `chore` | Dependencias, configuracao ou manutencao |
| `ci` | Automacoes de integracao e entrega |

Escopos recomendados:

- `agent`
- `whatsapp`
- `sheets`
- `ranking`
- `resultados`
- `narracao`
- `skills`
- `docs`
- `deps`

Exemplos:

```text
feat(whatsapp): adicionar webhook de palpites
feat(ranking): implementar pontuacao 3 1 0
docs(skills): documentar workflow git do projeto
chore(deps): configurar ambiente typescript
```

Evitar mensagens vagas como `update`, `ajustes`, `mudancas` ou `fix` sem contexto.

## Fluxo obrigatorio antes do commit

1. Confirmar a raiz com `git rev-parse --show-toplevel`.
2. Conferir branch e remoto com `git status --short --branch` e `git remote -v`.
3. Revisar alteracoes com `git diff` e `git diff --cached`.
4. Executar as validacoes aplicaveis, preferencialmente `npm run typecheck`, `npm test` e `npm run build` quando disponiveis.
5. Verificar se segredos, `.env`, credenciais, tokens, arquivos gerados, `node_modules` e `dist` nao serao versionados.
6. Adicionar arquivos especificos ao staging; evitar `git add .` quando houver alteracoes nao relacionadas.
7. Exibir o resumo final ao usuario e solicitar a confirmacao obrigatoria.
8. Somente apos confirmacao, executar o commit aprovado.

## Fluxo obrigatorio antes do push

1. Confirmar a branch atual.
2. Confirmar que o commit esperado existe com `git log -1 --oneline`.
3. Verificar se o remoto nao avancou; usar `git fetch origin` e comparar a branch quando necessario.
4. Nao usar `--force` ou `--force-with-lease` sem autorizacao explicita.
5. Somente apos a confirmacao obrigatoria, executar `git push origin <branch>`.
6. Informar ao usuario o hash, a mensagem do commit e a branch enviada.

## Operacoes proibidas sem autorizacao especifica

- `git reset --hard`
- `git clean -fd`
- `git checkout -- <arquivo>`
- `git restore --source` sobre alteracoes do usuario
- `git push --force`
- `git rebase`
- Remover branches locais ou remotas
- Alterar historico publicado

## Checklist de seguranca

- [ ] Estou dentro de `BOTao_da_copa`, o repositorio real.
- [ ] Revisei `git status` e a branch atual.
- [ ] Revisei os diffs e separei alteracoes nao relacionadas.
- [ ] Confirmei que nenhum segredo ou artefato gerado sera commitado.
- [ ] Executei typecheck, testes e build aplicaveis.
- [ ] Preparei uma mensagem no padrao Conventional Commits.
- [ ] Mostrei ao usuario o resumo final da tarefa.
- [ ] Perguntei se a tarefa esta finalizada e se ele tem certeza sobre commit e push.
- [ ] Recebi confirmacao afirmativa explicita nesta tarefa.
- [ ] Confirmei branch e remoto antes do push.

## Tratamento de falhas

- Se uma validacao falhar, nao commitar ate corrigir ou obter autorizacao explicita para registrar o estado incompleto.
- Se o push for rejeitado, nao forcar. Buscar o remoto, explicar a divergencia e combinar a estrategia.
- Se houver alteracoes desconhecidas, preserva-las e excluir esses arquivos do staging ate esclarecer a origem.
- Se houver conflito, interromper o fluxo automatico, apresentar os arquivos afetados e resolver sem descartar trabalho do usuario.

## Historico

- 1.0.0 (2026-06-11): workflow inicial com raiz Git correta, Conventional Commits e confirmacao obrigatoria antes de commit e push.