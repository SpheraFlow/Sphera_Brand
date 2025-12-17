#!/bin/bash

# 🚀 Script Rápido de Deploy para VPS Ubuntu
# Uso: bash QUICK_DEPLOY.sh

set -e

echo "🚀 Iniciando deploy MVP System..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar erros
check_error() {
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erro: $1${NC}"
        exit 1
    fi
}

# Função para sucesso
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Função para aviso
warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# 1. Atualizar sistema
echo "📦 Atualizando sistema..."
sudo apt update && sudo apt upgrade -y
success "Sistema atualizado"

# 2. Instalar Node.js
echo "🟢 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
check_error "Falha ao instalar Node.js"
success "Node.js instalado"

# 3. Instalar PostgreSQL
echo "🐘 Instalando PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib
check_error "Falha ao instalar PostgreSQL"
success "PostgreSQL instalado"

# 4. Instalar Python
echo "🐍 Instalando Python..."
sudo apt install -y python3 python3-pip python3-venv build-essential
pip3 install pillow
check_error "Falha ao instalar Python"
success "Python instalado"

# 5. Instalar Nginx
echo "🌐 Instalando Nginx..."
sudo apt install -y nginx
check_error "Falha ao instalar Nginx"
success "Nginx instalado"

# 6. Instalar PM2
echo "⚡ Instalando PM2..."
sudo npm install -g pm2
check_error "Falha ao instalar PM2"
success "PM2 instalado"

# 7. Criar diretório do projeto
echo "📁 Configurando diretórios..."
sudo mkdir -p /var/www/mvp-system
sudo chown -R $USER:$USER /var/www/mvp-system
success "Diretórios criados"

# 8. Clonar projeto (copie manualmente ou ajuste o URL)
echo "📥 Configurando projeto..."
cd /var/www/mvp-system
warning "⚠️ Copie os arquivos do projeto para /var/www/mvp-system ou ajuste o git clone abaixo"
# DESCOMENTE E AJUSTE SE USAR GIT:
# git clone https://github.com/SEU_USER/SEU_REPO.git .

# 9. Instalar dependências backend
echo "📦 Instalando dependências backend..."
cd backend
npm install
check_error "Falha ao instalar dependências backend"
success "Dependências backend instaladas"

# 10. Configurar variáveis de ambiente
echo "🔧 Configurando ambiente..."
if [ ! -f .env ]; then
    cp .env.example .env
    warning "⚠️ Edite o arquivo .env com suas configurações!"
    nano .env
fi

# 11. Build backend
echo "🔨 Buildando backend..."
npm run build
check_error "Falha ao buildar backend"
success "Backend buildado"

# 12. Instalar dependências frontend
echo "📦 Instalando dependências frontend..."
cd ../frontend
npm install
check_error "Falha ao instalar dependências frontend"
success "Dependências frontend instaladas"

# 13. Build frontend
echo "🔨 Buildando frontend..."
npm run build
check_error "Falha ao buildar frontend"
success "Frontend buildado"

# 14. Criar arquivo PM2
echo "⚡ Configurando PM2..."
cd ..
cat > ecosystem.config.js << 'EOF'
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
EOF
success "PM2 configurado"

# 15. Criar diretório de logs
mkdir -p logs

# 16. Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/mvp-system > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

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

    # Arquivos estáticos
    location /presentation-output {
        alias /var/www/mvp-system/backend/python_gen/output;
    }

    location /storage {
        alias /var/www/mvp-system/storage;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/mvp-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
success "Nginx configurado"

# 17. Configurar firewall
echo "🔥 Configurando firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
success "Firewall configurado"

echo ""
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo ""
echo -e "${YELLOW}⚠️ PRÓXIMOS PASSOS MANUAIS:${NC}"
echo "1. Configure o banco de dados PostgreSQL:"
echo "   sudo -u postgres psql"
echo "   CREATE DATABASE mvp_system;"
echo "   CREATE USER deploy WITH PASSWORD 'senha_forte';"
echo "   GRANT ALL PRIVILEGES ON DATABASE mvp_system TO deploy;"
echo ""
echo "2. Execute as migrações:"
echo "   cd /var/www/mvp-system/backend"
echo "   psql -h localhost -U deploy -d mvp_system -f db/schema.sql"
echo ""
echo "3. Configure o arquivo .env com suas chaves de API"
echo ""
echo "4. Inicie o backend com PM2:"
echo "   cd /var/www/mvp-system"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. Configure SSL (opcional):"
echo "   sudo certbot --nginx -d seu-dominio.com"
echo ""
echo -e "${GREEN}🚀 Seu sistema está quase pronto!${NC}"
