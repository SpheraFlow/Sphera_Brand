# Especificação: Mapeamento Calendário JSON → Planilha Excel → PDF

## 📋 Análise Completa

### Estrutura Identificada

#### **CoreSport_Tri_2026.xlsx** (Calendário Preenchido - Exemplo)
- **3 sheets:** Janeiro, Fevereiro, Março
- **Estrutura por semana:**
  - Linha 1: Cabeçalho com dias (DOMINGO (1), SEGUNDA (2), etc)
  - Linha 2: Formato do post (Arte | Conteúdo, Foto | Institucional, Reels, etc)
  - Linha 3: Conteúdo/descrição do post
- **Colunas:** A=Domingo, B=Segunda, C=Terça, D=Quarta, E=Quinta, F=Sexta, G=Sábado
- **Total de posts:** ~35 posts por trimestre (13 Jan + 12 Fev + 10 Mar)

#### **modelo final.xlsx** (Template Vazio)
- **2 sheets:** CoreSport_Março (2), CoreSport_Março
- **Estrutura:** Mesma do CoreSport_Tri_2026, mas com células vazias ou "----"
- **Objetivo:** Template para ser preenchido automaticamente pela IA

---

## 🎯 Objetivo

Criar sistema que:
1. Recebe dados do calendário JSON (gerado pela IA)
2. Preenche automaticamente a planilha "modelo final.xlsx"
3. Gera PDF a partir da planilha preenchida

---

## 📊 Mapeamento de Dados

### **Entrada: Calendário JSON**
```json
[
  {
    "data": "05/01",
    "tema": "Boas vindas a 2026",
    "formato": "Static",
    "ideia_visual": "Fachada da clínica",
    "copy_sugestao": "Boas vindas a 2026! Estamos prontos para cuidar de você.",
    "objetivo": "Engajamento",
    "image_generation_prompt": "..."
  },
  {
    "data": "08/01",
    "tema": "Pilates e saúde mental",
    "formato": "Carrossel",
    "ideia_visual": "...",
    "copy_sugestao": "O que o Pilates tem a ver com a sua saúde mental? Janeiro Branco",
    "objetivo": "Educação",
    "image_generation_prompt": "..."
  }
]
```

### **Saída: Planilha Excel**

#### **Conversão de Formato:**
| JSON `formato` | Excel Linha 2 |
|----------------|---------------|
| Static | Arte \| Conteúdo |
| Reels | Reels |
| Carrossel | Carrossel |
| Stories | Stories |
| Photos | Foto \| Institucional |

#### **Conversão de Data:**
- JSON: `"05/01"` → Excel: Coluna B (Segunda-feira dia 5)
- JSON: `"08/01"` → Excel: Coluna E (Quinta-feira dia 8)

#### **Estrutura de Preenchimento:**

**Exemplo: Post no dia 05/01 (Segunda-feira):**
```
Linha 9:  A9=DOMINGO (4) | B9=SEGUNDA (5) | C9=TERÇA (6) | ...
Linha 10: B10=Arte | Conteúdo
Linha 11: B11=Boas vindas a 2026! Estamos prontos para cuidar de você.
```

---

## 🔧 Implementação

### **1. Backend Python: `calendar_to_excel.py`**

```python
import openpyxl
import json
from datetime import datetime
from copy import copy

def get_day_of_week(date_str, month, year):
    """Converte '05/01' para dia da semana (0=Segunda, 6=Domingo)"""
    day = int(date_str.split('/')[0])
    date_obj = datetime(year, month, day)
    return date_obj.weekday()  # 0=Monday, 6=Sunday

def format_to_excel(formato):
    """Converte formato JSON para formato Excel"""
    mapping = {
        'Static': 'Arte | Conteúdo',
        'Reels': 'Reels',
        'Carrossel': 'Carrossel',
        'Stories': 'Stories',
        'Photos': 'Foto | Institucional'
    }
    return mapping.get(formato, 'Arte | Conteúdo')

def fill_calendar_template(calendar_json, template_path, output_path, client_name, month_name, year):
    """
    Preenche template Excel com dados do calendário JSON
    
    Args:
        calendar_json: Lista de posts do calendário
        template_path: Caminho para modelo final.xlsx
        output_path: Caminho para salvar planilha preenchida
        client_name: Nome do cliente
        month_name: Nome do mês (Janeiro, Fevereiro, etc)
        year: Ano (2026)
    """
    
    # Carregar template
    wb = openpyxl.load_workbook(template_path)
    ws = wb.active
    
    # Atualizar título (linha 1)
    ws['B1'] = f"{month_name} {year} | {client_name}"
    
    # Agrupar posts por semana
    weeks = {}
    for post in calendar_json:
        day = int(post['data'].split('/')[0])
        week_num = (day - 1) // 7  # Semana 0, 1, 2, 3, 4
        if week_num not in weeks:
            weeks[week_num] = []
        weeks[week_num].append(post)
    
    # Linhas de início de cada semana
    week_start_rows = [9, 14, 20, 26, 32]
    
    # Preencher cada semana
    for week_num, posts in weeks.items():
        if week_num >= len(week_start_rows):
            continue
        
        header_row = week_start_rows[week_num]
        format_row = header_row + 1
        content_row = header_row + 2
        
        for post in posts:
            day = int(post['data'].split('/')[0])
            day_of_week = get_day_of_week(post['data'], 
                                          datetime.strptime(month_name, '%B').month, 
                                          year)
            
            # Mapear dia da semana para coluna (B=Domingo, C=Segunda, etc)
            col_map = {6: 'B', 0: 'C', 1: 'D', 2: 'E', 3: 'F', 4: 'G', 5: 'A'}
            col = col_map.get(day_of_week, 'B')
            
            # Preencher formato
            ws[f'{col}{format_row}'] = format_to_excel(post['formato'])
            
            # Preencher conteúdo
            content = post.get('copy_sugestao', post.get('ideia_visual', ''))
            ws[f'{col}{content_row}'] = content
    
    # Salvar planilha preenchida
    wb.save(output_path)
    return output_path
```

