Você é meu(a) engenheiro(a) de produto + fullstack dentro deste repositório.
Missão: transformar o dashboard do cliente em um painel “útil para agência”, adicionando métricas de valor entregue, operação, qualidade técnica e ROI — com implementação incremental, baixa complexidade e sem quebrar o que já existe.

CONTEXTO
- Já temos: prompts por cliente, preview, guardrails e validação runtime do output do calendário.
- Já removemos cards inúteis do dashboard e estamos adicionando KPIs de custo e tempo.
- Precisamos agora ir além de custo/tempo e medir: qualidade (aprovação/retrabalho), execução (planejado vs publicado), confiabilidade (falhas), risco de churn e ROI.

OBJETIVO DO PROJETO (o que a agência precisa ver)
Criar uma seção de métricas que responda:
1) Estamos entregando valor? (aprovação, tempo até aprovar, pronto pra postar)
2) Estamos operando com margem? (tempo do time, revisões, carga por cliente)
3) O sistema está confiável? (falhas por tipo, latência, reprocessamentos)
4) O cliente está usando e vai renovar? (uso, pipeline, churn risk)
5) Qual o ROI/relatório? (custo por calendário/post aprovado + economia acumulada)

REGRAS
- Não invente dados. Se não existir tracking, implemente o tracking mínimo “daqui pra frente”.
- Manter multi-tenant estrito (cliente só enxerga seus dados).
- Implementação incremental: primeiro “mínimo poderoso”, depois evolução.
- Preferir usar metadata JSONB onde for suficiente, mas criar tabela nova quando precisar (ex.: revisões/aprovação por item).
- Tudo deve ser auditável e simples de debugar (correlationId onde fizer sentido).
- UI consistente com o design atual (cards, grid, responsivo).

MÍNIMO PODEROSO (ENTREGAR PRIMEIRO)
Implementar estes 8 itens com coleta + endpoint + UI:

(1) Aprovação por item (status)
- Para cada item do calendário: aprovado | ajustar | refazer
- Métrica: approval_rate = aprovados / total

(2) # revisões por item
- Quantas vezes um item mudou de status ou foi editado

(3) Tempo até aprovação
- Do momento “gerado” ao momento “aprovado”

(4) Planejado vs publicado (execução)
- Se não houver integração com IG: implementar status manual “publicado” por item no UI.
- Métrica: published_rate

(5) Falhas por tipo + contagem INVALID_CALENDAR_OUTPUT
- Usar jobs/worker/status e/ou logs persistidos (sem stacktrace)

(6) Custo por calendário + custo por post aprovado
- Usar metadata de tokens/custo já implementada (PR5/PR4)

(7) Uso por cliente (atividade)
- quantas gerações (calendários) no período, quantas vezes abriu/calendário, quantos itens aprovados (proxy de uso)

(8) Churn risk score (heurístico simples)
- Exemplo de regra v1:
  +1 se não gera calendário há 30 dias
  +1 se approval_rate < 50%
  +1 se published_rate < 30%
  +1 se revisões médias > 2
  => score 0-4 e label: Baixo/Médio/Alto

ENTREGÁVEIS (obrigatório)
Quero sua resposta em:
1) Diagnóstico no repo (paths e entidades atuais: calendarios, jobs, metadata, dashboard page)
2) Proposta de modelo de dados (mínimo necessário)
3) Plano por PRs (PR1 tracking/DB, PR2 endpoints, PR3 UI)
4) Patch: arquivos alterados/criados + diffs principais
5) Como testar localmente + checklist de aceitação

ESPECIFICAÇÃO TÉCNICA

A) MODELO DE DADOS (recomendação)
Crie uma tabela (ou coleção) para estados por item do calendário:
- calendar_items (ou calendario_itens):
  id (uuid), client_id, calendario_id, dia, tema, formato,
  status ("draft"|"approved"|"needs_edit"|"redo"|"published"),
  revisions_count int default 0,
  first_generated_at timestamp,
  approved_at timestamp null,
  published_at timestamp null,
  last_updated_at timestamp,
  updated_by user_id null,
  notes text null
Regras:
- Ao gerar calendário: popular calendar_items automaticamente a partir do JSON canônico (dia/tema/formato etc).
- Se calendário for regenerado: criar novos itens vinculados ao novo calendario_id (não sobrescrever histórico).

Se você achar que tabela nova é overkill, proponha alternativa via metadata JSONB + trade-offs, mas prefira tabela se facilitar métricas.

B) TRACKING (eventos mínimos)
- Quando um calendário é salvo: criar N items com status=draft e first_generated_at.
- Quando usuário aprova/ajusta/refaz/publica um item: atualizar status, timestamps, revisions_count++.
- Quando falha geração: registrar erro por tipo (sem stacktrace) com correlationId.

C) ENDPOINTS
1) GET /api/clients/:clientId/dashboard-metrics?range=30d|90d|mtd
Retornar:
{
  range,
  calendars_count,
  posts_count,
  approval_rate,
  avg_revisions_per_item,
  avg_time_to_approval_minutes,
  planned_vs_published: { planned: number, published: number, published_rate: number },
  failures: { total: number, invalid_output_count: number, by_type: Record<string, number> },
  llm_cost_brl_total,
  llm_cost_brl_avg_per_calendar,
  cost_per_approved_post_brl,
  usage: { generations: number, approvals: number, last_activity_at: string|null },
  churn_risk: { score: number, label: "Baixo"|"Médio"|"Alto", reasons: string[] }
}

2) PATCH /api/calendar-items/:id
Body:
{ status, notes? }
- Atualiza status, timestamps e revisions_count.
- Validar auth por client_id.

3) (Opcional) GET /api/calendarios/:id/items
- Para a UI marcar status em lote.

D) UI (dashboard + timeline)
- Dashboard: faixa de KPIs + card “Saúde do Cliente” (churn risk + reasons) + card “Qualidade” (approval/revisions/time-to-approval).
- Timeline de conteúdo: adicionar chips de status por item + ações rápidas (Aprovar / Ajustar / Refazer / Publicado) e contador de revisões.
- Filtro por status (ex.: mostrar apenas needs_edit/redo).

E) TESTES
- Unit tests: churnRiskScore (heurística), agregação de métricas, update de status e revisões.
- Garantir compatibilidade: clientes antigos com calendários sem items devem aparecer com métricas 0/— (e um job de backfill opcional).

ACEITAÇÃO
- Consigo ver approval_rate, revisões, tempo até aprovação e publicado vs planejado no dashboard.
- Consigo mudar status de um item na timeline e ver métricas atualizando.
- Falhas por tipo aparecem sem stacktrace.
- Churn risk aparece com reasons coerentes.
- Multi-tenant ok.
- Testes e build passam.

AGORA EXECUTE
- Localize o dashboard do cliente e a timeline atual.
- Proponha a modelagem mínima e implemente o “mínimo poderoso” em PRs incrementais.
- Traga patch + instruções de teste.