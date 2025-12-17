import React from 'react';

interface ContentMix {
  reels: number;
  static: number;
  carousel: number;
  stories: number;
  photos: number;
}

interface ContentMixSelectorProps {
  mix: ContentMix;
  onMixChange: (mix: ContentMix) => void;
}

interface ContentType {
  key: keyof ContentMix;
  label: string;
  emoji: string;
  description: string;
  color: string;
}

interface CustomLabels {
  reels?: string;
  static?: string;
  carousel?: string;
  stories?: string;
  photos?: string;
}

const defaultContentTypes: ContentType[] = [
  {
    key: 'reels',
    label: 'Reels',
    emoji: '📱',
    description: 'Vídeo Curto',
    color: 'from-purple-500 to-pink-500'
  },
  {
    key: 'static',
    label: 'Post Estático',
    emoji: '🖼️',
    description: 'Imagem',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    key: 'carousel',
    label: 'Carrossel',
    emoji: '🎠',
    description: 'Educativo',
    color: 'from-green-500 to-emerald-500'
  },
  {
    key: 'stories',
    label: 'Stories',
    emoji: '⭕',
    description: 'Sequência',
    color: 'from-orange-500 to-red-500'
  },
  {
    key: 'photos',
    label: 'Fotos',
    emoji: '📸',
    description: 'Ideias de Fotos',
    color: 'from-yellow-500 to-amber-500'
  }
];

export default function ContentMixSelector({ mix, onMixChange }: ContentMixSelectorProps) {
  const [customLabels, setCustomLabels] = React.useState<CustomLabels>(() => {
    const saved = localStorage.getItem('contentTypeLabels');
    return saved ? JSON.parse(saved) : {};
  });
  const [editingLabel, setEditingLabel] = React.useState<keyof ContentMix | null>(null);
  const [tempLabel, setTempLabel] = React.useState('');

  const updateCount = (type: keyof ContentMix, delta: number) => {
    const newValue = Math.max(0, mix[type] + delta);
    onMixChange({
      ...mix,
      [type]: newValue
    });
  };

  const saveCustomLabel = (key: keyof ContentMix) => {
    if (tempLabel.trim()) {
      const newLabels = { ...customLabels, [key]: tempLabel.trim() };
      setCustomLabels(newLabels);
      localStorage.setItem('contentTypeLabels', JSON.stringify(newLabels));
    }
    setEditingLabel(null);
    setTempLabel('');
  };

  const resetLabel = (key: keyof ContentMix) => {
    const newLabels = { ...customLabels };
    delete newLabels[key];
    setCustomLabels(newLabels);
    localStorage.setItem('contentTypeLabels', JSON.stringify(newLabels));
  };

  const contentTypes = defaultContentTypes.map(ct => ({
    ...ct,
    label: customLabels[ct.key] || ct.label
  }));

  const totalPosts = Object.values(mix).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      {/* Grid de Seleção */}
      <div className="grid grid-cols-2 gap-4">
        {contentTypes.map((contentType) => (
          <div
            key={contentType.key}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
          >
            <div className="text-center mb-4">
              <div className={`text-3xl mb-2 bg-gradient-to-r ${contentType.color} bg-clip-text text-transparent`}>
                {contentType.emoji}
              </div>
              {editingLabel === contentType.key ? (
                <div className="flex items-center gap-1 justify-center mb-1">
                  <input
                    type="text"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveCustomLabel(contentType.key)}
                    className="bg-gray-700 text-white text-sm px-2 py-1 rounded w-32 text-center"
                    autoFocus
                  />
                  <button
                    onClick={() => saveCustomLabel(contentType.key)}
                    className="text-green-500 hover:text-green-400 text-xs"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditingLabel(null)}
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 justify-center mb-1">
                  <div className="text-sm font-semibold text-white">
                    {contentType.label}
                  </div>
                  <button
                    onClick={() => {
                      setEditingLabel(contentType.key);
                      setTempLabel(contentType.label);
                    }}
                    className="text-gray-500 hover:text-gray-300 text-xs"
                    title="Editar nome"
                  >
                    ✏️
                  </button>
                  {customLabels[contentType.key] && (
                    <button
                      onClick={() => resetLabel(contentType.key)}
                      className="text-gray-500 hover:text-gray-300 text-xs"
                      title="Restaurar nome padrão"
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-400">
                {contentType.description}
              </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => updateCount(contentType.key, -1)}
                className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mix[contentType.key] <= 0}
              >
                -
              </button>

              <div className="bg-gray-700 px-4 py-2 rounded-lg min-w-[3rem] text-center">
                <span className="text-lg font-bold text-white">
                  {mix[contentType.key]}
                </span>
              </div>

              <button
                onClick={() => updateCount(contentType.key, 1)}
                className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white font-semibold transition-colors"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totalizador */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-xl p-4 text-center">
        <div className="text-sm text-gray-400 mb-1">Total de Posts</div>
        <div className="text-2xl font-bold text-white">
          {totalPosts}
        </div>
        {totalPosts === 0 && (
          <div className="text-xs text-gray-500 mt-1">
            Selecione pelo menos 1 tipo de conteúdo
          </div>
        )}
      </div>
    </div>
  );
}
