#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para preencher template Excel com dados do calendário JSON
Uso: python calendar_to_excel.py <calendar_json> <template_path> <output_path> <client_name> <month_name> <year>
"""

import sys
import json
import openpyxl
from datetime import datetime
from copy import copy
import os
import calendar
import re
from openpyxl.styles import Alignment

def get_day_of_week(day, month, year):
    """
    Retorna o dia da semana (0=Segunda, 6=Domingo)
    
    Args:
        day: Dia do mês (1-31)
        month: Mês (1-12)
        year: Ano (ex: 2026)
    
    Returns:
        int: 0=Segunda, 1=Terça, 2=Quarta, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo
    """
    date_obj = datetime(year, month, day)
    weekday = date_obj.weekday()  # 0=Monday, 6=Sunday
    return weekday

def format_to_excel(formato):
    """
    Converte formato JSON para formato Excel
    
    Args:
        formato: Formato do post (Static, Reels, Carrossel, Stories, Photos)
    
    Returns:
        str: Formato Excel (Arte | Conteúdo, Reels, etc)
    """
    mapping = {
        'Static': 'Arte | Conteúdo',
        'Reels': 'Reels',
        # No "modelo final.xlsx" o dropdown/CF usa categorias (sem 'Carrossel'/'Stories').
        # Para manter cores/validação funcionando, mapeamos para as opções do template.
        'Carrossel': 'Arte | Conteúdo',
        'Stories': 'Outros',
        'Photos': 'Foto | Institucional'
    }
    return mapping.get(formato, 'Arte | Conteúdo')

def parse_month_name(month_name):
    """
    Converte nome do mês em português para número
    
    Args:
        month_name: Nome do mês (Janeiro, Fevereiro, etc) ou "Janeiro 2026"
    
    Returns:
        int: Número do mês (1-12)
    """
    # Remover ano se presente
    month_only = month_name.split()[0].lower()
    
    months = {
        'janeiro': 1,
        'fevereiro': 2,
        'março': 3,
        'marco': 3,
        'abril': 4,
        'maio': 5,
        'junho': 6,
        'julho': 7,
        'agosto': 8,
        'setembro': 9,
        'outubro': 10,
        'novembro': 11,
        'dezembro': 12
    }
    return months.get(month_only, 1)

def parse_year_from_label(month_label, fallback_year):
    try:
        m = re.search(r"(\d{4})", str(month_label))
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return int(fallback_year)

def month_num_from_date_str(date_str, default_month):
    try:
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) >= 2:
                return int(parts[1])
    except Exception:
        pass
    return int(default_month)

def day_from_date_str(date_str):
    if not date_str:
        return 1
    if '/' in date_str:
        return int(str(date_str).split('/')[0])
    return int(str(date_str))

def month_name_pt(month_num):
    names = {
        1: 'Janeiro',
        2: 'Fevereiro',
        3: 'Março',
        4: 'Abril',
        5: 'Maio',
        6: 'Junho',
        7: 'Julho',
        8: 'Agosto',
        9: 'Setembro',
        10: 'Outubro',
        11: 'Novembro',
        12: 'Dezembro'
    }
    return names.get(int(month_num), 'Janeiro')

def build_post_title(post):
    # Preferir tema; se não houver, usar ideia_visual; fallback: primeira frase do copy
    tema = (post.get('tema') or '').strip()
    if tema:
        return tema

    ideia = (post.get('ideia_visual') or '').strip()
    if ideia:
        return ideia

    copy_text = (post.get('copy_sugestao') or '').strip()
    if not copy_text:
        return ''

    first_line = copy_text.split('\n')[0].strip()
    first_sentence = first_line.split('.') [0].strip() if first_line else ''
    result = first_sentence if first_sentence else first_line
    if len(result) > 90:
        return result[:87].rstrip() + '...'
    return result

def ensure_unique_sheet_name(wb, desired_title):
    title = desired_title
    if title not in wb.sheetnames:
        return title
    suffix = 2
    while True:
        candidate = f"{desired_title} ({suffix})"
        if candidate not in wb.sheetnames:
            return candidate
        suffix += 1

def is_trimestral(periodo):
    try:
        if periodo is None:
            return False
        p = int(str(periodo).strip())
        # Alguns calendários usam 30/60/90 dias; outros podem usar 1/3 meses
        return p >= 90 or p == 3
    except Exception:
        return False

def prepare_month_sheet(wb, base_ws, sheet_title):
    # Remover sheet existente com mesmo nome para evitar '(2)'
    if sheet_title in wb.sheetnames:
        wb.remove(wb[sheet_title])
    ws = wb.copy_worksheet(base_ws)
    ws.title = sheet_title
    return ws

def create_fixed_structure(ws, month_label, client_name):
    title_value = f"{month_label} | {client_name}".strip(" |")
    # Alguns templates têm o título em A1 (ex.: A1:F7), outros em B1 (ex.: B1:G7).
    # Para não deslocar layout, escrevemos no local que já contém o título do template.
    try:
        if ws["A1"].value:
            ws["A1"] = title_value
        elif ws["B1"].value:
            ws["B1"] = title_value
        else:
            ws["A1"] = title_value
    except Exception:
        ws["A1"] = title_value

    # Não sobrescrever a posição do cabeçalho "CHAVE" do template.
    # Alguns templates usam "CHAVE" em outra coluna (ex.: G1) e qualquer escrita fixa aqui pode deslocar o layout.

def fill_single_month(ws, posts, month_num, year_num, client_name, month_label):
    """
    Preenche uma aba com estrutura fixa + blocos semanais de 6 linhas
    Colunas: A=Domingo, B=Segunda, C=Terça, D=Quarta, E=Quinta, F=Sexta, G=Sábado
    """
    # Criar estrutura fixa (linhas 1-8)
    create_fixed_structure(ws, month_label, client_name)

    # Blocos semanais do template: detectamos automaticamente as linhas de cabeçalho das semanas.
    # Isso evita quebrar quando o template muda (offsets/mesclas).

    def _detect_grid_cols():
        # Alguns templates têm grade em A..G, outros em B..H.
        # Detectar olhando a linha de cabeçalho (row 9): se A9 está vazio mas B9 tem texto de dia, usamos B..H.
        try:
            a9 = str(ws["A9"].value or "").strip()
            b9 = str(ws["B9"].value or "").strip()
            if not a9 and b9:
                return ['B', 'C', 'D', 'E', 'F', 'G', 'H']
        except Exception:
            pass
        return ['A', 'B', 'C', 'D', 'E', 'F', 'G']

    col_letters = _detect_grid_cols()

    def _detect_week_start_rows(max_scan_row: int = 80) -> list:
        # Procura por linhas que tenham cabeçalhos no formato "... (n)".
        # Ex.: "SEGUNDA (1)". Funciona tanto para A..G quanto para B..H.
        rows = []
        try:
            day_header_re = re.compile(r"\((\d{1,2})\)")
            for r in range(1, max_scan_row + 1):
                hits = 0
                for col in col_letters:
                    v = ws[f"{col}{r}"].value
                    if not v:
                        continue
                    s = str(v)
                    if day_header_re.search(s):
                        hits += 1
                # Cabeçalho de semana normalmente tem vários dias na mesma linha
                if hits >= 2:
                    rows.append(r)
        except Exception:
            return []

        # Deduplicar e manter somente o primeiro bloco de 6 semanas (ordem)
        rows = sorted(set(rows))
        # Alguns templates podem ter hits em linhas que não são calendário; limitar para 10 <= r <= 60
        rows = [r for r in rows if 6 <= r <= 80]
        return rows[:6]

    week_start_rows = _detect_week_start_rows()
    if not week_start_rows:
        week_start_rows = [9, 14, 20, 26, 32, 38]

    _, days_in_month = calendar.monthrange(year_num, month_num)

    # Sempre regenerar os cabeçalhos e o mapeamento dia->slot de forma determinística.
    # O template pode vir com textos/posicionamentos diferentes por aba/mês; se tentarmos inferir do texto,
    # qualquer divergência desloca os posts (ex.: dia 2 cai na segunda).
    day_labels = {
        0: 'DOMINGO',
        1: 'SEGUNDA',
        2: 'TERÇA',
        3: 'QUARTA',
        4: 'QUINTA',
        5: 'SEXTA',
        6: 'SÁBADO'
    }

    first_weekday_mon0 = datetime(year_num, month_num, 1).weekday()  # 0=Seg ... 6=Dom
    first_weekday_sun0 = (first_weekday_mon0 + 1) % 7  # 0=Dom ... 6=Sáb

    day_to_slot = {}
    current_day = 1
    for week_index, header_row in enumerate(week_start_rows):
        # Limpar cabeçalhos existentes (valores apenas)
        for col in col_letters:
            try:
                ws[f"{col}{header_row}"].value = None
            except Exception:
                pass

        if current_day > days_in_month:
            continue

        # Semana 0: encaixada (sem o domingo) quando o dia 1 não é domingo.
        if week_index == 0 and first_weekday_sun0 != 0:
            usable_cols = 7 - first_weekday_sun0  # ex.: segunda(1) -> 6 cols
            for offset in range(usable_cols):
                col = col_letters[first_weekday_sun0 + offset]
                dow = first_weekday_sun0 + offset
                if current_day <= days_in_month:
                    ws[f"{col}{header_row}"].value = f"{day_labels[dow]} ({current_day})"
                    day_to_slot[current_day] = (header_row, col)
                    current_day += 1
            continue

        # Demais semanas (e também semana 0 quando começa no domingo): domingo..sábado em A..G
        for dow in range(7):
            col = col_letters[dow]
            if current_day <= days_in_month:
                ws[f"{col}{header_row}"].value = f"{day_labels[dow]} ({current_day})"
                day_to_slot[current_day] = (header_row, col)
                current_day += 1
            else:
                ws[f"{col}{header_row}"].value = None

    def _top_left_of_merged(cell_ref: str) -> str:
        # Retorna a coordenada top-left do range mesclado que contém cell_ref, ou a própria cell_ref.
        try:
            for rng in ws.merged_cells.ranges:
                if cell_ref in rng:
                    return str(rng.coord).split(":")[0]
        except Exception:
            pass
        return cell_ref

    def _merged_range_for(cell_ref: str):
        # Retorna o range mesclado (objeto) que contém a célula, ou None.
        try:
            for rng in ws.merged_cells.ranges:
                if cell_ref in rng:
                    return rng
        except Exception:
            return None
        return None

    def _content_rows_for_week(header_row: int) -> tuple:
        # Determina dinamicamente as linhas do bloco para:
        # - tipo: header_row+1
        # - resumo: começa em header_row+2 e vai até o fim do merge vertical (se existir)
        # Não retorna a linha separadora (a próxima linha), que deve ser preservada.
        tipo_row = header_row + 1
        resumo_start = header_row + 2

        # Usar a primeira coluna da grade como amostra (o template mescla verticalmente por coluna).
        sample_col = col_letters[0] if col_letters else 'A'
        rng = _merged_range_for(f"{sample_col}{resumo_start}")
        if rng is not None:
            resumo_end = rng.max_row
        else:
            # fallback conservador: 2 linhas de resumo
            resumo_end = resumo_start + 1
        return (tipo_row, resumo_start, resumo_end)

    def _has_conditional_formatting() -> bool:
        try:
            cf = getattr(ws, "conditional_formatting", None)
            rules = getattr(cf, "_cf_rules", None)
            return bool(rules)
        except Exception:
            return False

    def _legend_style_for_formato(formato_excel: str):
        # Só usado quando o template NÃO tem formatação condicional.
        # Em templates novos (modelo final.xlsx), as cores vêm de conditional formatting.
        try:
            legend_col = 'G' if (col_letters and col_letters[0] == 'A') else 'H'
            legend_map = {
                'Reels': f'{legend_col}2',
                'Arte | Conteúdo': f'{legend_col}3',
                'Foto | Institucional': f'{legend_col}4',
                'Arte | Institucional': f'{legend_col}5',
                'Campanha': f'{legend_col}6',
                'Outros': f'{legend_col}7',
                'Carrossel': f'{legend_col}3',
                'Stories': f'{legend_col}7',
            }
            addr = legend_map.get(formato_excel)
            if not addr:
                return None
            return ws[addr]
        except Exception:
            return None

    def _clear_week_content(header_row: int) -> None:
        # Limpa apenas valores do bloco de conteúdo (tipo + resumo), preservando a linha separadora.
        tipo_row, resumo_start, resumo_end = _content_rows_for_week(header_row)
        for col in col_letters:
            for r in range(tipo_row, resumo_end + 1):
                try:
                    ws[f"{col}{r}"].value = None
                except Exception:
                    pass

    # Limpar células de post (tipo + resumo) mantendo estilos/mesclas
    cleared_weeks = set()
    for d, (header_row, col) in day_to_slot.items():
        if header_row not in cleared_weeks:
            _clear_week_content(header_row)
            cleared_weeks.add(header_row)

    # Preencher posts do JSON nos dias corretos
    total_posts_filled = 0
    for post in posts:
        try:
            day = int(post['day'])
            if day < 1 or day > days_in_month:
                continue

            slot = day_to_slot.get(day)
            if not slot:
                continue

            header_row, col = slot

            formato_excel = format_to_excel(post.get('formato', 'Static'))
            # Posts aqui já chegam normalizados por fill_calendar_template (com a chave 'title').
            # Se chamarmos build_post_title novamente, o resumo pode ficar vazio.
            short_title = (post.get('title') or '').strip() or build_post_title(post)

            # Linha do tipo (formato)
            tipo_cell = _top_left_of_merged(f"{col}{header_row + 1}")
            ws[tipo_cell].value = formato_excel

            # Em templates com conditional formatting (ex.: modelo final.xlsx), NÃO setar fill/font.
            # A cor deve ser aplicada automaticamente pelo Excel baseado no texto.
            if not _has_conditional_formatting():
                try:
                    legend_cell = _legend_style_for_formato(formato_excel)
                    if legend_cell is not None:
                        ws[tipo_cell].fill = copy(legend_cell.fill)
                        ws[tipo_cell].font = copy(legend_cell.font)
                        ws[tipo_cell].alignment = copy(legend_cell.alignment)
                except Exception:
                    pass

            # Bloco do resumo (3 linhas no template). Normalmente é mesclado verticalmente.
            resumo_cell = _top_left_of_merged(f"{col}{header_row + 2}")
            description = (post.get('descricao') or post.get('description') or post.get('copy_sugestao') or '').strip()
            if description and short_title and description != short_title:
                ws[resumo_cell].value = f"{short_title}\n{description}"
            else:
                ws[resumo_cell].value = description if description else short_title
            try:
                ws[resumo_cell].alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            except Exception:
                pass
            total_posts_filled += 1
        except Exception as e:
            print(f"Erro ao processar post: {e}")
            continue

    return total_posts_filled

def fill_calendar_template(calendar_json, template_path, output_path, client_name, month_name, year, periodo=None, selected_months=None):
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
    
    print(f"[INFO] Carregando template: {template_path}")
    wb = openpyxl.load_workbook(template_path)
    
    if len(wb.sheetnames) == 0:
        wb.create_sheet("Template")

    base_ws = wb.active

    # Converter mês para número e ano
    start_month_num = parse_month_name(month_name)
    year_num = parse_year_from_label(month_name, year)

    # Normalizar posts e agrupar por mês
    posts_by_month = {}
    for post in calendar_json:
        try:
            date_str = post.get('data', '01/01')
            m_num = month_num_from_date_str(date_str, start_month_num)
            d = day_from_date_str(date_str)
            title = build_post_title(post)

            if m_num not in posts_by_month:
                posts_by_month[m_num] = []

            posts_by_month[m_num].append({
                'day': d,
                'formato': post.get('formato', 'Static'),
                'title': title
            })
        except Exception as e:
            print(f"[WARN] Erro ao processar post: {e}")

    sorted_months = sorted(posts_by_month.keys())
    if isinstance(selected_months, list) and len(selected_months) > 0:
        filtered = []
        for m in selected_months:
            try:
                mm = int(m)
            except Exception:
                continue
            if mm < 1 or mm > 12:
                continue
            filtered.append(mm)

        if filtered:
            sorted_months = sorted(set(filtered))
            # Garantir que meses selecionados existam no dicionário mesmo que não tenham posts
            for mm in sorted_months:
                if mm not in posts_by_month:
                    posts_by_month[mm] = []

    if not sorted_months:
        sorted_months = [start_month_num]
        posts_by_month[start_month_num] = []

    month_name_by_num = {m: month_name_pt(m).lower() for m in range(1, 13)}
    template_month_ws_by_num = {}
    for ws in wb.worksheets:
        title_norm = str(ws.title).strip().lower()
        for m in range(1, 13):
            if month_name_by_num[m] in title_norm:
                template_month_ws_by_num[m] = ws

    used_sheets = []

    total_posts_filled = 0
    for m_num in sorted_months:
        y_num = year_num
        if m_num < start_month_num:
            y_num = year_num + 1

        month_label = f"{month_name_pt(m_num)} {y_num}"
        sheet_title = f"{client_name}_{month_name_pt(m_num)}"

        ws = template_month_ws_by_num.get(m_num)
        if ws is None:
            ws = wb.copy_worksheet(base_ws)
        ws.title = ensure_unique_sheet_name(wb, sheet_title)
        used_sheets.append(ws)

        filled = fill_single_month(
            ws,
            posts_by_month.get(m_num, []),
            m_num,
            y_num,
            client_name,
            month_label
        )
        total_posts_filled += filled

    for ws in list(wb.worksheets):
        if ws not in used_sheets:
            wb.remove(ws)
    
    # Criar diretório de saída se não existir
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"[INFO] Diretório criado: {output_dir}")
    
    # Salvar planilha preenchida
    wb.save(output_path)
    print(f"\n[SUCCESS] Planilha salva: {output_path}")
    print(f"[SUCCESS] Total de posts preenchidos: {total_posts_filled}")
    
    return output_path

def main():
    """Função principal"""
    if len(sys.argv) < 7:
        print("Uso: python calendar_to_excel.py <calendar_json> <template_path> <output_path> <client_name> <month_name> <year> [periodo]")
        sys.exit(1)
    
    calendar_json_str = sys.argv[1]
    template_path = sys.argv[2]
    output_path = sys.argv[3]
    client_name = sys.argv[4]
    month_name = sys.argv[5]
    year = sys.argv[6]
    periodo = sys.argv[7] if len(sys.argv) >= 8 else None
    selected_months = None
    if len(sys.argv) >= 9:
        try:
            selected_months = json.loads(sys.argv[8])
        except Exception:
            selected_months = None
    
    try:
        # Parse JSON
        calendar_json = json.loads(calendar_json_str)
        print(f"[INFO] Calendário carregado: {len(calendar_json)} posts")
        
        # Preencher template
        result = fill_calendar_template(
            calendar_json,
            template_path,
            output_path,
            client_name,
            month_name,
            year,
            periodo,
            selected_months
        )
        
        print(f"\n[SUCCESS] Processo concluído com sucesso!")
        sys.exit(0)
        
    except Exception as e:
        print(f"[ERROR] Erro fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
