import { useState, useRef, MouseEvent as ReactMouseEvent } from 'react';

interface TextBlock {
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
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
    
    if (slideData.titulo) {
      initialBlocks.push({
        id: 'titulo',
        content: slideData.titulo,
        x: 100,
        y: 400,
        fontSize: 65,
        color: '#0095FF',
        fontWeight: 'bold',
        align: 'left'
      });
    }
    
    if (slideData.subtitulo) {
      initialBlocks.push({
        id: 'subtitulo',
        content: slideData.subtitulo,
        x: 100,
        y: 600,
        fontSize: 28,
        color: '#FFFFFF',
        fontWeight: 'normal',
        align: 'left'
      });
    }
    
    if (slideData.texto || slideData.texto_longo) {
      initialBlocks.push({
        id: 'texto',
        content: slideData.texto || slideData.texto_longo,
        x: 1050,
        y: 200,
        fontSize: 26,
        color: '#FFFFFF',
        fontWeight: 'normal',
        align: 'left'
      });
    }
    
    if (slideData.frase) {
      initialBlocks.push({
        id: 'frase',
        content: slideData.frase,
        x: 960,
        y: 450,
        fontSize: 75,
        color: '#0095FF',
        fontWeight: 'bold',
        align: 'center'
      });
    }
    
    if (slideData.legenda) {
      initialBlocks.push({
        id: 'legenda',
        content: slideData.legenda,
        x: 960,
        y: 650,
        fontSize: 22,
        color: '#FFFFFF',
        fontWeight: 'normal',
        align: 'center'
      });
    }
    
    return initialBlocks;
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
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

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!draggingId || !dragStart || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;

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
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDragStart(null);
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

  const handleSaveLayout = () => {
    // Atualizar slideData com novos textos
    const updatedSlideData = { ...slideData };
    
    blocks.forEach((block) => {
      if (block.id === 'titulo') updatedSlideData.titulo = block.content;
      if (block.id === 'subtitulo') updatedSlideData.subtitulo = block.content;
      if (block.id === 'texto') updatedSlideData.texto_longo = block.content;
      if (block.id === 'frase') updatedSlideData.frase = block.content;
      if (block.id === 'legenda') updatedSlideData.legenda = block.content;
    });
    
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
                        fontSize: `${(block.fontSize / 1080) * 100}vh`,
                        color: block.color,
                        fontWeight: block.fontWeight,
                        textAlign: block.align,
                        cursor: draggingId === block.id ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'pre-wrap',
                        maxWidth: '80%',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        border: selectedBlockId === block.id ? '2px dashed #0095FF' : '2px dashed transparent',
                        padding: '8px',
                        transition: draggingId ? 'none' : 'all 0.2s',
                      }}
                      className="hover:bg-blue-500/10"
                    >
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
