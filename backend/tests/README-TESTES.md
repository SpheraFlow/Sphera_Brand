# 🧪 Guia de Testes - Upload e Processamento IA

## 📁 Arquivo: `test-process-post.rest`

Este arquivo contém testes completos para as rotas de upload e processamento com Google Gemini.

---

## 🚀 Como Usar (REST Client)

### Pré-requisitos:

1. ✅ Servidor rodando (`npm run dev`)
2. ✅ PostgreSQL conectado
3. ✅ Extension REST Client instalada no VSCode/Cursor
4. ✅ Uma imagem de teste disponível no seu computador

---

### Passo a Passo:

#### 1. **Abra o arquivo `test-process-post.rest`**

#### 2. **Configure o caminho da imagem**

Encontre esta linha no arquivo:
```
< C:/caminho/para/sua/imagem.jpg
```

Substitua por um caminho REAL, exemplo:
```
< C:/Users/Balta/Pictures/foto.jpg
```

**Formatos aceitos:** jpg, jpeg, png, gif, webp

#### 3. **Execute PASSO 1 - Upload**

- Localize a seção "PASSO 1: Upload de Post com Imagem"
- Clique em **"Send Request"** logo acima dela
- Aguarde a resposta

**Resposta esperada:**
```json
{
  "success": true,
  "postId": "550e8400-e29b-41d4-a716-446655440000",
  "filePath": "./uploads/foto-1234567890.jpg"
}
```

#### 4. **Execute PASSO 2 - Processar com IA**

- O `postId` é capturado automaticamente do PASSO 1
- Clique em **"Send Request"** no PASSO 2
- Aguarde (pode levar alguns segundos, pois envia para o Gemini)

**Resposta esperada:**
```json
{
  "success": true,
  "postId": "550e8400-e29b-41d4-a716-446655440000",
  "processedId": "660f9511-f39c-52e5-b827-557766551111",
  "analysis": "Esta peça de social media apresenta..."
}
```

---

## 🔧 Alternativa: Teste via PowerShell

Se preferir testar via terminal:

```powershell
# 1. Upload
$imagePath = "C:\Users\Balta\Pictures\foto.jpg"
$form = @{
    file = Get-Item $imagePath
    clienteId = "123e4567-e89b-12d3-a456-426614174000"
    titulo = "Post de Teste"
    descricao = "Teste de processamento IA"
}
$uploadResponse = Invoke-RestMethod -Uri http://localhost:3001/api/upload-post -Method POST -Form $form

Write-Host "Upload concluído! PostId: $($uploadResponse.postId)"

# 2. Processar
$processBody = @{
    postId = $uploadResponse.postId
} | ConvertTo-Json

$processResponse = Invoke-RestMethod -Uri http://localhost:3001/api/process-post -Method POST -Body $processBody -ContentType "application/json"

Write-Host "Processamento concluído!"
Write-Host $processResponse.analysis
```

---

## ⚠️ Troubleshooting

### Erro: "Arquivo é obrigatório"
- Verifique se o caminho do arquivo está correto
- Use barras `/` ou barras duplas `\\` no Windows
- Certifique-se que o arquivo existe

### Erro: "Post não encontrado"
- Execute o PASSO 1 primeiro
- Verifique se o `postId` foi capturado corretamente
- Tente executar novamente

### Erro: "GOOGLE_API_KEY não configurada"
- Configure a chave no `.env`:
```env
GOOGLE_API_KEY=AIzaSy...sua_chave_aqui
```
- Reinicie o servidor

### Erro: "Arquivo do post não encontrado"
- Verifique se a pasta `./uploads` existe
- Verifique se o arquivo foi realmente salvo

---

## 📊 Verificar Resultados no Banco

```sql
-- Ver posts criados
SELECT * FROM posts ORDER BY criado_em DESC LIMIT 5;

-- Ver posts processados
SELECT * FROM posts_processados ORDER BY processado_em DESC LIMIT 5;

-- Ver análise completa
SELECT 
  p.titulo,
  pp.status,
  pp.metadata->>'analysis' as analise,
  pp.processado_em
FROM posts p
JOIN posts_processados pp ON p.id = pp.post_id
ORDER BY pp.processado_em DESC
LIMIT 1;
```

---

## ✅ Checklist de Teste

- [ ] Servidor rodando
- [ ] PostgreSQL conectado
- [ ] Google API Key configurada
- [ ] Imagem de teste pronta
- [ ] Upload executado com sucesso
- [ ] PostId capturado
- [ ] Processamento executado
- [ ] Análise recebida do Gemini
- [ ] Dados salvos no banco

**Testes completos!** 🎉

