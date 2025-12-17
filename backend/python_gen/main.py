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

def draw_text_wrapped(draw, text, font, color, x, y, max_width, line_spacing=10, align='left'):
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

    for line in lines:
        if align == 'center':
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]
            draw.text((x - line_width / 2, current_y), line, font=font, fill=color)
        else:
            draw.text((x, current_y), line, font=font, fill=color)
        current_y += line_height

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
    
    font_subtitle = load_font('Lato-Regular.ttf', 28)
    font_body = load_font('Lato-Regular.ttf', 26)
    
    # Subtítulo (Frase do Slogan)
    subtitulo = data.get('subtitulo', '')
    if subtitulo:
        draw.text((100, 520), subtitulo.upper(), font=font_subtitle, fill=COLOR_WHITE)
    
    # Texto Direito (Texto explicativo)
    texto_longo = data.get('texto_longo', data.get('texto', ''))
    draw_text_wrapped(draw, texto_longo, font_body, COLOR_WHITE, 1050, 200, 750, line_spacing=10)
    
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
    
    font_subtitle = load_font('Lato-Regular.ttf', 32)
    font_body = load_font('Lato-Regular.ttf', 26)
    
    # Subtítulo (Mês)
    mes = data.get('mes', '')
    if mes:
        draw.text((100, 520), mes.upper(), font=font_subtitle, fill=COLOR_WHITE)
    
    # Texto Direito (Descrição das metas)
    texto_longo = data.get('texto_longo', '')
    draw_text_wrapped(draw, texto_longo, font_body, COLOR_WHITE, 1050, 200, 750, line_spacing=10)
    
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
    
    font_item = load_font('Lato-Regular.ttf', 20)
    
    # Grid 3x3 (APENAS lado direito)
    items = data.get('itens', data.get('items', []))
    if isinstance(items, str):
        items = [line.strip('• ').strip() for line in items.split('\n') if line.strip()]
    items = [item.strip() for item in items if item.strip()]
    
    # Coordenadas do Grid (280x280px por box)
    # Ajuste fino das coordenadas baseado no visual do template
    start_x = 1150
    start_y = 300
    step_x = 280
    step_y = 280
    
    # Índices de fundo branco (texto preto) - Verificar visualmente o template depois se possível
    # Assumindo padrão xadrez ou similar
    white_bg_indices = [2, 3, 5, 7]
    
    for row in range(3):
        for col in range(3):
            idx = row * 3 + col
            if idx >= len(items):
                break
            
            cx = start_x + (col * step_x)
            cy = start_y + (row * step_y)
            text = items[idx]
            
            # Lógica de contraste
            text_color = COLOR_BLACK if idx in white_bg_indices else COLOR_WHITE
            
            # Centralizar texto no box com wrap
            try:
                draw.text((cx, cy), text, font=font_item, fill=text_color, anchor="mm")
            except:
                bbox = draw.textbbox((0, 0), text, font=font_item)
                w = bbox[2] - bbox[0]
                h = bbox[3] - bbox[1]
                draw.text((cx - w/2, cy - h/2), text, font=font_item, fill=text_color)
    
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
    
    font_slogan = load_font('Poppins-Bold.ttf', 70)
    
    frase = data.get('frase', '')
    
    # Frase centralizada ACIMA do texto "SLOGAN DA CAMPANHA" (Y=480)
    try:
        draw.text((960, 480), frase.upper(), font=font_slogan, fill=COLOR_BLUE, anchor="mm")
    except:
        bbox = draw.textbbox((0, 0), frase.upper(), font=font_slogan)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text((960 - w/2, 480 - h/2), frase.upper(), font=font_slogan, fill=COLOR_BLUE)
    
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
    
    font_month = load_font('Lato-Regular.ttf', 32)
    font_client = load_font('Lato-Regular.ttf', 24)
    
    # Mês abaixo do título existente
    mes = data.get('mes', '')
    if mes:
        draw.text((100, 520), mes.upper(), font=font_month, fill=COLOR_WHITE)
    
    # Nome do cliente
    nome_cliente = data.get('nome_cliente', '')
    if nome_cliente:
        draw.text((100, 950), nome_cliente, font=font_client, fill=COLOR_WHITE)
    
    # Logo do Cliente
    logo_path = data.get('logo_path')
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
            # Redimensionar logo mantendo proporção (max 300x300)
            logo.thumbnail((300, 300), Image.Resampling.LANCZOS)
            
            # Centralizar no quadrado direito (aprox X=1400, Y=540)
            # Centro do quadrado direito: X ~ 1450, Y ~ 540
            logo_x = 1450 - (logo.width // 2)
            logo_y = 540 - (logo.height // 2)
            
            img.paste(logo, (logo_x, logo_y), logo)
        except Exception as e:
            print(f"Erro ao carregar logo: {e}")

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
        
    # 2. Metas (Texto + Mes)
    if 'grid' in content: # Frontend chama de 'grid' mas é 'Metas'
        render_metas(content['grid'], '02_metas.png')

    # 3. Slogan
        render_slogan(content['slogan'], '03_slogan.png')
        
    if 'desafios' in content:
        render_desafios(content['desafios'], '04_desafios.png')
        
    if 'planner' in content:
        render_planner(content['planner'], '05_planner.png')

    print("\n[SUCESSO] 5 laminas geradas.")

if __name__ == "__main__":
    main()
