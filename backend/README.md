# MVP Backend

Backend desenvolvido com Node.js, TypeScript e Express.

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **TypeScript** - Superset tipado do JavaScript
- **Express** - Framework web minimalista
- **PostgreSQL** - Banco de dados relacional
- **ts-node** - Execução direta de TypeScript
- **nodemon** - Hot reload durante desenvolvimento

## 📦 Dependências

### Produção
- `express` - Framework web
- `cors` - Middleware para CORS
- `dotenv` - Gerenciamento de variáveis de ambiente
- `pg` - Cliente PostgreSQL
- `axios` - Cliente HTTP
- `multer` - Upload de arquivos

### Desenvolvimento
- `typescript` - Compilador TypeScript
- `ts-node` - Executor TypeScript
- `nodemon` - Monitor de arquivos
- `@types/*` - Definições de tipos TypeScript

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Copiar arquivo de exemplo de variáveis de ambiente
cp .env.example .env

# Editar o arquivo .env com suas configurações
```

## ⚙️ Configuração

Edite o arquivo `.env` com suas configurações:

```env
PORT=3001

DB_HOST=localhost
DB_PORT=5432
DB_NAME=mvp_database
DB_USER=postgres
DB_PASSWORD=your_password
```

## 🏃 Como executar

### Modo Desenvolvimento (com hot reload)
```bash
npm run dev
```

### Build para Produção
```bash
npm run build
```

### Executar Produção
```bash
npm start
```

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts    # Configuração do banco de dados
│   │   └── multer.ts      # Configuração do multer
│   ├── routes/
│   │   └── posts.ts       # Rotas de posts
│   └── index.ts           # Arquivo principal
├── uploads/               # Diretório de uploads (gerado)
├── dist/                  # Build de produção (gerado)
├── node_modules/          # Dependências
├── .env                   # Variáveis de ambiente (não versionado)
├── env.example            # Exemplo de variáveis de ambiente
├── database.sql           # Script de criação do banco
├── .gitignore             # Arquivos ignorados pelo Git
├── nodemon.json           # Configuração do nodemon
├── package.json           # Dependências e scripts
├── tsconfig.json          # Configuração do TypeScript
└── README.md              # Documentação
```

## 🔌 Endpoints Disponíveis

### GET /
Retorna o status do backend
```json
{
  "message": "MVP Backend ON",
  "status": "running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /health
Health check do servidor
```json
{
  "status": "healthy",
  "uptime": 123.456,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### API de Posts

#### POST /api/upload-post
Upload de post com arquivo
- **Content-Type**: `multipart/form-data`
- **Body**:
  - `file` (arquivo) - Imagem ou vídeo
  - `clienteId` (string) - ID do cliente
  - `titulo` (string, opcional) - Título do post
  - `descricao` (string, opcional) - Descrição do post

**Resposta de sucesso (201)**:
```json
{
  "message": "Post enviado com sucesso",
  "post": {
    "id": 1,
    "cliente_id": "123",
    "titulo": "Meu post",
    "descricao": "Descrição",
    "arquivo_path": "./uploads/imagem-123456.jpg",
    "arquivo_nome": "imagem-123456.jpg",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "file": {
    "filename": "imagem-123456.jpg",
    "path": "./uploads/imagem-123456.jpg",
    "size": 12345
  }
}
```

#### GET /api/posts/:clienteId
Buscar todos os posts de um cliente
- **Params**: `clienteId` - ID do cliente

**Resposta de sucesso (200)**:
```json
{
  "clienteId": "123",
  "total": 2,
  "posts": [
    {
      "id": 1,
      "cliente_id": "123",
      "titulo": "Post 1",
      "descricao": "Descrição",
      "arquivo_path": "./uploads/imagem-1.jpg",
      "arquivo_nome": "imagem-1.jpg",
      "status": "pendente",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/process-post
Processar um post (atualizar status)
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "postId": 1,
  "status": "processado",
  "metadata": {
    "key": "value"
  }
}
```

**Resposta de sucesso (200)**:
```json
{
  "message": "Post processado com sucesso",
  "post": {
    "id": 1,
    "cliente_id": "123",
    "status": "processado",
    "metadata": { "key": "value" },
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia o servidor em modo desenvolvimento
- `npm run build` - Compila o TypeScript para JavaScript
- `npm start` - Executa a versão compilada
- `npm test` - Executa os testes (a configurar)

## 🔒 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3001` |
| `DB_HOST` | Host do banco de dados | `localhost` |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `DB_NAME` | Nome do banco de dados | - |
| `DB_USER` | Usuário do banco | `postgres` |
| `DB_PASSWORD` | Senha do banco | - |
| `UPLOAD_DIR` | Diretório de uploads | `./uploads` |

## 🗄️ Banco de Dados

Execute o script SQL para criar a tabela de posts:

```bash
psql -U postgres -d mvp_database -f database.sql
```

Ou execute manualmente o conteúdo do arquivo `database.sql` no seu cliente PostgreSQL.

## 📄 Licença

ISC

