import { Router, Request, Response } from "express";
import { getDatasComemorativas } from "../services/contextoService";
import db from "../config/database";

const router = Router();

function normalizeCategorias(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((c) => String(c).trim())
      .filter((c) => c.length > 0);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  return [];
}

// GET /api/datas-comemorativas?mes=12&ano=2025&categorias[]=saude&categorias[]=geral
router.get("/datas-comemorativas", async (req: Request, res: Response) => {
  try {
    const { mes, ano } = req.query;
    const { categorias } = req.query as { categorias?: string | string[] };

    const mesNum = mes ? parseInt(mes as string, 10) : NaN;
    const anoNum = ano ? parseInt(ano as string, 10) : NaN;

    if (!mesNum || !anoNum || isNaN(mesNum) || isNaN(anoNum)) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'mes' e 'ano' são obrigatórios e devem ser numéricos.",
      });
    }

    const categoriasNormalized = normalizeCategorias(categorias);
    const categoriasArray = categoriasNormalized.length > 0 ? categoriasNormalized : undefined;

    const datas = await getDatasComemorativas(mesNum, anoNum, categoriasArray);

    return res.json({ success: true, datas });
  } catch (error) {
    console.error("❌ Erro ao buscar datas comemorativas:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar datas comemorativas." });
  }
});

router.post("/datas-comemorativas", async (req: Request, res: Response) => {
  try {
    const { data, titulo, categorias, descricao, relevancia } = req.body || {};

    if (!data || !titulo) {
      return res.status(400).json({
        success: false,
        error: "Campos 'data' e 'titulo' são obrigatórios.",
      });
    }

    const categoriasArray = normalizeCategorias(categorias);
    const relevanciaNum = Number.isFinite(Number(relevancia)) ? Number(relevancia) : 0;

    const result = await db.query(
      `INSERT INTO datas_comemorativas (data, titulo, categorias, descricao, relevancia)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (data, titulo) DO UPDATE
       SET categorias = EXCLUDED.categorias,
           descricao = EXCLUDED.descricao,
           relevancia = EXCLUDED.relevancia
       RETURNING id, data, titulo, categorias, descricao, relevancia, criado_em`,
      [data, titulo, JSON.stringify(categoriasArray), descricao || null, relevanciaNum]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("❌ Erro ao criar data comemorativa:", error);
    return res.status(500).json({ success: false, error: "Erro ao criar data comemorativa." });
  }
});

router.put("/datas-comemorativas/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, titulo, categorias, descricao, relevancia } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: "Parâmetro 'id' é obrigatório." });
    }

    if (!data || !titulo) {
      return res.status(400).json({
        success: false,
        error: "Campos 'data' e 'titulo' são obrigatórios.",
      });
    }

    const categoriasArray = normalizeCategorias(categorias);
    const relevanciaNum = Number.isFinite(Number(relevancia)) ? Number(relevancia) : 0;

    const result = await db.query(
      `UPDATE datas_comemorativas
       SET data = $2,
           titulo = $3,
           categorias = $4::jsonb,
           descricao = $5,
           relevancia = $6
       WHERE id = $1
       RETURNING id, data, titulo, categorias, descricao, relevancia, criado_em`,
      [id, data, titulo, JSON.stringify(categoriasArray), descricao || null, relevanciaNum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Data comemorativa não encontrada." });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("❌ Erro ao atualizar data comemorativa:", error);
    return res.status(500).json({ success: false, error: "Erro ao atualizar data comemorativa." });
  }
});

router.delete("/datas-comemorativas/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM datas_comemorativas WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Data comemorativa não encontrada." });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Erro ao remover data comemorativa:", error);
    return res.status(500).json({ success: false, error: "Erro ao remover data comemorativa." });
  }
});

export default router;
