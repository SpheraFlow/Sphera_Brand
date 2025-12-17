import json
import os
from PIL import Image, ImageDraw, ImageFont

# Configurações de Pastas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
FONTS_DIR = os.path.join(BASE_DIR, 'fonts')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')

# Configurações de Estilo
COLOR_BLUE = "#0095FF"
COLOR_WHITE = "#FFFFFF"
COLOR_BLACK = "#000000"

def load_font(font_name, size):
    """Carrega a fonte solicitada ou usa Arial como fallback."""
    font_path = os.path.join(FONTS_DIR, font_name)
    try:
        return ImageFont.truetype(font_path, size)
    except IOError:
        print(f"Aviso: Fonte {font_name} não encontrada. Usando padrão.")
        return ImageFont.load_default()

def draw_text_wrapped(draw, text, font, color, x, y, max_width, align='left'):
    """Desenha texto com quebra de linha automática."""
    lines = []
    paragraphs = text.split('\n')
    
    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append('')
            continue
            
        current_line = words[0]
        for word in words[1:]:
            # Testa o tamanho da linha com a próxima palavra
            test_line = current_line + ' ' + word
            bbox = draw.textbbox((0, 0), test_line, font=font)
            text_width = bbox[2] - bbox[0]
            
            if text_width <= max_width:
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        lines.append(current_line)

    # Desenhar linha por linha
    current_y = y
    line_height = font.getbbox("Ay")[3] + 10  # Altura da linha + espaçamento
    
    for line in lines:
        if align == 'center':
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]
            draw.text((x - line_width / 2, current_y), line, font=font, fill=color)
        else:
            draw.text((x, current_y), line, font=font, fill=color)
        current_y += line_height

def generate_layout_defesa(data):
    print("Gerando layout_defesa...")
    try:
        # Carregar template (ou criar um preto se não existir para teste)
        template_path = os.path.join(TEMPLATES_DIR, 'layout_defesa.png')
        if os.path.exists(template_path):
            img = Image.open(template_path).convert("RGBA")
        else:
            print("Template layout_defesa.png não encontrado. Criando base vazia.")
            img = Image.new('RGBA', (1920, 1080), (15, 23, 42))

        draw = ImageDraw.Draw(img)
        
        # Fontes
        font_title = load_font('Poppins-Bold.ttf', 110)
        font_sub = load_font('OpenSans-Regular.ttf', 24)
        font_body = load_font('OpenSans-Regular.ttf', 32)

        # 1. Título
        draw.text((100, 450), data['titulo'], font=font_title, fill=COLOR_BLUE)

        # 2. Subtítulo
        draw.text((100, 650), data['subtitulo'], font=font_sub, fill=COLOR_WHITE)

        # 3. Corpo do Texto (Wrapped)
        # Area: X=1050, Largura=750px
        draw_text_wrapped(draw, data['texto'], font_body, COLOR_WHITE, 1050, 200, 750)

        # Salvar
        img.save(os.path.join(OUTPUT_DIR, '01_defesa.png'))
        print("Salvo: output/01_defesa.png")

    except Exception as e:
        print(f"Erro ao gerar defesa: {e}")

