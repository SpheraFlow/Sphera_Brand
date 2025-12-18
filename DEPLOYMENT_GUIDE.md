# 🚀 Guia de Migração para VPS Ubuntu

## 📋 Visão Geral

Este guia cobre a migração completa do projeto MVP System para uma VPS Ubuntu, incluindo backend Node.js, frontend React, PostgreSQL e Python.

---

## 🛠️ Pré-requisitos

### VPS Mínima Recomendada
- **CPU**: 2 vCPUs (Intel/AMD)
- **RAM**: 4GB (8GB recomendado)
- **Armazenamento**: 50GB SSD
- **SO**: Ubuntu 20.04 ou 22.04 LTS

### Software Necessário
- Node.js 18+ 
- PostgreSQL 14+
- Python 3.9+
- Nginx
- PM2
- Git

---

## 📦 Passo 1: Configuração Inicial do Servidor

### 1.1 Conectar via SSH
```bash
ssh root@SEU_IP_VPS
```

### 1.2 Atualizar Sistema
```bash
apt update && apt upgrade -y
```

### 1.3 Criar Usuário (Recomendado)
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### 1.4 Instalar Dependências Básicas
```bash
sudo apt install -y curl wget git unzip software-properties-common
```

---

## 🟢 Passo 2: Instalar Node.js

### 2.1 Instalar Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2.2 Verificar Instalação
```bash
node --version  # v18.x.x
npm --version   # 9.x.x
```

---

## 🐘 Passo 3: Instalar PostgreSQL

### 3.1 Instalar PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
```

### 3.2 Configurar PostgreSQL
```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE mvp_system;
CREATE USER deploy WITH PASSWORD 'SENHA_FORTE';
GRANT ALL PRIVILEGES ON DATABASE mvp_system TO deploy;
\q
```

### 3.3 Ajustar Configuração
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
# Alterar: listen_addresses = 'localhost'
```

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Adicionar: local   all             deploy                                  md5
```

```bash
sudo systemctl restart postgresql
```

---

## 🐍 Passo 4: Instalar Python

### 4.1 Instalar Python e Dependências
```bash
sudo apt install -y python3 python3-pip python3-venv build-essential
```

### 4.2 Instalar Bibliotecas Python
```bash
pip3 install pillow
```

---

## 📁 Passo 5: Clonar e Configurar Projeto

### 5.1 Clonar Repositório
```bash
cd /var/www
sudo git clone SEU_REPOSITORIO_GIT mvp-system
sudo chown -R deploy:deploy mvp-system
cd mvp-system
```

### 5.2 Configurar Backend
```bash
cd backend
npm install
```

### 5.3 Configurar Variáveis de Ambiente
```bash
cp .env.example .env
nano .env
```

```env
# Database
POSTGRES_DB=mvp_system
POSTGRES_USER=deploy
POSTGRES_PASSWORD=SENHA_FORTE
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# API Keys
GOOGLE_API_KEY=SUA_CHAVE_GEMINI

# Server
PORT=3001
NODE_ENV=production
```

### 5.4 Executar Migrações
```bash
# Conectar ao PostgreSQL
psql -h localhost -U deploy -d mvp_system

# Executar schema
\i db/schema.sql

# Executar migrações
\i backend/src/database/migrations/add_token_usage_to_clients.sql
\i backend/src/database/migrations/create_prompt_chains.sql
\i backend/src/database/migrations/create_presentations_table.sql
\q
```

### 5.5 Configurar Frontend
```bash
cd ../frontend
npm install
```

### 5.6 Build Frontend
```bash
npm run build
```

---

## 🚀 Passo 6: Configurar PM2

### 6.1 Instalar PM2
```bash
sudo npm install -g pm2
```

### 6.2 Criar Arquivo PM2
```bash
cd /var/www/mvp-system
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'mvp-backend',
      script: './backend/dist/index.js',
      cwd: '/var/www/mvp-system',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
};
```

### 6.3 Build Backend
```bash
cd backend
npm run build
```

### 6.4 Iniciar PM2
```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🌐 Passo 7: Configurar Nginx

