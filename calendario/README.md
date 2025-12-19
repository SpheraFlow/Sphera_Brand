# Sistema de Geração de Calendário Excel

## 📋 Visão Geral

Sistema completo para gerar calendários de conteúdo em formato Excel a partir dos dados gerados pela IA. O usuário clica em "Gerar PDF" e recebe automaticamente um arquivo Excel formatado pronto para uso.

---

## 🎯 Fluxo Completo

```
1. Usuário gera calendário com IA → Dados salvos no banco (JSON)
2. Usuário clica em "📄 Gerar PDF" → Frontend chama backend
3. Backend busca dados do banco → Chama script Python
4. Python preenche template Excel → Retorna arquivo preenchido
5. Frontend faz download automático → Usuário recebe Excel pronto
```

---

## 📁 Estrutura de Arquivos

```
calendario/
├── modelo final.xlsx              # Template vazio (será preenchido)
├── CoreSport_Tri_2026.xlsx        # Exemplo completo (referência)
├── output/                        # Arquivos gerados (criado automaticamente)
│   └── Cliente_Janeiro_2026.xlsx
├── ESPECIFICACAO_MAPEAMENTO.md    # Documentação técnica detalhada
└── README.md                      # Este arquivo

backend/
├── python_gen/
│   └── calendar_to_excel.py       # Script Python para preencher Excel
└── src/routes/
    └── calendar.ts                # Endpoint /export-excel

frontend/
└── src/pages/
    └── CalendarPage.tsx           # Botão "Gerar PDF" integrado
```

---

## 🔧 Como Funciona

### **1. Template Excel (modelo final.xlsx)**

Estrutura por mês:
- **Linha 1:** Título (ex: "Janeiro 2026 | Core Sport")
- **Linhas 9, 14, 20, 26, 32:** Início de cada semana
  - Linha N: Cabeçalho com dias (DOMINGO (1), SEGUNDA (2), etc)
  - Linha N+1: Formato do post (Arte | Conteúdo, Reels, etc)
  - Linha N+2: Conteúdo/descrição do post

**Colunas:**
- A = Sábado
- B = Domingo
- C = Segunda
- D = Terça
- E = Quarta
- F = Quinta
- G = Sexta

### **2. Mapeamento de Dados**

**Entrada (JSON do banco):**
```json
[
  {
    "data": "05/01",
    "tema": "Boas vindas a 2026",
    "formato": "Static",
    "copy_sugestao": "Boas vindas a 2026! Estamos prontos...",
    "ideia_visual": "Fachada da clínica"
  }
]
```

**Saída (Excel):**
```
Linha 9:  B9=SEGUNDA (5)
Linha 10: B10=Arte | Conteúdo
Linha 11: B11=Boas vindas a 2026! Estamos prontos...
```

**Conversão de Formato:**
| JSON | Excel |
|------|-------|
| Static | Arte \| Conteúdo |
| Reels | Reels |
| Carrossel | Carrossel |
| Stories | Stories |
| Photos | Foto \| Institucional |

---

## 🚀 Como Usar

### **No Frontend (Usuário):**

1. Acesse a página de Calendários
2. Selecione um calendário gerado
3. Clique no botão **"📄 Gerar PDF"**
4. Aguarde o processamento (5-10 segundos)
5. Arquivo Excel será baixado automaticamente

### **Arquivo Gerado:**

- **Nome:** `Calendario_NomeCliente_Janeiro_2026.xlsx`
- **Formato:** Excel (.xlsx) compatível com Excel, Google Sheets, LibreOffice
- **Conteúdo:** Calendário completo formatado e pronto para uso

---

## 🛠️ Implementação Técnica

### **Backend (Node.js + TypeScript)**

**Endpoint:** `POST /api/calendars/export-excel`

**Request:**
```json
{
  "calendarId": "123",
  "clientName": "Core Sport"
}
```

**Response:** Arquivo Excel (blob)

