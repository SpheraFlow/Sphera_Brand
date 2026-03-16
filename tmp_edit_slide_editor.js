const fs = require('fs');
const path = 'C:/repos/Sphera_Brand/frontend/src/components/SlideEditorModal.tsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(
  "  const canvasRef = useRef<HTMLDivElement>(null);\r\n  const manuallyResizedIdsRef = useRef<Set<string>>(new Set());",
  "  const canvasRef = useRef<HTMLDivElement>(null);\r\n  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);\r\n  const manuallyResizedIdsRef = useRef<Set<string>>(new Set());"
);

text = text.replace(
  /  const selectedBlock = blocks\.find\(\(b\) => b\.id === selectedBlockId\);\r?\n  const isCenteredTextBlock = \(block: TextBlock\) =>\r?\n    block\.id\.startsWith\('item-'\) \|\|\r?\n    block\.id === 'frase' \|\|\r?\n    \(isMetasSlide && block\.id === 'texto'\);\r?\n  const hasGradientText = \(block: TextBlock\) => block\.id === 'frase';\r?\n  const usesUppercaseRender = \(block: TextBlock\) =>\r?\n    block\.id === 'mes' \|\| block\.id === 'nome_cliente' \|\| block\.id === 'subtitulo';\r?\n/,
  () => `  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const isCenteredTextBlock = (block: TextBlock) =>
    block.id.startsWith('item-') ||
    block.id === 'frase' ||
    (isMetasSlide && block.id === 'texto');
  const hasGradientText = (block: TextBlock) => block.id === 'frase';
  const usesUppercaseRender = (block: TextBlock) =>
    block.id === 'mes' || block.id === 'nome_cliente' || block.id === 'subtitulo';

  const getMeasureContext = () => {
    if (typeof document === 'undefined') return null;
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement('canvas');
    }
    return measureCanvasRef.current.getContext('2d');
  };

  const getFontFamilyName = (block: TextBlock) =>
    block.fontFamily === 'PoppinsBold' ? 'PoppinsBold' : 'Lato';

  const getFontWeightValue = (block: TextBlock) =>
    block.fontFamily === 'PoppinsBold' || block.fontWeight === 'bold' ? 700 : 400;

  const getLineSpacing = (block: TextBlock) => {
    if (block.id === 'frase') return 4;
    if (block.id === 'texto' && (isDiagnosticoSlide || isMetasSlide || isDefesaSlide)) return 12;
    if (block.id.startsWith('item-')) return 8;
    return 8;
  };

  const getMaxLines = (block: TextBlock): number | undefined => {
    if (block.id.startsWith('item-')) return 3;
    if (block.id === 'frase') return 2;
    if (usesUppercaseRender(block)) return 1;
    return undefined;
  };

  const shouldShrinkToFit = (block: TextBlock) =>
    block.id.startsWith('item-') || block.id === 'frase';

  const getMinFontSize = (block: TextBlock) => {
    if (block.id === 'frase') return 24;
    if (block.id.startsWith('item-')) return 18;
    return 12;
  };

  const lineHeightForFont = (fontSize: number, lineSpacing: number) => fontSize + lineSpacing;

  const wrapTextForRender = (textValue: string, block: TextBlock, fontSize: number) => {
    const prepared = usesUppercaseRender(block)
      ? String(textValue || '').toUpperCase()
      : String(textValue || '');
    const context = getMeasureContext();
    const maxWidth = Math.max(1, Math.floor(block.width));

    const measureText = (value: string) => {
      if (!context) return value.length * fontSize * 0.56;
      context.font = \
        getFontWeightValue(block) + ' ' + fontSize + 'px ' + getFontFamilyName(block);
      return context.measureText(value).width;
    };

    const lines: string[] = [];
    for (const paragraph of prepared.split('\n')) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push('');
        continue;
      }

      let currentLine = words[0];
      for (const word of words.slice(1)) {
        const testLine = (currentLine + ' ' + word).trim();
        if (measureText(testLine) <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }

      lines.push(currentLine);
    }

    return lines;
  };

  const getRenderedTextLayout = (block: TextBlock) => {
    const lineSpacing = getLineSpacing(block);
    const maxLines = getMaxLines(block);
    let fittedFontSize = block.fontSize;
    let lines = wrapTextForRender(block.content, block, fittedFontSize);

    if (shouldShrinkToFit(block)) {
      const minFontSize = getMinFontSize(block);
      while (fittedFontSize > minFontSize) {
        const tooManyLines = maxLines !== undefined && lines.length > maxLines;
        const totalHeight = lines.length * lineHeightForFont(fittedFontSize, lineSpacing);
        if (!tooManyLines && totalHeight <= block.height) break;
        fittedFontSize -= 2;
        lines = wrapTextForRender(block.content, block, fittedFontSize);
      }
    }

    if (maxLines !== undefined && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
    }

    const scale = canvasRef.current
      ? Math.min(canvasRef.current.clientWidth / 1920, canvasRef.current.clientHeight / 1080)
      : 1;

    return {
      content: lines.join('\n'),
      fontSizePx: (fittedFontSize * scale).toFixed(2) + 'px',
      lineHeightPx: (lineHeightForFont(fittedFontSize, lineSpacing) * scale).toFixed(2) + 'px',
    };
  };
`
);

