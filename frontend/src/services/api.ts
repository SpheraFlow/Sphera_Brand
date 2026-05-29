import axios from 'axios';

const _rawBaseURL = import.meta.env.VITE_API_BASE_URL as string | undefined;

// Falha barulhenta se a variável não estiver configurada
// Sem ela, o fallback '/api' aponta para o próprio Vite (porta 3006) → 404 mudo em todas as chamadas
if (!_rawBaseURL) {
  const msg = '❌ VITE_API_BASE_URL não está definida!\nCrie frontend/.env.local com:\nVITE_API_BASE_URL=http://localhost:3001/api';
  console.error(msg);
  if (import.meta.env.DEV) {
    // Em dev lançamos erro para aparecer no overlay do Vite
    throw new Error(msg);
  }
}

export const baseURL = _rawBaseURL || 'http://localhost:3001/api';
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
  },

  // STORY-010 — cria cliente com nicho/categorias no onboarding wizard
  async createClientFull(payload: { nome: string; categorias_nicho?: string[] }): Promise<any> {
    const response = await api.post('/clients', payload);
    return response.data.cliente;
  }
};

// --- DNA Completeness Service (STORY-010) ---
export interface DnaCompleteness {
  percentual: number;
  campos_faltando: string[];
}

export interface DnaCompletenessItem extends DnaCompleteness {
  client_id: string;
}

export const dnaCompletenessService = {
  // AC6 — completude de um cliente específico
  async getForClient(clientId: string): Promise<DnaCompleteness> {
    const response = await api.get(`/clients/${clientId}/branding/completude`);
    return { percentual: response.data.percentual, campos_faltando: response.data.campos_faltando || [] };
  },

  // AC8 — completude de todos os clientes (para listas)
  async getAll(): Promise<DnaCompletenessItem[]> {
    const response = await api.get('/clients/completeness');
    return response.data.items || [];
  },
};

// --- Onboarding ARIA Service (STORY-010 / reuso do BrandingOnboardingPage) ---
export interface OnboardingChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface OnboardingExtractedBranding {
  visual_style?: { colors?: string[]; fonts?: string[]; archeType?: string };
  tone_of_voice?: { description?: string; keywords?: string[] };
  audience?: { persona?: string; demographics?: string };
  keywords?: string[];
  archetype?: string;
  usp?: string;
  anti_keywords?: string[];
  niche?: string;
}

export interface OnboardingChatResponse {
  success: boolean;
  reply: string;
  isComplete: boolean;
  extractedData?: OnboardingExtractedBranding | null;
}

export const onboardingAriaService = {
  async chat(
    clientId: string,
    messages: OnboardingChatMessage[],
    userMessage: string,
    signal?: AbortSignal,
  ): Promise<OnboardingChatResponse> {
    const response = await api.post(
      `/onboarding/chat/${clientId}`,
      { messages, userMessage },
      signal ? { signal } : undefined,
    );
    return response.data;
  },
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
  },

  // STORY-012 AC6 — fetch global error rate to drive AgencyHome alert banner.
  async getErrorRate(hours: number = 2): Promise<{
    success: boolean;
    hours: number;
    failed: number;
    total: number;
    ratio: number;
    threshold: number;
    should_alert: boolean;
    recent_failures: Array<{
      job_id: string;
      job_type: string;
      cliente_id: string;
      client_name: string | null;
      last_error: string | null;
      attempt_count: number;
      created_at: string;
    }>;
  }> {
    const response = await api.get(`/jobs/health/error-rate`, { params: { hours } });
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

// STORY-009 — Kanban approval workflow
export type ApprovalStatus = 'draft' | 'in_review' | 'approved' | 'published';
export const APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  'draft',
  'in_review',
  'approved',
  'published',
] as const;

