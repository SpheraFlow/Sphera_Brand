import { useCallback, useEffect, useState } from 'react';
import api, { jobsService, presentationService } from '../services/api';
import { useParams } from 'react-router-dom';
import VisualSlideEditor from './VisualSlideEditor';
import SlideEditorModal from './SlideEditorModal';
import JobProgressPanel from './Jobs/JobProgressPanel';
import { useJobPolling } from '../hooks/useJobPolling';
import download from 'downloadjs';
import { resolveAssetUrl, withCacheBust } from '../utils/assetHelpers';
import PeriodSelector from './PeriodSelector';

type ActiveTab = 'capa' | 'diagnostico' | 'desafios' | 'metas' | 'slogan' | 'defesa' | 'roadmap' | 'link_cta' | 'encerramento';

interface PlannerData {
  mes: string;
  nome_cliente: string;
  logo_path?: string;
  logo_url?: string;
  layout?: any[];
}

interface DiagnosticoData {
  texto_longo: string;
  layout?: any[];
}

interface DesafiosData {
  itens: string[];
  texto: string;
  layout?: any[];
}

interface MetasData {
  mes: string;
  texto_longo: string;
  layout?: any[];
}

interface SloganData {
  frase: string;
  layout?: any[];
}

interface DefesaData {
  subtitulo: string;
  texto_longo: string;
  layout?: any[];
}

interface RoadmapCard {
  mes: string;
  titulo: string;
  detalhe: string;
  descricao: string;
  sugestao: string;
}

interface RoadmapData {
  cards: RoadmapCard[];
  layout?: any[];
}

const TAB_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'capa', label: '1. Capa' },
  { id: 'diagnostico', label: '2. Diagnostico' },
  { id: 'desafios', label: '3. Desafios' },
  { id: 'metas', label: '4. Metas' },
  { id: 'slogan', label: '5. Slogan' },
  { id: 'defesa', label: '6. Defesa' },
  { id: 'roadmap', label: '7. Planner' },
  { id: 'link_cta', label: '8. Link' },
  { id: 'encerramento', label: '9. Fim' },
];

const TEMPLATE_BY_TAB: Record<ActiveTab, string> = {
  capa: '/templates/template_planner_trimestral.png',
  diagnostico: '/templates/template_diagnostico.png',
  desafios: '/templates/template_novos_desafios.png',
  metas: '/templates/template_metas.png',
  slogan: '/templates/template_slogan.png',
  defesa: '/templates/template_defesa_da_campanha.png',
  roadmap: '/templates/template_planner_campanhas.png',
  link_cta: '/templates/template_link_cta.png',
  encerramento: '/templates/template_encerramento.png',
};


