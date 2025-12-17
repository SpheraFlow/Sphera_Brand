import { useState } from 'react';
import axios from 'axios';

interface PhotoIdea {
  tipo: string;
  conceito: string;
  elementos_visuais: string;
  objetivo: string;
  dica_tecnica: string;
}

interface PhotoIdeasModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  mes: string;
  briefing?: string;
}

export default function PhotoIdeasModal({ isOpen, onClose, clienteId, mes, briefing }: PhotoIdeasModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [photoIdeas, setPhotoIdeas] = useState<PhotoIdea[]>([]);
  const [quantity, setQuantity] = useState(3);
  const [customBriefing, setCustomBriefing] = useState(briefing || '');

  const generatePhotoIdeas = async () => {
    setIsGenerating(true);
    try {
      const response = await axios.post('http://localhost:3001/api/photos/generate-photo-ideas', {
        clienteId,
        mes,
        briefing: customBriefing,
        quantity
      });

      if (response.data.success) {
        setPhotoIdeas(response.data.data.photo_ideas || []);
      } else {
        alert('Erro ao gerar ideias: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('Erro ao gerar ideias de fotos:', error);
      alert('Erro ao gerar ideias de fotos: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const getTypeColor = (tipo: string) => {
    const colors: Record<string, string> = {
      'Institucional': 'bg-blue-500',
      'Produto': 'bg-green-500',
      'Humanizada': 'bg-purple-500',
      'Bastidores': 'bg-orange-500',
      'Lifestyle': 'bg-pink-500',
    };
    return colors[tipo] || 'bg-gray-500';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-amber-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📸</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Ideias de Fotos</h2>
              <p className="text-yellow-100 text-sm">Geradas por IA para {mes}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-yellow-200 text-2xl font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Configurações */}
          {photoIdeas.length === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantidade de Ideias
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 3)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Briefing Adicional (Opcional)
                </label>
                <textarea
                  value={customBriefing}
                  onChange={(e) => setCustomBriefing(e.target.value)}
                  placeholder="Ex: Focar em produtos sustentáveis, ambiente ao ar livre..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white resize-none"
                  rows={3}
                />
              </div>

              <button
                onClick={generatePhotoIdeas}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Gerando Ideias...
                  </span>
                ) : (
                  '✨ Gerar Ideias de Fotos'
                )}
              </button>
            </div>
          )}

          {/* Ideias Geradas */}
          {photoIdeas.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {photoIdeas.length} {photoIdeas.length === 1 ? 'Ideia Gerada' : 'Ideias Geradas'}
                </h3>
                <button
                  onClick={() => setPhotoIdeas([])}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  🔄 Gerar Novas Ideias
                </button>
              </div>

              <div className="space-y-4">
                {photoIdeas.map((idea, index) => (
                  <div
                    key={index}
                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors"
                  >
                    {/* Tipo */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`${getTypeColor(idea.tipo)} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                        {idea.tipo}
                      </span>
                      <span className="text-gray-400 text-sm">Ideia #{index + 1}</span>
                    </div>

                    {/* Conceito */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-400 mb-1">💡 Conceito</h4>
                      <p className="text-white">{idea.conceito}</p>
                    </div>

                    {/* Elementos Visuais */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-400 mb-1">🎨 Elementos Visuais</h4>
                      <p className="text-gray-300 text-sm">{idea.elementos_visuais}</p>
                    </div>

                    {/* Objetivo */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-400 mb-1">🎯 Objetivo</h4>
                      <p className="text-gray-300 text-sm">{idea.objetivo}</p>
                    </div>

                    {/* Dica Técnica */}
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                      <h4 className="text-sm font-semibold text-yellow-400 mb-1">💡 Dica Técnica</h4>
                      <p className="text-gray-300 text-sm">{idea.dica_tecnica}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 border-t border-gray-700 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
