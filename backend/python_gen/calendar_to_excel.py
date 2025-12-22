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
        'Carrossel': 'Carrossel',
        'Stories': 'Stories',
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

    # Blocos semanais do template: cabeçalho do dia, linha do tipo e bloco de resumo.
    # Padrão observado:
    # - header: 9, 14, 20, 26, 32, 38
    # - tipo:   10,15, 21, 27, 33, 39
    # - resumo: (header+2..+4)
    week_start_rows = [9, 14, 20, 26, 32, 38]  # até 6 semanas
    col_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

    _, days_in_month = calendar.monthrange(year_num, month_num)

    day_to_slot = {}
    for header_row in week_start_rows:
        for col in col_letters:
            v = ws[f"{col}{header_row}"].value
            if not v:
                continue
            s = str(v)
            m = re.search(r"\((\d{1,2})\)", s)
            if not m:
                continue
            d = int(m.group(1))
            if 1 <= d <= days_in_month:
                day_to_slot[d] = (header_row, col)

    # Validar alinhamento do layout:
    # - Se o mês começa no domingo, o dia 1 deve estar em A na primeira linha.
    # - Se o mês NÃO começa no domingo, o template esperado (como no print) é a 1ª semana "encaixada" na esquerda,
    #   então o dia 1 também deve estar em A (com o dia da semana real).
    try:
        first_weekday_mon0 = datetime(year_num, month_num, 1).weekday()  # 0=Seg ... 6=Dom
        first_weekday_sun0 = (first_weekday_mon0 + 1) % 7  # 0=Dom ... 6=Sáb
        slot_day1 = day_to_slot.get(1)
        if slot_day1 is not None:
            _, col1 = slot_day1
            if col1 != 'A':
                # Ex.: planilha com SEGUNDA(1) em B. Forçar regeneração.
                day_to_slot = {}
    except Exception:
        pass

    if len(day_to_slot) != days_in_month:
        day_labels = {
            0: 'DOMINGO',
            1: 'SEGUNDA',
            2: 'TERÇA',
            3: 'QUARTA',
            4: 'QUINTA',
            5: 'SEXTA',
            6: 'SÁBADO'
        }

        # O template usa a 1ª semana "encaixada" na esquerda: o dia 1 começa na coluna A,
        # e preenche até sábado, sem criar a coluna de domingo nessa primeira linha.
        first_weekday_mon0 = datetime(year_num, month_num, 1).weekday()  # 0=Seg ... 6=Dom
        first_weekday_sun0 = (first_weekday_mon0 + 1) % 7  # 0=Dom ... 6=Sáb

        day_to_slot = {}
        current_day = 1

        for week_index, header_row in enumerate(week_start_rows):
            # Semana 0: começa no dia da semana do dia 1 e vai até sábado, começando na col A
            if week_index == 0 and first_weekday_sun0 != 0:
                cols_in_week = []
                # mapeia: coluna A corresponde ao first_weekday_sun0 (ex.: SEGUNDA), coluna B ao próximo, ... até sábado
                for offset in range(0, 7 - first_weekday_sun0):
                    cols_in_week.append((col_letters[offset], first_weekday_sun0 + offset))
                for col, dow in cols_in_week:
                    if current_day <= days_in_month:
                        ws[f"{col}{header_row}"].value = f"{day_labels[dow]} ({current_day})"
                        day_to_slot[current_day] = (header_row, col)
                        current_day += 1
                # limpar as colunas restantes na linha (se houver)
                for c in col_letters[len(cols_in_week):]:
                    ws[f"{c}{header_row}"].value = None
                continue

            # Demais semanas: grade normal (domingo..sábado) em A..G
            for dow in range(7):
                col = col_letters[dow]
                if current_day <= days_in_month:
                    ws[f"{col}{header_row}"].value = f"{day_labels[dow]} ({current_day})"
                    day_to_slot[current_day] = (header_row, col)
                    current_day += 1
                else:
                    ws[f"{col}{header_row}"].value = None

            if current_day > days_in_month:
                # já preencheu todo o mês; pode parar de escrever cabeçalhos
                pass

    def _top_left_of_merged(cell_ref: str) -> str:
        # Retorna a coordenada top-left do range mesclado que contém cell_ref, ou a própria cell_ref.
        try:
            for rng in ws.merged_cells.ranges:
                if cell_ref in rng:
                    return str(rng.coord).split(":")[0]
        except Exception:
            pass
        return cell_ref

    def _clear_week_content(header_row: int) -> None:
        # O template tem blocos com conteúdo logo abaixo do cabeçalho.
        # Limpamos apenas VALORES (não estilos/mesclas):
        # - header_row+1: tipo
        # - resumo: semana 1 usa 2 linhas; semanas seguintes usam 3 linhas
        # Observação: há uma linha separadora do bloco (ex.: 13, 19, 25...),
        # então não devemos limpá-la para preservar o espaçamento/estrutura do template.
        for col in col_letters:
            # Semana 1: header=9, tipo=10, resumo=11-12, separador=13
            if header_row == 9:
                last_row_to_clear = header_row + 3
            else:
                # Demais semanas: header=14/20/26/..., tipo=+1, resumo=+2..+4, separador=+5
                last_row_to_clear = header_row + 4

            for r in range(header_row + 1, last_row_to_clear + 1):
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
            short_title = build_post_title(post)

            # Linha do tipo (formato)
            tipo_cell = _top_left_of_merged(f"{col}{header_row + 1}")
            ws[tipo_cell].value = formato_excel

            # Bloco do resumo (3 linhas no template). Normalmente é mesclado verticalmente.
            resumo_cell = _top_left_of_merged(f"{col}{header_row + 2}")
            ws[resumo_cell].value = short_title
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
            if mm in posts_by_month:
                filtered.append(mm)
        if filtered:
            sorted_months = sorted(set(filtered))

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