### **2. Endpoint Backend: `/api/calendars/export-pdf`**

```typescript
// backend/src/routes/calendar.ts

router.post("/export-pdf", async (req: Request, res: Response) => {
  try {
    const { calendarId, clientName } = req.body;
    
    // 1. Buscar calendário do banco
    const result = await db.query(
      "SELECT calendario_json, mes FROM calendarios WHERE id = $1",
      [calendarId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Calendário não encontrado" });
    }
    
    const calendar = result.rows[0];
    const posts = calendar.calendario_json;
    const monthName = calendar.mes; // "Janeiro 2026"
    
    // 2. Chamar script Python para preencher planilha
    const pythonScript = path.join(__dirname, '../../python_gen/calendar_to_excel.py');
    const templatePath = path.join(__dirname, '../../calendario/modelo final.xlsx');
    const outputPath = path.join(__dirname, '../../calendario/output', `${clientName}_${monthName}.xlsx`);
    
    const pythonProcess = spawn('python', [
      pythonScript,
      JSON.stringify(posts),
      templatePath,
      outputPath,
      clientName,
      monthName,
      '2026'
    ]);
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        // 3. Converter Excel para PDF (usando LibreOffice ou similar)
        const pdfPath = outputPath.replace('.xlsx', '.pdf');
        
        // Converter para PDF
        exec(`libreoffice --headless --convert-to pdf --outdir ${path.dirname(pdfPath)} ${outputPath}`, 
          (error) => {
            if (error) {
              return res.status(500).json({ error: "Erro ao converter para PDF" });
            }
            
            // 4. Retornar PDF
            res.download(pdfPath);
          }
        );
      } else {
        res.status(500).json({ error: "Erro ao preencher planilha" });
      }
    });
    
  } catch (error: any) {
    console.error("Erro ao exportar PDF:", error);
    res.status(500).json({ error: error.message });
  }
});
```

### **3. Frontend: Atualizar `handlePrintCalendar`**

```typescript
// frontend/src/pages/CalendarPage.tsx

const handlePrintCalendar = async () => {
  try {
    setIsGenerating(true);
    
    const response = await api.post('/calendars/export-pdf', {
      calendarId: selectedCalendar?.id,
      clientName: clientName || 'Cliente'
    }, {
      responseType: 'blob'
    });
    
    // Download do PDF
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Calendario_${clientName}_${selectedCalendar?.mes}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    alert('✅ PDF gerado com sucesso!');
  } catch (error: any) {
    console.error('Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF: ' + (error.response?.data?.error || error.message));
  } finally {
    setIsGenerating(false);
  }
};
```

---

## 📦 Dependências Necessárias

### **Backend (Node.js)**
```bash
npm install --save child_process
```

### **Python**
```bash
pip install openpyxl
```

### **Sistema (para conversão PDF)**
```bash
# Ubuntu/Debian
sudo apt-get install libreoffice

# Windows
# Instalar LibreOffice manualmente ou usar alternativa (win32com, etc)
```

---

## 🎯 Fluxo Completo

1. **Usuário clica em "Gerar PDF"** no frontend
2. **Frontend envia** `POST /api/calendars/export-pdf` com `calendarId`
3. **Backend busca** calendário JSON do banco de dados
4. **Python preenche** template Excel com dados do calendário
5. **LibreOffice converte** Excel → PDF
6. **Backend retorna** PDF para download
7. **Frontend baixa** PDF automaticamente

---

## ✅ Próximos Passos

1. ✅ Criar `calendar_to_excel.py` no backend
2. ✅ Adicionar endpoint `/api/calendars/export-pdf`
3. ✅ Atualizar frontend `handlePrintCalendar`
4. ✅ Testar com calendário real
5. ✅ Ajustar formatação e estilos da planilha
