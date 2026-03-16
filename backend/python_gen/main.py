import json
import math
import os
from typing import Dict, List, Tuple

from PIL import Image, ImageColor, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.abspath(os.path.join(BASE_DIR, '../../frontend/public/templates'))
FONTS_DIR = os.path.join(BASE_DIR, 'fonts')
OUTPUT_DIR = os.environ.get('PRESENTATION_OUTPUT_DIR') or os.path.join(BASE_DIR, 'output')

COLOR_BLUE = (0, 149, 255)
COLOR_DARK_BLUE = (1, 7, 33)
COLOR_WHITE = (255, 255, 255)
COLOR_BLACK = (0, 0, 0)
GRADIENT_START = (8, 112, 201)
GRADIENT_END = (97, 185, 255)


def load_font(font_name: str, size: int):
    font_path = os.path.join(FONTS_DIR, font_name)
    try:
        return ImageFont.truetype(font_path, size)
    except IOError:
        return ImageFont.load_default()


def color_value(value, default):
    if not value:
        return default
    if isinstance(value, tuple):
        return value
    try:
        return ImageColor.getrgb(str(value))
    except ValueError:
        return default


def layout_by_id(layout_list):
    if not isinstance(layout_list, list):
        return {}
    return {
        item['id']: item
        for item in layout_list
        if isinstance(item, dict) and item.get('id')
    }


def is_legacy_layout_block(block, old_x: int, old_y: int, old_width: int = None, old_height: int = None) -> bool:
    if not isinstance(block, dict):
        return False
    try:
        if round(float(block.get('x', -1))) != old_x or round(float(block.get('y', -1))) != old_y:
            return False
        if old_width is not None and round(float(block.get('width', -1))) != old_width:
            return False
        if old_height is not None and round(float(block.get('height', -1))) != old_height:
            return False
        return True
    except (TypeError, ValueError):
        return False


def font_name_from_layout(block, fallback: str):
    if not block:
        return fallback
    family = str(block.get('fontFamily') or '').lower()
    weight = str(block.get('fontWeight') or '').lower()
    if 'poppins' in family or weight == 'bold':
        return 'poppins-bold.ttf'
    return 'lato-regular.ttf'


def wrap_text(draw, text: str, font, max_width: int) -> List[str]:
    if not text:
        return []

    lines: List[str] = []
    for paragraph in str(text).split('\n'):
        words = paragraph.split()
        if not words:
            lines.append('')
            continue

        current_line = words[0]
        for word in words[1:]:
            test_line = f"{current_line} {word}".strip()
            bbox = draw.textbbox((0, 0), test_line, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        lines.append(current_line)

    return lines


def line_height_for_font(font, line_spacing: int) -> int:
    try:
        ascent, descent = font.getmetrics()
        return ascent + descent + line_spacing
    except Exception:
        return font.size + line_spacing


def draw_text_block(
    draw,
    text: str,
    box: Tuple[float, float, float, float],
    font_name: str,
    font_size: int,
    color,
    align='left',
    valign='top',
    line_spacing=8,
    max_lines=None,
    uppercase=False,
    shrink_to_fit=False,
    min_font_size=16,
):
    if not text:
        return

    prepared = str(text).strip()
    if not prepared:
        return
    if uppercase:
        prepared = prepared.upper()

    x, y, width, height = box
    size = font_size
    font = load_font(font_name, size)
    lines = wrap_text(draw, prepared, font, int(width))

    while shrink_to_fit and size > min_font_size:
        too_many_lines = max_lines is not None and len(lines) > max_lines
        total_height = len(lines) * line_height_for_font(font, line_spacing)
        if total_height <= height and not too_many_lines:
            break
        size -= 2
        font = load_font(font_name, size)
        lines = wrap_text(draw, prepared, font, int(width))

    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]

    total_height = len(lines) * line_height_for_font(font, line_spacing)
    current_y = y if valign == 'top' else y + max(0, (height - total_height) / 2)

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        if align == 'center':
            current_x = x + (width - line_width) / 2
        elif align == 'right':
            current_x = x + width - line_width
        else:
            current_x = x
        draw.text((current_x, current_y), line, font=font, fill=color)
        current_y += line_height_for_font(font, line_spacing)
