import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

# ==========================================
# CONFIGURAÇÕES GERAIS
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.abspath(os.path.join(BASE_DIR, '../../frontend/public/templates'))
FONTS_DIR = os.path.join(BASE_DIR, 'fonts')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')

# Paleta de Cores (RGB para Pillow)
COLOR_BLUE = (0, 149, 255)
COLOR_DARK_BLUE = (11, 17, 32)
COLOR_WHITE = (255, 255, 255)
COLOR_BLACK = (0, 0, 0)

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def load_font(font_name, size):
    font_path = os.path.join(FONTS_DIR, font_name)
    try:
        return ImageFont.truetype(font_path, size)
    except IOError:
        return ImageFont.load_default()

def draw_text_wrapped(draw, text, font, color, x, y, max_width, line_spacing=10, align='left', max_lines=None):
    """Desenha texto com quebra de linha automática respeitando max_width."""
    if not text: return
    
    lines = []
    # Preservar quebras de linha manuais do usuário
    paragraphs = text.split('\n')
    
    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append('')
            continue
            
        current_line = words[0]
        for word in words[1:]:
            test_line = current_line + ' ' + word
            bbox = draw.textbbox((0, 0), test_line, font=font)
            text_width = bbox[2] - bbox[0]
            
            if text_width <= max_width:
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        lines.append(current_line)

    # Renderizar linhas
    current_y = y
    try:
        # Altura da linha baseada na fonte
        ascent, descent = font.getmetrics()
        line_height = ascent + descent + line_spacing
    except:
        line_height = font.size + line_spacing

    if max_lines is not None:
        lines = lines[:max_lines]

    for line in lines:
        if align == 'center':
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]
            draw.text((x - line_width / 2, current_y), line, font=font, fill=color)
        else:
            draw.text((x, current_y), line, font=font, fill=color)
        current_y += line_height

def _layout_by_id(layout_list):
    if not isinstance(layout_list, list):
        return {}
    out = {}
    for item in layout_list:
        if isinstance(item, dict) and 'id' in item:
            out[item['id']] = item
    return out

def _font_file_from_family(font_family, font_weight):
    ff = (font_family or '').lower()
    fw = (font_weight or '').lower()

    if ff in ['poppins', 'poppinsbold', 'poppins-bold'] or fw == 'bold':
        return 'poppins-bold.ttf'
    return 'lato-regular.ttf'

def get_template_image(filename):
    """Carrega template ou cria fallback escuro."""
    path = os.path.join(TEMPLATES_DIR, filename)
    if os.path.exists(path):
        return Image.open(path).convert("RGBA")
    else:
        print(f"Aviso: Template {filename} não encontrado. Usando fallback.")
        return Image.new('RGBA', (1920, 1080), (15, 23, 42))

# ==========================================
# RENDERIZADORES POR TIPO DE LAYOUT
# ==========================================