text = text.replace(
  /\{blocks\.map\(\(block\) => \(/,
  '{blocks.map((block) => {\n                    const renderedBlock = getRenderedTextLayout(block);\n                    return ('
);
text = text.replace(/\n\s*\)\)\}\n\s*<\/div>\n\s*<\/div>\n\s*<div className="mt-4 bg-gray-800 rounded-lg p-4 text-xs text-gray-400">/, '\n                  );\n                  })}\n                </div>\n              </div>\n\n              <div className="mt-4 bg-gray-800 rounded-lg p-4 text-xs text-gray-400">');

text = text.replace(
  /\s*\/\/ ConversÃ£o precisa[\s\S]*?padding: block\.kind === 'logo' \? '0px' : '2px',\r?\n\s*transition: draggingId \? 'none' : 'all 0\.2s',/,
  `
                        left: \
\
\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\	\
                        left: \
\
                        \`${((block.x / 1920) * 100).toFixed(4)}%\`,
                        top: \`${((block.y / 1080) * 100).toFixed(4)}%\`,
                        width: \`${((block.width / 1920) * 100).toFixed(4)}%\`,
                        height: \`${((block.height / 1080) * 100).toFixed(4)}%\`,
                        fontSize: renderedBlock.fontSizePx,
                        color: block.color,
                        fontWeight: block.fontWeight,
                        textAlign: block.align,
                        fontFamily: block.fontFamily,
                        textTransform: usesUppercaseRender(block) ? 'uppercase' : undefined,
                        display: block.kind === 'logo' || isEditing === block.id || !isCenteredTextBlock(block) ? 'block' : 'flex',
                        flexDirection: block.kind === 'logo' || isEditing === block.id || !isCenteredTextBlock(block) ? undefined : 'column',
                        justifyContent: block.kind === 'logo' || isEditing === block.id || !isCenteredTextBlock(block) ? undefined : 'center',
                        alignItems: block.kind === 'logo' || isEditing === block.id || !isCenteredTextBlock(block) ? undefined : (block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start'),
                        lineHeight: renderedBlock.lineHeightPx,
                        backgroundImage: hasGradientText(block) ? 'linear-gradient(15deg, #0870c9 0%, #61b9ff 100%)' : undefined,
                        WebkitBackgroundClip: hasGradientText(block) ? 'text' : undefined,
                        backgroundClip: hasGradientText(block) ? 'text' : undefined,
                        WebkitTextFillColor: hasGradientText(block) ? 'transparent' : undefined,
                        cursor: draggingId === block.id ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'pre-wrap',
                        overflow: 'hidden',
                        textShadow: hasGradientText(block) || block.shadow === false ? 'none' : '2px 2px 4px rgba(0,0,0,0.8)',
                        border: selectedBlockId === block.id ? '2px dashed #0095FF' : '2px dashed transparent',
                        boxSizing: 'border-box',
                        padding: '0px',
                        transition: draggingId ? 'none' : 'all 0.2s',`
);