export interface PostComment {
  id: string;
  calendar_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

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
  creative_status?: 'not_started' | 'queued' | 'generating' | 'ready_for_review' | 'approved' | 'needs_edit' | 'failed';
  selected_creative_asset_id?: string | null;
  latest_creative_job_id?: string | null;
  // STORY-009
  approval_status?: ApprovalStatus;
  reviewer_notes?: string | null;
  // STORY-008 — geração de imagem AI inline
  image_url?: string | null;
  image_status?: 'none' | 'pending' | 'generated' | 'failed';
}

// STORY-008 — status do job de geração de imagem (polling)
export type ImageJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImageGenerationJobStatus {
  jobId: string;
  status: ImageJobStatus;
  imageUrl: string | null;
  error: string | null;
  attemptCount: number;
}

export type ImageAspectRatio = '1:1' | '9:16' | '4:5';

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

  // ─── STORY-009 — Kanban approval workflow ────────────────────────────────
  async patchApprovalStatus(
    itemId: string,
    payload: { approval_status?: ApprovalStatus; reviewer_notes?: string | null },
  ): Promise<CalendarItem> {
    const response = await api.patch(`/calendar-items/${itemId}/status`, payload);
    return response.data.item;
  },

  async addComment(itemId: string, content: string): Promise<PostComment> {
    const response = await api.post(`/calendar-items/${itemId}/comment`, { content });
    return response.data.comment;
  },

  async getComments(itemId: string): Promise<PostComment[]> {
    const response = await api.get(`/calendar-items/${itemId}/comments`);
    return response.data.comments || [];
  },

  // ─── STORY-008 — Geração de Imagem AI Inline ─────────────────────────────
  // Cria um job de geração. Retorna 409 se já houver job em andamento.
  async generateImage(
    itemId: string,
    aspectRatio?: ImageAspectRatio,
  ): Promise<{ jobId: string; status: ImageJobStatus }> {
    const response = await api.post(`/calendar-items/${itemId}/generate-image`, { aspectRatio });
    return { jobId: response.data.jobId, status: response.data.status };
  },

  // Busca o status do job de imagem mais recente do item (para polling).
  async getImageJob(itemId: string): Promise<ImageGenerationJobStatus> {
    const response = await api.get(`/calendar-items/${itemId}/image-job`);
    return {
      jobId: response.data.jobId,
      status: response.data.status,
      imageUrl: response.data.imageUrl ?? null,
      error: response.data.error ?? null,
      attemptCount: response.data.attemptCount ?? 0,
    };
  },
};

// --- Creative Production Service ---
export type CreativeJobStatus =
  | 'queued'
  | 'hydrating_context'
  | 'briefing'
  | 'selecting_template'
  | 'prompting'
  | 'rendering'
  | 'quality_check'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CreativeAssetStatus =
  | 'generated'
  | 'approved'
  | 'needs_edit'
  | 'rejected'
  | 'archived';

export interface CreativeDimensions {
  width: number;
  height: number;
  aspectRatio: string;
}

export interface GenerateArtPayload {
  mode: 'template_svg' | 'ai_visual' | 'design_recipe' | 'template_master';
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'site';
  format?: string;
  templateId?: string;
  recipeId?: string;
  decisionMode?: 'auto_generate' | 'suggest_first';
  postType?: string;
  instructions?: string;
  postTypeSource?: 'ai_classified' | 'user_selected';
  backgroundSource?: 'ai_generated' | 'client_upload' | 'asset_library' | 'recipe_default';
  suggestionsCount?: number;
  dimensions: CreativeDimensions;
  generationOptions: {
    variationsCount: number;
    generateImage: boolean;
    generateEditableLayout: boolean;
    includeTextInImage: boolean;
    qualityLevel: 'basic' | 'standard' | 'premium';
  };
  overrides?: Record<string, unknown>;
  references?: Array<{
    type: 'image' | 'brandbook' | 'palette' | 'post_reference';
    source: 'uploaded_asset' | 'url' | 'brand_asset';
    assetId?: string;
    url?: string;
    usage: 'style_reference' | 'palette_reference' | 'composition_reference' | 'negative_reference';
    weight?: number;
  }>;
  idempotencyKey?: string;
}