def render_defesa(data, output_name):
    """
    TIPO: DEFESA DA CAMPANHA
    Template: template_defesa_da_campanha.png
    Conteúdo:
    - Título (JÁ EXISTE NO TEMPLATE)
    - Subtítulo: Frase do slogan (abaixo do título)
    - Texto: Texto corrido (lado direito)
    """
    template_file = 'template_defesa_da_campanha.png'
    img = get_template_image(template_file)
    draw = ImageDraw.Draw(img)
    
    layout = _layout_by_id(data.get('layout'))

    font_subtitle = load_font('poppins-bold.ttf', 22)
    font_body = load_font('lato-regular.ttf', 22)
    
    # Subtítulo (Frase do Slogan)
    subtitulo = data.get('subtitulo', '')
    if subtitulo:
        b = layout.get('subtitulo')
        if b:
            font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 22)))
            max_w = int(b.get('width', 900))
            draw_text_wrapped(draw, subtitulo.upper(), font, b.get('color', '#FFFFFF'), float(b.get('x', 174)), float(b.get('y', 636)), max_w, line_spacing=0, align=b.get('align', 'left'), max_lines=1)
        else:
            draw_text_wrapped(draw, subtitulo.upper(), font_subtitle, COLOR_WHITE, 174, 636, 900, line_spacing=0, align='left', max_lines=1)
    
    # Texto Direito (Texto explicativo)
    texto_longo = data.get('texto_longo', data.get('texto', ''))
    b = layout.get('texto')
    if b:
        font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 22)))
        max_w = int(b.get('width', 900))
        draw_text_wrapped(draw, texto_longo, font, b.get('color', '#FFFFFF'), float(b.get('x', 936)), float(b.get('y', 147)), max_w, line_spacing=10, align=b.get('align', 'left'))
    else:
        draw_text_wrapped(draw, texto_longo, font_body, COLOR_WHITE, 936, 147, 900, line_spacing=10)
    
    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def render_metas(data, output_name):
    """
    TIPO: METAS DO MÊS
    Template: template_metas.png
    Conteúdo:
    - Título (JÁ EXISTE NO TEMPLATE)
    - Subtítulo: Mês vigente (abaixo do título)
    - Texto: Texto corrido das metas (lado direito)
    """
    template_file = 'template_metas.png'
    img = get_template_image(template_file)
    draw = ImageDraw.Draw(img)
    
    layout = _layout_by_id(data.get('layout'))

    font_subtitle = load_font('lato-regular.ttf', 32)
    font_body = load_font('lato-regular.ttf', 22)
    
    # Subtítulo (Mês)
    mes = data.get('mes', '')
    if mes:
        b = layout.get('mes')
        if b:
            font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 32)))
            draw.text((float(b.get('x', 100)), float(b.get('y', 520))), mes.upper(), font=font, fill=b.get('color', '#FFFFFF'))
        else:
            draw.text((100, 520), mes.upper(), font=font_subtitle, fill=COLOR_WHITE)
    
    # Texto Direito (Descrição das metas)
    texto_longo = data.get('texto_longo', '')
    b = layout.get('texto')
    if b:
        font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 22)))
        max_w = int(b.get('width', 900))
        draw_text_wrapped(draw, texto_longo, font, b.get('color', '#FFFFFF'), float(b.get('x', 936)), float(b.get('y', 147)), max_w, line_spacing=10, align=b.get('align', 'left'))
    else:
        draw_text_wrapped(draw, texto_longo, font_body, COLOR_WHITE, 936, 147, 900, line_spacing=10)
    
    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def render_desafios(data, output_name):
    """
    TIPO: NOVOS DESAFIOS
    Template: template_novos_desafios.png
    Conteúdo:
    - Título (JÁ EXISTE NO TEMPLATE)
    - Grid 3x3 no lado direito (9 frases curtas)
    """
    template_file = 'template_novos_desafios.png'
    img = get_template_image(template_file)
    draw = ImageDraw.Draw(img)
    
    layout = _layout_by_id(data.get('layout'))

    font_item = load_font('lato-regular.ttf', 20)
    
    # Grid 3x3 (APENAS lado direito)
    # IMPORTANTE: preservar índices 0..8 (mesmo que alguns itens estejam vazios)
    items = data.get('itens', data.get('items', []))
    if isinstance(items, str):
        parsed = [line.strip('• ').strip() for line in items.split('\n')]
        items = parsed

    if not isinstance(items, list):
        items = []

    # Normalizar para exatamente 9 itens
    normalized = []
    for i in range(9):
        try:
            v = items[i]
        except Exception:
            v = ''
        v = (str(v) if v is not None else '').strip()
        normalized.append(v)
    items = normalized

    # Coordenadas dos boxes (top-left) conforme referência do template
    default_positions = [
        (903, 264),
        (1190, 243),
        (1488, 249),
        (915, 487),
        (1197, 489),
        (1479, 476),
        (938, 684),
        (1212, 680),
        (1486, 680),
    ]
    
    # Índices de fundo branco (texto preto) - Verificar visualmente o template depois se possível
    # Assumindo padrão xadrez ou similar
    white_bg_indices = [2, 3, 5, 7]
    
    # Se existir layout vindo do editor, usar ele (ids item-0..item-8)
    if layout:
        for i in range(9):
            b = layout.get(f'item-{i}')
            if not b:
                continue
            text = items[i]

            box_x = float(b.get('x', 0))
            box_y = float(b.get('y', 0))
            box_w = float(b.get('width', 280))
            box_h = float(b.get('height', 280))

            cx = box_x + box_w / 2
            cy = box_y + box_h / 2

            text_color = b.get('color', '#FFFFFF')
            font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 20)))
            max_w = int(max(10, box_w - 20))

            # Quebrar em até 4 linhas e centralizar verticalmente
            # Renderiza a partir do topo do bloco, ajustando para ficar central
            ascent, descent = font.getmetrics()
            line_height = ascent + descent + 8
            tmp_lines = []
            paragraphs = text.split('\n')
            for paragraph in paragraphs:
                words = paragraph.split()
                if not words:
                    tmp_lines.append('')
                    continue
                current_line = words[0]
                for word in words[1:]:
                    test_line = current_line + ' ' + word
                    bbox = draw.textbbox((0, 0), test_line, font=font)
                    text_width = bbox[2] - bbox[0]
                    if text_width <= max_w:
                        current_line = test_line
                    else:
                        tmp_lines.append(current_line)
                        current_line = word
                tmp_lines.append(current_line)
            tmp_lines = tmp_lines[:4]
            total_h = len(tmp_lines) * line_height
            start_y_text = cy - total_h / 2
            for line in tmp_lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                w = bbox[2] - bbox[0]
                draw.text((cx - w/2, start_y_text), line, font=font, fill=text_color)
                start_y_text += line_height

        img.save(os.path.join(OUTPUT_DIR, output_name))
        print(f"[OK] Gerado: {output_name}")
        return

    for idx in range(9):
        x, y = default_positions[idx]
        box_w = 280
        box_h = 280
        cx = x + box_w / 2
        cy = y + box_h / 2
        text = items[idx]

        # Lógica de contraste
        text_color = COLOR_BLACK if idx in white_bg_indices else COLOR_WHITE

        # Centralizar texto no box com wrap
        # Limitador (até 4 linhas) no fallback também
        draw_text_wrapped(draw, text, font_item, text_color, cx, cy - 40, 240, line_spacing=8, align='center', max_lines=4)
    
    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def render_slogan(data, output_name):
    """
    TIPO: SLOGAN DA CAMPANHA
    Template: template_slogan.png
    Conteúdo:
    - Frase da campanha centralizada ACIMA do texto fixo
    """
    template_file = 'template_slogan.png'
    img = get_template_image(template_file)
    draw = ImageDraw.Draw(img)
    
    layout = _layout_by_id(data.get('layout'))

    font_slogan = load_font('poppins-bold.ttf', 70)
    
    frase = data.get('frase', '')
    
    # Frase em uma única linha (auto-shrink se exceder a largura do bloco)
    b = layout.get('frase')
    if b:
        base_size = int(b.get('fontSize', 70))
        max_w = int(b.get('width', 1500))
        color = b.get('color', '#0095FF')
        x = float(b.get('x', 223))
        y = float(b.get('y', 505))

        size = base_size
        while size > 18:
            font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), size)
            bbox = draw.textbbox((0, 0), frase.upper(), font=font)
            w = bbox[2] - bbox[0]
            if w <= max_w:
                break
            size -= 2

        draw.text((x, y), frase.upper(), font=font, fill=color)
    else:
        x = 223
        y = 505
        max_w = 1500
        size = 70
        while size > 18:
            font = load_font('poppins-bold.ttf', size)
            bbox = draw.textbbox((0, 0), frase.upper(), font=font)
            w = bbox[2] - bbox[0]
            if w <= max_w:
                break
            size -= 2

        draw.text((x, y), frase.upper(), font=font, fill=COLOR_BLUE)
    
    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def render_planner(data, output_name):
    """
    TIPO: PLANNER TRIMESTRAL
    Template: template_planner_trimestral.png
    Conteúdo:
    - Título (JÁ EXISTE NO TEMPLATE)
    - Mês abaixo do título
    - Nome do cliente
    - Logo do cliente no quadrado direito
    """
    template_file = 'template_planner_trimestral.png'
    img = get_template_image(template_file)
    draw = ImageDraw.Draw(img)
    
    layout = _layout_by_id(data.get('layout'))

    font_month = load_font('lato-regular.ttf', 32)
    font_client = load_font('poppins-bold.ttf', 32)
    
    # Mês abaixo do título existente
    mes = data.get('mes', '')
    if mes:
        b = layout.get('mes')
        if b:
            font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 32)))
            max_w = int(b.get('width', 980))
            draw_text_wrapped(draw, mes.upper(), font, b.get('color', '#FFFFFF'), float(b.get('x', 187)), float(b.get('y', 584)), max_w, line_spacing=0, align=b.get('align', 'left'), max_lines=1)
        else:
            draw_text_wrapped(draw, mes.upper(), font_month, COLOR_WHITE, 187, 584, 980, line_spacing=0, align='left', max_lines=1)
    
    # Nome do cliente
    nome_cliente = data.get('nome_cliente', '')
    if nome_cliente:
        b = layout.get('nome_cliente')
        if b:
            font = load_font(_font_file_from_family(b.get('fontFamily'), b.get('fontWeight')), int(b.get('fontSize', 24)))
            draw.text((float(b.get('x', 100)), float(b.get('y', 950))), nome_cliente, font=font, fill=b.get('color', '#FFFFFF'))
        else:
            draw.text((210, 696), nome_cliente, font=font_client, fill=COLOR_BLUE)
    
    # Logo do Cliente
    logo_path = data.get('logo_path')
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")

            # Redimensionar logo mantendo proporção (default: max 300x300)
            b = layout.get('logo')
            if b:
                max_w = int(b.get('width', 300))
                max_h = int(b.get('height', 300))
                logo.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

                box_x = float(b.get('x', 120))
                box_y = float(b.get('y', 390))
                box_w = float(b.get('width', 300))
                box_h = float(b.get('height', 300))
                logo_x = int(box_x + (box_w - logo.width) / 2)
                logo_y = int(box_y + (box_h - logo.height) / 2)
            else:
                logo.thumbnail((300, 300), Image.Resampling.LANCZOS)
                # Default: esquerda (meio)
                logo_x = 1241
                logo_y = 533

            img.paste(logo, (logo_x, logo_y), logo)
        except Exception as e:
            print(f"Erro ao carregar logo: {e}")

    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def render_link_cta(data, output_name):
    """
    TIPO: LINK CLICÁVEL (Slide 6)
    Template: template_link_cta.png
    Conteúdo: Apenas imagem estática do template.
    O link clicável é gerenciado pelo frontend (clique na imagem redireciona para a URL).
    """
    template_file = 'template_link_cta.png'
    img = get_template_image(template_file)
    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def render_encerramento(data, output_name):
    """
    TIPO: ENCERRAMENTO (Slide 7)
    Template: template_encerramento.png
    Conteúdo: Apenas imagem estática do template.
    """
    template_file = 'template_encerramento.png'
    img = get_template_image(template_file)
    img.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")