def build_linear_gradient(size: Tuple[int, int], start_color, end_color, angle_degrees=15):
    width, height = max(1, int(size[0])), max(1, int(size[1]))
    gradient = Image.new('RGBA', (width, height))
    pixels = gradient.load()
    angle_radians = math.radians(angle_degrees)
    cos_value = math.cos(angle_radians)
    sin_value = math.sin(angle_radians)
    projections = [
        0 * cos_value + 0 * sin_value,
        (width - 1) * cos_value + 0 * sin_value,
        0 * cos_value + (height - 1) * sin_value,
        (width - 1) * cos_value + (height - 1) * sin_value,
    ]
    min_projection = min(projections)
    max_projection = max(projections)
    span = max(1e-6, max_projection - min_projection)

    for pixel_y in range(height):
        for pixel_x in range(width):
            projection = pixel_x * cos_value + pixel_y * sin_value
            ratio = max(0.0, min(1.0, (projection - min_projection) / span))
            color = tuple(
                int(start_color[channel] + (end_color[channel] - start_color[channel]) * ratio)
                for channel in range(3)
            ) + (255,)
            pixels[pixel_x, pixel_y] = color

    return gradient


def draw_gradient_text_block(
    base_image,
    draw,
    text: str,
    box: Tuple[float, float, float, float],
    font_name: str,
    font_size: int,
    start_color,
    end_color,
    angle_degrees=15,
    align='left',
    valign='top',
    line_spacing=8,
    max_lines=None,
    uppercase=False,
    shrink_to_fit=False,
    min_font_size=16,
):
    if not text:
        return

    prepared = str(text).strip()
    if not prepared:
        return
    if uppercase:
        prepared = prepared.upper()

    x, y, width, height = box
    size = font_size
    font = load_font(font_name, size)
    lines = wrap_text(draw, prepared, font, int(width))

    while shrink_to_fit and size > min_font_size:
        too_many_lines = max_lines is not None and len(lines) > max_lines
        total_height = len(lines) * line_height_for_font(font, line_spacing)
        if total_height <= height and not too_many_lines:
            break
        size -= 2
        font = load_font(font_name, size)
        lines = wrap_text(draw, prepared, font, int(width))

    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]

    mask = Image.new('L', base_image.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    total_height = len(lines) * line_height_for_font(font, line_spacing)
    current_y = y if valign == 'top' else y + max(0, (height - total_height) / 2)
    rendered_bounds: List[Tuple[int, int, int, int]] = []

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        if align == 'center':
            current_x = x + (width - line_width) / 2
        elif align == 'right':
            current_x = x + width - line_width
        else:
            current_x = x
        mask_draw.text((current_x, current_y), line, font=font, fill=255)
        actual_bbox = mask_draw.textbbox((current_x, current_y), line, font=font)
        rendered_bounds.append(tuple(int(value) for value in actual_bbox))
        current_y += line_height_for_font(font, line_spacing)

    if not rendered_bounds:
        return

    min_x = max(0, min(item[0] for item in rendered_bounds))
    min_y = max(0, min(item[1] for item in rendered_bounds))
    max_x = min(base_image.width, max(item[2] for item in rendered_bounds))
    max_y = min(base_image.height, max(item[3] for item in rendered_bounds))
    gradient = build_linear_gradient((max_x - min_x, max_y - min_y), start_color, end_color, angle_degrees)
    gradient_layer = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
    gradient_layer.paste(gradient, (min_x, min_y))
    alpha_mask = Image.new('L', base_image.size, 0)
    alpha_mask.paste(mask.crop((min_x, min_y, max_x, max_y)), (min_x, min_y))
    base_image.paste(gradient_layer, (0, 0), alpha_mask)


def paste_logo(base_image, logo_path: str, box: Tuple[int, int, int, int]):
    if not logo_path or not os.path.exists(logo_path):
        return

    try:
        logo = Image.open(logo_path).convert('RGBA')
        logo.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
        target_x = int(box[0] + (box[2] - logo.width) / 2)
        target_y = int(box[1] + (box[3] - logo.height) / 2)
        base_image.paste(logo, (target_x, target_y), logo)
    except Exception as exc:
        print(f"[WARN] Falha ao carregar logo: {exc}")


def load_template(*names: str):
    for name in names:
        path = os.path.join(TEMPLATES_DIR, name)
        if os.path.exists(path):
            return Image.open(path).convert('RGBA')
    raise FileNotFoundError(f'Template nao encontrado: {names}')


def clear_output_dir():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        return
    for filename in os.listdir(OUTPUT_DIR):
        if filename.lower().endswith('.png'):
            os.remove(os.path.join(OUTPUT_DIR, filename))


def save_image(image, output_name: str):
    image.save(os.path.join(OUTPUT_DIR, output_name))
    print(f"[OK] Gerado: {output_name}")


def render_cover(data, output_name: str):
    image = load_template('template_planner_trimestral.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))

    month_block = layout.get('mes')
    draw_text_block(
        draw,
        data.get('mes', ''),
        (
            float(month_block.get('x', 191)) if month_block else 191,
            float(month_block.get('y', 634)) if month_block else 634,
            float(month_block.get('width', 470)) if month_block else 470,
            float(month_block.get('height', 40)) if month_block else 40,
        ),
        font_name_from_layout(month_block, 'lato-regular.ttf'),
        int(month_block.get('fontSize', 24)) if month_block else 24,
        color_value(month_block.get('color'), COLOR_WHITE) if month_block else COLOR_WHITE,
        align=month_block.get('align', 'left') if month_block else 'left',
        max_lines=1,
        uppercase=True,
    )

    client_name = str(data.get('nome_cliente', '')).strip()
    if client_name:
        name_block = layout.get('nome_cliente')
        if is_legacy_layout_block(name_block, 191, 725, 360, 36):
            name_block = None
        draw_text_block(
            draw,
            client_name,
            (
                float(name_block.get('x', 230)) if name_block else 230,
                float(name_block.get('y', 725)) if name_block else 725,
                float(name_block.get('width', 360)) if name_block else 360,
                float(name_block.get('height', 36)) if name_block else 36,
            ),
            font_name_from_layout(name_block, 'poppins-bold.ttf'),
            int(name_block.get('fontSize', 28)) if name_block else 28,
            color_value(name_block.get('color'), COLOR_BLUE) if name_block else COLOR_BLUE,
            align=name_block.get('align', 'left') if name_block else 'left',
            max_lines=1,
            uppercase=True,
        )

    logo_block = layout.get('logo')
    paste_logo(
        image,
        data.get('logo_path'),
        (
            int(float(logo_block.get('x', 1060))) if logo_block else 1060,
            int(float(logo_block.get('y', 340))) if logo_block else 340,
            int(float(logo_block.get('width', 430))) if logo_block else 430,
            int(float(logo_block.get('height', 430))) if logo_block else 430,
        ),
    )

    save_image(image, output_name)


def render_diagnostico(data, output_name: str):
    image = load_template('template_diagnostico.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))
    text_block = layout.get('texto')
    if is_legacy_layout_block(text_block, 940, 100, 827, 879) or is_legacy_layout_block(text_block, 996, 100, 715, 879):
        text_block = None

    draw_text_block(
        draw,
        data.get('texto_longo', data.get('texto', '')),
        (
            float(text_block.get('x', 1050)) if text_block else 1050,
            float(text_block.get('y', 210)) if text_block else 210,
            float(text_block.get('width', 650)) if text_block else 650,
            float(text_block.get('height', 650)) if text_block else 650,
        ),
        font_name_from_layout(text_block, 'lato-regular.ttf'),
        int(text_block.get('fontSize', 24)) if text_block else 24,
        color_value(text_block.get('color'), COLOR_WHITE) if text_block else COLOR_WHITE,
        align=text_block.get('align', 'left') if text_block else 'left',
        valign='center',
        line_spacing=12,
    )

    save_image(image, output_name)

def render_desafios(data, output_name: str):
    image = load_template('template_novos_desafios.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))
    items = data.get('itens', data.get('items', []))

    if isinstance(items, str):
        items = [line.strip('-• ').strip() for line in items.split('\n')]
    if not isinstance(items, list):
        items = []

    normalized = []
    for index in range(9):
        normalized.append(str(items[index]).strip() if index < len(items) and items[index] is not None else '')

    positions = [
        (910, 250, 280, 170),
        (1224, 252, 208, 166),
        (1468, 250, 280, 170),
        (940, 485, 229, 149),
        (1190, 460, 280, 170),
        (1490, 471, 235, 168),
        (923, 680, 244, 166),
        (1209, 676, 242, 166),
        (1470, 680, 280, 170),
    ]
    prior_positions = [
        (910, 250, 280, 170),
        (1190, 250, 280, 170),
        (1510, 280, 280, 170),
        (920, 460, 280, 170),
        (1190, 460, 280, 170),
        (1460, 460, 280, 170),
        (910, 680, 280, 170),
        (1190, 680, 280, 170),
        (1470, 680, 280, 170),
    ]
    legacy_positions = [
        (939, 289, 280, 170),
        (1215, 289, 280, 170),
        (1490, 271, 280, 170),
        (928, 477, 280, 170),
        (1218, 495, 280, 170),
        (1490, 477, 280, 170),
        (938, 696, 280, 170),
        (1212, 694, 280, 170),
        (1488, 702, 280, 170),
    ]
    white_background_indices = {2, 3, 7}

    for index, item in enumerate(normalized):
        block = layout.get(f'item-{index}')
        if is_legacy_layout_block(block, *legacy_positions[index]) or is_legacy_layout_block(block, *prior_positions[index]):
            block = None
        box = (
            float(block.get('x', positions[index][0])) if block else positions[index][0],
            float(block.get('y', positions[index][1])) if block else positions[index][1],
            float(block.get('width', positions[index][2])) if block else positions[index][2],
            float(block.get('height', positions[index][3])) if block else positions[index][3],
        )
        draw_text_block(
            draw,
            item,
            box,
            font_name_from_layout(block, 'lato-regular.ttf'),
            int(block.get('fontSize', 24)) if block else 24,
            color_value(block.get('color'), COLOR_BLACK if index in white_background_indices else COLOR_WHITE) if block else (COLOR_BLACK if index in white_background_indices else COLOR_WHITE),
            align=block.get('align', 'center') if block else 'center',
            valign='center',
            line_spacing=8,
            max_lines=3,
            shrink_to_fit=True,
            min_font_size=18,
        )

    save_image(image, output_name)


def render_metas(data, output_name: str):
    image = load_template('template_metas.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))

    month_block = layout.get('mes')
    draw_text_block(
        draw,
        data.get('mes', ''),
        (
            float(month_block.get('x', 191)) if month_block else 191,
            float(month_block.get('y', 639)) if month_block else 639,
            float(month_block.get('width', 460)) if month_block else 460,
            float(month_block.get('height', 34)) if month_block else 34,
        ),
        font_name_from_layout(month_block, 'lato-regular.ttf'),
        int(month_block.get('fontSize', 24)) if month_block else 24,
        color_value(month_block.get('color'), COLOR_WHITE) if month_block else COLOR_WHITE,
        align=month_block.get('align', 'left') if month_block else 'left',
        max_lines=1,
        uppercase=True,
    )

    text_block = layout.get('texto')
    if is_legacy_layout_block(text_block, 940, 100, 827, 879) or is_legacy_layout_block(text_block, 996, 100, 715, 879):
        text_block = None
    draw_text_block(
        draw,
        data.get('texto_longo', data.get('texto', '')),
        (
            float(text_block.get('x', 1048)) if text_block else 1048,
            float(text_block.get('y', 212)) if text_block else 212,
            float(text_block.get('width', 650)) if text_block else 650,
            float(text_block.get('height', 560)) if text_block else 560,
        ),
        font_name_from_layout(text_block, 'lato-regular.ttf'),
        int(text_block.get('fontSize', 24)) if text_block else 24,
        color_value(text_block.get('color'), COLOR_WHITE) if text_block else COLOR_WHITE,
        align=text_block.get('align', 'left') if text_block else 'left',
        valign='center',
        line_spacing=12,
    )

    save_image(image, output_name)


def render_slogan(data, output_name: str):
    image = load_template('template_slogan.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))
    phrase_block = layout.get('frase')

    draw_gradient_text_block(
        image,
        draw,
        data.get('frase', ''),
        (
            float(phrase_block.get('x', 360)) if phrase_block else 360,
            float(phrase_block.get('y', 500)) if phrase_block else 500,
            float(phrase_block.get('width', 1200)) if phrase_block else 1200,
            float(phrase_block.get('height', 110)) if phrase_block else 110,
        ),
        font_name_from_layout(phrase_block, 'poppins-bold.ttf'),
        int(phrase_block.get('fontSize', 76)) if phrase_block else 76,
        GRADIENT_START,
        GRADIENT_END,
        angle_degrees=15,
        align=phrase_block.get('align', 'center') if phrase_block else 'center',
        valign='center',
        line_spacing=4,
        max_lines=2,
        shrink_to_fit=True,
        min_font_size=24,
    )

    save_image(image, output_name)


def render_defesa(data, output_name: str):
    image = load_template('template_defesa_da_campanha.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))

    subtitle_block = layout.get('subtitulo')
    draw_text_block(
        draw,
        data.get('subtitulo', ''),
        (
            float(subtitle_block.get('x', 185)) if subtitle_block else 185,
            float(subtitle_block.get('y', 679)) if subtitle_block else 679,
            float(subtitle_block.get('width', 540)) if subtitle_block else 540,
            float(subtitle_block.get('height', 34)) if subtitle_block else 34,
        ),
        font_name_from_layout(subtitle_block, 'lato-regular.ttf'),
        int(subtitle_block.get('fontSize', 22)) if subtitle_block else 22,
        color_value(subtitle_block.get('color'), COLOR_WHITE) if subtitle_block else COLOR_WHITE,
        align=subtitle_block.get('align', 'left') if subtitle_block else 'left',
        max_lines=1,
        uppercase=True,
    )

    text_block = layout.get('texto')
    if is_legacy_layout_block(text_block, 940, 100, 827, 879) or is_legacy_layout_block(text_block, 996, 100, 715, 879):
        text_block = None
    draw_text_block(
        draw,
        data.get('texto_longo', data.get('texto', '')),
        (
            float(text_block.get('x', 996)) if text_block else 996,
            float(text_block.get('y', 196)) if text_block else 196,
            float(text_block.get('width', 715)) if text_block else 715,
            float(text_block.get('height', 610)) if text_block else 610,
        ),
        font_name_from_layout(text_block, 'lato-regular.ttf'),
        int(text_block.get('fontSize', 24)) if text_block else 24,
        color_value(text_block.get('color'), COLOR_WHITE) if text_block else COLOR_WHITE,
        align=text_block.get('align', 'left') if text_block else 'left',
        valign='center',
        line_spacing=12,
    )

    save_image(image, output_name)


def normalize_roadmap_cards(cards, fallback_months: List[str]):
    normalized = []
    source_cards = cards if isinstance(cards, list) else []
    for index in range(3):
        source = source_cards[index] if index < len(source_cards) and isinstance(source_cards[index], dict) else {}
        normalized.append({
            'mes': str(source.get('mes', fallback_months[index] if index < len(fallback_months) else '')).strip(),
            'titulo': str(source.get('titulo', '')).strip(),
            'detalhe': str(source.get('detalhe', '')).strip(),
            'descricao': str(source.get('descricao', '')).strip(),
            'sugestao': str(source.get('sugestao', '')).strip(),
        })
    return normalized

def render_roadmap(data, output_name: str):
    image = load_template('template_planner_campanhas.png')
    draw = ImageDraw.Draw(image)
    layout = layout_by_id(data.get('layout'))
    cards = normalize_roadmap_cards(data.get('cards'), data.get('fallback_months', []))

    month_boxes = [
        (210, 170, 430, 90),
        (750, 170, 430, 90),
        (1253, 166, 430, 90),
    ]
    prior_month_boxes = [
        (170, 116, 430, 90),
        (718, 116, 430, 90),
        (1286, 116, 430, 90),
    ]
    card_boxes = [
        (177, 226, 493, 594),
        (713, 226, 501, 594),
        (1241, 226, 505, 594),
    ]

    for index, card in enumerate(cards):
        month_block = layout.get(f'roadmap-mes-{index}')
        if is_legacy_layout_block(month_block, *prior_month_boxes[index]):
            month_block = None
        draw_gradient_text_block(
            image,
            draw,
            card['mes'],
            (
                float(month_block.get('x', month_boxes[index][0])) if month_block else month_boxes[index][0],
                float(month_block.get('y', month_boxes[index][1])) if month_block else month_boxes[index][1],
                float(month_block.get('width', month_boxes[index][2])) if month_block else month_boxes[index][2],
                float(month_block.get('height', month_boxes[index][3])) if month_block else month_boxes[index][3],
            ),
            font_name_from_layout(month_block, 'poppins-bold.ttf'),
            int(month_block.get('fontSize', 74)) if month_block else 74,
            GRADIENT_START,
            GRADIENT_END,
            angle_degrees=15,
            align=month_block.get('align', 'center') if month_block else 'center',
            valign='center',
            max_lines=1,
            shrink_to_fit=True,
            min_font_size=36,
        )

        x, y, width, height = card_boxes[index]

        title_block = layout.get(f'roadmap-titulo-{index}')
        prior_title_boxes = [
            (207, 318, 433, 72),
            (743, 318, 441, 72),
            (1271, 318, 445, 72),
        ]
        if is_legacy_layout_block(title_block, *prior_title_boxes[index]):
            title_block = None
        draw_text_block(
            draw,
            card['titulo'],
            (
                float(title_block.get('x', [212, 745, 1275][index])) if title_block else [212, 745, 1275][index],
                float(title_block.get('y', [359, 360, 356][index])) if title_block else [359, 360, 356][index],
                float(title_block.get('width', [433, 441, 445][index])) if title_block else [433, 441, 445][index],
                float(title_block.get('height', 72)) if title_block else 72,
            ),
            font_name_from_layout(title_block, 'poppins-bold.ttf'),
            int(title_block.get('fontSize', 32)) if title_block else 32,
            color_value(title_block.get('color'), COLOR_WHITE) if title_block else COLOR_WHITE,
            align=title_block.get('align', 'center') if title_block else 'center',
            max_lines=2,
            shrink_to_fit=True,
            min_font_size=22,
        )


        description_block = layout.get(f'roadmap-descricao-{index}')
        prior_description_boxes = [
            (219, 474, 409, 170),
            (755, 474, 417, 170),
            (1283, 474, 421, 170),
        ]
        if is_legacy_layout_block(description_block, *prior_description_boxes[index]):
            description_block = None
        draw_text_block(
            draw,
            card['descricao'],
            (
                float(description_block.get('x', [220, 760, 1288][index])) if description_block else [220, 760, 1288][index],
                float(description_block.get('y', [480, 480, 479][index])) if description_block else [480, 480, 479][index],
                float(description_block.get('width', [409, 417, 421][index])) if description_block else [409, 417, 421][index],
                float(description_block.get('height', 170)) if description_block else 170,
            ),
            font_name_from_layout(description_block, 'lato-regular.ttf'),
            int(description_block.get('fontSize', 27)) if description_block else 27,
            color_value(description_block.get('color'), COLOR_WHITE) if description_block else COLOR_WHITE,
            align=description_block.get('align', 'center') if description_block else 'center',
            valign='center',
            line_spacing=6,
            max_lines=3,
            shrink_to_fit=True,
            min_font_size=18,
        )

        suggestion_block = layout.get(f'roadmap-sugestao-{index}')
        draw_text_block(
            draw,
            card['sugestao'],
            (
                float(suggestion_block.get('x', x + 30)) if suggestion_block else x + 30,
                float(suggestion_block.get('y', y + 460)) if suggestion_block else y + 460,
                float(suggestion_block.get('width', width - 60)) if suggestion_block else width - 60,
                float(suggestion_block.get('height', 54)) if suggestion_block else 54,
            ),
            font_name_from_layout(suggestion_block, 'lato-regular.ttf'),
            int(suggestion_block.get('fontSize', 17)) if suggestion_block else 17,
            color_value(suggestion_block.get('color'), COLOR_WHITE) if suggestion_block else COLOR_WHITE,
            align=suggestion_block.get('align', 'center') if suggestion_block else 'center',
            max_lines=2,
            shrink_to_fit=True,
            min_font_size=14,
        )

    save_image(image, output_name)


def render_static(output_name: str, *template_names: str):
    image = load_template(*template_names)
    save_image(image, output_name)


def parse_fallback_months(content: Dict) -> List[str]:
    planner = content.get('planner', {}) if isinstance(content.get('planner'), dict) else {}
    raw_months = str(planner.get('mes', '')).split('|')
    return [month.strip() for month in raw_months if month.strip()][:3]


def main():
    print('[INICIO] Iniciando geracao de laminas...')
    content_path = os.environ.get('PRESENTATION_CONTENT_FILE') or os.path.join(BASE_DIR, 'content.json')
    if not os.path.exists(content_path):
        print(f'[ERRO] Arquivo {content_path} nao encontrado.')
        return

    try:
        with open(content_path, 'r', encoding='utf-8') as file:
            content = json.load(file)
    except Exception as exc:
        print(f'[ERRO] Falha ao ler JSON: {exc}')
        return

    clear_output_dir()
    fallback_months = parse_fallback_months(content)

    render_cover(content.get('planner', {}), '01_capa.png')
    render_diagnostico(content.get('diagnostico', {}), '02_diagnostico.png')
    render_desafios(content.get('desafios', {}), '03_desafios.png')
    render_metas(content.get('grid', {}), '04_metas.png')
    render_slogan(content.get('slogan', {}), '05_slogan.png')
    render_defesa(content.get('defesa', {}), '06_defesa.png')

    roadmap = content.get('roadmap', {}) if isinstance(content.get('roadmap'), dict) else {}
    roadmap['fallback_months'] = fallback_months
    render_roadmap(roadmap, '07_roadmap.png')

    render_static('08_link_cta.png', 'template_link_cta.png', 'template_link_cta.jpg')
    render_static('09_encerramento.png', 'template_encerramento.png', 'template_encerramento.jpg')

    print('[SUCESSO] Laminas geradas.')


if __name__ == '__main__':
    main()