def generate_layout_grid(data):
    print("Gerando layout_grid...")
    try:
        template_path = os.path.join(TEMPLATES_DIR, 'layout_grid.png')
        if os.path.exists(template_path):
            img = Image.open(template_path).convert("RGBA")
        else:
            print("Template layout_grid.png não encontrado. Criando base vazia.")
            img = Image.new('RGBA', (1920, 1080), (15, 23, 42))

        draw = ImageDraw.Draw(img)
        
        font_title = load_font('Poppins-Bold.ttf', 110)
        font_card = load_font('OpenSans-Regular.ttf', 36) # Fonte um pouco maior para cards

        # 1. Título Lateral
        draw.text((100, 450), data['titulo'], font=font_title, fill=COLOR_BLUE)

        # 2. Grid 3x3
        # Coordenadas Centrais (X, Y)
        grid_coords = [
            (1120, 360), (1440, 360), (1760, 360),
            (1120, 680), (1440, 680), (1760, 680),
            (1120, 1000), (1440, 1000), (1760, 1000)
        ]

        # Índices que devem ser pretos (base 0: 3º item é index 2, etc)
        # Pedido: 3, 4, 8 são brancos -> Texto PRETO.
        # Índices correspondentes: 2, 3, 7
        black_text_indices = [2, 3, 7]

        items = data['items']
        
        for i, (cx, cy) in enumerate(grid_coords):
            if i >= len(items): break
            
            text = items[i]
            color = COLOR_BLACK if i in black_text_indices else COLOR_WHITE
            
            # Centralizar texto no card
            # Usamos anchor='mm' (middle-middle) se disponível no Pillow > 10, senão calculamos
            try:
                draw.text((cx, cy), text, font=font_card, fill=color, anchor="mm")
            except ValueError:
                # Fallback para versões antigas do Pillow
                bbox = draw.textbbox((0, 0), text, font=font_card)
                w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
                draw.text((cx - w/2, cy - h/2), text, font=font_card, fill=color)

        img.save(os.path.join(OUTPUT_DIR, '02_grid.png'))
        print("Salvo: output/02_grid.png")

    except Exception as e:
        print(f"Erro ao gerar grid: {e}")

def generate_layout_slogan(data):
    print("Gerando layout_slogan...")
    try:
        template_path = os.path.join(TEMPLATES_DIR, 'layout_slogan.png')
        if os.path.exists(template_path):
            img = Image.open(template_path).convert("RGBA")
        else:
            print("Template layout_slogan.png não encontrado. Criando base vazia.")
            img = Image.new('RGBA', (1920, 1080), (15, 23, 42))

        draw = ImageDraw.Draw(img)
        
        font_slogan = load_font('Poppins-Bold.ttf', 90)
        font_legend = load_font('OpenSans-Regular.ttf', 24)

        # 1. Frase de Impacto (Centralizada)
        # Usamos draw_text_wrapped com align='center' modificado
        text = data['frase']
        lines = text.split('\n')
        
        # Calcular altura total para centralizar verticalmente
        total_height = 0
        line_height = font_slogan.getbbox("Ay")[3] + 15
        total_height = len(lines) * line_height
        
        start_y = 540 - (total_height / 2) # 540 é o meio da tela
        
        for i, line in enumerate(lines):
            # Calcular largura para centralizar horizontalmente
            bbox = draw.textbbox((0, 0), line, font=font_slogan)
            line_width = bbox[2] - bbox[0]
            draw.text((960 - line_width/2, start_y + (i * line_height)), line, font=font_slogan, fill=COLOR_BLUE)

        # 2. Legenda
        legend_text = data['legenda'].upper()
        bbox = draw.textbbox((0, 0), legend_text, font=font_legend)
        legend_width = bbox[2] - bbox[0]
        draw.text((960 - legend_width/2, 650 + (total_height/2)), legend_text, font=font_legend, fill=COLOR_WHITE)

        img.save(os.path.join(OUTPUT_DIR, '03_slogan.png'))
        print("Salvo: output/03_slogan.png")

    except Exception as e:
        print(f"Erro ao gerar slogan: {e}")

def main():
    # 1. Criar pastas se não existirem
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    # 2. Carregar dados
    try:
        with open(os.path.join(BASE_DIR, 'content.json'), 'r', encoding='utf-8') as f:
            content = json.load(f)
    except FileNotFoundError:
        print("Erro: content.json não encontrado.")
        return

    # 3. Gerar Lâminas
    if 'defesa' in content:
        generate_layout_defesa(content['defesa'])
    
    if 'grid' in content:
        generate_layout_grid(content['grid'])
        
    if 'slogan' in content:
        generate_layout_slogan(content['slogan'])

    print("\nProcesso finalizado! Verifique a pasta 'output'.")

if __name__ == "__main__":
    main()