### 7.1 Instalar Nginx
```bash
sudo apt install -y nginx
```

### 7.2 Configurar Virtual Host
```bash
sudo nano /etc/nginx/sites-available/mvp-system
```

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;

    # Frontend
    location / {
        root /var/www/mvp-system/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Arquivos estáticos do Python
    location /presentation-output {
        alias /var/www/mvp-system/backend/python_gen/output;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location /storage {
        alias /var/www/mvp-system/storage;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### 7.3 Ativar Site
```bash
sudo ln -s /etc/nginx/sites-available/mvp-system /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Passo 8: Configurar SSL (Let's Encrypt)

### 8.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.2 Gerar Certificado SSL
```bash
sudo certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

### 8.3 Auto-renovação
```bash
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔥 Passo 9: Configurar Firewall

### 9.1 Configurar UFW
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📊 Passo 10: Monitoramento e Logs

### 10.1 Logs PM2
```bash
pm2 logs mvp-backend
pm2 monit
```

### 10.2 Logs Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 10.3 Logs PostgreSQL
```bash
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 🔄 Passo 11: Backup Automático

### 11.1 Script de Backup
```bash
sudo nano /usr/local/bin/backup-mvp.sh
```

```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/mvp-system"

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump -h localhost -U deploy mvp_system > $BACKUP_DIR/db_$DATE.sql

# Backup Arquivos
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/mvp-system/storage

# Remover backups antigos (7 dias)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
```

### 11.2 Permissões e Cron
```bash
sudo chmod +x /usr/local/bin/backup-mvp.sh
sudo crontab -e
# Adicionar:
0 2 * * * /usr/local/bin/backup-mvp.sh
```

---

## 🚨 Passo 12: Comandos Úteis

### Gerenciar PM2
```bash
pm2 restart mvp-backend
pm2 stop mvp-backend
pm2 reload mvp-backend
pm2 status
```

### Gerenciar Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart nginx
```

### Gerenciar PostgreSQL
```bash
sudo systemctl status postgresql
sudo -u postgres psql
```

### Atualizar Projeto
```bash
cd /var/www/mvp-system
git pull origin main
cd backend && npm run build
pm2 restart mvp-backend
cd ../frontend && npm run build
```

---

## 🔧 Troubleshooting Comum

### Backend não inicia
```bash
# Verificar logs
pm2 logs mvp-backend

# Verificar variáveis de ambiente
pm2 env 0

# Verificar conexão com banco
psql -h localhost -U deploy -d mvp_system
```

### Frontend não carrega
```bash
# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Verificar build
cd /var/www/mvp-system/frontend
npm run build
```

### Erro de permissão
```bash
sudo chown -R deploy:deploy /var/www/mvp-system
sudo chmod -R 755 /var/www/mvp-system
```

---

## 📈 Performance e Otimização

### Configurações PostgreSQL
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```ini
# Memória
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

# Conexões
max_connections = 100

# Logs
log_statement = 'all'
log_duration = on
```

### Configurações PM2
```javascript
// ecosystem.config.js
instances: 2, // Para 2+ CPUs
max_memory_restart: '1G',
```

---

## ✅ Checklist Final

- [ ] VPS configurada com Ubuntu
- [ ] Node.js 18+ instalado
- [ ] PostgreSQL configurado
- [ ] Projeto clonado e configurado
- [ ] Variáveis de ambiente definidas
- [ ] Migrações executadas
- [ ] Backend buildado e rodando com PM2
- [ ] Frontend buildado
- [ ] Nginx configurado
- [ ] SSL instalado
- [ ] Firewall configurado
- [ ] Backup automático configurado
- [ ] Monitoramento ativo

---

## 🆘 Suporte

Em caso de problemas:
1. Verificar logs em `/var/log/`
2. Usar `pm2 logs` para backend
3. Usar `sudo nginx -t` para testar configuração
4. Verificar status com `systemctl status`

---

**Parabéns! 🎉 Seu MVP System está rodando em produção na VPS!**
