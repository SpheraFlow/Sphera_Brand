import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/CalendarPage.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=b2edd3c6"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$(), _s2 = $RefreshSig$(), _s3 = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=b2edd3c6"; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useCallback = __vite__cjsImport3_react["useCallback"];
import { useParams } from "/node_modules/.vite/deps/react-router-dom.js?v=b2edd3c6";
import { DragDropContext, Droppable, Draggable } from "/node_modules/.vite/deps/@hello-pangea_dnd.js?v=b2edd3c6";
import ContentMixSelector from "/src/components/ContentMixSelector.tsx";
import PhotoIdeasModal from "/src/components/PhotoIdeasModal.tsx";
import JobProgressPanel from "/src/components/Jobs/JobProgressPanel.tsx";
import api, { jobsService } from "/src/services/api.ts";
import { useJobPolling } from "/src/hooks/useJobPolling.ts";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  getDay
} from "/node_modules/.vite/deps/date-fns.js?v=b2edd3c6";
import { ptBR } from "/node_modules/.vite/deps/date-fns_locale.js?v=b2edd3c6";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export default function CalendarPage() {
  _s();
  const { clientId } = useParams();
  const [calendar, setCalendar] = useState(null);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(/* @__PURE__ */ new Date());
  const [selectedPost, setSelectedPost] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [periodoDias, setPeriodoDias] = useState(30);
  const [specificMonths, setSpecificMonths] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [isRegeneratingPost, setIsRegeneratingPost] = useState(false);
  const [showPhotoIdeasModal, setShowPhotoIdeasModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMonthsSelected, setExportMonthsSelected] = useState([]);
  const [pendingJobId, setPendingJobId] = useState(null);
  const [briefing, setBriefing] = useState("");
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [selectedChainId, setSelectedChainId] = useState("");
  const [promptChains, setPromptChains] = useState([]);
  const [mix, setMix] = useState({
    reels: 0,
    static: 0,
    carousel: 0,
    stories: 0,
    photos: 0
  });
  const [editTema, setEditTema] = useState("");
  const [editCopy, setEditCopy] = useState("");
  const [editData, setEditData] = useState("");
  const [editFormato, setEditFormato] = useState("");
  const [editIdeiaVisual, setEditIdeiaVisual] = useState("");
  const [editImagePrompt, setEditImagePrompt] = useState("");
  const [editObjetivo, setEditObjetivo] = useState("");
  const [editReferencias, setEditReferencias] = useState("");
  const [editStatus, setEditStatus] = useState("sugerido");
  const [regenPostPrompt, setRegenPostPrompt] = useState("");
  const [carouselSlidesCount, setCarouselSlidesCount] = useState(6);
  const [formatInstructions, setFormatInstructions] = useState({
    reels: "",
    static: "",
    carousel: "",
    stories: "",
    photos: ""
  });
  const [monthReferences, setMonthReferences] = useState("");
  const [monthImages, setMonthImages] = useState([]);
  const [showMonthReferencesModal, setShowMonthReferencesModal] = useState(false);
  useEffect(() => {
    if (clientId) {
      loadCalendar();
      loadPromptChains();
      loadClientName();
    }
  }, [clientId, currentMonth]);
  const loadClientName = async () => {
    if (!clientId) return;
    try {
      const response = await api.get(`/clients/${clientId}`);
      const name = response.data?.cliente?.nome;
      if (name) {
        setClientName(name);
      }
    } catch (e) {
    }
  };
  useEffect(() => {
    const savedJob = localStorage.getItem("pendingCalendarJob");
    if (savedJob && clientId) {
      try {
        const { jobId, clientId: savedClientId } = JSON.parse(savedJob);
        if (savedClientId === clientId) {
          console.log("🔄 Recuperando job pendente:", jobId);
          jobsService.getJobStatus(clientId, jobId).then((job2) => {
            const terminalStatuses = ["succeeded", "completed", "failed", "canceled"];
            if (terminalStatuses.includes(job2.status)) {
              console.log(`🗑️ Job já finalizado (${job2.status}), limpando localStorage.`);
              localStorage.removeItem("pendingCalendarJob");
              if (job2.status === "succeeded" || job2.status === "completed") {
                loadCalendar();
              }
            } else {
              setPendingJobId(jobId);
            }
          }).catch(() => {
            localStorage.removeItem("pendingCalendarJob");
          });
        }
      } catch (e) {
        console.error("Erro ao ler job pendente", e);
      }
    }
  }, [clientId]);
  const loadCalendar = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      setMonthReferences("");
      setMonthImages([]);
      const monthStr = format(currentMonth, "MMMM yyyy", { locale: ptBR });
      console.log("Carregando calendario: " + monthStr);
      const response = await api.get("/calendars/" + clientId + "?month=" + encodeURIComponent(monthStr));
      const calendarData = response.data.calendar;
      if (!calendarData) {
        setCalendar(null);
        return;
      }
      if (calendarData.metadata?.month_references) setMonthReferences(calendarData.metadata.month_references);
      if (calendarData.metadata?.month_images && Array.isArray(calendarData.metadata.month_images)) {
        setMonthImages(calendarData.metadata.month_images);
      }
      const rawPosts = Array.isArray(calendarData.posts) ? calendarData.posts : typeof calendarData.posts === "string" ? JSON.parse(calendarData.posts) : [];
      calendarData.posts = (Array.isArray(rawPosts) ? rawPosts : []).map((post) => {
        const n = (v) => {
          if (v == null) return "";
          if (typeof v === "string") return v;
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        };
        return {
          data: n(post.data),
          tema: n(post.tema),
          formato: n(post.formato),
          ideia_visual: n(post.ideia_visual),
          copy_sugestao: n(post.copy_sugestao),
          objetivo: n(post.objetivo),
          image_generation_prompt: n(post.image_generation_prompt),
          referencias: n(post.referencias),
          status: post.status || "sugerido"
        };
      });
      setCalendar(calendarData);
    } catch (error) {
      console.error("Erro ao carregar calendario:", error);
      if (error.response?.status === 404) setCalendar(null);
      else
        alert("Erro ao carregar calendario: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  }, [clientId, currentMonth]);
  const handleJobSuccessCallback = useCallback((_result) => {
    localStorage.removeItem("pendingCalendarJob");
    loadCalendar();
  }, [loadCalendar]);
  const handleJobErrorCallback = useCallback((errMsg) => {
    console.error("Job falhou:", errMsg);
    localStorage.removeItem("pendingCalendarJob");
  }, []);
  const handleJobCancelCallback = useCallback(() => {
    localStorage.removeItem("pendingCalendarJob");
    setPendingJobId(null);
  }, []);
  const {
    job,
    status: jobStatus,
    progress: jobProgress,
    stepDescription: jobStepDescription,
    error: jobPollingError,
    isPolling: jobIsPolling
  } = useJobPolling({
    clientId: clientId || "",
    jobId: pendingJobId,
    enabled: !!pendingJobId && !!clientId,
    onSuccess: handleJobSuccessCallback,
    onError: handleJobErrorCallback,
    onCancel: handleJobCancelCallback
  });
  const handleJobCancelBtn = async () => {
    if (!pendingJobId || !clientId) return;
    try {
      await jobsService.cancelJob(clientId, pendingJobId);
      alert("Geração cancelada com sucesso.");
      setPendingJobId(null);
      localStorage.removeItem("pendingCalendarJob");
    } catch (e) {
      if (e.response?.status === 400 || e.response?.status === 404) {
        setPendingJobId(null);
        localStorage.removeItem("pendingCalendarJob");
      } else {
        alert("Erro ao cancelar: " + (e.response?.data?.error || e.message));
      }
    }
  };
  const generateSinglePostWithAI = async () => {
    if (!calendar || !selectedPost) return;
    try {
      setIsRegeneratingPost(true);
      const response = await api.post("/calendars/generate-single-post", {
        calendarId: calendar.id,
        postIndex: selectedPost.index,
        data: editData,
        formato: editFormato,
        carouselSlidesCount,
        customPrompt: regenPostPrompt
      });
      const newPost = response.data.post;
      const updatedPosts = [...calendar.posts];
      updatedPosts[selectedPost.index] = newPost;
      setCalendar({ ...calendar, posts: updatedPosts });
      setEditTema(newPost.tema || "");
      setEditCopy(newPost.copy_sugestao || "");
      setEditData(newPost.data || "");
      setEditFormato(newPost.formato || "");
      setEditIdeiaVisual(newPost.ideia_visual || "");
      setEditObjetivo(newPost.objetivo || "");
      setEditImagePrompt(newPost.image_generation_prompt || "");
      alert("✅ Post gerado com IA (isolado) com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao gerar post isolado com IA:", error);
      alert("Erro ao gerar post isolado com IA: " + (error.response?.data?.error || error.message));
    } finally {
      setIsRegeneratingPost(false);
    }
  };
  const loadPromptChains = async () => {
    try {
      const response = await api.get(`/prompt-chains/${clientId}`);
      setPromptChains(response.data.data || []);
    } catch (error) {
      console.error("Erro ao carregar prompt chains:", error);
    }
  };
  const handleExportExcel = async () => {
    if (!calendar) {
      alert("Nenhum calendário carregado.");
      return;
    }
    try {
      setIsGenerating(true);
      const downloadClientName = clientName || "Cliente";
      const suffix = getExcelFilenameSuffix(exportMonthsSelected);
      const safeMonth = String(suffix || String(calendar.mes || "mes")).replace(/\s+/g, "_");
      const response = await api.post(
        "/calendars/export-excel",
        {
          calendarId: calendar.id,
          clientName: downloadClientName,
          monthsSelected: exportMonthsSelected
        },
        {
          responseType: "blob"
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${downloadClientName}_${safeMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert("✅ Calendário Excel gerado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar Excel:", err);
      alert("Erro ao gerar Excel: " + (err.response?.data?.error || err.message));
    } finally {
      setIsGenerating(false);
      setShowExportModal(false);
    }
  };
  const detectMonthsFromCalendar = (cal) => {
    const extractMonthNumFromDateStr = (value) => {
      const s = String(value || "").trim();
      if (!s) return null;
      let m = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (m?.[2]) {
        const monthNum = parseInt(m[2], 10);
        return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
      }
      m = s.match(/(\d{1,2})\-(\d{1,2})(?:\-(\d{2,4}))?/);
      if (m?.[2]) {
        const monthNum = parseInt(m[2], 10);
        return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
      }
      m = s.match(/(\d{4})\-(\d{1,2})\-(\d{1,2})/);
      if (m?.[2]) {
        const monthNum = parseInt(m[2], 10);
        return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
      }
      m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (m?.[2]) {
        const monthNum = parseInt(m[2], 10);
        return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
      }
      return null;
    };
    const months = /* @__PURE__ */ new Set();
    for (const p of cal.posts || []) {
      const dateStr = String(p?.data || "");
      const monthNum = extractMonthNumFromDateStr(dateStr);
      if (monthNum) months.add(monthNum);
    }
    return Array.from(months).sort((a, b) => a - b);
  };
  const getMonthName = (monthNum) => {
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro"
    ];
    return monthNames[monthNum - 1] || `Mês ${monthNum}`;
  };
  const getExcelFilenameSuffix = (monthsSelected) => {
    const normalized = (Array.isArray(monthsSelected) ? monthsSelected : []).map((m) => parseInt(String(m), 10)).filter((m) => !isNaN(m) && m >= 1 && m <= 12).sort((a, b) => a - b);
    const yearMatch = String(calendar?.mes || "").match(/(\d{4})/);
    const yearStr = yearMatch?.[1] || "";
    if (normalized.length >= 2) {
      const start = getMonthName(normalized[0]);
      const end = getMonthName(normalized[normalized.length - 1]);
      return `${start}-${end}${yearStr ? `_${yearStr}` : ""}`;
    }
    if (normalized.length === 1) {
      return `${getMonthName(normalized[0])}${yearStr ? `_${yearStr}` : ""}`;
    }
    const safeMonth = String(calendar?.mes || "mes").replace(/\s+/g, "_");
    return safeMonth;
  };
  const parseMonthLabelToNumber = (label) => {
    const s = String(label || "").trim().toLowerCase();
    if (!s) return null;
    const token = s.split(/\s+/)[0] || "";
    const map = {
      janeiro: 1,
      fevereiro: 2,
      "março": 3,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12
    };
    return map[token] ?? null;
  };
  const openExportModal = () => {
    if (!calendar) {
      alert("Nenhum calendário carregado.");
      return;
    }
    const baseMonth = parseMonthLabelToNumber(calendar.mes) || currentMonth.getMonth() + 1;
    const defaultSelection = [
      baseMonth,
      baseMonth === 12 ? 1 : baseMonth + 1,
      baseMonth >= 11 ? (baseMonth + 2) % 12 || 12 : baseMonth + 2
    ];
    const monthsOptions = getExportMonthOptions(calendar);
    setExportMonthsSelected(defaultSelection.filter((m) => monthsOptions.includes(m)));
    setShowExportModal(true);
  };
  const getExportMonthOptions = (cal) => {
    const baseMonth = parseMonthLabelToNumber(cal.mes) || currentMonth.getMonth() + 1;
    const triMonths = [
      baseMonth,
      baseMonth === 12 ? 1 : baseMonth + 1,
      baseMonth >= 11 ? (baseMonth + 2) % 12 || 12 : baseMonth + 2
    ];
    const detected = detectMonthsFromCalendar(cal);
    return Array.from(/* @__PURE__ */ new Set([...triMonths, ...detected])).sort((a, b) => a - b);
  };
  const openGenerateModal = () => {
    setMix({ reels: 2, static: 4, carousel: 4, stories: 2, photos: 0 });
    setBriefing("");
    setGenerationPrompt("");
    setPeriodoDias(30);
    setSpecificMonths([format(currentMonth, "MMMM yyyy", { locale: ptBR })]);
    setShowGenerateModal(true);
  };
  const regeneratePostWithAI = async () => {
    if (!calendar || !selectedPost) return;
    try {
      setIsRegeneratingPost(true);
      const response = await api.put("/calendars/regenerate-post", {
        calendarId: calendar.id,
        postIndex: selectedPost.index,
        newFormato: editFormato,
        customPrompt: regenPostPrompt
      });
      const newPost = response.data.post;
      const updatedPosts = [...calendar.posts];
      updatedPosts[selectedPost.index] = newPost;
      setCalendar({ ...calendar, posts: updatedPosts });
      setEditTema(newPost.tema || "");
      setEditCopy(newPost.copy_sugestao || "");
      setEditData(newPost.data || "");
      setEditFormato(newPost.formato || "");
      setEditIdeiaVisual(newPost.ideia_visual || "");
      setEditObjetivo(newPost.objetivo || "");
      setEditImagePrompt(newPost.image_generation_prompt || "");
      alert("✅ Post regenerado com IA com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao regenerar post com IA:", error);
      alert("Erro ao regenerar post com IA: " + (error.response?.data?.error || error.message));
    } finally {
      setIsRegeneratingPost(false);
    }
  };
  const deleteCalendar = async () => {
    if (!calendar) return;
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir o calendário completo de ${calendar.mes}?

Todos os ${calendar.posts.length} posts serão removidos permanentemente.`
    );
    if (!confirmDelete) return;
    try {
      setIsDeleting(true);
      const monthStr = format(currentMonth, "MMMM yyyy", { locale: ptBR });
      await api.delete(`/calendars/${clientId}/${monthStr}`);
      alert("✅ Calendário excluído com sucesso!");
      loadCalendar();
    } catch (error) {
      console.error("Erro ao excluir calendário:", error);
      alert("Erro ao excluir calendário: " + (error.response?.data?.error || error.message));
    } finally {
      setIsDeleting(false);
    }
  };
  const generateCalendar = async () => {
    if (!clientId) return;
    const totalPosts = Object.values(mix).reduce((sum, count) => sum + count, 0);
    if (totalPosts === 0) {
      alert("Selecione pelo menos 1 tipo de conteúdo para gerar o calendário.");
      return;
    }
    if (!specificMonths || specificMonths.length === 0) {
      alert("Selecione pelo menos 1 mês para gerar.");
      return;
    }
    try {
      setIsGenerating(true);
      const response = await api.post("/generate-calendar", {
        clienteId: clientId,
        periodo: periodoDias,
        briefing,
        mes: format(currentMonth, "MMMM yyyy", { locale: ptBR }),
        monthsCount: specificMonths.length,
        carouselSlidesCount,
        mix,
        generationPrompt,
        chainId: selectedChainId || void 0,
        formatInstructions,
        monthReferences
      });
      const { jobId, message } = response.data;
      console.log(`🚀 Job iniciado: ${jobId}`);
      setPendingJobId(jobId);
      localStorage.setItem("pendingCalendarJob", JSON.stringify({ jobId, clientId }));
      setShowGenerateModal(false);
      setBriefing("");
      setGenerationPrompt("");
      setSpecificMonths([]);
      setMix({
        reels: 0,
        static: 0,
        carousel: 0,
        stories: 0,
        photos: 0
      });
    } catch (error) {
      console.error("❌ Erro ao iniciar geração:", error);
      alert("Erro ao iniciar geração: " + (error.response?.data?.error || error.message));
    } finally {
      setIsGenerating(false);
    }
  };
  const saveCalendar = async (updatedPosts) => {
    if (!calendar) return;
    try {
      setIsSaving(true);
      await api.put(`/calendars/${calendar.id}`, {
        posts: updatedPosts
      });
      console.log("✅ Calendário salvo");
    } catch (error) {
      console.error("❌ Erro ao salvar calendário:", error);
      alert("Erro ao salvar: " + (error.response?.data?.error || error.message));
    } finally {
      setIsSaving(false);
    }
  };
  const onDragEnd = (result) => {
    if (!result.destination || !calendar) return;
    const sourceDay = result.source.droppableId;
    const destDay = result.destination.droppableId;
    if (sourceDay === destDay) return;
    const postIndex = parseInt(result.draggableId.split("-")[1]);
    const updatedPosts = [...calendar.posts];
    updatedPosts[postIndex] = {
      ...updatedPosts[postIndex],
      data: destDay
    };
    setCalendar({ ...calendar, posts: updatedPosts });
    saveCalendar(updatedPosts);
  };
  const openEditModal = (post, index) => {
    console.log("🖱️ Abrindo modal para post:", post);
    console.log("📊 Index:", index);
    setSelectedPost({ post, index });
    setEditTema(post.tema || "");
    setEditCopy(post.copy_sugestao || "");
    setEditData(post.data || "");
    setEditFormato(post.formato || "");
    setEditIdeiaVisual(post.ideia_visual || "");
    setEditObjetivo(post.objetivo || "");
    setEditImagePrompt(post.image_generation_prompt || "");
    setEditReferencias(post.referencias || "");
    setEditStatus(post.status || "sugerido");
    setRegenPostPrompt(
      "Adapte este conteúdo para o novo formato mantendo a mesma estratégia, mas otimizando copy, ideia visual e objetivo para melhor desempenho."
    );
  };
  const closeEditModal = () => {
    setSelectedPost(null);
  };
  const savePost = async () => {
    if (!selectedPost || !calendar) return;
    const updatedPosts = [...calendar.posts];
    updatedPosts[selectedPost.index] = {
      data: editData,
      tema: editTema,
      formato: editFormato,
      ideia_visual: editIdeiaVisual,
      copy_sugestao: editCopy,
      objetivo: editObjetivo,
      image_generation_prompt: editImagePrompt,
      referencias: editReferencias,
      status: editStatus
    };
    setCalendar({ ...calendar, posts: updatedPosts });
    await saveCalendar(updatedPosts);
    alert("✅ Post atualizado com sucesso!");
    closeEditModal();
  };
  const deletePost = async () => {
    if (!calendar || !selectedPost) return;
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir este post? Essa ação não pode ser desfeita."
    );
    if (!confirmDelete) return;
    try {
      setIsDeletingPost(true);
      await api.delete(`/calendars/post/${calendar.id}/${selectedPost.index}`);
      const updatedPosts = calendar.posts.filter((_, i) => i !== selectedPost.index);
      setCalendar({ ...calendar, posts: updatedPosts });
      alert("✅ Post excluído com sucesso!");
      setSelectedPost(null);
    } catch (error) {
      console.error("❌ Erro ao excluir post:", error);
      alert("Erro ao excluir post: " + (error.response?.data?.error || error.message));
    } finally {
      setIsDeletingPost(false);
    }
  };
  const getFormatIcon = (formato) => {
    const lower = formato?.toLowerCase() || "";
    if (lower.includes("reel")) return "🎬";
    if (lower.includes("carrossel")) return "📸";
    if (lower.includes("static")) return "🖼️";
    if (lower.includes("stories")) return "📱";
    return "📄";
  };
  const getStatusColor = (status) => {
    switch (status) {
      case "aprovado":
        return "border-l-green-500 bg-green-500/10";
      case "publicado":
        return "border-l-blue-500 bg-blue-500/10";
      default:
        return "border-l-yellow-500 bg-yellow-500/10";
    }
  };
  const getPostsForDay = (dayStr) => {
    if (!calendar) return [];
    return calendar.posts.map((post, index) => ({ post, index })).filter(({ post }) => {
      const postDate = post.data;
      return postDate === dayStr || postDate === dayStr.replace(/^0/, "") || // Remove zero à esquerda
      postDate.includes(dayStr);
    });
  };
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);
  if (loading) {
    return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen bg-gray-900 flex items-center justify-center", children: /* @__PURE__ */ jsxDEV("div", { className: "text-white text-xl", children: "Carregando calendário..." }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 816,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 815,
      columnNumber: 7
    }, this);
  }
  if (!calendar) {
    return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen bg-gray-900 text-white p-8", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "max-w-4xl mx-auto", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("h1", { className: "text-3xl font-bold mb-1", children: "📅 Calendário Editorial" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 829,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 text-lg", children: format(currentMonth, "MMMM yyyy", { locale: ptBR }) }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 830,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 828,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => setCurrentMonth(subMonths(currentMonth, 1)),
                className: "p-3 hover:bg-gray-800 rounded-lg transition-colors",
                title: "Mês anterior",
                children: "← Anterior"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 837,
                columnNumber: 15
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("div", { className: "text-center min-w-[200px]", children: /* @__PURE__ */ jsxDEV("div", { className: "text-xl font-semibold", children: format(currentMonth, "MMMM yyyy", { locale: ptBR }) }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 846,
              columnNumber: 17
            }, this) }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 845,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => setCurrentMonth(addMonths(currentMonth, 1)),
                className: "p-3 hover:bg-gray-800 rounded-lg transition-colors",
                title: "Próximo mês",
                children: "Próximo →"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 851,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 836,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 827,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-12 text-center", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "text-6xl mb-6", children: "📭" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 863,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("h2", { className: "text-3xl font-bold mb-4", children: "Nenhum Calendário para este Mês" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 864,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 mb-8 text-lg max-w-2xl mx-auto", children: [
            "Crie um calendário editorial personalizado para ",
            format(currentMonth, "MMMM yyyy", { locale: ptBR }),
            "com posts otimizados para suas redes sociais."
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 865,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-6", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 text-left", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-700/50 p-4 rounded-lg", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "text-2xl mb-2", children: "🎬" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 873,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "font-semibold", children: "Reels & Vídeos" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 874,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-gray-400", children: "Conteúdo dinâmico e envolvente" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 875,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 872,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-700/50 p-4 rounded-lg", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "text-2xl mb-2", children: "📸" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 878,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "font-semibold", children: "Posts Estáticos" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 879,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-gray-400", children: "Imagens impactantes" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 880,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 877,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-700/50 p-4 rounded-lg", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "text-2xl mb-2", children: "📱" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 883,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "font-semibold", children: "Stories & Carrosséis" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 884,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-gray-400", children: "Conteúdo sequencial" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 885,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 882,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 871,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex gap-4", children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: openGenerateModal,
                  className: "flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-12 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105",
                  children: "✨ Criar Calendário para este Mês"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 890,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => setShowPhotoIdeasModal(true),
                  className: "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105",
                  children: "📸 Ideias de Fotos"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 896,
                  columnNumber: 17
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 889,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 870,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 862,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 825,
        columnNumber: 9
      }, this),
      showGenerateModal && /* @__PURE__ */ jsxDEV(
        GenerateModal,
        {
          mix,
          setMix,
          briefing,
          setBriefing,
          generationPrompt,
          setGenerationPrompt,
          periodoDias,
          setPeriodoDias,
          baseMonthDate: currentMonth,
          specificMonths,
          setSpecificMonths,
          formatInstructions,
          setFormatInstructions,
          promptChains,
          selectedChainId,
          setSelectedChainId,
          isGenerating,
          onGenerate: generateCalendar,
          onClose: () => setShowGenerateModal(false)
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 909,
          columnNumber: 9
        },
        this
      ),
      pendingJobId && clientId && job && /* @__PURE__ */ jsxDEV("div", { className: "w-full max-w-4xl mt-6", children: /* @__PURE__ */ jsxDEV(
        JobProgressPanel,
        {
          job,
          onCancel: handleJobCancelBtn,
          onDismissPanel: () => setPendingJobId(null)
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 935,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 934,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(
        PhotoIdeasModal,
        {
          isOpen: showPhotoIdeasModal,
          onClose: () => setShowPhotoIdeasModal(false),
          clienteId: clientId || "",
          mes: format(currentMonth, "MMMM", { locale: ptBR }),
          briefing
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 944,
          columnNumber: 9
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 824,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen bg-gray-900 text-white p-4 md:p-8", children: /* @__PURE__ */ jsxDEV("div", { className: "max-w-7xl mx-auto", children: [
    pendingJobId && clientId && job && /* @__PURE__ */ jsxDEV(
      JobProgressPanel,
      {
        job,
        onCancel: handleJobCancelBtn,
        onDismissPanel: () => setPendingJobId(null)
      },
      void 0,
      false,
      {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 960,
        columnNumber: 9
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("h1", { className: "text-2xl md:text-3xl font-bold mb-1", children: "📅 Calendário Editorial" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 970,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 text-sm md:text-base", children: [
          calendar.posts.length,
          " posts planejados • Arraste para reorganizar"
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 971,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 969,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
        isSaving && /* @__PURE__ */ jsxDEV("span", { className: "text-yellow-400 text-sm animate-pulse", children: "💾 Salvando..." }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 978,
          columnNumber: 13
        }, this),
        isDeleting && /* @__PURE__ */ jsxDEV("span", { className: "text-red-400 text-sm animate-pulse", children: "🗑️ Excluindo..." }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 981,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: openExportModal,
            className: "bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition-colors text-sm",
            children: "📊 Exportar Excel"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 983,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: deleteCalendar,
            disabled: isDeleting,
            className: "bg-red-600 hover:bg-red-700 disabled:bg-red-800 px-4 py-2 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50",
            title: "Excluir calendário completo",
            children: "🗑️ Excluir"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 989,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: openGenerateModal,
            className: "bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm",
            children: "+ Gerar Novo"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 997,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 976,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 968,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between bg-gray-800/50 rounded-xl p-4 no-print", children: [
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setCurrentMonth(subMonths(currentMonth, 1)),
          className: "p-2 hover:bg-gray-700 rounded-lg transition-colors",
          children: "← Anterior"
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1009,
          columnNumber: 13
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("h2", { className: "text-xl font-bold capitalize", children: format(currentMonth, "MMMM yyyy", { locale: ptBR }) }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1016,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setCurrentMonth(addMonths(currentMonth, 1)),
          className: "p-2 hover:bg-gray-700 rounded-lg transition-colors",
          children: "Próximo →"
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1020,
          columnNumber: 13
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1008,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1007,
      columnNumber: 9
    }, this),
    monthReferences || monthImages.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "mb-6 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-4 no-print", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-start justify-between mb-2", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "text-xl", children: "📎" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1034,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("h3", { className: "text-sm font-semibold text-purple-300", children: "Referências do Mês" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1035,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1033,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setShowMonthReferencesModal(true),
            className: "text-xs text-blue-400 hover:text-blue-300 transition-colors",
            children: "✏️ Editar"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1037,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1032,
        columnNumber: 13
      }, this),
      monthReferences && /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-gray-300 whitespace-pre-wrap mb-3", children: monthReferences }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1047,
        columnNumber: 11
      }, this),
      monthImages.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "flex gap-2 overflow-x-auto pb-2 custom-scrollbar", children: monthImages.map(
        (url, i) => /* @__PURE__ */ jsxDEV("div", { className: "flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 cursor-pointer hover:border-purple-500 transition-colors", children: /* @__PURE__ */ jsxDEV("a", { href: url, target: "_blank", rel: "noopener noreferrer", children: /* @__PURE__ */ jsxDEV("img", { src: url, alt: `Ref ${i}`, className: "w-full h-full object-cover" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1058,
          columnNumber: 23
        }, this) }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1057,
          columnNumber: 21
        }, this) }, i, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1056,
          columnNumber: 13
        }, this)
      ) }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1054,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1031,
      columnNumber: 9
    }, this) : /* @__PURE__ */ jsxDEV("div", { className: "mb-6 bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 no-print", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 text-gray-500", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "text-xl", children: "📎" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1069,
          columnNumber: 17
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "text-sm", children: "Nenhuma referência para este mês" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1070,
          columnNumber: 17
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1068,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setShowMonthReferencesModal(true),
          className: "text-xs text-blue-400 hover:text-blue-300 transition-colors",
          children: "+ Adicionar Referências"
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1072,
          columnNumber: 15
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1067,
      columnNumber: 13
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1066,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "mb-4 flex flex-wrap gap-4 text-xs md:text-sm no-print", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-3 h-3 rounded-full bg-yellow-500" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1085,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400", children: "Sugerido" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1086,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1084,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-3 h-3 rounded-full bg-green-500" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1089,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400", children: "Aprovado" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1090,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1088,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-3 h-3 rounded-full bg-blue-500" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1093,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400", children: "Publicado" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1094,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1092,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1083,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV(DragDropContext, { onDragEnd, children: /* @__PURE__ */ jsxDEV("div", { className: "print-calendar", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-7 bg-gray-800", children: WEEKDAYS.map(
        (day) => /* @__PURE__ */ jsxDEV(
          "div",
          {
            className: "p-2 md:p-3 text-center text-xs md:text-sm font-semibold text-gray-400 border-b border-gray-700",
            children: day
          },
          day,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1105,
            columnNumber: 17
          },
          this
        )
      ) }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1103,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-7", children: [
        emptyDays.map(
          (_, index) => /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "min-h-[100px] md:min-h-[140px] bg-gray-900/50 border-b border-r border-gray-700/50"
            },
            `empty-${index}`,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1118,
              columnNumber: 17
            },
            this
          )
        ),
        daysInMonth.map((day) => {
          const dayStr = format(day, "dd/MM");
          const dayPosts = getPostsForDay(dayStr);
          const isCurrentDay = isToday(day);
          return /* @__PURE__ */ jsxDEV(Droppable, { droppableId: dayStr, children: (provided, snapshot) => /* @__PURE__ */ jsxDEV(
            "div",
            {
              ref: provided.innerRef,
              ...provided.droppableProps,
              className: `min-h-[100px] md:min-h-[140px] p-1 md:p-2 border-b border-r border-gray-700/50 transition-colors ${snapshot.isDraggingOver ? "bg-blue-500/20" : ""} ${isCurrentDay ? "bg-blue-900/20" : ""}`,
              children: [
                /* @__PURE__ */ jsxDEV("div", { className: `text-xs md:text-sm font-semibold mb-1 ${isCurrentDay ? "text-blue-400" : "text-gray-400"}`, children: format(day, "d") }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1140,
                  columnNumber: 27
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: dayPosts.map(
                  ({ post, index }, i) => /* @__PURE__ */ jsxDEV(
                    Draggable,
                    {
                      draggableId: `post-${index}`,
                      index: i,
                      children: (provided2, snapshot2) => /* @__PURE__ */ jsxDEV(
                        "div",
                        {
                          ref: provided2.innerRef,
                          ...provided2.draggableProps,
                          ...provided2.dragHandleProps,
                          onClick: () => openEditModal(post, index),
                          className: `p-1.5 md:p-2 rounded-md border-l-4 cursor-pointer transition-all text-xs ${getStatusColor(post.status)} ${snapshot2.isDragging ? "shadow-lg scale-105 opacity-90" : "hover:scale-[1.02]"}`,
                          children: [
                            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1 mb-0.5", children: [
                              /* @__PURE__ */ jsxDEV("span", { className: "text-sm", children: getFormatIcon(post.formato) }, void 0, false, {
                                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                                lineNumber: 1164,
                                columnNumber: 39
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { className: "font-medium truncate text-[10px] md:text-xs", children: post.formato }, void 0, false, {
                                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                                lineNumber: 1165,
                                columnNumber: 39
                              }, this)
                            ] }, void 0, true, {
                              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                              lineNumber: 1163,
                              columnNumber: 37
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-1", children: [
                              /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] md:text-xs text-gray-300 truncate flex-1", children: post.tema }, void 0, false, {
                                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                                lineNumber: 1170,
                                columnNumber: 39
                              }, this),
                              post.referencias && /* @__PURE__ */ jsxDEV("span", { className: "text-xs", title: "Tem referências", children: "📎" }, void 0, false, {
                                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                                lineNumber: 1174,
                                columnNumber: 33
                              }, this)
                            ] }, void 0, true, {
                              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                              lineNumber: 1169,
                              columnNumber: 37
                            }, this)
                          ]
                        },
                        void 0,
                        true,
                        {
                          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                          lineNumber: 1154,
                          columnNumber: 29
                        },
                        this
                      )
                    },
                    `post-${index}`,
                    false,
                    {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 1148,
                      columnNumber: 27
                    },
                    this
                  )
                ) }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1146,
                  columnNumber: 27
                }, this),
                provided.placeholder
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1133,
              columnNumber: 23
            },
            this
          ) }, dayStr, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1131,
            columnNumber: 21
          }, this);
        })
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1115,
        columnNumber: 15
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1101,
      columnNumber: 13
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1100,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1099,
      columnNumber: 9
    }, this),
    showGenerateModal && /* @__PURE__ */ jsxDEV(
      GenerateModal,
      {
        mix,
        setMix,
        briefing,
        setBriefing,
        generationPrompt,
        setGenerationPrompt,
        periodoDias,
        setPeriodoDias,
        baseMonthDate: currentMonth,
        specificMonths,
        setSpecificMonths,
        formatInstructions,
        setFormatInstructions,
        promptChains,
        selectedChainId,
        setSelectedChainId,
        isGenerating,
        onGenerate: generateCalendar,
        onClose: () => setShowGenerateModal(false)
      },
      void 0,
      false,
      {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1195,
        columnNumber: 9
      },
      this
    ),
    isJobModalOpen && pendingJobId && clientId && /* @__PURE__ */ jsxDEV(
      CalendarGenerationProgressModal,
      {
        jobId: pendingJobId,
        clientId,
        status: jobStatus,
        progress: jobProgress,
        stepDescription: jobStepDescription,
        pollingError: jobPollingError,
        isPolling: jobIsPolling,
        onClose: handleJobClose,
        onSuccess: handleJobSuccess
      },
      void 0,
      false,
      {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1220,
        columnNumber: 9
      },
      this
    ),
    showExportModal && calendar && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-start justify-between gap-4 mb-4", children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-xl font-bold text-white", children: "📊 Exportar Excel" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1238,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mt-1", children: "Selecione os meses que deseja incluir na exportação" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1239,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1237,
          columnNumber: 17
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setShowExportModal(false),
            className: "text-gray-400 hover:text-white transition-colors",
            title: "Fechar",
            children: "✕"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1243,
            columnNumber: 17
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1236,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-4 mb-5", children: getExportMonthOptions(calendar).length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-gray-300 bg-gray-900/50 border border-gray-700 rounded-lg p-4 text-center", children: "⚠️ Nenhum mês detectado (posts sem data em formato reconhecível)." }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1254,
        columnNumber: 15
      }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                const allMonths = getExportMonthOptions(calendar);
                setExportMonthsSelected(allMonths);
              },
              className: "text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors",
              children: "✓ Selecionar Todos"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1260,
              columnNumber: 23
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setExportMonthsSelected([]),
              className: "text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors",
              children: "✕ Limpar Seleção"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1269,
              columnNumber: 23
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1259,
          columnNumber: 21
        }, this),
        (() => {
          const isTri = Number(calendar.periodo) >= 90 || Number(calendar.periodo) === 3;
          if (!isTri) return null;
          const baseMonth = parseMonthLabelToNumber(calendar.mes) || currentMonth.getMonth() + 1;
          const m1 = baseMonth;
          const m2 = baseMonth === 12 ? 1 : baseMonth + 1;
          const m3 = baseMonth >= 11 ? (baseMonth + 2) % 12 || 12 : baseMonth + 2;
          const triMonths = [m1, m2, m3].sort((a, b) => a - b);
          const isTriSelected = triMonths.every((m) => exportMonthsSelected.includes(m)) && exportMonthsSelected.length === 3;
          return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-2", children: /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                const options = getExportMonthOptions(calendar);
                const filtered = triMonths.filter((m) => options.includes(m));
                setExportMonthsSelected(filtered);
              },
              className: `text-xs px-3 py-1.5 rounded-lg transition-colors border ${isTriSelected ? "bg-blue-600 text-white border-blue-400" : "bg-gray-900/50 text-gray-300 border-gray-700 hover:border-blue-500/50 hover:bg-gray-900"}`,
              title: "Selecionar o trimestre do calendário",
              children: "Selecionar Trimestre"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1290,
              columnNumber: 27
            },
            this
          ) }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1289,
            columnNumber: 21
          }, this);
        })(),
        /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-3 gap-3", children: getExportMonthOptions(calendar).map((m) => {
          const checked = exportMonthsSelected.includes(m);
          return /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                if (checked) {
                  setExportMonthsSelected((prev) => prev.filter((x) => x !== m));
                } else {
                  setExportMonthsSelected((prev) => Array.from(/* @__PURE__ */ new Set([...prev, m])).sort((a, b) => a - b));
                }
              },
              className: `
                              relative px-4 py-3 rounded-lg font-medium transition-all text-sm
                              ${checked ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400" : "bg-gray-900/50 text-gray-300 border-2 border-gray-700 hover:border-blue-500/50 hover:bg-gray-900"}
                            `,
              children: [
                checked && /* @__PURE__ */ jsxDEV("span", { className: "absolute top-1 right-1 text-xs", children: "✓" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1330,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "text-center", children: getMonthName(m) }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1332,
                  columnNumber: 29
                }, this)
              ]
            },
            m,
            true,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1312,
              columnNumber: 23
            },
            this
          );
        }) }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1308,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-gray-400 text-center", children: exportMonthsSelected.length === 0 ? "Nenhum mês selecionado" : exportMonthsSelected.length === 1 ? `1 mês selecionado: ${getMonthName(exportMonthsSelected[0])}` : `${exportMonthsSelected.length} meses selecionados: ${exportMonthsSelected.map((m) => getMonthName(m)).join(", ")}` }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1339,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1258,
        columnNumber: 15
      }, this) }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1252,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end gap-3", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setShowExportModal(false),
            className: "px-4 py-2 text-gray-400 hover:text-white transition-colors",
            disabled: isGenerating,
            children: "Cancelar"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1353,
            columnNumber: 17
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleExportExcel,
            disabled: isGenerating || exportMonthsSelected.length === 0,
            className: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 px-5 py-2 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 flex items-center gap-2",
            children: isGenerating ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("span", { className: "animate-spin", children: "⏳" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1367,
                columnNumber: 23
              }, this),
              "Gerando..."
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1366,
              columnNumber: 17
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: "📊 Exportar Excel" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1371,
              columnNumber: 17
            }, this)
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1360,
            columnNumber: 17
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1352,
        columnNumber: 15
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1235,
      columnNumber: 13
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1234,
      columnNumber: 9
    }, this),
    selectedPost && /* @__PURE__ */ jsxDEV(
      EditModal,
      {
        editTema,
        setEditTema,
        editCopy,
        setEditCopy,
        editData,
        setEditData,
        editFormato,
        setEditFormato,
        editIdeiaVisual,
        setEditIdeiaVisual,
        editObjetivo,
        setEditObjetivo,
        editImagePrompt,
        setEditImagePrompt,
        editReferencias,
        setEditReferencias,
        editStatus,
        setEditStatus,
        regenPostPrompt,
        setRegenPostPrompt,
        isRegeneratingPost,
        onRegeneratePost: regeneratePostWithAI,
        isDeletingPost,
        onDeletePost: deletePost,
        onSave: savePost,
        onClose: closeEditModal
      },
      void 0,
      false,
      {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1383,
        columnNumber: 9
      },
      this
    ),
    showGenerateModal && /* @__PURE__ */ jsxDEV(
      GenerateModal,
      {
        mix,
        setMix,
        briefing,
        setBriefing,
        generationPrompt,
        setGenerationPrompt,
        periodoDias,
        setPeriodoDias,
        baseMonthDate: currentMonth,
        specificMonths,
        setSpecificMonths,
        formatInstructions,
        setFormatInstructions,
        promptChains,
        selectedChainId,
        setSelectedChainId,
        isGenerating,
        onGenerate: generateCalendar,
        onClose: () => setShowGenerateModal(false)
      },
      void 0,
      false,
      {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1415,
        columnNumber: 9
      },
      this
    ),
    showMonthReferencesModal && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto", children: [
      /* @__PURE__ */ jsxDEV("h3", { className: "text-xl font-bold text-white mb-4 flex items-center gap-2", children: "📎 Referências do Mês" }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1442,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-2", children: "Anotações e Links" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1449,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV(
            "textarea",
            {
              value: monthReferences,
              onChange: (e) => setMonthReferences(e.target.value),
              className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 min-h-[150px] text-sm text-gray-200",
              placeholder: "Ex:\r\n- Campanha de Dia das Mães: foco em presentes emocionais\r\n- Usar paleta de cores da coleção Outono\r\n- Link da pasta de fotos novas: drive.google.com/..."
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1450,
              columnNumber: 19
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1448,
          columnNumber: 17
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-2", children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400", children: "Galeria Visual (Moodboard)" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1464,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("label", { className: "text-xs text-purple-400 hover:text-purple-300 cursor-pointer flex items-center gap-1", children: [
              "+ Adicionar Fotos",
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "file",
                  multiple: true,
                  accept: "image/*",
                  className: "hidden",
                  onChange: async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    try {
                      const newImages = [...monthImages];
                      for (let i = 0; i < files.length; i++) {
                        const formData = new FormData();
                        formData.append("file", files[i]);
                        const res = await api.post("/knowledge/assets", formData, {
                          headers: { "Content-Type": "multipart/form-data" }
                        });
                        newImages.push(res.data.url);
                      }
                      setMonthImages(newImages);
                    } catch (err) {
                      console.error("Erro no upload:", err);
                      alert("Erro ao fazer upload de imagens");
                    }
                  }
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1467,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1465,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1463,
            columnNumber: 19
          }, this),
          monthImages.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-3 sm:grid-cols-4 gap-2", children: monthImages.map(
            (imgUrl, idx) => /* @__PURE__ */ jsxDEV("div", { className: "relative group aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700", children: [
              /* @__PURE__ */ jsxDEV(
                "img",
                {
                  src: imgUrl,
                  alt: `Ref ${idx}`,
                  className: "w-full h-full object-cover"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1501,
                  columnNumber: 27
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => {
                    const newImages = monthImages.filter((_, i) => i !== idx);
                    setMonthImages(newImages);
                  },
                  className: "absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity",
                  title: "Remover",
                  children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "sr-only", children: "Remover" }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 1514,
                      columnNumber: 29
                    }, this),
                    "❌"
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1506,
                  columnNumber: 27
                },
                this
              )
            ] }, idx, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1500,
              columnNumber: 19
            }, this)
          ) }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1498,
            columnNumber: 17
          }, this) : /* @__PURE__ */ jsxDEV("div", { className: "border-2 border-dashed border-gray-700 rounded-lg p-4 text-center text-gray-500 text-xs", children: "Nenhuma imagem adicionada." }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1521,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1462,
          columnNumber: 17
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1446,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end gap-3 mt-6", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setShowMonthReferencesModal(false),
            className: "px-4 py-2 text-gray-400 hover:text-white transition-colors",
            children: "Cancelar"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1529,
            columnNumber: 17
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: async () => {
              try {
                await api.put(`/calendars/${calendar.id}/metadata`, {
                  month_references: monthReferences,
                  month_images: monthImages
                });
                setShowMonthReferencesModal(false);
                alert("✅ Referências salvas com sucesso!");
              } catch (error) {
                console.error("Erro ao salvar referências:", error);
                alert("❌ Erro ao salvar referências");
              }
            },
            className: "bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition-colors text-white",
            children: "Salvar"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1535,
            columnNumber: 17
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1528,
        columnNumber: 15
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1441,
      columnNumber: 13
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1440,
      columnNumber: 9
    }, this),
    pendingJobId && clientId && /* @__PURE__ */ jsxDEV(
      CalendarGenerationProgressModal,
      {
        jobId: pendingJobId,
        clientId,
        onClose: handleJobClose,
        onSuccess: handleJobSuccess
      },
      void 0,
      false,
      {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1559,
        columnNumber: 9
      },
      this
    )
  ] }, void 0, true, {
    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
    lineNumber: 957,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
    lineNumber: 956,
    columnNumber: 5
  }, this);
}
_s(CalendarPage, "rZwVWuz/QJy2oPVQBjbo1DdupDg=", false, function() {
  return [useParams, useJobPolling];
});
_c = CalendarPage;
function EditModal({
  editTema,
  setEditTema,
  editCopy,
  setEditCopy,
  editData,
  setEditData,
  editFormato,
  setEditFormato,
  editIdeiaVisual,
  setEditIdeiaVisual,
  editObjetivo,
  setEditObjetivo,
  editImagePrompt,
  setEditImagePrompt,
  editReferencias,
  setEditReferencias,
  editStatus,
  setEditStatus,
  regenPostPrompt,
  setRegenPostPrompt,
  isRegeneratingPost,
  onRegeneratePost,
  isDeletingPost,
  onDeletePost,
  onSave,
  onClose
}) {
  _s2();
  const [showAdvancedIA, setShowAdvancedIA] = useState(false);
  console.log("🎨 EditModal renderizado com dados:", {
    editTema,
    editData,
    editFormato,
    editImagePrompt: editImagePrompt?.substring(0, 50) + "..."
  });
  try {
    return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-xl p-6 w-full max-w-3xl border border-gray-700 mt-8 max-h-[90vh] overflow-y-auto", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-6", children: [
        /* @__PURE__ */ jsxDEV("h2", { className: "text-2xl font-bold", children: "✏️ Editar Post" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1628,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: onClose, className: "text-gray-400 hover:text-white text-2xl", children: "×" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1629,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1627,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-4 mb-6", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxDEV("h3", { className: "text-sm font-semibold text-gray-200", children: "📌 Informações do Post" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1636,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1635,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Data (DD/MM)" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1640,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "text",
                  value: editData,
                  onChange: (e) => setEditData(e.target.value),
                  placeholder: "Ex: 15/01",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1641,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1639,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Formato" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1650,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                "select",
                {
                  value: editFormato,
                  onChange: (e) => setEditFormato(e.target.value),
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500",
                  children: [
                    /* @__PURE__ */ jsxDEV("option", { value: "Reels", children: "🎬 Reels" }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 1656,
                      columnNumber: 21
                    }, this),
                    /* @__PURE__ */ jsxDEV("option", { value: "Carrossel", children: "📸 Carrossel" }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 1657,
                      columnNumber: 21
                    }, this),
                    /* @__PURE__ */ jsxDEV("option", { value: "Static", children: "🖼️ Static" }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 1658,
                      columnNumber: 21
                    }, this),
                    /* @__PURE__ */ jsxDEV("option", { value: "Stories", children: "📱 Stories" }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 1659,
                      columnNumber: 21
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1651,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1649,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1638,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Tema" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1666,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "text",
                value: editTema,
                onChange: (e) => setEditTema(e.target.value),
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1667,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1665,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1664,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Status" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1678,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: editStatus,
                onChange: (e) => setEditStatus(e.target.value),
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500",
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "sugerido", children: "⏳ Sugerido" }, void 0, false, {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 1684,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "aprovado", children: "✅ Aprovado" }, void 0, false, {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 1685,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "publicado", children: "🚀 Publicado" }, void 0, false, {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 1686,
                    columnNumber: 21
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1679,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1677,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1676,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1634,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxDEV("h3", { className: "text-sm font-semibold text-gray-200", children: "✍️ Conteúdo" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1695,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1694,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Legenda" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1698,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "textarea",
              {
                value: editCopy,
                onChange: (e) => setEditCopy(e.target.value),
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 min-h-[110px]"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1699,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1697,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Objetivo" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1706,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "text",
                value: editObjetivo,
                onChange: (e) => setEditObjetivo(e.target.value),
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1707,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1705,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Ideia visual" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1715,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "textarea",
              {
                value: editIdeiaVisual,
                onChange: (e) => setEditIdeiaVisual(e.target.value),
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1716,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1714,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Referências (links, fotos, notas)" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1723,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "textarea",
              {
                value: editReferencias,
                onChange: (e) => setEditReferencias(e.target.value),
                placeholder: "Cole aqui links de posts, referências visuais ou anotações para este conteúdo.",
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 min-h-[80px]"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1724,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1722,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1693,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              type: "button",
              onClick: () => setShowAdvancedIA(!showAdvancedIA),
              className: "w-full flex items-center justify-between text-left",
              children: [
                /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-semibold text-gray-200 flex items-center gap-2", children: [
                  "🎨 Criativo & IA",
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-gray-500 font-normal", children: "(opcional)" }, void 0, false, {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 1742,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1740,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: showAdvancedIA ? "Esconder" : "Mostrar" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1744,
                  columnNumber: 17
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1735,
              columnNumber: 15
            },
            this
          ),
          showAdvancedIA && /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 pt-1", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400", children: "Prompt de imagem (IA)" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1753,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    onClick: () => {
                      navigator.clipboard.writeText(editImagePrompt);
                      alert("Prompt copiado para a área de transferência!");
                    },
                    className: "text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1",
                    title: "Copiar prompt",
                    children: "📋 Copiar"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 1754,
                    columnNumber: 23
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1752,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  value: editImagePrompt,
                  onChange: (e) => setEditImagePrompt(e.target.value),
                  placeholder: "Prompt técnico para Midjourney, DALL-E, etc.",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 min-h-[90px] font-mono"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1765,
                  columnNumber: 21
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-[11px] text-gray-500", children: "Ajuste este prompt antes de usar em ferramentas de IA generativa." }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1771,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1751,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400", children: "Prompt para regenerar este post com IA" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1777,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  value: regenPostPrompt,
                  onChange: (e) => setRegenPostPrompt(e.target.value),
                  placeholder: "Explique como a IA deve adaptar este post ao novo formato (foco, tom, tipo de conteúdo, etc.).",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 min-h-[90px]"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1778,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1776,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1750,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1734,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1632,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col md:flex-row gap-3", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: onRegeneratePost,
              disabled: isRegeneratingPost,
              className: "flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-60 py-3 rounded-lg font-medium transition-colors",
              children: isRegeneratingPost ? "🔁 Regenerando com IA..." : "🔁 Regenerar Post com IA"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1792,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: onSave,
              className: "flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium transition-colors",
              children: "💾 Salvar Alterações"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1799,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1791,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col md:flex-row gap-3", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: onClose,
              className: "flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors",
              children: "Cancelar"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1807,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: onDeletePost,
              disabled: isDeletingPost,
              className: "flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-60 py-3 rounded-lg font-medium transition-colors",
              children: isDeletingPost ? "🗑️ Excluindo Post..." : "🗑️ Excluir Post"
            },
            void 0,
            false,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1813,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1806,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1790,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1626,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1625,
      columnNumber: 7
    }, this);
  } catch (error) {
    console.error("❌ Erro no EditModal:", error);
    return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-red-800 rounded-xl p-6 border border-red-700", children: [
      /* @__PURE__ */ jsxDEV("h2", { className: "text-xl font-bold text-white mb-4", children: "❌ Erro no Modal" }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1830,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-red-200 mb-4", children: "Ocorreu um erro ao abrir o modal de edição." }, void 0, false, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1831,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: onClose,
          className: "bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium",
          children: "Fechar"
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1832,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1829,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1828,
      columnNumber: 7
    }, this);
  }
}
_s2(EditModal, "+g2vGwG9PXCMovaiU3CWs60w71Q=");
_c2 = EditModal;
function GenerateModal({
  mix,
  setMix,
  briefing,
  setBriefing,
  periodoDias,
  setPeriodoDias,
  baseMonthDate,
  specificMonths,
  setSpecificMonths,
  generationPrompt,
  setGenerationPrompt,
  formatInstructions,
  setFormatInstructions,
  promptChains,
  selectedChainId,
  setSelectedChainId,
  isGenerating,
  onGenerate,
  onClose
}) {
  _s3();
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [showFormatInstructions, setShowFormatInstructions] = useState(false);
  const monthsOptions = Array.from({ length: 12 }).map((_, i) => {
    const date = addMonths(baseMonthDate, i);
    return {
      date,
      monthLabel: format(date, "MMMM yyyy", { locale: ptBR }),
      monthName: format(date, "MMMM", { locale: ptBR }),
      year: format(date, "yyyy", { locale: ptBR })
    };
  });
  const selectedCount = specificMonths.length;
  return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-xl p-6 w-full max-w-3xl border border-gray-700 mt-8 max-h-[90vh] overflow-y-auto", children: [
    /* @__PURE__ */ jsxDEV("h2", { className: "text-2xl font-bold mb-6", children: "🚀 Gerar Calendário Editorial" }, void 0, false, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1899,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "space-y-6 mb-6", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-sm text-gray-400 mb-2", children: "Período" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1903,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "select",
          {
            value: String(periodoDias),
            onChange: (e) => setPeriodoDias(parseInt(e.target.value, 10)),
            className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500",
            children: [
              /* @__PURE__ */ jsxDEV("option", { value: "30", children: "Mensal (30 dias)" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1909,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("option", { value: "90", children: "Trimestral (90 dias)" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1910,
                columnNumber: 15
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1904,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1902,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-sm text-gray-400 mb-2", children: "Selecione os Meses para Gerar" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1915,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-2", children: monthsOptions.map(({ monthLabel, monthName, year }) => {
          const isSelected = specificMonths.includes(monthLabel);
          return /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                if (isSelected) {
                  setSpecificMonths(specificMonths.filter((m) => m !== monthLabel));
                } else {
                  const next = [...specificMonths, monthLabel];
                  const ordered = monthsOptions.map((o) => o.monthLabel).filter((label) => next.includes(label));
                  setSpecificMonths(ordered);
                }
              },
              className: `p-3 rounded-lg border text-left transition-all flex flex-col ${isSelected ? "bg-blue-600/20 border-blue-500 text-blue-100" : "bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-700"}`,
              children: [
                /* @__PURE__ */ jsxDEV("span", { className: "capitalize font-bold text-sm", children: monthName }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1939,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "text-xs opacity-70", children: year }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1940,
                  columnNumber: 21
                }, this),
                isSelected && /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] mt-1 text-blue-400", children: "Selected ✅" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1941,
                  columnNumber: 36
                }, this)
              ]
            },
            monthLabel,
            true,
            {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1921,
              columnNumber: 19
            },
            this
          );
        }) }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1916,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-2", children: "Selecione um ou mais meses. O sistema gerará um calendário individual para cada mês selecionado, mantendo o contexto." }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1946,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "mt-2 text-xs text-gray-400", children: [
          "Selecionados: ",
          /* @__PURE__ */ jsxDEV("span", { className: "text-gray-200 font-semibold", children: selectedCount || 0 }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1950,
            columnNumber: 29
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1949,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1914,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-sm text-gray-400 mb-2", children: "Mix de Conteúdo (por mês)" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1955,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mb-4", children: [
          "Defina quantos posts de cada tipo você deseja gerar ",
          /* @__PURE__ */ jsxDEV("strong", { children: "para cada mês selecionado" }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1957,
            columnNumber: 67
          }, this),
          "."
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1956,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(ContentMixSelector, { mix, onMixChange: setMix }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1959,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1954,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-sm text-gray-400 mb-2", children: "Briefing" }, void 0, false, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1963,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "textarea",
          {
            value: briefing,
            onChange: (e) => setBriefing(e.target.value),
            placeholder: "Descreva o objetivo, temas principais, campanhas, promoções...",
            className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 min-h-[120px]"
          },
          void 0,
          false,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1964,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1962,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            onClick: () => setShowFormatInstructions(!showFormatInstructions),
            className: "w-full flex items-center justify-between text-left",
            children: [
              /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-semibold text-gray-200 flex items-center gap-2", children: [
                "🎯 Personalizar cada formato",
                /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-gray-500 font-normal", children: "(opcional)" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1981,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1979,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: showFormatInstructions ? "Esconder" : "Mostrar" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1983,
                columnNumber: 15
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1974,
            columnNumber: 13
          },
          this
        ),
        showFormatInstructions && /* @__PURE__ */ jsxDEV(Fragment, { children: [
          /* @__PURE__ */ jsxDEV("p", { className: "text-[11px] text-gray-500 pt-1", children: "Use estes campos para dar instruções específicas para cada tipo de conteúdo. Elas serão combinadas ao DNA da marca e ao briefing." }, void 0, false, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1990,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 text-xs", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-[11px] text-gray-400", children: "Reels" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 1996,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  value: formatInstructions.reels,
                  onChange: (e) => setFormatInstructions({ ...formatInstructions, reels: e.target.value }),
                  placeholder: "Ex.: Reels mais dinâmicos, com cortes rápidos e CTA forte nos 3s finais.",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 1997,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 1995,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-[11px] text-gray-400", children: "Posts estáticos" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2005,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  value: formatInstructions.static,
                  onChange: (e) => setFormatInstructions({ ...formatInstructions, static: e.target.value }),
                  placeholder: "Ex.: Layout minimalista, foco em tipografia e uma ideia central por peça.",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 2006,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2004,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-[11px] text-gray-400", children: "Carrosséis" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2014,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  value: formatInstructions.carousel,
                  onChange: (e) => setFormatInstructions({ ...formatInstructions, carousel: e.target.value }),
                  placeholder: "Ex.: Conteúdos educativos em 5-7 cards, com passo-a-passo e CTA no final.",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 2015,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2013,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-[11px] text-gray-400", children: "Stories" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2023,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "textarea",
                {
                  value: formatInstructions.stories,
                  onChange: (e) => setFormatInstructions({ ...formatInstructions, stories: e.target.value }),
                  placeholder: "Ex.: Sequências curtas, bastidores e enquetes para engajamento diário.",
                  className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[70px]"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 2024,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2022,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 1994,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 1989,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 1973,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            onClick: () => setShowAdvancedPrompt(!showAdvancedPrompt),
            className: "w-full flex items-center justify-between text-left",
            children: [
              /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-semibold text-gray-200 flex items-center gap-2", children: [
                "🧠 Inteligência & Prompts",
                /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-gray-500 font-normal", children: "(opcional)" }, void 0, false, {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 2044,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2042,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: showAdvancedPrompt ? "Esconder" : "Mostrar" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2046,
                columnNumber: 15
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 2037,
            columnNumber: 13
          },
          this
        ),
        showAdvancedPrompt && /* @__PURE__ */ jsxDEV("div", { className: "pt-1 space-y-4", children: [
          promptChains.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "space-y-2 pb-4 border-b border-gray-700", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsxDEV("label", { className: "block text-xs font-semibold text-gray-300", children: "⛓️ Prompt Chain" }, void 0, false, {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2057,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "a",
                {
                  href: "#",
                  onClick: (e) => {
                    e.preventDefault();
                    alert("💡 Dica: Prompt Chains executam múltiplos passos de raciocínio antes de gerar o calendário.\n\nUse quando:\n✅ Quer análise estratégica profunda\n✅ Nicho específico (nutrição, advocacia, etc.)\n✅ Lançamentos ou campanhas complexas\n\nNão use quando:\n❌ Precisa de velocidade\n❌ Briefing já é muito detalhado");
                  },
                  className: "text-[10px] text-blue-400 hover:text-blue-300",
                  children: "ℹ️ Quando usar?"
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 2058,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2056,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxDEV(
                "div",
                {
                  onClick: () => setSelectedChainId(""),
                  className: `p-2.5 rounded-lg border cursor-pointer transition-all ${selectedChainId === "" ? "border-blue-500 bg-blue-500/10" : "border-gray-600 bg-gray-700/50 hover:border-gray-500"}`,
                  children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: `w-3.5 h-3.5 rounded-full border flex items-center justify-center ${selectedChainId === "" ? "border-blue-500" : "border-gray-500"}`, children: selectedChainId === "" && /* @__PURE__ */ jsxDEV("div", { className: "w-1.5 h-1.5 rounded-full bg-blue-500" }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 2082,
                      columnNumber: 56
                    }, this) }, void 0, false, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 2080,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-semibold text-white", children: "Geração Padrão" }, void 0, false, {
                        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                        lineNumber: 2085,
                        columnNumber: 29
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] text-gray-400", children: "Rápido e direto (Briefing + DNA)" }, void 0, false, {
                        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                        lineNumber: 2086,
                        columnNumber: 29
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 2084,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 2079,
                    columnNumber: 25
                  }, this)
                },
                void 0,
                false,
                {
                  fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                  lineNumber: 2072,
                  columnNumber: 23
                },
                this
              ),
              promptChains.map(
                (chain) => /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    onClick: () => setSelectedChainId(chain.id),
                    className: `p-2.5 rounded-lg border cursor-pointer transition-all ${selectedChainId === chain.id ? "border-purple-500 bg-purple-500/10" : "border-gray-600 bg-gray-700/50 hover:border-gray-500"}`,
                    children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-start gap-2", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: `w-3.5 h-3.5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 ${selectedChainId === chain.id ? "border-purple-500" : "border-gray-500"}`, children: selectedChainId === chain.id && /* @__PURE__ */ jsxDEV("div", { className: "w-1.5 h-1.5 rounded-full bg-purple-500" }, void 0, false, {
                        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                        lineNumber: 2103,
                        columnNumber: 64
                      }, this) }, void 0, false, {
                        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                        lineNumber: 2101,
                        columnNumber: 29
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "flex-1 min-w-0", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-semibold text-white flex items-center gap-2", children: [
                          chain.nome,
                          /* @__PURE__ */ jsxDEV("span", { className: "text-[9px] px-1.5 py-px bg-purple-500/20 text-purple-300 rounded-full", children: [
                            chain.steps?.length || 0,
                            " steps"
                          ] }, void 0, true, {
                            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                            lineNumber: 2108,
                            columnNumber: 33
                          }, this)
                        ] }, void 0, true, {
                          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                          lineNumber: 2106,
                          columnNumber: 31
                        }, this),
                        chain.descricao && /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] text-gray-400 mt-0.5 truncate", children: chain.descricao }, void 0, false, {
                          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                          lineNumber: 2113,
                          columnNumber: 25
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                        lineNumber: 2105,
                        columnNumber: 29
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                      lineNumber: 2100,
                      columnNumber: 27
                    }, this)
                  },
                  chain.id,
                  false,
                  {
                    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                    lineNumber: 2092,
                    columnNumber: 19
                  },
                  this
                )
              )
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2071,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 2055,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-xs text-gray-400 mb-1", children: "Prompt avançado para IA" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2124,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-[11px] text-gray-500", children: "Este texto será combinado automaticamente com o DNA da marca salvo no sistema (branding, regras, documentos e personas) e com o briefing acima. Use este campo para dar instruções extras específicas desta geração (foco, campanhas, temas a priorizar ou evitar, tom mais detalhado, etc.)." }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2125,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "textarea",
              {
                value: generationPrompt,
                onChange: (e) => setGenerationPrompt(e.target.value),
                placeholder: "Ex.: Priorizar conteúdos de autoridade para lançamento do novo produto, evitar assuntos sensíveis X e Y, reforçar provas sociais em pelo menos 30% dos posts, etc.",
                className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 min-h-[110px] text-sm"
              },
              void 0,
              false,
              {
                fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
                lineNumber: 2131,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 2123,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 2052,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
        lineNumber: 2036,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 1901,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex gap-3", children: [
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: onClose,
          className: "flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors",
          children: "Cancelar"
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 2144,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: onGenerate,
          disabled: isGenerating,
          className: "flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          children: isGenerating ? /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center gap-1", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-base", children: [
              "⏳ Gerando ",
              selectedCount > 1 ? `${selectedCount} meses` : "calendário",
              "..."
            ] }, void 0, true, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2157,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-blue-200 opacity-80", children: selectedCount > 1 ? `Isso pode levar ${Math.ceil(selectedCount * 1.5)}-${Math.ceil(selectedCount * 3)} minutos` : "Aguarde alguns instantes" }, void 0, false, {
              fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
              lineNumber: 2158,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
            lineNumber: 2156,
            columnNumber: 13
          }, this) : "🚀 Gerar Calendário"
        },
        void 0,
        false,
        {
          fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
          lineNumber: 2150,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
      lineNumber: 2143,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
    lineNumber: 1898,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx",
    lineNumber: 1897,
    columnNumber: 5
  }, this);
}
_s3(GenerateModal, "Nz3R2NLg+/UZLFPfH5fM0JDIEPY=");
_c3 = GenerateModal;
var _c, _c2, _c3;
$RefreshReg$(_c, "CalendarPage");
$RefreshReg$(_c2, "EditModal");
$RefreshReg$(_c3, "GenerateModal");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/repos/Sphera_Brand/frontend/src/pages/CalendarPage.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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S0FBQSIsIm5hbWVzIjpbInVzZVN0YXRlIiwidXNlRWZmZWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VQYXJhbXMiLCJEcmFnRHJvcENvbnRleHQiLCJEcm9wcGFibGUiLCJEcmFnZ2FibGUiLCJDb250ZW50TWl4U2VsZWN0b3IiLCJQaG90b0lkZWFzTW9kYWwiLCJKb2JQcm9ncmVzc1BhbmVsIiwiYXBpIiwiam9ic1NlcnZpY2UiLCJ1c2VKb2JQb2xsaW5nIiwiZm9ybWF0Iiwic3RhcnRPZk1vbnRoIiwiZW5kT2ZNb250aCIsImVhY2hEYXlPZkludGVydmFsIiwiaXNUb2RheSIsImFkZE1vbnRocyIsInN1Yk1vbnRocyIsImdldERheSIsInB0QlIiLCJXRUVLREFZUyIsIkNhbGVuZGFyUGFnZSIsIl9zIiwiY2xpZW50SWQiLCJjYWxlbmRhciIsInNldENhbGVuZGFyIiwiY2xpZW50TmFtZSIsInNldENsaWVudE5hbWUiLCJsb2FkaW5nIiwic2V0TG9hZGluZyIsImN1cnJlbnRNb250aCIsInNldEN1cnJlbnRNb250aCIsIkRhdGUiLCJzZWxlY3RlZFBvc3QiLCJzZXRTZWxlY3RlZFBvc3QiLCJpc0dlbmVyYXRpbmciLCJzZXRJc0dlbmVyYXRpbmciLCJzaG93R2VuZXJhdGVNb2RhbCIsInNldFNob3dHZW5lcmF0ZU1vZGFsIiwicGVyaW9kb0RpYXMiLCJzZXRQZXJpb2RvRGlhcyIsInNwZWNpZmljTW9udGhzIiwic2V0U3BlY2lmaWNNb250aHMiLCJpc1NhdmluZyIsInNldElzU2F2aW5nIiwiaXNEZWxldGluZyIsInNldElzRGVsZXRpbmciLCJpc0RlbGV0aW5nUG9zdCIsInNldElzRGVsZXRpbmdQb3N0IiwiaXNSZWdlbmVyYXRpbmdQb3N0Iiwic2V0SXNSZWdlbmVyYXRpbmdQb3N0Iiwic2hvd1Bob3RvSWRlYXNNb2RhbCIsInNldFNob3dQaG90b0lkZWFzTW9kYWwiLCJzaG93RXhwb3J0TW9kYWwiLCJzZXRTaG93RXhwb3J0TW9kYWwiLCJleHBvcnRNb250aHNTZWxlY3RlZCIsInNldEV4cG9ydE1vbnRoc1NlbGVjdGVkIiwicGVuZGluZ0pvYklkIiwic2V0UGVuZGluZ0pvYklkIiwiYnJpZWZpbmciLCJzZXRCcmllZmluZyIsImdlbmVyYXRpb25Qcm9tcHQiLCJzZXRHZW5lcmF0aW9uUHJvbXB0Iiwic2VsZWN0ZWRDaGFpbklkIiwic2V0U2VsZWN0ZWRDaGFpbklkIiwicHJvbXB0Q2hhaW5zIiwic2V0UHJvbXB0Q2hhaW5zIiwibWl4Iiwic2V0TWl4IiwicmVlbHMiLCJzdGF0aWMiLCJjYXJvdXNlbCIsInN0b3JpZXMiLCJwaG90b3MiLCJlZGl0VGVtYSIsInNldEVkaXRUZW1hIiwiZWRpdENvcHkiLCJzZXRFZGl0Q29weSIsImVkaXREYXRhIiwic2V0RWRpdERhdGEiLCJlZGl0Rm9ybWF0byIsInNldEVkaXRGb3JtYXRvIiwiZWRpdElkZWlhVmlzdWFsIiwic2V0RWRpdElkZWlhVmlzdWFsIiwiZWRpdEltYWdlUHJvbXB0Iiwic2V0RWRpdEltYWdlUHJvbXB0IiwiZWRpdE9iamV0aXZvIiwic2V0RWRpdE9iamV0aXZvIiwiZWRpdFJlZmVyZW5jaWFzIiwic2V0RWRpdFJlZmVyZW5jaWFzIiwiZWRpdFN0YXR1cyIsInNldEVkaXRTdGF0dXMiLCJyZWdlblBvc3RQcm9tcHQiLCJzZXRSZWdlblBvc3RQcm9tcHQiLCJjYXJvdXNlbFNsaWRlc0NvdW50Iiwic2V0Q2Fyb3VzZWxTbGlkZXNDb3VudCIsImZvcm1hdEluc3RydWN0aW9ucyIsInNldEZvcm1hdEluc3RydWN0aW9ucyIsIm1vbnRoUmVmZXJlbmNlcyIsInNldE1vbnRoUmVmZXJlbmNlcyIsIm1vbnRoSW1hZ2VzIiwic2V0TW9udGhJbWFnZXMiLCJzaG93TW9udGhSZWZlcmVuY2VzTW9kYWwiLCJzZXRTaG93TW9udGhSZWZlcmVuY2VzTW9kYWwiLCJsb2FkQ2FsZW5kYXIiLCJsb2FkUHJvbXB0Q2hhaW5zIiwibG9hZENsaWVudE5hbWUiLCJyZXNwb25zZSIsImdldCIsIm5hbWUiLCJkYXRhIiwiY2xpZW50ZSIsIm5vbWUiLCJlIiwic2F2ZWRKb2IiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiam9iSWQiLCJzYXZlZENsaWVudElkIiwiSlNPTiIsInBhcnNlIiwiY29uc29sZSIsImxvZyIsImdldEpvYlN0YXR1cyIsInRoZW4iLCJqb2IiLCJ0ZXJtaW5hbFN0YXR1c2VzIiwiaW5jbHVkZXMiLCJzdGF0dXMiLCJyZW1vdmVJdGVtIiwiY2F0Y2giLCJlcnJvciIsIm1vbnRoU3RyIiwibG9jYWxlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiY2FsZW5kYXJEYXRhIiwibWV0YWRhdGEiLCJtb250aF9yZWZlcmVuY2VzIiwibW9udGhfaW1hZ2VzIiwiQXJyYXkiLCJpc0FycmF5IiwicmF3UG9zdHMiLCJwb3N0cyIsIm1hcCIsInBvc3QiLCJuIiwidiIsInN0cmluZ2lmeSIsIlN0cmluZyIsInRlbWEiLCJmb3JtYXRvIiwiaWRlaWFfdmlzdWFsIiwiY29weV9zdWdlc3RhbyIsIm9iamV0aXZvIiwiaW1hZ2VfZ2VuZXJhdGlvbl9wcm9tcHQiLCJyZWZlcmVuY2lhcyIsImFsZXJ0IiwibWVzc2FnZSIsImhhbmRsZUpvYlN1Y2Nlc3NDYWxsYmFjayIsIl9yZXN1bHQiLCJoYW5kbGVKb2JFcnJvckNhbGxiYWNrIiwiZXJyTXNnIiwiaGFuZGxlSm9iQ2FuY2VsQ2FsbGJhY2siLCJqb2JTdGF0dXMiLCJwcm9ncmVzcyIsImpvYlByb2dyZXNzIiwic3RlcERlc2NyaXB0aW9uIiwiam9iU3RlcERlc2NyaXB0aW9uIiwiam9iUG9sbGluZ0Vycm9yIiwiaXNQb2xsaW5nIiwiam9iSXNQb2xsaW5nIiwiZW5hYmxlZCIsIm9uU3VjY2VzcyIsIm9uRXJyb3IiLCJvbkNhbmNlbCIsImhhbmRsZUpvYkNhbmNlbEJ0biIsImNhbmNlbEpvYiIsImdlbmVyYXRlU2luZ2xlUG9zdFdpdGhBSSIsImNhbGVuZGFySWQiLCJpZCIsInBvc3RJbmRleCIsImluZGV4IiwiY3VzdG9tUHJvbXB0IiwibmV3UG9zdCIsInVwZGF0ZWRQb3N0cyIsImhhbmRsZUV4cG9ydEV4Y2VsIiwiZG93bmxvYWRDbGllbnROYW1lIiwic3VmZml4IiwiZ2V0RXhjZWxGaWxlbmFtZVN1ZmZpeCIsInNhZmVNb250aCIsIm1lcyIsInJlcGxhY2UiLCJtb250aHNTZWxlY3RlZCIsInJlc3BvbnNlVHlwZSIsInVybCIsIndpbmRvdyIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIkJsb2IiLCJsaW5rIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiaHJlZiIsInNldEF0dHJpYnV0ZSIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmVtb3ZlIiwicmV2b2tlT2JqZWN0VVJMIiwiZXJyIiwiZGV0ZWN0TW9udGhzRnJvbUNhbGVuZGFyIiwiY2FsIiwiZXh0cmFjdE1vbnRoTnVtRnJvbURhdGVTdHIiLCJ2YWx1ZSIsInMiLCJ0cmltIiwibSIsIm1hdGNoIiwibW9udGhOdW0iLCJwYXJzZUludCIsImlzTmFOIiwibW9udGhzIiwiU2V0IiwicCIsImRhdGVTdHIiLCJhZGQiLCJmcm9tIiwic29ydCIsImEiLCJiIiwiZ2V0TW9udGhOYW1lIiwibW9udGhOYW1lcyIsIm5vcm1hbGl6ZWQiLCJmaWx0ZXIiLCJ5ZWFyTWF0Y2giLCJ5ZWFyU3RyIiwibGVuZ3RoIiwic3RhcnQiLCJlbmQiLCJwYXJzZU1vbnRoTGFiZWxUb051bWJlciIsImxhYmVsIiwidG9Mb3dlckNhc2UiLCJ0b2tlbiIsInNwbGl0IiwiamFuZWlybyIsImZldmVyZWlybyIsIm1hcmNvIiwiYWJyaWwiLCJtYWlvIiwianVuaG8iLCJqdWxobyIsImFnb3N0byIsInNldGVtYnJvIiwib3V0dWJybyIsIm5vdmVtYnJvIiwiZGV6ZW1icm8iLCJvcGVuRXhwb3J0TW9kYWwiLCJiYXNlTW9udGgiLCJnZXRNb250aCIsImRlZmF1bHRTZWxlY3Rpb24iLCJtb250aHNPcHRpb25zIiwiZ2V0RXhwb3J0TW9udGhPcHRpb25zIiwidHJpTW9udGhzIiwiZGV0ZWN0ZWQiLCJvcGVuR2VuZXJhdGVNb2RhbCIsInJlZ2VuZXJhdGVQb3N0V2l0aEFJIiwicHV0IiwibmV3Rm9ybWF0byIsImRlbGV0ZUNhbGVuZGFyIiwiY29uZmlybURlbGV0ZSIsImNvbmZpcm0iLCJkZWxldGUiLCJnZW5lcmF0ZUNhbGVuZGFyIiwidG90YWxQb3N0cyIsIk9iamVjdCIsInZhbHVlcyIsInJlZHVjZSIsInN1bSIsImNvdW50IiwiY2xpZW50ZUlkIiwicGVyaW9kbyIsIm1vbnRoc0NvdW50IiwiY2hhaW5JZCIsInVuZGVmaW5lZCIsInNldEl0ZW0iLCJzYXZlQ2FsZW5kYXIiLCJvbkRyYWdFbmQiLCJyZXN1bHQiLCJkZXN0aW5hdGlvbiIsInNvdXJjZURheSIsInNvdXJjZSIsImRyb3BwYWJsZUlkIiwiZGVzdERheSIsImRyYWdnYWJsZUlkIiwib3BlbkVkaXRNb2RhbCIsImNsb3NlRWRpdE1vZGFsIiwic2F2ZVBvc3QiLCJkZWxldGVQb3N0IiwiXyIsImkiLCJnZXRGb3JtYXRJY29uIiwibG93ZXIiLCJnZXRTdGF0dXNDb2xvciIsImdldFBvc3RzRm9yRGF5IiwiZGF5U3RyIiwicG9zdERhdGUiLCJtb250aFN0YXJ0IiwibW9udGhFbmQiLCJkYXlzSW5Nb250aCIsInN0YXJ0RGF5T2ZXZWVrIiwiZW1wdHlEYXlzIiwiZmlsbCIsImRheSIsImRheVBvc3RzIiwiaXNDdXJyZW50RGF5IiwicHJvdmlkZWQiLCJzbmFwc2hvdCIsImlubmVyUmVmIiwiZHJvcHBhYmxlUHJvcHMiLCJpc0RyYWdnaW5nT3ZlciIsImRyYWdnYWJsZVByb3BzIiwiZHJhZ0hhbmRsZVByb3BzIiwiaXNEcmFnZ2luZyIsInBsYWNlaG9sZGVyIiwiaXNKb2JNb2RhbE9wZW4iLCJoYW5kbGVKb2JDbG9zZSIsImhhbmRsZUpvYlN1Y2Nlc3MiLCJhbGxNb250aHMiLCJpc1RyaSIsIk51bWJlciIsIm0xIiwibTIiLCJtMyIsImlzVHJpU2VsZWN0ZWQiLCJldmVyeSIsIm9wdGlvbnMiLCJmaWx0ZXJlZCIsImNoZWNrZWQiLCJwcmV2IiwieCIsImpvaW4iLCJ0YXJnZXQiLCJmaWxlcyIsIm5ld0ltYWdlcyIsImZvcm1EYXRhIiwiRm9ybURhdGEiLCJhcHBlbmQiLCJyZXMiLCJoZWFkZXJzIiwicHVzaCIsImltZ1VybCIsImlkeCIsIl9jIiwiRWRpdE1vZGFsIiwib25SZWdlbmVyYXRlUG9zdCIsIm9uRGVsZXRlUG9zdCIsIm9uU2F2ZSIsIm9uQ2xvc2UiLCJfczIiLCJzaG93QWR2YW5jZWRJQSIsInNldFNob3dBZHZhbmNlZElBIiwic3Vic3RyaW5nIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiX2MyIiwiR2VuZXJhdGVNb2RhbCIsImJhc2VNb250aERhdGUiLCJvbkdlbmVyYXRlIiwiX3MzIiwic2hvd0FkdmFuY2VkUHJvbXB0Iiwic2V0U2hvd0FkdmFuY2VkUHJvbXB0Iiwic2hvd0Zvcm1hdEluc3RydWN0aW9ucyIsInNldFNob3dGb3JtYXRJbnN0cnVjdGlvbnMiLCJkYXRlIiwibW9udGhMYWJlbCIsIm1vbnRoTmFtZSIsInllYXIiLCJzZWxlY3RlZENvdW50IiwiaXNTZWxlY3RlZCIsIm5leHQiLCJvcmRlcmVkIiwibyIsInByZXZlbnREZWZhdWx0IiwiY2hhaW4iLCJzdGVwcyIsImRlc2NyaWNhbyIsIk1hdGgiLCJjZWlsIiwiX2MzIiwiJFJlZnJlc2hSZWckIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkNhbGVuZGFyUGFnZS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlQ2FsbGJhY2sgfSBmcm9tICdyZWFjdCc7XHJcbmltcG9ydCB7IHVzZVBhcmFtcyB9IGZyb20gJ3JlYWN0LXJvdXRlci1kb20nO1xyXG5pbXBvcnQgeyBEcmFnRHJvcENvbnRleHQsIERyb3BwYWJsZSwgRHJhZ2dhYmxlLCBEcm9wUmVzdWx0IH0gZnJvbSAnQGhlbGxvLXBhbmdlYS9kbmQnO1xyXG5pbXBvcnQgQ29udGVudE1peFNlbGVjdG9yIGZyb20gJy4uL2NvbXBvbmVudHMvQ29udGVudE1peFNlbGVjdG9yJztcclxuaW1wb3J0IFBob3RvSWRlYXNNb2RhbCBmcm9tICcuLi9jb21wb25lbnRzL1Bob3RvSWRlYXNNb2RhbCc7XHJcbmltcG9ydCBKb2JQcm9ncmVzc1BhbmVsIGZyb20gJy4uL2NvbXBvbmVudHMvSm9icy9Kb2JQcm9ncmVzc1BhbmVsJztcclxuXHJcbmltcG9ydCBhcGksIHsgam9ic1NlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9hcGknO1xyXG5pbXBvcnQgeyB1c2VKb2JQb2xsaW5nIH0gZnJvbSAnLi4vaG9va3MvdXNlSm9iUG9sbGluZyc7XHJcbmltcG9ydCB7XHJcbiAgZm9ybWF0LFxyXG4gIHN0YXJ0T2ZNb250aCxcclxuICBlbmRPZk1vbnRoLFxyXG4gIGVhY2hEYXlPZkludGVydmFsLFxyXG4gIGlzVG9kYXksXHJcbiAgYWRkTW9udGhzLFxyXG4gIHN1Yk1vbnRocyxcclxuICBnZXREYXksXHJcbn0gZnJvbSAnZGF0ZS1mbnMnO1xyXG5pbXBvcnQgeyBwdEJSIH0gZnJvbSAnZGF0ZS1mbnMvbG9jYWxlJztcclxuXHJcbmludGVyZmFjZSBQb3N0IHtcclxuICBkYXRhOiBzdHJpbmc7XHJcbiAgdGVtYTogc3RyaW5nO1xyXG4gIGZvcm1hdG86IHN0cmluZztcclxuICBpZGVpYV92aXN1YWw6IHN0cmluZztcclxuICBjb3B5X3N1Z2VzdGFvOiBzdHJpbmc7XHJcbiAgb2JqZXRpdm86IHN0cmluZztcclxuICBpbWFnZV9nZW5lcmF0aW9uX3Byb21wdD86IHN0cmluZztcclxuICByZWZlcmVuY2lhcz86IHN0cmluZzsgLy8gbGlua3MsIGZvdG9zLCBub3RhcyBkZSByZWZlcsOqbmNpYVxyXG4gIHN0YXR1cz86ICdzdWdlcmlkbycgfCAnYXByb3ZhZG8nIHwgJ3B1YmxpY2Fkbyc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBDb250ZW50TWl4IHtcclxuICByZWVsczogbnVtYmVyO1xyXG4gIHN0YXRpYzogbnVtYmVyO1xyXG4gIGNhcm91c2VsOiBudW1iZXI7XHJcbiAgc3RvcmllczogbnVtYmVyO1xyXG4gIHBob3RvczogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRm9ybWF0SW5zdHJ1Y3Rpb25zIHtcclxuICByZWVsczogc3RyaW5nO1xyXG4gIHN0YXRpYzogc3RyaW5nO1xyXG4gIGNhcm91c2VsOiBzdHJpbmc7XHJcbiAgc3Rvcmllczogc3RyaW5nO1xyXG4gIHBob3Rvczogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgQ2FsZW5kYXIge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgY2xpZW50ZUlkOiBzdHJpbmc7XHJcbiAgbWVzOiBzdHJpbmc7XHJcbiAgcG9zdHM6IFBvc3RbXTtcclxuICBwZXJpb2RvOiBudW1iZXI7XHJcbiAgY3JpYWRvRW06IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgV0VFS0RBWVMgPSBbJ0RvbScsICdTZWcnLCAnVGVyJywgJ1F1YScsICdRdWknLCAnU2V4JywgJ1PDoWInXTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIENhbGVuZGFyUGFnZSgpIHtcclxuICBjb25zdCB7IGNsaWVudElkIH0gPSB1c2VQYXJhbXM8eyBjbGllbnRJZDogc3RyaW5nIH0+KCk7XHJcbiAgY29uc3QgW2NhbGVuZGFyLCBzZXRDYWxlbmRhcl0gPSB1c2VTdGF0ZTxDYWxlbmRhciB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IFtjbGllbnROYW1lLCBzZXRDbGllbnROYW1lXSA9IHVzZVN0YXRlPHN0cmluZz4oJycpO1xyXG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xyXG4gIGNvbnN0IFtjdXJyZW50TW9udGgsIHNldEN1cnJlbnRNb250aF0gPSB1c2VTdGF0ZShuZXcgRGF0ZSgpKTtcclxuICBjb25zdCBbc2VsZWN0ZWRQb3N0LCBzZXRTZWxlY3RlZFBvc3RdID0gdXNlU3RhdGU8eyBwb3N0OiBQb3N0OyBpbmRleDogbnVtYmVyIH0gfCBudWxsPihudWxsKTtcclxuICBjb25zdCBbaXNHZW5lcmF0aW5nLCBzZXRJc0dlbmVyYXRpbmddID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzaG93R2VuZXJhdGVNb2RhbCwgc2V0U2hvd0dlbmVyYXRlTW9kYWxdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtwZXJpb2RvRGlhcywgc2V0UGVyaW9kb0RpYXNdID0gdXNlU3RhdGU8bnVtYmVyPigzMCk7XHJcbiAgY29uc3QgW3NwZWNpZmljTW9udGhzLCBzZXRTcGVjaWZpY01vbnRoc10gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pO1xyXG4gIGNvbnN0IFtpc1NhdmluZywgc2V0SXNTYXZpbmddID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtpc0RlbGV0aW5nLCBzZXRJc0RlbGV0aW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbaXNEZWxldGluZ1Bvc3QsIHNldElzRGVsZXRpbmdQb3N0XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbaXNSZWdlbmVyYXRpbmdQb3N0LCBzZXRJc1JlZ2VuZXJhdGluZ1Bvc3RdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzaG93UGhvdG9JZGVhc01vZGFsLCBzZXRTaG93UGhvdG9JZGVhc01vZGFsXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuXHJcbiAgY29uc3QgW3Nob3dFeHBvcnRNb2RhbCwgc2V0U2hvd0V4cG9ydE1vZGFsXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbZXhwb3J0TW9udGhzU2VsZWN0ZWQsIHNldEV4cG9ydE1vbnRoc1NlbGVjdGVkXSA9IHVzZVN0YXRlPG51bWJlcltdPihbXSk7XHJcblxyXG4gIC8vIEVzdGFkbyBkbyBKb2IgKEFzeW5jIEdlbmVyYXRpb24pXHJcbiAgY29uc3QgW3BlbmRpbmdKb2JJZCwgc2V0UGVuZGluZ0pvYklkXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIC8vIENvbnRyb2xhIG8gcG9sbGluZyAocGFpbmVsIHJlbmRlcml6YWRvIHNlbXByZSBxdWUgaMOhIGpvYiBhdGl2byBvdSByZWPDqW0tZmluYWxpemFkbylcclxuXHJcbiAgLy8gRXN0YWRvcyBwYXJhIGdlcmHDp8Ojb1xyXG4gIGNvbnN0IFticmllZmluZywgc2V0QnJpZWZpbmddID0gdXNlU3RhdGUoJycpO1xyXG4gIGNvbnN0IFtnZW5lcmF0aW9uUHJvbXB0LCBzZXRHZW5lcmF0aW9uUHJvbXB0XSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbc2VsZWN0ZWRDaGFpbklkLCBzZXRTZWxlY3RlZENoYWluSWRdID0gdXNlU3RhdGU8c3RyaW5nPignJyk7XHJcbiAgY29uc3QgW3Byb21wdENoYWlucywgc2V0UHJvbXB0Q2hhaW5zXSA9IHVzZVN0YXRlPGFueVtdPihbXSk7XHJcbiAgY29uc3QgW21peCwgc2V0TWl4XSA9IHVzZVN0YXRlPENvbnRlbnRNaXg+KHtcclxuICAgIHJlZWxzOiAwLFxyXG4gICAgc3RhdGljOiAwLFxyXG4gICAgY2Fyb3VzZWw6IDAsXHJcbiAgICBzdG9yaWVzOiAwLFxyXG4gICAgcGhvdG9zOiAwXHJcbiAgfSk7XHJcblxyXG4gIC8vIEVzdGFkb3MgcGFyYSBlZGnDp8OjbyBkbyBwb3N0XHJcbiAgY29uc3QgW2VkaXRUZW1hLCBzZXRFZGl0VGVtYV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2VkaXRDb3B5LCBzZXRFZGl0Q29weV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2VkaXREYXRhLCBzZXRFZGl0RGF0YV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2VkaXRGb3JtYXRvLCBzZXRFZGl0Rm9ybWF0b10gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2VkaXRJZGVpYVZpc3VhbCwgc2V0RWRpdElkZWlhVmlzdWFsXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbZWRpdEltYWdlUHJvbXB0LCBzZXRFZGl0SW1hZ2VQcm9tcHRdID0gdXNlU3RhdGUoJycpO1xyXG4gIGNvbnN0IFtlZGl0T2JqZXRpdm8sIHNldEVkaXRPYmpldGl2b10gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2VkaXRSZWZlcmVuY2lhcywgc2V0RWRpdFJlZmVyZW5jaWFzXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbZWRpdFN0YXR1cywgc2V0RWRpdFN0YXR1c10gPSB1c2VTdGF0ZTwnc3VnZXJpZG8nIHwgJ2Fwcm92YWRvJyB8ICdwdWJsaWNhZG8nPignc3VnZXJpZG8nKTtcclxuICBjb25zdCBbcmVnZW5Qb3N0UHJvbXB0LCBzZXRSZWdlblBvc3RQcm9tcHRdID0gdXNlU3RhdGUoJycpO1xyXG5cclxuICBjb25zdCBbY2Fyb3VzZWxTbGlkZXNDb3VudCwgc2V0Q2Fyb3VzZWxTbGlkZXNDb3VudF0gPSB1c2VTdGF0ZTxudW1iZXI+KDYpO1xyXG5cclxuICAvLyBJbnN0cnXDp8O1ZXMgcG9yIGZvcm1hdG8gZSByZWZlcsOqbmNpYXMgZG8gbcOqc1xyXG4gIGNvbnN0IFtmb3JtYXRJbnN0cnVjdGlvbnMsIHNldEZvcm1hdEluc3RydWN0aW9uc10gPSB1c2VTdGF0ZTxGb3JtYXRJbnN0cnVjdGlvbnM+KHtcclxuICAgIHJlZWxzOiAnJyxcclxuICAgIHN0YXRpYzogJycsXHJcbiAgICBjYXJvdXNlbDogJycsXHJcbiAgICBzdG9yaWVzOiAnJyxcclxuICAgIHBob3RvczogJycsXHJcbiAgfSk7XHJcbiAgY29uc3QgW21vbnRoUmVmZXJlbmNlcywgc2V0TW9udGhSZWZlcmVuY2VzXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbbW9udGhJbWFnZXMsIHNldE1vbnRoSW1hZ2VzXSA9IHVzZVN0YXRlPHN0cmluZ1tdPihbXSk7IC8vIFVSTHMgZGFzIGltYWdlbnNcclxuICBjb25zdCBbc2hvd01vbnRoUmVmZXJlbmNlc01vZGFsLCBzZXRTaG93TW9udGhSZWZlcmVuY2VzTW9kYWxdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGNsaWVudElkKSB7XHJcbiAgICAgIGxvYWRDYWxlbmRhcigpO1xyXG4gICAgICBsb2FkUHJvbXB0Q2hhaW5zKCk7XHJcbiAgICAgIGxvYWRDbGllbnROYW1lKCk7XHJcbiAgICB9XHJcbiAgfSwgW2NsaWVudElkLCBjdXJyZW50TW9udGhdKTsgLy8gbG9hZENhbGVuZGFyIG5hbyBlbnRyYSBhcXVpOiBkZXBlbmRlIGRlIGNsaWVudElkK2N1cnJlbnRNb250aCAobWVzbWFzIGRlcHMpLCBpbmNsdWlyIGNhdXNhcmlhIFREWlxyXG5cclxuICBjb25zdCBsb2FkQ2xpZW50TmFtZSA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY2xpZW50SWQpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpLmdldChgL2NsaWVudHMvJHtjbGllbnRJZH1gKTtcclxuICAgICAgY29uc3QgbmFtZSA9IHJlc3BvbnNlLmRhdGE/LmNsaWVudGU/Lm5vbWU7XHJcbiAgICAgIGlmIChuYW1lKSB7XHJcbiAgICAgICAgc2V0Q2xpZW50TmFtZShuYW1lKTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAvLyBtYW50ZXIgdmF6aW87IGJhY2tlbmQgdGFtYsOpbSByZXNvbHZlIG8gbm9tZVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIFJlY3VwZXJhciBqb2IgcGVuZGVudGUgZG8gbG9jYWxTdG9yYWdlXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IHNhdmVkSm9iID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3BlbmRpbmdDYWxlbmRhckpvYicpO1xyXG4gICAgaWYgKHNhdmVkSm9iICYmIGNsaWVudElkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgeyBqb2JJZCwgY2xpZW50SWQ6IHNhdmVkQ2xpZW50SWQgfSA9IEpTT04ucGFyc2Uoc2F2ZWRKb2IpO1xyXG4gICAgICAgIGlmIChzYXZlZENsaWVudElkID09PSBjbGllbnRJZCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coJ/CflIQgUmVjdXBlcmFuZG8gam9iIHBlbmRlbnRlOicsIGpvYklkKTtcclxuICAgICAgICAgIC8vIFZhbGlkYXIgc2UgbyBqb2IgYWluZGEgZXN0w6EgZW0gYW5kYW1lbnRvIGFudGVzIGRlIHJlYWJyaXIgbyBtb2RhbFxyXG4gICAgICAgICAgam9ic1NlcnZpY2UuZ2V0Sm9iU3RhdHVzKGNsaWVudElkLCBqb2JJZClcclxuICAgICAgICAgICAgLnRoZW4oKGpvYikgPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHRlcm1pbmFsU3RhdHVzZXMgPSBbJ3N1Y2NlZWRlZCcsICdjb21wbGV0ZWQnLCAnZmFpbGVkJywgJ2NhbmNlbGVkJ107XHJcbiAgICAgICAgICAgICAgaWYgKHRlcm1pbmFsU3RhdHVzZXMuaW5jbHVkZXMoam9iLnN0YXR1cykpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDwn5eR77iPIEpvYiBqw6EgZmluYWxpemFkbyAoJHtqb2Iuc3RhdHVzfSksIGxpbXBhbmRvIGxvY2FsU3RvcmFnZS5gKTtcclxuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdwZW5kaW5nQ2FsZW5kYXJKb2InKTtcclxuICAgICAgICAgICAgICAgIC8vIFNlIGZvaSBzdWNlc3NvLCByZWNhcnJlZ2FyIG8gY2FsZW5kw6FyaW9cclxuICAgICAgICAgICAgICAgIGlmIChqb2Iuc3RhdHVzID09PSAnc3VjY2VlZGVkJyB8fCBqb2Iuc3RhdHVzID09PSAnY29tcGxldGVkJykge1xyXG4gICAgICAgICAgICAgICAgICBsb2FkQ2FsZW5kYXIoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gQWluZGEgZW0gYW5kYW1lbnRvOiByZXN0YXVyYXIgam9iSWQgKHBhaW5lbCBzZXLDoSBleGliaWRvIHBlbG8gQ2FsZW5kYXJQYWdlKVxyXG4gICAgICAgICAgICAgICAgc2V0UGVuZGluZ0pvYklkKGpvYklkKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5jYXRjaCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgLy8gSm9iIG7Do28gZXhpc3RlIG1haXMsIGxpbXBhclxyXG4gICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdwZW5kaW5nQ2FsZW5kYXJKb2InKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJybyBhbyBsZXIgam9iIHBlbmRlbnRlJywgZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LCBbY2xpZW50SWRdKTsgLy8gbmFvIGluY2x1aXIgbG9hZENhbGVuZGFyIGFxdWkg4oCUIGV2aXRhIGxvb3AgKGxvYWRDYWxlbmRhciBtdWRhIGNvbSBjdXJyZW50TW9udGgpXHJcblxyXG4gIC8vIGxvYWRDYWxlbmRhciBERVZFIGZpY2FyIGFxdWksIGFudGVzIGRlIHF1YWxxdWVyIHVzZUVmZmVjdCBxdWUgbyB1c2UuXHJcbiAgLy8gY29uc3QgbmFvIGUgaG9pc3RhZG8gKFREWikg4oCUIGRlY2xhcmFyIGRlcG9pcyBkb3MgdXNlRWZmZWN0cyBjYXVzYSBjcmFzaC5cclxuICBjb25zdCBsb2FkQ2FsZW5kYXIgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNsaWVudElkKSByZXR1cm47XHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRMb2FkaW5nKHRydWUpO1xyXG4gICAgICBzZXRNb250aFJlZmVyZW5jZXMoJycpO1xyXG4gICAgICBzZXRNb250aEltYWdlcyhbXSk7XHJcbiAgICAgIGNvbnN0IG1vbnRoU3RyID0gZm9ybWF0KGN1cnJlbnRNb250aCwgJ01NTU0geXl5eScsIHsgbG9jYWxlOiBwdEJSIH0pO1xyXG4gICAgICBjb25zb2xlLmxvZygnQ2FycmVnYW5kbyBjYWxlbmRhcmlvOiAnICsgbW9udGhTdHIpO1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGFwaS5nZXQoJy9jYWxlbmRhcnMvJyArIGNsaWVudElkICsgJz9tb250aD0nICsgZW5jb2RlVVJJQ29tcG9uZW50KG1vbnRoU3RyKSk7XHJcbiAgICAgIGNvbnN0IGNhbGVuZGFyRGF0YSA9IHJlc3BvbnNlLmRhdGEuY2FsZW5kYXI7XHJcblxyXG4gICAgICBpZiAoIWNhbGVuZGFyRGF0YSkge1xyXG4gICAgICAgIHNldENhbGVuZGFyKG51bGwpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGNhbGVuZGFyRGF0YS5tZXRhZGF0YT8ubW9udGhfcmVmZXJlbmNlcykgc2V0TW9udGhSZWZlcmVuY2VzKGNhbGVuZGFyRGF0YS5tZXRhZGF0YS5tb250aF9yZWZlcmVuY2VzKTtcclxuICAgICAgaWYgKGNhbGVuZGFyRGF0YS5tZXRhZGF0YT8ubW9udGhfaW1hZ2VzICYmIEFycmF5LmlzQXJyYXkoY2FsZW5kYXJEYXRhLm1ldGFkYXRhLm1vbnRoX2ltYWdlcykpIHtcclxuICAgICAgICBzZXRNb250aEltYWdlcyhjYWxlbmRhckRhdGEubWV0YWRhdGEubW9udGhfaW1hZ2VzKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgcmF3UG9zdHMgPSBBcnJheS5pc0FycmF5KGNhbGVuZGFyRGF0YS5wb3N0cykgPyBjYWxlbmRhckRhdGEucG9zdHMgOiAoXHJcbiAgICAgICAgdHlwZW9mIGNhbGVuZGFyRGF0YS5wb3N0cyA9PT0gJ3N0cmluZycgPyBKU09OLnBhcnNlKGNhbGVuZGFyRGF0YS5wb3N0cykgOiBbXVxyXG4gICAgICApO1xyXG5cclxuICAgICAgY2FsZW5kYXJEYXRhLnBvc3RzID0gKEFycmF5LmlzQXJyYXkocmF3UG9zdHMpID8gcmF3UG9zdHMgOiBbXSkubWFwKChwb3N0OiBhbnkpID0+IHtcclxuICAgICAgICBjb25zdCBuID0gKHY6IGFueSk6IHN0cmluZyA9PiB7XHJcbiAgICAgICAgICBpZiAodiA9PSBudWxsKSByZXR1cm4gJyc7XHJcbiAgICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSByZXR1cm4gdjtcclxuICAgICAgICAgIHRyeSB7IHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTsgfSBjYXRjaCB7IHJldHVybiBTdHJpbmcodik7IH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBkYXRhOiBuKHBvc3QuZGF0YSksIHRlbWE6IG4ocG9zdC50ZW1hKSwgZm9ybWF0bzogbihwb3N0LmZvcm1hdG8pLFxyXG4gICAgICAgICAgaWRlaWFfdmlzdWFsOiBuKHBvc3QuaWRlaWFfdmlzdWFsKSwgY29weV9zdWdlc3Rhbzogbihwb3N0LmNvcHlfc3VnZXN0YW8pLFxyXG4gICAgICAgICAgb2JqZXRpdm86IG4ocG9zdC5vYmpldGl2byksIGltYWdlX2dlbmVyYXRpb25fcHJvbXB0OiBuKHBvc3QuaW1hZ2VfZ2VuZXJhdGlvbl9wcm9tcHQpLFxyXG4gICAgICAgICAgcmVmZXJlbmNpYXM6IG4ocG9zdC5yZWZlcmVuY2lhcyksXHJcbiAgICAgICAgICBzdGF0dXM6IChwb3N0LnN0YXR1cyBhcyBQb3N0WydzdGF0dXMnXSkgfHwgJ3N1Z2VyaWRvJyxcclxuICAgICAgICB9O1xyXG4gICAgICB9KTtcclxuICAgICAgc2V0Q2FsZW5kYXIoY2FsZW5kYXJEYXRhKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRXJybyBhbyBjYXJyZWdhciBjYWxlbmRhcmlvOicsIGVycm9yKTtcclxuICAgICAgaWYgKGVycm9yLnJlc3BvbnNlPy5zdGF0dXMgPT09IDQwNCkgc2V0Q2FsZW5kYXIobnVsbCk7XHJcbiAgICAgIGVsc2UgYWxlcnQoJ0Vycm8gYW8gY2FycmVnYXIgY2FsZW5kYXJpbzogJyArIChlcnJvci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZXJyb3IubWVzc2FnZSkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfSwgW2NsaWVudElkLCBjdXJyZW50TW9udGhdKTtcclxuXHJcbiAgLy8gQ2FsbGJhY2tzIGVzdGF2ZWlzIHBhcmEgdXNlSm9iUG9sbGluZyDigJQgbG9hZENhbGVuZGFyIGphIGRlY2xhcmFkbyBhY2ltYVxyXG4gIGNvbnN0IGhhbmRsZUpvYlN1Y2Nlc3NDYWxsYmFjayA9IHVzZUNhbGxiYWNrKChfcmVzdWx0OiBhbnkpID0+IHtcclxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdwZW5kaW5nQ2FsZW5kYXJKb2InKTtcclxuICAgIC8vIE7Do28gbGltcGEgbyBwZW5kaW5nSm9iSWQgYXV0b21hdGljYW1lbnRlIHBhcmEgbWFudGVyIG8gcGFpbmVsIHZpc8OtdmVsIG1vc3RyYW5kbyBcIkNvbmNsdcOtZG9cIlxyXG4gICAgbG9hZENhbGVuZGFyKCk7XHJcbiAgfSwgW2xvYWRDYWxlbmRhcl0pO1xyXG5cclxuICBjb25zdCBoYW5kbGVKb2JFcnJvckNhbGxiYWNrID0gdXNlQ2FsbGJhY2soKGVyck1zZzogc3RyaW5nKSA9PiB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdKb2IgZmFsaG91OicsIGVyck1zZyk7XHJcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncGVuZGluZ0NhbGVuZGFySm9iJyk7XHJcbiAgfSwgW10pO1xyXG5cclxuICBjb25zdCBoYW5kbGVKb2JDYW5jZWxDYWxsYmFjayA9IHVzZUNhbGxiYWNrKCgpID0+IHtcclxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdwZW5kaW5nQ2FsZW5kYXJKb2InKTtcclxuICAgIHNldFBlbmRpbmdKb2JJZChudWxsKTtcclxuICB9LCBbXSk7XHJcblxyXG4gIGNvbnN0IHtcclxuICAgIGpvYixcclxuICAgIHN0YXR1czogam9iU3RhdHVzLFxyXG4gICAgcHJvZ3Jlc3M6IGpvYlByb2dyZXNzLFxyXG4gICAgc3RlcERlc2NyaXB0aW9uOiBqb2JTdGVwRGVzY3JpcHRpb24sXHJcbiAgICBlcnJvcjogam9iUG9sbGluZ0Vycm9yLFxyXG4gICAgaXNQb2xsaW5nOiBqb2JJc1BvbGxpbmcsXHJcbiAgfSA9IHVzZUpvYlBvbGxpbmcoe1xyXG4gICAgY2xpZW50SWQ6IGNsaWVudElkIHx8ICcnLFxyXG4gICAgam9iSWQ6IHBlbmRpbmdKb2JJZCxcclxuICAgIGVuYWJsZWQ6ICEhcGVuZGluZ0pvYklkICYmICEhY2xpZW50SWQsXHJcbiAgICBvblN1Y2Nlc3M6IGhhbmRsZUpvYlN1Y2Nlc3NDYWxsYmFjayxcclxuICAgIG9uRXJyb3I6IGhhbmRsZUpvYkVycm9yQ2FsbGJhY2ssXHJcbiAgICBvbkNhbmNlbDogaGFuZGxlSm9iQ2FuY2VsQ2FsbGJhY2ssXHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGhhbmRsZUpvYkNhbmNlbEJ0biA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghcGVuZGluZ0pvYklkIHx8ICFjbGllbnRJZCkgcmV0dXJuO1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgam9ic1NlcnZpY2UuY2FuY2VsSm9iKGNsaWVudElkLCBwZW5kaW5nSm9iSWQpO1xyXG4gICAgICBhbGVydCgnR2VyYcOnw6NvIGNhbmNlbGFkYSBjb20gc3VjZXNzby4nKTtcclxuICAgICAgc2V0UGVuZGluZ0pvYklkKG51bGwpO1xyXG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncGVuZGluZ0NhbGVuZGFySm9iJyk7XHJcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcclxuICAgICAgaWYgKGUucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDAwIHx8IGUucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDA0KSB7XHJcbiAgICAgICAgLy8gSsOhIGNhbmNlbGFkby9maW5hbGl6YWRvL2luZXhpc3RlbnRlLCBsaW1wYSBzdGF0ZSBsb2NhbFxyXG4gICAgICAgIHNldFBlbmRpbmdKb2JJZChudWxsKTtcclxuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncGVuZGluZ0NhbGVuZGFySm9iJyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYWxlcnQoJ0Vycm8gYW8gY2FuY2VsYXI6ICcgKyAoZS5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZS5tZXNzYWdlKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuXHJcblxyXG4gIGNvbnN0IGdlbmVyYXRlU2luZ2xlUG9zdFdpdGhBSSA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY2FsZW5kYXIgfHwgIXNlbGVjdGVkUG9zdCkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIHNldElzUmVnZW5lcmF0aW5nUG9zdCh0cnVlKTtcclxuXHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpLnBvc3QoJy9jYWxlbmRhcnMvZ2VuZXJhdGUtc2luZ2xlLXBvc3QnLCB7XHJcbiAgICAgICAgY2FsZW5kYXJJZDogY2FsZW5kYXIuaWQsXHJcbiAgICAgICAgcG9zdEluZGV4OiBzZWxlY3RlZFBvc3QuaW5kZXgsXHJcbiAgICAgICAgZGF0YTogZWRpdERhdGEsXHJcbiAgICAgICAgZm9ybWF0bzogZWRpdEZvcm1hdG8sXHJcbiAgICAgICAgY2Fyb3VzZWxTbGlkZXNDb3VudCxcclxuICAgICAgICBjdXN0b21Qcm9tcHQ6IHJlZ2VuUG9zdFByb21wdCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zdCBuZXdQb3N0OiBQb3N0ID0gcmVzcG9uc2UuZGF0YS5wb3N0O1xyXG4gICAgICBjb25zdCB1cGRhdGVkUG9zdHMgPSBbLi4uY2FsZW5kYXIucG9zdHNdO1xyXG4gICAgICB1cGRhdGVkUG9zdHNbc2VsZWN0ZWRQb3N0LmluZGV4XSA9IG5ld1Bvc3Q7XHJcbiAgICAgIHNldENhbGVuZGFyKHsgLi4uY2FsZW5kYXIsIHBvc3RzOiB1cGRhdGVkUG9zdHMgfSk7XHJcblxyXG4gICAgICBzZXRFZGl0VGVtYShuZXdQb3N0LnRlbWEgfHwgJycpO1xyXG4gICAgICBzZXRFZGl0Q29weShuZXdQb3N0LmNvcHlfc3VnZXN0YW8gfHwgJycpO1xyXG4gICAgICBzZXRFZGl0RGF0YShuZXdQb3N0LmRhdGEgfHwgJycpO1xyXG4gICAgICBzZXRFZGl0Rm9ybWF0byhuZXdQb3N0LmZvcm1hdG8gfHwgJycpO1xyXG4gICAgICBzZXRFZGl0SWRlaWFWaXN1YWwobmV3UG9zdC5pZGVpYV92aXN1YWwgfHwgJycpO1xyXG4gICAgICBzZXRFZGl0T2JqZXRpdm8obmV3UG9zdC5vYmpldGl2byB8fCAnJyk7XHJcbiAgICAgIHNldEVkaXRJbWFnZVByb21wdChuZXdQb3N0LmltYWdlX2dlbmVyYXRpb25fcHJvbXB0IHx8ICcnKTtcclxuXHJcbiAgICAgIGFsZXJ0KCfinIUgUG9zdCBnZXJhZG8gY29tIElBIChpc29sYWRvKSBjb20gc3VjZXNzbyEnKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcign4p2MIEVycm8gYW8gZ2VyYXIgcG9zdCBpc29sYWRvIGNvbSBJQTonLCBlcnJvcik7XHJcbiAgICAgIGFsZXJ0KCdFcnJvIGFvIGdlcmFyIHBvc3QgaXNvbGFkbyBjb20gSUE6ICcgKyAoZXJyb3IucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8IGVycm9yLm1lc3NhZ2UpKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldElzUmVnZW5lcmF0aW5nUG9zdChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbG9hZFByb21wdENoYWlucyA9IGFzeW5jICgpID0+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpLmdldChgL3Byb21wdC1jaGFpbnMvJHtjbGllbnRJZH1gKTtcclxuICAgICAgc2V0UHJvbXB0Q2hhaW5zKHJlc3BvbnNlLmRhdGEuZGF0YSB8fCBbXSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvIGFvIGNhcnJlZ2FyIHByb21wdCBjaGFpbnM6JywgZXJyb3IpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG5cclxuICBjb25zdCBoYW5kbGVFeHBvcnRFeGNlbCA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY2FsZW5kYXIpIHtcclxuICAgICAgYWxlcnQoJ05lbmh1bSBjYWxlbmTDoXJpbyBjYXJyZWdhZG8uJyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRJc0dlbmVyYXRpbmcodHJ1ZSk7XHJcblxyXG4gICAgICBjb25zdCBkb3dubG9hZENsaWVudE5hbWUgPSBjbGllbnROYW1lIHx8ICdDbGllbnRlJztcclxuICAgICAgY29uc3Qgc3VmZml4ID0gZ2V0RXhjZWxGaWxlbmFtZVN1ZmZpeChleHBvcnRNb250aHNTZWxlY3RlZCk7XHJcbiAgICAgIGNvbnN0IHNhZmVNb250aCA9IFN0cmluZyhzdWZmaXggfHwgU3RyaW5nKGNhbGVuZGFyLm1lcyB8fCAnbWVzJykpLnJlcGxhY2UoL1xccysvZywgJ18nKTtcclxuXHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpLnBvc3QoXHJcbiAgICAgICAgJy9jYWxlbmRhcnMvZXhwb3J0LWV4Y2VsJyxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBjYWxlbmRhcklkOiBjYWxlbmRhci5pZCxcclxuICAgICAgICAgIGNsaWVudE5hbWU6IGRvd25sb2FkQ2xpZW50TmFtZSxcclxuICAgICAgICAgIG1vbnRoc1NlbGVjdGVkOiBleHBvcnRNb250aHNTZWxlY3RlZFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgcmVzcG9uc2VUeXBlOiAnYmxvYidcclxuICAgICAgICB9XHJcbiAgICAgICk7XHJcblxyXG4gICAgICAvLyBEb3dubG9hZCBkbyBhcnF1aXZvIEV4Y2VsXHJcbiAgICAgIGNvbnN0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFtyZXNwb25zZS5kYXRhXSkpO1xyXG4gICAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgICBsaW5rLmhyZWYgPSB1cmw7XHJcbiAgICAgIGxpbmsuc2V0QXR0cmlidXRlKCdkb3dubG9hZCcsIGAke2Rvd25sb2FkQ2xpZW50TmFtZX1fJHtzYWZlTW9udGh9Lnhsc3hgKTtcclxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgbGluay5jbGljaygpO1xyXG4gICAgICBsaW5rLnJlbW92ZSgpO1xyXG4gICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG5cclxuICAgICAgYWxlcnQoJ+KchSBDYWxlbmTDoXJpbyBFeGNlbCBnZXJhZG8gY29tIHN1Y2Vzc28hJyk7XHJcbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvIGFvIGdlcmFyIEV4Y2VsOicsIGVycik7XHJcbiAgICAgIGFsZXJ0KCdFcnJvIGFvIGdlcmFyIEV4Y2VsOiAnICsgKGVyci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZXJyLm1lc3NhZ2UpKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldElzR2VuZXJhdGluZyhmYWxzZSk7XHJcbiAgICAgIHNldFNob3dFeHBvcnRNb2RhbChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZGV0ZWN0TW9udGhzRnJvbUNhbGVuZGFyID0gKGNhbDogQ2FsZW5kYXIpOiBudW1iZXJbXSA9PiB7XHJcbiAgICBjb25zdCBleHRyYWN0TW9udGhOdW1Gcm9tRGF0ZVN0ciA9ICh2YWx1ZTogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCA9PiB7XHJcbiAgICAgIGNvbnN0IHMgPSBTdHJpbmcodmFsdWUgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFzKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgIGxldCBtID0gcy5tYXRjaCgvKFxcZHsxLDJ9KVxcLyhcXGR7MSwyfSkoPzpcXC8oXFxkezIsNH0pKT8vKTtcclxuICAgICAgaWYgKG0/LlsyXSkge1xyXG4gICAgICAgIGNvbnN0IG1vbnRoTnVtID0gcGFyc2VJbnQobVsyXSwgMTApO1xyXG4gICAgICAgIHJldHVybiAhaXNOYU4obW9udGhOdW0pICYmIG1vbnRoTnVtID49IDEgJiYgbW9udGhOdW0gPD0gMTIgPyBtb250aE51bSA6IG51bGw7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIG0gPSBzLm1hdGNoKC8oXFxkezEsMn0pXFwtKFxcZHsxLDJ9KSg/OlxcLShcXGR7Miw0fSkpPy8pO1xyXG4gICAgICBpZiAobT8uWzJdKSB7XHJcbiAgICAgICAgY29uc3QgbW9udGhOdW0gPSBwYXJzZUludChtWzJdLCAxMCk7XHJcbiAgICAgICAgcmV0dXJuICFpc05hTihtb250aE51bSkgJiYgbW9udGhOdW0gPj0gMSAmJiBtb250aE51bSA8PSAxMiA/IG1vbnRoTnVtIDogbnVsbDtcclxuICAgICAgfVxyXG5cclxuICAgICAgbSA9IHMubWF0Y2goLyhcXGR7NH0pXFwtKFxcZHsxLDJ9KVxcLShcXGR7MSwyfSkvKTtcclxuICAgICAgaWYgKG0/LlsyXSkge1xyXG4gICAgICAgIGNvbnN0IG1vbnRoTnVtID0gcGFyc2VJbnQobVsyXSwgMTApO1xyXG4gICAgICAgIHJldHVybiAhaXNOYU4obW9udGhOdW0pICYmIG1vbnRoTnVtID49IDEgJiYgbW9udGhOdW0gPD0gMTIgPyBtb250aE51bSA6IG51bGw7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIG0gPSBzLm1hdGNoKC8oXFxkezR9KVxcLyhcXGR7MSwyfSlcXC8oXFxkezEsMn0pLyk7XHJcbiAgICAgIGlmIChtPy5bMl0pIHtcclxuICAgICAgICBjb25zdCBtb250aE51bSA9IHBhcnNlSW50KG1bMl0sIDEwKTtcclxuICAgICAgICByZXR1cm4gIWlzTmFOKG1vbnRoTnVtKSAmJiBtb250aE51bSA+PSAxICYmIG1vbnRoTnVtIDw9IDEyID8gbW9udGhOdW0gOiBudWxsO1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgbW9udGhzID0gbmV3IFNldDxudW1iZXI+KCk7XHJcbiAgICBmb3IgKGNvbnN0IHAgb2YgY2FsLnBvc3RzIHx8IFtdKSB7XHJcbiAgICAgIGNvbnN0IGRhdGVTdHIgPSBTdHJpbmcoKHAgYXMgYW55KT8uZGF0YSB8fCAnJyk7XHJcbiAgICAgIGNvbnN0IG1vbnRoTnVtID0gZXh0cmFjdE1vbnRoTnVtRnJvbURhdGVTdHIoZGF0ZVN0cik7XHJcbiAgICAgIGlmIChtb250aE51bSkgbW9udGhzLmFkZChtb250aE51bSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShtb250aHMpLnNvcnQoKGEsIGIpID0+IGEgLSBiKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBnZXRNb250aE5hbWUgPSAobW9udGhOdW06IG51bWJlcik6IHN0cmluZyA9PiB7XHJcbiAgICBjb25zdCBtb250aE5hbWVzID0gW1xyXG4gICAgICAnSmFuZWlybycsICdGZXZlcmVpcm8nLCAnTWFyw6dvJywgJ0FicmlsJywgJ01haW8nLCAnSnVuaG8nLFxyXG4gICAgICAnSnVsaG8nLCAnQWdvc3RvJywgJ1NldGVtYnJvJywgJ091dHVicm8nLCAnTm92ZW1icm8nLCAnRGV6ZW1icm8nXHJcbiAgICBdO1xyXG4gICAgcmV0dXJuIG1vbnRoTmFtZXNbbW9udGhOdW0gLSAxXSB8fCBgTcOqcyAke21vbnRoTnVtfWA7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZ2V0RXhjZWxGaWxlbmFtZVN1ZmZpeCA9IChtb250aHNTZWxlY3RlZDogbnVtYmVyW10pID0+IHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSAoQXJyYXkuaXNBcnJheShtb250aHNTZWxlY3RlZCkgPyBtb250aHNTZWxlY3RlZCA6IFtdKVxyXG4gICAgICAubWFwKChtKSA9PiBwYXJzZUludChTdHJpbmcobSksIDEwKSlcclxuICAgICAgLmZpbHRlcigobSkgPT4gIWlzTmFOKG0pICYmIG0gPj0gMSAmJiBtIDw9IDEyKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYSAtIGIpO1xyXG5cclxuICAgIGNvbnN0IHllYXJNYXRjaCA9IFN0cmluZyhjYWxlbmRhcj8ubWVzIHx8ICcnKS5tYXRjaCgvKFxcZHs0fSkvKTtcclxuICAgIGNvbnN0IHllYXJTdHIgPSB5ZWFyTWF0Y2g/LlsxXSB8fCAnJztcclxuXHJcbiAgICBpZiAobm9ybWFsaXplZC5sZW5ndGggPj0gMikge1xyXG4gICAgICBjb25zdCBzdGFydCA9IGdldE1vbnRoTmFtZShub3JtYWxpemVkWzBdKTtcclxuICAgICAgY29uc3QgZW5kID0gZ2V0TW9udGhOYW1lKG5vcm1hbGl6ZWRbbm9ybWFsaXplZC5sZW5ndGggLSAxXSk7XHJcbiAgICAgIHJldHVybiBgJHtzdGFydH0tJHtlbmR9JHt5ZWFyU3RyID8gYF8ke3llYXJTdHJ9YCA6ICcnfWA7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vcm1hbGl6ZWQubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIHJldHVybiBgJHtnZXRNb250aE5hbWUobm9ybWFsaXplZFswXSl9JHt5ZWFyU3RyID8gYF8ke3llYXJTdHJ9YCA6ICcnfWA7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2FmZU1vbnRoID0gU3RyaW5nKGNhbGVuZGFyPy5tZXMgfHwgJ21lcycpLnJlcGxhY2UoL1xccysvZywgJ18nKTtcclxuICAgIHJldHVybiBzYWZlTW9udGg7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcGFyc2VNb250aExhYmVsVG9OdW1iZXIgPSAobGFiZWw6IHN0cmluZyk6IG51bWJlciB8IG51bGwgPT4ge1xyXG4gICAgY29uc3QgcyA9IFN0cmluZyhsYWJlbCB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBpZiAoIXMpIHJldHVybiBudWxsO1xyXG4gICAgY29uc3QgdG9rZW4gPSBzLnNwbGl0KC9cXHMrLylbMF0gfHwgJyc7XHJcbiAgICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XHJcbiAgICAgIGphbmVpcm86IDEsXHJcbiAgICAgIGZldmVyZWlybzogMixcclxuICAgICAgJ21hcsOnbyc6IDMsXHJcbiAgICAgIG1hcmNvOiAzLFxyXG4gICAgICBhYnJpbDogNCxcclxuICAgICAgbWFpbzogNSxcclxuICAgICAganVuaG86IDYsXHJcbiAgICAgIGp1bGhvOiA3LFxyXG4gICAgICBhZ29zdG86IDgsXHJcbiAgICAgIHNldGVtYnJvOiA5LFxyXG4gICAgICBvdXR1YnJvOiAxMCxcclxuICAgICAgbm92ZW1icm86IDExLFxyXG4gICAgICBkZXplbWJybzogMTIsXHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIG1hcFt0b2tlbl0gPz8gbnVsbDtcclxuICB9O1xyXG5cclxuICBjb25zdCBvcGVuRXhwb3J0TW9kYWwgPSAoKSA9PiB7XHJcbiAgICBpZiAoIWNhbGVuZGFyKSB7XHJcbiAgICAgIGFsZXJ0KCdOZW5odW0gY2FsZW5kw6FyaW8gY2FycmVnYWRvLicpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYmFzZU1vbnRoID0gcGFyc2VNb250aExhYmVsVG9OdW1iZXIoY2FsZW5kYXIubWVzKSB8fCAoY3VycmVudE1vbnRoLmdldE1vbnRoKCkgKyAxKTtcclxuICAgIGNvbnN0IGRlZmF1bHRTZWxlY3Rpb24gPSBbXHJcbiAgICAgIGJhc2VNb250aCxcclxuICAgICAgYmFzZU1vbnRoID09PSAxMiA/IDEgOiBiYXNlTW9udGggKyAxLFxyXG4gICAgICBiYXNlTW9udGggPj0gMTEgPyAoKGJhc2VNb250aCArIDIpICUgMTIgfHwgMTIpIDogYmFzZU1vbnRoICsgMixcclxuICAgIF07XHJcblxyXG4gICAgY29uc3QgbW9udGhzT3B0aW9ucyA9IGdldEV4cG9ydE1vbnRoT3B0aW9ucyhjYWxlbmRhcik7XHJcbiAgICBzZXRFeHBvcnRNb250aHNTZWxlY3RlZChkZWZhdWx0U2VsZWN0aW9uLmZpbHRlcigobSkgPT4gbW9udGhzT3B0aW9ucy5pbmNsdWRlcyhtKSkpO1xyXG4gICAgc2V0U2hvd0V4cG9ydE1vZGFsKHRydWUpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGdldEV4cG9ydE1vbnRoT3B0aW9ucyA9IChjYWw6IENhbGVuZGFyKTogbnVtYmVyW10gPT4ge1xyXG4gICAgY29uc3QgYmFzZU1vbnRoID0gcGFyc2VNb250aExhYmVsVG9OdW1iZXIoY2FsLm1lcykgfHwgKGN1cnJlbnRNb250aC5nZXRNb250aCgpICsgMSk7XHJcbiAgICBjb25zdCB0cmlNb250aHMgPSBbXHJcbiAgICAgIGJhc2VNb250aCxcclxuICAgICAgYmFzZU1vbnRoID09PSAxMiA/IDEgOiBiYXNlTW9udGggKyAxLFxyXG4gICAgICBiYXNlTW9udGggPj0gMTEgPyAoKGJhc2VNb250aCArIDIpICUgMTIgfHwgMTIpIDogYmFzZU1vbnRoICsgMixcclxuICAgIF07XHJcblxyXG4gICAgY29uc3QgZGV0ZWN0ZWQgPSBkZXRlY3RNb250aHNGcm9tQ2FsZW5kYXIoY2FsKTtcclxuICAgIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQoWy4uLnRyaU1vbnRocywgLi4uZGV0ZWN0ZWRdKSkuc29ydCgoYSwgYikgPT4gYSAtIGIpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IG9wZW5HZW5lcmF0ZU1vZGFsID0gKCkgPT4ge1xyXG4gICAgLy8gRGVmaW5lIHVtIG1peCBwYWRyw6NvIGxldmUgcGFyYSBldml0YXIgbW9kYWwgdmF6aW9cclxuICAgIHNldE1peCh7IHJlZWxzOiAyLCBzdGF0aWM6IDQsIGNhcm91c2VsOiA0LCBzdG9yaWVzOiAyLCBwaG90b3M6IDAgfSk7XHJcbiAgICBzZXRCcmllZmluZygnJyk7XHJcbiAgICBzZXRHZW5lcmF0aW9uUHJvbXB0KCcnKTtcclxuICAgIHNldFBlcmlvZG9EaWFzKDMwKTtcclxuICAgIHNldFNwZWNpZmljTW9udGhzKFtmb3JtYXQoY3VycmVudE1vbnRoLCAnTU1NTSB5eXl5JywgeyBsb2NhbGU6IHB0QlIgfSldKTtcclxuICAgIHNldFNob3dHZW5lcmF0ZU1vZGFsKHRydWUpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJlZ2VuZXJhdGVQb3N0V2l0aEFJID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFjYWxlbmRhciB8fCAhc2VsZWN0ZWRQb3N0KSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgc2V0SXNSZWdlbmVyYXRpbmdQb3N0KHRydWUpO1xyXG5cclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhcGkucHV0KCcvY2FsZW5kYXJzL3JlZ2VuZXJhdGUtcG9zdCcsIHtcclxuICAgICAgICBjYWxlbmRhcklkOiBjYWxlbmRhci5pZCxcclxuICAgICAgICBwb3N0SW5kZXg6IHNlbGVjdGVkUG9zdC5pbmRleCxcclxuICAgICAgICBuZXdGb3JtYXRvOiBlZGl0Rm9ybWF0byxcclxuICAgICAgICBjdXN0b21Qcm9tcHQ6IHJlZ2VuUG9zdFByb21wdCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zdCBuZXdQb3N0OiBQb3N0ID0gcmVzcG9uc2UuZGF0YS5wb3N0O1xyXG5cclxuICAgICAgY29uc3QgdXBkYXRlZFBvc3RzID0gWy4uLmNhbGVuZGFyLnBvc3RzXTtcclxuICAgICAgdXBkYXRlZFBvc3RzW3NlbGVjdGVkUG9zdC5pbmRleF0gPSBuZXdQb3N0O1xyXG5cclxuICAgICAgc2V0Q2FsZW5kYXIoeyAuLi5jYWxlbmRhciwgcG9zdHM6IHVwZGF0ZWRQb3N0cyB9KTtcclxuXHJcbiAgICAgIC8vIEF0dWFsaXphciBjYW1wb3MgZG8gbW9kYWwgY29tIGEgcmVzcG9zdGEgZGEgSUFcclxuICAgICAgc2V0RWRpdFRlbWEobmV3UG9zdC50ZW1hIHx8ICcnKTtcclxuICAgICAgc2V0RWRpdENvcHkobmV3UG9zdC5jb3B5X3N1Z2VzdGFvIHx8ICcnKTtcclxuICAgICAgc2V0RWRpdERhdGEobmV3UG9zdC5kYXRhIHx8ICcnKTtcclxuICAgICAgc2V0RWRpdEZvcm1hdG8obmV3UG9zdC5mb3JtYXRvIHx8ICcnKTtcclxuICAgICAgc2V0RWRpdElkZWlhVmlzdWFsKG5ld1Bvc3QuaWRlaWFfdmlzdWFsIHx8ICcnKTtcclxuICAgICAgc2V0RWRpdE9iamV0aXZvKG5ld1Bvc3Qub2JqZXRpdm8gfHwgJycpO1xyXG4gICAgICBzZXRFZGl0SW1hZ2VQcm9tcHQobmV3UG9zdC5pbWFnZV9nZW5lcmF0aW9uX3Byb21wdCB8fCAnJyk7XHJcblxyXG4gICAgICBhbGVydCgn4pyFIFBvc3QgcmVnZW5lcmFkbyBjb20gSUEgY29tIHN1Y2Vzc28hJyk7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBFcnJvIGFvIHJlZ2VuZXJhciBwb3N0IGNvbSBJQTonLCBlcnJvcik7XHJcbiAgICAgIGFsZXJ0KCdFcnJvIGFvIHJlZ2VuZXJhciBwb3N0IGNvbSBJQTogJyArIChlcnJvci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZXJyb3IubWVzc2FnZSkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0SXNSZWdlbmVyYXRpbmdQb3N0KGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBkZWxldGVDYWxlbmRhciA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY2FsZW5kYXIpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBjb25maXJtRGVsZXRlID0gd2luZG93LmNvbmZpcm0oXHJcbiAgICAgIGBUZW0gY2VydGV6YSBxdWUgZGVzZWphIGV4Y2x1aXIgbyBjYWxlbmTDoXJpbyBjb21wbGV0byBkZSAke2NhbGVuZGFyLm1lc30/XFxuXFxuVG9kb3Mgb3MgJHtjYWxlbmRhci5wb3N0cy5sZW5ndGh9IHBvc3RzIHNlcsOjbyByZW1vdmlkb3MgcGVybWFuZW50ZW1lbnRlLmBcclxuICAgICk7XHJcblxyXG4gICAgaWYgKCFjb25maXJtRGVsZXRlKSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgc2V0SXNEZWxldGluZyh0cnVlKTtcclxuXHJcbiAgICAgIGNvbnN0IG1vbnRoU3RyID0gZm9ybWF0KGN1cnJlbnRNb250aCwgJ01NTU0geXl5eScsIHsgbG9jYWxlOiBwdEJSIH0pO1xyXG4gICAgICBhd2FpdCBhcGkuZGVsZXRlKGAvY2FsZW5kYXJzLyR7Y2xpZW50SWR9LyR7bW9udGhTdHJ9YCk7XHJcblxyXG4gICAgICBhbGVydCgn4pyFIENhbGVuZMOhcmlvIGV4Y2x1w61kbyBjb20gc3VjZXNzbyEnKTtcclxuICAgICAgbG9hZENhbGVuZGFyKCk7IC8vIFJlY2FycmVnYXIgKHZhaSBtb3N0cmFyIGVzdGFkbyB2YXppbylcclxuXHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm8gYW8gZXhjbHVpciBjYWxlbmTDoXJpbzonLCBlcnJvcik7XHJcbiAgICAgIGFsZXJ0KCdFcnJvIGFvIGV4Y2x1aXIgY2FsZW5kw6FyaW86ICcgKyAoZXJyb3IucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8IGVycm9yLm1lc3NhZ2UpKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldElzRGVsZXRpbmcoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGdlbmVyYXRlQ2FsZW5kYXIgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNsaWVudElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gVmFsaWRhciBzZSBwZWxvIG1lbm9zIHVtIHRpcG8gZGUgY29udGXDumRvIGZvaSBzZWxlY2lvbmFkb1xyXG4gICAgY29uc3QgdG90YWxQb3N0cyA9IE9iamVjdC52YWx1ZXMobWl4KS5yZWR1Y2UoKHN1bSwgY291bnQpID0+IHN1bSArIGNvdW50LCAwKTtcclxuICAgIGlmICh0b3RhbFBvc3RzID09PSAwKSB7XHJcbiAgICAgIGFsZXJ0KCdTZWxlY2lvbmUgcGVsbyBtZW5vcyAxIHRpcG8gZGUgY29udGXDumRvIHBhcmEgZ2VyYXIgbyBjYWxlbmTDoXJpby4nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghc3BlY2lmaWNNb250aHMgfHwgc3BlY2lmaWNNb250aHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIGFsZXJ0KCdTZWxlY2lvbmUgcGVsbyBtZW5vcyAxIG3DqnMgcGFyYSBnZXJhci4nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIHNldElzR2VuZXJhdGluZyh0cnVlKTtcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhcGkucG9zdCgnL2dlbmVyYXRlLWNhbGVuZGFyJywge1xyXG4gICAgICAgIGNsaWVudGVJZDogY2xpZW50SWQsXHJcbiAgICAgICAgcGVyaW9kbzogcGVyaW9kb0RpYXMsXHJcbiAgICAgICAgYnJpZWZpbmcsXHJcbiAgICAgICAgbWVzOiBmb3JtYXQoY3VycmVudE1vbnRoLCAnTU1NTSB5eXl5JywgeyBsb2NhbGU6IHB0QlIgfSksXHJcbiAgICAgICAgbW9udGhzQ291bnQ6IHNwZWNpZmljTW9udGhzLmxlbmd0aCxcclxuICAgICAgICBjYXJvdXNlbFNsaWRlc0NvdW50LFxyXG4gICAgICAgIG1peCxcclxuICAgICAgICBnZW5lcmF0aW9uUHJvbXB0LFxyXG4gICAgICAgIGNoYWluSWQ6IHNlbGVjdGVkQ2hhaW5JZCB8fCB1bmRlZmluZWQsXHJcbiAgICAgICAgZm9ybWF0SW5zdHJ1Y3Rpb25zLFxyXG4gICAgICAgIG1vbnRoUmVmZXJlbmNlcyxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zdCB7IGpvYklkLCBtZXNzYWdlIH0gPSByZXNwb25zZS5kYXRhO1xyXG4gICAgICBjb25zb2xlLmxvZyhg8J+agCBKb2IgaW5pY2lhZG86ICR7am9iSWR9YCk7XHJcblxyXG4gICAgICAvLyBTYWx2YXIgam9iIGUgaW5pY2lhciBwYWluZWwgZGUgcHJvZ3Jlc3NvXHJcbiAgICAgIHNldFBlbmRpbmdKb2JJZChqb2JJZCk7XHJcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdwZW5kaW5nQ2FsZW5kYXJKb2InLCBKU09OLnN0cmluZ2lmeSh7IGpvYklkLCBjbGllbnRJZCB9KSk7XHJcblxyXG4gICAgICAvLyBGZWNoYXIgbW9kYWwgZGUgY29uZmlndXJhw6fDo29cclxuICAgICAgc2V0U2hvd0dlbmVyYXRlTW9kYWwoZmFsc2UpO1xyXG5cclxuICAgICAgLy8gTGltcGFyIGNhbXBvc1xyXG4gICAgICBzZXRCcmllZmluZygnJyk7XHJcbiAgICAgIHNldEdlbmVyYXRpb25Qcm9tcHQoJycpO1xyXG4gICAgICBzZXRTcGVjaWZpY01vbnRocyhbXSk7XHJcbiAgICAgIHNldE1peCh7XHJcbiAgICAgICAgcmVlbHM6IDAsXHJcbiAgICAgICAgc3RhdGljOiAwLFxyXG4gICAgICAgIGNhcm91c2VsOiAwLFxyXG4gICAgICAgIHN0b3JpZXM6IDAsXHJcbiAgICAgICAgcGhvdG9zOiAwXHJcbiAgICAgIH0pO1xyXG5cclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcign4p2MIEVycm8gYW8gaW5pY2lhciBnZXJhw6fDo286JywgZXJyb3IpO1xyXG4gICAgICBhbGVydCgnRXJybyBhbyBpbmljaWFyIGdlcmHDp8OjbzogJyArIChlcnJvci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZXJyb3IubWVzc2FnZSkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0SXNHZW5lcmF0aW5nKGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBzYXZlQ2FsZW5kYXIgPSBhc3luYyAodXBkYXRlZFBvc3RzOiBQb3N0W10pID0+IHtcclxuICAgIGlmICghY2FsZW5kYXIpIHJldHVybjtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRJc1NhdmluZyh0cnVlKTtcclxuICAgICAgYXdhaXQgYXBpLnB1dChgL2NhbGVuZGFycy8ke2NhbGVuZGFyLmlkfWAsIHtcclxuICAgICAgICBwb3N0czogdXBkYXRlZFBvc3RzXHJcbiAgICAgIH0pO1xyXG4gICAgICBjb25zb2xlLmxvZygn4pyFIENhbGVuZMOhcmlvIHNhbHZvJyk7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBFcnJvIGFvIHNhbHZhciBjYWxlbmTDoXJpbzonLCBlcnJvcik7XHJcbiAgICAgIGFsZXJ0KCdFcnJvIGFvIHNhbHZhcjogJyArIChlcnJvci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZXJyb3IubWVzc2FnZSkpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0SXNTYXZpbmcoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIERyYWcgJiBEcm9wIEhhbmRsZXJcclxuICBjb25zdCBvbkRyYWdFbmQgPSAocmVzdWx0OiBEcm9wUmVzdWx0KSA9PiB7XHJcbiAgICBpZiAoIXJlc3VsdC5kZXN0aW5hdGlvbiB8fCAhY2FsZW5kYXIpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBzb3VyY2VEYXkgPSByZXN1bHQuc291cmNlLmRyb3BwYWJsZUlkO1xyXG4gICAgY29uc3QgZGVzdERheSA9IHJlc3VsdC5kZXN0aW5hdGlvbi5kcm9wcGFibGVJZDtcclxuXHJcbiAgICBpZiAoc291cmNlRGF5ID09PSBkZXN0RGF5KSByZXR1cm47XHJcblxyXG4gICAgLy8gRW5jb250cmFyIG8gcG9zdCBxdWUgZm9pIGFycmFzdGFkb1xyXG4gICAgY29uc3QgcG9zdEluZGV4ID0gcGFyc2VJbnQocmVzdWx0LmRyYWdnYWJsZUlkLnNwbGl0KCctJylbMV0pO1xyXG4gICAgY29uc3QgdXBkYXRlZFBvc3RzID0gWy4uLmNhbGVuZGFyLnBvc3RzXTtcclxuXHJcbiAgICAvLyBBdHVhbGl6YXIgYSBkYXRhIGRvIHBvc3RcclxuICAgIHVwZGF0ZWRQb3N0c1twb3N0SW5kZXhdID0ge1xyXG4gICAgICAuLi51cGRhdGVkUG9zdHNbcG9zdEluZGV4XSxcclxuICAgICAgZGF0YTogZGVzdERheVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBBdHVhbGl6YXIgZXN0YWRvIGxvY2FsXHJcbiAgICBzZXRDYWxlbmRhcih7IC4uLmNhbGVuZGFyLCBwb3N0czogdXBkYXRlZFBvc3RzIH0pO1xyXG5cclxuICAgIC8vIFNhbHZhciBubyBiYWNrZW5kXHJcbiAgICBzYXZlQ2FsZW5kYXIodXBkYXRlZFBvc3RzKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBvcGVuRWRpdE1vZGFsID0gKHBvc3Q6IFBvc3QsIGluZGV4OiBudW1iZXIpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCfwn5ax77iPIEFicmluZG8gbW9kYWwgcGFyYSBwb3N0OicsIHBvc3QpO1xyXG4gICAgY29uc29sZS5sb2coJ/Cfk4ogSW5kZXg6JywgaW5kZXgpO1xyXG4gICAgc2V0U2VsZWN0ZWRQb3N0KHsgcG9zdCwgaW5kZXggfSk7XHJcbiAgICBzZXRFZGl0VGVtYShwb3N0LnRlbWEgfHwgJycpO1xyXG4gICAgc2V0RWRpdENvcHkocG9zdC5jb3B5X3N1Z2VzdGFvIHx8ICcnKTtcclxuICAgIHNldEVkaXREYXRhKHBvc3QuZGF0YSB8fCAnJyk7XHJcbiAgICBzZXRFZGl0Rm9ybWF0byhwb3N0LmZvcm1hdG8gfHwgJycpO1xyXG4gICAgc2V0RWRpdElkZWlhVmlzdWFsKHBvc3QuaWRlaWFfdmlzdWFsIHx8ICcnKTtcclxuICAgIHNldEVkaXRPYmpldGl2byhwb3N0Lm9iamV0aXZvIHx8ICcnKTtcclxuICAgIHNldEVkaXRJbWFnZVByb21wdChwb3N0LmltYWdlX2dlbmVyYXRpb25fcHJvbXB0IHx8ICcnKTtcclxuICAgIHNldEVkaXRSZWZlcmVuY2lhcyhwb3N0LnJlZmVyZW5jaWFzIHx8ICcnKTtcclxuICAgIHNldEVkaXRTdGF0dXMocG9zdC5zdGF0dXMgfHwgJ3N1Z2VyaWRvJyk7XHJcbiAgICBzZXRSZWdlblBvc3RQcm9tcHQoXHJcbiAgICAgICdBZGFwdGUgZXN0ZSBjb250ZcO6ZG8gcGFyYSBvIG5vdm8gZm9ybWF0byBtYW50ZW5kbyBhIG1lc21hIGVzdHJhdMOpZ2lhLCBtYXMgb3RpbWl6YW5kbyBjb3B5LCBpZGVpYSB2aXN1YWwgZSBvYmpldGl2byBwYXJhIG1lbGhvciBkZXNlbXBlbmhvLidcclxuICAgICk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgY2xvc2VFZGl0TW9kYWwgPSAoKSA9PiB7XHJcbiAgICBzZXRTZWxlY3RlZFBvc3QobnVsbCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2F2ZVBvc3QgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIXNlbGVjdGVkUG9zdCB8fCAhY2FsZW5kYXIpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCB1cGRhdGVkUG9zdHMgPSBbLi4uY2FsZW5kYXIucG9zdHNdO1xyXG4gICAgdXBkYXRlZFBvc3RzW3NlbGVjdGVkUG9zdC5pbmRleF0gPSB7XHJcbiAgICAgIGRhdGE6IGVkaXREYXRhLFxyXG4gICAgICB0ZW1hOiBlZGl0VGVtYSxcclxuICAgICAgZm9ybWF0bzogZWRpdEZvcm1hdG8sXHJcbiAgICAgIGlkZWlhX3Zpc3VhbDogZWRpdElkZWlhVmlzdWFsLFxyXG4gICAgICBjb3B5X3N1Z2VzdGFvOiBlZGl0Q29weSxcclxuICAgICAgb2JqZXRpdm86IGVkaXRPYmpldGl2byxcclxuICAgICAgaW1hZ2VfZ2VuZXJhdGlvbl9wcm9tcHQ6IGVkaXRJbWFnZVByb21wdCxcclxuICAgICAgcmVmZXJlbmNpYXM6IGVkaXRSZWZlcmVuY2lhcyxcclxuICAgICAgc3RhdHVzOiBlZGl0U3RhdHVzXHJcbiAgICB9O1xyXG5cclxuICAgIHNldENhbGVuZGFyKHsgLi4uY2FsZW5kYXIsIHBvc3RzOiB1cGRhdGVkUG9zdHMgfSk7XHJcbiAgICBhd2FpdCBzYXZlQ2FsZW5kYXIodXBkYXRlZFBvc3RzKTtcclxuXHJcbiAgICBhbGVydCgn4pyFIFBvc3QgYXR1YWxpemFkbyBjb20gc3VjZXNzbyEnKTtcclxuICAgIGNsb3NlRWRpdE1vZGFsKCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZGVsZXRlUG9zdCA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY2FsZW5kYXIgfHwgIXNlbGVjdGVkUG9zdCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbmZpcm1EZWxldGUgPSB3aW5kb3cuY29uZmlybShcclxuICAgICAgJ1RlbSBjZXJ0ZXphIHF1ZSBkZXNlamEgZXhjbHVpciBlc3RlIHBvc3Q/IEVzc2EgYcOnw6NvIG7Do28gcG9kZSBzZXIgZGVzZmVpdGEuJ1xyXG4gICAgKTtcclxuXHJcbiAgICBpZiAoIWNvbmZpcm1EZWxldGUpIHJldHVybjtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRJc0RlbGV0aW5nUG9zdCh0cnVlKTtcclxuXHJcbiAgICAgIGF3YWl0IGFwaS5kZWxldGUoYC9jYWxlbmRhcnMvcG9zdC8ke2NhbGVuZGFyLmlkfS8ke3NlbGVjdGVkUG9zdC5pbmRleH1gKTtcclxuXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRQb3N0cyA9IGNhbGVuZGFyLnBvc3RzLmZpbHRlcigoXywgaSkgPT4gaSAhPT0gc2VsZWN0ZWRQb3N0LmluZGV4KTtcclxuICAgICAgc2V0Q2FsZW5kYXIoeyAuLi5jYWxlbmRhciwgcG9zdHM6IHVwZGF0ZWRQb3N0cyB9KTtcclxuXHJcbiAgICAgIGFsZXJ0KCfinIUgUG9zdCBleGNsdcOtZG8gY29tIHN1Y2Vzc28hJyk7XHJcbiAgICAgIHNldFNlbGVjdGVkUG9zdChudWxsKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcign4p2MIEVycm8gYW8gZXhjbHVpciBwb3N0OicsIGVycm9yKTtcclxuICAgICAgYWxlcnQoJ0Vycm8gYW8gZXhjbHVpciBwb3N0OiAnICsgKGVycm9yLnJlc3BvbnNlPy5kYXRhPy5lcnJvciB8fCBlcnJvci5tZXNzYWdlKSk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRJc0RlbGV0aW5nUG9zdChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gRnVuw6fDtWVzIGF1eGlsaWFyZXNcclxuICBjb25zdCBnZXRGb3JtYXRJY29uID0gKGZvcm1hdG86IHN0cmluZykgPT4ge1xyXG4gICAgY29uc3QgbG93ZXIgPSBmb3JtYXRvPy50b0xvd2VyQ2FzZSgpIHx8ICcnO1xyXG4gICAgaWYgKGxvd2VyLmluY2x1ZGVzKCdyZWVsJykpIHJldHVybiAn8J+OrCc7XHJcbiAgICBpZiAobG93ZXIuaW5jbHVkZXMoJ2NhcnJvc3NlbCcpKSByZXR1cm4gJ/Cfk7gnO1xyXG4gICAgaWYgKGxvd2VyLmluY2x1ZGVzKCdzdGF0aWMnKSkgcmV0dXJuICfwn5a877iPJztcclxuICAgIGlmIChsb3dlci5pbmNsdWRlcygnc3RvcmllcycpKSByZXR1cm4gJ/Cfk7EnO1xyXG4gICAgcmV0dXJuICfwn5OEJztcclxuICB9O1xyXG5cclxuICBjb25zdCBnZXRTdGF0dXNDb2xvciA9IChzdGF0dXM/OiBzdHJpbmcpID0+IHtcclxuICAgIHN3aXRjaCAoc3RhdHVzKSB7XHJcbiAgICAgIGNhc2UgJ2Fwcm92YWRvJzpcclxuICAgICAgICByZXR1cm4gJ2JvcmRlci1sLWdyZWVuLTUwMCBiZy1ncmVlbi01MDAvMTAnO1xyXG4gICAgICBjYXNlICdwdWJsaWNhZG8nOlxyXG4gICAgICAgIHJldHVybiAnYm9yZGVyLWwtYmx1ZS01MDAgYmctYmx1ZS01MDAvMTAnO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiAnYm9yZGVyLWwteWVsbG93LTUwMCBiZy15ZWxsb3ctNTAwLzEwJztcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBnZXRQb3N0c0ZvckRheSA9IChkYXlTdHI6IHN0cmluZyk6IHsgcG9zdDogUG9zdDsgaW5kZXg6IG51bWJlciB9W10gPT4ge1xyXG4gICAgaWYgKCFjYWxlbmRhcikgcmV0dXJuIFtdO1xyXG5cclxuICAgIHJldHVybiBjYWxlbmRhci5wb3N0c1xyXG4gICAgICAubWFwKChwb3N0LCBpbmRleCkgPT4gKHsgcG9zdCwgaW5kZXggfSkpXHJcbiAgICAgIC5maWx0ZXIoKHsgcG9zdCB9KSA9PiB7XHJcbiAgICAgICAgLy8gVGVudGFyIGZhemVyIG1hdGNoIGNvbSBkaWZlcmVudGVzIGZvcm1hdG9zIGRlIGRhdGFcclxuICAgICAgICBjb25zdCBwb3N0RGF0ZSA9IHBvc3QuZGF0YTtcclxuICAgICAgICByZXR1cm4gcG9zdERhdGUgPT09IGRheVN0ciB8fFxyXG4gICAgICAgICAgcG9zdERhdGUgPT09IGRheVN0ci5yZXBsYWNlKC9eMC8sICcnKSB8fCAvLyBSZW1vdmUgemVybyDDoCBlc3F1ZXJkYVxyXG4gICAgICAgICAgcG9zdERhdGUuaW5jbHVkZXMoZGF5U3RyKTtcclxuICAgICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gR2VyYXIgZGlhcyBkbyBtw6pzXHJcbiAgY29uc3QgbW9udGhTdGFydCA9IHN0YXJ0T2ZNb250aChjdXJyZW50TW9udGgpO1xyXG4gIGNvbnN0IG1vbnRoRW5kID0gZW5kT2ZNb250aChjdXJyZW50TW9udGgpO1xyXG4gIGNvbnN0IGRheXNJbk1vbnRoID0gZWFjaERheU9mSW50ZXJ2YWwoeyBzdGFydDogbW9udGhTdGFydCwgZW5kOiBtb250aEVuZCB9KTtcclxuXHJcbiAgLy8gQWRpY2lvbmFyIGRpYXMgdmF6aW9zIG5vIGluw61jaW8gcGFyYSBhbGluaGFyIGNvbSBvIGRpYSBkYSBzZW1hbmFcclxuICBjb25zdCBzdGFydERheU9mV2VlayA9IGdldERheShtb250aFN0YXJ0KTtcclxuICBjb25zdCBlbXB0eURheXMgPSBBcnJheShzdGFydERheU9mV2VlaykuZmlsbChudWxsKTtcclxuXHJcbiAgaWYgKGxvYWRpbmcpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLWdyYXktOTAwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlIHRleHQteGxcIj5DYXJyZWdhbmRvIGNhbGVuZMOhcmlvLi4uPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIEVzdGFkbzogTmVuaHVtIGNhbGVuZMOhcmlvIHBhcmEgZXN0ZSBtw6pzXHJcbiAgaWYgKCFjYWxlbmRhcikge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJtaW4taC1zY3JlZW4gYmctZ3JheS05MDAgdGV4dC13aGl0ZSBwLThcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1heC13LTR4bCBteC1hdXRvXCI+XHJcbiAgICAgICAgICB7LyogSGVhZGVyIGNvbSBuYXZlZ2HDp8OjbyAqL31cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItOCBmbGV4IGZsZXgtY29sIG1kOmZsZXgtcm93IG1kOml0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTRcIj5cclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0zeGwgZm9udC1ib2xkIG1iLTFcIj7wn5OFIENhbGVuZMOhcmlvIEVkaXRvcmlhbDwvaDE+XHJcbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnXCI+XHJcbiAgICAgICAgICAgICAgICB7Zm9ybWF0KGN1cnJlbnRNb250aCwgJ01NTU0geXl5eScsIHsgbG9jYWxlOiBwdEJSIH0pfVxyXG4gICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICB7LyogTmF2ZWdhw6fDo28gZGUgbcOqcyAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEN1cnJlbnRNb250aChzdWJNb250aHMoY3VycmVudE1vbnRoLCAxKSl9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJwLTMgaG92ZXI6YmctZ3JheS04MDAgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICB0aXRsZT1cIk3DqnMgYW50ZXJpb3JcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIOKGkCBBbnRlcmlvclxyXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyIG1pbi13LVsyMDBweF1cIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LXNlbWlib2xkXCI+XHJcbiAgICAgICAgICAgICAgICAgIHtmb3JtYXQoY3VycmVudE1vbnRoLCAnTU1NTSB5eXl5JywgeyBsb2NhbGU6IHB0QlIgfSl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0Q3VycmVudE1vbnRoKGFkZE1vbnRocyhjdXJyZW50TW9udGgsIDEpKX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMyBob3ZlcjpiZy1ncmF5LTgwMCByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgIHRpdGxlPVwiUHLDs3hpbW8gbcOqc1wiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgUHLDs3hpbW8g4oaSXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgey8qIFDDoWdpbmEgZGUgY3JpYcOnw6NvICovfVxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMC81MCBiYWNrZHJvcC1ibHVyLXNtIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTEyIHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC02eGwgbWItNlwiPvCfk608L2Rpdj5cclxuICAgICAgICAgICAgPGgyIGNsYXNzTmFtZT1cInRleHQtM3hsIGZvbnQtYm9sZCBtYi00XCI+TmVuaHVtIENhbGVuZMOhcmlvIHBhcmEgZXN0ZSBNw6pzPC9oMj5cclxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCBtYi04IHRleHQtbGcgbWF4LXctMnhsIG14LWF1dG9cIj5cclxuICAgICAgICAgICAgICBDcmllIHVtIGNhbGVuZMOhcmlvIGVkaXRvcmlhbCBwZXJzb25hbGl6YWRvIHBhcmEge2Zvcm1hdChjdXJyZW50TW9udGgsICdNTU1NIHl5eXknLCB7IGxvY2FsZTogcHRCUiB9KX1cclxuICAgICAgICAgICAgICBjb20gcG9zdHMgb3RpbWl6YWRvcyBwYXJhIHN1YXMgcmVkZXMgc29jaWFpcy5cclxuICAgICAgICAgICAgPC9wPlxyXG5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTZcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTMgZ2FwLTQgdGV4dC1sZWZ0XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktNzAwLzUwIHAtNCByb3VuZGVkLWxnXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC0yeGwgbWItMlwiPvCfjqw8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkXCI+UmVlbHMgJiBWw61kZW9zPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+Q29udGXDumRvIGRpbsOibWljbyBlIGVudm9sdmVudGU8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTcwMC81MCBwLTQgcm91bmRlZC1sZ1wiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtMnhsIG1iLTJcIj7wn5O4PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZFwiPlBvc3RzIEVzdMOhdGljb3M8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5JbWFnZW5zIGltcGFjdGFudGVzPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS03MDAvNTAgcC00IHJvdW5kZWQtbGdcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBtYi0yXCI+8J+TsTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGRcIj5TdG9yaWVzICYgQ2Fycm9zc8OpaXM8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Db250ZcO6ZG8gc2VxdWVuY2lhbDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtvcGVuR2VuZXJhdGVNb2RhbH1cclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIGJnLWdyYWRpZW50LXRvLXIgZnJvbS1ibHVlLTYwMCB0by1wdXJwbGUtNjAwIGhvdmVyOmZyb20tYmx1ZS03MDAgaG92ZXI6dG8tcHVycGxlLTcwMCBweC0xMiBweS00IHJvdW5kZWQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LWxnIHRyYW5zaXRpb24tYWxsIHRyYW5zZm9ybSBob3ZlcjpzY2FsZS0xMDVcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICDinKggQ3JpYXIgQ2FsZW5kw6FyaW8gcGFyYSBlc3RlIE3DqnNcclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UGhvdG9JZGVhc01vZGFsKHRydWUpfVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmFkaWVudC10by1yIGZyb20teWVsbG93LTUwMCB0by1hbWJlci01MDAgaG92ZXI6ZnJvbS15ZWxsb3ctNjAwIGhvdmVyOnRvLWFtYmVyLTYwMCBweC04IHB5LTQgcm91bmRlZC1sZyBmb250LXNlbWlib2xkIHRleHQtbGcgdHJhbnNpdGlvbi1hbGwgdHJhbnNmb3JtIGhvdmVyOnNjYWxlLTEwNVwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIPCfk7ggSWRlaWFzIGRlIEZvdG9zXHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgey8qIE1vZGFsIGRlIEdlcmHDp8OjbyDigJQgYnJhbmNoIHNlbSBjYWxlbmTDoXJpbyAqL31cclxuICAgICAgICB7c2hvd0dlbmVyYXRlTW9kYWwgJiYgKFxyXG4gICAgICAgICAgPEdlbmVyYXRlTW9kYWxcclxuICAgICAgICAgICAgbWl4PXttaXh9XHJcbiAgICAgICAgICAgIHNldE1peD17c2V0TWl4fVxyXG4gICAgICAgICAgICBicmllZmluZz17YnJpZWZpbmd9XHJcbiAgICAgICAgICAgIHNldEJyaWVmaW5nPXtzZXRCcmllZmluZ31cclxuICAgICAgICAgICAgZ2VuZXJhdGlvblByb21wdD17Z2VuZXJhdGlvblByb21wdH1cclxuICAgICAgICAgICAgc2V0R2VuZXJhdGlvblByb21wdD17c2V0R2VuZXJhdGlvblByb21wdH1cclxuICAgICAgICAgICAgcGVyaW9kb0RpYXM9e3BlcmlvZG9EaWFzfVxyXG4gICAgICAgICAgICBzZXRQZXJpb2RvRGlhcz17c2V0UGVyaW9kb0RpYXN9XHJcbiAgICAgICAgICAgIGJhc2VNb250aERhdGU9e2N1cnJlbnRNb250aH1cclxuICAgICAgICAgICAgc3BlY2lmaWNNb250aHM9e3NwZWNpZmljTW9udGhzfVxyXG4gICAgICAgICAgICBzZXRTcGVjaWZpY01vbnRocz17c2V0U3BlY2lmaWNNb250aHN9XHJcbiAgICAgICAgICAgIGZvcm1hdEluc3RydWN0aW9ucz17Zm9ybWF0SW5zdHJ1Y3Rpb25zfVxyXG4gICAgICAgICAgICBzZXRGb3JtYXRJbnN0cnVjdGlvbnM9e3NldEZvcm1hdEluc3RydWN0aW9uc31cclxuICAgICAgICAgICAgcHJvbXB0Q2hhaW5zPXtwcm9tcHRDaGFpbnN9XHJcbiAgICAgICAgICAgIHNlbGVjdGVkQ2hhaW5JZD17c2VsZWN0ZWRDaGFpbklkfVxyXG4gICAgICAgICAgICBzZXRTZWxlY3RlZENoYWluSWQ9e3NldFNlbGVjdGVkQ2hhaW5JZH1cclxuICAgICAgICAgICAgaXNHZW5lcmF0aW5nPXtpc0dlbmVyYXRpbmd9XHJcbiAgICAgICAgICAgIG9uR2VuZXJhdGU9e2dlbmVyYXRlQ2FsZW5kYXJ9XHJcbiAgICAgICAgICAgIG9uQ2xvc2U9eygpID0+IHNldFNob3dHZW5lcmF0ZU1vZGFsKGZhbHNlKX1cclxuICAgICAgICAgIC8+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIFBhaW5lbCBkZSBQcm9ncmVzc28gZGEgR2VyYcOnw6NvIOKAlCBicmFuY2ggc2VtIGNhbGVuZMOhcmlvICovfVxyXG4gICAgICAgIHtwZW5kaW5nSm9iSWQgJiYgY2xpZW50SWQgJiYgam9iICYmIChcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy1mdWxsIG1heC13LTR4bCBtdC02XCI+XHJcbiAgICAgICAgICAgIDxKb2JQcm9ncmVzc1BhbmVsXHJcbiAgICAgICAgICAgICAgam9iPXtqb2J9XHJcbiAgICAgICAgICAgICAgb25DYW5jZWw9e2hhbmRsZUpvYkNhbmNlbEJ0bn1cclxuICAgICAgICAgICAgICBvbkRpc21pc3NQYW5lbD17KCkgPT4gc2V0UGVuZGluZ0pvYklkKG51bGwpfVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIE1vZGFsIGRlIElkZWlhcyBkZSBGb3RvcyAqL31cclxuICAgICAgICA8UGhvdG9JZGVhc01vZGFsXHJcbiAgICAgICAgICBpc09wZW49e3Nob3dQaG90b0lkZWFzTW9kYWx9XHJcbiAgICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRTaG93UGhvdG9JZGVhc01vZGFsKGZhbHNlKX1cclxuICAgICAgICAgIGNsaWVudGVJZD17Y2xpZW50SWQgfHwgJyd9XHJcbiAgICAgICAgICBtZXM9e2Zvcm1hdChjdXJyZW50TW9udGgsICdNTU1NJywgeyBsb2NhbGU6IHB0QlIgfSl9XHJcbiAgICAgICAgICBicmllZmluZz17YnJpZWZpbmd9XHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIChcclxuICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLWdyYXktOTAwIHRleHQtd2hpdGUgcC00IG1kOnAtOFwiPlxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1heC13LTd4bCBteC1hdXRvXCI+XHJcbiAgICAgICAgey8qIFBhaW5lbCBkZSBQcm9ncmVzc28gZGEgR2VyYcOnw6NvIOKAlCBicmFuY2ggY29tIGNhbGVuZMOhcmlvICovfVxyXG4gICAgICAgIHtwZW5kaW5nSm9iSWQgJiYgY2xpZW50SWQgJiYgam9iICYmIChcclxuICAgICAgICAgIDxKb2JQcm9ncmVzc1BhbmVsXHJcbiAgICAgICAgICAgIGpvYj17am9ifVxyXG4gICAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlSm9iQ2FuY2VsQnRufVxyXG4gICAgICAgICAgICBvbkRpc21pc3NQYW5lbD17KCkgPT4gc2V0UGVuZGluZ0pvYklkKG51bGwpfVxyXG4gICAgICAgICAgLz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7LyogSGVhZGVyICovfVxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItNiBmbGV4IGZsZXgtY29sIG1kOmZsZXgtcm93IG1kOml0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgbm8tcHJpbnRcIj5cclxuICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgIDxoMSBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBtZDp0ZXh0LTN4bCBmb250LWJvbGQgbWItMVwiPvCfk4UgQ2FsZW5kw6FyaW8gRWRpdG9yaWFsPC9oMT5cclxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXNtIG1kOnRleHQtYmFzZVwiPlxyXG4gICAgICAgICAgICAgIHtjYWxlbmRhci5wb3N0cy5sZW5ndGh9IHBvc3RzIHBsYW5lamFkb3Mg4oCiIEFycmFzdGUgcGFyYSByZW9yZ2FuaXphclxyXG4gICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XHJcbiAgICAgICAgICAgIHtpc1NhdmluZyAmJiAoXHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC15ZWxsb3ctNDAwIHRleHQtc20gYW5pbWF0ZS1wdWxzZVwiPvCfkr4gU2FsdmFuZG8uLi48L3NwYW4+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIHtpc0RlbGV0aW5nICYmIChcclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC00MDAgdGV4dC1zbSBhbmltYXRlLXB1bHNlXCI+8J+Xke+4jyBFeGNsdWluZG8uLi48L3NwYW4+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBvbkNsaWNrPXtvcGVuRXhwb3J0TW9kYWx9XHJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgcHgtNCBweS0yIHJvdW5kZWQtbGcgZm9udC1zZW1pYm9sZCB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LXNtXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIPCfk4ogRXhwb3J0YXIgRXhjZWxcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBvbkNsaWNrPXtkZWxldGVDYWxlbmRhcn1cclxuICAgICAgICAgICAgICBkaXNhYmxlZD17aXNEZWxldGluZ31cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1yZWQtNjAwIGhvdmVyOmJnLXJlZC03MDAgZGlzYWJsZWQ6YmctcmVkLTgwMCBweC00IHB5LTIgcm91bmRlZC1sZyBmb250LXNlbWlib2xkIHRyYW5zaXRpb24tY29sb3JzIHRleHQtc20gZGlzYWJsZWQ6b3BhY2l0eS01MFwiXHJcbiAgICAgICAgICAgICAgdGl0bGU9XCJFeGNsdWlyIGNhbGVuZMOhcmlvIGNvbXBsZXRvXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIPCfl5HvuI8gRXhjbHVpclxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e29wZW5HZW5lcmF0ZU1vZGFsfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWJsdWUtNjAwIGhvdmVyOmJnLWJsdWUtNzAwIHB4LTQgcHktMiByb3VuZGVkLWxnIGZvbnQtc2VtaWJvbGQgdHJhbnNpdGlvbi1jb2xvcnMgdGV4dC1zbVwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICArIEdlcmFyIE5vdm9cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgey8qIE5hdmVnYcOnw6NvIGRvIE3DqnMgKi99XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIGxnOmdyaWQtY29scy0yIGdhcC00IG1iLTZcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGJnLWdyYXktODAwLzUwIHJvdW5kZWQteGwgcC00IG5vLXByaW50XCI+XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRDdXJyZW50TW9udGgoc3ViTW9udGhzKGN1cnJlbnRNb250aCwgMSkpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBob3ZlcjpiZy1ncmF5LTcwMCByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIOKGkCBBbnRlcmlvclxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuXHJcbiAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LXhsIGZvbnQtYm9sZCBjYXBpdGFsaXplXCI+XHJcbiAgICAgICAgICAgICAge2Zvcm1hdChjdXJyZW50TW9udGgsICdNTU1NIHl5eXknLCB7IGxvY2FsZTogcHRCUiB9KX1cclxuICAgICAgICAgICAgPC9oMj5cclxuXHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRDdXJyZW50TW9udGgoYWRkTW9udGhzKGN1cnJlbnRNb250aCwgMSkpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBob3ZlcjpiZy1ncmF5LTcwMCByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIFByw7N4aW1vIOKGklxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICB7LyogQ2FyZCBkZSBSZWZlcsOqbmNpYXMgZG8gTcOqcyAqL31cclxuICAgICAgICB7KG1vbnRoUmVmZXJlbmNlcyB8fCBtb250aEltYWdlcy5sZW5ndGggPiAwKSA/IChcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItNiBiZy1ncmFkaWVudC10by1yIGZyb20tcHVycGxlLTkwMC8yMCB0by1ibHVlLTkwMC8yMCBib3JkZXIgYm9yZGVyLXB1cnBsZS01MDAvMzAgcm91bmRlZC14bCBwLTQgbm8tcHJpbnRcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBtYi0yXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14bFwiPvCfk448L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtcHVycGxlLTMwMFwiPlJlZmVyw6puY2lhcyBkbyBNw6pzPC9oMz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93TW9udGhSZWZlcmVuY2VzTW9kYWwodHJ1ZSl9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtYmx1ZS00MDAgaG92ZXI6dGV4dC1ibHVlLTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAg4pyP77iPIEVkaXRhclxyXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBUZXh0byAqL31cclxuICAgICAgICAgICAge21vbnRoUmVmZXJlbmNlcyAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS0zMDAgd2hpdGVzcGFjZS1wcmUtd3JhcCBtYi0zXCI+XHJcbiAgICAgICAgICAgICAgICB7bW9udGhSZWZlcmVuY2VzfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgey8qIENhcnJvc3NlbCBkZSBJbWFnZW5zICovfVxyXG4gICAgICAgICAgICB7bW9udGhJbWFnZXMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGdhcC0yIG92ZXJmbG93LXgtYXV0byBwYi0yIGN1c3RvbS1zY3JvbGxiYXJcIj5cclxuICAgICAgICAgICAgICAgIHttb250aEltYWdlcy5tYXAoKHVybCwgaSkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aX0gY2xhc3NOYW1lPVwiZmxleC1zaHJpbmstMCB3LTI0IGgtMjQgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4gYm9yZGVyIGJvcmRlci1ncmF5LTcwMCBiZy1ncmF5LTkwMCBjdXJzb3ItcG9pbnRlciBob3Zlcjpib3JkZXItcHVycGxlLTUwMCB0cmFuc2l0aW9uLWNvbG9yc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxhIGhyZWY9e3VybH0gdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGltZyBzcmM9e3VybH0gYWx0PXtgUmVmICR7aX1gfSBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1mdWxsIG9iamVjdC1jb3ZlclwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgKSA6IChcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItNiBiZy1ncmF5LTgwMC8zMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwLzUwIHJvdW5kZWQteGwgcC00IG5vLXByaW50XCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LWdyYXktNTAwXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhsXCI+8J+Tjjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc21cIj5OZW5odW1hIHJlZmVyw6puY2lhIHBhcmEgZXN0ZSBtw6pzPC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dNb250aFJlZmVyZW5jZXNNb2RhbCh0cnVlKX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ibHVlLTQwMCBob3Zlcjp0ZXh0LWJsdWUtMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICArIEFkaWNpb25hciBSZWZlcsOqbmNpYXNcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7LyogTGVnZW5kYSAqL31cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTQgZmxleCBmbGV4LXdyYXAgZ2FwLTQgdGV4dC14cyBtZDp0ZXh0LXNtIG5vLXByaW50XCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0zIGgtMyByb3VuZGVkLWZ1bGwgYmcteWVsbG93LTUwMFwiPjwvZGl2PlxyXG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+U3VnZXJpZG88L3NwYW4+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTMgaC0zIHJvdW5kZWQtZnVsbCBiZy1ncmVlbi01MDBcIj48L2Rpdj5cclxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMFwiPkFwcm92YWRvPC9zcGFuPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0zIGgtMyByb3VuZGVkLWZ1bGwgYmctYmx1ZS01MDBcIj48L2Rpdj5cclxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMFwiPlB1YmxpY2Fkbzwvc3Bhbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICB7LyogR3JpZCBkbyBDYWxlbmTDoXJpbyAqL31cclxuICAgICAgICA8RHJhZ0Ryb3BDb250ZXh0IG9uRHJhZ0VuZD17b25EcmFnRW5kfT5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHJpbnQtY2FsZW5kYXJcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMC8zMCByb3VuZGVkLXhsIG92ZXJmbG93LWhpZGRlbiBib3JkZXIgYm9yZGVyLWdyYXktNzAwXCI+XHJcbiAgICAgICAgICAgICAgey8qIEhlYWRlciBkb3MgZGlhcyBkYSBzZW1hbmEgKi99XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy03IGJnLWdyYXktODAwXCI+XHJcbiAgICAgICAgICAgICAgICB7V0VFS0RBWVMubWFwKChkYXkpID0+IChcclxuICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgIGtleT17ZGF5fVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBtZDpwLTMgdGV4dC1jZW50ZXIgdGV4dC14cyBtZDp0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTQwMCBib3JkZXItYiBib3JkZXItZ3JheS03MDBcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAge2RheX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIEdyaWQgZG9zIGRpYXMgKi99XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy03XCI+XHJcbiAgICAgICAgICAgICAgICB7LyogRGlhcyB2YXppb3Mgbm8gaW7DrWNpbyAqL31cclxuICAgICAgICAgICAgICAgIHtlbXB0eURheXMubWFwKChfLCBpbmRleCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAga2V5PXtgZW1wdHktJHtpbmRleH1gfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cIm1pbi1oLVsxMDBweF0gbWQ6bWluLWgtWzE0MHB4XSBiZy1ncmF5LTkwMC81MCBib3JkZXItYiBib3JkZXItciBib3JkZXItZ3JheS03MDAvNTBcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgKSl9XHJcblxyXG4gICAgICAgICAgICAgICAgey8qIERpYXMgZG8gbcOqcyAqL31cclxuICAgICAgICAgICAgICAgIHtkYXlzSW5Nb250aC5tYXAoKGRheSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBkYXlTdHIgPSBmb3JtYXQoZGF5LCAnZGQvTU0nKTtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgZGF5UG9zdHMgPSBnZXRQb3N0c0ZvckRheShkYXlTdHIpO1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBpc0N1cnJlbnREYXkgPSBpc1RvZGF5KGRheSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgIDxEcm9wcGFibGUgZHJvcHBhYmxlSWQ9e2RheVN0cn0ga2V5PXtkYXlTdHJ9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgeyhwcm92aWRlZCwgc25hcHNob3QpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17cHJvdmlkZWQuaW5uZXJSZWZ9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgey4uLnByb3ZpZGVkLmRyb3BwYWJsZVByb3BzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YG1pbi1oLVsxMDBweF0gbWQ6bWluLWgtWzE0MHB4XSBwLTEgbWQ6cC0yIGJvcmRlci1iIGJvcmRlci1yIGJvcmRlci1ncmF5LTcwMC81MCB0cmFuc2l0aW9uLWNvbG9ycyAke3NuYXBzaG90LmlzRHJhZ2dpbmdPdmVyID8gJ2JnLWJsdWUtNTAwLzIwJyA6ICcnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9ICR7aXNDdXJyZW50RGF5ID8gJ2JnLWJsdWUtOTAwLzIwJyA6ICcnfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7LyogTsO6bWVybyBkbyBkaWEgKi99XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2B0ZXh0LXhzIG1kOnRleHQtc20gZm9udC1zZW1pYm9sZCBtYi0xICR7aXNDdXJyZW50RGF5ID8gJ3RleHQtYmx1ZS00MDAnIDogJ3RleHQtZ3JheS00MDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0KGRheSwgJ2QnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgey8qIFBvc3RzIGRvIGRpYSAqL31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2RheVBvc3RzLm1hcCgoeyBwb3N0LCBpbmRleCB9LCBpKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxEcmFnZ2FibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2Bwb3N0LSR7aW5kZXh9YH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmFnZ2FibGVJZD17YHBvc3QtJHtpbmRleH1gfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4PXtpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyhwcm92aWRlZCwgc25hcHNob3QpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVmPXtwcm92aWRlZC5pbm5lclJlZn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgey4uLnByb3ZpZGVkLmRyYWdnYWJsZVByb3BzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Li4ucHJvdmlkZWQuZHJhZ0hhbmRsZVByb3BzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBvcGVuRWRpdE1vZGFsKHBvc3QsIGluZGV4KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcC0xLjUgbWQ6cC0yIHJvdW5kZWQtbWQgYm9yZGVyLWwtNCBjdXJzb3ItcG9pbnRlciB0cmFuc2l0aW9uLWFsbCB0ZXh0LXhzICR7Z2V0U3RhdHVzQ29sb3IocG9zdC5zdGF0dXMpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSAke3NuYXBzaG90LmlzRHJhZ2dpbmcgPyAnc2hhZG93LWxnIHNjYWxlLTEwNSBvcGFjaXR5LTkwJyA6ICdob3ZlcjpzY2FsZS1bMS4wMl0nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgbWItMC41XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbVwiPntnZXRGb3JtYXRJY29uKHBvc3QuZm9ybWF0byl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtIHRydW5jYXRlIHRleHQtWzEwcHhdIG1kOnRleHQteHNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtwb3N0LmZvcm1hdG99XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIG1kOnRleHQteHMgdGV4dC1ncmF5LTMwMCB0cnVuY2F0ZSBmbGV4LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtwb3N0LnRlbWF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3Bvc3QucmVmZXJlbmNpYXMgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14c1wiIHRpdGxlPVwiVGVtIHJlZmVyw6puY2lhc1wiPvCfk448L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L0RyYWdnYWJsZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtwcm92aWRlZC5wbGFjZWhvbGRlcn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvRHJvcHBhYmxlPlxyXG4gICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgfSl9XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9EcmFnRHJvcENvbnRleHQ+XHJcblxyXG4gICAgICAgIHsvKiBNb2RhbCBkZSBHZXJhw6fDo28g4oCUIGJyYW5jaCBjb20gY2FsZW5kw6FyaW8gKi99XHJcbiAgICAgICAge3Nob3dHZW5lcmF0ZU1vZGFsICYmIChcclxuICAgICAgICAgIDxHZW5lcmF0ZU1vZGFsXHJcbiAgICAgICAgICAgIG1peD17bWl4fVxyXG4gICAgICAgICAgICBzZXRNaXg9e3NldE1peH1cclxuICAgICAgICAgICAgYnJpZWZpbmc9e2JyaWVmaW5nfVxyXG4gICAgICAgICAgICBzZXRCcmllZmluZz17c2V0QnJpZWZpbmd9XHJcbiAgICAgICAgICAgIGdlbmVyYXRpb25Qcm9tcHQ9e2dlbmVyYXRpb25Qcm9tcHR9XHJcbiAgICAgICAgICAgIHNldEdlbmVyYXRpb25Qcm9tcHQ9e3NldEdlbmVyYXRpb25Qcm9tcHR9XHJcbiAgICAgICAgICAgIHBlcmlvZG9EaWFzPXtwZXJpb2RvRGlhc31cclxuICAgICAgICAgICAgc2V0UGVyaW9kb0RpYXM9e3NldFBlcmlvZG9EaWFzfVxyXG4gICAgICAgICAgICBiYXNlTW9udGhEYXRlPXtjdXJyZW50TW9udGh9XHJcbiAgICAgICAgICAgIHNwZWNpZmljTW9udGhzPXtzcGVjaWZpY01vbnRoc31cclxuICAgICAgICAgICAgc2V0U3BlY2lmaWNNb250aHM9e3NldFNwZWNpZmljTW9udGhzfVxyXG4gICAgICAgICAgICBmb3JtYXRJbnN0cnVjdGlvbnM9e2Zvcm1hdEluc3RydWN0aW9uc31cclxuICAgICAgICAgICAgc2V0Rm9ybWF0SW5zdHJ1Y3Rpb25zPXtzZXRGb3JtYXRJbnN0cnVjdGlvbnN9XHJcbiAgICAgICAgICAgIHByb21wdENoYWlucz17cHJvbXB0Q2hhaW5zfVxyXG4gICAgICAgICAgICBzZWxlY3RlZENoYWluSWQ9e3NlbGVjdGVkQ2hhaW5JZH1cclxuICAgICAgICAgICAgc2V0U2VsZWN0ZWRDaGFpbklkPXtzZXRTZWxlY3RlZENoYWluSWR9XHJcbiAgICAgICAgICAgIGlzR2VuZXJhdGluZz17aXNHZW5lcmF0aW5nfVxyXG4gICAgICAgICAgICBvbkdlbmVyYXRlPXtnZW5lcmF0ZUNhbGVuZGFyfVxyXG4gICAgICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRTaG93R2VuZXJhdGVNb2RhbChmYWxzZSl9XHJcbiAgICAgICAgICAvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBNb2RhbCBkZSBQcm9ncmVzc28gZGEgR2VyYcOnw6NvIOKAlCBicmFuY2ggY29tIGNhbGVuZMOhcmlvICovfVxyXG4gICAgICAgIHtpc0pvYk1vZGFsT3BlbiAmJiBwZW5kaW5nSm9iSWQgJiYgY2xpZW50SWQgJiYgKFxyXG4gICAgICAgICAgPENhbGVuZGFyR2VuZXJhdGlvblByb2dyZXNzTW9kYWxcclxuICAgICAgICAgICAgam9iSWQ9e3BlbmRpbmdKb2JJZH1cclxuICAgICAgICAgICAgY2xpZW50SWQ9e2NsaWVudElkfVxyXG4gICAgICAgICAgICBzdGF0dXM9e2pvYlN0YXR1c31cclxuICAgICAgICAgICAgcHJvZ3Jlc3M9e2pvYlByb2dyZXNzfVxyXG4gICAgICAgICAgICBzdGVwRGVzY3JpcHRpb249e2pvYlN0ZXBEZXNjcmlwdGlvbn1cclxuICAgICAgICAgICAgcG9sbGluZ0Vycm9yPXtqb2JQb2xsaW5nRXJyb3J9XHJcbiAgICAgICAgICAgIGlzUG9sbGluZz17am9iSXNQb2xsaW5nfVxyXG4gICAgICAgICAgICBvbkNsb3NlPXtoYW5kbGVKb2JDbG9zZX1cclxuICAgICAgICAgICAgb25TdWNjZXNzPXtoYW5kbGVKb2JTdWNjZXNzfVxyXG4gICAgICAgICAgLz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7c2hvd0V4cG9ydE1vZGFsICYmIGNhbGVuZGFyICYmIChcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1ibGFjay83MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB6LTUwIHAtNFwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIHJvdW5kZWQteGwgcC02IHctZnVsbCBtYXgtdy0yeGwgYm9yZGVyIGJvcmRlci1ncmF5LTcwMFwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgbWItNFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQteGwgZm9udC1ib2xkIHRleHQtd2hpdGVcIj7wn5OKIEV4cG9ydGFyIEV4Y2VsPC9oMz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNDAwIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICBTZWxlY2lvbmUgb3MgbWVzZXMgcXVlIGRlc2VqYSBpbmNsdWlyIG5hIGV4cG9ydGHDp8Ojb1xyXG4gICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd0V4cG9ydE1vZGFsKGZhbHNlKX1cclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LXdoaXRlIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgICAgdGl0bGU9XCJGZWNoYXJcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICDinJVcclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNCBtYi01XCI+XHJcbiAgICAgICAgICAgICAgICB7Z2V0RXhwb3J0TW9udGhPcHRpb25zKGNhbGVuZGFyKS5sZW5ndGggPT09IDAgPyAoXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktMzAwIGJnLWdyYXktOTAwLzUwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyBwLTQgdGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICDimqDvuI8gTmVuaHVtIG3DqnMgZGV0ZWN0YWRvIChwb3N0cyBzZW0gZGF0YSBlbSBmb3JtYXRvIHJlY29uaGVjw612ZWwpLlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtd3JhcCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxNb250aHMgPSBnZXRFeHBvcnRNb250aE9wdGlvbnMoY2FsZW5kYXIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldEV4cG9ydE1vbnRoc1NlbGVjdGVkKGFsbE1vbnRocyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgcHgtMyBweS0xLjUgYmctYmx1ZS02MDAvMjAgaG92ZXI6YmctYmx1ZS02MDAvMzAgdGV4dC1ibHVlLTQwMCByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAg4pyTIFNlbGVjaW9uYXIgVG9kb3NcclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRFeHBvcnRNb250aHNTZWxlY3RlZChbXSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgcHgtMyBweS0xLjUgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC1ncmF5LTMwMCByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAg4pyVIExpbXBhciBTZWxlw6fDo29cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICB7KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzVHJpID0gTnVtYmVyKGNhbGVuZGFyLnBlcmlvZG8pID49IDkwIHx8IE51bWJlcihjYWxlbmRhci5wZXJpb2RvKSA9PT0gMztcclxuICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNUcmkpIHJldHVybiBudWxsO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VNb250aCA9IHBhcnNlTW9udGhMYWJlbFRvTnVtYmVyKGNhbGVuZGFyLm1lcykgfHwgKGN1cnJlbnRNb250aC5nZXRNb250aCgpICsgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtMSA9IGJhc2VNb250aDtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG0yID0gYmFzZU1vbnRoID09PSAxMiA/IDEgOiBiYXNlTW9udGggKyAxO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgbTMgPSBiYXNlTW9udGggPj0gMTEgPyAoKGJhc2VNb250aCArIDIpICUgMTIgfHwgMTIpIDogYmFzZU1vbnRoICsgMjtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyaU1vbnRocyA9IFttMSwgbTIsIG0zXS5zb3J0KChhLCBiKSA9PiBhIC0gYik7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1RyaVNlbGVjdGVkID0gdHJpTW9udGhzLmV2ZXJ5KChtKSA9PiBleHBvcnRNb250aHNTZWxlY3RlZC5pbmNsdWRlcyhtKSkgJiYgZXhwb3J0TW9udGhzU2VsZWN0ZWQubGVuZ3RoID09PSAzO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBnZXRFeHBvcnRNb250aE9wdGlvbnMoY2FsZW5kYXIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWx0ZXJlZCA9IHRyaU1vbnRocy5maWx0ZXIoKG0pID0+IG9wdGlvbnMuaW5jbHVkZXMobSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRFeHBvcnRNb250aHNTZWxlY3RlZChmaWx0ZXJlZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgdGV4dC14cyBweC0zIHB5LTEuNSByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGJvcmRlciAke2lzVHJpU2VsZWN0ZWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnYmctYmx1ZS02MDAgdGV4dC13aGl0ZSBib3JkZXItYmx1ZS00MDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktOTAwLzUwIHRleHQtZ3JheS0zMDAgYm9yZGVyLWdyYXktNzAwIGhvdmVyOmJvcmRlci1ibHVlLTUwMC81MCBob3ZlcjpiZy1ncmF5LTkwMCdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIlNlbGVjaW9uYXIgbyB0cmltZXN0cmUgZG8gY2FsZW5kw6FyaW9cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNlbGVjaW9uYXIgVHJpbWVzdHJlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICB9KSgpfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTMgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtnZXRFeHBvcnRNb250aE9wdGlvbnMoY2FsZW5kYXIpLm1hcCgobSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGVja2VkID0gZXhwb3J0TW9udGhzU2VsZWN0ZWQuaW5jbHVkZXMobSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXttfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hlY2tlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEV4cG9ydE1vbnRoc1NlbGVjdGVkKChwcmV2KSA9PiBwcmV2LmZpbHRlcigoeCkgPT4geCAhPT0gbSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEV4cG9ydE1vbnRoc1NlbGVjdGVkKChwcmV2KSA9PiBBcnJheS5mcm9tKG5ldyBTZXQoWy4uLnByZXYsIG1dKSkuc29ydCgoYSwgYikgPT4gYSAtIGIpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGl2ZSBweC00IHB5LTMgcm91bmRlZC1sZyBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWFsbCB0ZXh0LXNtXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7Y2hlY2tlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gJ2JnLWJsdWUtNjAwIHRleHQtd2hpdGUgc2hhZG93LWxnIHNoYWRvdy1ibHVlLTUwMC8zMCBib3JkZXItMiBib3JkZXItYmx1ZS00MDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS05MDAvNTAgdGV4dC1ncmF5LTMwMCBib3JkZXItMiBib3JkZXItZ3JheS03MDAgaG92ZXI6Ym9yZGVyLWJsdWUtNTAwLzUwIGhvdmVyOmJnLWdyYXktOTAwJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjaGVja2VkICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiYWJzb2x1dGUgdG9wLTEgcmlnaHQtMSB0ZXh0LXhzXCI+4pyTPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2dldE1vbnRoTmFtZShtKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS00MDAgdGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtleHBvcnRNb250aHNTZWxlY3RlZC5sZW5ndGggPT09IDAgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdOZW5odW0gbcOqcyBzZWxlY2lvbmFkbydcclxuICAgICAgICAgICAgICAgICAgICAgICkgOiBleHBvcnRNb250aHNTZWxlY3RlZC5sZW5ndGggPT09IDEgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGAxIG3DqnMgc2VsZWNpb25hZG86ICR7Z2V0TW9udGhOYW1lKGV4cG9ydE1vbnRoc1NlbGVjdGVkWzBdKX1gXHJcbiAgICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtleHBvcnRNb250aHNTZWxlY3RlZC5sZW5ndGh9IG1lc2VzIHNlbGVjaW9uYWRvczogJHtleHBvcnRNb250aHNTZWxlY3RlZC5tYXAobSA9PiBnZXRNb250aE5hbWUobSkpLmpvaW4oJywgJyl9YFxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1lbmQgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd0V4cG9ydE1vZGFsKGZhbHNlKX1cclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC13aGl0ZSB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc0dlbmVyYXRpbmd9XHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIENhbmNlbGFyXHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlRXhwb3J0RXhjZWx9XHJcbiAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc0dlbmVyYXRpbmcgfHwgZXhwb3J0TW9udGhzU2VsZWN0ZWQubGVuZ3RoID09PSAwfVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ibHVlLTYwMCBob3ZlcjpiZy1ibHVlLTcwMCBkaXNhYmxlZDpiZy1ibHVlLTkwMCBweC01IHB5LTIgcm91bmRlZC1sZyBmb250LXNlbWlib2xkIHRyYW5zaXRpb24tY29sb3JzIHRleHQtc20gZGlzYWJsZWQ6b3BhY2l0eS01MCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIHtpc0dlbmVyYXRpbmcgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgPD5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImFuaW1hdGUtc3BpblwiPuKPszwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIEdlcmFuZG8uLi5cclxuICAgICAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAg8J+TiiBFeHBvcnRhciBFeGNlbFxyXG4gICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIE1vZGFsIGRlIEVkacOnw6NvICovfVxyXG4gICAgICAgIHtzZWxlY3RlZFBvc3QgJiYgKFxyXG4gICAgICAgICAgPEVkaXRNb2RhbFxyXG4gICAgICAgICAgICBlZGl0VGVtYT17ZWRpdFRlbWF9XHJcbiAgICAgICAgICAgIHNldEVkaXRUZW1hPXtzZXRFZGl0VGVtYX1cclxuICAgICAgICAgICAgZWRpdENvcHk9e2VkaXRDb3B5fVxyXG4gICAgICAgICAgICBzZXRFZGl0Q29weT17c2V0RWRpdENvcHl9XHJcbiAgICAgICAgICAgIGVkaXREYXRhPXtlZGl0RGF0YX1cclxuICAgICAgICAgICAgc2V0RWRpdERhdGE9e3NldEVkaXREYXRhfVxyXG4gICAgICAgICAgICBlZGl0Rm9ybWF0bz17ZWRpdEZvcm1hdG99XHJcbiAgICAgICAgICAgIHNldEVkaXRGb3JtYXRvPXtzZXRFZGl0Rm9ybWF0b31cclxuICAgICAgICAgICAgZWRpdElkZWlhVmlzdWFsPXtlZGl0SWRlaWFWaXN1YWx9XHJcbiAgICAgICAgICAgIHNldEVkaXRJZGVpYVZpc3VhbD17c2V0RWRpdElkZWlhVmlzdWFsfVxyXG4gICAgICAgICAgICBlZGl0T2JqZXRpdm89e2VkaXRPYmpldGl2b31cclxuICAgICAgICAgICAgc2V0RWRpdE9iamV0aXZvPXtzZXRFZGl0T2JqZXRpdm99XHJcbiAgICAgICAgICAgIGVkaXRJbWFnZVByb21wdD17ZWRpdEltYWdlUHJvbXB0fVxyXG4gICAgICAgICAgICBzZXRFZGl0SW1hZ2VQcm9tcHQ9e3NldEVkaXRJbWFnZVByb21wdH1cclxuICAgICAgICAgICAgZWRpdFJlZmVyZW5jaWFzPXtlZGl0UmVmZXJlbmNpYXN9XHJcbiAgICAgICAgICAgIHNldEVkaXRSZWZlcmVuY2lhcz17c2V0RWRpdFJlZmVyZW5jaWFzfVxyXG4gICAgICAgICAgICBlZGl0U3RhdHVzPXtlZGl0U3RhdHVzfVxyXG4gICAgICAgICAgICBzZXRFZGl0U3RhdHVzPXtzZXRFZGl0U3RhdHVzfVxyXG4gICAgICAgICAgICByZWdlblBvc3RQcm9tcHQ9e3JlZ2VuUG9zdFByb21wdH1cclxuICAgICAgICAgICAgc2V0UmVnZW5Qb3N0UHJvbXB0PXtzZXRSZWdlblBvc3RQcm9tcHR9XHJcbiAgICAgICAgICAgIGlzUmVnZW5lcmF0aW5nUG9zdD17aXNSZWdlbmVyYXRpbmdQb3N0fVxyXG4gICAgICAgICAgICBvblJlZ2VuZXJhdGVQb3N0PXtyZWdlbmVyYXRlUG9zdFdpdGhBSX1cclxuICAgICAgICAgICAgaXNEZWxldGluZ1Bvc3Q9e2lzRGVsZXRpbmdQb3N0fVxyXG4gICAgICAgICAgICBvbkRlbGV0ZVBvc3Q9e2RlbGV0ZVBvc3R9XHJcbiAgICAgICAgICAgIG9uU2F2ZT17c2F2ZVBvc3R9XHJcbiAgICAgICAgICAgIG9uQ2xvc2U9e2Nsb3NlRWRpdE1vZGFsfVxyXG4gICAgICAgICAgLz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7LyogTW9kYWwgZGUgR2VyYcOnw6NvICovfVxyXG4gICAgICAgIHtzaG93R2VuZXJhdGVNb2RhbCAmJiAoXHJcbiAgICAgICAgICA8R2VuZXJhdGVNb2RhbFxyXG4gICAgICAgICAgICBtaXg9e21peH1cclxuICAgICAgICAgICAgc2V0TWl4PXtzZXRNaXh9XHJcbiAgICAgICAgICAgIGJyaWVmaW5nPXticmllZmluZ31cclxuICAgICAgICAgICAgc2V0QnJpZWZpbmc9e3NldEJyaWVmaW5nfVxyXG4gICAgICAgICAgICBnZW5lcmF0aW9uUHJvbXB0PXtnZW5lcmF0aW9uUHJvbXB0fVxyXG4gICAgICAgICAgICBzZXRHZW5lcmF0aW9uUHJvbXB0PXtzZXRHZW5lcmF0aW9uUHJvbXB0fVxyXG4gICAgICAgICAgICBwZXJpb2RvRGlhcz17cGVyaW9kb0RpYXN9XHJcbiAgICAgICAgICAgIHNldFBlcmlvZG9EaWFzPXtzZXRQZXJpb2RvRGlhc31cclxuICAgICAgICAgICAgYmFzZU1vbnRoRGF0ZT17Y3VycmVudE1vbnRofVxyXG4gICAgICAgICAgICBzcGVjaWZpY01vbnRocz17c3BlY2lmaWNNb250aHN9XHJcbiAgICAgICAgICAgIHNldFNwZWNpZmljTW9udGhzPXtzZXRTcGVjaWZpY01vbnRoc31cclxuICAgICAgICAgICAgZm9ybWF0SW5zdHJ1Y3Rpb25zPXtmb3JtYXRJbnN0cnVjdGlvbnN9XHJcbiAgICAgICAgICAgIHNldEZvcm1hdEluc3RydWN0aW9ucz17c2V0Rm9ybWF0SW5zdHJ1Y3Rpb25zfVxyXG4gICAgICAgICAgICBwcm9tcHRDaGFpbnM9e3Byb21wdENoYWluc31cclxuICAgICAgICAgICAgc2VsZWN0ZWRDaGFpbklkPXtzZWxlY3RlZENoYWluSWR9XHJcbiAgICAgICAgICAgIHNldFNlbGVjdGVkQ2hhaW5JZD17c2V0U2VsZWN0ZWRDaGFpbklkfVxyXG4gICAgICAgICAgICBpc0dlbmVyYXRpbmc9e2lzR2VuZXJhdGluZ31cclxuICAgICAgICAgICAgb25HZW5lcmF0ZT17Z2VuZXJhdGVDYWxlbmRhcn1cclxuICAgICAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0U2hvd0dlbmVyYXRlTW9kYWwoZmFsc2UpfVxyXG4gICAgICAgICAgLz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7LyogTW9kYWwgZGUgRWRpw6fDo28gZGUgUmVmZXLDqm5jaWFzIGRvIE3DqnMgKi99XHJcbiAgICAgICAge3Nob3dNb250aFJlZmVyZW5jZXNNb2RhbCAmJiAoXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgYmctYmxhY2svNzAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgei01MCBwLTRcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCByb3VuZGVkLXhsIHAtNiB3LWZ1bGwgbWF4LXctMnhsIGJvcmRlciBib3JkZXItZ3JheS03MDAgbWF4LWgtWzkwdmhdIG92ZXJmbG93LXktYXV0b1wiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTQgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgIPCfk44gUmVmZXLDqm5jaWFzIGRvIE3DqnNcclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNlwiPlxyXG4gICAgICAgICAgICAgICAgey8qIFRleHRvICovfVxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMCBtYi0yXCI+QW5vdGHDp8O1ZXMgZSBMaW5rczwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXttb250aFJlZmVyZW5jZXN9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRNb250aFJlZmVyZW5jZXMoZS50YXJnZXQudmFsdWUpfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtNCBweS0zIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItcHVycGxlLTUwMCBtaW4taC1bMTUwcHhdIHRleHQtc20gdGV4dC1ncmF5LTIwMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFeDpcclxuLSBDYW1wYW5oYSBkZSBEaWEgZGFzIE3Do2VzOiBmb2NvIGVtIHByZXNlbnRlcyBlbW9jaW9uYWlzXHJcbi0gVXNhciBwYWxldGEgZGUgY29yZXMgZGEgY29sZcOnw6NvIE91dG9ub1xyXG4tIExpbmsgZGEgcGFzdGEgZGUgZm90b3Mgbm92YXM6IGRyaXZlLmdvb2dsZS5jb20vLi4uXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIHsvKiBJbWFnZW5zIChDYXJyb3NzZWwvR3JpZCkgKi99XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMFwiPkdhbGVyaWEgVmlzdWFsIChNb29kYm9hcmQpPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXB1cnBsZS00MDAgaG92ZXI6dGV4dC1wdXJwbGUtMzAwIGN1cnNvci1wb2ludGVyIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICArIEFkaWNpb25hciBGb3Rvc1xyXG4gICAgICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJmaWxlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgbXVsdGlwbGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0PVwiaW1hZ2UvKlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImhpZGRlblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXthc3luYyAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZS50YXJnZXQuZmlsZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmaWxlcyB8fCBmaWxlcy5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCBkZSBjYWRhIGFycXVpdm9cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld0ltYWdlcyA9IFsuLi5tb250aEltYWdlc107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZCgnZmlsZScsIGZpbGVzW2ldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgYXBpLnBvc3QoJy9rbm93bGVkZ2UvYXNzZXRzJywgZm9ybURhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3SW1hZ2VzLnB1c2gocmVzLmRhdGEudXJsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldE1vbnRoSW1hZ2VzKG5ld0ltYWdlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvIG5vIHVwbG9hZDonLCBlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxlcnQoJ0Vycm8gYW8gZmF6ZXIgdXBsb2FkIGRlIGltYWdlbnMnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAge21vbnRoSW1hZ2VzLmxlbmd0aCA+IDAgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0zIHNtOmdyaWQtY29scy00IGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICB7bW9udGhJbWFnZXMubWFwKChpbWdVcmwsIGlkeCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aWR4fSBjbGFzc05hbWU9XCJyZWxhdGl2ZSBncm91cCBhc3BlY3Qtc3F1YXJlIGJnLWdyYXktOTAwIHJvdW5kZWQtbGcgb3ZlcmZsb3ctaGlkZGVuIGJvcmRlciBib3JkZXItZ3JheS03MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmM9e2ltZ1VybH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdD17YFJlZiAke2lkeH1gfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGgtZnVsbCBvYmplY3QtY292ZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdJbWFnZXMgPSBtb250aEltYWdlcy5maWx0ZXIoKF8sIGkpID0+IGkgIT09IGlkeCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldE1vbnRoSW1hZ2VzKG5ld0ltYWdlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYWJzb2x1dGUgdG9wLTEgcmlnaHQtMSBiZy1yZWQtNTAwLzgwIHRleHQtd2hpdGUgcm91bmRlZC1mdWxsIHAtMSBvcGFjaXR5LTAgZ3JvdXAtaG92ZXI6b3BhY2l0eS0xMDAgdHJhbnNpdGlvbi1vcGFjaXR5XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiUmVtb3ZlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Itb25seVwiPlJlbW92ZXI8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICDinYxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci0yIGJvcmRlci1kYXNoZWQgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgcC00IHRleHQtY2VudGVyIHRleHQtZ3JheS01MDAgdGV4dC14c1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgTmVuaHVtYSBpbWFnZW0gYWRpY2lvbmFkYS5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1lbmQgZ2FwLTMgbXQtNlwiPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93TW9udGhSZWZlcmVuY2VzTW9kYWwoZmFsc2UpfVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgdGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LXdoaXRlIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgQ2FuY2VsYXJcclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXthc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGFwaS5wdXQoYC9jYWxlbmRhcnMvJHtjYWxlbmRhci5pZH0vbWV0YWRhdGFgLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vbnRoX3JlZmVyZW5jZXM6IG1vbnRoUmVmZXJlbmNlcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbW9udGhfaW1hZ2VzOiBtb250aEltYWdlc1xyXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93TW9udGhSZWZlcmVuY2VzTW9kYWwoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgYWxlcnQoJ+KchSBSZWZlcsOqbmNpYXMgc2FsdmFzIGNvbSBzdWNlc3NvIScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvIGFvIHNhbHZhciByZWZlcsOqbmNpYXM6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgYWxlcnQoJ+KdjCBFcnJvIGFvIHNhbHZhciByZWZlcsOqbmNpYXMnKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLXB1cnBsZS02MDAgaG92ZXI6YmctcHVycGxlLTcwMCBweC02IHB5LTIgcm91bmRlZC1sZyBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgU2FsdmFyXHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApfVxyXG4gICAgICAgIHsvKiBNb2RhbCBkZSBQcm9ncmVzc28gZGEgR2VyYcOnw6NvICovfVxyXG4gICAgICAgIHtwZW5kaW5nSm9iSWQgJiYgY2xpZW50SWQgJiYgKFxyXG4gICAgICAgICAgPENhbGVuZGFyR2VuZXJhdGlvblByb2dyZXNzTW9kYWxcclxuICAgICAgICAgICAgam9iSWQ9e3BlbmRpbmdKb2JJZH1cclxuICAgICAgICAgICAgY2xpZW50SWQ9e2NsaWVudElkfVxyXG4gICAgICAgICAgICBvbkNsb3NlPXtoYW5kbGVKb2JDbG9zZX1cclxuICAgICAgICAgICAgb25TdWNjZXNzPXtoYW5kbGVKb2JTdWNjZXNzfVxyXG4gICAgICAgICAgLz5cclxuICAgICAgICApfVxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gICk7XHJcbn1cclxuXHJcbi8vIENvbXBvbmVudGUgTW9kYWwgZGUgRWRpw6fDo29cclxuaW50ZXJmYWNlIEVkaXRNb2RhbFByb3BzIHtcclxuICBlZGl0VGVtYTogc3RyaW5nO1xyXG4gIHNldEVkaXRUZW1hOiAodjogc3RyaW5nKSA9PiB2b2lkO1xyXG4gIGVkaXRDb3B5OiBzdHJpbmc7XHJcbiAgc2V0RWRpdENvcHk6ICh2OiBzdHJpbmcpID0+IHZvaWQ7XHJcbiAgZWRpdERhdGE6IHN0cmluZztcclxuICBzZXRFZGl0RGF0YTogKHY6IHN0cmluZykgPT4gdm9pZDtcclxuICBlZGl0Rm9ybWF0bzogc3RyaW5nO1xyXG4gIHNldEVkaXRGb3JtYXRvOiAodjogc3RyaW5nKSA9PiB2b2lkO1xyXG4gIGVkaXRJZGVpYVZpc3VhbDogc3RyaW5nO1xyXG4gIHNldEVkaXRJZGVpYVZpc3VhbDogKHY6IHN0cmluZykgPT4gdm9pZDtcclxuICBlZGl0T2JqZXRpdm86IHN0cmluZztcclxuICBzZXRFZGl0T2JqZXRpdm86ICh2OiBzdHJpbmcpID0+IHZvaWQ7XHJcbiAgZWRpdEltYWdlUHJvbXB0OiBzdHJpbmc7XHJcbiAgc2V0RWRpdEltYWdlUHJvbXB0OiAodjogc3RyaW5nKSA9PiB2b2lkO1xyXG4gIGVkaXRSZWZlcmVuY2lhczogc3RyaW5nO1xyXG4gIHNldEVkaXRSZWZlcmVuY2lhczogKHY6IHN0cmluZykgPT4gdm9pZDtcclxuICBlZGl0U3RhdHVzOiAnc3VnZXJpZG8nIHwgJ2Fwcm92YWRvJyB8ICdwdWJsaWNhZG8nO1xyXG4gIHNldEVkaXRTdGF0dXM6ICh2OiAnc3VnZXJpZG8nIHwgJ2Fwcm92YWRvJyB8ICdwdWJsaWNhZG8nKSA9PiB2b2lkO1xyXG4gIHJlZ2VuUG9zdFByb21wdDogc3RyaW5nO1xyXG4gIHNldFJlZ2VuUG9zdFByb21wdDogKHY6IHN0cmluZykgPT4gdm9pZDtcclxuICBpc1JlZ2VuZXJhdGluZ1Bvc3Q6IGJvb2xlYW47XHJcbiAgb25SZWdlbmVyYXRlUG9zdDogKCkgPT4gdm9pZDtcclxuICBpc0RlbGV0aW5nUG9zdDogYm9vbGVhbjtcclxuICBvbkRlbGV0ZVBvc3Q6ICgpID0+IHZvaWQ7XHJcbiAgb25TYXZlOiAoKSA9PiB2b2lkO1xyXG4gIG9uQ2xvc2U6ICgpID0+IHZvaWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIEVkaXRNb2RhbCh7XHJcbiAgZWRpdFRlbWEsIHNldEVkaXRUZW1hLFxyXG4gIGVkaXRDb3B5LCBzZXRFZGl0Q29weSxcclxuICBlZGl0RGF0YSwgc2V0RWRpdERhdGEsXHJcbiAgZWRpdEZvcm1hdG8sIHNldEVkaXRGb3JtYXRvLFxyXG4gIGVkaXRJZGVpYVZpc3VhbCwgc2V0RWRpdElkZWlhVmlzdWFsLFxyXG4gIGVkaXRPYmpldGl2bywgc2V0RWRpdE9iamV0aXZvLFxyXG4gIGVkaXRJbWFnZVByb21wdCwgc2V0RWRpdEltYWdlUHJvbXB0LFxyXG4gIGVkaXRSZWZlcmVuY2lhcywgc2V0RWRpdFJlZmVyZW5jaWFzLFxyXG4gIGVkaXRTdGF0dXMsIHNldEVkaXRTdGF0dXMsXHJcbiAgcmVnZW5Qb3N0UHJvbXB0LCBzZXRSZWdlblBvc3RQcm9tcHQsXHJcbiAgaXNSZWdlbmVyYXRpbmdQb3N0LFxyXG4gIG9uUmVnZW5lcmF0ZVBvc3QsXHJcbiAgaXNEZWxldGluZ1Bvc3QsXHJcbiAgb25EZWxldGVQb3N0LFxyXG4gIG9uU2F2ZSxcclxuICBvbkNsb3NlXHJcbn06IEVkaXRNb2RhbFByb3BzKSB7XHJcbiAgY29uc3QgW3Nob3dBZHZhbmNlZElBLCBzZXRTaG93QWR2YW5jZWRJQV0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc29sZS5sb2coJ/CfjqggRWRpdE1vZGFsIHJlbmRlcml6YWRvIGNvbSBkYWRvczonLCB7XHJcbiAgICBlZGl0VGVtYSwgZWRpdERhdGEsIGVkaXRGb3JtYXRvLCBlZGl0SW1hZ2VQcm9tcHQ6IGVkaXRJbWFnZVByb21wdD8uc3Vic3RyaW5nKDAsIDUwKSArICcuLi4nXHJcbiAgfSk7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1ibGFjay83MCBmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktY2VudGVyIHotNTAgcC00IG92ZXJmbG93LXktYXV0b1wiPlxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgcm91bmRlZC14bCBwLTYgdy1mdWxsIG1heC13LTN4bCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIG10LTggbWF4LWgtWzkwdmhdIG92ZXJmbG93LXktYXV0b1wiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItNlwiPlxyXG4gICAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkXCI+4pyP77iPIEVkaXRhciBQb3N0PC9oMj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXtvbkNsb3NlfSBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtd2hpdGUgdGV4dC0yeGxcIj7DlzwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTQgbWItNlwiPlxyXG4gICAgICAgICAgICB7LyogQ2FyZCAxIC0gSW5mb3JtYcOnw7VlcyBkbyBQb3N0ICovfVxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwLzYwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyBwLTQgc3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTIwMFwiPvCfk4wgSW5mb3JtYcOnw7VlcyBkbyBQb3N0PC9oMz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXhzIHRleHQtZ3JheS00MDAgbWItMVwiPkRhdGEgKEREL01NKTwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZWRpdERhdGF9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0RGF0YShlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFeDogMTUvMDFcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtMyBweS0yLjUgdGV4dC1zbSBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMCBtYi0xXCI+Rm9ybWF0bzwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxzZWxlY3RcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZWRpdEZvcm1hdG99XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0Rm9ybWF0byhlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGJnLWdyYXktNzAwIGJvcmRlciBib3JkZXItZ3JheS02MDAgcm91bmRlZC1sZyBweC0zIHB5LTIuNSB0ZXh0LXNtIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItYmx1ZS01MDBcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlJlZWxzXCI+8J+OrCBSZWVsczwvb3B0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJDYXJyb3NzZWxcIj7wn5O4IENhcnJvc3NlbDwvb3B0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJTdGF0aWNcIj7wn5a877iPIFN0YXRpYzwvb3B0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJTdG9yaWVzXCI+8J+TsSBTdG9yaWVzPC9vcHRpb24+XHJcbiAgICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtM1wiPlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMCBtYi0xXCI+VGVtYTwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZWRpdFRlbWF9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0VGVtYShlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGJnLWdyYXktNzAwIGJvcmRlciBib3JkZXItZ3JheS02MDAgcm91bmRlZC1sZyBweC0zIHB5LTIuNSB0ZXh0LXNtIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItYmx1ZS01MDBcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtM1wiPlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMCBtYi0xXCI+U3RhdHVzPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPHNlbGVjdFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXtlZGl0U3RhdHVzfVxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0RWRpdFN0YXR1cyhlLnRhcmdldC52YWx1ZSBhcyBhbnkpfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtMyBweS0yLjUgdGV4dC1zbSBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJzdWdlcmlkb1wiPuKPsyBTdWdlcmlkbzwvb3B0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJhcHJvdmFkb1wiPuKchSBBcHJvdmFkbzwvb3B0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJwdWJsaWNhZG9cIj7wn5qAIFB1YmxpY2Fkbzwvb3B0aW9uPlxyXG4gICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBDYXJkIDIgLSBDb250ZcO6ZG8gZG8gUG9zdCAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMC82MCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgcC00IHNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XHJcbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS0yMDBcIj7inI3vuI8gQ29udGXDumRvPC9oMz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMCBtYi0xXCI+TGVnZW5kYTwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXRDb3B5fVxyXG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXRDb3B5KGUudGFyZ2V0LnZhbHVlKX1cclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGJnLWdyYXktNzAwIGJvcmRlciBib3JkZXItZ3JheS02MDAgcm91bmRlZC1sZyBweC0zIHB5LTIuNSB0ZXh0LXNtIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItYmx1ZS01MDAgbWluLWgtWzExMHB4XVwiXHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC14cyB0ZXh0LWdyYXktNDAwIG1iLTFcIj5PYmpldGl2bzwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxyXG4gICAgICAgICAgICAgICAgICB2YWx1ZT17ZWRpdE9iamV0aXZvfVxyXG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXRPYmpldGl2byhlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtMyBweS0yLjUgdGV4dC1zbSBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwXCJcclxuICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXhzIHRleHQtZ3JheS00MDAgbWItMVwiPklkZWlhIHZpc3VhbDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXRJZGVpYVZpc3VhbH1cclxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0SWRlaWFWaXN1YWwoZS50YXJnZXQudmFsdWUpfVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctZ3JheS03MDAgYm9yZGVyIGJvcmRlci1ncmF5LTYwMCByb3VuZGVkLWxnIHB4LTMgcHktMi41IHRleHQtc20gZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1ibHVlLTUwMCBtaW4taC1bODBweF1cIlxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMCBtYi0xXCI+UmVmZXLDqm5jaWFzIChsaW5rcywgZm90b3MsIG5vdGFzKTwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXRSZWZlcmVuY2lhc31cclxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0UmVmZXJlbmNpYXMoZS50YXJnZXQudmFsdWUpfVxyXG4gICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkNvbGUgYXF1aSBsaW5rcyBkZSBwb3N0cywgcmVmZXLDqm5jaWFzIHZpc3VhaXMgb3UgYW5vdGHDp8O1ZXMgcGFyYSBlc3RlIGNvbnRlw7pkby5cIlxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctZ3JheS03MDAgYm9yZGVyIGJvcmRlci1ncmF5LTYwMCByb3VuZGVkLWxnIHB4LTMgcHktMi41IHRleHQteHMgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1ibHVlLTUwMCBtaW4taC1bODBweF1cIlxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICB7LyogQ2FyZCAzIC0gQ3JpYXRpdm8gJiBJQSAoYXZhbsOnYWRvKSAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMC82MCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgcC00IHNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd0FkdmFuY2VkSUEoIXNob3dBZHZhbmNlZElBKX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdGV4dC1sZWZ0XCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTIwMCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICDwn46oIENyaWF0aXZvICYgSUFcclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gdGV4dC1ncmF5LTUwMCBmb250LW5vcm1hbFwiPihvcGNpb25hbCk8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS00MDBcIj5cclxuICAgICAgICAgICAgICAgICAge3Nob3dBZHZhbmNlZElBID8gJ0VzY29uZGVyJyA6ICdNb3N0cmFyJ31cclxuICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuXHJcbiAgICAgICAgICAgICAge3Nob3dBZHZhbmNlZElBICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtMyBwdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXhzIHRleHQtZ3JheS00MDBcIj5Qcm9tcHQgZGUgaW1hZ2VtIChJQSk8L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoZWRpdEltYWdlUHJvbXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhbGVydCgnUHJvbXB0IGNvcGlhZG8gcGFyYSBhIMOhcmVhIGRlIHRyYW5zZmVyw6puY2lhIScpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNDAwIGhvdmVyOnRleHQtYmx1ZS0zMDAgdGV4dC14cyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiQ29waWFyIHByb21wdFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIPCfk4sgQ29waWFyXHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtlZGl0SW1hZ2VQcm9tcHR9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXRJbWFnZVByb21wdChlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlByb21wdCB0w6ljbmljbyBwYXJhIE1pZGpvdXJuZXksIERBTEwtRSwgZXRjLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctZ3JheS03MDAgYm9yZGVyIGJvcmRlci1ncmF5LTYwMCByb3VuZGVkLWxnIHB4LTMgcHktMi41IHRleHQteHMgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1ibHVlLTUwMCBtaW4taC1bOTBweF0gZm9udC1tb25vXCJcclxuICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtZ3JheS01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIEFqdXN0ZSBlc3RlIHByb21wdCBhbnRlcyBkZSB1c2FyIGVtIGZlcnJhbWVudGFzIGRlIElBIGdlbmVyYXRpdmEuXHJcbiAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgdGV4dC1ncmF5LTQwMFwiPlByb21wdCBwYXJhIHJlZ2VuZXJhciBlc3RlIHBvc3QgY29tIElBPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtyZWdlblBvc3RQcm9tcHR9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldFJlZ2VuUG9zdFByb21wdChlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkV4cGxpcXVlIGNvbW8gYSBJQSBkZXZlIGFkYXB0YXIgZXN0ZSBwb3N0IGFvIG5vdm8gZm9ybWF0byAoZm9jbywgdG9tLCB0aXBvIGRlIGNvbnRlw7pkbywgZXRjLikuXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtMyBweS0yLjUgdGV4dC14cyBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwIG1pbi1oLVs5MHB4XVwiXHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBtZDpmbGV4LXJvdyBnYXAtM1wiPlxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e29uUmVnZW5lcmF0ZVBvc3R9XHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNSZWdlbmVyYXRpbmdQb3N0fVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIGJnLXB1cnBsZS02MDAgaG92ZXI6YmctcHVycGxlLTcwMCBkaXNhYmxlZDpiZy1wdXJwbGUtODAwIGRpc2FibGVkOm9wYWNpdHktNjAgcHktMyByb3VuZGVkLWxnIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICB7aXNSZWdlbmVyYXRpbmdQb3N0ID8gJ/CflIEgUmVnZW5lcmFuZG8gY29tIElBLi4uJyA6ICfwn5SBIFJlZ2VuZXJhciBQb3N0IGNvbSBJQSd9XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17b25TYXZlfVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIGJnLWJsdWUtNjAwIGhvdmVyOmJnLWJsdWUtNzAwIHB5LTMgcm91bmRlZC1sZyBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAg8J+SviBTYWx2YXIgQWx0ZXJhw6fDtWVzXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgbWQ6ZmxleC1yb3cgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsb3NlfVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIGJnLWdyYXktNzAwIGhvdmVyOmJnLWdyYXktNjAwIHB5LTMgcm91bmRlZC1sZyBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgQ2FuY2VsYXJcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkRlbGV0ZVBvc3R9XHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNEZWxldGluZ1Bvc3R9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTEgYmctcmVkLTYwMCBob3ZlcjpiZy1yZWQtNzAwIGRpc2FibGVkOmJnLXJlZC04MDAgZGlzYWJsZWQ6b3BhY2l0eS02MCBweS0zIHJvdW5kZWQtbGcgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1jb2xvcnNcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIHtpc0RlbGV0aW5nUG9zdCA/ICfwn5eR77iPIEV4Y2x1aW5kbyBQb3N0Li4uJyA6ICfwn5eR77iPIEV4Y2x1aXIgUG9zdCd9XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcign4p2MIEVycm8gbm8gRWRpdE1vZGFsOicsIGVycm9yKTtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1ibGFjay83MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB6LTUwIHAtNFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctcmVkLTgwMCByb3VuZGVkLXhsIHAtNiBib3JkZXIgYm9yZGVyLXJlZC03MDBcIj5cclxuICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj7inYwgRXJybyBubyBNb2RhbDwvaDI+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXJlZC0yMDAgbWItNFwiPk9jb3JyZXUgdW0gZXJybyBhbyBhYnJpciBvIG1vZGFsIGRlIGVkacOnw6NvLjwvcD5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgb25DbGljaz17b25DbG9zZX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctcmVkLTYwMCBob3ZlcjpiZy1yZWQtNzAwIHB4LTQgcHktMiByb3VuZGVkLWxnIGZvbnQtbWVkaXVtXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgRmVjaGFyXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICApO1xyXG4gIH1cclxufVxyXG5cclxuLy8gQ29tcG9uZW50ZSBNb2RhbCBkZSBHZXJhw6fDo29cclxuaW50ZXJmYWNlIEdlbmVyYXRlTW9kYWxQcm9wcyB7XHJcbiAgbWl4OiBDb250ZW50TWl4O1xyXG4gIHNldE1peDogKHY6IENvbnRlbnRNaXgpID0+IHZvaWQ7XHJcbiAgYnJpZWZpbmc6IHN0cmluZztcclxuICBzZXRCcmllZmluZzogKHY6IHN0cmluZykgPT4gdm9pZDtcclxuICBwZXJpb2RvRGlhczogbnVtYmVyO1xyXG4gIHNldFBlcmlvZG9EaWFzOiAodjogbnVtYmVyKSA9PiB2b2lkO1xyXG4gIGJhc2VNb250aERhdGU6IERhdGU7XHJcbiAgc3BlY2lmaWNNb250aHM6IHN0cmluZ1tdO1xyXG4gIHNldFNwZWNpZmljTW9udGhzOiAodjogc3RyaW5nW10pID0+IHZvaWQ7XHJcbiAgZ2VuZXJhdGlvblByb21wdDogc3RyaW5nO1xyXG4gIHNldEdlbmVyYXRpb25Qcm9tcHQ6ICh2OiBzdHJpbmcpID0+IHZvaWQ7XHJcbiAgZm9ybWF0SW5zdHJ1Y3Rpb25zOiBGb3JtYXRJbnN0cnVjdGlvbnM7XHJcbiAgc2V0Rm9ybWF0SW5zdHJ1Y3Rpb25zOiAodjogRm9ybWF0SW5zdHJ1Y3Rpb25zKSA9PiB2b2lkO1xyXG4gIHByb21wdENoYWluczogYW55W107XHJcbiAgc2VsZWN0ZWRDaGFpbklkOiBzdHJpbmc7XHJcbiAgc2V0U2VsZWN0ZWRDaGFpbklkOiAodjogc3RyaW5nKSA9PiB2b2lkO1xyXG4gIGlzR2VuZXJhdGluZzogYm9vbGVhbjtcclxuICBvbkdlbmVyYXRlOiAoKSA9PiB2b2lkO1xyXG4gIG9uQ2xvc2U6ICgpID0+IHZvaWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIEdlbmVyYXRlTW9kYWwoe1xyXG4gIG1peCwgc2V0TWl4LFxyXG4gIGJyaWVmaW5nLCBzZXRCcmllZmluZyxcclxuICBwZXJpb2RvRGlhcywgc2V0UGVyaW9kb0RpYXMsXHJcbiAgYmFzZU1vbnRoRGF0ZSxcclxuICBzcGVjaWZpY01vbnRocywgc2V0U3BlY2lmaWNNb250aHMsXHJcbiAgZ2VuZXJhdGlvblByb21wdCwgc2V0R2VuZXJhdGlvblByb21wdCxcclxuICBmb3JtYXRJbnN0cnVjdGlvbnMsIHNldEZvcm1hdEluc3RydWN0aW9ucyxcclxuICBwcm9tcHRDaGFpbnMsXHJcbiAgc2VsZWN0ZWRDaGFpbklkLFxyXG4gIHNldFNlbGVjdGVkQ2hhaW5JZCxcclxuICBpc0dlbmVyYXRpbmcsXHJcbiAgb25HZW5lcmF0ZSwgb25DbG9zZVxyXG59OiBHZW5lcmF0ZU1vZGFsUHJvcHMpIHtcclxuICBjb25zdCBbc2hvd0FkdmFuY2VkUHJvbXB0LCBzZXRTaG93QWR2YW5jZWRQcm9tcHRdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzaG93Rm9ybWF0SW5zdHJ1Y3Rpb25zLCBzZXRTaG93Rm9ybWF0SW5zdHJ1Y3Rpb25zXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuXHJcbiAgY29uc3QgbW9udGhzT3B0aW9ucyA9IEFycmF5LmZyb20oeyBsZW5ndGg6IDEyIH0pLm1hcCgoXywgaSkgPT4ge1xyXG4gICAgY29uc3QgZGF0ZSA9IGFkZE1vbnRocyhiYXNlTW9udGhEYXRlLCBpKTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGRhdGUsXHJcbiAgICAgIG1vbnRoTGFiZWw6IGZvcm1hdChkYXRlLCAnTU1NTSB5eXl5JywgeyBsb2NhbGU6IHB0QlIgfSksXHJcbiAgICAgIG1vbnRoTmFtZTogZm9ybWF0KGRhdGUsICdNTU1NJywgeyBsb2NhbGU6IHB0QlIgfSksXHJcbiAgICAgIHllYXI6IGZvcm1hdChkYXRlLCAneXl5eScsIHsgbG9jYWxlOiBwdEJSIH0pXHJcbiAgICB9O1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBzZWxlY3RlZENvdW50ID0gc3BlY2lmaWNNb250aHMubGVuZ3RoO1xyXG5cclxuICByZXR1cm4gKFxyXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmaXhlZCBpbnNldC0wIGJnLWJsYWNrLzcwIGZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1jZW50ZXIgei01MCBwLTQgb3ZlcmZsb3cteS1hdXRvXCI+XHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgcm91bmRlZC14bCBwLTYgdy1mdWxsIG1heC13LTN4bCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIG10LTggbWF4LWgtWzkwdmhdIG92ZXJmbG93LXktYXV0b1wiPlxyXG4gICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBmb250LWJvbGQgbWItNlwiPvCfmoAgR2VyYXIgQ2FsZW5kw6FyaW8gRWRpdG9yaWFsPC9oMj5cclxuXHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTYgbWItNlwiPlxyXG4gICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtc20gdGV4dC1ncmF5LTQwMCBtYi0yXCI+UGVyw61vZG88L2xhYmVsPlxyXG4gICAgICAgICAgICA8c2VsZWN0XHJcbiAgICAgICAgICAgICAgdmFsdWU9e1N0cmluZyhwZXJpb2RvRGlhcyl9XHJcbiAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRQZXJpb2RvRGlhcyhwYXJzZUludChlLnRhcmdldC52YWx1ZSwgMTApKX1cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctZ3JheS03MDAgYm9yZGVyIGJvcmRlci1ncmF5LTYwMCByb3VuZGVkLWxnIHB4LTQgcHktMyBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCIzMFwiPk1lbnNhbCAoMzAgZGlhcyk8L29wdGlvbj5cclxuICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiOTBcIj5UcmltZXN0cmFsICg5MCBkaWFzKTwvb3B0aW9uPlxyXG4gICAgICAgICAgICA8L3NlbGVjdD5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXNtIHRleHQtZ3JheS00MDAgbWItMlwiPlNlbGVjaW9uZSBvcyBNZXNlcyBwYXJhIEdlcmFyPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0yIG1kOmdyaWQtY29scy0zIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAge21vbnRoc09wdGlvbnMubWFwKCh7IG1vbnRoTGFiZWwsIG1vbnRoTmFtZSwgeWVhciB9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gc3BlY2lmaWNNb250aHMuaW5jbHVkZXMobW9udGhMYWJlbCk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgIGtleT17bW9udGhMYWJlbH1cclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTZWxlY3RlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRTcGVjaWZpY01vbnRocyhzcGVjaWZpY01vbnRocy5maWx0ZXIoKG06IHN0cmluZykgPT4gbSAhPT0gbW9udGhMYWJlbCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IFsuLi5zcGVjaWZpY01vbnRocywgbW9udGhMYWJlbF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yZGVyZWQgPSBtb250aHNPcHRpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgobykgPT4gby5tb250aExhYmVsKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKGxhYmVsKSA9PiBuZXh0LmluY2x1ZGVzKGxhYmVsKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFNwZWNpZmljTW9udGhzKG9yZGVyZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcC0zIHJvdW5kZWQtbGcgYm9yZGVyIHRleHQtbGVmdCB0cmFuc2l0aW9uLWFsbCBmbGV4IGZsZXgtY29sICR7aXNTZWxlY3RlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgPyAnYmctYmx1ZS02MDAvMjAgYm9yZGVyLWJsdWUtNTAwIHRleHQtYmx1ZS0xMDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTcwMC81MCBib3JkZXItZ3JheS02MDAgdGV4dC1ncmF5LTQwMCBob3Zlcjpib3JkZXItZ3JheS01MDAgaG92ZXI6YmctZ3JheS03MDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICB9YH1cclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImNhcGl0YWxpemUgZm9udC1ib2xkIHRleHQtc21cIj57bW9udGhOYW1lfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIG9wYWNpdHktNzBcIj57eWVhcn08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAge2lzU2VsZWN0ZWQgJiYgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gbXQtMSB0ZXh0LWJsdWUtNDAwXCI+U2VsZWN0ZWQg4pyFPC9zcGFuPn1cclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgIH0pfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTJcIj5cclxuICAgICAgICAgICAgICBTZWxlY2lvbmUgdW0gb3UgbWFpcyBtZXNlcy4gTyBzaXN0ZW1hIGdlcmFyw6EgdW0gY2FsZW5kw6FyaW8gaW5kaXZpZHVhbCBwYXJhIGNhZGEgbcOqcyBzZWxlY2lvbmFkbywgbWFudGVuZG8gbyBjb250ZXh0by5cclxuICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTIgdGV4dC14cyB0ZXh0LWdyYXktNDAwXCI+XHJcbiAgICAgICAgICAgICAgU2VsZWNpb25hZG9zOiA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIGZvbnQtc2VtaWJvbGRcIj57c2VsZWN0ZWRDb3VudCB8fCAwfTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC1zbSB0ZXh0LWdyYXktNDAwIG1iLTJcIj5NaXggZGUgQ29udGXDumRvIChwb3IgbcOqcyk8L2xhYmVsPlxyXG4gICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbWItNFwiPlxyXG4gICAgICAgICAgICAgIERlZmluYSBxdWFudG9zIHBvc3RzIGRlIGNhZGEgdGlwbyB2b2PDqiBkZXNlamEgZ2VyYXIgPHN0cm9uZz5wYXJhIGNhZGEgbcOqcyBzZWxlY2lvbmFkbzwvc3Ryb25nPi5cclxuICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICA8Q29udGVudE1peFNlbGVjdG9yIG1peD17bWl4fSBvbk1peENoYW5nZT17c2V0TWl4fSAvPlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtc20gdGV4dC1ncmF5LTQwMCBtYi0yXCI+QnJpZWZpbmc8L2xhYmVsPlxyXG4gICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICB2YWx1ZT17YnJpZWZpbmd9XHJcbiAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRCcmllZmluZyhlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJEZXNjcmV2YSBvIG9iamV0aXZvLCB0ZW1hcyBwcmluY2lwYWlzLCBjYW1wYW5oYXMsIHByb21vw6fDtWVzLi4uXCJcclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctZ3JheS03MDAgYm9yZGVyIGJvcmRlci1ncmF5LTYwMCByb3VuZGVkLWxnIHB4LTQgcHktMyBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwIG1pbi1oLVsxMjBweF1cIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgey8qIEluc3RydcOnw7VlcyBwb3IgZm9ybWF0byAqL31cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAvNjAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHAtNCBzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dGb3JtYXRJbnN0cnVjdGlvbnMoIXNob3dGb3JtYXRJbnN0cnVjdGlvbnMpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdGV4dC1sZWZ0XCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMjAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICDwn46vIFBlcnNvbmFsaXphciBjYWRhIGZvcm1hdG9cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtZ3JheS01MDAgZm9udC1ub3JtYWxcIj4ob3BjaW9uYWwpPC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS00MDBcIj5cclxuICAgICAgICAgICAgICAgIHtzaG93Rm9ybWF0SW5zdHJ1Y3Rpb25zID8gJ0VzY29uZGVyJyA6ICdNb3N0cmFyJ31cclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAge3Nob3dGb3JtYXRJbnN0cnVjdGlvbnMgJiYgKFxyXG4gICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LWdyYXktNTAwIHB0LTFcIj5cclxuICAgICAgICAgICAgICAgICAgVXNlIGVzdGVzIGNhbXBvcyBwYXJhIGRhciBpbnN0cnXDp8O1ZXMgZXNwZWPDrWZpY2FzIHBhcmEgY2FkYSB0aXBvIGRlIGNvbnRlw7pkby4gRWxhcyBzZXLDo29cclxuICAgICAgICAgICAgICAgICAgY29tYmluYWRhcyBhbyBETkEgZGEgbWFyY2EgZSBhbyBicmllZmluZy5cclxuICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtMyB0ZXh0LXhzXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtWzExcHhdIHRleHQtZ3JheS00MDBcIj5SZWVsczwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17Zm9ybWF0SW5zdHJ1Y3Rpb25zLnJlZWxzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRGb3JtYXRJbnN0cnVjdGlvbnMoeyAuLi5mb3JtYXRJbnN0cnVjdGlvbnMsIHJlZWxzOiBlLnRhcmdldC52YWx1ZSB9KX1cclxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRXguOiBSZWVscyBtYWlzIGRpbsOibWljb3MsIGNvbSBjb3J0ZXMgcsOhcGlkb3MgZSBDVEEgZm9ydGUgbm9zIDNzIGZpbmFpcy5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGJnLWdyYXktNzAwIGJvcmRlciBib3JkZXItZ3JheS02MDAgcm91bmRlZC1sZyBweC0zIHB5LTIuNSBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwIG1pbi1oLVs3MHB4XVwiXHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtWzExcHhdIHRleHQtZ3JheS00MDBcIj5Qb3N0cyBlc3TDoXRpY29zPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtmb3JtYXRJbnN0cnVjdGlvbnMuc3RhdGljfVxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRGb3JtYXRJbnN0cnVjdGlvbnMoeyAuLi5mb3JtYXRJbnN0cnVjdGlvbnMsIHN0YXRpYzogZS50YXJnZXQudmFsdWUgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkV4LjogTGF5b3V0IG1pbmltYWxpc3RhLCBmb2NvIGVtIHRpcG9ncmFmaWEgZSB1bWEgaWRlaWEgY2VudHJhbCBwb3IgcGXDp2EuXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtMyBweS0yLjUgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1ibHVlLTUwMCBtaW4taC1bNzBweF1cIlxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LVsxMXB4XSB0ZXh0LWdyYXktNDAwXCI+Q2Fycm9zc8OpaXM8L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2Zvcm1hdEluc3RydWN0aW9ucy5jYXJvdXNlbH1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0Rm9ybWF0SW5zdHJ1Y3Rpb25zKHsgLi4uZm9ybWF0SW5zdHJ1Y3Rpb25zLCBjYXJvdXNlbDogZS50YXJnZXQudmFsdWUgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkV4LjogQ29udGXDumRvcyBlZHVjYXRpdm9zIGVtIDUtNyBjYXJkcywgY29tIHBhc3NvLWEtcGFzc28gZSBDVEEgbm8gZmluYWwuXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtMyBweS0yLjUgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1ibHVlLTUwMCBtaW4taC1bNzBweF1cIlxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LVsxMXB4XSB0ZXh0LWdyYXktNDAwXCI+U3RvcmllczwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17Zm9ybWF0SW5zdHJ1Y3Rpb25zLnN0b3JpZXN9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEZvcm1hdEluc3RydWN0aW9ucyh7IC4uLmZvcm1hdEluc3RydWN0aW9ucywgc3RvcmllczogZS50YXJnZXQudmFsdWUgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkV4LjogU2VxdcOqbmNpYXMgY3VydGFzLCBiYXN0aWRvcmVzIGUgZW5xdWV0ZXMgcGFyYSBlbmdhamFtZW50byBkacOhcmlvLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctZ3JheS03MDAgYm9yZGVyIGJvcmRlci1ncmF5LTYwMCByb3VuZGVkLWxnIHB4LTMgcHktMi41IGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItYmx1ZS01MDAgbWluLWgtWzcwcHhdXCJcclxuICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMC82MCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgcC00IHNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd0FkdmFuY2VkUHJvbXB0KCFzaG93QWR2YW5jZWRQcm9tcHQpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdGV4dC1sZWZ0XCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMjAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICDwn6egIEludGVsaWfDqm5jaWEgJiBQcm9tcHRzXHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LWdyYXktNTAwIGZvbnQtbm9ybWFsXCI+KG9wY2lvbmFsKTwvc3Bhbj5cclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNDAwXCI+XHJcbiAgICAgICAgICAgICAgICB7c2hvd0FkdmFuY2VkUHJvbXB0ID8gJ0VzY29uZGVyJyA6ICdNb3N0cmFyJ31cclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAge3Nob3dBZHZhbmNlZFByb21wdCAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwdC0xIHNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgey8qIFNlbGV0b3IgZGUgUHJvbXB0IENoYWluIGRlbnRybyBkZSBJbnRlbGlnw6puY2lhICYgUHJvbXB0cyAqL31cclxuICAgICAgICAgICAgICAgIHtwcm9tcHRDaGFpbnMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yIHBiLTQgYm9yZGVyLWIgYm9yZGVyLWdyYXktNzAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTMwMFwiPuKbk++4jyBQcm9tcHQgQ2hhaW48L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGFcclxuICAgICAgICAgICAgICAgICAgICAgICAgaHJlZj1cIiNcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhbGVydCgn8J+SoSBEaWNhOiBQcm9tcHQgQ2hhaW5zIGV4ZWN1dGFtIG3Dumx0aXBsb3MgcGFzc29zIGRlIHJhY2lvY8OtbmlvIGFudGVzIGRlIGdlcmFyIG8gY2FsZW5kw6FyaW8uXFxuXFxuVXNlIHF1YW5kbzpcXG7inIUgUXVlciBhbsOhbGlzZSBlc3RyYXTDqWdpY2EgcHJvZnVuZGFcXG7inIUgTmljaG8gZXNwZWPDrWZpY28gKG51dHJpw6fDo28sIGFkdm9jYWNpYSwgZXRjLilcXG7inIUgTGFuw6dhbWVudG9zIG91IGNhbXBhbmhhcyBjb21wbGV4YXNcXG5cXG5Ow6NvIHVzZSBxdWFuZG86XFxu4p2MIFByZWNpc2EgZGUgdmVsb2NpZGFkZVxcbuKdjCBCcmllZmluZyBqw6Egw6kgbXVpdG8gZGV0YWxoYWRvJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIHRleHQtYmx1ZS00MDAgaG92ZXI6dGV4dC1ibHVlLTMwMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIOKEue+4jyBRdWFuZG8gdXNhcj9cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYT5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgey8qIENhcmRzIGRlIENoYWlucyAqL31cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTZWxlY3RlZENoYWluSWQoJycpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BwLTIuNSByb3VuZGVkLWxnIGJvcmRlciBjdXJzb3ItcG9pbnRlciB0cmFuc2l0aW9uLWFsbCAke3NlbGVjdGVkQ2hhaW5JZCA9PT0gJydcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdib3JkZXItYmx1ZS01MDAgYmctYmx1ZS01MDAvMTAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnYm9yZGVyLWdyYXktNjAwIGJnLWdyYXktNzAwLzUwIGhvdmVyOmJvcmRlci1ncmF5LTUwMCdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9YH1cclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPXtgdy0zLjUgaC0zLjUgcm91bmRlZC1mdWxsIGJvcmRlciBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciAke3NlbGVjdGVkQ2hhaW5JZCA9PT0gJycgPyAnYm9yZGVyLWJsdWUtNTAwJyA6ICdib3JkZXItZ3JheS01MDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c2VsZWN0ZWRDaGFpbklkID09PSAnJyAmJiA8ZGl2IGNsYXNzTmFtZT1cInctMS41IGgtMS41IHJvdW5kZWQtZnVsbCBiZy1ibHVlLTUwMFwiIC8+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlXCI+R2VyYcOnw6NvIFBhZHLDo288L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1ncmF5LTQwMFwiPlLDoXBpZG8gZSBkaXJldG8gKEJyaWVmaW5nICsgRE5BKTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgIHtwcm9tcHRDaGFpbnMubWFwKChjaGFpbikgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtjaGFpbi5pZH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTZWxlY3RlZENoYWluSWQoY2hhaW4uaWQpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHAtMi41IHJvdW5kZWQtbGcgYm9yZGVyIGN1cnNvci1wb2ludGVyIHRyYW5zaXRpb24tYWxsICR7c2VsZWN0ZWRDaGFpbklkID09PSBjaGFpbi5pZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnYm9yZGVyLXB1cnBsZS01MDAgYmctcHVycGxlLTUwMC8xMCdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJ2JvcmRlci1ncmF5LTYwMCBiZy1ncmF5LTcwMC81MCBob3Zlcjpib3JkZXItZ3JheS01MDAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1zdGFydCBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2B3LTMuNSBoLTMuNSByb3VuZGVkLWZ1bGwgYm9yZGVyIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG10LTAuNSBmbGV4LXNocmluay0wICR7c2VsZWN0ZWRDaGFpbklkID09PSBjaGFpbi5pZCA/ICdib3JkZXItcHVycGxlLTUwMCcgOiAnYm9yZGVyLWdyYXktNTAwJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZENoYWluSWQgPT09IGNoYWluLmlkICYmIDxkaXYgY2xhc3NOYW1lPVwidy0xLjUgaC0xLjUgcm91bmRlZC1mdWxsIGJnLXB1cnBsZS01MDBcIiAvPn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgbWluLXctMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NoYWluLm5vbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bOXB4XSBweC0xLjUgcHktcHggYmctcHVycGxlLTUwMC8yMCB0ZXh0LXB1cnBsZS0zMDAgcm91bmRlZC1mdWxsXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2hhaW4uc3RlcHM/Lmxlbmd0aCB8fCAwfSBzdGVwc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjaGFpbi5kZXNjcmljYW8gJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1ncmF5LTQwMCBtdC0wLjUgdHJ1bmNhdGVcIj57Y2hhaW4uZGVzY3JpY2FvfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxyXG4gICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC14cyB0ZXh0LWdyYXktNDAwIG1iLTFcIj5Qcm9tcHQgYXZhbsOnYWRvIHBhcmEgSUE8L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LWdyYXktNTAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgRXN0ZSB0ZXh0byBzZXLDoSBjb21iaW5hZG8gYXV0b21hdGljYW1lbnRlIGNvbSBvIEROQSBkYSBtYXJjYSBzYWx2byBubyBzaXN0ZW1hXHJcbiAgICAgICAgICAgICAgICAgICAgKGJyYW5kaW5nLCByZWdyYXMsIGRvY3VtZW50b3MgZSBwZXJzb25hcykgZSBjb20gbyBicmllZmluZyBhY2ltYS4gVXNlIGVzdGUgY2FtcG9cclxuICAgICAgICAgICAgICAgICAgICBwYXJhIGRhciBpbnN0cnXDp8O1ZXMgZXh0cmFzIGVzcGVjw61maWNhcyBkZXN0YSBnZXJhw6fDo28gKGZvY28sIGNhbXBhbmhhcywgdGVtYXMgYVxyXG4gICAgICAgICAgICAgICAgICAgIHByaW9yaXphciBvdSBldml0YXIsIHRvbSBtYWlzIGRldGFsaGFkbywgZXRjLikuXHJcbiAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2dlbmVyYXRpb25Qcm9tcHR9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRHZW5lcmF0aW9uUHJvbXB0KGUudGFyZ2V0LnZhbHVlKX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkV4LjogUHJpb3JpemFyIGNvbnRlw7pkb3MgZGUgYXV0b3JpZGFkZSBwYXJhIGxhbsOnYW1lbnRvIGRvIG5vdm8gcHJvZHV0bywgZXZpdGFyIGFzc3VudG9zIHNlbnPDrXZlaXMgWCBlIFksIHJlZm9yw6dhciBwcm92YXMgc29jaWFpcyBlbSBwZWxvIG1lbm9zIDMwJSBkb3MgcG9zdHMsIGV0Yy5cIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1ncmF5LTcwMCBib3JkZXIgYm9yZGVyLWdyYXktNjAwIHJvdW5kZWQtbGcgcHgtNCBweS0zIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItYmx1ZS01MDAgbWluLWgtWzExMHB4XSB0ZXh0LXNtXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBnYXAtM1wiPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXtvbkNsb3NlfVxyXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTEgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgcHktMyByb3VuZGVkLWxnIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgQ2FuY2VsYXJcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXtvbkdlbmVyYXRlfVxyXG4gICAgICAgICAgICBkaXNhYmxlZD17aXNHZW5lcmF0aW5nfVxyXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTEgYmctYmx1ZS02MDAgaG92ZXI6YmctYmx1ZS03MDAgcHktMyByb3VuZGVkLWxnIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tY29sb3JzIGRpc2FibGVkOm9wYWNpdHktNTAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAge2lzR2VuZXJhdGluZyA/IChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGdhcC0xXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWJhc2VcIj7ij7MgR2VyYW5kbyB7c2VsZWN0ZWRDb3VudCA+IDEgPyBgJHtzZWxlY3RlZENvdW50fSBtZXNlc2AgOiAnY2FsZW5kw6FyaW8nfS4uLjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ibHVlLTIwMCBvcGFjaXR5LTgwXCI+XHJcbiAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZENvdW50ID4gMVxyXG4gICAgICAgICAgICAgICAgICAgID8gYElzc28gcG9kZSBsZXZhciAke01hdGguY2VpbChzZWxlY3RlZENvdW50ICogMS41KX0tJHtNYXRoLmNlaWwoc2VsZWN0ZWRDb3VudCAqIDMpfSBtaW51dG9zYFxyXG4gICAgICAgICAgICAgICAgICAgIDogJ0FndWFyZGUgYWxndW5zIGluc3RhbnRlcyd9XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICkgOiAn8J+agCBHZXJhciBDYWxlbmTDoXJpbyd9XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICApO1xyXG59XHJcbiJdLCJmaWxlIjoiQzovcmVwb3MvU3BoZXJhX0JyYW5kL2Zyb250ZW5kL3NyYy9wYWdlcy9DYWxlbmRhclBhZ2UudHN4In0=