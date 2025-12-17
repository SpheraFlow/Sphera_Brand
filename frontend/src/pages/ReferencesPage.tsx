import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: string;
}

interface GalleryItem {
  id: string;
  url: string;
  filename: string;
  mimetype: string;
}

export default function ReferencesPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState<'notes' | 'links' | 'gallery'>('notes');
  const [loading, setLoading] = useState(false);

  // Estados dos dados
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // Estados de edição
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');
  
  const [newLink, setNewLink] = useState({ title: '', url: '', category: 'Geral' });
  const [showLinkModal, setShowLinkModal] = useState(false);

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar Notas
      const notesRes = await axios.get(`http://localhost:3001/api/knowledge/doc/${clientId}/general_references`);
      setNotes(notesRes.data.content || '');

      // Carregar Links
      const linksRes = await axios.get(`http://localhost:3001/api/knowledge/doc/${clientId}/important_links`);
      setLinks(Array.isArray(linksRes.data.content) ? linksRes.data.content : []);

      // Carregar Galeria
      const galleryRes = await axios.get(`http://localhost:3001/api/knowledge/doc/${clientId}/asset_gallery`);
      setGallery(Array.isArray(galleryRes.data.content) ? galleryRes.data.content : []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- NOTAS ---
  const saveNotes = async () => {
    try {
      await axios.put(`http://localhost:3001/api/knowledge/doc/${clientId}/general_references`, { content: tempNotes });
      setNotes(tempNotes);
      setIsEditingNotes(false);
    } catch (error) {
      alert('Erro ao salvar notas');
    }
  };

  // --- LINKS ---
  const addLink = async () => {
    if (!newLink.title || !newLink.url) return;
    const newItem = { ...newLink, id: Date.now().toString() };
    const updatedLinks = [...links, newItem];
    
    try {
      await axios.put(`http://localhost:3001/api/knowledge/doc/${clientId}/important_links`, { content: updatedLinks });
      setLinks(updatedLinks);
      setNewLink({ title: '', url: '', category: 'Geral' });
      setShowLinkModal(false);
    } catch (error) {
      alert('Erro ao salvar link');
    }
  };

  const removeLink = async (id: string) => {
    const updatedLinks = links.filter(l => l.id !== id);
    try {
      await axios.put(`http://localhost:3001/api/knowledge/doc/${clientId}/important_links`, { content: updatedLinks });
      setLinks(updatedLinks);
    } catch (error) {
      alert('Erro ao remover link');
    }
  };

  // --- GALERIA ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      // Upload do arquivo
      const uploadRes = await axios.post('http://localhost:3001/api/knowledge/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newAsset: GalleryItem = {
        id: Date.now().toString(),
        url: uploadRes.data.url,
        filename: uploadRes.data.filename,
        mimetype: uploadRes.data.mimetype
      };

      // Atualizar lista no banco
      const updatedGallery = [...gallery, newAsset];
      await axios.put(`http://localhost:3001/api/knowledge/doc/${clientId}/asset_gallery`, { content: updatedGallery });
      
      setGallery(updatedGallery);
    } catch (error) {
      console.error(error);
      alert('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = async (id: string) => {
    const updatedGallery = gallery.filter(g => g.id !== id);
    try {
      await axios.put(`http://localhost:3001/api/knowledge/doc/${clientId}/asset_gallery`, { content: updatedGallery });
      setGallery(updatedGallery);
    } catch (error) {
      alert('Erro ao remover arquivo');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🗂️ Referências & Materiais</h1>
        <p className="text-gray-400">Central de ativos da marca: links, documentos e galeria visual.</p>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-8 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
            activeTab === 'notes' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          📝 Notas Gerais
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
            activeTab === 'links' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          🔗 Links Importantes
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
            activeTab === 'gallery' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          🖼️ Galeria de Ativos
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">Carregando dados...</div>
      ) : (
        <div className="min-h-[500px]">
          
          {/* --- TAB: NOTAS --- */}
          {activeTab === 'notes' && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Notas Fixas</h3>
                {!isEditingNotes ? (
                  <button
                    onClick={() => {
                      setTempNotes(notes);
                      setIsEditingNotes(true);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                  >
                    ✏️ Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveNotes}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm text-white"
                    >
                      Salvar
                    </button>
                  </div>
                )}
              </div>
              
              {isEditingNotes ? (
                <textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  className="w-full h-[400px] bg-gray-900 border border-gray-600 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-amber-500 font-mono text-sm"
                  placeholder="Escreva aqui senhas, acessos, observações fixas..."
                />
              ) : (
                <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-300">
                  {notes || <span className="text-gray-600 italic">Nenhuma nota cadastrada.</span>}
                </div>
              )}
            </div>
          )}

          {/* --- TAB: LINKS --- */}
          {activeTab === 'links' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium transition-colors"
                >
                  + Adicionar Link
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {links.map((link) => (
                  <div key={link.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start justify-between group hover:border-blue-500/50 transition-colors">
                    <div className="overflow-hidden">
                      <div className="text-xs text-blue-400 mb-1 font-semibold uppercase tracking-wider">{link.category}</div>
                      <h4 className="font-semibold text-white mb-1 truncate" title={link.title}>{link.title}</h4>
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-gray-500 hover:text-blue-400 truncate block"
                      >
                        {link.url}
                      </a>
                    </div>
                    <button
                      onClick={() => removeLink(link.id)}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                
                {links.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                    Nenhum link importante cadastrado.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB: GALERIA --- */}
          {activeTab === 'gallery' && (
            <div>
              <div className="flex justify-end mb-4">
                <label className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-white font-medium transition-colors cursor-pointer">
                  {uploading ? '⏳ Enviando...' : '+ Upload Arquivo'}
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    disabled={uploading}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gallery.map((item) => (
                  <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden group">
                    <div className="aspect-square bg-gray-900 flex items-center justify-center relative">
                      {item.mimetype.startsWith('image/') ? (
                        <img 
                          src={`http://localhost:3001${item.url}`} 
                          alt={item.filename} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">📄</span>
                      )}
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                         <a 
                          href={`http://localhost:3001${item.url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
                          title="Abrir"
                        >
                          ↗️
                        </a>
                        <button
                          onClick={() => removeAsset(item.id)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-400"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-gray-300 truncate" title={item.filename}>{item.filename}</p>
                    </div>
                  </div>
                ))}

                {gallery.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                    Nenhum arquivo na galeria.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Adicionar Link */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Adicionar Novo Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Título</label>
                <input
                  type="text"
                  value={newLink.title}
                  onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">URL</label>
                <input
                  type="text"
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                <select
                  value={newLink.category}
                  onChange={(e) => setNewLink({ ...newLink, category: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="Geral">Geral</option>
                  <option value="Design">Design</option>
                  <option value="Redes Sociais">Redes Sociais</option>
                  <option value="Documentos">Documentos</option>
                  <option value="Inspiração">Inspiração</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={addLink}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
