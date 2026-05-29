/**
 * STORY-016 — Servico de publicacao direta na Meta Graph API (Instagram).
 *
 * Encapsula os tres fluxos de publicacao da Graph API e os helpers de payload
 * e de audit log append-only, mantendo o `publishingWorker` enxuto:
 *
 *   - publishImage  (2-step): POST /{ig}/media -> POST /{ig}/media_publish
 *   - publishReels  (3-step): POST /{ig}/media (REELS) -> poll status_code
 *                              ate FINISHED -> POST /{ig}/media_publish
 *
 * Seguranca: o token NUNCA e logado (nem plaintext nem ciphertext). Erros da
 * Meta sao normalizados em mensagens curtas, sem ecoar o corpo bruto da
 * resposta (que pode conter o token na query refletida).
 *
 * URL publica de midia: a Meta exige `image_url`/`video_url` acessivel
 * publicamente. As imagens geradas (STORY-008) sao salvas como caminho
 * relativo (ex.: /storage/creative-assets/...). `toPublicMediaUrl` converte
 * para absoluto usando o host publico do backend (API_PUBLIC_URL sem /api).
 */
import axios from "axios";
import db from "../config/database";
import logger from "../utils/logger";

const pubLog = logger.child({ component: "publicationService" });

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/** Base publica do backend (sem /api) para servir assets estaticos a Meta. */
const PUBLIC_ASSET_BASE_URL = (() => {
    const explicit = process.env.PUBLIC_ASSET_BASE_URL;
    if (explicit) return explicit.replace(/\/$/, "");
    // API_PUBLIC_URL costuma terminar em /api; a Meta precisa do host raiz.
    const apiUrl = (process.env.API_PUBLIC_URL || "http://localhost:3001/api").trim();
    return apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
})();

/** Polling de Reels: ate 10 tentativas com 6s de intervalo (~1 min de timeout). */
const REELS_POLL_MAX_ATTEMPTS = 10;
const REELS_POLL_INTERVAL_MS = 6000;

export type PublicationMediaType = "IMAGE" | "REELS";

export interface PublicationPayload {
    media_type: PublicationMediaType;
    media_url: string;
    caption: string;
}

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/** Converte um caminho de midia possivelmente relativo em URL absoluta publica. */
export function toPublicMediaUrl(mediaUrl: string): string {
    if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;
    const path = mediaUrl.startsWith("/") ? mediaUrl : `/${mediaUrl}`;
    return `${PUBLIC_ASSET_BASE_URL}${path}`;
}

/**
 * Monta o payload de publicacao a partir do calendar_item + calendario_json.
 * - media_url: imagem gerada (calendar_items.image_url), convertida p/ absoluta.
 * - caption:   copy_inicial/legenda casada no calendario_json (dia+tema+formato).
 * - media_type: REELS para formato 'Reels', senao IMAGE.
 *
 * Lanca erro (mensagem clara) se nao houver midia publicavel — o caller decide
 * se isso vira falha de agendamento (sem retry, pois nao e transitorio).
 */
export async function buildPayloadFromCalendarItem(
    calendarItemId: string
): Promise<PublicationPayload> {
    const result = await db.query(
        `SELECT ci.dia, ci.tema, ci.formato, ci.image_url, c.calendario_json
           FROM calendar_items ci
           LEFT JOIN calendarios c ON c.id = ci.calendario_id
          WHERE ci.id = $1`,
        [calendarItemId]
    );

    if (result.rows.length === 0) {
        throw new Error(`calendar_item ${calendarItemId} nao encontrado.`);
    }

    const row = result.rows[0];
    const imageUrl = String(row.image_url || "").trim();
    if (!imageUrl) {
        throw new Error(
            "Post sem imagem gerada (image_url vazio). Gere a arte antes de agendar."
        );
    }

    const formato = String(row.formato || "").trim();
    const mediaType: PublicationMediaType =
        formato.toLowerCase() === "reels" ? "REELS" : "IMAGE";

    const caption = resolveCaption(row);

    return {
        media_type: mediaType,
        media_url: toPublicMediaUrl(imageUrl),
        caption,
    };
}

/** Casa o calendar_item com a entrada do calendario_json para extrair a copy. */
function resolveCaption(row: any): string {
    const tema = String(row?.tema || "").trim();
    const formato = String(row?.formato || "").trim();
    const dia = row?.dia;
    const calendarioJson = row?.calendario_json;

    const posts: any[] = Array.isArray(calendarioJson)
        ? calendarioJson
        : typeof calendarioJson === "string"
            ? safeJsonArray(calendarioJson)
            : [];

    const match = posts.find((p) => {
        if (!p || typeof p !== "object") return false;
        const pDia = typeof p.dia === "number" ? p.dia : parseInt(String(p.dia || ""), 10);
        return (
            pDia === Number(dia) &&
            String(p.tema || "").trim() === tema &&
            String(p.formato || "").trim() === formato
        );
    });

    const legenda = match ? String(match.legenda || "").trim() : "";
    const copy = match ? String(match.copy_inicial || "").trim() : "";
    // Preferencia: legenda finalizada > copy inicial > tema (fallback minimo).
    return legenda || copy || tema || "";
}

