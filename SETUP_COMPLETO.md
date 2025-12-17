# 🚀 Setup Completo - MVP Sistema

## 📋 Portas Utilizadas

- **Frontend:** http://localhost:3005
- **Backend:** http://localhost:3001
- **PostgreSQL:** localhost:5432 (Docker)
- **Chatwoot:** http://localhost:3000 (já em uso)

---

## 🔧 Backend

### 1. Instalar Dependências

```bash
cd backend
npm install
```

### 2. Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```env
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=app_db
DB_USER=
DB_PASSWORD=

# Upload
UPLOAD_DIR=./uploads

# Google Gemini API
GOOGLE_API_KEY=sua_chave_aqui
```

### 3. Executar Migração

```bash
npm run migrate
```

### 4. Iniciar Backend

```bash
npm run dev
```

Backend disponível em: **http://localhost:3001**

---

## 🎨 Frontend

### 1. Instalar Dependências

```bash
cd frontend
npm install
```

### 2. Iniciar Frontend

```bash
npm run dev
```

Frontend disponível em: **http://localhost:3005**

---

## 🗄️ PostgreSQL (Docker)

O PostgreSQL já está rodando no Docker:

```bash
# Verificar status
docker ps | grep postgres

# Conectar via psql
docker exec -it postgres psql -U spheraflow -d app_db
```

**Credenciais:**
- Host: localhost
- Porta: 5432
- Database: app_db
- User: 
- Password: 

---

## 📡 Endpoints Disponíveis

### Posts
- `POST /api/upload-post` - Upload de arquivo
- `GET /api/posts/:clienteId` - Buscar posts
- `POST /api/process-post` - Processar com IA

### Branding
- `POST /api/analyze-branding` - Analisar branding
- `GET /api/branding/:clienteId` - Buscar branding

### Calendar
- `POST /api/generate-calendar` - Gerar calendário
- `GET /api/calendars/:clienteId` - Buscar calendário

---

## 🧪 Teste Completo

### 1. Criar Cliente

```sql
INSERT INTO clientes (id, nome) 
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Cliente Teste');
```

### 2. Acessar Frontend

Abra: http://localhost:3005

### 3. Usar o Dashboard

1. Digite: `123e4567-e89b-12d3-a456-426614174000`
2. Faça upload de uma imagem
3. Gere um calendário de 7 dias
4. Visualize o resultado!

---

## 🔥 Comandos Rápidos

```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Migração
cd backend && npm run migrate

# Ver logs do PostgreSQL
docker logs postgres

# Parar tudo
# Ctrl+C nos terminais do backend/frontend
```

---

## ✅ Checklist

- [ ] PostgreSQL rodando no Docker
- [ ] Backend rodando na porta 3001
- [ ] Frontend rodando na porta 3005
- [ ] Google API Key configurada
- [ ] Tabelas criadas (migrate executado)
- [ ] Cliente de teste criado
- [ ] Upload funcionando
- [ ] IA processando
- [ ] Calendário gerado

---

## 🐛 Troubleshooting

### Porta 3005 em uso
```bash
# Windows
netstat -ano | findstr :3005
taskkill /PID <PID> /F

# Ou altere a porta no vite.config.ts
```

### Backend não conecta ao PostgreSQL
- Verifique se o Docker está rodando
- Confirme credenciais no .env
- Execute: `docker ps | grep postgres`

### CORS Error
- Verifique se backend aceita localhost:3005
- Veja configuração em `backend/src/index.ts`

---

**🎉 Sistema Completo e Funcionando!**

