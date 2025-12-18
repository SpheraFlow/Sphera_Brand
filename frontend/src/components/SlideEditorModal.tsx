import { useState, useRef, MouseEvent as ReactMouseEvent } from 'react';

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
  const [blocks, setBlocks] = useState<TextBlock[]>(() => {
    // Inicializar blocos baseado no tipo de slide
    const initialBlocks: TextBlock[] = [];

    const isPlannerSlide =
      (slideName || '').toLowerCase().includes('planner') ||
      (slideData?.mes !== undefined && slideData?.nome_cliente !== undefined);

    const layoutList = Array.isArray(slideData?.layout) ? slideData.layout : [];
    const layoutById = new Map<string, any>();
    layoutList.forEach((l: any) => {
      if (l && typeof l === 'object' && l.id) layoutById.set(l.id, l);
    });

    const getLayout = (id: string) => layoutById.get(id);

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
        x: l?.x ?? 100,
        y: l?.y ?? 600,
        width: l?.width ?? 700,
        height: l?.height ?? 90,
        fontSize: l?.fontSize ?? 28,
        color: l?.color ?? '#FFFFFF',
        fontWeight: l?.fontWeight ?? 'normal',
        align: l?.align ?? 'left',
        fontFamily: l?.fontFamily ?? 'Lato',
        shadow: l?.shadow ?? true
      });
    }
    
    const isDesafiosSlide = Array.isArray(slideData.itens);

    if (!isDesafiosSlide && (slideData.texto || slideData.texto_longo)) {
      const l = getLayout('texto');
      initialBlocks.push({
        id: 'texto',
        content: slideData.texto || slideData.texto_longo,
        x: l?.x ?? 1050,
        y: l?.y ?? 200,
        width: l?.width ?? 780,
        height: l?.height ?? 780,
        fontSize: l?.fontSize ?? 24,
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
        x: l?.x ?? 960,
        y: l?.y ?? 450,
        width: l?.width ?? 1200,
        height: l?.height ?? 260,
        fontSize: l?.fontSize ?? 75,
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

    // Desafios: 9 itens em grid (posições específicas)
    if (Array.isArray(slideData.itens)) {
      const items: string[] = slideData.itens;

      const defaultPositions = [
        { x: 903, y: 264 },
        { x: 1190, y: 243 },
        { x: 1488, y: 249 },
        { x: 915, y: 487 },
        { x: 1197, y: 489 },
        { x: 1479, y: 476 },
        { x: 938, y: 684 },
        { x: 1212, y: 680 },
        { x: 1486, y: 680 }
      ];

      for (let i = 0; i < 9; i++) {
        const id = `item-${i}`;
        const l = getLayout(id);

        initialBlocks.push({
          id,
          content: items[i] || '',
          x: l?.x ?? defaultPositions[i].x,
          y: l?.y ?? defaultPositions[i].y,
          width: l?.width ?? 280,
          height: l?.height ?? 280,
          fontSize: l?.fontSize ?? 20,
          color: l?.color ?? '#FFFFFF',
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
      const mesLayout = getLayout('mes');
      initialBlocks.push({
        id: 'mes',
        content: slideData.mes || '',
        x: mesLayout?.x ?? 187,
        y: mesLayout?.y ?? 584,
        width: mesLayout?.width ?? 700,
        height: mesLayout?.height ?? 90,
        fontSize: mesLayout?.fontSize ?? 32,
        color: mesLayout?.color ?? '#FFFFFF',
        fontWeight: mesLayout?.fontWeight ?? 'normal',
        align: mesLayout?.align ?? 'left',
        fontFamily: mesLayout?.fontFamily ?? 'Lato',
        kind: 'text',
        shadow: mesLayout?.shadow ?? true
      });

      const nameLayout = getLayout('nome_cliente');
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

      const logoLayout = getLayout('logo');
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
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if ((!draggingId && !resizingId) || (!dragStart && !resizeStart) || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;

    if (draggingId && dragStart) {
      const deltaX = (e.clientX - dragStart.x) * scaleX;
      const deltaY = (e.clientY - dragStart.y) * scaleY;

      setBlocks((prev) =>
        prev.map((block) =>
          block.id === draggingId
            ? { ...block, x: Math.max(0, block.x + deltaX), y: Math.max(0, block.y + deltaY) }
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
    setIsEditing(id);
    setEditContent(content);
  };

  const handleSaveEdit = () => {
    if (!isEditing) return;
    
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === isEditing ? { ...block, content: editContent } : block
      )
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

  const handleSaveLayout = () => {
    // Atualizar slideData com novos textos
    const updatedSlideData = { ...slideData };

    const isPlannerSlide =
      (slideName || '').toLowerCase().includes('planner') ||
      (slideData?.mes !== undefined && slideData?.nome_cliente !== undefined);

    const blockIds = new Set(blocks.map((b) => b.id));

    // Persistir layout para o Python respeitar posição/tamanho/fonte
    updatedSlideData.layout = blocks.map((b) => ({
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
    
    blocks.forEach((block) => {
      if (block.id === 'titulo') updatedSlideData.titulo = block.content;
      if (block.id === 'subtitulo') updatedSlideData.subtitulo = block.content;
      if (block.id === 'texto') updatedSlideData.texto_longo = block.content;
      if (block.id === 'frase') updatedSlideData.frase = block.content;
      if (block.id === 'legenda') updatedSlideData.legenda = block.content;
      if (block.id === 'mes') updatedSlideData.mes = block.content;
      if (block.id === 'nome_cliente') updatedSlideData.nome_cliente = block.content;
    });

    // Se o bloco foi removido, limpar o campo correspondente para não ser re-renderizado
    if (!isPlannerSlide && !blockIds.has('titulo')) updatedSlideData.titulo = '';
    if (!blockIds.has('subtitulo')) updatedSlideData.subtitulo = '';
    if (!blockIds.has('texto')) updatedSlideData.texto_longo = '';
    if (!blockIds.has('frase')) updatedSlideData.frase = '';
    if (!blockIds.has('legenda')) updatedSlideData.legenda = '';
    if (!blockIds.has('mes')) updatedSlideData.mes = '';
    if (!blockIds.has('nome_cliente')) updatedSlideData.nome_cliente = '';

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
                
                {/* Overlay de Textos */}
                <div className="absolute inset-0">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      onMouseDown={(e) => handleMouseDown(block.id, e)}
                      onDoubleClick={() => handleDoubleClick(block.id, block.content)}
                      style={{
                        position: 'absolute',
                        left: `${(block.x / 1920) * 100}%`,
                        top: `${(block.y / 1080) * 100}%`,
                        width: `${(block.width / 1920) * 100}%`,
                        height: `${(block.height / 1080) * 100}%`,
                        fontSize: `${(block.fontSize / 1080) * 100}vh`,
                        color: block.color,
                        fontWeight: block.fontWeight,
                        textAlign: block.align,
                        fontFamily: block.fontFamily,
                        cursor: draggingId === block.id ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'pre-wrap',
                        overflow: 'hidden',
                        textShadow: block.shadow === false ? 'none' : '2px 2px 4px rgba(0,0,0,0.8)',
                        border: selectedBlockId === block.id ? '2px dashed #0095FF' : '2px dashed transparent',
                        padding: '8px',
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

                      {isEditing === block.id ? (
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <strong className="text-white">🖱️ Arrastar:</strong> Clique e arraste o texto
                  </div>
                  <div>
                    <strong className="text-white">✏️ Editar:</strong> Duplo clique no texto
                  </div>
                  <div>
                    <strong className="text-white">⚙️ Propriedades:</strong> Selecione e ajuste ao lado →
                  </div>
                </div>
              </div>
            </div>

            {/* Painel de Propriedades */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-bold text-white mb-3">⚙️ Propriedades</h4>
                
                {selectedBlock ? (
                  <div className="space-y-3">
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
                          className={`flex-1 px-3 py-2 rounded text-xs ${
                            selectedBlock.shadow !== false ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          ON
                        </button>
                        <button
                          onClick={() => updateBlockProperty('shadow', false)}
                          className={`flex-1 px-3 py-2 rounded text-xs ${
                            selectedBlock.shadow === false ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
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
                            className={`w-10 h-10 rounded border-2 ${
                              selectedBlock.color === color ? 'border-blue-500 scale-110' : 'border-gray-600'
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
                          className={`flex-1 px-3 py-2 rounded text-xs ${
                            selectedBlock.fontWeight === 'normal'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => updateBlockProperty('fontWeight', 'bold')}
                          className={`flex-1 px-3 py-2 rounded text-xs font-bold ${
                            selectedBlock.fontWeight === 'bold'
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
                            className={`flex-1 px-3 py-2 rounded text-xs ${
                              selectedBlock.align === align
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
                      className={`w-full text-left text-xs p-2 rounded truncate ${
                        selectedBlockId === block.id
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