const extractMonthsFromLabel = (label: string) =>
  String(label || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

const normalizeRoadmapCards = (cards: Partial<RoadmapCard>[] | undefined, fallbackMonths: string[] = []) => {
  const source = Array.isArray(cards) ? cards : [];
  const normalized: RoadmapCard[] = [];
  for (let index = 0; index < 3; index += 1) {
    const card = source[index] ?? {};
    normalized.push({
      mes: String(card.mes ?? fallbackMonths[index] ?? '').trim(),
      titulo: String(card.titulo ?? '').trim(),
      detalhe: String(card.detalhe ?? '').trim(),
      descricao: String(card.descricao ?? '').trim(),
      sugestao: String(card.sugestao ?? '').trim(),
    });
  }
  return normalized;
};

const PENDING_PRESENTATION_JOB_KEY = 'pendingPresentationJob';
const canEditGeneratedSlide = (imgUrl: string) => {
  const filename = imgUrl.split('?')[0].split('/').pop() || '';
  return /(capa|diagnostico|desafios|metas|slogan|defesa|roadmap)\.png$/i.test(filename);
};

export default function PresentationGenerator() {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('capa');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [visualMode, setVisualMode] = useState(false);
  const [editingSlide, setEditingSlide] = useState<{ image: string; name: string; data: any; index: number } | null>(null);
  const [tempFiles, setTempFiles] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [presentationJobId, setPresentationJobId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [periodMode, setPeriodMode] = useState<'ultimo' | 'unico' | 'multiplos'>('ultimo');

  const [planner, setPlanner] = useState<PlannerData>({
    mes: 'MARCO | ABRIL | MAIO',
    nome_cliente: 'Nome do Cliente',
  });
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData>({
    texto_longo: 'Clique em "Preencher com IA" para gerar o diagnostico do cliente.',
  });
  const [desafios, setDesafios] = useState<DesafiosData>({
    itens: ['Desafio 1', 'Desafio 2', 'Desafio 3', '', '', '', '', '', ''],
    texto: '• Desafio 1\n• Desafio 2\n• Desafio 3',
  });
  const [grid, setGrid] = useState<MetasData>({
    mes: 'MARCO | ABRIL | MAIO',
    texto_longo: 'Descreva as metas da campanha.',
  });
  const [slogan, setSlogan] = useState<SloganData>({ frase: 'O churrasco comeca aqui.' });
  const [defesa, setDefesa] = useState<DefesaData>({
    subtitulo: 'O churrasco comeca aqui',
    texto_longo: 'Defesa da campanha.',
  });
  const [roadmap, setRoadmap] = useState<RoadmapData>({
    cards: normalizeRoadmapCards([
      { mes: 'Marco', titulo: 'Campanha 1', detalhe: 'Toda semana', descricao: 'Descreva a acao principal do mes', sugestao: 'Sugestao: Midia paga' },
      { mes: 'Abril', titulo: 'Campanha 2', detalhe: 'Toda semana', descricao: 'Descreva a acao principal do mes', sugestao: 'Sugestao: Radio' },
      { mes: 'Maio', titulo: 'Campanha 3', detalhe: 'Toda semana', descricao: 'Descreva a acao principal do mes', sugestao: 'Sugestao: Degustacao' },
    ]),
  });
  const [linkCta, setLinkCta] = useState({ url: '' });
  const [encerramento] = useState({});

  const getPngFilename = (imgUrl: string, fallback: string) => {
    try {
      const url = new URL(imgUrl, window.location.origin);
      const raw = (url.pathname.split('/').pop() || fallback).trim();
      return raw.toLowerCase().endsWith('.png') ? raw : `${raw}.png`;
    } catch {
      const raw = (imgUrl.split('?')[0].split('/').pop() || fallback).trim();
      return raw.toLowerCase().endsWith('.png') ? raw : `${raw}.png`;
    }
  };

  const getClientLogoOverrideUrl = () => {
    if (!clientId) return undefined;
    try {
      const stored = localStorage.getItem('clientLogos');
      if (!stored) return undefined;
      const parsed = JSON.parse(stored) as Record<string, string>;
      return parsed?.[clientId];
    } catch {
      return undefined;
    }
  };

  const clamp = (value: string, max: number) => value.slice(0, max);

  const fetchAvailableMonths = async () => {
    if (!clientId) return;
    try {
      const res = await api.get(`/presentation/available-months/${clientId}`);
      const months = Array.isArray(res.data?.months) ? (res.data.months as string[]) : [];
      setAvailableMonths(months);
    } catch (error) {
      console.error('Erro ao buscar meses disponiveis:', error);
      setAvailableMonths([]);
    }
  };

  const handlePeriodChange = (mode: 'ultimo' | 'unico' | 'multiplos', months: string[]) => {
    setPeriodMode(mode);
    setSelectedMonths(months);
  };

  const updateRoadmapCard = (index: number, field: keyof RoadmapCard, value: string) => {
    setRoadmap((current) => ({
      ...current,
      cards: current.cards.map((card, cardIndex) => (cardIndex === index ? { ...card, [field]: value } : card)),
    }));
  };

  const buildPayload = (overrides?: Partial<{
    planner: PlannerData;
    diagnostico: DiagnosticoData;
    desafios: DesafiosData;
    grid: MetasData;
    slogan: SloganData;
    defesa: DefesaData;
    roadmap: RoadmapData;
    linkCta: { url: string };
  }>) => {
    const plannerData = overrides?.planner ?? planner;
    const fallbackMonths = extractMonthsFromLabel(plannerData.mes);
    const effectiveLogoUrl = plannerData.logo_url || getClientLogoOverrideUrl();

    return {
      clienteId: clientId,
      months: (periodMode === 'unico' || periodMode === 'multiplos') ? selectedMonths : [],
      planner: {
        ...plannerData,
        ...(effectiveLogoUrl ? { logo_url: effectiveLogoUrl } : {}),
      },
      diagnostico: overrides?.diagnostico ?? diagnostico,
      desafios: overrides?.desafios ?? desafios,
      grid: {
        ...(overrides?.grid ?? grid),
        mes: (overrides?.grid ?? grid).mes || plannerData.mes,
      },
      slogan: overrides?.slogan ?? slogan,
      defesa: overrides?.defesa ?? defesa,
      roadmap: {
        ...(overrides?.roadmap ?? roadmap),
        cards: normalizeRoadmapCards((overrides?.roadmap ?? roadmap).cards, fallbackMonths),
      },
      link_cta: overrides?.linkCta ?? linkCta,
      encerramento,
    };
  };

  const applyGeneratedContent = useCallback((content: any) => {
    if (content.planner) {
      setPlanner((current) => ({ ...current, ...content.planner }));
    }

    if (content.diagnostico) {
      setDiagnostico((current) => ({ ...current, ...content.diagnostico, texto_longo: String(content.diagnostico.texto_longo || content.diagnostico.texto || '') }));
    }

    if (content.desafios) {
      const items = Array.isArray(content.desafios.itens)
        ? content.desafios.itens.map((item: any) => String(item || '').trim()).slice(0, 9)
        : [];
      while (items.length < 9) items.push('');
      setDesafios((current) => ({
        ...current,
        ...content.desafios,
        itens: items,
        texto: items.filter((item: string) => item.trim()).map((item: string) => '• ' + item).join('\n'),
      }));
    }

    if (content.grid) {
      setGrid((current) => ({
        ...current,
        ...content.grid,
        mes: String(content.grid.mes || content.planner?.mes || planner.mes || '').trim(),
        texto_longo: String(content.grid.texto_longo || content.grid.texto || ''),
      }));
    }

    if (content.slogan) {
      setSlogan((current) => ({ ...current, ...content.slogan, frase: String(content.slogan.frase || '') }));
    }

    if (content.defesa) {
      setDefesa((current) => ({
        ...current,
        ...content.defesa,
        subtitulo: String(content.defesa.subtitulo || content.slogan?.frase || ''),
        texto_longo: String(content.defesa.texto_longo || content.defesa.texto || ''),
      }));
    }

    if (content.roadmap) {
      setRoadmap((current) => ({
        ...current,
        ...content.roadmap,
        cards: normalizeRoadmapCards(content.roadmap.cards, extractMonthsFromLabel(content.planner?.mes || planner.mes)),
      }));
    }

    if (content.link_cta) {
      setLinkCta(content.link_cta);
    }
  }, [planner.mes]);

  const handlePresentationJobResult = useCallback((result: any) => {
    if (!result || typeof result !== 'object') return;

    if (result.content) {
      applyGeneratedContent(result.content);
    }

    if (result.operation === 'render') {
      const urls = Array.isArray(result.images) ? result.images.map((url: string) => resolveAssetUrl(url)) : [];
      setGeneratedImages(urls.map(withCacheBust));
      setTempFiles(Array.isArray(result.tempFiles) ? result.tempFiles : []);
    }
  }, [applyGeneratedContent]);

  const handlePresentationJobSuccess = useCallback((result: any) => {
    localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
    handlePresentationJobResult(result);

    if (result?.operation === 'content') {
      alert('Conteudo gerado com sucesso! Revise e clique em Gerar Laminas.');
    } else if (result?.operation === 'render') {
      alert('Laminas geradas com sucesso!');
    }
  }, [handlePresentationJobResult]);

  const handlePresentationJobError = useCallback((errorMsg: string) => {
    console.error('Job de apresentacao falhou:', errorMsg);
  }, []);

  const handlePresentationJobCancel = useCallback(() => {
    localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
    setPresentationJobId(null);
  }, []);

  const { job: presentationJob } = useJobPolling({
    clientId: clientId || '',
    jobId: presentationJobId,
    enabled: !!presentationJobId && !!clientId,
    onSuccess: handlePresentationJobSuccess,
    onError: handlePresentationJobError,
    onCancel: handlePresentationJobCancel,
  });

  const isPresentationJobActive = !!presentationJobId && !!presentationJob && ['pending', 'running'].includes(presentationJob.status);

  useEffect(() => {
    if (!clientId) return;

    const savedJob = localStorage.getItem(PENDING_PRESENTATION_JOB_KEY);
    if (!savedJob) return;

    try {
      const parsed = JSON.parse(savedJob);
      if (parsed?.clientId !== clientId || !parsed?.jobId) return;

      jobsService.getJobStatus(clientId, parsed.jobId)
        .then((job) => {
          if (job.status === 'succeeded' || job.status === 'completed') {
            localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
            handlePresentationJobResult(job.result);
            return;
          }

          setPresentationJobId(parsed.jobId);
        })
        .catch((error) => {
          console.error('Erro ao recuperar job pendente da apresentacao:', error);
          localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
        });
    } catch (error) {
      console.error('Erro ao ler job pendente da apresentacao:', error);
      localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
    }
  }, [clientId, handlePresentationJobResult]);

  const handleAiFill = async () => {
    if (!clientId) return alert('Cliente nao identificado');
    if (isPresentationJobActive) return alert('Ja existe uma geracao em andamento. Aguarde ou cancele o job atual.');

    try {
      setAiLoading(true);
      const months = (periodMode === 'unico' || periodMode === 'multiplos') ? selectedMonths : [];
      const response = await presentationService.startContentJob(clientId, months);
      if (response.success && response.jobId) {
        setPresentationJobId(response.jobId);
        localStorage.setItem(PENDING_PRESENTATION_JOB_KEY, JSON.stringify({ jobId: response.jobId, clientId }));
      }
    } catch (error: any) {
      console.error(error);
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 'alguns minutos';
        alert(`Cota da API excedida. Aguarde ${retryAfter} e tente novamente.`);
      } else {
        const errorMsg = error.response?.data?.error || 'Erro ao iniciar geracao de conteudo com IA.';
        alert(errorMsg);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!clientId) return alert('Cliente nao identificado');
    if (isPresentationJobActive) return alert('Ja existe uma geracao em andamento. Aguarde ou cancele o job atual.');

    try {
      setLoading(true);
      const response = await presentationService.startRenderJob(buildPayload());
      if (response.success && response.jobId) {
        setPresentationJobId(response.jobId);
        localStorage.setItem(PENDING_PRESENTATION_JOB_KEY, JSON.stringify({ jobId: response.jobId, clientId }));
      } else {
        alert('Erro ao iniciar a geracao das laminas');
      }
    } catch (error: any) {
      console.error('Erro:', error);
      alert('Erro ao iniciar a geracao das laminas: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePresentationJobRetryBtn = async () => {
    if (!presentationJobId || !clientId) return;
    try {
      await jobsService.retryJob(clientId, presentationJobId);
      localStorage.setItem(PENDING_PRESENTATION_JOB_KEY, JSON.stringify({ jobId: presentationJobId, clientId }));
    } catch (error: any) {
      alert('Erro ao retentar a geracao: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePresentationJobCancelBtn = async () => {
    if (!presentationJobId || !clientId) return;
    try {
      await jobsService.cancelJob(clientId, presentationJobId);
      localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
      setPresentationJobId(null);
      alert('Geracao cancelada com sucesso.');
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 404) {
        localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
        setPresentationJobId(null);
      } else {
        alert('Erro ao cancelar a geracao: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleDismissPresentationJobPanel = () => {
    localStorage.removeItem(PENDING_PRESENTATION_JOB_KEY);
    setPresentationJobId(null);
  };

  const handleSaveVersion = async () => {
    if (!clientId || generatedImages.length === 0) return;
    try {
      setLoading(true);
      const payload = {
        clienteId: clientId,
        tempFiles,
        dataJson: buildPayload(),
        titulo: `Apresentacao ${new Date().toLocaleString()}`,
      };
      const res = await api.post('/presentation/save', payload);
      if (res.data.success) {
        alert('Apresentacao salva no historico!');
        fetchHistory();
      }
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar versao: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!clientId) return;
    try {
      const res = await api.get(`/presentation/history/${clientId}`);
      if (res.data.success) {
        const parsedHistory = (res.data.history || []).map((item: any) => ({
          ...item,
          arquivos: Array.isArray(item.arquivos)
            ? item.arquivos.map((url: string) => resolveAssetUrl(url))
            : [],
        }));
        setHistory(parsedHistory);
        setShowHistory(true);
      }
    } catch (error) {
      console.error('Erro ao buscar historico:', error);
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
          zip.file(getPngFilename(finalUrl, `slide_${idx + 1}.png`), blob);
        })
      );
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      download(zipBlob, `laminas_${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip');
    } catch (error) {
      console.error(error);
      alert('Erro ao baixar em lote. Tente novamente.');
    }
  };

  const handlePdfDownload = async () => {
    if (!generatedImages.length) return;
    try {
      const { jsPDF } = await import('jspdf');
      const firstRes = await fetch(resolveAssetUrl(generatedImages[0]));
      const firstBlob = await firstRes.blob();
      const firstBitmap = await createImageBitmap(firstBlob);
      const imgW = firstBitmap.width;
      const imgH = firstBitmap.height;
      firstBitmap.close();
      const orientation = imgW >= imgH ? 'landscape' : 'portrait';

      const pdf = new jsPDF({ orientation, unit: 'px', format: [imgW, imgH], hotfixes: ['px_scaling'] });
      for (let index = 0; index < generatedImages.length; index += 1) {
        if (index > 0) pdf.addPage([imgW, imgH], orientation);
        const finalUrl = resolveAssetUrl(generatedImages[index]);
        const res = await fetch(finalUrl);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, imgW, imgH);

        const isLinkSlide = index === 7;
        if (isLinkSlide && linkCta.url?.trim()) {
          pdf.link(0, 0, imgW, imgH, { url: linkCta.url.trim() });
        }
      }
      pdf.save(`laminas_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleOpenEditor = (imgUrl: string) => {
    const filename = imgUrl.split('?')[0].split('/').pop() || '';
    const plannerData = {
      ...planner,
      ...(planner.logo_url ? { logo_url: resolveAssetUrl(planner.logo_url) } : {}),
    };

    if (filename.includes('01_capa') || filename.includes('capa')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.capa, name: 'Capa', data: plannerData, index: 0 });
      return;
    }
    if (filename.includes('02_diagnostico') || filename.includes('diagnostico')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.diagnostico, name: 'Diagnostico', data: diagnostico, index: 1 });
      return;
    }
    if (filename.includes('03_desafios') || filename.includes('desafios')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.desafios, name: 'Desafios', data: desafios, index: 2 });
      return;
    }
    if (filename.includes('04_metas') || filename.includes('metas')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.metas, name: 'Metas', data: grid, index: 3 });
      return;
    }
    if (filename.includes('05_slogan') || filename.includes('slogan')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.slogan, name: 'Slogan', data: slogan, index: 4 });
      return;
    }
    if (filename.includes('06_defesa') || filename.includes('defesa')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.defesa, name: 'Defesa', data: defesa, index: 5 });
      return;
    }
    if (filename.includes('07_roadmap') || filename.includes('roadmap')) {
      setEditingSlide({ image: TEMPLATE_BY_TAB.roadmap, name: 'Roadmap', data: roadmap, index: 6 });
    }
  };

  const handleSaveSlideEdit = async (_blocks: any[], updatedData: any) => {
    if (!editingSlide) return;

    const overrides: Partial<{
      planner: PlannerData;
      diagnostico: DiagnosticoData;
      desafios: DesafiosData;
      grid: MetasData;
      slogan: SloganData;
      defesa: DefesaData;
      roadmap: RoadmapData;
    }> = {};

    if (editingSlide.index === 0) {
      const nextPlanner = updatedData as PlannerData;
      setPlanner(nextPlanner);
      overrides.planner = nextPlanner;
    }

    if (editingSlide.index === 1) {
      const nextDiagnostico = {
        texto_longo: String(updatedData.texto_longo || updatedData.texto || ''),
        ...(Array.isArray(updatedData.layout) ? { layout: updatedData.layout } : {}),
      };
      setDiagnostico(nextDiagnostico);
      overrides.diagnostico = nextDiagnostico;
    }

    if (editingSlide.index === 2) {
      const items = Array.isArray(updatedData.itens)
        ? updatedData.itens.map((item: any) => String(item || '').trim()).slice(0, 9)
        : desafios.itens;
      const nextDesafios = {
        itens: items,
        texto: items.filter((item: string) => item.trim()).map((item: string) => `• ${item}`).join('\n'),
        ...(Array.isArray(updatedData.layout) ? { layout: updatedData.layout } : {}),
      };
      setDesafios(nextDesafios);
      overrides.desafios = nextDesafios;
    }

    if (editingSlide.index === 3) {
      const nextGrid = {
        mes: String(updatedData.mes || grid.mes || planner.mes || ''),
        texto_longo: String(updatedData.texto_longo || updatedData.texto || ''),
        ...(Array.isArray(updatedData.layout) ? { layout: updatedData.layout } : {}),
      };
      setGrid(nextGrid);
      overrides.grid = nextGrid;
    }

    if (editingSlide.index === 4) {
      const nextSlogan = {
        frase: String(updatedData.frase || ''),
        ...(Array.isArray(updatedData.layout) ? { layout: updatedData.layout } : {}),
      };
      setSlogan(nextSlogan);
      overrides.slogan = nextSlogan;
    }

    if (editingSlide.index === 5) {
      const nextDefesa = {
        subtitulo: String(updatedData.subtitulo || ''),
        texto_longo: String(updatedData.texto_longo || updatedData.texto || ''),
        ...(Array.isArray(updatedData.layout) ? { layout: updatedData.layout } : {}),
      };
      setDefesa(nextDefesa);
      overrides.defesa = nextDefesa;
    }


    if (editingSlide.index === 6) {
      const nextRoadmap = {
        cards: normalizeRoadmapCards(updatedData.cards, extractMonthsFromLabel(planner.mes)),
        ...(Array.isArray(updatedData.layout) ? { layout: updatedData.layout } : {}),
      };
      setRoadmap(nextRoadmap);
      overrides.roadmap = nextRoadmap;
    }
    try {
      setLoading(true);
      const response = await api.post('/presentation/generate', buildPayload(overrides));
      if (response.data.success) {
        if (response.data.content) {
          applyGeneratedContent(response.data.content);
        }
        const urls = (response.data.images || []).map((url: string) => resolveAssetUrl(url));
        setGeneratedImages(urls.map(withCacheBust));
        setTempFiles(response.data.tempFiles || []);
        alert('Lamina regenerada com sucesso!');
        setEditingSlide(null);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      alert('Erro ao regenerar lamina: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Apresentacao da Campanha</h2>
          <p className="text-xs text-gray-400 mt-1">Cria slides profissionais baseados no seu planejamento</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PeriodSelector
            availableMonths={availableMonths}
            selectedMonths={selectedMonths}
            periodMode={periodMode}
            onPeriodChange={handlePeriodChange}
            onFetchMonths={fetchAvailableMonths}
          />
          <button
            onClick={fetchHistory}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm"
          >
            Historico
          </button>
          <button
            onClick={() => setVisualMode(!visualMode)}
            className={`${visualMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'} text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm`}
          >
            {visualMode ? 'Modo Formulario' : 'Modo Visual'}
          </button>
          <button
            onClick={handleAiFill}
            disabled={aiLoading || visualMode || isPresentationJobActive}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
          >
            {aiLoading ? 'Iniciando...' : 'Preencher com IA'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || visualMode || isPresentationJobActive}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Iniciando...' : 'Gerar Laminas'}
          </button>
          {generatedImages.length > 0 && (
            <button
              onClick={handleSaveVersion}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
            >
              Salvar Versao
            </button>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="mb-8 bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Historico de Apresentacoes</h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white">Fechar</button>
          </div>
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma apresentacao salva encontrada.</p>
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
                        const urls = (Array.isArray(item.arquivos) ? item.arquivos : []).map((url: string) => resolveAssetUrl(url));
                        setGeneratedImages(urls.map(withCacheBust));
                        setVisualMode(false);
                        setShowHistory(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm font-bold"
                    >
                      Visualizar
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {(Array.isArray(item.arquivos) ? item.arquivos : []).map((img: string, idx: number) => (
                      <img
                        key={idx}
                        src={resolveAssetUrl(img)}
                        className="h-20 w-auto rounded border border-gray-600"
                        alt="Thumbnail"
                        onError={(event) => {
                          console.error('Erro ao carregar thumbnail:', img);
                          (event.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {presentationJobId && clientId && presentationJob && (
        <JobProgressPanel
          job={presentationJob}
          title="Progresso da Apresentacao"
          onCancel={handlePresentationJobCancelBtn}
          onRetry={handlePresentationJobRetryBtn}
          onDismissPanel={handleDismissPresentationJobPanel}
        />
      )}

      {visualMode ? (
        <VisualSlideEditor
          templateImage={TEMPLATE_BY_TAB[activeTab]}
          initialBlocks={[]}
          onSave={(blocks) => {
            console.log('Layout salvo:', blocks);
            alert('Coordenadas exportadas! Verifique o console.');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-700 overflow-x-auto">
              {TAB_ITEMS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 min-h-[300px]">
              {activeTab === 'capa' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Capa / Planner de abertura</h3>
                  <input
                    value={planner.mes}
                    onChange={(event) => setPlanner({ ...planner, mes: event.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Meses do periodo"
                  />
                  <input
                    value={planner.nome_cliente}
                    onChange={(event) => setPlanner({ ...planner, nome_cliente: event.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Nome do cliente"
                  />
                </div>
              )}

              {activeTab === 'diagnostico' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Diagnostico do cliente</h3>
                  <textarea
                    value={diagnostico.texto_longo}
                    onChange={(event) => setDiagnostico({ texto_longo: clamp(event.target.value, 900) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-44"
                    placeholder="Texto do diagnostico"
                  />
                </div>
              )}

              {activeTab === 'desafios' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Novos desafios</h3>
                  <textarea
                    value={desafios.texto}
                    onChange={(event) => {
                      const cleaned = event.target.value
                        .split('\n')
                        .map((line) => line.replace(/^•\s*/, '').trim())
                        .filter(Boolean)
                        .slice(0, 9)
                        .map((line) => clamp(line, 34));
                      while (cleaned.length < 9) cleaned.push('');
                      setDesafios({
                        itens: cleaned,
                        texto: cleaned.filter((item) => item.trim()).map((item) => `• ${item}`).join('\n'),
                      });
                    }}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-48"
                    placeholder="Liste ate 9 desafios"
                  />
                </div>
              )}

              {activeTab === 'metas' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Metas da campanha</h3>
                  <input
                    value={grid.mes}
                    onChange={(event) => setGrid({ ...grid, mes: event.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Meses do periodo"
                  />
                  <textarea
                    value={grid.texto_longo}
                    onChange={(event) => setGrid({ ...grid, texto_longo: clamp(event.target.value, 700) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-40"
                    placeholder="Texto das metas"
                  />
                </div>
              )}

              {activeTab === 'slogan' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Slogan da campanha</h3>
                  <textarea
                    value={slogan.frase}
                    onChange={(event) => setSlogan({ frase: clamp(event.target.value, 60) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-24 text-center font-bold"
                  />
                </div>
              )}

              {activeTab === 'defesa' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Defesa da campanha</h3>
                  <input
                    value={defesa.subtitulo}
                    onChange={(event) => setDefesa({ ...defesa, subtitulo: clamp(event.target.value, 60) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Subtitulo"
                  />
                  <textarea
                    value={defesa.texto_longo}
                    onChange={(event) => setDefesa({ ...defesa, texto_longo: clamp(event.target.value, 900) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white h-44"
                    placeholder="Texto de defesa"
                  />
                </div>
              )}

              {activeTab === 'roadmap' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400">Planner trimestral</h3>
                  {roadmap.cards.map((card, index) => (
                    <div key={index} className="rounded-lg border border-gray-700 bg-gray-800/70 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Card {index + 1}</p>
                      <input
                        value={card.mes}
                        onChange={(event) => updateRoadmapCard(index, 'mes', clamp(event.target.value, 20))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder="Mes"
                      />
                      <input
                        value={card.titulo}
                        onChange={(event) => updateRoadmapCard(index, 'titulo', clamp(event.target.value, 28))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder="Titulo"
                      />
                      <input
                        value={card.detalhe}
                        onChange={(event) => updateRoadmapCard(index, 'detalhe', clamp(event.target.value, 24))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder="Detalhe"
                      />
                      <textarea
                        value={card.descricao}
                        onChange={(event) => updateRoadmapCard(index, 'descricao', clamp(event.target.value, 52))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white h-20"
                        placeholder="Descricao"
                      />
                      <input
                        value={card.sugestao}
                        onChange={(event) => updateRoadmapCard(index, 'sugestao', clamp(event.target.value, 32))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder="Sugestao"
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'link_cta' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-blue-400">Slide de link</h3>
                  <input
                    type="url"
                    value={linkCta.url || ''}
                    onChange={(event) => setLinkCta({ ...linkCta, url: event.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="https://..."
                  />
                </div>
              )}

              {activeTab === 'encerramento' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-blue-400">Encerramento</h3>
                  <p className="text-sm text-gray-400">Slide estatico de encerramento.</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800 min-h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400">Resultados gerados</h3>
              {generatedImages.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handlePdfDownload}
                    className="bg-red-700 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-bold transition-colors text-xs"
                  >
                    Baixar PDF
                  </button>
                  <button
                    onClick={handleBatchDownload}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-bold transition-colors text-xs"
                  >
                    ZIP
                  </button>
                </div>
              )}
            </div>

            {generatedImages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedImages.map((imgUrl, idx) => {
                  const editable = canEditGeneratedSlide(imgUrl);
                  return (
                    <div key={idx} className="group relative rounded-lg overflow-hidden border border-gray-700 shadow-xl bg-gray-800">
                      <div className="aspect-video relative">
                        <img
                          src={resolveAssetUrl(imgUrl)}
                          alt="Slide gerado"
                          className="w-full h-full object-cover"
                          onError={(event) => {
                            console.error('Erro ao carregar preview:', imgUrl);
                            (event.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 backdrop-blur-sm">
                        {editable && (
                          <button
                            onClick={() => handleOpenEditor(imgUrl)}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-blue-700 transition-all shadow-lg"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(imgUrl, getPngFilename(imgUrl, 'slide.png'))}
                          className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-gray-200 transition-all shadow-lg"
                        >
                          Baixar
                        </button>
                      </div>
                      <div className="p-3 bg-gray-800 border-t border-gray-700">
                        <p className="text-xs text-gray-400 text-center truncate">{imgUrl.split('/').pop()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-xl p-8">
                <p className="font-medium text-lg">Area de visualizacao</p>
                <p className="text-sm mt-2 text-gray-500 max-w-sm text-center">
                  1. Clique em "Preencher com IA" para gerar o conteudo.<br />
                  2. Revise os textos ao lado.<br />
                  3. Clique em "Gerar Laminas".
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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










