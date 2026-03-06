import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import api from '../services/api';
import { resolveAssetUrl } from '../utils/assetHelpers';
// 🚨 DEPENDÊNCIAS CRÍTICAS - NÃO REMOVER 🚨
// html-to-image e downloadjs são necessários para "Exportar do Editor"
import { toPng } from 'html-to-image';
import download from 'downloadjs';

interface TextBlock {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  fontFamily: 'PoppinsBold' | 'Lato';
  kind?: 'text' | 'logo';
  shadow?: boolean;
}

interface SlideEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  slideImage: string;
  slideName: string;
  slideData: any;
  onSave: (blocks: TextBlock[], slideData: any) => void;
}

export default function SlideEditorModal({
  isOpen,
  onClose,
  slideImage,
  slideName,
  slideData,
  onSave
}: SlideEditorModalProps) {
  // Helpers agora vêm de assetHelpers.ts

  const [logoUrlOverride, setLogoUrlOverride] = useState<string>(() => {
    return (slideData?.logo_url ? String(slideData.logo_url) : '').trim();
  });

  const [logoCacheKey, setLogoCacheKey] = useState<number>(() => Date.now());
  const [logoImgSrc, setLogoImgSrc] = useState<string>('');
  const [logoTriedFallback, setLogoTriedFallback] = useState(false);

  // Sincronizar logoUrlOverride quando slideData.logo_url mudar
  useEffect(() => {
    if (slideData?.logo_url) {
      const newLogoUrl = String(slideData.logo_url).trim();
      if (newLogoUrl) {
        setLogoUrlOverride(newLogoUrl);
      }
    }
  }, [slideData?.logo_url, slideData]);

  useEffect(() => {
    setLogoCacheKey(Date.now());
  }, [logoUrlOverride, slideData?.logo_url]);

  useEffect(() => {
    const raw = (logoUrlOverride || slideData?.logo_url || '').toString().trim();
    if (!raw) {
      setLogoImgSrc('');
      setLogoTriedFallback(false);
      return;
    }
    setLogoImgSrc(withStableCacheKey(resolveAssetUrl(raw), logoCacheKey));
    setLogoTriedFallback(false);
  }, [logoUrlOverride, slideData?.logo_url, logoCacheKey]);

  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const snapValue = (value: number, gridSize: number = 10) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const isPlannerSlide =
    (slideName || '').toLowerCase().includes('planner') ||
    (slideData?.mes !== undefined && slideData?.nome_cliente !== undefined);

  const isMetasSlide = (slideName || '').toLowerCase().includes('metas');

  const estimateTextBoxSize = (text: string, fontSize: number, maxWidth: number) => {
    const safeText = String(text || '');
    const safeFont = Number.isFinite(fontSize) ? fontSize : 20;
    const safeMaxW = Math.max(120, Number.isFinite(maxWidth) ? maxWidth : 240);
    const approxCharW = safeFont * 0.56;
    const charsPerLine = Math.max(6, Math.floor((safeMaxW - 16) / approxCharW));
    const lines = Math.max(1, Math.ceil(safeText.length / charsPerLine));
    const lineH = safeFont * 1.25;
    const height = Math.min(280, Math.max(44, Math.ceil(lines * lineH + 12)));
    return { width: safeMaxW, height };
  };

  const withStableCacheKey = (url: string, cacheKey: number) => {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${cacheKey}`;
  };

  const [blocks, setBlocks] = useState<TextBlock[]>(() => {
    // Inicializar blocos baseado no tipo de slide
    const initialBlocks: TextBlock[] = [];

    const isPlannerSlide =
      (slideName || '').toLowerCase().includes('planner') ||
      (slideData?.mes !== undefined && slideData?.nome_cliente !== undefined);

    // CORREÇÃO DEFINITIVA: Filtrar layout para remover blocos exclusivos do Planner
    // se não for uma lâmina Planner (previne contaminação entre lâminas)
    const layoutList = Array.isArray(slideData?.layout) ? slideData.layout : [];
    const filteredLayout = isPlannerSlide
      ? layoutList
      : layoutList.filter((l: any) => {
        // Remover blocos exclusivos do Planner de lâminas não-planner
        const id = l?.id;
        return id !== 'mes' && id !== 'nome_cliente' && id !== 'logo';
      });

    const layoutById = new Map<string, any>();
    filteredLayout.forEach((l: any) => {
      if (l && typeof l === 'object' && l.id) layoutById.set(l.id, l);
    });

    const getLayout = (id: string) => layoutById.get(id);

    const isLegacyPlannerLayout = (id: string, oldX: number, oldY: number) => {
      if (!isPlannerSlide) return false;
      const l = getLayout(id);
      if (!l) return false;
      return Math.round(l.x ?? -1) === oldX && Math.round(l.y ?? -1) === oldY;
    };

    if (!isPlannerSlide && slideData.titulo) {
      const l = getLayout('titulo');
      initialBlocks.push({
        id: 'titulo',
        content: slideData.titulo,
        x: l?.x ?? 100,
        y: l?.y ?? 400,
        width: l?.width ?? 700,
        height: l?.height ?? 160,
        fontSize: l?.fontSize ?? 65,
        color: l?.color ?? '#0095FF',
        fontWeight: l?.fontWeight ?? 'bold',
        align: l?.align ?? 'left',
        fontFamily: l?.fontFamily ?? 'PoppinsBold',
        shadow: l?.shadow ?? true
      });
    }

    if (slideData.subtitulo) {
      const l = getLayout('subtitulo');
      initialBlocks.push({
        id: 'subtitulo',
        content: slideData.subtitulo,
        x: l?.x ?? 174,
        y: l?.y ?? 636,
        width: l?.width ?? 900,
        height: l?.height ?? 120,
        fontSize: l?.fontSize ?? 22,
        color: l?.color ?? '#FFFFFF',
        fontWeight: l?.fontWeight ?? 'bold',
        align: l?.align ?? 'left',
        fontFamily: l?.fontFamily ?? 'PoppinsBold',
        shadow: l?.shadow ?? true
      });
    }

    const isDesafiosSlide = Array.isArray(slideData.itens);

    if (!isDesafiosSlide && (slideData.texto || slideData.texto_longo)) {
      const l = getLayout('texto');
      const isMetas = isMetasSlide;
      const defaultW = isMetas ? 820 : 845;
      const defaultH = isMetas ? 825 : 842;
      const defaultFS = isMetas ? 25 : 24;

      initialBlocks.push({
        id: 'texto',
        content: slideData.texto || slideData.texto_longo,
        x: l?.x ?? 936,
        y: l?.y ?? 147,
        width: l?.width ?? defaultW,
        height: l?.height ?? defaultH,
        fontSize: l?.fontSize ?? defaultFS,
        color: l?.color ?? '#FFFFFF',
        fontWeight: l?.fontWeight ?? 'normal',
        align: l?.align ?? 'left',
        fontFamily: l?.fontFamily ?? 'Lato',
        shadow: l?.shadow ?? true
      });
    }

    if (slideData.frase) {
      const l = getLayout('frase');
      initialBlocks.push({
        id: 'frase',
        content: slideData.frase,
        x: l?.x ?? 223,
        y: l?.y ?? 505,
        width: l?.width ?? 1500,
        height: l?.height ?? 120,
        fontSize: l?.fontSize ?? 70,
        color: l?.color ?? '#0095FF',
        fontWeight: l?.fontWeight ?? 'bold',
        align: l?.align ?? 'left',
        fontFamily: l?.fontFamily ?? 'PoppinsBold',
        shadow: l?.shadow ?? true
      });
    }

    if (slideData.legenda) {
      const l = getLayout('legenda');
      initialBlocks.push({
        id: 'legenda',
        content: slideData.legenda,
        x: l?.x ?? 960,
        y: l?.y ?? 650,
        width: l?.width ?? 900,
        height: l?.height ?? 120,
        fontSize: l?.fontSize ?? 22,
        color: l?.color ?? '#FFFFFF',
        fontWeight: l?.fontWeight ?? 'normal',
        align: l?.align ?? 'center',
        fontFamily: l?.fontFamily ?? 'Lato',
        shadow: l?.shadow ?? true
      });
    }

    // Desafios: 9 itens em grid (posições específicas)
    if (Array.isArray(slideData.itens)) {
      const items: string[] = slideData.itens;

      const defaultPositions = [
        { x: 939, y: 289 },
        { x: 1215, y: 290 },
        { x: 1490, y: 272 },
        { x: 928, y: 476 },
        { x: 1218, y: 495 },
        { x: 1490, y: 478 },
        { x: 938, y: 695 },
        { x: 1212, y: 693 },
        { x: 1488, y: 701 }
      ];

      for (let i = 0; i < 9; i++) {
        const id = `item-${i}`;
        const l = getLayout(id);

        const defaultW = 240;
        const defaultFont = l?.fontSize ?? 24;
        const size = estimateTextBoxSize(items[i] || '', defaultFont, l?.width ?? defaultW);

        const isBlackBg = i === 2 || i === 3 || i === 7;
        const defaultColor = isBlackBg ? '#000000' : '#FFFFFF';

        initialBlocks.push({
          id,
          content: items[i] || '',
          x: l?.x ?? defaultPositions[i].x,
          y: l?.y ?? defaultPositions[i].y,
          width: l?.width ?? size.width,
          height: l?.height ?? size.height,
          fontSize: defaultFont,
          color: l?.color ?? defaultColor,
          fontWeight: l?.fontWeight ?? 'normal',
          align: l?.align ?? 'center',
          fontFamily: l?.fontFamily ?? 'Lato',
          kind: 'text',
          shadow: l?.shadow ?? true
        });
      }
    }

    // Planner: mes, nome_cliente e caixa da logo
    if (isPlannerSlide) {
      const mesLayout = isLegacyPlannerLayout('mes', 100, 520) ? undefined : getLayout('mes');
      initialBlocks.push({
        id: 'mes',
        content: slideData.mes || '',
        x: mesLayout?.x ?? 187,
        y: mesLayout?.y ?? 584,
        width: mesLayout?.width ?? 980,
        height: mesLayout?.height ?? 120,
        fontSize: mesLayout?.fontSize ?? 32,
        color: mesLayout?.color ?? '#FFFFFF',
        fontWeight: mesLayout?.fontWeight ?? 'normal',
        align: mesLayout?.align ?? 'left',
        fontFamily: mesLayout?.fontFamily ?? 'Lato',
        kind: 'text',
        shadow: mesLayout?.shadow ?? true
      });

      const nameLayout = isLegacyPlannerLayout('nome_cliente', 100, 950) ? undefined : getLayout('nome_cliente');
      initialBlocks.push({
        id: 'nome_cliente',
        content: slideData.nome_cliente || '',
        x: nameLayout?.x ?? 210,
        y: nameLayout?.y ?? 696,
        width: nameLayout?.width ?? 700,
        height: nameLayout?.height ?? 80,
        fontSize: nameLayout?.fontSize ?? 32,
        color: nameLayout?.color ?? '#0095FF',
        fontWeight: nameLayout?.fontWeight ?? 'bold',
        align: nameLayout?.align ?? 'left',
        fontFamily: nameLayout?.fontFamily ?? 'PoppinsBold',
        kind: 'text',
        shadow: nameLayout?.shadow ?? true
      });

      const logoLayout = isLegacyPlannerLayout('logo', 120, 390) ? undefined : getLayout('logo');
      initialBlocks.push({
        id: 'logo',
        content: '',
        x: logoLayout?.x ?? 1241,
        y: logoLayout?.y ?? 533,
        width: logoLayout?.width ?? 300,
        height: logoLayout?.height ?? 300,
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: 'normal',
        align: 'center',
        fontFamily: 'Lato',
        kind: 'logo'
      });
    }

    return initialBlocks;
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const manuallyResizedIdsRef = useRef<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleMouseDown = (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    setSelectedBlockId(id);
    setDraggingId(id);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeMouseDown = (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    setSelectedBlockId(id);
    setResizingId(id);
    setResizeStart({ x: e.clientX, y: e.clientY });
    manuallyResizedIdsRef.current.add(id);
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Escala precisa para coordenadas absolutas 1920x1080
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;

    // Atualizar posição do mouse para mostrar coordenadas (arredondar apenas para display)
    const mouseX = Math.round((e.clientX - rect.left) * scaleX);
    const mouseY = Math.round((e.clientY - rect.top) * scaleY);
    setMousePos({ x: mouseX, y: mouseY });

    if ((!draggingId && !resizingId) || (!dragStart && !resizeStart)) return;

    if (draggingId && dragStart) {
      const deltaX = (e.clientX - dragStart.x) * scaleX;
      const deltaY = (e.clientY - dragStart.y) * scaleY;

      setBlocks((prev) =>
        prev.map((block) =>
          block.id === draggingId
            ? {
              ...block,
              // Aplicar snap e garantir valores positivos, mantendo precisão
              x: Math.max(0, snapValue(block.x + deltaX)),
              y: Math.max(0, snapValue(block.y + deltaY))
            }
            : block
        )
      );

      setDragStart({ x: e.clientX, y: e.clientY });
    }

    if (resizingId && resizeStart) {
      const deltaX = (e.clientX - resizeStart.x) * scaleX;
      const deltaY = (e.clientY - resizeStart.y) * scaleY;

      setBlocks((prev) =>
        prev.map((block) =>
          block.id === resizingId
            ? {
              ...block,
              // Manter precisão no resize, mínimo 20px
              width: Math.max(20, block.width + deltaX),
              height: Math.max(20, block.height + deltaY)
            }
            : block
        )
      );

      setResizeStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDragStart(null);
    setResizingId(null);
    setResizeStart(null);
  };

  const handleDoubleClick = (id: string, content: string) => {
    const b = blocks.find((x) => x.id === id);
    if (b?.kind === 'logo') return;
    if (isEditing === id) return;
    setIsEditing(id);
    setEditContent(content);
  };

  const handleSaveEdit = () => {
    if (!isEditing) return;

    const editingId = isEditing;
    const nextContent = editContent;

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== editingId) return block;
        const updated = { ...block, content: nextContent };
        if (
          editingId.startsWith('item-') &&
          !manuallyResizedIdsRef.current.has(editingId)
        ) {
          const size = estimateTextBoxSize(nextContent, updated.fontSize, updated.width);
          return { ...updated, height: size.height };
        }
        if (editingId === 'mes' && isMetasSlide) {
          return updated;
        }
        return updated;
      })
    );

    setIsEditing(null);
    setEditContent('');
  };

  const updateBlockProperty = (property: keyof TextBlock, value: any) => {
    if (!selectedBlockId) return;

    setBlocks((prev) =>
      prev.map((block) =>
        block.id === selectedBlockId ? { ...block, [property]: value } : block
      )
    );
  };

  const handleDeleteSelectedBlock = () => {
    if (!selectedBlockId) return;
    setBlocks((prev) => prev.filter((b) => b.id !== selectedBlockId));
    setSelectedBlockId(null);
    setIsEditing(null);
  };

  /**
   * 🚨 FUNCIONALIDADE CRÍTICA - NÃO REMOVER 🚨
   * 
   * Exporta a lâmina EXATAMENTE como aparece no editor (WYSIWYG).
   * Esta função é essencial porque:
   * 1. Preview (Python PIL) e Editor (HTML Canvas) podem renderizar layouts diferentes
   * 2. Permite correções manuais de lâminas individuais sem regenerar tudo
   * 3. Garante que o usuário baixe exatamente o que está vendo
   * 
   * Dependências: html-to-image, downloadjs (já instaladas em package.json)
   * Botão UI: linha ~618 "📥 Exportar do Editor"
   */
  const handleExportFromEditor = async () => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const dataUrl = await toPng(canvas, {
        quality: 1.0,
        pixelRatio: 2,
        width: 1920,
        height: 1080,
        cacheBust: true
      });

      const filename = `${slideName.replace(/\s+/g, '_')}_${Date.now()}.png`;
      download(dataUrl, filename, 'image/png');
      alert('✅ Imagem exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('❌ Erro ao exportar. Tente novamente.');
    }
  };

  const handleSaveLayout = () => {
    const updatedSlideData = { ...slideData };
    const blockIds = new Set(blocks.map((b) => b.id));

    // Persistir layout para o Python respeitar posição/tamanho/fonte
    // Filtrar campos exclusivos do planner se não for planner
    const blocksToSave = isPlannerSlide
      ? blocks
      : blocks.filter(b => {
        // Sempre filtrar nome_cliente de não-planner
        if (b.id === 'nome_cliente') return false;
        // Filtrar mes apenas se não existia no slideData original (evita criar blocos indesejados)
        if (b.id === 'mes' && slideData.mes === undefined) return false;
        return true;
      });

    updatedSlideData.layout = blocksToSave.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      fontSize: b.fontSize,
      color: b.color,
      fontWeight: b.fontWeight,
      align: b.align,
      fontFamily: b.fontFamily,
      kind: b.kind || 'text',
      shadow: b.shadow ?? true
    }));

    console.log('🔍 [EDITOR] Layout sendo salvo:', JSON.stringify(updatedSlideData.layout, null, 2));

    blocks.forEach((block) => {
      if (block.id === 'titulo') updatedSlideData.titulo = block.content;
      if (block.id === 'subtitulo') updatedSlideData.subtitulo = block.content;
      if (block.id === 'texto') updatedSlideData.texto_longo = block.content;
      if (block.id === 'frase') updatedSlideData.frase = block.content;
      if (block.id === 'legenda') updatedSlideData.legenda = block.content;
      // Campos mes e nome_cliente só devem ser salvos se for planner
      if (isPlannerSlide && block.id === 'mes') updatedSlideData.mes = block.content;
      if (isPlannerSlide && block.id === 'nome_cliente') updatedSlideData.nome_cliente = block.content;
    });

    // Se o bloco foi removido, limpar o campo correspondente para não ser re-renderizado
    if (!isPlannerSlide && !blockIds.has('titulo')) updatedSlideData.titulo = '';
    if (!blockIds.has('subtitulo')) updatedSlideData.subtitulo = '';
    if (!blockIds.has('texto')) updatedSlideData.texto_longo = '';
    if (!blockIds.has('frase')) updatedSlideData.frase = '';
    if (!blockIds.has('legenda')) updatedSlideData.legenda = '';

    // Limpeza robusta de campos por tipo de lâmina
    if (isPlannerSlide) {
      // Planner: limpar se blocos foram removidos
      if (!blockIds.has('mes')) updatedSlideData.mes = '';
      if (!blockIds.has('nome_cliente')) updatedSlideData.nome_cliente = '';
    } else if (isMetasSlide) {
      // Metas: NÃO deve ter mês. Remover sempre.
      delete updatedSlideData.nome_cliente;
      delete updatedSlideData.mes;
    } else {
      // Outras lâminas (Defesa, Slogan, Desafios): remover ambos completamente
      delete updatedSlideData.mes;
      delete updatedSlideData.nome_cliente;
    }

    if (typeof logoUrlOverride === 'string' && logoUrlOverride.trim()) {
      updatedSlideData.logo_url = logoUrlOverride.trim();
    }

    // Desafios: reconstruir itens
    const itemBlocks = blocks.filter((b) => b.id.startsWith('item-'));
    if (Array.isArray(slideData.itens) || itemBlocks.length > 0) {
      const fixedItems = new Array(9).fill('');
      itemBlocks.forEach((b) => {
        const idx = parseInt(b.id.replace('item-', ''), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < 9) fixedItems[idx] = b.content || '';
      });
      updatedSlideData.itens = fixedItems;
      // Em "Novos Desafios" não usar campo texto (não gerar elemento texto)
      if ('texto' in updatedSlideData) delete updatedSlideData.texto;
    }

    onSave(blocks, updatedSlideData);
  };

  const handleUploadLogoForSlide = async (file: File | null | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/client-logos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const url = res.data?.url as string | undefined;
      if (!url) {
        alert('Erro ao fazer upload da logo.');
        return;
      }

      // Guardar a URL relativa retornada pelo backend (ex: /static/client-logos/xxx.png)
      setLogoUrlOverride(String(url));
      alert('✅ Logo enviada para esta lâmina. Clique em "Salvar e Regenerar".');
    } catch (e: any) {
      console.error('Erro ao fazer upload da logo (lâmina):', e);
      alert('Erro ao fazer upload da logo: ' + (e.response?.data?.error || e.message));
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Editor Visual - {slideName}</h2>
            <p className="text-xs text-gray-400 mt-1">Arraste os textos para reposicionar • Duplo clique para editar</p>
          </div>
          <div className="flex gap-2">
            {/* 🚨 BOTÃO CRÍTICO - NÃO REMOVER 🚨 
                Exporta WYSIWYG do editor, essencial quando preview Python difere do editor */}
            <button
              onClick={handleExportFromEditor}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
              title="Exporta exatamente o que você vê no editor"
            >
              📥 Exportar do Editor
            </button>
            <button
              onClick={handleSaveLayout}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              💾 Salvar e Regenerar
            </button>
            <button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Canvas */}
            <div className="lg:col-span-3">
              <div
                ref={canvasRef}
                className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700"
                style={{ width: '100%', aspectRatio: '16/9' }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={slideImage}
                  alt="Slide"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />

                {/* Grid Visual */}
                {showGrid && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
                    <defs>
                      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#0095FF" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                )}

                {/* Réguas */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-gray-900/80 flex items-center justify-center text-[10px] text-gray-400 pointer-events-none">
                  Régua Horizontal (1920px)
                </div>
                <div className="absolute top-0 left-0 bottom-0 w-6 bg-gray-900/80 flex items-center justify-center text-[10px] text-gray-400 pointer-events-none" style={{ writingMode: 'vertical-rl' }}>
                  Régua Vertical (1080px)
                </div>

                {/* Overlay de Textos */}
                <div className="absolute inset-0">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      onMouseDown={(e) => handleMouseDown(block.id, e)}
                      onDoubleClick={() => {
                        if (block.kind === 'logo') return;
                        handleDoubleClick(block.id, block.content);
                      }}
                      style={{
                        position: 'absolute',
                        // Conversão precisa de coordenadas absolutas (1920x1080) para percentuais
                        left: `${((block.x / 1920) * 100).toFixed(4)}%`,
                        top: `${((block.y / 1080) * 100).toFixed(4)}%`,
                        width: `${((block.width / 1920) * 100).toFixed(4)}%`,
                        height: `${((block.height / 1080) * 100).toFixed(4)}%`,
                        // Escalar fontSize: usar a altura do container (que tem aspect ratio 16:9)
                        // O container tem width:100% e aspect-ratio:16/9, então sua altura é width/16*9
                        // fontSize em pixels absolutos * (altura_real_canvas / 1080)
                        fontSize: canvasRef.current
                          ? `${(block.fontSize * canvasRef.current.clientHeight / 1080).toFixed(2)}px`
                          : `${block.fontSize}px`,
                        color: block.color,
                        fontWeight: block.fontWeight,
                        textAlign: block.align,
                        fontFamily: block.fontFamily,
                        cursor: draggingId === block.id ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'pre-wrap',
                        overflow: block.kind === 'logo' ? 'hidden' : 'visible',
                        textShadow: block.shadow === false ? 'none' : '2px 2px 4px rgba(0,0,0,0.8)',
                        border: selectedBlockId === block.id ? '2px dashed #0095FF' : '2px dashed transparent',
                        padding: block.kind === 'logo' ? '0px' : '2px',
                        transition: draggingId ? 'none' : 'all 0.2s',
                      }}
                      className="hover:bg-blue-500/10"
                    >
                      {selectedBlockId === block.id && (
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(block.id, e)}
                          style={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            width: 14,
                            height: 14,
                            background: '#0095FF',
                            cursor: 'nwse-resize',
                            borderTopLeftRadius: 2
                          }}
                        />
                      )}

                      {block.kind === 'logo' ? (
                        ((logoUrlOverride || slideData?.logo_url) ? (
                          <img
                            src={logoImgSrc}
                            crossOrigin="anonymous"
                            alt="Logo"
                            className="w-full h-full object-contain pointer-events-none"
                            draggable={false}
                            onError={() => {
                              console.log('🔴 [LOGO ERROR] Falha ao carregar:', logoImgSrc);
                              if (logoTriedFallback) {
                                console.log('🔴 [LOGO ERROR] Fallback já tentado, desistindo');
                                return;
                              }
                              if (!logoImgSrc) return;
                              const base = logoImgSrc.replace(/([?&])t=\d+(&?)/g, (_, p1, p2) => (p2 ? p1 : '')).replace(/[?&]$/g, '');
                              let next = base;
                              if (base.includes('/api/static/client-logos/')) {
                                next = base.replace('/api/static/client-logos/', '/static/client-logos/');
                              } else if (base.includes('/static/client-logos/')) {
                                next = base.replace('/static/client-logos/', '/api/static/client-logos/');
                              }
                              if (next === base) {
                                console.log('🔴 [LOGO ERROR] URL não contém /static/ ou /api/static/, não há fallback');
                                return;
                              }
                              console.log('🔄 [LOGO FALLBACK] Tentando rota alternativa:', next);
                              setLogoTriedFallback(true);
                              setLogoImgSrc(withStableCacheKey(next, logoCacheKey));
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-300 pointer-events-none">
                            Logo
                          </div>
                        ))
                      ) : isEditing === block.id ? (
                        <div className="bg-gray-900/95 p-3 rounded border-2 border-blue-500" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="bg-gray-800 text-white p-2 rounded w-full min-w-[300px] text-sm"
                            rows={4}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.ctrlKey) handleSaveEdit();
                              if (e.key === 'Escape') setIsEditing(null);
                            }}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={handleSaveEdit}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold"
                            >
                              ✓ Salvar (Ctrl+Enter)
                            </button>
                            <button
                              onClick={() => setIsEditing(null)}
                              className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
                            >
                              ✕ Cancelar (Esc)
                            </button>
                          </div>
                        </div>
                      ) : (
                        block.content
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 bg-gray-800 rounded-lg p-4 text-xs text-gray-400">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <strong className="text-white">🖱️ Arrastar:</strong> Clique e arraste o texto
                  </div>
                  <div>
                    <strong className="text-white">✏️ Editar:</strong> Duplo clique no texto
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">📐 Mostrar Grid</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">🧲 Snap to Grid (10px)</span>
                    </label>
                  </div>
                  {mousePos && (
                    <div className="text-white font-mono">
                      📍 X: {mousePos.x}px, Y: {mousePos.y}px
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Painel de Propriedades */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-bold text-white mb-3">⚙️ Propriedades</h4>

                {selectedBlock ? (
                  <div className="space-y-3">
                    {selectedBlock.kind === 'logo' && (
                      <div className="bg-gray-900 rounded p-3 border border-gray-700">
                        <label className="text-xs text-gray-400 block mb-2">Logo (por lâmina)</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="w-full text-xs text-gray-300"
                          onChange={(e) => handleUploadLogoForSlide(e.target.files?.[0])}
                        />
                        <p className="text-[11px] text-gray-500 mt-2">
                          Esta logo sobrescreve a do cliente apenas nesta geração.
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Tamanho</label>
                      <input
                        type="range"
                        min="12"
                        max="120"
                        value={selectedBlock.fontSize}
                        onChange={(e) => updateBlockProperty('fontSize', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-xs text-white">{selectedBlock.fontSize}px</span>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Fonte</label>
                      <select
                        value={selectedBlock.fontFamily}
                        onChange={(e) => updateBlockProperty('fontFamily', e.target.value)}
                        className="w-full bg-gray-700 text-white rounded px-2 py-2 text-xs"
                      >
                        <option value="PoppinsBold">Poppins Bold</option>
                        <option value="Lato">Lato</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Sombra</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateBlockProperty('shadow', true)}
                          className={`flex-1 px-3 py-2 rounded text-xs ${selectedBlock.shadow !== false ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                            }`}
                        >
                          ON
                        </button>
                        <button
                          onClick={() => updateBlockProperty('shadow', false)}
                          className={`flex-1 px-3 py-2 rounded text-xs ${selectedBlock.shadow === false ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                            }`}
                        >
                          OFF
                        </button>
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={handleDeleteSelectedBlock}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-bold"
                      >
                        🗑️ Excluir elemento
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Largura</label>
                        <input
                          type="number"
                          value={Math.round(selectedBlock.width)}
                          onChange={(e) => updateBlockProperty('width', parseInt(e.target.value || '0'))}
                          className="w-full bg-gray-700 text-white rounded px-2 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Altura</label>
                        <input
                          type="number"
                          value={Math.round(selectedBlock.height)}
                          onChange={(e) => updateBlockProperty('height', parseInt(e.target.value || '0'))}
                          className="w-full bg-gray-700 text-white rounded px-2 py-2 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Cor</label>
                      <div className="flex gap-2">
                        {['#FFFFFF', '#0095FF', '#000000'].map((color) => (
                          <button
                            key={color}
                            onClick={() => updateBlockProperty('color', color)}
                            className={`w-10 h-10 rounded border-2 ${selectedBlock.color === color ? 'border-blue-500 scale-110' : 'border-gray-600'
                              }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Peso</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateBlockProperty('fontWeight', 'normal')}
                          className={`flex-1 px-3 py-2 rounded text-xs ${selectedBlock.fontWeight === 'normal'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300'
                            }`}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => updateBlockProperty('fontWeight', 'bold')}
                          className={`flex-1 px-3 py-2 rounded text-xs font-bold ${selectedBlock.fontWeight === 'bold'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300'
                            }`}
                        >
                          Bold
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Alinhamento</label>
                      <div className="flex gap-2">
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            onClick={() => updateBlockProperty('align', align)}
                            className={`flex-1 px-3 py-2 rounded text-xs ${selectedBlock.align === align
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                              }`}
                          >
                            {align === 'left' ? '⬅' : align === 'center' ? '↔' : '➡'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-700">
                      <div className="text-xs text-gray-400 space-y-1">
                        <div className="flex justify-between">
                          <span>X:</span>
                          <span className="text-white font-mono">{Math.round(selectedBlock.x)}px</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Y:</span>
                          <span className="text-white font-mono">{Math.round(selectedBlock.y)}px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-8">
                    Clique em um texto para editar suas propriedades
                  </p>
                )}
              </div>

              {/* Lista de Blocos */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-bold text-white mb-2">📋 Elementos</h4>
                <div className="space-y-1">
                  {blocks.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={`w-full text-left text-xs p-2 rounded truncate ${selectedBlockId === block.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                      {block.id}: {block.content.substring(0, 30)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
