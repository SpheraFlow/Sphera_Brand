import axios from 'axios';

const _rawBaseURL = (import.meta as any).env?.VITE_API_BASE_URL;

// Falha barulhenta se a variável não estiver configurada
// Sem ela, o fallback '/api' aponta para o próprio Vite (porta 3006) → 404 mudo em todas as chamadas
if (!_rawBaseURL) {
  const msg = '❌ VITE_API_BASE_URL não está definida!\nCrie frontend/.env.local com:\nVITE_API_BASE_URL=http://localhost:3001/api';
  console.error(msg);
  if ((import.meta as any).env?.DEV) {
    // Em dev lançamos erro para aparecer no overlay do Vite
    throw new Error(msg);
  }
}

const baseURL = _rawBaseURL || 'http://localhost:3001/api';
export const apiOrigin = baseURL.replace(/\/api$/, '');

console.log('🔧 API Base URL configurada:', baseURL);

const api = axios.create({
  baseURL,
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Request (para debug)
api.interceptors.request.use(
  (config) => {
    console.log('🚀 [FRONT REQUEST]', config.method?.toUpperCase(), config.url);
    console.log(`📦 [FRONT REQUEST] Full URL: ${config.baseURL || ''}${config.url}`);
    if (config.data instanceof FormData) {
      console.log(`📦 [FRONT REQUEST] FormData com ${Array.from(config.data.keys()).length} campos`);
      for (let [key, value] of config.data.entries()) {
        if (value instanceof File) {
          console.log(`   - ${key}: File(${value.name}, ${value.size} bytes)`);
        } else {
          console.log(`   - ${key}: ${value}`);
        }
      }
    }
    return config;
  },
  (error) => {
    console.error('❌ [FRONT REQUEST ERROR]', error.message);
    return Promise.reject(error);
  }
);

// Interceptor de Response (para debug)
api.interceptors.response.use(
  (response) => {
    console.log('✅ [FRONT RESPONSE]', response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('❌ [FRONT ERROR]', error.message);
    console.error('❌ [FRONT ERROR DETAILS]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// --- Interfaces Existentes ---
export interface CalendarDay {
  dia: number;
  tema: string;
  formato: string;
  instrucoes_visuais: string;
  copy_inicial: string;
  objetivo: string;
  cta: string;
  palavras_chave: string[];
}

export interface CalendarResponse {
  success: boolean;
  calendarioId: string;
  clienteId: string;
  periodo: number;
  briefing: string | null;
  dias: CalendarDay[];
  metadata: any;
  criado_em: string;
}

export interface UploadResponse {
  success: boolean;
  postId: string;
  filePath: string;
}

export interface ProcessResponse {
  success: boolean;
  postId: string;
  processedId: string;
  analysis: string;
}

export interface JobStatusResponse {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'completed' | 'failed' | 'canceled';
  progress: number;
  current_step?: string;
  result?: any;
  result_calendar_ids?: string[];
  job_type?: string;
  operation?: string;
  error?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
  server_time?: string;
  age_seconds?: number;
  is_stale?: boolean;
  hint?: string;
}

export interface GenerateCalendarResponse {
  success: boolean;
  message: string;
  jobId: string;
  monthsToGenerate?: string[];
}

// --- Novas Interfaces (Knowledge Base) ---
export interface Prompt {
  id: string;
  cliente_id: string;
  titulo: string;
  conteudo_prompt: string;
  categoria: string;
  uso_frequente: boolean;
  criado_em: string;
}

export interface BrandRule {
  id: string;
  cliente_id: string;
  regra: string;
  categoria: string;
  ativa: boolean;
  origem: 'manual' | 'ia';
  criado_em: string;
}

// --- Services ---

export const calendarService = {
  async getCalendar(clienteId: string): Promise<CalendarResponse> {
    const response = await api.get(`/calendars/${clienteId}`);
    return response.data;
  },

  async getLatestCalendar(clienteId: string) {
    const response = await api.get(`/calendars/${clienteId}/latest`);
    return response.data;
  },

  async uploadPost(clienteId: string, titulo: string, descricao: string, file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('clienteId', clienteId);
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('file', file);

    const response = await api.post('/upload-post', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async processPost(postId: string): Promise<ProcessResponse> {
    const response = await api.post('/process-post', { postId });
    return response.data;
  },

  async generateCalendar(
    clienteId: string,
    periodo: number,
    briefing: string,
    mes?: string,
    mix?: { reels: number; static: number; carousel: number; stories: number; photos?: number },
    produtosFocoIds?: string[],
    monthsToGenerate?: string[],
    monthlyMix?: Record<string, { reels: number; static: number; carousel: number; stories: number; photos?: number }>,
    formatInstructions?: Record<string, string>,
    monthlyBriefings?: Record<string, { briefing: string; monthReferences: string }>
  ): Promise<GenerateCalendarResponse> {
    const response = await api.post('/generate-calendar', {
      clienteId,
      periodo,
      briefing,
      mes,
      mix,
      produtosFocoIds,
      monthsToGenerate,
      monthlyMix,
      formatInstructions,
      monthlyBriefings: monthlyBriefings && Object.keys(monthlyBriefings).length > 0 ? monthlyBriefings : undefined
    }, {
      timeout: 120000
    });
    return response.data;
  },

  async updateCalendar(calendarId: string, posts: any[]) {
    const response = await api.put(`/calendars/${calendarId}`, { posts });
    return response.data;
  },

  async updatePost(calendarId: string, postIndex: number, post: any) {
    const response = await api.put(`/calendars/post/${calendarId}/${postIndex}`, post);
    return response.data;
  },

  async listCalendars(clientId: string, includeDrafts = false): Promise<any[]> {
    const response = await api.get(`/calendars/${clientId}/list`, {
      params: includeDrafts ? { includeDrafts: 'true' } : {}
    });
    return response.data.calendars || [];
  },
};

export const knowledgeService = {
  // Prompts
  async getPrompts(clienteId: string): Promise<Prompt[]> {
    const response = await api.get(`/knowledge/prompts/${clienteId}`);
    return response.data.prompts;
  },

  async createPrompt(clienteId: string, titulo: string, conteudo: string, categoria: string): Promise<Prompt> {
    const response = await api.post('/knowledge/prompts', { clienteId, titulo, conteudo, categoria });
    return response.data.prompt;
  },

  async deletePrompt(id: string): Promise<void> {
    await api.delete(`/knowledge/prompts/${id}`);
  },

  // Rules
  async getRules(clienteId: string): Promise<BrandRule[]> {
    const response = await api.get(`/knowledge/rules/${clienteId}`);
    return response.data.rules;
  },

  async createRule(clienteId: string, regra: string, categoria: string): Promise<BrandRule> {
    const response = await api.post('/knowledge/rules', { clienteId, regra, categoria, origem: 'manual' });
    return response.data.rule;
  },

  async deleteRule(id: string): Promise<void> {
    await api.delete(`/knowledge/rules/${id}`);
  },

  // Docs
  async saveDoc(clienteId: string, tipo: string, conteudo_texto: string): Promise<void> {
    await api.post('/knowledge/docs', { clienteId, tipo, conteudo_texto });
  }
};

// --- Client Service ---
export interface Client {
  id: string;
  nome: string;
  status: string;
  avatarUrl: string | null;
  criado_em: string;
  prompt_template_agent_id?: string | null;
}

export const clientService = {
  async getClients(): Promise<Client[]> {
    const response = await api.get('/clients');
    return response.data.clientes;
  },

  async getClient(clientId: string): Promise<Client> {
    const response = await api.get(`/clients/${clientId}`);
    return response.data.cliente;
  },

  async createClient(nome: string): Promise<Client> {
    const response = await api.post('/clients', { nome });
    return response.data.cliente;
  }
};

// --- Branding Service ---
export interface BrandingData {
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
  archetype?: string;
  usp?: string;
  anti_keywords?: string[];
  niche?: string;
  updated_at?: string;
}

export const brandingService = {
  async getBranding(clientId: string): Promise<BrandingData> {
    const response = await api.get(`/branding/${clientId}`);
    return response.data.branding;
  },

  async saveBranding(clientId: string, data: Omit<BrandingData, 'id' | 'cliente_id' | 'updated_at'>): Promise<void> {
    await api.put(`/branding/${clientId}`, data);
  },

  async analyzeBranding(clientId: string, postId: string): Promise<void> {
    await api.post('/branding/analyze-branding', { clienteId: clientId, postId });
  }
};

export const jobsService = {
  async getJobStatus(clientId: string, jobId: string): Promise<JobStatusResponse> {
    const response = await api.get(`/jobs/${clientId}/${jobId}`);
    const { job, age_seconds, is_stale, hint } = response.data;
    return { ...job, age_seconds, is_stale, hint };
  },

  async getJobs(clientId: string): Promise<any> {
    const response = await api.get(`/jobs/${clientId}`);
    return response.data.jobs;
  },

  async cancelJob(clientId: string, jobId: string): Promise<any> {
    const response = await api.post(`/jobs/${clientId}/${jobId}/cancel`);
    return response.data;
  },

  async retryJob(clientId: string, jobId: string): Promise<any> {
    const response = await api.post(`/jobs/${clientId}/${jobId}/retry`);
    return response.data;
  },

  async deleteJob(clientId: string, jobId: string): Promise<any> {
    const response = await api.delete(`/jobs/${clientId}/${jobId}`);
    return response.data;
  }
};

export const presentationService = {
  async getAvailableMonths(clientId: string): Promise<string[]> {
    const response = await api.get(`/presentation/available-months/${clientId}`);
    return response.data.months;
  },

  async getHistory(clientId: string): Promise<any[]> {
    const response = await api.get(`/presentation/history/${clientId}`);
    return response.data.history;
  },

  async generateContent(clienteId: string, months?: string[]): Promise<any> {
    const response = await api.post('/presentation/generate-content', { clienteId, months });
    return response.data;
  },

  async startContentJob(clienteId: string, months?: string[]): Promise<any> {
    const response = await api.post('/presentation/generate-content-job', { clienteId, months });
    return response.data;
  },

  async generateImages(payload: any): Promise<any> {
    const response = await api.post('/presentation/generate', payload);
    return response.data;
  },

  async startRenderJob(payload: any): Promise<any> {
    const response = await api.post('/presentation/generate-job', payload);
    return response.data;
  },

  async savePresentation(payload: any): Promise<any> {
    const response = await api.post('/presentation/save', payload);
    return response.data;
  }
};

// --- Prompt Template Service ---
export interface PromptTemplate {
  id: string;
  cliente_id: string | null;
  version: number;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  body?: string;
}

export interface PromptPreviewResponse {
  success: boolean;
  renderedPrompt: string;
  missingVariables: string[];
  unknownVariables: string[];
  variablesUsed: string[];
  guardrailErrors: string[];
  usedTemplate: { id: string | null; version: number | null; clienteId: string | null; source?: string };
  tokenEstimate: number;
}

export interface PromptVariable {
  key: string;
  description: string;
  example: string;
  required: boolean;
  scope: 'global' | 'client' | 'calendar' | 'optional';
}

export const promptTemplateService = {
  async listVersions(clienteId: string): Promise<PromptTemplate[]> {
    const response = await api.get(`/prompt-templates/${clienteId}`);
    return response.data.data;
  },

  async getActive(clienteId: string): Promise<PromptTemplate> {
    const response = await api.get(`/prompt-templates/${clienteId}/active`);
    return response.data.data;
  },

  async getDetail(id: string): Promise<PromptTemplate> {
    const response = await api.get(`/prompt-templates/detail/${id}`);
    return response.data.data;
  },

  async createVersion(clienteId: string | null, body: string, label?: string, agentId?: string): Promise<PromptTemplate> {
    const response = await api.post('/prompt-templates', { clienteId, body, label, agentId });
    return response.data.data;
  },

  async activate(id: string): Promise<PromptTemplate> {
    const response = await api.post(`/prompt-templates/${id}/activate`);
    return response.data.data;
  },

  async activatePredefined(clienteId: string | null, label: string, body: string): Promise<PromptTemplate> {
    const response = await api.post('/prompt-templates/predefined', { clienteId, label, body });
    return response.data.data;
  },

  async deleteVersion(id: string): Promise<void> {
    await api.delete(`/prompt-templates/${id}`);
  },

  /** Lista estática com todas as variáveis que podem ser usadas no gerador */
  async getCatalogVariables(): Promise<PromptVariable[]> {
    const response = await api.get('/prompt-templates-catalog/variables');
    return response.data.data;
  },

  /** Renderiza o prompt com custo zero de token. mode = 'mock' (default) ou 'real' (dados do banco do cliente) */
  async preview(clientId: string, bodyOverride?: string, mes?: string, mode: 'mock' | 'real' = 'mock'): Promise<PromptPreviewResponse> {
    const response = await api.post('/prompt-templates/preview', {
      clientId,
      bodyOverride,
      mes,
      mode
    });
    return response.data;
  },

  /** Rota Chatbot (Onboarding IA para Calendário) */
  async chatOnboarding(clientId: string, messages: Array<{ role: 'user' | 'model', content: string }>, userMessage?: string): Promise<{
    success: boolean;
    reply: string;
    isComplete: boolean;
    extractedData?: any;
  }> {
    const response = await api.post(`/prompt-templates/onboarding/chat/${clientId}`, {
      messages,
      userMessage
    });
    return response.data;
  },
};

// --- Calendar Items Service ---
export type CalendarItemStatus = 'draft' | 'approved' | 'needs_edit' | 'redo' | 'published';

export interface CalendarItem {
  id: string;
  calendario_id: string;
  cliente_id: string;
  dia: number;
  tema: string;
  formato: string;
  status: CalendarItemStatus;
  revisions_count: number;
  first_generated_at: string;
  approved_at: string | null;
  published_at: string | null;
  last_updated_at: string;
  notes: string | null;
}

export const calendarItemsService = {
  async getItems(calendarioId: string): Promise<CalendarItem[]> {
    const response = await api.get(`/calendarios/${calendarioId}/items`);
    return response.data.items;
  },

  async patchItem(itemId: string, status: CalendarItemStatus, notes?: string): Promise<CalendarItem> {
    const response = await api.patch(`/calendar-items/${itemId}`, { status, notes });
    return response.data.item;
  },

  // Semeia calendar_items com status='draft' para todos os posts do calendário que ainda
  // não têm registro. Idempotente. Retorna todos os itens atualizados.
  async seedItems(calendarioId: string): Promise<CalendarItem[]> {
    const response = await api.post(`/calendarios/${calendarioId}/items/seed`, {});
    return response.data.items;
  },

  // Cria ou atualiza um item pela chave composta (calendario_id, dia, tema, formato).
  // Usado quando o item ainda não existe no DB.
  async setItemStatus(
    calendarioId: string,
    dia: number,
    tema: string,
    formato: string,
    status: CalendarItemStatus,
  ): Promise<CalendarItem> {
    const response = await api.post(`/calendarios/${calendarioId}/items/status`, {
      dia, tema, formato, status,
    });
    return response.data.item;
  },
};

// --- Dashboard Metrics Service ---
export interface DashboardMetrics {
  range: string;
  range_start: string;
  calendars_count: number;
  posts_count: number;
  approval_rate: number | null;
  avg_revisions_per_item: number;
  avg_time_to_approval_minutes: number;
  planned_vs_published: { planned: number; published: number; published_rate: number | null };
  failures: { total: number; invalid_output_count: number; by_type: Record<string, number> };
  llm_cost_brl_total: number;
  llm_cost_brl_avg_per_calendar: number;
  cost_per_approved_post_brl: number;
  time_saved_hours: number;
  time_saved_brl_estimate: number;
  roi_ratio: number;
  usage: { generations: number; approvals: number; last_activity_at: string | null };
  churn_risk: { score: number; label: 'Baixo' | 'Médio' | 'Alto'; reasons: string[] };
}

export const dashboardMetricsService = {
  async getMetrics(clientId: string, range: '30d' | '90d' | 'mtd' = '30d'): Promise<DashboardMetrics> {
    const response = await api.get(`/clients/${clientId}/dashboard-metrics?range=${range}`);
    return response.data;
  },
};

// --- Produtos Service ---
export interface Produto {
  id: string;
  cliente_id: string;
  nome: string;
  categoria: string | null;
  preco: number | string | null;
  descricao: string | null;
  link_referencia: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const produtosService = {
  getProdutos: async (clienteId: string, ativoOnly = false): Promise<Produto[]> => {
    const query = ativoOnly ? '?ativo=true' : '';
    const response = await api.get(`/clientes/${clienteId}/produtos${query}`);
    return response.data.produtos;
  },

  createProduto: async (clienteId: string, data: Partial<Produto>): Promise<Produto> => {
    const response = await api.post(`/clientes/${clienteId}/produtos`, data);
    return response.data.produto;
  },

  updateProduto: async (id: string, data: Partial<Produto>): Promise<Produto> => {
    const response = await api.put(`/produtos/${id}`, data);
    return response.data.produto;
  },

  deleteProduto: async (id: string): Promise<void> => {
    await api.delete(`/produtos/${id}`);
  }
};


export interface DataComemorativa {
  id: string;
  data: string;
  titulo: string;
  categorias: string[];
  descricao: string | null;
  relevancia: number;
}

export const datasComemorvativasService = {
  getByMonths: async (months: string[], nicho?: string): Promise<DataComemorativa[]> => {
    const ptMap: Record<string, number> = {
      janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
    };

    const fetchMonthDates = async (mesNum: number, anoNum: number, nicheFilter?: string): Promise<DataComemorativa[]> => {
      const params: any = { mes: mesNum, ano: anoNum };
      if (nicheFilter) params.nicho = nicheFilter;
      const resp = await api.get('/datas-comemorativas', { params });
      return resp.data.success && Array.isArray(resp.data.datas) ? resp.data.datas : [];
    };

    const allDates: DataComemorativa[] = [];
    for (const m of months) {
      const parts = m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ');
      const mesNum = ptMap[parts[0]];
      const yearStr = parts.length > 2 ? parts[2] : parts[1];
      const anoNum = parseInt(yearStr || '', 10);
      if (!mesNum || isNaN(anoNum)) continue;

      try {
        let dates = await fetchMonthDates(mesNum, anoNum, nicho);
        if (dates.length === 0 && nicho) {
          dates = await fetchMonthDates(mesNum, anoNum);
        }
        allDates.push(...dates);
      } catch (error) {
        console.error('Erro ao buscar datas comemorativas do m?s:', m, error);
      }
    }

    const deduped = new Map<string, DataComemorativa>();
    for (const item of allDates) {
      deduped.set(item.id, item);
    }

    return Array.from(deduped.values()).sort((a, b) => {
      const dateCompare = String(a.data).localeCompare(String(b.data));
      if (dateCompare !== 0) return dateCompare;
      return Number(b.relevancia || 0) - Number(a.relevancia || 0);
    });
  }
};

export interface BriefingChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface BriefingChatResponse {
  reply: string;
  done: boolean;
  briefing?: string;
}

export interface PresentationChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface PresentationChatResponse {
  reply: string;
  done: boolean;
  content?: any;
}

export const presentationChatAgentService = {
  async chat(
    clientId: string,
    messages: PresentationChatMessage[],
    months: string[]
  ): Promise<PresentationChatResponse> {
    const response = await api.post('/presentation/chat-agent', { clientId, messages, months });
    return response.data;
  },
};

export const briefingAgentService = {
  async chat(
    clientId: string,
    messages: BriefingChatMessage[],
    campaignContext: {
      goal: string;
      selectedMonths: string[];
      contentMix?: string;
      commemorativeDates?: string;
      restrictions?: string;
    }
  ): Promise<BriefingChatResponse> {
    const response = await api.post('/briefing-agent/chat', {
      clientId,
      messages,
      campaignContext,
    });
    return response.data;
  },
};

export default api;



