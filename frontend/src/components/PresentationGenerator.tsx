import { useState } from 'react';
import api from '../services/api';
import { useParams } from 'react-router-dom';
import VisualSlideEditor from './VisualSlideEditor';
import SlideEditorModal from './SlideEditorModal';
import download from 'downloadjs';

interface DefenseData {
  titulo: string;
  subtitulo: string;
  texto: string;
}

interface GridData {
  titulo: string;
  mes: string;
  texto_longo: string;
}

interface SloganData {
  frase: string;
  legenda: string;
}

interface DesafiosData {
  titulo?: string;
  itens?: string[];
  texto?: string; // Para edição no textarea
}

interface PlannerData {
  titulo?: string; // Mantendo compatibilidade opcional
  mes: string;
  nome_cliente: string;
  logo_path?: string;
}

export default function PresentationGenerator() {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState<'defesa' | 'grid' | 'slogan' | 'desafios' | 'planner'>('defesa');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [visualMode, setVisualMode] = useState(false);
  const [editingSlide, setEditingSlide] = useState<{ image: string; name: string; data: any; index: number } | null>(null);
  const [tempFiles, setTempFiles] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const getBackendOrigin = () => {
    const baseURL = (api as any)?.defaults?.baseURL;
    if (typeof baseURL === 'string' && baseURL.startsWith('http')) {
      try {
        return new URL(baseURL).origin;
      } catch (_e) {
        return window.location.origin;
      }
    }
    return window.location.origin;
  };

  const resolveAssetUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${getBackendOrigin()}${url}`;
    return url;
  };

  const getPngFilename = (imgUrl: string, fallback: string) => {
    try {
      const u = new URL(imgUrl, window.location.origin);
      const raw = (u.pathname.split('/').pop() || fallback).trim();
      return raw.toLowerCase().endsWith('.png') ? raw : `${raw}.png`;
    } catch (_e) {
      const raw = (imgUrl.split('?')[0].split('/').pop() || fallback).trim();
      return raw.toLowerCase().endsWith('.png') ? raw : `${raw}.png`;
    }
  };

  // Estado dos formulários
  const [defesa, setDefesa] = useState<DefenseData>({
    titulo: 'PLANEJA\nMENTO',
    subtitulo: 'CAMPANHA MENSAL',
    texto: 'Clique em "Preencher com IA" para gerar uma defesa estratégica baseada no seu calendário.'
  });

  const [grid, setGrid] = useState<GridData>({
    titulo: 'METAS\nDO MÊS',
    mes: 'MÊS VIGENTE',
    texto_longo: 'Descrição das metas...'
  });

  const [slogan, setSlogan] = useState<SloganData>({
    frase: 'SUA FRASE\nIMPACTANTE AQUI.',
    legenda: 'Conceito criativo'
  });

  const [desafios, setDesafios] = useState<DesafiosData>({
    titulo: 'NOVOS\nDESAFIOS',
    texto: '• Desafio 1\n• Desafio 2\n• Desafio 3',
    itens: ['Desafio 1', 'Desafio 2', 'Desafio 3']
  });

  const [planner, setPlanner] = useState<PlannerData>({
    titulo: 'VISÃO\nTRIMESTRAL',
    mes: 'MÊS 1 | MÊS 2 | MÊS 3',
    nome_cliente: 'Nome do Cliente'
  });

  const clamp = (value: string, max: number) => value.slice(0, max);

  const handleAiFill = async () => {
    if (!clientId) return alert("Cliente não identificado");
    try {
      setAiLoading(true);
      const res = await api.post('/presentation/generate-content', { clienteId: clientId });
      
      if (res.data.success && res.data.content) {
        const c = res.data.content;
        if (c.defesa) setDefesa(c.defesa);
        if (c.grid) setGrid(c.grid);
        if (c.slogan) setSlogan(c.slogan);
        
        if (c.desafios) {
            // Converter itens array para texto (textarea)
            const itens = c.desafios.itens || [];
            setDesafios({
                ...c.desafios,
                texto: itens.map((i: string) => `• ${i}`).join('\n')
            });
        }
        
        if (c.planner) {
            setPlanner({
                titulo: 'PLANNER\nTRIMESTRAL',
                ...c.planner
            });
        }
        
        alert("✅ Conteúdo gerado com sucesso! Revise e clique em Gerar Lâminas.");
      }
    } catch (error: any) {
      console.error(error);
      
      // Tratamento específico para erro de cota
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 'alguns minutos';
        alert(`⏳ Cota da API excedida.\n\nAguarde ${retryAfter} e tente novamente, ou preencha os campos manualmente.`);
      } else {
        const errorMsg = error.response?.data?.error || "Erro ao gerar conteúdo com IA.";
        alert(`❌ ${errorMsg}`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setGeneratedImages([]);

      const payload = {
        clienteId: clientId,
        defesa,
        grid,
        slogan,
        desafios,
        planner
      };

      const response = await api.post('/presentation/generate', payload);
      

      if (response.data.success) {
        const urls = (response.data.images || []).map((u: string) => resolveAssetUrl(u));
        setGeneratedImages(urls);
        setTempFiles(response.data.tempFiles || []);
      } else {
        alert('Erro ao gerar lâminas');
      }

    } catch (error: any) {
      console.error('Erro:', error);
      alert('Erro ao conectar com o gerador Python: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!clientId || generatedImages.length === 0) return;
    
    try {
      setLoading(true);
      const payload = {
        clienteId: clientId,
        tempFiles,
        dataJson: { defesa, grid, slogan, desafios, planner },
        titulo: `Apresentação ${new Date().toLocaleString()}`
      };
      
      const res = await api.post('/presentation/save', payload);
      
      if (res.data.success) {
        alert('✅ Apresentação salva no histórico!');
        fetchHistory(); // Atualizar lista
      }
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar versão: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!clientId) return;
    try {
      const res = await api.get(`/presentation/history/${clientId}`);
      if (res.data.success) {
        const h = (res.data.history || []).map((item: any) => {
          const arquivos = Array.isArray(item.arquivos)
            ? item.arquivos.map((u: string) => resolveAssetUrl(u))
            : [];
          return { ...item, arquivos };
        });
        setHistory(h);
        setShowHistory(true);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    }
  };

  const handleDownload = async (imgUrl: string, filename: string) => {
    try {
      const finalUrl = resolveAssetUrl(imgUrl);
      const response = await fetch(finalUrl);
      const blob = await response.blob();
      download(blob, getPngFilename(finalUrl, filename), 'image/png');
    } catch (error) {
      console.error('Erro ao baixar imagem:', error);
      alert('Erro ao baixar imagem. Tente novamente.');
    }
  };

  const handleBatchDownload = async () => {
    if (!generatedImages.length) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      await Promise.all(
        generatedImages.map(async (imgUrl, idx) => {
          const finalUrl = resolveAssetUrl(imgUrl);
          const res = await fetch(finalUrl);
          const blob = await res.blob();
          const name = getPngFilename(finalUrl, `slide_${idx + 1}.png`);
          zip.file(name, blob);
        })
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      download(zipBlob, `laminas_${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip');
    } catch (e) {
      console.error(e);
      alert('Erro ao baixar em lote. Tente novamente.');
    }
  };

  const handleOpenEditor = (imgUrl: string, _index: number) => {
    // Extrair nome do arquivo para identificar o tipo
    // Ex: /presentation-output/01_defesa.png -> defesa
    const filename = imgUrl.split('/').pop() || '';
    
    let templateName = '';
    let slideName = '';
    let data = {};
    let realIndex = 0;

    if (filename.includes('defesa')) {
        templateName = 'defesa_da_campanha';
        slideName = 'Defesa';
        data = defesa;
        realIndex = 0;
    } else if (filename.includes('metas')) {
        templateName = 'metas';
        slideName = 'Metas';
        data = grid;
        realIndex = 1;
    } else if (filename.includes('slogan')) {
        templateName = 'slogan';
        slideName = 'Slogan';
        data = slogan;
        realIndex = 2;
    } else if (filename.includes('desafios')) {
        templateName = 'novos_desafios';
        slideName = 'Desafios';
        data = desafios;
        realIndex = 3;
    } else if (filename.includes('planner')) {
        templateName = 'planner_trimestral';
        slideName = 'Planner';
        data = planner;
        realIndex = 4;
    }

    const templateImage = `/templates/template_${templateName}.png`;

    setEditingSlide({
      image: templateImage,
      name: slideName,
      data: data,
      index: realIndex // Usar o índice real do tipo de slide, não o da lista de imagens
    });
  };

  const handleSaveSlideEdit = async (_blocks: any[], updatedData: any) => {
    if (!editingSlide) return;
    
    try {
      setLoading(true);
      
      // Atualizar o estado local com os novos dados
      const slideDataMap = [setDefesa, setGrid, setSlogan, setDesafios, setPlanner];
      if (slideDataMap[editingSlide.index]) {
        slideDataMap[editingSlide.index](updatedData);
      }
      
      // Regenerar apenas esta lâmina
      const payload = {
        clienteId: clientId,
        defesa: editingSlide.index === 0 ? updatedData : defesa,
        grid: editingSlide.index === 1 ? updatedData : grid,
        slogan: editingSlide.index === 2 ? updatedData : slogan,
        desafios: editingSlide.index === 3 ? updatedData : desafios,
        planner: editingSlide.index === 4 ? updatedData : planner
      };

      const response = await api.post('/presentation/generate', payload);

      if (response.data.success) {
        setGeneratedImages(response.data.images);
        alert('✅ Lâmina regenerada com sucesso!');
        setEditingSlide(null);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      alert('Erro ao regenerar lâmina: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 Gerador de Lâminas (Python Engine)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Cria slides profissionais baseados no seu planejamento
          </p>
        </div>
        <div className="flex gap-2">
            <button
            onClick={fetchHistory}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 text-sm"
            >
            📜 Histórico
            </button>
            <button
            onClick={() => setVisualMode(!visualMode)}
            className={`${visualMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'} text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 text-sm`}
            >
            {visualMode ? '📝 Modo Formulário' : '🎨 Modo Visual'}
            </button>
            <button
            onClick={handleAiFill}
            disabled={aiLoading || visualMode}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            >
            {aiLoading ? '🤖 Criando...' : '✨ Preencher com IA'}
            </button>
            <button
            onClick={handleGenerate}
            disabled={loading || visualMode}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            >
            {loading ? '⚙️ Processando...' : '🚀 Gerar Lâminas'}
            </button>
            {generatedImages.length > 0 && (
              <button
              onClick={handleSaveVersion}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
              >
              💾 Salvar Versão
              </button>
            )}
        </div>
      </div>

      {/* Área de Histórico */}
      {showHistory && (
        <div className="mb-8 bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">📜 Histórico de Apresentações</h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white">✕ Fechar</button>
          </div>
          
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma apresentação salva encontrada.</p>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-white">{item.titulo}</h4>
                      <p className="text-xs text-gray-400">Criado em: {new Date(item.criado_em).toLocaleString()}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setGeneratedImages(item.arquivos);
                        setVisualMode(false);
                        setShowHistory(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm font-bold"
                    >
                      👁️ Visualizar
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {(Array.isArray(item.arquivos) ? item.arquivos : []).map((img: string, idx: number) => (
                      <img 
                        key={idx} 
                        src={img} 
                        className="h-20 w-auto rounded border border-gray-600" 
                        alt="Thumbnail" 
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {visualMode ? (
        <VisualSlideEditor
          templateImage={`/templates/template_${activeTab === 'defesa' ? 'defesa_da_campanha' : activeTab === 'grid' ? 'metas' : activeTab === 'desafios' ? 'novos_desafios' : activeTab === 'planner' ? 'planner_trimestral' : 'slogan'}.png`}
          initialBlocks={[]}
          onSave={(blocks) => {
            console.log('Layout salvo:', blocks);
            alert('💾 Coordenadas exportadas! Verifique o console (F12)');
          }}
        />
      ) : (
        /* Modo Formulário - Interface Tradicional */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna de Configuração */}
          <div className="lg:col-span-1 space-y-6">
          
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-700 overflow-x-auto">
            {['defesa', 'grid', 'slogan', 'desafios', 'planner'].map((tab) => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
          </div>

          {/* Formulários Dinâmicos */}
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 min-h-[300px]">
            
            {activeTab === 'defesa' && (
                <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-semibold text-blue-400">Defesa da Campanha</h3>
                <input
                    value={defesa.titulo}
                    onChange={e => setDefesa({...defesa, titulo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Título"
                />
                <input
                    value={defesa.subtitulo}
                    onChange={e => setDefesa({...defesa, subtitulo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Subtítulo"
                />
                <textarea
                    value={defesa.texto}
                    onChange={e => setDefesa({...defesa, texto: clamp(e.target.value, 850)})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-32"
                    placeholder="Texto de defesa..."
                />
                </div>
            )}

            {activeTab === 'grid' && (
                <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-semibold text-blue-400">Metas do Mês</h3>
                <input
                    value={grid.titulo}
                    onChange={e => setGrid({...grid, titulo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Título"
                />
                <input
                    value={grid.mes}
                    onChange={e => setGrid({...grid, mes: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Mês Vigente (ex: OUTUBRO)"
                />
                <textarea
                    value={grid.texto_longo}
                    onChange={e => setGrid({...grid, texto_longo: clamp(e.target.value, 850)})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-32"
                    placeholder="Descrição das metas..."
                />
                </div>
            )}

            {activeTab === 'slogan' && (
                <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-semibold text-blue-400">Slogan / Impacto</h3>
                <textarea
                    value={slogan.frase}
                    onChange={e => setSlogan({...slogan, frase: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-24 text-center font-bold"
                />
                <input
                    value={slogan.legenda}
                    onChange={e => setSlogan({...slogan, legenda: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white text-center"
                />
                </div>
            )}

            {activeTab === 'desafios' && (
                <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-semibold text-blue-400">Novos Desafios</h3>
                <input
                    value={desafios.titulo}
                    onChange={e => setDesafios({...desafios, titulo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Título"
                />
                <textarea
                    value={desafios.texto}
                    onChange={e => {
                        const raw = e.target.value;
                        const cleaned = raw
                          .split('\n')
                          .map((l) => l.replace(/^•\s*/, ''))
                          .map((l) => l.trim());

                        const items = cleaned
                          .filter((l) => l.length > 0)
                          .slice(0, 9)
                          .map((l) => clamp(l, 55));

                        // Completar com vazios até 9
                        while (items.length < 9) items.push('');

                        const texto = items
                          .filter((t) => t.trim().length > 0)
                          .map((t) => `• ${t}`)
                          .join('\n');

                        setDesafios({ ...desafios, texto, itens: items });
                    }}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-40"
                    placeholder="Liste os desafios..."
                />
                </div>
            )}

            {activeTab === 'planner' && (
                <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-semibold text-blue-400">Planner Trimestral</h3>
                <input
                    value={planner.titulo}
                    onChange={e => setPlanner({...planner, titulo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Título"
                />
                <input
                    value={planner.mes}
                    onChange={e => setPlanner({...planner, mes: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Mêses (ex: OUT | NOV | DEZ)"
                />
                <input
                    value={planner.nome_cliente}
                    onChange={e => setPlanner({...planner, nome_cliente: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Nome do Cliente"
                />
                </div>
            )}

          </div>
        </div>

        {/* Coluna de Preview (Resultados) */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800 min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
              <span>🖼️</span> Resultados Gerados
            </h3>
            {generatedImages.length > 0 && (
              <button
                onClick={handleBatchDownload}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 text-xs"
              >
                ⬇️⬇️ Baixar em Lote
              </button>
            )}
          </div>
          
          {generatedImages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedImages.map((imgUrl, idx) => (
                <div key={idx} className="group relative rounded-lg overflow-hidden border border-gray-700 shadow-xl bg-gray-800">
                  <div className="aspect-video relative">
                    <img 
                      src={imgUrl} 
                      alt="Slide gerado" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 backdrop-blur-sm">
                    <button 
                      onClick={() => handleOpenEditor(imgUrl, idx)}
                      className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-blue-700 transform hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                    >
                      ✏️ Editar
                    </button>
                    <button 
                      onClick={() => handleDownload(imgUrl, getPngFilename(imgUrl, 'slide.png'))}
                      className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-gray-200 transform hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                    >
                      ⬇️ Baixar
                    </button>
                  </div>
                  <div className="p-3 bg-gray-800 border-t border-gray-700">
                    <p className="text-xs text-gray-400 text-center truncate">
                      {imgUrl.split('/').pop()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-xl p-8">
              <span className="text-5xl mb-4 grayscale opacity-50">🎨</span>
              <p className="font-medium text-lg">Área de Visualização</p>
              <p className="text-sm mt-2 text-gray-500 max-w-sm text-center">
                1. Clique em "✨ Preencher com IA" para gerar o conteúdo.<br/>
                2. Revise os textos ao lado.<br/>
                3. Clique em "🚀 Gerar Lâminas".
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modal de Edição Visual */}
      {editingSlide && (
        <SlideEditorModal
          isOpen={true}
          onClose={() => setEditingSlide(null)}
          slideImage={editingSlide.image}
          slideName={editingSlide.name}
          slideData={editingSlide.data}
          onSave={handleSaveSlideEdit}
        />
      )}
    </div>
  );
}
