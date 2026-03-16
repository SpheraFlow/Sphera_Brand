import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { resolveAssetUrl } from '../utils/assetHelpers';
import { getArchetypeInfo, JUNG_ARCHETYPES } from '../utils/jungArchetypes';

interface BrandingData {
  id?: string;
  cliente_id?: string;
  visual_style: {
    colors?: string[];
    fonts?: string[];
    archeType?: string;
  };
  tone_of_voice: {
    description?: string;
    keywords?: string[];
  };
  audience: {
    persona?: string;
    demographics?: string;
  };
  keywords: string[];
  // Novos campos Brand DNA 2.0
  archetype?: string;
  usp?: string;
  anti_keywords?: string[];
  niche?: string;
  logo_url?: string;
  updated_at?: string;
}

interface ClienteData {
  id: string;
  categorias_nicho?: string[];
}

type BrandingVersionMeta = {
  id: string;
  cliente_id: string;
  branding_id: string | null;
  reason: string | null;
  created_at: string;
};

type BrandingVersionDetail = BrandingVersionMeta & {
  snapshot: any;
};

export default function BrandProfile() {
  // ============================================
  //  PROVA DE VIDA - FRONTEND
  // ============================================
  const RENDER_ID = Date.now();
  console.log(`\n [FRONTEND VIVO] BrandProfile renderizado - ID: ${RENDER_ID}`);
  console.log(` Timestamp: ${new Date().toISOString()}`);

  const { clientId } = useParams<{ clientId: string }>();
  console.log(`x  Cliente ID da URL: ${clientId}`);

  // Estado inicial com valores vazios
  const emptyBranding: BrandingData = {
    visual_style: { colors: [], fonts: [], archeType: '' },
    tone_of_voice: { description: '', keywords: [] },
    audience: { persona: '', demographics: '' },
    keywords: [],
    logo_url: ''
  };

  const [branding, setBranding] = useState<BrandingData>(emptyBranding);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewBrand, setIsNewBrand] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadImages, setUploadImages] = useState<File[]>([]);
  const [uploadCaptions, setUploadCaptions] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Estados para edicao
  const [editColors, setEditColors] = useState<string[]>([]);
  const [editFonts, setEditFonts] = useState<string[]>([]);
  const [editArcheType, setEditArcheType] = useState('');
  const [editToneDescription, setEditToneDescription] = useState('');
  const [editToneKeywords, setEditToneKeywords] = useState<string[]>([]);
  const [editPersona, setEditPersona] = useState('');
  const [editDemographics, setEditDemographics] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);

  // Novos campos Brand DNA 2.0
  const [editArchetype, setEditArchetype] = useState('');
  const [editUsp, setEditUsp] = useState('');
  const [editAntiKeywords, setEditAntiKeywords] = useState<string[]>([]);
  const [editNiche, setEditNiche] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [clientCategoriasNicho, setClientCategoriasNicho] = useState<string[]>([]);
  const [editCategoriasNicho, setEditCategoriasNicho] = useState<string[]>([]);
  const [categoriasSuggestions, setCategoriasSuggestions] = useState<string[]>([]);
  const [categoriasQuery, setCategoriasQuery] = useState<string>('');
  const [loadingCategoriasSuggestions, setLoadingCategoriasSuggestions] = useState(false);

  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<BrandingVersionMeta[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<BrandingVersionDetail | null>(null);
  const [restoringVersion, setRestoringVersion] = useState(false);

  // Estado para controlar se ha rascunho restaurado
  const [hasDraftRestored, setHasDraftRestored] = useState(false);
  const ignoreAutoSave = useRef(false);

  // Inputs temporarios
  const [newColor, setNewColor] = useState('');
  const [newFont, setNewFont] = useState('');
  const [newToneKeyword, setNewToneKeyword] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newAntiKeyword, setNewAntiKeyword] = useState('');

  const addCategoriaNicho = (raw: string) => {
    const next = String(raw || '').trim();
    if (!next) return;
    const key = next.toLowerCase();
    setEditCategoriasNicho((prev: string[]) => {
      const existing = new Set(prev.map((c) => String(c).toLowerCase()));
      if (existing.has(key)) return prev;
      return [...prev, next];
    });
    setCategoriasQuery('');
  };

  const removeCategoriaNicho = (cat: string) => {
    const key = String(cat || '').toLowerCase();
    setEditCategoriasNicho((prev: string[]) => prev.filter((c) => String(c).toLowerCase() !== key));
  };

  // Funcao para salvar no localStorage
  const saveToLocalStorage = (data: BrandingData) => {
    if (clientId) {
      const draftKey = `branding_draft_${clientId}`;
      localStorage.setItem(draftKey, JSON.stringify({
        ...data,
        lastSaved: Date.now()
      }));
      console.log(' [AUTO-SAVE] Dados salvos no localStorage');
    }
  };

  // Funcao para carregar do localStorage
  const loadFromLocalStorage = (): BrandingData | null => {
    if (clientId) {
      const draftKey = `branding_draft_${clientId}`;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('x [AUTO-SAVE] Rascunho encontrado no localStorage');
          return parsed;
        } catch (error) {
          console.error('R [AUTO-SAVE] Erro ao parsear rascunho:', error);
          return null;
        }
      }
    }
    return null;
  };

  // Funcao para limpar localStorage
  const clearLocalStorage = () => {
    if (clientId) {
      const draftKey = `branding_draft_${clientId}`;
      localStorage.removeItem(draftKey);
      console.log('x [AUTO-SAVE] Rascunho removido do localStorage');
    }
  };

  const openVersionsModal = async () => {
    if (!clientId) return;
    setShowVersionsModal(true);
    setSelectedVersion(null);
    setLoadingVersions(true);
    try {
      const res = await api.get(`/branding/${clientId}/versions`);
      const list = Array.isArray(res.data?.versions) ? res.data.versions : [];
      setVersions(list);
    } catch (_e) {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const openVersionDetail = async (versionId: string) => {
    if (!clientId) return;
    setLoadingVersions(true);
    try {
      const res = await api.get(`/branding/${clientId}/versions/${versionId}`);
      const v = res.data?.version;
      if (v) setSelectedVersion(v);
    } finally {
      setLoadingVersions(false);
    }
  };

  const restoreVersion = async (versionId: string) => {
    if (!clientId) return;
    const ok = window.confirm('Restaurar esta versao do DNA? Uma copia do estado atual sera salva automaticamente.');
    if (!ok) return;
    setRestoringVersion(true);
    try {
      await api.post(`/branding/${clientId}/versions/${versionId}/restore`, {});
      const refreshed = await api.get(`/branding/${clientId}`);
      ignoreAutoSave.current = true; // Evitar salvar como rascunho imediatamente
      setBranding(refreshed.data?.branding || emptyBranding);
      setIsNewBrand(false);
      setIsEditing(false);
      clearLocalStorage();
      setHasDraftRestored(false);
      await openVersionsModal();
    } finally {
      setRestoringVersion(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      loadBranding();
    }
  }, [clientId]);

  // Auto-save: sempre que o branding mudar, salva no localStorage
  useEffect(() => {
    if (branding && Object.keys(branding).length > 0 && !loading) {
      if (ignoreAutoSave.current) {
        console.log(' [AUTO-SAVE] Ignorando salvamento (dados vindos do backend)');
        ignoreAutoSave.current = false;
        return;
      }

      // So salva se nao for dados vazios iniciais
      const hasContent = (branding.visual_style?.colors?.length ?? 0) > 0 ||
        branding.tone_of_voice?.description ||
        branding.audience?.persona ||
        (branding.keywords?.length ?? 0) > 0 ||
        branding.archetype ||
        branding.usp ||
        (branding.anti_keywords?.length ?? 0) > 0 ||
        branding.niche;

      if (hasContent) {
        saveToLocalStorage(branding);
      }
    }
  }, [branding, loading, clientId]);

  const loadBranding = async () => {
    console.log(' [LOAD BRANDING] Iniciando carregamento para cliente:', clientId);

    try {
      setLoading(true);
      let currentLogoUrl = '';

      try {
        const clientRes = await api.get(`/clients/${clientId}`);
        const cliente: (ClienteData & { logo_url?: string | null }) | undefined = clientRes.data?.cliente;
        const currentCats = Array.isArray(cliente?.categorias_nicho)
          ? cliente?.categorias_nicho?.map((c) => String(c).trim()).filter(Boolean)
          : [];
        currentLogoUrl = typeof cliente?.logo_url === 'string' ? cliente.logo_url : '';
        setClientCategoriasNicho(currentCats);
      } catch (_e) {
        setClientCategoriasNicho([]);
      }

      // Primeiro: verificar se ha rascunho no localStorage
      const draftData = loadFromLocalStorage();
      if (draftData) {
        console.log('x [LOAD BRANDING] Rascunho encontrado, restaurando...');
        setBranding({ ...draftData, logo_url: draftData.logo_url || currentLogoUrl });
        setHasDraftRestored(true);
        setIsNewBrand(false);
        setIsEditing(true); // Permite edicao imediata do rascunho
        setLoading(false);
        return;
      }

      // Segundo: buscar dados salvos do banco
      console.log(' [LOAD BRANDING] Nenhum rascunho encontrado, buscando do banco...');
      console.log(' [LOAD BRANDING] Fazendo requisicao para:', `/branding/${clientId}`);

      const response = await api.get(`/branding/${clientId}`);
      console.log(' [LOAD BRANDING] Resposta recebida:', response.data);
      console.log(' [LOAD BRANDING] Branding data:', response.data.branding);

      ignoreAutoSave.current = true; // Evitar salvar como rascunho ao carregar do banco
      setBranding({ ...response.data.branding, logo_url: currentLogoUrl || response.data?.branding?.logo_url || '' });
      setIsNewBrand(false);
      setHasDraftRestored(false);

      console.log(' [LOAD BRANDING] Estado atualizado com dados do banco');

    } catch (err: any) {
      console.log('a [LOAD BRANDING] Branding nao encontrado no banco, inicializando vazio');
      console.log('a [LOAD BRANDING] Erro:', err.response?.data || err.message);

      // Em vez de mostrar erro, inicializa com valores vazios e ativa edicao
      setBranding(emptyBranding);
      setIsNewBrand(true);
      setIsEditing(true); // Entra automaticamente em modo de edicao
      setHasDraftRestored(false);

      console.log(' [LOAD BRANDING] Estado inicializado como vazio');
    } finally {
      setLoading(false);
      console.log(' [LOAD BRANDING] Finalizado');
    }
  };

  const startEditing = () => {
    setEditColors(branding.visual_style?.colors || []);
    setEditFonts(branding.visual_style?.fonts || []);
    setEditArcheType(branding.visual_style?.archeType || '');
    setEditToneDescription(branding.tone_of_voice?.description || '');
    setEditToneKeywords(branding.tone_of_voice?.keywords || []);
    setEditPersona(branding.audience?.persona || '');
    setEditDemographics(branding.audience?.demographics || '');
    setEditKeywords(branding.keywords || []);
    // Novos campos Brand DNA 2.0
    setEditArchetype(branding.archetype || '');
    setEditUsp(branding.usp || '');
    setEditAntiKeywords(branding.anti_keywords || []);
    setEditNiche(branding.niche || '');
    setEditLogoUrl(branding.logo_url || '');
    setEditCategoriasNicho(clientCategoriasNicho || []);
    setCategoriasQuery('');
    setIsEditing(true);

    (async () => {
      try {
        setLoadingCategoriasSuggestions(true);
        const res = await api.get('/datas-comemorativas/categorias');
        const list = Array.isArray(res.data?.categorias) ? res.data.categorias : [];
        setCategoriasSuggestions(list.map((c: any) => String(c)).filter(Boolean));
      } catch (_e) {
        setCategoriasSuggestions([]);
      } finally {
        setLoadingCategoriasSuggestions(false);
      }
    })();
  };

  const cancelEditing = () => {
    if (isNewBrand) {
      // Se for novo e cancelar, volta para o estado vazio mas nao sai do modo edicao
      return;
    }
    setIsEditing(false);
  };

  const saveBranding = async () => {
    if (!clientId) return;

    try {
      setIsSaving(true);

      const payload = {
        visual_style: {
          colors: editColors,
          fonts: editFonts,
          archeType: editArcheType
        },
        tone_of_voice: {
          description: editToneDescription,
          keywords: editToneKeywords
        },
        audience: {
          persona: editPersona,
          demographics: editDemographics
        },
        keywords: editKeywords,
        // Novos campos Brand DNA 2.0
        archetype: editArchetype,
        usp: editUsp,
        anti_keywords: editAntiKeywords,
        niche: editNiche
      };

      console.log(' [BRANDING SAVE] Salvando branding definitivo:', payload);

      await api.put(`/branding/${clientId}`, payload);

      try {
        await api.put(`/clients/${clientId}`, {
          categorias_nicho: editCategoriasNicho,
          logo_url: editLogoUrl || null,
        });
      } catch (e: any) {
        console.error('R Erro ao salvar categorias_nicho do cliente:', e);
      }

      // Apos salvar com sucesso, limpar o rascunho do localStorage
      clearLocalStorage();
      setHasDraftRestored(false);

      alert('S& DNA da Marca salvo com sucesso!');
      setIsEditing(false);
      setIsNewBrand(false);
      loadBranding(); // Recarrega os dados
    } catch (error: any) {
      console.error('R Erro ao salvar branding:', error);
      alert('Erro ao salvar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Funcoes auxiliares para adicionar/remover itens
  const addColor = () => {
    if (newColor && !editColors.includes(newColor)) {
      setEditColors([...editColors, newColor]);
      setNewColor('');
    }
  };

  const removeColor = (index: number) => {
    setEditColors(editColors.filter((_, i) => i !== index));
  };

  const addFont = () => {
    if (newFont && !editFonts.includes(newFont)) {
      setEditFonts([...editFonts, newFont]);
      setNewFont('');
    }
  };

  const removeFont = (index: number) => {
    setEditFonts(editFonts.filter((_, i) => i !== index));
  };

  const addToneKeyword = () => {
    if (newToneKeyword && !editToneKeywords.includes(newToneKeyword)) {
      setEditToneKeywords([...editToneKeywords, newToneKeyword]);
      setNewToneKeyword('');
    }
  };

  const removeToneKeyword = (index: number) => {
    setEditToneKeywords(editToneKeywords.filter((_, i) => i !== index));
  };

  const addKeyword = () => {
    if (newKeyword && !editKeywords.includes(newKeyword)) {
      setEditKeywords([...editKeywords, newKeyword]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (index: number) => {
    setEditKeywords(editKeywords.filter((_, i) => i !== index));
  };

  const addAntiKeyword = () => {
    if (newAntiKeyword && !editAntiKeywords.includes(newAntiKeyword)) {
      setEditAntiKeywords([...editAntiKeywords, newAntiKeyword]);
      setNewAntiKeyword('');
    }
  };

  const removeAntiKeyword = (index: number) => {
    setEditAntiKeywords(editAntiKeywords.filter((_, i) => i !== index));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 3); // Maximo 3 imagens
      setUploadImages(filesArray);
    }
  };

  const handleClientLogoUpload = async (file: File | null | undefined) => {
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/client-logos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrl = String(response.data?.url || '').trim();
      if (!uploadedUrl) throw new Error('Upload sem URL de retorno');
      setEditLogoUrl(uploadedUrl);
    } catch (error: any) {
      console.error('Erro ao enviar logo do cliente:', error);
      alert('Erro ao enviar a logo do cliente. Tente novamente.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const processUpload = async () => {
    console.log(' [BRANDPROFILE] ======= PROCESS UPLOAD INICIADO =======');
    console.log(' [BRANDPROFILE] processUpload chamado!');
    console.log(' [BRANDPROFILE] clientId:', clientId, 'Type:', typeof clientId);
    console.log(' [BRANDPROFILE] uploadImages.length:', uploadImages.length);
    console.log(' [BRANDPROFILE] uploadImages:', uploadImages);
    console.log(' [BRANDPROFILE] ======= PROCESS UPLOAD INICIADO =======');

    if (!clientId) {
      alert('R Erro: Cliente ID nao encontrado');
      return;
    }

    if (uploadImages.length === 0) {
      alert('a Adicione pelo menos 1 imagem');
      return;
    }

    try {
      console.log(' [BRANDPROFILE] Iniciando upload...');
      setIsUploading(true);

      const formData = new FormData();
      formData.append('clienteId', clientId);

      // Enviar apenas a primeira imagem (conforme a rota backend)
      formData.append('file', uploadImages[0]);

      console.log('\n ============================================');
      console.log(' [FRONTEND] Preparando upload');
      console.log(' ============================================');
      console.log('x  Cliente ID:', clientId);
      console.log(' Legendas:', uploadCaptions ? 'Sim' : 'Nao');
      console.log(' Imagem selecionada:', uploadImages[0].name);
      console.log(' [UPLOAD] Enviando para Cliente:', clientId);

      // Log detalhado do FormData
      console.log('\n Conteudo do FormData:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  - ${key}: ${value.name} (${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`  - ${key}: ${value}`);
        }
      }

      const targetUrl = '/knowledge/branding/extract';
      console.log('xa [BRANDPROFILE] Enviando requisicao para:', targetUrl);
      console.log('xa [BRANDPROFILE] Cliente ID:', clientId);
      console.log('xa [BRANDPROFILE] Arquivo:', uploadImages[0]?.name);
      console.log('xa [BRANDPROFILE] BaseURL da API:', api.defaults.baseURL);

      const response = await api.post(
        targetUrl,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      console.log('\nS& ============================================');
      console.log('S& [FRONTEND] Resposta recebida');
      console.log('S& ============================================');
      console.log('DNA extraido:', response.data);

      // Atualizar estado local com os dados retornados
      console.log('x [BRANDPROFILE] Verificando resposta da API...');
      console.log('x [BRANDPROFILE] response.data:', response.data);
      console.log('x [BRANDPROFILE] response.data.success:', response.data.success);
      console.log('x [BRANDPROFILE] response.data.suggestion:', response.data.suggestion);

      console.log('x [BRANDPROFILE] Verificando condicoes de sucesso...');
      console.log('x [BRANDPROFILE] response.data.success:', response.data.success);
      console.log('x [BRANDPROFILE] response.data.suggestion exists:', !!response.data.suggestion);

      if (response.data.success && response.data.suggestion) {
        console.log('x [BRANDPROFILE] Sugestoes da IA recebidas:', response.data.suggestion);

        // Aplicar sugestoes da IA ao estado local (auto-save fara o resto)
        const aiSuggestions = response.data.suggestion;
        const updatedBranding: BrandingData = {
          ...branding,
          visual_style: {
            colors: aiSuggestions.colors || branding.visual_style?.colors || [],
            fonts: aiSuggestions.fonts || branding.visual_style?.fonts || [],
            archeType: aiSuggestions.archetype || branding.visual_style?.archeType || ''
          },
          tone_of_voice: {
            description: aiSuggestions.tone_of_voice || branding.tone_of_voice?.description || '',
            keywords: branding.tone_of_voice?.keywords || []
          },
          audience: {
            persona: aiSuggestions.audience || branding.audience?.persona || '',
            demographics: branding.audience?.demographics || ''
          },
          keywords: aiSuggestions.keywords || branding.keywords || [],
          archetype: aiSuggestions.archetype || branding.archetype || '',
          usp: aiSuggestions.usp || branding.usp || '',
          anti_keywords: aiSuggestions.anti_keywords || branding.anti_keywords || [],
          niche: aiSuggestions.niche || branding.niche || ''
        };

        setBranding(updatedBranding);

        // Apos salvar, recarregar os dados do banco para garantir consistencia
        console.log('x [BRANDPROFILE] Recarregando dados do banco...');

        try {
          await loadBranding();
          console.log('x [BRANDPROFILE] loadBranding() executado com sucesso');
        } catch (loadError) {
          console.error('R [BRANDPROFILE] Erro ao executar loadBranding():', loadError);
        }

        // Garantir que nao estamos em modo de edicao para mostrar os dados
        setIsEditing(false);
        setIsNewBrand(false);

        console.log('x [BRANDPROFILE] Modo edicao desativado apos recarregar dados');

        // Forcar re-render
        setTimeout(() => {
          console.log('x [BRANDPROFILE] Forcando re-render apos delay');
        }, 500);

      } else {
        console.log('R [BRANDPROFILE] Condicoes de sucesso nao atendidas');
        console.log('R [BRANDPROFILE] response.data:', response.data);
      }

      // Sempre executar apos o upload (sucesso ou falha)
      setIsNewBrand(false);
      setIsEditing(false);

      alert('S DNA da marca extraido com sucesso!');

      // Fechar modal
      setShowUploadModal(false);
      setUploadImages([]);
      setUploadCaptions('');

    } catch (error: any) {
      console.error('R Erro ao processar upload:', error);
      alert('Erro: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando DNA da marca...</div>
      </div>
    );
  }

  const colors = isEditing ? editColors : (branding.visual_style?.colors || []);
  const fonts = isEditing ? editFonts : (branding.visual_style?.fonts || []);
  const toneDescription = isEditing ? editToneDescription : (branding.tone_of_voice?.description || '');
  const toneKeywords = isEditing ? editToneKeywords : (branding.tone_of_voice?.keywords || []);
  const persona = isEditing ? editPersona : (branding.audience?.persona || '');
  const demographics = isEditing ? editDemographics : (branding.audience?.demographics || '');
  const keywords = isEditing ? editKeywords : (branding.keywords || []);
  const currentLogoUrl = resolveAssetUrl((isEditing ? editLogoUrl : (branding.logo_url || '')) || '');

  const archetypeInfo = getArchetypeInfo(isEditing ? editArchetype : branding.archetype);

  const toneExamples = [
    {
      label: 'Educativo & Direto',
      description:
        'Tom educativo, direto e objetivo. Linguagem simples, sem jargoes desnecessarios. Misturar didatica com exemplos praticos e CTAs claros. Evitar formalidade excessiva.',
      keywords: ['educativo', 'direto', 'pratico', 'confiante'],
    },
    {
      label: 'Humano & Inspirador',
      description:
        'Tom humano, acolhedor e inspirador. Incentivar consistencia, progresso e autoestima. Evitar culpa e discurso agressivo. Use storytelling e empatia.',
      keywords: ['humano', 'inspirador', 'acolhedor', 'empatico'],
    },
    {
      label: 'Premium & Sofisticado',
      description:
        'Tom premium e sofisticado. Frases curtas, vocabulario refinado, foco em exclusividade e experiencia. Evitar girias e exageros.',
      keywords: ['premium', 'sofisticado', 'exclusivo', 'elegante'],
    },
  ];

  const personaExamples = [
    {
      label: 'Urbano Ocupado (25-40)',
      persona:
        'Homem ou mulher, 25-40 anos, rotina corrida, trabalha e precisa de solucoes praticas. Quer resultados e clareza, sem perda de tempo. Valoriza marcas confiaveis.',
      demographics:
        '25-40 anos, capitais e regioes metropolitanas, interesses: produtividade, bem-estar, tecnologia e estilo de vida.',
    },
    {
      label: 'Familia & Rotina (30-55)',
      persona:
        'Pessoa responsavel pela familia, 30-55 anos, busca seguranca, qualidade e previsibilidade. Quer orientacoes claras e confianca no servico/produto.',
      demographics:
        '30-55 anos, Brasil, interesses: familia, saude, educacao, financas pessoais e consumo consciente.',
    },
    {
      label: 'Aspiracional Premium (28-45)',
      persona:
        'Pessoa 28-45 anos, aspiracional, busca status, estetica e experiencia. Compra por qualidade e diferenciacao, quer referencias e prova social.',
      demographics:
        '28-45 anos, capitais, interesses: moda, lifestyle, luxo acessivel, gastronomia, viagens.',
    },
  ];

  const uspExamples = [
    {
      label: 'Rapidez + Garantia',
      text: 'Atendimento em ate 30 minutos + garantia estendida + suporte pos-venda com acompanhamento.',
    },
    {
      label: 'Premium + Personalizacao',
      text: 'Experiencia premium com personalizacao completa: diagnostico, recomendacao sob medida e acabamento superior.',
    },
    {
      label: 'Preco Justo + Clareza',
      text: 'Preco justo com transparencia total: planos claros, sem taxas escondidas e entrega consistente.',
    },
  ];

  const nicheExamples = [
    {
      label: 'Servico Local (bairro/cidade)',
      text: 'Negocio local com foco em atendimento humano e recorrencia. Publico da regiao, busca conveniencia e confianca.',
    },
    {
      label: 'B2B (decisores)',
      text: 'Solucao B2B para decisores (gestores e diretores) com foco em ROI, previsibilidade, prova social e implementacao.',
    },
    {
      label: 'Infoproduto/educacao',
      text: 'Oferta educacional (curso/mentoria) com foco em transformacao pratica, comunidade e execucao passo-a-passo.',
    },
  ];

  const keywordsExamples = [
    {
      label: 'Saude/Bem-estar',
      items: ['bem-estar', 'saude', 'qualidade de vida', 'rotina', 'autocuidado'],
    },
    {
      label: 'Tecnologia/Produto',
      items: ['tecnologia', 'inovacao', 'performance', 'durabilidade', 'design'],
    },
    {
      label: 'Servico/Premium',
      items: ['atendimento', 'experiencia', 'premium', 'confianca', 'garantia'],
    },
  ];

  const antiKeywordsExamples = [
    {
      label: 'Promessas vazias',
      items: ['milagre', 'cura garantida', 'resultado imediato', 'antes e depois', 'sem esforco'],
    },
    {
      label: 'Baixo valor',
      items: ['barato', 'qualquer coisa', 'generico', 'improviso', 'mal feito'],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg font-bold">
                DNA
              </div>
              <div>
                <h1 className="text-3xl font-bold">DNA da Marca</h1>
                <p className="text-gray-400">
                  {isNewBrand ? 'Criar identidade visual e estrategica' : 'Identidade visual e estrategica'}
                </p>
              </div>
            </div>

            {/* Aviso de Rascunho Restaurado */}
            {hasDraftRestored && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-400">
                  <span className="text-lg">!</span>
                  <div>
                    <div className="font-semibold">Rascunho restaurado!</div>
                    <div className="text-sm">Restauramos seu trabalho nao salvo automaticamente.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Botoes de Acao */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                ✨ Extrair DNA via Upload
              </button>

              <button
                onClick={openVersionsModal}
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                disabled={!clientId}
                type="button"
              >
                 Versões
              </button>

              {!isEditing ? (
                <button
                  onClick={startEditing}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  ✏️ Editar DNA
                </button>
              ) : (
                <>
                  {!isNewBrand && (
                    <button
                      onClick={cancelEditing}
                      className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={saveBranding}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {isSaving ? ' Salvando...' : ' Salvar Definitivo'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{archetypeInfo?.emoji || '🎭'}</span>
                <div className="flex-1">
                  <div className="text-sm text-gray-400">Arquetipo da Marca</div>

                  {isEditing ? (
                    <div className="mt-2">
                      <select
                        value={editArchetype}
                        onChange={(e) => setEditArchetype(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Selecione um arquetipo (ex: Criador)</option>
                        {JUNG_ARCHETYPES.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.emoji} {a.label}
                          </option>
                        ))}
                      </select>

                      {archetypeInfo && (
                        <div className="mt-2 text-sm text-gray-300">
                          <div className="text-gray-200 font-semibold">{archetypeInfo.label}</div>
                          <div className="text-gray-400">{archetypeInfo.description}</div>
                          <div className="text-gray-400 mt-1">Tom sugerido: {archetypeInfo.tone_hint}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2">
                      {archetypeInfo ? (
                        <div>
                          <div className="text-xl font-bold text-purple-300">{archetypeInfo.label}</div>
                          <div className="mt-1 text-sm text-gray-300">{archetypeInfo.description}</div>
                          <div className="mt-1 text-sm text-gray-400">Tom sugerido: {archetypeInfo.tone_hint}</div>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-gray-500">Arquetipo nao definido</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500/15 to-emerald-500/15 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-400">Categorias do cliente</div>
                  <div className="text-lg font-semibold">Nicho (filtro do Calendario + contexto do prompt)</div>
                </div>
                <div className="text-xs text-gray-500">{(isEditing ? editCategoriasNicho : clientCategoriasNicho).length} selecionadas</div>
              </div>

              {isEditing ? (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {editCategoriasNicho.map((c) => (
                      <span key={c} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-200 text-xs">
                        <span>{c}</span>
                        <button
                          type="button"
                          onClick={() => removeCategoriaNicho(c)}
                          className="text-blue-200/70 hover:text-white"
                          disabled={isSaving}
                        >
                          S"
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="mt-3">
                    <input
                      type="text"
                      value={categoriasQuery}
                      onChange={(e) => setCategoriasQuery(e.target.value)}
                      placeholder={loadingCategoriasSuggestions ? 'Carregando categorias' : 'Busque e selecione uma categoria'}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-700 bg-gray-900">
                    {categoriasSuggestions
                      .filter((s) => String(s).toLowerCase().includes(categoriasQuery.trim().toLowerCase()))
                      .slice(0, 30)
                      .map((s) => {
                        const label = String(s);
                        const already = new Set(editCategoriasNicho.map((c) => String(c).toLowerCase())).has(label.toLowerCase());
                        return (
                          <button
                            type="button"
                            key={label}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 ${already ? 'text-gray-500' : 'text-gray-200'}`}
                            onClick={() => {
                              if (!already) addCategoriaNicho(label);
                            }}
                            disabled={isSaving || already}
                          >
                            {label}
                          </button>
                        );
                      })}

                    {(!loadingCategoriasSuggestions && categoriasSuggestions.length === 0) && (
                      <div className="px-3 py-3 text-sm text-gray-400">
                        Nenhuma categoria disponivel.
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">Selecione as categorias existentes.</div>
                </div>
              ) : (
                <div className="mt-3">
                  {(clientCategoriasNicho || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(clientCategoriasNicho || []).map((c) => (
                        <span key={c} className="px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-200 text-xs">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">Nenhuma categoria definida.</div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-cyan-500/15 to-sky-500/15 border border-cyan-500/30 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-400">Logo do cliente</div>
                  <div className="text-lg font-semibold">Usada na capa do planner trimestral</div>
                </div>
                {currentLogoUrl ? (
                  <span className="text-xs text-cyan-200">Configurada</span>
                ) : (
                  <span className="text-xs text-gray-500">Opcional</span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 min-h-[170px] flex items-center justify-center overflow-hidden">
                  {currentLogoUrl ? (
                    <img src={currentLogoUrl} alt="Logo do cliente" className="max-h-28 w-auto object-contain" />
                  ) : (
                    <div className="text-sm text-gray-500 text-center">Nenhuma logo configurada no DNA ainda.</div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="w-full text-sm text-gray-300"
                      onChange={(e) => handleClientLogoUpload(e.target.files?.[0])}
                      disabled={isSaving || isUploadingLogo}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editLogoUrl}
                        onChange={(e) => setEditLogoUrl(e.target.value)}
                        placeholder="/static/client-logos/logo.png"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => setEditLogoUrl('')}
                        className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-white"
                        disabled={isSaving || isUploadingLogo || !editLogoUrl}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">
                      {isUploadingLogo ? 'Enviando logo...' : 'A logo salva aqui entra automaticamente na capa do planner trimestral.'}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    Salve a logo no DNA para reutilizar automaticamente na capa do planner trimestral.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Secao 1: Paleta de Cores */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🎨</span>
              <h2 className="text-xl font-semibold">Paleta de Cores</h2>
            </div>

            {isEditing && (
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="Ex: #0EA5E9 (azul), #111827 (grafite)"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={addColor}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  + Adicionar
                </button>
              </div>
            )}

            {colors.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {colors.map((color, index) => (
                  <div key={index} className="text-center relative group">
                    <div
                      className="w-full h-24 rounded-lg mb-2 border-2 border-gray-600 shadow-lg"
                      style={{ backgroundColor: color }}
                    />
                    <div className="text-xs font-mono text-gray-400">{color}</div>
                    {isEditing && (
                      <button
                        onClick={() => removeColor(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2"></div>
                <div>{isEditing ? 'Adicione cores acima' : 'Nenhuma cor definida'}</div>
              </div>
            )}
          </div>

          {/* Secao 2: Tipografia */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔤</span>
              <h2 className="text-xl font-semibold">Tipografia</h2>
            </div>

            {isEditing && (
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newFont}
                  onChange={(e) => setNewFont(e.target.value)}
                  placeholder="Ex: Inter (principal), Playfair Display (titulos)"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={addFont}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  + Adicionar
                </button>
              </div>
            )}

            {fonts.length > 0 ? (
              <div className="space-y-3">
                {fonts.map((font, index) => (
                  <div
                    key={index}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 relative group"
                  >
                    <div className="text-sm text-gray-400 mb-1">
                      {index === 0 ? 'Principal' : `Secundaria ${index}`}
                    </div>
                    <div className="text-lg font-semibold">{font}</div>
                    {isEditing && (
                      <button
                        onClick={() => removeFont(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-700/30 rounded-lg p-6 text-center text-gray-500">
                <div className="text-4xl mb-2">Aa</div>
                <div>{isEditing ? 'Adicione fontes acima' : 'Fontes nao definidas'}</div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Secao 3: Tom de Voz */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🗣️</span>
              <h2 className="text-xl font-semibold">Tom de Voz</h2>
            </div>

            {isEditing ? (
              <>
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-2">Exemplos (clique para preencher)</div>
                  <div className="flex flex-wrap gap-2">
                    {toneExamples.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        onClick={() => {
                          setEditToneDescription(ex.description);
                          setEditToneKeywords(ex.keywords);
                        }}
                        className="px-3 py-1 rounded-full border border-gray-600 bg-gray-900/60 text-gray-200 text-xs hover:border-blue-500/60 hover:text-white transition-colors"
                        disabled={isSaving}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={editToneDescription}
                  onChange={(e) => setEditToneDescription(e.target.value)}
                  placeholder="Ex: Direto e educativo, com energia e foco em resultados. Evitar formalidade excessiva."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-blue-500 min-h-[100px]"
                />

                <div className="mb-2 text-sm text-gray-400">Palavras-chave do tom:</div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newToneKeyword}
                    onChange={(e) => setNewToneKeyword(e.target.value)}
                    placeholder="Ex: Inspirador, tecnico, humano, confiante"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addToneKeyword()}
                  />
                  <button
                    onClick={addToneKeyword}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    +
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-300 mb-4">{toneDescription || 'Nao definido'}</p>
            )}

            {toneKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {toneKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm border border-blue-500/30 relative group"
                  >
                    {keyword}
                    {isEditing && (
                      <button
                        onClick={() => removeToneKeyword(index)}
                        className="ml-2 text-red-400 hover:text-red-300"
                      >
                        x
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Secao 4: Publico & Persona */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👥</span>
                <h2 className="text-xl font-semibold">Publico-Alvo</h2>
              </div>

              <div
                className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xl"
                title={archetypeInfo ? `Arquetipo: ${archetypeInfo.label}` : 'Arquetipo nao definido'}
              >
                {archetypeInfo?.emoji || '🎭'}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Persona</div>
              {isEditing ? (
                <>
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-2">Exemplos (clique para preencher)</div>
                    <div className="flex flex-wrap gap-2">
                      {personaExamples.map((ex) => (
                        <button
                          key={ex.label}
                          type="button"
                          onClick={() => {
                            setEditPersona(ex.persona);
                            setEditDemographics(ex.demographics);
                          }}
                          className="px-3 py-1 rounded-full border border-gray-600 bg-gray-900/60 text-gray-200 text-xs hover:border-blue-500/60 hover:text-white transition-colors"
                          disabled={isSaving}
                        >
                          {ex.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={editPersona}
                    onChange={(e) => setEditPersona(e.target.value)}
                    placeholder="Ex: Mulher, 28-40 anos, trabalha e treina apos o expediente. Busca praticidade, autoestima e resultados sem complicacao."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 min-h-[80px]"
                  />
                </>
              ) : (
                <p className="text-gray-300">{persona || 'Nao definido'}</p>
              )}
            </div>

            <div>
              <div className="text-sm text-gray-400 mb-2">Demografia</div>
              {isEditing ? (
                <textarea
                  value={editDemographics}
                  onChange={(e) => setEditDemographics(e.target.value)}
                  placeholder="Ex: 25-44 anos, Brasil (capitais), interesses: bem-estar, treino, autocuidado, estetica."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 min-h-[80px]"
                />
              ) : (
                <p className="text-gray-300 text-sm">{demographics || 'Nao definido'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Secao 5: Keywords & Elementos */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏷️</span>
            <h2 className="text-xl font-semibold">Keywords & Elementos da Marca</h2>
          </div>

          {isEditing && (
            <div className="mb-3">
              <div className="text-xs text-gray-400 mb-2">Exemplos (clique para adicionar)</div>
              <div className="flex flex-wrap gap-2">
                {keywordsExamples.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => {
                      setEditKeywords((prev) => {
                        const existing = new Set(prev.map((x) => String(x).toLowerCase()));
                        const toAdd = ex.items.filter((it) => !existing.has(String(it).toLowerCase()));
                        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
                      });
                    }}
                    className="px-3 py-1 rounded-full border border-gray-600 bg-gray-900/60 text-gray-200 text-xs hover:border-purple-500/60 hover:text-white transition-colors"
                    disabled={isSaving}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Ex: oculos 3D, saude visual, armacoes, lentes, estilo"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              />
              <button
                onClick={addKeyword}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                + Adicionar
              </button>
            </div>
          )}

          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 rounded-lg text-sm border border-purple-500/30 font-medium relative group"
                >
                  {keyword}
                  {isEditing && (
                    <button
                      onClick={() => removeKeyword(index)}
                      className="ml-2 text-red-400 hover:text-red-300"
                    >
                      x
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">x</div>
              <div>{isEditing ? 'Adicione keywords acima' : 'Nenhuma keyword definida'}</div>
            </div>
          )}
        </div>


        {/* Secao 7: Proposta Unica de Valor (USP) */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">💎</span>
            <h2 className="text-xl font-semibold">Proposta Unica de Valor (USP)</h2>
          </div>

          {isEditing ? (
            <>
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-2">Exemplos (clique para preencher)</div>
                <div className="flex flex-wrap gap-2">
                  {uspExamples.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setEditUsp(ex.text)}
                      className="px-3 py-1 rounded-full border border-gray-600 bg-gray-900/60 text-gray-200 text-xs hover:border-blue-500/60 hover:text-white transition-colors"
                      disabled={isSaving}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={editUsp}
                onChange={(e) => setEditUsp(e.target.value)}
                placeholder="Ex: Atendimento em ate 30 minutos + armacoes premium com ajuste personalizado e garantia estendida."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 min-h-[100px]"
              />
            </>
          ) : (
            <p className="text-gray-300">{branding.usp || 'Nao definido'}</p>
          )}
        </div>

        {/* Secao 8: Aversoes da Marca */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🚫</span>
            <h2 className="text-xl font-semibold">Aversoes da Marca</h2>
          </div>

          {isEditing && (
            <div className="mb-3">
              <div className="text-xs text-gray-400 mb-2">Exemplos (clique para adicionar)</div>
              <div className="flex flex-wrap gap-2">
                {antiKeywordsExamples.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => {
                      setEditAntiKeywords((prev) => {
                        const existing = new Set(prev.map((x) => String(x).toLowerCase()));
                        const toAdd = ex.items.filter((it) => !existing.has(String(it).toLowerCase()));
                        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
                      });
                    }}
                    className="px-3 py-1 rounded-full border border-gray-600 bg-gray-900/60 text-gray-200 text-xs hover:border-red-500/60 hover:text-white transition-colors"
                    disabled={isSaving}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newAntiKeyword}
                onChange={(e) => setNewAntiKeyword(e.target.value)}
                placeholder="Ex: barato, milagre, cura garantida, antes e depois"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addAntiKeyword()}
              />
              <button
                onClick={addAntiKeyword}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                + Adicionar
              </button>
            </div>
          )}

          {editAntiKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {editAntiKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-300 rounded-lg text-sm border border-red-500/30 font-medium relative group"
                >
                  {keyword}
                  {isEditing && (
                    <button
                      onClick={() => removeAntiKeyword(index)}
                      className="ml-2 text-red-400 hover:text-red-300"
                    >
                      x
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">xa</div>
              <div>{isEditing ? 'Adicione aversoes acima' : 'Nenhuma aversao definida'}</div>
            </div>
          )}
        </div>

        {/* Secao 9: Nicho de Mercado */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎯</span>
            <h2 className="text-xl font-semibold">Nicho de Mercado</h2>
          </div>

          {isEditing ? (
            <>
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-2">Exemplos (clique para preencher)</div>
                <div className="flex flex-wrap gap-2">
                  {nicheExamples.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setEditNiche(ex.text)}
                      className="px-3 py-1 rounded-full border border-gray-600 bg-gray-900/60 text-gray-200 text-xs hover:border-blue-500/60 hover:text-white transition-colors"
                      disabled={isSaving}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={editNiche}
                onChange={(e) => setEditNiche(e.target.value)}
                placeholder="Ex: tica premium com foco em tecnologia (lentes e oculos 3D) para publico urbano."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 min-h-[80px]"
              />
            </>
          ) : (
            <p className="text-gray-300">{branding.niche || 'Nao definido'}</p>
          )}
        </div>

        {/* Footer Info */}
        {!isNewBrand && branding.updated_at && (
          <div className="mt-6 text-center text-sm text-gray-500">
            altima atualizacao: {new Date(branding.updated_at).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>

      {/* Modal de Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl border border-gray-700">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Extrair DNA via Upload</h2>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                x
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-6">
              {/* Upload de Imagens */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                   Upload de Imagens (Max: 3)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-400
                    file:mr-4 file:py-3 file:px-6
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-purple-600 file:text-white
                    hover:file:bg-purple-700
                    file:cursor-pointer cursor-pointer
                    border border-gray-600 rounded-lg p-2"
                />

                {/* Preview das Imagens */}
                {uploadImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {uploadImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-600"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {file.name.substring(0, 15)}...
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Legendas de Exemplo */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                   Legendas de Exemplo (Opcional)
                </label>
                <textarea
                  value={uploadCaptions}
                  onChange={(e) => setUploadCaptions(e.target.value)}
                  placeholder="Cole aqui 2 ou 3 legendas de posts da marca...&#10;&#10;Exemplo:&#10;xa Transforme suas ideias em realidade!&#10; Inovacao que conecta pessoas."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 min-h-[150px]"
                />
                <p className="text-xs text-gray-500 mt-2">
                   Dica: Quanto mais contexto, melhor a analise da IA!
                </p>
              </div>

              {/* Botoes de Acao */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processUpload}
                  disabled={isUploading || uploadImages.length === 0}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? '🔄 Processando...' : '✨ Extrair DNA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVersionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl border border-gray-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Versões do DNA</h2>
                <p className="text-gray-400 text-sm mt-1">Historico automatico do que foi salvo/restaurado</p>
              </div>
              <button
                onClick={() => setShowVersionsModal(false)}
                className="text-gray-400 hover:text-white"
                type="button"
                disabled={restoringVersion}
              >
                S"
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-900/60 border-b border-gray-700">
                  <div className="text-sm text-gray-300 font-semibold">Lista</div>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  {loadingVersions ? (
                    <div className="px-4 py-4 text-sm text-gray-400">Carregando</div>
                  ) : versions.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-400">Nenhuma versao encontrada ainda.</div>
                  ) : (
                    versions.map((v) => (
                      <div key={v.id} className="px-4 py-3 border-b border-gray-700">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-gray-200 font-semibold">
                              {new Date(v.created_at).toLocaleString('pt-BR')}
                            </div>
                            <div className="text-xs text-gray-500">{v.reason || ''}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600"
                              onClick={() => openVersionDetail(v.id)}
                              disabled={loadingVersions || restoringVersion}
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                              onClick={() => restoreVersion(v.id)}
                              disabled={loadingVersions || restoringVersion}
                            >
                              {restoringVersion ? 'Restaurando' : 'Restaurar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-900/60 border-b border-gray-700">
                  <div className="text-sm text-gray-300 font-semibold">Snapshot</div>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  {selectedVersion ? (
                    <pre className="px-4 py-4 text-xs text-gray-200 whitespace-pre-wrap">
                      {JSON.stringify(selectedVersion.snapshot, null, 2)}
                    </pre>
                  ) : (
                    <div className="px-4 py-4 text-sm text-gray-400">Selecione uma versao para visualizar.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







