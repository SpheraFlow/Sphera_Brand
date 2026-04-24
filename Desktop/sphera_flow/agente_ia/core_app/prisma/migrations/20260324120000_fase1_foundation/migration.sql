-- CreateEnum
CREATE TYPE "TenantVertical" AS ENUM ('clinica', 'restaurante', 'pousada', 'varejo_tecnico', 'outro');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('whatsapp_cloud', 'whatsapp_evo', 'instagram_dm', 'chatwoot', 'telegram', 'email', 'outro');

-- CreateEnum
CREATE TYPE "HandoffReason" AS ENUM ('label_humano', 'solicitacao_usuario', 'escalacao_agente', 'timeout_bot', 'campanha', 'outro');

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" "TenantVertical" NOT NULL DEFAULT 'outro',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_configs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_channels" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "label" TEXT NOT NULL,
    "external_id" TEXT,
    "credentials" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_api_keys" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "custom" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_identities" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_name" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_handoffs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "conversation_external_id" TEXT,
    "reason" "HandoffReason" NOT NULL,
    "reason_detail" TEXT,
    "agent_id" TEXT,
    "agent_name" TEXT,
    "chatwoot_conversation_id" TEXT,
    "chatwoot_label" TEXT NOT NULL DEFAULT 'humano',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "bot_reactivated_at" TIMESTAMP(3),
    "wait_seconds" INTEGER,
    "handle_seconds" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "human_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_packs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "channel_type" "ChannelType",
    "version" INTEGER NOT NULL DEFAULT 1,
    "system_prompt" TEXT NOT NULL,
    "context_template" TEXT,
    "model_name" TEXT NOT NULL DEFAULT 'gemini-pro',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER,
    "context_window_size" INTEGER NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_log" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "person_id" INTEGER,
    "channel_type" "ChannelType",
    "source" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_configs_tenant_id_key_key" ON "tenant_configs"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "tenant_configs_tenant_id_idx" ON "tenant_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_channels_tenant_id_channel_type_external_id_key" ON "tenant_channels"("tenant_id", "channel_type", "external_id");

-- CreateIndex
CREATE INDEX "tenant_channels_tenant_id_channel_type_idx" ON "tenant_channels"("tenant_id", "channel_type");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_api_keys_tenant_id_label_key" ON "tenant_api_keys"("tenant_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_api_keys_tenant_id_key_hash_key" ON "tenant_api_keys"("tenant_id", "key_hash");

-- CreateIndex
CREATE INDEX "tenant_api_keys_tenant_id_idx" ON "tenant_api_keys"("tenant_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_phone_idx" ON "persons"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "persons_tenant_id_email_idx" ON "persons"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "person_identities_tenant_id_channel_type_external_id_key" ON "person_identities"("tenant_id", "channel_type", "external_id");

-- CreateIndex
CREATE INDEX "person_identities_tenant_id_person_id_idx" ON "person_identities"("tenant_id", "person_id");

-- CreateIndex
CREATE INDEX "human_handoffs_tenant_id_started_at_idx" ON "human_handoffs"("tenant_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "human_handoffs_tenant_id_person_id_started_at_idx" ON "human_handoffs"("tenant_id", "person_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_packs_tenant_id_name_version_key" ON "prompt_packs"("tenant_id", "name", "version");

-- CreateIndex
CREATE INDEX "prompt_packs_tenant_id_channel_type_is_active_idx" ON "prompt_packs"("tenant_id", "channel_type", "is_active");

-- CreateIndex
CREATE INDEX "event_log_tenant_id_event_type_occurred_at_idx" ON "event_log"("tenant_id", "event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "event_log_tenant_id_occurred_at_idx" ON "event_log"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "event_log_person_id_occurred_at_idx" ON "event_log"("person_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_channels" ADD CONSTRAINT "tenant_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_api_keys" ADD CONSTRAINT "tenant_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_identities" ADD CONSTRAINT "person_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_identities" ADD CONSTRAINT "person_identities_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_handoffs" ADD CONSTRAINT "human_handoffs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_handoffs" ADD CONSTRAINT "human_handoffs_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_packs" ADD CONSTRAINT "prompt_packs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
