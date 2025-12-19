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
    """
    Cria estrutura fixa (linhas 1-8): título + legenda
    """
    # Limpar área do cabeçalho/legenda para evitar duplicações vindas do template
    for r in range(1, 9):
        for c in range(1, 9):  # A..H
            ws.cell(row=r, column=c).value = ''

    # Linha 1: Título
    ws['A1'] = month_label
    ws['B1'] = client_name
    ws['H1'] = 'CHAVE'
    
    # Linhas 2-7: Legenda de tipos de conteúdo
    ws['A2'] = 'Reels'
    ws['A3'] = 'Arte'
    ws['B3'] = 'Conteúdo'
    ws['A4'] = 'Foto'
    ws['B4'] = 'Institucional'
    ws['A5'] = 'Arte'
    ws['B5'] = 'Institucional'
    ws['A6'] = 'Campanha'
    ws['A7'] = 'Outros'
    
    # Linha 8: Vazia (separador)

def fill_single_month(ws, posts, month_num, year_num, client_name, month_label):
    """
    Preenche uma aba com estrutura fixa + blocos semanais de 6 linhas
    Colunas: A=Domingo, B=Segunda, C=Terça, D=Quarta, E=Quinta, F=Sexta, G=Sábado
    """
    # Criar estrutura fixa (linhas 1-8)
    create_fixed_structure(ws, month_label, client_name)

    # Blocos semanais começam na linha 9, cada bloco tem 6 linhas
    week_start_rows = [9, 15, 21, 27, 33, 39]  # até 6 semanas

    # Colunas: A=Domingo(0) ... G=Sábado(6)
    col_by_dow = {
        0: 'A',  # Domingo
        1: 'B',  # Segunda
        2: 'C',  # Terça
        3: 'D',  # Quarta
        4: 'E',  # Quinta
        5: 'F',  # Sexta
        6: 'G'   # Sábado
    }

    day_labels = {
        0: 'DOMINGO',
        1: 'SEGUNDA',
        2: 'TERÇA',
        3: 'QUARTA',
        4: 'QUINTA',
        5: 'SEXTA',
        6: 'SÁBADO'
    }

    _, days_in_month = calendar.monthrange(year_num, month_num)

    # Calcular dia da semana do dia 1 (0=Segunda...6=Domingo)
    first_weekday_mon0 = datetime(year_num, month_num, 1).weekday()
    # Converter para 0=Domingo...6=Sábado
    first_weekday_sun0 = (first_weekday_mon0 + 1) % 7

    # Preencher cabeçalhos dos dias em cada semana
    for week_index, header_row in enumerate(week_start_rows):
        # Limpar bloco inteiro (6 linhas) antes de preencher, evitando sobras do template
        # (ex: cabeçalhos duplicados, "----" etc)
        for r in range(header_row, header_row + 6):
            for c in range(1, 8):  # A..G
                ws.cell(row=r, column=c).value = ''

        for dow in range(7):  # 0=Dom...6=Sab
            day_num = (week_index * 7) - first_weekday_sun0 + dow + 1
            col = col_by_dow[dow]
            if 1 <= day_num <= days_in_month:
                ws[f'{col}{header_row}'] = f"{day_labels[dow]} ({day_num})"
            else:
                ws[f'{col}{header_row}'] = ''

    # Preencher posts do JSON nos dias corretos
    total_posts_filled = 0
    for post in posts:
        try:
            day = int(post['day'])
            if day < 1 or day > days_in_month:
                continue

            # Calcular posição do dia no calendário
            position = (day - 1) + first_weekday_sun0
            week_index = position // 7
            dow = position % 7

            if week_index >= len(week_start_rows):
                continue

            header_row = week_start_rows[week_index]
            tipo_row = header_row + 1      # Linha 2 do bloco: tipo
            categoria_row = header_row + 2  # Linha 3 do bloco: categoria (se houver)
            desc_row = header_row + 3       # Linha 4 do bloco: descrição
            col = col_by_dow[dow]

            # Preencher tipo (ex: "Arte", "Reels", "Foto")
            formato = post.get('formato', 'Static')
            if formato == 'Static':
                ws[f'{col}{tipo_row}'] = 'Arte'
                ws[f'{col}{categoria_row}'] = 'Conteúdo'
            elif formato == 'Reels':
                ws[f'{col}{tipo_row}'] = 'Reels'
            elif formato == 'Carrossel':
                ws[f'{col}{tipo_row}'] = 'Carrossel'
            elif formato == 'Stories':
                ws[f'{col}{tipo_row}'] = 'Stories'
            elif formato == 'Photos':
                ws[f'{col}{tipo_row}'] = 'Foto'
                ws[f'{col}{categoria_row}'] = 'Institucional'
            else:
                ws[f'{col}{tipo_row}'] = 'Arte'
                ws[f'{col}{categoria_row}'] = 'Conteúdo'

            # Preencher descrição (resumida)
            title = post.get('title', '')
            # Limitar descrição a ~100 caracteres para caber na célula
            desc = title[:100] + '...' if len(title) > 100 else title
            ws[f'{col}{desc_row}'] = desc
            
            total_posts_filled += 1
        except Exception as e:
            print(f"[WARN] Erro ao preencher post: {e}")

    return total_posts_filled

def fill_calendar_template(calendar_json, template_path, output_path, client_name, month_name, year, periodo=None):
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

    # Preferir uma aba base estável do template (evita pegar uma aba "(2)" por engano)
    if "CoreSport_Março" in wb.sheetnames:
        base_ws = wb["CoreSport_Março"]
    else:
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

    # Determinar quais meses devem virar abas
    sorted_months = sorted(posts_by_month.keys())
    if not sorted_months:
        sorted_months = [start_month_num]
        posts_by_month[start_month_num] = []

    # Se for trimestral, forçar 3 meses consecutivos a partir do mês inicial
    if is_trimestral(periodo):
        forced = []
        for offset in range(3):
            m = start_month_num + offset
            if m > 12:
                m -= 12
            forced.append(m)
            if m not in posts_by_month:
                posts_by_month[m] = []
        sorted_months = forced

    # Limpar sheets extras do template, mantendo somente base_ws
    for name in list(wb.sheetnames):
        if wb[name] is not base_ws:
            wb.remove(wb[name])

    total_posts_filled = 0
    for m_num in sorted_months:
        # Ajuste de ano se o período cruzar ano (ex: Dezembro->Janeiro)
        y_num = year_num
        if m_num < start_month_num:
            y_num = year_num + 1

        month_label = f"{month_name_pt(m_num)} {y_num}"
        sheet_title = f"{client_name}_{month_name_pt(m_num)}"
        ws = prepare_month_sheet(wb, base_ws, sheet_title)

        filled = fill_single_month(
            ws,
            posts_by_month.get(m_num, []),
            m_num,
            y_num,
            client_name,
            month_label
        )
        total_posts_filled += filled

    # Remover a aba base do template do arquivo final (evita manter "CoreSport_*" no output)
    try:
        if base_ws.title in wb.sheetnames and base_ws.title.startswith("CoreSport"):
            wb.remove(base_ws)
    except Exception:
        pass
    
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
            periodo
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
