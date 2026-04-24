import crypto from 'crypto';
import { ChannelType, PrismaClient, TenantVertical } from '@prisma/client';

const prisma = new PrismaClient();

type SeedConfig = {
  key: string;
  value: string;
  description: string;
};

async function upsertTenantConfig(tenantId: number, config: SeedConfig): Promise<void> {
  await prisma.tenantConfig.upsert({
    where: {
      tenantId_key: {
        tenantId,
        key: config.key,
      },
    },
    update: {
      value: config.value,
      description: config.description,
    },
    create: {
      tenantId,
      key: config.key,
      value: config.value,
      description: config.description,
    },
  });
}

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'hoc-teste' },
    update: {
      name: 'HOC - Hospital de Olhos (Teste)',
      vertical: TenantVertical.clinica,
      plan: 'pro',
    },
    create: {
      slug: 'hoc-teste',
      name: 'HOC - Hospital de Olhos (Teste)',
      vertical: TenantVertical.clinica,
      plan: 'pro',
    },
  });

  const configs: SeedConfig[] = [
    {
      key: 'bot_name',
      value: 'Atendente HOC',
      description: 'Bot name',
    },
    {
      key: 'default_timezone',
      value: 'America/Sao_Paulo',
      description: 'Default timezone',
    },
    {
      key: 'reply_delay_seconds',
      value: '10',
      description: 'Debounce window',
    },
    {
      key: 'handoff_label',
      value: 'humano',
      description: 'Chatwoot label for human handoff',
    },
    {
      key: 'whatsapp_number',
      value: process.env.TEST_WHATSAPP_NUMBER ?? '5500000000000',
      description: 'Development WhatsApp number',
    },
  ];

  for (const config of configs) {
    await upsertTenantConfig(tenant.id, config);
  }

  const whatsappNumber = process.env.TEST_WHATSAPP_NUMBER ?? '5500000000000';

  await prisma.tenantChannel.upsert({
    where: {
      tenantId_channelType_externalId: {
        tenantId: tenant.id,
        channelType: ChannelType.whatsapp_evo,
        externalId: whatsappNumber,
      },
    },
    update: {
      label: 'WhatsApp HOC Dev',
      isActive: true,
      credentials: {},
      meta: {
        seeded: true,
      },
    },
    create: {
      tenantId: tenant.id,
      channelType: ChannelType.whatsapp_evo,
      externalId: whatsappNumber,
      label: 'WhatsApp HOC Dev',
      credentials: {},
      meta: {
        seeded: true,
      },
    },
  });

  const testApiKey = process.env.TEST_API_KEY ?? crypto.randomBytes(24).toString('hex');
  const keyHash = crypto.createHash('sha256').update(testApiKey).digest('hex');

  await prisma.tenantApiKey.upsert({
    where: {
      tenantId_label: {
        tenantId: tenant.id,
        label: 'n8n-dev',
      },
    },
    update: {
      keyHash,
      revokedAt: null,
    },
    create: {
      tenantId: tenant.id,
      label: 'n8n-dev',
      keyHash,
    },
  });

  await prisma.promptPack.upsert({
    where: {
      tenantId_name_version: {
        tenantId: tenant.id,
        name: 'WhatsApp HOC',
        version: 1,
      },
    },
    update: {
      channelType: ChannelType.whatsapp_evo,
      systemPrompt:
        'Voce e a assistente virtual do HOC (Hospital de Olhos). Seja breve, empatica e nunca de diagnosticos.',
      modelName: 'gemini-pro',
      temperature: 0.7,
      contextWindowSize: 50,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      name: 'WhatsApp HOC',
      channelType: ChannelType.whatsapp_evo,
      systemPrompt:
        'Voce e a assistente virtual do HOC (Hospital de Olhos). Seja breve, empatica e nunca de diagnosticos.',
      modelName: 'gemini-pro',
      temperature: 0.7,
      contextWindowSize: 50,
      isActive: true,
    },
  });

  process.stdout.write(`Seed completed for tenant ${tenant.slug} (id=${tenant.id})\n`);
  process.stdout.write('Dev API key stored in tenant_api_keys. Set TEST_API_KEY to control the seeded value.\n');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Seed failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
