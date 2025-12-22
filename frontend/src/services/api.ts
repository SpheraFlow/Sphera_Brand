import axios from 'axios';

const baseURL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

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

export interface GenerateCalendarResponse {
  success: boolean;
  calendarioId: string;
  clienteId: string;
  periodo: number;
  total_dias: number;
  dias: CalendarDay[];
  metadata: any;
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

  async generateCalendar(clienteId: string, periodo: number, briefing: string, mes?: string): Promise<GenerateCalendarResponse> {
    const response = await api.post('/generate-calendar', {
      clienteId,
      periodo,
      briefing,
      mes,
    }, {
      timeout: 120000 // 2 minutos - Geração com IA pode demorar (Prompt Chains + Gemini)
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
    await api.post('/analyze-branding', { clienteId: clientId, postId });
  }
};

export default api;