export interface CreativeJob {
  id: string;
  cliente_id: string;
  calendario_id: string | null;
  calendar_item_id: string;
  status: CreativeJobStatus;
  progress: number;
  current_step: string | null;
  visual_brief: any;
  image_prompt: any;
  layout_spec: any;
  output: any;
  error: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreativeAsset {
  id: string;
  creative_job_id: string;
  cliente_id: string;
  calendario_id: string | null;
  calendar_item_id: string;
  asset_type: string;
  status: CreativeAssetStatus;
  title: string | null;
  description: string | null;
  file_url: string | null;
  preview_url: string | null;
  thumbnail_url?: string | null;
  editable_svg_url?: string | null;
  editable_layout_url?: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  file_size: number | null;
  prompt: any;
  metadata: any;
  quality_report: any;
  selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisualRecipe {
  id: string;
  clientId: string | null;
  scope: 'client' | 'global';
  name: string;
  postType: string;
  platform: string;
  format: string;
  dimensions: { width: number; height: number; aspectRatio: string };
  tags: string[];
  mood: string[];
  requiredSlots: string[];
  optionalSlots: string[];
  layoutRules: Record<string, unknown>;
  styleRules: Record<string, unknown>;
  backgroundPolicy: Record<string, unknown>;
  status: 'draft' | 'reviewed' | 'approved' | 'archived';
  sourceAssetId: string | null;
  sourceImageUrl: string | null;
  qualityScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateMasterSlot {
  type: 'text' | 'image' | 'icon' | 'logo';
  x: number;
  y: number;
  width: number;
  height: number;
  maxWords?: number;
  maxLines?: number;
  fontRole?: string;
  colorRole?: string;
  lockedPosition: boolean;
  fitStrategy?: 'reduce_font_then_line_break' | 'reject_on_overflow';
}

export interface TemplateMasterConfig {
  templateId: string;
  version: string;
  format: string;
  canvas: { width: number; height: number; aspectRatio: string };
  contentCapacity: 'low' | 'medium' | 'high';
  layoutLock: boolean;
  bestFor: string[];
  avoidFor: string[];
  slots: Record<string, TemplateMasterSlot>;
  colorMapping: Record<string, string>;
  imageRules: Record<string, unknown>;
  qualityRules: {
    minTextContrast: number;
    safeMargin: number;
    doNotMoveElements: boolean;
    rejectIfTextOverflow: boolean;
  };
}

export interface CreativeTemplate {
  id: string;
  name: string;
  description: string | null;
  format: string;
  platform: string;
  width: number;
  height: number;
  aspect_ratio: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  tags: string[];
  status: string;
  template_type?: string | null;
  content_capacity?: string | null;
  best_for?: string[];
  avoid_for?: string[];
  design_md?: string | null;
  config_json?: TemplateMasterConfig | null;
  layout_lock?: boolean;
  base_asset_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateRenderResult {
  asset: {
    previewUrl: string;
    fileUrl: string;
    editableSvgUrl: string;
    width: number;
    height: number;
  };
  qualityReport: {
    passed: boolean;
    warnings: string[];
    slots?: Record<string, unknown>;
  };
  warnings: string[];
}

export interface TemplateMasterSuggestion {
  templateId: string;
  id: string;
  name: string;
  description: string | null;
  previewUrl: string | null;
  baseAssetUrl: string | null;
  score: number;
  reasons: string[];
  contentCapacity: string | null;
  visualStyle: string[];
  bestFor: string[];
  avoidFor: string[];
  status: string;
  format: string;
  platform: string;
  width: number;
  height: number;
  aspectRatio: string | null;
  configJson: TemplateMasterConfig | Record<string, unknown>;
}

export const creativeService = {
  async generateArt(calendarItemId: string, payload: GenerateArtPayload): Promise<{ jobId: string; status: CreativeJobStatus; calendarItemId: string; job?: CreativeJob; assets?: CreativeAsset[] }> {
    const response = await api.post(`/calendar-items/${calendarItemId}/generate-art`, payload);
    return response.data;
  },

  async getJob(jobId: string): Promise<{ job: CreativeJob; assets: CreativeAsset[] }> {
    const response = await api.get(`/creative-jobs/${jobId}`);
    return { job: response.data.job, assets: response.data.assets || [] };
  },

  async getAssets(calendarItemId: string): Promise<CreativeAsset[]> {
    const response = await api.get(`/calendar-items/${calendarItemId}/creative-assets`);
    return response.data.assets || [];
  },

  async getTemplateMasterSuggestions(calendarItemId: string, params?: { platform?: string; format?: string; postType?: string; limit?: number }): Promise<TemplateMasterSuggestion[]> {
    const search = new URLSearchParams();
    search.set('platform', params?.platform || 'instagram');
    search.set('format', params?.format || 'Arte');
    if (params?.postType) search.set('postType', params.postType);
    if (params?.limit) search.set('limit', String(params.limit));
    const response = await api.get(`/calendar-items/${calendarItemId}/template-master-suggestions?${search.toString()}`);
    return response.data.suggestions || [];
  },

  async updateAssetStatus(
    assetId: string,
    status: CreativeAssetStatus,
    selected: boolean,
    notes?: string,
    feedback?: string,
    reason?: string,
    scores?: Record<string, unknown>
  ): Promise<CreativeAsset> {
    const response = await api.patch(`/creative-assets/${assetId}/status`, {
      status,
      selected,
      notes,
      feedback,
      reason,
      scores,
    });
    return response.data.asset;
  },

  async listVisualRecipes(clientId: string, params?: { postType?: string; platform?: string; format?: string; includeDrafts?: boolean }): Promise<VisualRecipe[]> {
    const search = new URLSearchParams();
    if (params?.postType) search.set('postType', params.postType);
    if (params?.platform) search.set('platform', params.platform);
    if (params?.format) search.set('format', params.format);
    if (params?.includeDrafts) search.set('includeDrafts', 'true');
    const query = search.toString();
    const response = await api.get(`/clients/${clientId}/visual-recipes${query ? `?${query}` : ''}`);
    return response.data.recipes || [];
  },

  async updateVisualRecipeStatus(recipeId: string, status: VisualRecipe['status']): Promise<VisualRecipe> {
    const response = await api.patch(`/visual-recipes/${recipeId}/status`, { status });
    return response.data.recipe;
  },

  async extractVisualRecipe(clientId: string, file: File, payload: { scope: 'client' | 'global'; postType?: string; platform?: string; format?: string; width?: number; height?: number; aspectRatio?: string }): Promise<{ recipe: VisualRecipe; analysis: Record<string, unknown>; warnings: string[]; referenceImageUrl: string }> {
    const form = new FormData();
    form.append('image', file);
    form.append('scope', payload.scope);
    if (payload.postType) form.append('postType', payload.postType);
    form.append('platform', payload.platform || 'instagram');
    form.append('format', payload.format || 'Arte');
    form.append('width', String(payload.width || 1080));
    form.append('height', String(payload.height || 1350));
    form.append('aspectRatio', payload.aspectRatio || '4:5');
    const response = await api.post(`/clients/${clientId}/visual-recipes/extract`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async listCreativeTemplates(params?: { platform?: string; format?: string }): Promise<CreativeTemplate[]> {
    const search = new URLSearchParams();
    search.set('platform', params?.platform || 'instagram');
    search.set('format', params?.format || 'Arte');
    const response = await api.get(`/creative-templates?${search.toString()}`);
    return response.data.templates || [];
  },

  async createTemplate(payload: {
    name: string;
    description?: string;
    format: string;
    platform: string;
    width: number;
    height: number;
    aspectRatio: string;
    designMd: string;
    configJson: TemplateMasterConfig;
    baseAssetUrl?: string;
    previewUrl?: string;
    tags?: string[];
    status?: string;
  }): Promise<CreativeTemplate> {
    const response = await api.post('/creative-templates', payload);
    return response.data.template;
  },

  async updateTemplateConfig(templateId: string, payload: {
    designMd: string;
    configJson: TemplateMasterConfig;
    baseAssetUrl?: string;
    status?: string;
  }): Promise<CreativeTemplate> {
    const response = await api.patch(`/creative-templates/${templateId}/config`, payload);
    return response.data.template;
  },

  async testTemplateRender(templateId: string, payload: {
    configJson: TemplateMasterConfig;
    baseAssetUrl?: string;
    copy?: Record<string, string>;
    images?: Record<string, string>;
    brandPalette?: Record<string, string>;
  }): Promise<TemplateRenderResult> {
    const response = await api.post(`/creative-templates/${templateId}/test-render`, payload);
    return response.data;
  },

  async listTemplateVersions(templateId: string): Promise<any[]> {
    const response = await api.get(`/creative-templates/${templateId}/versions`);
    return response.data.versions || [];
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

// --- Agency Dashboard Service (STORY-011) ---
export interface AgencyClientSummary {
  client_id: string;
  client_name: string;
  posts_approved_month: number;
  posts_published_month: number;
}

export interface AgencyClientAtRisk {
  client_id: string;
  client_name: string;
  days_since_last_approved: number | null;
}

export interface AgencyTokenUsageSummary {
  client_id: string;
  client_name: string;
  tokens_used_month: number;
  cost_cents_month: number;
}

export interface AgencyDashboardResponse {
  success: boolean;
  app_cam_current: number;
  clients_summary: AgencyClientSummary[];
  clients_at_risk: AgencyClientAtRisk[];
  token_usage_summary: AgencyTokenUsageSummary[];
}

export const agencyService = {
  async getDashboard(): Promise<AgencyDashboardResponse> {
    // AC6 — timeout de 5s para o dashboard: se exceder, cai no error state com retry.
    const response = await api.get<AgencyDashboardResponse>('/agency/dashboard', {
      timeout: 5000,
    });
    return response.data;
  },
};

// --- Agent Sessions Service (STORY-014) ---
export type AgentType = 'briefing' | 'creative' | 'strategy';

export interface AgentSession {
  id: string;
  cliente_id: string;
  agent_type: AgentType;
  title: string | null;
  rolling_summary?: string | null;
  created_at?: string;
  last_message_at: string;
  status: 'active' | 'archived';
  has_memory: boolean;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_in: number;
  tokens_out: number;
  retrieved_chunk_ids: string[];
  created_at: string;
}

export interface AgentRunResponse {
  success: boolean;
  userMessage: AgentMessage;
  assistantMessage: AgentMessage;
  summaryUpdated: boolean;
}

export const agentService = {
  async listSessions(clienteId: string): Promise<AgentSession[]> {
    const response = await api.get<{ success: boolean; sessions: AgentSession[] }>(
      '/agents/sessions',
      { params: { clienteId } }
    );
    return response.data.sessions;
  },

  async createSession(clienteId: string, agentType: AgentType, title?: string): Promise<AgentSession> {
    const response = await api.post<{ success: boolean; session: AgentSession }>(
      '/agents/sessions',
      { clienteId, agentType, title }
    );
    return response.data.session;
  },

  async getMessages(sessionId: string, opts?: { limit?: number; before?: string }): Promise<AgentMessage[]> {
    const response = await api.get<{ success: boolean; messages: AgentMessage[] }>(
      `/agents/sessions/${sessionId}/messages`,
      { params: opts }
    );
    return response.data.messages;
  },

  async sendMessage(sessionId: string, content: string): Promise<AgentRunResponse> {
    const response = await api.post<AgentRunResponse>(
      `/agents/sessions/${sessionId}/messages`,
      { content }
    );
    return response.data;
  },

  async archiveSession(sessionId: string): Promise<void> {
    await api.delete(`/agents/sessions/${sessionId}`);
  },
};

// ─── STORY-015: Instagram Integration ────────────────────────────────────────

/** Shape real retornado por GET /api/social/instagram/status */
export interface InstagramStatusResponse {
  success: boolean;
  connected: boolean;
  account: {
    id: string;
    username: string;
    status: 'active' | 'expired' | 'revoked';
    expires_at: string | null;
    last_sync_at: string | null;
  } | null;
  metrics_count: number;
}

/** Shape normalizado usado pelo frontend */
export interface InstagramStatus {
  connected: boolean;
  account_id?: string;
  account_name?: string;
  expires_at?: string | null;
  last_sync_at?: string | null;
  status?: 'active' | 'expired' | 'revoked';
  metrics_count?: number;
}

export const socialService = {
  /**
   * Gera URL para iniciar fluxo OAuth.
   * Inclui o JWT via query string porque navegação via window.location.href
   * não envia o header Authorization — o backend valida `?token=` para este endpoint.
   */
  getConnectUrl(clienteId: string): string {
    const token = localStorage.getItem('@SpheraAuth:token') ?? '';
    return `${api.defaults.baseURL}/social/instagram/connect?clienteId=${encodeURIComponent(clienteId)}&token=${encodeURIComponent(token)}`;
  },

  async getStatus(clienteId: string): Promise<InstagramStatus> {
    const response = await api.get<InstagramStatusResponse>(
      `/social/instagram/status`,
      { params: { clienteId } }
    );
    const { connected, account, metrics_count } = response.data;
    return {
      connected,
      account_id: account?.id,
      account_name: account?.username,
      expires_at: account?.expires_at,
      last_sync_at: account?.last_sync_at,
      status: account?.status,
      metrics_count,
    };
  },

  async disconnect(socialAccountId: string): Promise<{ disconnected: boolean; metrics_deleted: number; publications_canceled?: number }> {
    const response = await api.delete<{ disconnected: boolean; metrics_deleted: number; publications_canceled?: number }>(
      `/social/instagram/${socialAccountId}/disconnect`
    );
    return response.data;
  },
};

// ─── STORY-016: Publicação Direta (scheduling com aprovação humana) ───────────

export type PublicationStatus =
  | 'pending_approval'
  | 'approved'
  | 'queued'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'canceled';

export interface PublicationSchedule {
  id: string;
  calendar_item_id: string;
  social_account_id: string;
  platform: string;
  scheduled_at: string;
  status: PublicationStatus;
  platform_post_id: string | null;
  payload: { media_type?: string; media_url?: string; caption?: string } | Record<string, unknown>;
  attempts: number;
  last_error: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Enriquecido pelo GET /api/publications (JOIN calendar_items)
  dia?: number;
  tema?: string;
  formato?: string;
}

export const publicationService = {
  /** Agenda um post aprovado para publicação direta (AC1). */
  async schedule(input: {
    calendarItemId: string;
    socialAccountId: string;
    scheduledAt: string; // ISO 8601
    platform?: string;
  }): Promise<PublicationSchedule> {
    const response = await api.post<{ success: boolean; schedule: PublicationSchedule }>(
      `/publications/schedule`,
      input
    );
    return response.data.schedule;
  },

  /** Aprova um agendamento pendente (AC2a). */
  async approve(id: string): Promise<PublicationSchedule> {
    const response = await api.patch<{ success: boolean; schedule: PublicationSchedule }>(
      `/publications/${id}/approve`
    );
    return response.data.schedule;
  },

  /** Cancela um agendamento (sujeito à janela de 5 min — AC4). */
  async cancel(id: string): Promise<PublicationSchedule> {
    const response = await api.delete<{ success: boolean; schedule: PublicationSchedule }>(
      `/publications/${id}/cancel`
    );
    return response.data.schedule;
  },

  /** Lista agendamentos de um cliente, opcionalmente filtrando por status. */
  async list(clienteId: string, status?: PublicationStatus): Promise<PublicationSchedule[]> {
    const response = await api.get<{ success: boolean; schedules: PublicationSchedule[] }>(
      `/publications`,
      { params: { clienteId, ...(status ? { status } : {}) } }
    );
    return response.data.schedules;
  },
};

export default api;