def main():
    print("[INICIO] Iniciando geracao de laminas...")

    # Ler JSON de entrada
    content_path = os.path.join(BASE_DIR, 'content.json')
    if not os.path.exists(content_path):
        print(f"[ERRO] Arquivo {content_path} nao encontrado.")
        return

    try:
        with open(content_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
    except Exception as e:
        print(f"[ERRO] Falha ao ler JSON: {e}")
        return

    # Garantir diretório de saída
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    print(f"[INFO] Conteudo recebido: {list(content.keys())}")

    # Processar cada slide
    # Mapeamento estrito baseado nas chaves do JSON

    if 'defesa' in content:
        render_defesa(content['defesa'], '01_defesa.png')

    if 'grid' in content:
        render_metas(content['grid'], '02_metas.png')

    if 'slogan' in content:
        render_slogan(content['slogan'], '03_slogan.png')

    if 'desafios' in content:
        render_desafios(content['desafios'], '04_desafios.png')

    if 'planner' in content:
        render_planner(content['planner'], '05_planner.png')

    if 'link_cta' in content:
        render_link_cta(content['link_cta'], '06_link_cta.png')

    if 'encerramento' in content:
        render_encerramento(content['encerramento'], '07_encerramento.png')

    print("\n[SUCESSO] Laminas geradas.")

if __name__ == "__main__":
    main()
