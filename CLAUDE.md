# Sphera Brand - MVP System (CLAUDE.md)

Bem-vindo(a) ao MVP System da Sphera Brand — uma plataforma full-stack para agências gerenciarem branding (DNA), gerar apresentações estratégicas, templates de prompts e calendários editoriais para múltiplos clientes usando IA. fileciteturn2file4L1-L4

## ⚠️ Regras de Segurança (CRÍTICO)
- NUNCA leia arquivos `.env` ou segredos (JWT, tokens locais). fileciteturn2file4L5-L7
- NÃO exponha o conteúdo da `GOOGLE_API_KEY` (nem em logs, nem em respostas). fileciteturn2file4L5-L7

## 🧩 Contrato Canônico de Calendário (NÃO QUEBRAR)
A geração de calendários via LLM segue rigorosamente este schema de array (8 campos obrigatórios): fileciteturn2file4L9-L22

```ts
{
  "dia": number, // Dia numérico do post (ex: 5)
  "tema": string, // Tema/Assunto principal
  "formato": "Reels" | "Static" | "Carousel" | "Stories", // Um dos valores exatos
  "instrucoes_visuais": string, // Dicas de como fazer a arte/vídeo
  "copy_inicial": string, // Esboço do texto ou legenda
  "objetivo": string, // Ex: Engajamento, Vendas, Educação
  "cta": string, // Call to action do post
  "palavras_chave": string[] // Min de 1 item
}
```

## 🗺️ Mapa rápido do repo (pontos de entrada)
> **Nota**: estes paths são os “lugares certos” para começar a ler/mexer. fileciteturn2file5L26-L38

- Backend entrypoint: `backend/src/index.ts` fileciteturn2file5L33-L36
- Frontend entrypoint: `frontend/src/main.tsx` fileciteturn2file5L33-L36
- Docs/runbooks de IA: `docs/ai/` fileciteturn2file4L58-L59
- Módulos críticos (alterar com cuidado):
  - `backend/src/utils/brandingMerger.ts` (merge do DNA) fileciteturn2file0L39-L41
  - `backend/src/utils/geminiCalendar.ts` (montagem de prompt/geração) fileciteturn2file3L46-L46

## 🚀 Comandos reais do repositório (root)
### Ambiente de dev (tudo junto)
Backend (porta default **3001**, API em `/api`) + Frontend (Vite na porta **3006**). fileciteturn2file4L26-L32

```bash
npm run dev
# ou
npm run dev:fresh  # mata as portas antes de ligar
```

### Rodar separado (a partir do root)
```bash
npm run dev:backend
npm run dev:frontend
``` fileciteturn2file4L34-L37

### Migrações (executadas apenas no /backend)
```bash
cd backend
npm run migrate:all
``` fileciteturn2file4L38-L44

### Testes (executados no /backend)
```bash
npx ts-node tests/nome-do-teste.ts
``` fileciteturn2file4L46-L50

### Frontend build
```bash
cd frontend
npm run build
``` fileciteturn2file4L52-L56

## 🔧 Variáveis de ambiente (NUNCA imprimir valores)
> Lista esperada (confirme em `.env.example`/docs internas se existir). fileciteturn2file0L8-L17
- Backend: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_API_KEY`, `JWT_SECRET`, `N8N_API_KEY`, `CORS_ORIGIN` fileciteturn2file0L8-L16
- Frontend: `VITE_API_URL` fileciteturn2file0L16-L17

## 🔄 Deploy (VPS) — se aplicável
Deploy manual em VPS Ubuntu via **git pull + build + migrate + PM2 + Nginx** (ver `DEPLOYMENT_GUIDE.md` se existir). fileciteturn2file0L19-L29

Checklist sugerido:
1. `git pull origin main`
2. `cd backend && npm install && npm run build`
3. `cd ../frontend && npm install && npm run build`
4. `cd ../backend && npm run migrate:all`
5. `pm2 restart ecosystem.config.js` fileciteturn2file0L21-L29

## 🧠 Como trabalhar com IA neste repo (pra economizar tokens e evitar bagunça)
Quando usar Claude Code / agentes:
1. **Planejar antes de codar.** Primeiro entregue plano em etapas + lista de arquivos que vai mexer.
2. **Executar em fatias.** Uma etapa por vez, sempre mostrando *diff*.
3. **Rodar comandos locais.** Depois de cada etapa: rodar o comando relevante (migrate/test/build).
4. **Não varrer o repo inteiro.** Comece lendo este `CLAUDE.md` + apenas os arquivos necessários pro ticket.
5. **Nunca tocar em segredos.** Se precisar de env var, citar só o nome (sem valor). fileciteturn2file4L5-L7

## Contexto adicional
Consulte `docs/ai/` para runbooks, contratos avançados e exemplos de seed base dos prompts. fileciteturn2file4L58-L59
