import { ChannelType } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import type {
  ActivePromptPackResponse,
  CurrentPromptResponse,
  PromptPackListItem,
} from './types';
import type {
  CreatePromptPackInput,
  GetActivePromptPackQuery,
  UpdatePromptPackInput,
} from './schemas';

type PromptPackWithConfigs = {
  id: number;
  name: string;
  systemPrompt: string;
  contextTemplate: string | null;
  modelName: string;
  temperature: number;
  maxTokens: number | null;
  contextWindowSize: number;
  channelType: ChannelType | null;
};

const TONE_KEYS = ['TONE_OF_VOICE', 'PROMPT_TONE_OF_VOICE'] as const;
const BUSINESS_RULE_KEYS = ['BUSINESS_RULES', 'PROMPT_BUSINESS_RULES'] as const;
const KNOWLEDGE_KEYS = ['KNOWLEDGE_BASE_REFS', 'TENANT_KNOWLEDGE_REFS', 'PROMPT_KNOWLEDGE_REFS'] as const;

function pickFirstValue(
  variables: Record<string, string>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = variables[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function parseListValue(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0);
      }
    } catch {
      // Fall back to delimiter parsing below.
    }
  }

  return trimmed
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export class PromptConfigService {
  async getActive(
    tenantId: number,
    query: GetActivePromptPackQuery,
  ): Promise<ActivePromptPackResponse> {
    const configs = await prisma.tenantConfig.findMany({
      where: { tenantId },
      select: { key: true, value: true },
    });

    const variables = Object.fromEntries(configs.map((config) => [config.key, config.value]));

    const pack = await this.findActivePack(tenantId, query.channel);

    if (!pack) {
      throw new NotFoundError(
        `No active prompt pack for tenant ${tenantId} channel ${query.channel ?? 'any'}`,
      );
    }

    return {
      id: pack.id,
      name: pack.name,
      system_prompt: pack.systemPrompt,
      model_name: pack.modelName,
      temperature: pack.temperature,
      context_window_size: pack.contextWindowSize,
      variables,
    };
  }

  async getCurrent(
    tenantId: number,
    query: GetActivePromptPackQuery,
  ): Promise<CurrentPromptResponse> {
    const configs = await prisma.tenantConfig.findMany({
      where: { tenantId },
      select: { key: true, value: true },
    });

    const variables = Object.fromEntries(configs.map((config) => [config.key, config.value]));
    const pack = await this.findActivePack(tenantId, query.channel);

    if (!pack) {
      throw new NotFoundError(
        `No active prompt pack for tenant ${tenantId} channel ${query.channel ?? 'any'}`,
      );
    }

    const toneOfVoice = pickFirstValue(variables, TONE_KEYS);
    const businessRules = parseListValue(pickFirstValue(variables, BUSINESS_RULE_KEYS));
    const knowledgeBaseRefs = parseListValue(pickFirstValue(variables, KNOWLEDGE_KEYS));

    return {
      tenant_id: tenantId,
      prompt_pack: {
        id: pack.id,
        name: pack.name,
        channel_type: pack.channelType,
        system_prompt: pack.systemPrompt,
        context_template: pack.contextTemplate,
        model_name: pack.modelName,
        temperature: pack.temperature,
        max_tokens: pack.maxTokens,
        context_window_size: pack.contextWindowSize,
      },
      tone_of_voice: toneOfVoice,
      business_rules: businessRules,
      knowledge_base_refs: knowledgeBaseRefs,
      variables,
    };
  }

  async getById(tenantId: number, packId: number): Promise<PromptPackListItem> {
    const pack = await prisma.promptPack.findFirst({
      where: { id: packId, tenantId },
    });

    if (!pack) {
      throw new NotFoundError(`Prompt pack ${packId} not found`);
    }

    return pack;
  }

  async list(tenantId: number): Promise<PromptPackListItem[]> {
    return prisma.promptPack.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: number, input: CreatePromptPackInput): Promise<PromptPackListItem> {
    return prisma.promptPack.create({
      data: {
        tenantId,
        name: input.name,
        channelType: input.channel_type ?? null,
        systemPrompt: input.system_prompt,
        contextTemplate: input.context_template ?? null,
        modelName: input.model_name ?? 'gemini-pro',
        temperature: input.temperature ?? 0.7,
        maxTokens: input.max_tokens ?? null,
        contextWindowSize: input.context_window_size ?? 50,
        isActive: false,
      },
    });
  }

  async update(
    tenantId: number,
    packId: number,
    input: UpdatePromptPackInput,
  ): Promise<PromptPackListItem> {
    await this.getById(tenantId, packId);

    return prisma.promptPack.update({
      where: { id: packId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.channel_type !== undefined ? { channelType: input.channel_type } : {}),
        ...(input.system_prompt !== undefined ? { systemPrompt: input.system_prompt } : {}),
        ...(input.context_template !== undefined ? { contextTemplate: input.context_template } : {}),
        ...(input.model_name !== undefined ? { modelName: input.model_name } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.max_tokens !== undefined ? { maxTokens: input.max_tokens } : {}),
        ...(input.context_window_size !== undefined
          ? { contextWindowSize: input.context_window_size }
          : {}),
        ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
      },
    });
  }

  async activate(tenantId: number, packId: number): Promise<PromptPackListItem> {
    const pack = await this.getById(tenantId, packId);

    await prisma.promptPack.updateMany({
      where: {
        tenantId,
        channelType: pack.channelType,
        id: { not: packId },
        isActive: true,
      },
      data: { isActive: false },
    });

    return prisma.promptPack.update({
      where: { id: packId },
      data: { isActive: true },
    });
  }

  private async findActivePack(
    tenantId: number,
    channel?: ChannelType,
  ): Promise<PromptPackWithConfigs | null> {
    if (channel) {
      const specificPack = await prisma.promptPack.findFirst({
        where: {
          tenantId,
          isActive: true,
          channelType: channel,
        },
        orderBy: { version: 'desc' },
      });

      if (specificPack) {
        return specificPack;
      }
    }

    return prisma.promptPack.findFirst({
      where: {
        tenantId,
        isActive: true,
        channelType: null,
      },
      orderBy: { version: 'desc' },
    });
  }
}
