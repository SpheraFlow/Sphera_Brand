import { Router, Request, Response } from "express";
import axios from "axios";
import { createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import db from "../config/database";
import { generateUUID } from "../utils/uuid";
import { validateApiKey } from "../middlewares/validateApiKey";

const router = Router();

// Interface para posts com métricas do Instagram
interface PostData {
  url: string;
  legenda: string;
  data: string;
  id_externo: string;
  // Novos campos de métricas
  media_id_instagram?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  reach?: number;
  impressions?: number;
  saves_count?: number;
  media_type?: string; // IMAGE, VIDEO, CAROUSEL_ALBUM
  permalink?: string;
}

interface IngestRequest {
  clienteId: string;
  posts: PostData[];
}

// Interface para atualização de métricas
interface MetricsUpdateRequest {
  clienteId: string;
  metrics: {
    media_id_instagram: string;
    likes_count?: number;
    comments_count?: number;
    shares_count?: number;
    reach?: number;
    impressions?: number;
    saves_count?: number;
  }[];
}

/**
 * Baixa imagem de URL e salva localmente
 */
async function downloadImage(url: string, destPath: string): Promise<void> {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
    });

    await pipeline(response.data, createWriteStream(destPath));
  } catch (error) {
    console.error(`Erro ao baixar imagem de ${url}:`, error);
    throw new Error(`Falha ao baixar imagem: ${url}`);
  }
}

/**
 * Gera nome de arquivo único baseado na URL
 */
function generateFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const extension = urlObj.pathname.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    return `n8n-${timestamp}-${random}.${extension}`;
  } catch {
    return `n8n-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  }
}

// POST /webhooks/ingest-posts - Recebe posts do n8n (com métricas)
router.post("/webhooks/ingest-posts", validateApiKey, async (req: Request, res: Response) => {
  try {
    const { clienteId, posts } = req.body as IngestRequest;

    console.log(`📥 Webhook recebido: ${posts?.length || 0} posts para cliente ${clienteId}`);

    // Validação: clienteId obrigatório
    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
    }

    // Validação: posts obrigatório e deve ser array
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({
        success: false,
        error: "posts deve ser um array com pelo menos 1 item"
      });
    }

    // Verificar se cliente existe
    const clienteExists = await db.query(
      `SELECT id FROM clientes WHERE id = $1`,
      [clienteId]
    );

    if (clienteExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cliente não encontrado"
      });
    }

    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    // Processar cada post
    for (const post of posts) {
      try {
        // Validar campos obrigatórios
        if (!post.url && !post.media_id_instagram) {
          errors.push(`Post sem URL ou media_id_instagram: ${JSON.stringify(post)}`);
          continue;
        }

        // Verificar se já existe pelo media_id_instagram (evitar duplicatas)
        if (post.media_id_instagram) {
          const existing = await db.query(
            `SELECT id FROM posts_originais WHERE media_id_instagram = $1`,
            [post.media_id_instagram]
          );

          if (existing.rows.length > 0) {
            // Atualizar métricas do post existente
            await db.query(
              `UPDATE posts_originais SET
                likes_count = COALESCE($1, likes_count),
                comments_count = COALESCE($2, comments_count),
                shares_count = COALESCE($3, shares_count),
                reach = COALESCE($4, reach),
                impressions = COALESCE($5, impressions),
                saves_count = COALESCE($6, saves_count),
                metrics_updated_at = NOW()
               WHERE media_id_instagram = $7`,
              [
                post.likes_count,
                post.comments_count,
                post.shares_count,
                post.reach,
                post.impressions,
                post.saves_count,
                post.media_id_instagram
              ]
            );

            console.log(`📊 Métricas atualizadas para post: ${post.media_id_instagram}`);
            updated++;
            continue;
          }
        }

        // Gerar nome de arquivo único e baixar imagem
        let fileName = null;
        if (post.url) {
          fileName = generateFileName(post.url);
          const filePath = join(uploadDir, fileName);
          await downloadImage(post.url, filePath);
        }

        // Inserir novo post no banco
        await db.query(
          `INSERT INTO posts_originais (
            id, cliente_id, imagem_path, legenda, data_post, id_externo,
            media_id_instagram, likes_count, comments_count, shares_count,
            reach, impressions, saves_count, media_type, permalink,
            importado_em, metrics_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
          [
            generateUUID(),
            clienteId,
            fileName,
            post.legenda || null,
            post.data ? new Date(post.data) : null,
            post.id_externo || null,
            post.media_id_instagram || null,
            post.likes_count || 0,
            post.comments_count || 0,
            post.shares_count || 0,
            post.reach || 0,
            post.impressions || 0,
            post.saves_count || 0,
            post.media_type || null,
            post.permalink || null
          ]
        );

        console.log(`✅ Post importado: ${post.media_id_instagram || post.id_externo || 'novo'}`);
        imported++;
      } catch (error) {
        console.error(`Erro ao processar post:`, error);
        errors.push(`Erro no post ${post.media_id_instagram || post.id_externo || post.url}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    // Retornar resultado
    return res.status(200).json({
      success: true,
      imported,
      updated,
      total: posts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao processar webhook. Tente novamente."
    });
  }
});

// POST /webhooks/update-metrics - Atualiza apenas métricas de posts existentes
router.post("/webhooks/update-metrics", validateApiKey, async (req: Request, res: Response) => {
  try {
    const { clienteId, metrics } = req.body as MetricsUpdateRequest;

    console.log(`📊 Atualizando métricas: ${metrics?.length || 0} posts`);

    // Validações
    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
    }

    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: "metrics deve ser um array com pelo menos 1 item"
      });
    }

    let updated = 0;
    let notFound = 0;
    const errors: string[] = [];

    for (const metric of metrics) {
      try {
        if (!metric.media_id_instagram) {
          errors.push("Item sem media_id_instagram");
          continue;
        }

        // Atualizar métricas
        const result = await db.query(
          `UPDATE posts_originais SET
            likes_count = COALESCE($1, likes_count),
            comments_count = COALESCE($2, comments_count),
            shares_count = COALESCE($3, shares_count),
            reach = COALESCE($4, reach),
            impressions = COALESCE($5, impressions),
            saves_count = COALESCE($6, saves_count),
            metrics_updated_at = NOW()
           WHERE media_id_instagram = $7 AND cliente_id = $8
           RETURNING id`,
          [
            metric.likes_count,
            metric.comments_count,
            metric.shares_count,
            metric.reach,
            metric.impressions,
            metric.saves_count,
            metric.media_id_instagram,
            clienteId
          ]
        );

        if (result.rows.length > 0) {
          // Salvar no histórico de métricas
          await db.query(
            `INSERT INTO posts_metrics_history (
              post_original_id, likes_count, comments_count, shares_count,
              reach, impressions, saves_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              result.rows[0].id,
              metric.likes_count || 0,
              metric.comments_count || 0,
              metric.shares_count || 0,
              metric.reach || 0,
              metric.impressions || 0,
              metric.saves_count || 0
            ]
          );

          updated++;
        } else {
          notFound++;
        }
      } catch (error) {
        console.error(`Erro ao atualizar métrica:`, error);
        errors.push(`Erro em ${metric.media_id_instagram}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    return res.status(200).json({
      success: true,
      updated,
      notFound,
      total: metrics.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Erro ao atualizar métricas:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar métricas."
    });
  }
});

// GET /webhooks/metrics/:clienteId - Retorna métricas consolidadas do cliente
router.get("/webhooks/metrics/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    // Buscar métricas agregadas
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_posts,
        SUM(likes_count) as total_likes,
        SUM(comments_count) as total_comments,
        SUM(shares_count) as total_shares,
        SUM(reach) as total_reach,
        SUM(impressions) as total_impressions,
        SUM(saves_count) as total_saves,
        AVG(likes_count) as avg_likes,
        AVG(comments_count) as avg_comments,
        MAX(likes_count) as max_likes,
        MAX(reach) as max_reach
       FROM posts_originais 
       WHERE cliente_id = $1`,
      [clienteId]
    );

    // Buscar posts com melhores métricas
    const topPosts = await db.query(
      `SELECT id, legenda, media_type, likes_count, comments_count, reach, permalink, data_post
       FROM posts_originais 
       WHERE cliente_id = $1 
       ORDER BY likes_count DESC 
       LIMIT 5`,
      [clienteId]
    );

    return res.json({
      success: true,
      summary: result.rows[0],
      topPosts: topPosts.rows
    });

  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao buscar métricas."
    });
  }
});

export default router;