function safeJsonArray(raw: string): any[] {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** Normaliza erros da Meta sem vazar o corpo bruto (que reflete o token). */
function metaErrorMessage(error: any, fallback: string): string {
    const apiMsg = error?.response?.data?.error?.message;
    if (typeof apiMsg === "string" && apiMsg.length > 0) {
        const status = error?.response?.status;
        return status ? `Meta API ${status}: ${apiMsg}` : `Meta API: ${apiMsg}`;
    }
    return String(error?.message || fallback);
}

/**
 * Publicacao de imagem (2-step). Retorna o platform_post_id (media id).
 */
export async function publishImage(
    igUserId: string,
    token: string,
    payload: PublicationPayload
): Promise<string> {
    // Step 1: cria o container de midia.
    let containerId: string;
    try {
        const containerRes = await axios.post(
            `${META_GRAPH_BASE}/${igUserId}/media`,
            null,
            {
                params: {
                    image_url: payload.media_url,
                    caption: payload.caption,
                    access_token: token,
                },
            }
        );
        containerId = String(containerRes.data?.id || "");
        if (!containerId) throw new Error("Container de midia nao retornou id.");
    } catch (error: any) {
        throw new Error(metaErrorMessage(error, "Falha ao criar container de imagem."));
    }

    // Step 2: publica o container.
    return publishContainer(igUserId, token, containerId);
}

/**
 * Publicacao de Reels (3-step): cria container REELS, faz polling do
 * status_code ate FINISHED e entao publica. Timeout (~1 min) lanca erro
 * (tratado como transitorio pelo worker -> retry com backoff).
 */
export async function publishReels(
    igUserId: string,
    token: string,
    payload: PublicationPayload
): Promise<string> {
    // Step 1: cria o container REELS (video_url).
    let containerId: string;
    try {
        const containerRes = await axios.post(
            `${META_GRAPH_BASE}/${igUserId}/media`,
            null,
            {
                params: {
                    media_type: "REELS",
                    video_url: payload.media_url,
                    caption: payload.caption,
                    access_token: token,
                },
            }
        );
        containerId = String(containerRes.data?.id || "");
        if (!containerId) throw new Error("Container de Reels nao retornou id.");
    } catch (error: any) {
        throw new Error(metaErrorMessage(error, "Falha ao criar container de Reels."));
    }

    // Step 2: polling do processamento assincrono do video.
    await waitForContainerReady(token, containerId);

    // Step 3: publica.
    return publishContainer(igUserId, token, containerId);
}

/** Polling de status_code de um container ate FINISHED (ou erro/timeout). */
async function waitForContainerReady(token: string, containerId: string): Promise<void> {
    for (let attempt = 1; attempt <= REELS_POLL_MAX_ATTEMPTS; attempt++) {
        let statusCode: string;
        try {
            const statusRes = await axios.get(`${META_GRAPH_BASE}/${containerId}`, {
                params: { fields: "status_code", access_token: token },
            });
            statusCode = String(statusRes.data?.status_code || "");
        } catch (error: any) {
            throw new Error(metaErrorMessage(error, "Falha ao consultar status do container."));
        }

        if (statusCode === "FINISHED") {
            pubLog.info(
                { event: "reels_container_ready", container_id: containerId, attempt },
                "Container de Reels pronto para publicacao"
            );
            return;
        }
        if (statusCode === "ERROR" || statusCode === "EXPIRED") {
            throw new Error(`Container de Reels em estado terminal: ${statusCode}.`);
        }

        // IN_PROGRESS / PUBLISHED-ainda-nao: aguarda e tenta de novo.
        if (attempt < REELS_POLL_MAX_ATTEMPTS) {
            await sleep(REELS_POLL_INTERVAL_MS);
        }
    }
    // Timeout: lanca erro com mensagem "timeout" -> isTransientError() => retry.
    throw new Error(
        `Timeout aguardando processamento do Reels (${REELS_POLL_MAX_ATTEMPTS} tentativas).`
    );
}

/** Step final comum aos dois fluxos: media_publish do container. */
async function publishContainer(
    igUserId: string,
    token: string,
    containerId: string
): Promise<string> {
    try {
        const publishRes = await axios.post(
            `${META_GRAPH_BASE}/${igUserId}/media_publish`,
            null,
            {
                params: { creation_id: containerId, access_token: token },
            }
        );
        const postId = String(publishRes.data?.id || "");
        if (!postId) throw new Error("media_publish nao retornou id do post.");
        return postId;
    } catch (error: any) {
        throw new Error(metaErrorMessage(error, "Falha ao publicar container."));
    }
}

/**
 * Insere um evento no audit log append-only `publication_logs`.
 * Nunca lanca para nao mascarar o fluxo principal — registra warn em falha.
 * IMPORTANTE: somente INSERT; esta tabela jamais sofre UPDATE/DELETE.
 */
export async function appendPublicationLog(
    scheduleId: string,
    event: string,
    payload: Record<string, unknown> = {}
): Promise<void> {
    try {
        await db.query(
            `INSERT INTO publication_logs (publication_schedule_id, event, payload)
             VALUES ($1, $2, $3)`,
            [scheduleId, event, JSON.stringify(payload)]
        );
    } catch (err: any) {
        pubLog.warn(
            { event: "publication_log_insert_failed", schedule_id: scheduleId, log_event: event, err: err?.message },
            "Falha ao registrar evento em publication_logs"
        );
    }
}
