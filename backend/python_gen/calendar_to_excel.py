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
    
    print(f"[INFO] Carregando template: {template_path}")
    wb = openpyxl.load_workbook(template_path)
    
    # Usar primeira sheet ou criar nova
    if len(wb.sheetnames) > 0:
        ws = wb.active
        print(f"[INFO] Usando sheet: {ws.title}")
    else:
        ws = wb.create_sheet(f"{client_name}_{month_name}")
        print(f"[INFO] Criando nova sheet: {ws.title}")
    
    # Atualizar título (linha 1, coluna B)
    ws['B1'] = f"{month_name} {year} | {client_name}"
    print(f"[INFO] Título atualizado: {ws['B1'].value}")
    
    # Converter mês para número
    month_num = parse_month_name(month_name)
    year_num = int(year)
    
    # Agrupar posts por semana
    weeks = {}
    for post in calendar_json:
        try:
            # Extrair dia da data (formato: "DD/MM" ou "DD")
            date_str = post.get('data', '01/01')
            if '/' in date_str:
                day = int(date_str.split('/')[0])
            else:
                day = int(date_str)
            
            # Calcular número da semana (0-4)
            week_num = (day - 1) // 7
            
            if week_num not in weeks:
                weeks[week_num] = []
            
            weeks[week_num].append({
                'day': day,
                'formato': post.get('formato', 'Static'),
                'content': post.get('copy_sugestao', post.get('ideia_visual', post.get('tema', '')))
            })
        except Exception as e:
            print(f"[WARN] Erro ao processar post: {e}")
            continue
    
    print(f"[INFO] Total de semanas com posts: {len(weeks)}")
    
    # Linhas de início de cada semana no template
    week_start_rows = [9, 14, 20, 26, 32]
    
    # Mapear dia da semana para coluna
    # 0=Segunda(C), 1=Terça(D), 2=Quarta(E), 3=Quinta(F), 4=Sexta(G), 5=Sábado(A), 6=Domingo(B)
    col_map = {
        0: 'C',  # Segunda
        1: 'D',  # Terça
        2: 'E',  # Quarta
        3: 'F',  # Quinta
        4: 'G',  # Sexta
        5: 'A',  # Sábado
        6: 'B'   # Domingo
    }
    
    # Preencher cada semana
    total_posts_filled = 0
    for week_num, posts in sorted(weeks.items()):
        if week_num >= len(week_start_rows):
            print(f"[WARN] Semana {week_num} excede limite de linhas disponíveis")
            continue
        
        header_row = week_start_rows[week_num]
        format_row = header_row + 1
        content_row = header_row + 2
        
        print(f"\n[INFO] Preenchendo semana {week_num + 1} (linhas {header_row}-{content_row})")
        
        for post in posts:
            day = post['day']
            day_of_week = get_day_of_week(day, month_num, year_num)
            col = col_map.get(day_of_week, 'B')
            
            # Preencher formato
            excel_format = format_to_excel(post['formato'])
            ws[f'{col}{format_row}'] = excel_format
            
            # Preencher conteúdo
            content = post['content']
            ws[f'{col}{content_row}'] = content
            
            print(f"  - Dia {day} ({col}): {excel_format} | {content[:50]}...")
            total_posts_filled += 1
    
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
        print("Uso: python calendar_to_excel.py <calendar_json> <template_path> <output_path> <client_name> <month_name> <year>")
        sys.exit(1)
    
    calendar_json_str = sys.argv[1]
    template_path = sys.argv[2]
    output_path = sys.argv[3]
    client_name = sys.argv[4]
    month_name = sys.argv[5]
    year = sys.argv[6]
    
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
            year
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
