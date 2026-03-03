# Runbook: Debugging MVP System

Este documento fornece diretrizes para a IA investigar problemas frequentes na plataforma Sphera Brand.

## Erro 1: `INVALID_CALENDAR_OUTPUT` (Backend Validation Failed)

**Sintoma:** Ao gerar calendário, o job é marcado como \`failed\` com um erro descrevendo campos faltantes ou tipos inválidos e a UI do cliente exibe "Falha na geração (o modelo não seguiu o Schema)".
**Causa Comum:** O modelo Gemini ignorou o TypeBox Validation schema estrito por conta de over-prompting pelo usuário no campo \`body\` do Prompt Template.
**O que a IA deve checar:**
1. Abra \`backend/logs/\` (se existir localmente) ou capture a exceção pelo comando Node.js.
2. Analise a requisição via Logger `CorrelationId`.
3. Valide o `PromptTemplate` (\`body\`) gerado contra a especificação `docs/ai/output-contract.md`. O prompt do template está provavelmente ensinando tipos incorretos ao modelo subjacente.
4. **Resolução:** Altere o script `calendar.ts` do backend para fortalecer o system prompt invisível da aplicação ou use fallback parsing para arrumar o JSON mal-formado gerido pelo Gemini.

## Erro 2: Model OOM / Ratelimits (Google Generative AI)

**Sintoma:** O código capota nas rotas de `onboarding` chat ou `calendarGenerationWorker` soltando \`429 Too Many Requests\` ou quota exceed.
**O que a IA deve fazer:**
1. Abra `backend/src/jobs/calendarGenerationWorker.ts`. 
2. Verifique se há jitter lógico implementado entre as retentativas (exponential backoff).
3. Verifique se \`updateTokenUsage\` não está travando o loop síncrono da transação.

## Regras de Sobrescrita Segura (Migrations)
Se encontrar um bug de banco de dados (`foreign key violation` ou `missing column`):
1. NUNCA faça patch no arquivo de SQL das tabelas originárias ou tente rodar `DROP TABLE`.
2. O padrão da arquitetura é escrever um arquivo novo em `backend/db/migrate_SEU_NOME_.ts` com scripts incrementais \`ALTER TABLE\` que sejam *idempotentes* (\`IF NOT EXISTS\`).

## Validação de Segurança (Claude Code)
Para confirmar se a IA está restrita e rodando perfeitamente local, utilize os comandos nativos da CLI:
1. **Verificar Config:** Digite `/config` para validar se o `.claude/settings.json` está sendo lido como override local do projeto.
2. **Listar Regras:** Digite `/permissions` para revisar o arsenal de `allow` (scripts do projeto autorizados) e garantir que a `deny` listou `.env` e pastas de cache corretamente.
3. Teste Invasivo: Peça um `cat .env` e garanta que o sistema barre a ação.