**Processo:**
1. Busca calendário do banco de dados
2. Extrai dados JSON e mês
3. Chama script Python com spawn
4. Retorna arquivo Excel gerado

### **Script Python**

**Arquivo:** `backend/python_gen/calendar_to_excel.py`

**Uso:**
```bash
python calendar_to_excel.py \
  '<calendar_json>' \
  'template.xlsx' \
  'output.xlsx' \
  'ClientName' \
  'Janeiro' \
  '2026'
```

**Funcionalidades:**
- Carrega template Excel
- Agrupa posts por semana
- Mapeia dia da semana para coluna
- Converte formato JSON → Excel
- Preenche células com dados
- Salva arquivo final

### **Frontend (React + TypeScript)**

**Função:** `handlePrintCalendar()`

**Processo:**
1. Valida calendário selecionado
2. Chama endpoint `/export-excel`
3. Recebe blob do Excel
4. Cria link de download
5. Dispara download automático
6. Exibe mensagem de sucesso

---

## 📦 Dependências

### **Python:**
```bash
pip install openpyxl
```

### **Node.js:**
```bash
# Já incluídas no projeto
- child_process (nativo)
- path (nativo)
- fs (nativo)
```

---

## 🧪 Testando

### **1. Testar Script Python Localmente:**

```bash
cd backend/python_gen

python calendar_to_excel.py \
  '[{"data":"05/01","formato":"Static","copy_sugestao":"Teste"}]' \
  "../../calendario/modelo final.xlsx" \
  "../../calendario/output/teste.xlsx" \
  "Teste" \
  "Janeiro" \
  "2026"
```

### **2. Testar Endpoint Backend:**

```bash
curl -X POST http://localhost:5000/api/calendars/export-excel \
  -H "Content-Type: application/json" \
  -d '{"calendarId":"1","clientName":"Teste"}' \
  --output teste.xlsx
```

### **3. Testar no Frontend:**

1. Gere um calendário com IA
2. Clique em "Gerar PDF"
3. Verifique se arquivo Excel foi baixado
4. Abra no Excel e valide formatação

---

## 🐛 Troubleshooting

### **Erro: "Python não encontrado"**
```bash
# Windows
where python
# Se não encontrar, instale Python 3.x

# Linux/Mac
which python3
# Use python3 no lugar de python
```

### **Erro: "openpyxl não encontrado"**
```bash
pip install openpyxl
# ou
pip3 install openpyxl
```

### **Erro: "Arquivo não foi gerado"**
- Verifique logs do backend (`pm2 logs`)
- Verifique se diretório `calendario/output` existe
- Verifique permissões de escrita

### **Erro: "Calendário não encontrado"**
- Verifique se `calendarId` está correto
- Verifique se calendário existe no banco

---

## 📝 Notas Importantes

1. **Template:** Não modifique a estrutura do `modelo final.xlsx` (linhas de semanas)
2. **Output:** Arquivos gerados ficam em `calendario/output/`
3. **Limpeza:** Considere limpar arquivos antigos periodicamente
4. **Performance:** Geração leva 5-10 segundos (normal)
5. **Formato:** Excel é gerado, não PDF (mais fácil de editar)

---

## 🔄 Próximas Melhorias (Opcional)

- [ ] Converter Excel → PDF automaticamente (LibreOffice)
- [ ] Adicionar formatação de cores no Excel
- [ ] Suportar múltiplos meses em um único arquivo
- [ ] Adicionar logo do cliente no Excel
- [ ] Gerar gráficos de distribuição de posts

---

## ✅ Status Atual

- ✅ Script Python implementado e testado
- ✅ Endpoint backend criado
- ✅ Frontend integrado
- ✅ Mapeamento de dados completo
- ✅ Download automático funcionando
- ⏳ Aguardando teste na VPS

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique logs do backend: `pm2 logs`
2. Verifique console do navegador (F12)
3. Consulte `ESPECIFICACAO_MAPEAMENTO.md` para detalhes técnicos
