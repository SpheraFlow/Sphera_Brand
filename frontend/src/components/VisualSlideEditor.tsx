import { useState, useRef, MouseEvent } from 'react';

interface TextBlock {
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  maxWidth?: number;
}

interface VisualSlideEditorProps {
  templateImage: string;
  initialBlocks?: TextBlock[];
  onSave?: (blocks: TextBlock[]) => void;
}

function DraggableTextBlock({ 
  block, 
  onEdit, 
  onDelete,
  onDragStart,
  onSelect,
  isSelected
}: { 
  block: TextBlock; 
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string, startX: number, startY: number) => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(block.content);

  const handleSave = () => {
    onEdit(block.id, localContent);
    setIsEditing(false);
  };

  const handleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    onSelect(block.id);
    onDragStart(block.id, e.clientX, e.clientY);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        fontSize: block.fontSize,
        color: block.color,
        fontFamily: block.fontFamily,
        maxWidth: block.maxWidth || 'auto',
        cursor: 'move',
        border: isSelected ? '2px dashed #0095FF' : '2px dashed transparent',
        padding: '4px',
      }}
      className="group"
    >
      {isEditing ? (
        <div className="bg-gray-900/95 p-2 rounded border border-blue-500">
          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            className="bg-gray-800 text-white p-2 rounded w-full min-w-[300px]"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
            >
              ✓ Salvar
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
            >
              ✕ Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {block.content}
          </div>
          <div className="absolute -top-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => onDelete(block.id)}
              className="bg-red-600 text-white px-2 py-1 rounded text-xs"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function VisualSlideEditor({ 
  templateImage, 
  initialBlocks = [],
  onSave 
}: VisualSlideEditorProps) {
  const [blocks, setBlocks] = useState<TextBlock[]>(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (id: string, startX: number, startY: number) => {
    setDraggingId(id);
    setDragStart({ x: startX, y: startY });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingId || !dragStart) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === draggingId
          ? { ...block, x: block.x + deltaX, y: block.y + deltaY }
          : block
      )
    );

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDragStart(null);
  };

  const handleEdit = (id: string, content: string) => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === id ? { ...block, content } : block
      )
    );
  };

  const handleDelete = (id: string) => {
    setBlocks((prevBlocks) => prevBlocks.filter((block) => block.id !== id));
  };

  const addNewBlock = () => {
    const newBlock: TextBlock = {
      id: `block-${Date.now()}`,
      content: 'Novo Texto',
      x: 100,
      y: 100,
      fontSize: 24,
      color: '#FFFFFF',
      fontFamily: 'Lato',
      maxWidth: 400,
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlockStyle = (property: keyof TextBlock, value: any) => {
    if (!selectedBlockId) return;
    
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === selectedBlockId
          ? { ...block, [property]: value }
          : block
      )
    );
  };

  const exportCoordinates = () => {
    const pythonCode = blocks.map((block) => {
      return `draw.text((${block.x}, ${block.y}), "${block.content}", font=load_font('${block.fontFamily}.ttf', ${block.fontSize}), fill=${block.color === '#FFFFFF' ? 'COLOR_WHITE' : 'COLOR_BLUE'})`;
    }).join('\n');
    
    console.log('Código Python gerado:');
    console.log(pythonCode);
    alert('Código Python copiado para o console! (F12)');
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">🎨 Editor Visual de Slides</h3>
        <div className="flex gap-2">
          <button
            onClick={addNewBlock}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
          >
            ➕ Adicionar Texto
          </button>
          <button
            onClick={exportCoordinates}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
          >
            📋 Exportar Coordenadas
          </button>
          {onSave && (
            <button
              onClick={() => onSave(blocks)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
            >
              💾 Salvar Layout
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas de Edição */}
        <div className="lg:col-span-3">
          <div
            ref={containerRef}
            className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700"
            style={{ width: '100%', aspectRatio: '16/9' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={templateImage}
              alt="Template"
              className="w-full h-full object-contain"
              draggable={false}
            />
            
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative w-full h-full pointer-events-auto">
                {blocks.map((block) => (
                  <DraggableTextBlock
                    key={block.id}
                    block={block}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDragStart={handleDragStart}
                    onSelect={setSelectedBlockId}
                    isSelected={selectedBlockId === block.id}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-400 bg-gray-800 p-3 rounded">
            💡 <strong>Dica:</strong> Arraste os blocos de texto para posicioná-los. Passe o mouse sobre um bloco para editar ou excluir.
          </div>
        </div>

        {/* Painel de Propriedades */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-bold text-white mb-3">⚙️ Propriedades</h4>
            
            {selectedBlock ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tamanho da Fonte</label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={selectedBlock.fontSize}
                    onChange={(e) => updateBlockStyle('fontSize', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs text-white">{selectedBlock.fontSize}px</span>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Cor</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateBlockStyle('color', '#FFFFFF')}
                      className={`w-8 h-8 rounded border-2 ${selectedBlock.color === '#FFFFFF' ? 'border-blue-500' : 'border-gray-600'}`}
                      style={{ backgroundColor: '#FFFFFF' }}
                    />
                    <button
                      onClick={() => updateBlockStyle('color', '#0095FF')}
                      className={`w-8 h-8 rounded border-2 ${selectedBlock.color === '#0095FF' ? 'border-blue-500' : 'border-gray-600'}`}
                      style={{ backgroundColor: '#0095FF' }}
                    />
                    <button
                      onClick={() => updateBlockStyle('color', '#000000')}
                      className={`w-8 h-8 rounded border-2 ${selectedBlock.color === '#000000' ? 'border-blue-500' : 'border-gray-600'}`}
                      style={{ backgroundColor: '#000000' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fonte</label>
                  <select
                    value={selectedBlock.fontFamily}
                    onChange={(e) => updateBlockStyle('fontFamily', e.target.value)}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs"
                  >
                    <option value="Poppins">Poppins Bold</option>
                    <option value="Lato">Lato Regular</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Largura Máxima</label>
                  <input
                    type="number"
                    value={selectedBlock.maxWidth || 400}
                    onChange={(e) => updateBlockStyle('maxWidth', parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs"
                  />
                </div>

                <div className="pt-2 border-t border-gray-700">
                  <div className="text-xs text-gray-400">
                    <div>X: {selectedBlock.x}px</div>
                    <div>Y: {selectedBlock.y}px</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">
                Selecione um bloco de texto para editar suas propriedades
              </p>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-bold text-white mb-2">📋 Blocos</h4>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`text-xs p-2 rounded cursor-pointer truncate ${
                    selectedBlockId === block.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {block.content.substring(0, 30)}...
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