text = text.replace("                        <div style={{ width: '100%' }}>{block.content}</div>", "                        <div style={{ width: '100%' }}>{renderedBlock.content}</div>");

const replacements = [
  ["alert('âœ… Imagem exportada com sucesso!');", "alert('Imagem exportada com sucesso.');"],
  ["alert('âŒ Erro ao exportar. Tente novamente.');", "alert('Erro ao exportar. Tente novamente.');"],
  ["alert('âœ… Logo enviada para esta lÃ¢mina. Clique em \"Salvar e Regenerar\".');", "alert('Logo enviada para esta lamina. Clique em \"Salvar e Regenerar\".');"],
  ['Arraste os textos para reposicionar â€¢ Duplo clique para editar', 'Arraste os textos para reposicionar | Duplo clique para editar'],
  ['title="Exporta exatamente o que vocÃª vÃª no editor"', 'title="Exporta exatamente o que voce ve no editor"'],
  ['ðŸ“¥ Exportar do Editor', 'Exportar do Editor'],
  ['ðŸ’¾ Salvar e Regenerar', 'Salvar e Regenerar'],
  ['âœ• Fechar', 'Fechar'],
  ['RÃ©gua Horizontal (1920px)', 'Regua Horizontal (1920px)'],
  ['RÃ©gua Vertical (1080px)', 'Regua Vertical (1080px)'],
  ['âœ“ Salvar (Ctrl+Enter)', 'Salvar (Ctrl+Enter)'],
  ['âœ• Cancelar (Esc)', 'Cancelar (Esc)'],
  ['ðŸ–±ï¸ Arrastar:', 'Arrastar:'],
  ['âœï¸ Editar:', 'Editar:'],
  ['ðŸ“ Mostrar Grid', 'Mostrar Grid'],
  ['ðŸ§² Snap to Grid (10px)', 'Snap to Grid (10px)'],
  ['ðŸ“ X: ', 'X: '],
  ['âš™ï¸ Propriedades', 'Propriedades'],
  ['Logo (por lÃ¢mina)', 'Logo (por lamina)'],
  ['Esta logo sobrescreve a do cliente apenas nesta geraÃ§Ã£o.', 'Esta logo sobrescreve a do cliente apenas nesta geracao.'],
  ['ðŸ—‘ï¸ Excluir elemento', 'Excluir elemento'],
  ["{align === 'left' ? 'â¬…' : align === 'center' ? 'â†”' : 'âž¡'}", "{align === 'left' ? 'Esq' : align === 'center' ? 'Centro' : 'Dir'}"],
  ['ðŸ“‹ Elementos', 'Elementos'],
  ["console.log('ðŸ”´ [LOGO ERROR] Falha ao carregar:', logoImgSrc);", "console.log('[LOGO ERROR] Falha ao carregar:', logoImgSrc);"],
  ["console.log('ðŸ”´ [LOGO ERROR] Fallback jÃ¡ tentado, desistindo');", "console.log('[LOGO ERROR] Fallback ja tentado, desistindo');"],
  ["console.log('ðŸ”´ [LOGO ERROR] URL nÃ£o contÃ©m /static/ ou /api/static/, nÃ£o hÃ¡ fallback');", "console.log('[LOGO ERROR] URL nao contem /static/ ou /api/static/, nao ha fallback');"],
  ["console.log('ðŸ”„ [LOGO FALLBACK] Tentando rota alternativa:', next);", "console.log('[LOGO FALLBACK] Tentando rota alternativa:', next);"],
];
for (const [from, to] of replacements) {
  text = text.replaceAll(from, to);
}

fs.writeFileSync(path, text, 'utf8');
