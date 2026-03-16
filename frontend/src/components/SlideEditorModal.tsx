import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import api from '../services/api';
import { resolveAssetUrl } from '../utils/assetHelpers';
// ðŸš¨ DEPENDÃŠNCIAS CRÃTICAS - NÃƒO REMOVER ðŸš¨
// html-to-image e downloadjs sÃ£o necessÃ¡rios para "Exportar do Editor"
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

interface BlockAdjustment {
  id: string;
  label: string;
  changes: string[];
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
  // Helpers agora vÃªm de assetHelpers.ts

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

  const slideNameLower = (slideName || '').toLowerCase();

  const isPlannerSlide =
    slideNameLower.includes('planner') ||
    (slideData?.mes !== undefined && slideData?.nome_cliente !== undefined);

  const isMetasSlide = slideNameLower.includes('metas');
  const isDiagnosticoSlide = slideNameLower.includes('diagnostico');
  const isDefesaSlide = slideNameLower.includes('defesa');

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

  const initialBlocksRef = useRef<TextBlock[]>([]);

  const [blocks, setBlocks] = useState<TextBlock[]>(() => {
    // Inicializar blocos baseado no tipo de slide
    const initialBlocks: TextBlock[] = [];

    const isPlannerSlide =
      (slideName || '').toLowerCase().includes('planner') ||
      (slideData?.mes !== undefined && slideData?.nome_cliente !== undefined);

    // CORREÃ‡ÃƒO DEFINITIVA: Filtrar layout para remover blocos exclusivos do Planner
    // se nÃ£o for uma lÃ¢mina Planner (previne contaminaÃ§Ã£o entre lÃ¢minas)
    const layoutList = Array.isArray(slideData?.layout) ? slideData.layout : [];
    const filteredLayout = isPlannerSlide
      ? layoutList
      : layoutList.filter((l: any) => {
        // Remover blocos exclusivos do Planner de lÃ¢minas nÃ£o-planner
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

    const isLegacyLayout = (id: string, oldX: number, oldY: number, oldWidth?: number, oldHeight?: number) => {
      const l = getLayout(id);
      if (!l) return false;
      const matchesPosition = Math.round(l.x ?? -1) === oldX && Math.round(l.y ?? -1) === oldY;
      if (!matchesPosition) return false;
      if (oldWidth !== undefined && Math.round(l.width ?? -1) !== oldWidth) return false;
      if (oldHeight !== undefined && Math.round(l.height ?? -1) !== oldHeight) return false;
      return true;
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
        x: l?.x ?? 185,
        y: l?.y ?? 679,
        width: l?.width ?? 540,
        height: l?.height ?? 34,
        fontSize: l?.fontSize ?? 22,
        color: l?.color ?? '#FFFFFF',
        fontWeight: l?.fontWeight ?? 'normal',
        align: l?.align ?? 'left',
        fontFamily: l?.fontFamily ?? 'Lato',
        shadow: l?.shadow ?? true
      });
    }

    const isDesafiosSlide = Array.isArray(slideData.itens);
    const isRoadmapSlide = Array.isArray(slideData.cards);

    if (!isDesafiosSlide && (slideData.texto || slideData.texto_longo)) {
      const l = getLayout('texto');
      const isMetas = isMetasSlide;
      const useReferenceTextBox = isMetas || isDefesaSlide || isDiagnosticoSlide;
      const defaultTextLayout = isMetas
        ? { x: 1048, y: 212, width: 650, height: 560, fontSize: 24 }
        : isDefesaSlide
          ? { x: 996, y: 196, width: 715, height: 610, fontSize: 24 }
          : isDiagnosticoSlide
            ? { x: 1050, y: 210, width: 650, height: 650, fontSize: 24 }
            : { x: 936, y: 147, width: 845, height: 842, fontSize: 24 };
      const legacyTextLayout = useReferenceTextBox && (
        isLegacyLayout('texto', 940, 100, 827, 879) ||
        isLegacyLayout('texto', 996, 100, 715, 879)
      );
      const textLayout = legacyTextLayout ? undefined : l;
      const defaultTextAlign = 'left';

      initialBlocks.push({
        id: 'texto',
        content: slideData.texto || slideData.texto_longo,
        x: textLayout?.x ?? defaultTextLayout.x,
        y: textLayout?.y ?? defaultTextLayout.y,
        width: textLayout?.width ?? defaultTextLayout.width,
        height: textLayout?.height ?? defaultTextLayout.height,
        fontSize: textLayout?.fontSize ?? defaultTextLayout.fontSize,
        color: textLayout?.color ?? '#FFFFFF',
        fontWeight: textLayout?.fontWeight ?? 'normal',
        align: textLayout?.align ?? defaultTextAlign,
        fontFamily: textLayout?.fontFamily ?? 'Lato',
        shadow: textLayout?.shadow ?? true
      });
    }

    if (slideData.frase) {
      const l = getLayout('frase');
      initialBlocks.push({
        id: 'frase',
        content: slideData.frase,
        x: l?.x ?? 360,
        y: l?.y ?? 500,
        width: l?.width ?? 1200,
        height: l?.height ?? 110,
        fontSize: l?.fontSize ?? 76,
        color: l?.color ?? '#0095FF',
        fontWeight: l?.fontWeight ?? 'bold',
        align: l?.align ?? 'center',
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

    // Desafios: 9 itens em grid (posiÃ§Ãµes especÃ­ficas)
    if (Array.isArray(slideData.itens)) {
      const items: string[] = slideData.itens;

      const defaultLayouts = [
        { x: 910, y: 250, width: 280, height: 170, shadow: true },
        { x: 1224, y: 252, width: 208, height: 166, shadow: true },
        { x: 1468, y: 250, width: 280, height: 170, shadow: false },
        { x: 940, y: 485, width: 229, height: 149, shadow: false },
        { x: 1190, y: 460, width: 280, height: 170, shadow: true },
        { x: 1490, y: 471, width: 235, height: 168, shadow: true },
        { x: 923, y: 680, width: 244, height: 166, shadow: true },
        { x: 1209, y: 676, width: 242, height: 166, shadow: false },
        { x: 1470, y: 680, width: 280, height: 170, shadow: true }
      ];
      const priorDefaultLayouts = [
        { x: 910, y: 250, width: 280, height: 170 },
        { x: 1190, y: 250, width: 280, height: 170 },
        { x: 1510, y: 280, width: 280, height: 170 },
        { x: 920, y: 460, width: 280, height: 170 },
        { x: 1190, y: 460, width: 280, height: 170 },
        { x: 1460, y: 460, width: 280, height: 170 },
        { x: 910, y: 680, width: 280, height: 170 },
        { x: 1190, y: 680, width: 280, height: 170 },
        { x: 1470, y: 680, width: 280, height: 170 }
      ];
      const legacyPositions = [
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
        const defaultLayout = defaultLayouts[i];
        const previousDefaultLayout = priorDefaultLayouts[i];
        const itemLayout = (
          isLegacyLayout(id, legacyPositions[i].x, legacyPositions[i].y, 280, 170) ||
          isLegacyLayout(id, previousDefaultLayout.x, previousDefaultLayout.y, previousDefaultLayout.width, previousDefaultLayout.height)
        ) ? undefined : l;
        const defaultFont = itemLayout?.fontSize ?? 24;

        const isBlackBg = i === 2 || i === 3 || i === 7;
        const defaultColor = isBlackBg ? '#000000' : '#FFFFFF';

        initialBlocks.push({
          id,
          content: items[i] || '',
          x: itemLayout?.x ?? defaultLayout.x,
          y: itemLayout?.y ?? defaultLayout.y,
          width: itemLayout?.width ?? defaultLayout.width,
          height: itemLayout?.height ?? defaultLayout.height,
          fontSize: defaultFont,
          color: itemLayout?.color ?? defaultColor,
          fontWeight: itemLayout?.fontWeight ?? 'normal',
          align: itemLayout?.align ?? 'center',
          fontFamily: itemLayout?.fontFamily ?? 'Lato',
          kind: 'text',
          shadow: itemLayout?.shadow ?? defaultLayout.shadow
        });
      }
    }

    if (isRoadmapSlide) {
      const cards = Array.isArray(slideData.cards) ? slideData.cards : [];
      const monthBoxes = [
        { x: 210, y: 170, width: 430, height: 90 },
        { x: 750, y: 170, width: 430, height: 90 },
        { x: 1253, y: 166, width: 430, height: 90 }
      ];
      const priorMonthBoxes = [
        { x: 170, y: 116, width: 430, height: 90 },
        { x: 718, y: 116, width: 430, height: 90 },
        { x: 1286, y: 116, width: 430, height: 90 }
      ];
      const cardBoxes = [
        { x: 177, y: 226, width: 493, height: 594 },
        { x: 713, y: 226, width: 501, height: 594 },
        { x: 1241, y: 226, width: 505, height: 594 }
      ];
      const titleDefaults = [
        { x: 212, y: 359, width: 433, height: 72 },
        { x: 745, y: 360, width: 441, height: 72 },
        { x: 1275, y: 356, width: 445, height: 72 }
      ];
      const priorTitleDefaults = [
        { x: 207, y: 318, width: 433, height: 72 },
        { x: 743, y: 318, width: 441, height: 72 },
        { x: 1271, y: 318, width: 445, height: 72 }
      ];
      const descriptionDefaults = [
        { x: 220, y: 480, width: 409, height: 170 },
        { x: 760, y: 480, width: 417, height: 170 },
        { x: 1288, y: 479, width: 421, height: 170 }
      ];
      const priorDescriptionDefaults = [
        { x: 219, y: 474, width: 409, height: 170 },
        { x: 755, y: 474, width: 417, height: 170 },
        { x: 1283, y: 474, width: 421, height: 170 }
      ];

      for (let i = 0; i < 3; i++) {
        const card = cards[i] || {};
        const cardBox = cardBoxes[i];
        const monthLayout = getLayout(`roadmap-mes-${i}`);
        const resolvedMonthLayout = isLegacyLayout(
          `roadmap-mes-${i}`,
          priorMonthBoxes[i].x,
          priorMonthBoxes[i].y,
          priorMonthBoxes[i].width,
          priorMonthBoxes[i].height
        ) ? undefined : monthLayout;
        initialBlocks.push({
          id: `roadmap-mes-${i}`,
          content: card.mes || '',
          x: resolvedMonthLayout?.x ?? monthBoxes[i].x,
          y: resolvedMonthLayout?.y ?? monthBoxes[i].y,
          width: resolvedMonthLayout?.width ?? monthBoxes[i].width,
          height: resolvedMonthLayout?.height ?? monthBoxes[i].height,
          fontSize: resolvedMonthLayout?.fontSize ?? 74,
          color: resolvedMonthLayout?.color ?? '#0095FF',
          fontWeight: resolvedMonthLayout?.fontWeight ?? 'bold',
          align: resolvedMonthLayout?.align ?? 'center',
          fontFamily: resolvedMonthLayout?.fontFamily ?? 'PoppinsBold',
          kind: 'text',
          shadow: resolvedMonthLayout?.shadow ?? false
        });

        const titleLayout = getLayout(`roadmap-titulo-${i}`);
        const resolvedTitleLayout = isLegacyLayout(
          `roadmap-titulo-${i}`,
          priorTitleDefaults[i].x,
          priorTitleDefaults[i].y,
          priorTitleDefaults[i].width,
          priorTitleDefaults[i].height
        ) ? undefined : titleLayout;
        initialBlocks.push({
          id: `roadmap-titulo-${i}`,
          content: card.titulo || '',
          x: resolvedTitleLayout?.x ?? titleDefaults[i].x,
          y: resolvedTitleLayout?.y ?? titleDefaults[i].y,
          width: resolvedTitleLayout?.width ?? titleDefaults[i].width,
          height: resolvedTitleLayout?.height ?? titleDefaults[i].height,
          fontSize: resolvedTitleLayout?.fontSize ?? 32,
          color: resolvedTitleLayout?.color ?? '#FFFFFF',
          fontWeight: resolvedTitleLayout?.fontWeight ?? 'bold',
          align: resolvedTitleLayout?.align ?? 'center',
          fontFamily: resolvedTitleLayout?.fontFamily ?? 'PoppinsBold',
          kind: 'text',
          shadow: resolvedTitleLayout?.shadow ?? false
        });

        const descricaoLayout = getLayout(`roadmap-descricao-${i}`);
        const resolvedDescriptionLayout = isLegacyLayout(
          `roadmap-descricao-${i}`,
          priorDescriptionDefaults[i].x,
          priorDescriptionDefaults[i].y,
          priorDescriptionDefaults[i].width,
          priorDescriptionDefaults[i].height
        ) ? undefined : descricaoLayout;
        initialBlocks.push({
          id: `roadmap-descricao-${i}`,
          content: card.descricao || '',
          x: resolvedDescriptionLayout?.x ?? descriptionDefaults[i].x,
          y: resolvedDescriptionLayout?.y ?? descriptionDefaults[i].y,
          width: resolvedDescriptionLayout?.width ?? descriptionDefaults[i].width,
          height: resolvedDescriptionLayout?.height ?? descriptionDefaults[i].height,
          fontSize: resolvedDescriptionLayout?.fontSize ?? 27,
          color: resolvedDescriptionLayout?.color ?? '#FFFFFF',
          fontWeight: resolvedDescriptionLayout?.fontWeight ?? 'normal',
          align: resolvedDescriptionLayout?.align ?? 'center',
          fontFamily: resolvedDescriptionLayout?.fontFamily ?? 'Lato',
          kind: 'text',
          shadow: resolvedDescriptionLayout?.shadow ?? false
        });

        const sugestaoLayout = getLayout(`roadmap-sugestao-${i}`);
        initialBlocks.push({
          id: `roadmap-sugestao-${i}`,
          content: card.sugestao || '',
          x: sugestaoLayout?.x ?? (cardBox.x + 30),
          y: sugestaoLayout?.y ?? (cardBox.y + 460),
          width: sugestaoLayout?.width ?? (cardBox.width - 60),
          height: sugestaoLayout?.height ?? 54,
          fontSize: sugestaoLayout?.fontSize ?? 17,
          color: sugestaoLayout?.color ?? '#FFFFFF',
          fontWeight: sugestaoLayout?.fontWeight ?? 'normal',
          align: sugestaoLayout?.align ?? 'center',
          fontFamily: sugestaoLayout?.fontFamily ?? 'Lato',
          kind: 'text',
          shadow: sugestaoLayout?.shadow ?? false
        });
      }
    }

    // Planner: mes, nome_cliente e caixa da logo
    if (isPlannerSlide) {
      const mesLayout = isLegacyPlannerLayout('mes', 100, 520) ? undefined : getLayout('mes');
      initialBlocks.push({
        id: 'mes',
        content: slideData.mes || '',
        x: mesLayout?.x ?? 191,
        y: mesLayout?.y ?? 634,
        width: mesLayout?.width ?? 470,
        height: mesLayout?.height ?? 40,
        fontSize: mesLayout?.fontSize ?? 24,
        color: mesLayout?.color ?? '#FFFFFF',
        fontWeight: mesLayout?.fontWeight ?? 'normal',
        align: mesLayout?.align ?? 'left',
        fontFamily: mesLayout?.fontFamily ?? 'Lato',
        kind: 'text',
        shadow: mesLayout?.shadow ?? true
      });

      const nameLayout = (isLegacyPlannerLayout('nome_cliente', 100, 950) || isLegacyLayout('nome_cliente', 191, 725, 360, 36)) ? undefined : getLayout('nome_cliente');
      initialBlocks.push({
        id: 'nome_cliente',
        content: slideData.nome_cliente || '',
        x: nameLayout?.x ?? 230,
        y: nameLayout?.y ?? 725,
        width: nameLayout?.width ?? 360,
        height: nameLayout?.height ?? 36,
        fontSize: nameLayout?.fontSize ?? 28,
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
        x: logoLayout?.x ?? 1060,
        y: logoLayout?.y ?? 340,
        width: logoLayout?.width ?? 430,
        height: logoLayout?.height ?? 430,
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
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manuallyResizedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initialBlocksRef.current = blocks.map((block) => ({ ...block }));
  }, []);


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

    // Atualizar posiÃ§Ã£o do mouse para mostrar coordenadas (arredondar apenas para display)
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
              // Aplicar snap e garantir valores positivos, mantendo precisÃ£o
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
              // Manter precisÃ£o no resize, mÃ­nimo 20px
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
   * ðŸš¨ FUNCIONALIDADE CRÃTICA - NÃƒO REMOVER ðŸš¨
   * 
   * Exporta a lÃ¢mina EXATAMENTE como aparece no editor (WYSIWYG).
   * Esta funÃ§Ã£o Ã© essencial porque:
   * 1. Preview (Python PIL) e Editor (HTML Canvas) podem renderizar layouts diferentes
   * 2. Permite correÃ§Ãµes manuais de lÃ¢minas individuais sem regenerar tudo
   * 3. Garante que o usuÃ¡rio baixe exatamente o que estÃ¡ vendo
   * 
   * DependÃªncias: html-to-image, downloadjs (jÃ¡ instaladas em package.json)
   * BotÃ£o UI: linha ~618 "ðŸ“¥ Exportar do Editor"
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
      alert('Imagem exportada com sucesso.');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar. Tente novamente.');
    }
  };
  const formatSignedDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);

  const getBlockLabel = (id: string) => {
    if (id === 'titulo') return 'Titulo';
    if (id === 'subtitulo') return 'Subtitulo';
    if (id === 'texto') return 'Texto principal';
    if (id === 'frase') return 'Slogan';
    if (id === 'legenda') return 'Legenda';
    if (id === 'mes') return 'Mes';
    if (id === 'nome_cliente') return 'Nome do cliente';
    if (id === 'logo') return 'Logo';
    if (id.startsWith('item-')) return `Desafio ${Number(id.replace('item-', '')) + 1}`;

    const roadmapMatch = id.match(/^roadmap-(mes|titulo|detalhe|descricao|sugestao)-(\d+)$/);
    if (roadmapMatch) {
      const fieldLabels: Record<string, string> = {
        mes: 'Mes',
        titulo: 'Titulo',
        detalhe: 'Detalhe',
        descricao: 'Descricao',
        sugestao: 'Sugestao',
      };
      return `Roadmap card ${Number(roadmapMatch[2]) + 1} / ${fieldLabels[roadmapMatch[1]]}`;
    }

    return id;
  };

  const getLayoutAdjustments = (): BlockAdjustment[] => {
    const originalById = new Map(initialBlocksRef.current.map((block) => [block.id, block]));
    const currentIds = new Set(blocks.map((block) => block.id));
    const adjustments: BlockAdjustment[] = [];

    blocks.forEach((block) => {
      const original = originalById.get(block.id);
      if (!original) {
        adjustments.push({ id: block.id, label: getBlockLabel(block.id), changes: ['novo elemento'] });
        return;
      }

      const changes: string[] = [];
      const deltaX = Math.round(block.x - original.x);
      const deltaY = Math.round(block.y - original.y);
      const deltaWidth = Math.round(block.width - original.width);
      const deltaHeight = Math.round(block.height - original.height);
      const deltaFontSize = Math.round(block.fontSize - original.fontSize);

      if (deltaX !== 0) changes.push(`x ${formatSignedDelta(deltaX)}px`);
      if (deltaY !== 0) changes.push(`y ${formatSignedDelta(deltaY)}px`);
      if (deltaWidth !== 0) changes.push(`largura ${formatSignedDelta(deltaWidth)}px`);
      if (deltaHeight !== 0) changes.push(`altura ${formatSignedDelta(deltaHeight)}px`);
      if (deltaFontSize !== 0) changes.push(`fonte ${formatSignedDelta(deltaFontSize)}px`);
      if (block.align !== original.align) changes.push(`alinhamento ${original.align} -> ${block.align}`);
      if (block.fontFamily !== original.fontFamily) changes.push(`fonte ${original.fontFamily} -> ${block.fontFamily}`);
      if (block.color !== original.color) changes.push(`cor ${original.color} -> ${block.color}`);
      if ((block.shadow ?? true) !== (original.shadow ?? true)) changes.push(`sombra ${(original.shadow ?? true) ? 'on' : 'off'} -> ${(block.shadow ?? true) ? 'on' : 'off'}`);
      if (block.content !== original.content) changes.push('texto editado');

      if (changes.length > 0) {
        adjustments.push({ id: block.id, label: getBlockLabel(block.id), changes });
      }
    });

    initialBlocksRef.current.forEach((block) => {
      if (!currentIds.has(block.id)) {
        adjustments.push({ id: block.id, label: getBlockLabel(block.id), changes: ['elemento removido'] });
      }
    });

    return adjustments;
  };

  const buildLayoutAdjustmentReport = () => {
    const adjustments = getLayoutAdjustments();
    if (adjustments.length === 0) {
      return `Slide: ${slideName}\nSem ajustes de layout detectados.`;
    }

    return [
      `Slide: ${slideName}`,
      ...adjustments.map((adjustment) => `- ${adjustment.label} (${adjustment.id}): ${adjustment.changes.join(', ')}`),
    ].join('\n');
  };

  const handleCopyAdjustmentReport = async () => {
    const report = buildLayoutAdjustmentReport();
    try {
      await navigator.clipboard.writeText(report);
      alert('Relatorio de ajustes copiado.');
    } catch (error) {
      console.error('Erro ao copiar relatorio:', error);
      download(report, `${slideName.replace(/\s+/g, '_')}_ajustes.txt`, 'text/plain');
      alert('Nao consegui copiar, entao baixei um TXT com os ajustes.');
    }
  };

  const layoutAdjustments = getLayoutAdjustments();
  const adjustmentReport = buildLayoutAdjustmentReport();

  const handleSaveLayout = () => {
    const updatedSlideData = { ...slideData };
    const blockIds = new Set(blocks.map((b) => b.id));

    // Persistir layout para o Python respeitar posiÃ§Ã£o/tamanho/fonte
    // Filtrar campos exclusivos do planner se nÃ£o for planner
    const blocksToSave = isPlannerSlide
      ? blocks
      : blocks.filter(b => {
        // Sempre filtrar nome_cliente de nÃ£o-planner
        if (b.id === 'nome_cliente') return false;
        // Filtrar mes apenas se nÃ£o existia no slideData original (evita criar blocos indesejados)
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

    console.log('[EDITOR] Layout sendo salvo:', JSON.stringify(updatedSlideData.layout, null, 2));
    console.log('[EDITOR] Ajustes detectados:\n' + buildLayoutAdjustmentReport());

    blocks.forEach((block) => {
      if (block.id === 'titulo') updatedSlideData.titulo = block.content;
      if (block.id === 'subtitulo') updatedSlideData.subtitulo = block.content;
      if (block.id === 'texto') updatedSlideData.texto_longo = block.content;
      if (block.id === 'frase') updatedSlideData.frase = block.content;
      if (block.id === 'legenda') updatedSlideData.legenda = block.content;
      // Campos mes e nome_cliente sÃ³ devem ser salvos se for planner
      if (isPlannerSlide && block.id === 'mes') updatedSlideData.mes = block.content;
      if (isPlannerSlide && block.id === 'nome_cliente') updatedSlideData.nome_cliente = block.content;
    });

    // Se o bloco foi removido, limpar o campo correspondente para nÃ£o ser re-renderizado
    if (!isPlannerSlide && !blockIds.has('titulo')) updatedSlideData.titulo = '';
    if (!blockIds.has('subtitulo')) updatedSlideData.subtitulo = '';
    if (!blockIds.has('texto')) updatedSlideData.texto_longo = '';
    if (!blockIds.has('frase')) updatedSlideData.frase = '';
    if (!blockIds.has('legenda')) updatedSlideData.legenda = '';

    // Limpeza robusta de campos por tipo de lÃ¢mina
    if (isPlannerSlide) {
      // Planner: limpar se blocos foram removidos
      if (!blockIds.has('mes')) updatedSlideData.mes = '';
      if (!blockIds.has('nome_cliente')) updatedSlideData.nome_cliente = '';
    } else if (isMetasSlide) {
      // Metas reuse the selected period; only cover-only data is removed.
      delete updatedSlideData.nome_cliente;
    } else {
      // Outras lÃ¢minas (Defesa, Slogan, Desafios): remover ambos completamente
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
      // Em "Novos Desafios" nao usar campo texto (nao gerar elemento texto)
      if ('texto' in updatedSlideData) delete updatedSlideData.texto;
    }

    const roadmapBlocks = blocks.filter((b) => b.id.startsWith('roadmap-'));
    if (Array.isArray(slideData.cards) || roadmapBlocks.length > 0) {
      const fixedCards = Array.from({ length: 3 }, () => ({
        mes: '',
        titulo: '',
        detalhe: '',
        descricao: '',
        sugestao: ''
      }));

      roadmapBlocks.forEach((block) => {
        const match = block.id.match(/^roadmap-(mes|titulo|detalhe|descricao|sugestao)-(\d+)$/);
        if (!match) return;
        const field = match[1] as 'mes' | 'titulo' | 'detalhe' | 'descricao' | 'sugestao';
        const index = parseInt(match[2], 10);
        if (Number.isNaN(index) || index < 0 || index >= fixedCards.length) return;
        fixedCards[index][field] = block.content || '';
      });

      updatedSlideData.cards = fixedCards;
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
      alert('Logo enviada para esta lamina. Clique em "Salvar e Regenerar".');
    } catch (e: any) {
      console.error('Erro ao fazer upload da logo (lamina):', e);
      alert('Erro ao fazer upload da logo: ' + (e.response?.data?.error || e.message));
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const isRoadmapBlock = (block: TextBlock) => block.id.startsWith('roadmap-');
  const isRoadmapMonthBlock = (block: TextBlock) => block.id.startsWith('roadmap-mes-');
  const isRoadmapTitleBlock = (block: TextBlock) => block.id.startsWith('roadmap-titulo-');
  const isRoadmapDetailBlock = (block: TextBlock) => block.id.startsWith('roadmap-detalhe-');
  const isRoadmapDescriptionBlock = (block: TextBlock) => block.id.startsWith('roadmap-descricao-');
  const isRoadmapSuggestionBlock = (block: TextBlock) => block.id.startsWith('roadmap-sugestao-');
  const isCenteredTextBlock = (block: TextBlock) =>
    block.id.startsWith('item-') ||
    block.id === 'frase' ||
    isRoadmapBlock(block);
  const hasGradientText = (block: TextBlock) => block.id === 'frase' || isRoadmapMonthBlock(block);
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
    if (isRoadmapDescriptionBlock(block)) return 6;
    if (block.id.startsWith('item-') || isRoadmapBlock(block)) return 8;
    return 8;
  };

  const getMaxLines = (block: TextBlock): number | undefined => {
    if (block.id.startsWith('item-') || isRoadmapDescriptionBlock(block)) return 3;
    if (block.id === 'frase' || isRoadmapTitleBlock(block) || isRoadmapSuggestionBlock(block)) return 2;
    if (usesUppercaseRender(block) || isRoadmapMonthBlock(block) || isRoadmapDetailBlock(block)) return 1;
    return undefined;
  };

  const shouldShrinkToFit = (block: TextBlock) =>
    block.id.startsWith('item-') || block.id === 'frase' || isRoadmapBlock(block);

  const getMinFontSize = (block: TextBlock) => {
    if (block.id === 'frase') return 24;
    if (isRoadmapMonthBlock(block)) return 36;
    if (isRoadmapTitleBlock(block)) return 22;
    if (isRoadmapDetailBlock(block)) return 20;
    if (isRoadmapDescriptionBlock(block) || block.id.startsWith('item-')) return 18;
    if (isRoadmapSuggestionBlock(block)) return 14;
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
      context.font = `${getFontWeightValue(block)} ${fontSize}px ${getFontFamilyName(block)}`;
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
        const testLine = `${currentLine} ${word}`.trim();
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
      fontSizePx: `${(fittedFontSize * scale).toFixed(2)}px`,
      lineHeightPx: `${(lineHeightForFont(fittedFontSize, lineSpacing) * scale).toFixed(2)}px`,
    };
  };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Editor Visual - {slideName}</h2>
            <p className="text-xs text-gray-400 mt-1">Arraste os textos para reposicionar | Duplo clique para editar</p>
          </div>
          <div className="flex gap-2">
            {/* ðŸš¨ BOTÃƒO CRÃTICO - NÃƒO REMOVER ðŸš¨ 
                Exporta WYSIWYG do editor, essencial quando preview Python difere do editor */}
            <button
              onClick={handleExportFromEditor}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
              title="Exporta exatamente o que voce ve no editor"
            >
              Exportar do Editor
            </button>
            <button
              onClick={handleSaveLayout}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              Salvar e Regenerar
            </button>
            <button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              Fechar
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

                {/* RÃ©guas */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-gray-900/80 flex items-center justify-center text-[10px] text-gray-400 pointer-events-none">
                  Regua Horizontal (1920px)
                </div>
                <div className="absolute top-0 left-0 bottom-0 w-6 bg-gray-900/80 flex items-center justify-center text-[10px] text-gray-400 pointer-events-none" style={{ writingMode: 'vertical-rl' }}>
                  Regua Vertical (1080px)
                </div>

                {/* Overlay de Textos */}
                <div className="absolute inset-0">
                  {blocks.map((block) => {
                    const renderedBlock = getRenderedTextLayout(block);
                    return (
                    <div
                      key={block.id}
                      onMouseDown={(e) => handleMouseDown(block.id, e)}
                      onDoubleClick={() => {
                        if (block.kind === 'logo') return;
                        handleDoubleClick(block.id, block.content);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${((block.x / 1920) * 100).toFixed(4)}%`,
                        top: `${((block.y / 1080) * 100).toFixed(4)}%`,
                        width: `${((block.width / 1920) * 100).toFixed(4)}%`,
                        height: `${((block.height / 1080) * 100).toFixed(4)}%`,
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
                              console.log('[LOGO ERROR] Falha ao carregar:', logoImgSrc);
                              if (logoTriedFallback) {
                                console.log('[LOGO ERROR] Fallback ja tentado, desistindo');
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
                                console.log('[LOGO ERROR] URL nao contem /static/ ou /api/static/, nao ha fallback');
                                return;
                              }
                              console.log('[LOGO FALLBACK] Tentando rota alternativa:', next);
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
                              Salvar (Ctrl+Enter)
                            </button>
                            <button
                              onClick={() => setIsEditing(null)}
                              className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
                            >
                              Cancelar (Esc)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ width: '100%' }}>{renderedBlock.content}</div>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>

              <div className="mt-4 bg-gray-800 rounded-lg p-4 text-xs text-gray-400">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <strong className="text-white">Arrastar:</strong> Clique e arraste o texto
                  </div>
                  <div>
                    <strong className="text-white">Editar:</strong> Duplo clique no texto
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
                      <span className="text-white">Mostrar Grid</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Snap to Grid (10px)</span>
                    </label>
                  </div>
                  {mousePos && (
                    <div className="text-white font-mono">
                      X: {mousePos.x}px, Y: {mousePos.y}px
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Painel Lateral */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-bold text-white">Ajustes Detectados</h4>
                  <button
                    onClick={handleCopyAdjustmentReport}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-bold"
                  >
                    Copiar ajustes
                  </button>
                </div>
                <div className="max-h-56 overflow-auto space-y-2 text-xs">
                  {layoutAdjustments.length > 0 ? (
                    layoutAdjustments.map((adjustment) => (
                      <div key={adjustment.id} className="bg-gray-900/80 rounded p-2 border border-gray-700">
                        <div className="text-white font-semibold">{adjustment.label}</div>
                        <div className="text-gray-400 mt-1">{adjustment.changes.join(', ')}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">Nenhum ajuste detectado ainda.</div>
                  )}
                </div>
                <pre className="mt-3 bg-gray-900/80 border border-gray-700 rounded p-3 text-[11px] leading-5 text-gray-400 whitespace-pre-wrap">{adjustmentReport}</pre>
              </div>

              {/* Painel de Propriedades */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-bold text-white mb-3">Propriedades</h4>

                {selectedBlock ? (
                  <div className="space-y-3">
                    {selectedBlock.kind === 'logo' && (
                      <div className="bg-gray-900 rounded p-3 border border-gray-700">
                        <label className="text-xs text-gray-400 block mb-2">Logo (por lamina)</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="w-full text-xs text-gray-300"
                          onChange={(e) => handleUploadLogoForSlide(e.target.files?.[0])}
                        />
                        <p className="text-[11px] text-gray-500 mt-2">
                          Esta logo sobrescreve a do cliente apenas nesta geracao.
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
                        Excluir elemento
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
                            {align === 'left' ? 'Esq' : align === 'center' ? 'Centro' : 'Dir'}
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
                <h4 className="text-sm font-bold text-white mb-2">Elementos</h4>
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















