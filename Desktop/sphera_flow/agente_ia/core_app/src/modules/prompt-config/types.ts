import { type ChannelType } from '@prisma/client';

export interface ActivePromptPackResponse {
  id: number;
  name: string;
  system_prompt: string;
  model_name: string;
  temperature: number;
  context_window_size: number;
  variables: Record<string, unknown>;
}

export interface CurrentPromptResponse {
  tenant_id: number;
  prompt_pack: {
    id: number;
    name: string;
    channel_type: ChannelType | null;
    system_prompt: string;
    context_template: string | null;
    model_name: string;
    temperature: number;
    max_tokens: number | null;
    context_window_size: number;
  };
  tone_of_voice: string | null;
  business_rules: string[];
  knowledge_base_refs: string[];
  variables: Record<string, unknown>;
}

export interface PromptPackListItem {
  id: number;
  tenantId: number;
  name: string;
  channelType: ChannelType | null;
  version: number;
  systemPrompt: string;
  contextTemplate: string | null;
  modelName: string;
  temperature: number;
  maxTokens: number | null;
  contextWindowSize: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
