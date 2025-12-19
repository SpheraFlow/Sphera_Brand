import { Router, Request, Response } from "express";
import db from "../config/database";

const router = Router();

function normalizeCategoriasNicho(input: unknown): string[] {
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

// POST /api/clients - Criar novo cliente
router.post("/", async (req: Request, res: Response) => {
  console.log("📝 POST /api/clients - Recebido:", req.body);
  
  try {
    const { nome, categorias_nicho } = req.body;

    if (!nome) {
      console.warn("⚠️ Nome não fornecido");
      return res.status(400).json({ 
        success: false, 
        error: "Campo 'nome' é obrigatório." 
      });
    }

    console.log("💾 Inserindo cliente no banco:", nome);
    const result = await db.query(
      `INSERT INTO clientes (nome, categorias_nicho)
       VALUES ($1, $2::jsonb)
       RETURNING id, nome, categorias_nicho, criado_em`,
      [nome, JSON.stringify(normalizeCategoriasNicho(categorias_nicho))]
    );

    console.log("✅ Cliente criado com sucesso:", result.rows[0]);

    return res.status(201).json({ 
      success: true, 
      cliente: result.rows[0] 
    });
  } catch (error: any) {
    console.error("❌ Erro ao criar cliente:", error.message);
    console.error("Stack:", error.stack);
    return res.status(500).json({ 
      success: false, 
      error: "Erro ao criar cliente: " + error.message 
    });
  }
});

// DELETE /api/clients/:id - Excluir cliente (e tudo vinculado via ON DELETE CASCADE)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query("DELETE FROM clientes WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cliente não encontrado.",
      });
    }

    return res.json({
      success: true,
      message: "Cliente excluído com sucesso.",
    });
  } catch (error: any) {
    console.error("❌ Erro ao excluir cliente:", error.message);
    return res.status(500).json({
      success: false,
      error: "Erro ao excluir cliente.",
    });
  }
});

// GET /api/clients - Listar todos os clientes
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      "SELECT id, nome, persona_atualizada, categorias_nicho, criado_em FROM clientes ORDER BY criado_em DESC"
    );

    // Adicionar campos virtuais para a UI
    const clientesComExtras = result.rows.map((cliente: any) => ({
      ...cliente,
      status: "Ativo", // Campo virtual
      avatarUrl: null,  // Pode ser implementado futuramente
    }));

    return res.json({ 
      success: true, 
      clientes: clientesComExtras 
    });
  } catch (error) {
    console.error("❌ Erro ao listar clientes:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Erro ao listar clientes." 
    });
  }
});

// GET /api/clients/:id - Buscar cliente por ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "SELECT id, nome, persona_atualizada, categorias_nicho, criado_em FROM clientes WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "Cliente não encontrado." 
      });
    }

    return res.json({ 
      success: true, 
      cliente: result.rows[0] 
    });
  } catch (error) {
    console.error("❌ Erro ao buscar cliente:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar cliente." 
    });
  }
});

// PUT /api/clients/:id - Atualizar dados do cliente (nome e/ou categorias_nicho)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, categorias_nicho } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: "Parâmetro 'id' é obrigatório." });
    }

    const categoriasArray = normalizeCategoriasNicho(categorias_nicho);
    const hasNome = typeof nome === "string" && nome.trim().length > 0;
    const hasCategorias = categorias_nicho !== undefined;

    if (!hasNome && !hasCategorias) {
      return res.status(400).json({
        success: false,
        error: "Envie pelo menos um campo para atualizar: 'nome' ou 'categorias_nicho'.",
      });
    }

    const sets: string[] = [];
    const params: any[] = [id];
    let i = 2;

    if (hasNome) {
      sets.push(`nome = $${i}`);
      params.push(String(nome).trim());
      i++;
    }

    if (hasCategorias) {
      sets.push(`categorias_nicho = $${i}::jsonb`);
      params.push(JSON.stringify(categoriasArray));
      i++;
    }

    const result = await db.query(
      `UPDATE clientes SET ${sets.join(", ")} WHERE id = $1 RETURNING id, nome, persona_atualizada, categorias_nicho, criado_em`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Cliente não encontrado." });
    }

    return res.json({ success: true, cliente: result.rows[0] });
  } catch (error: any) {
    console.error("❌ Erro ao atualizar cliente:", error.message);
    return res.status(500).json({ success: false, error: "Erro ao atualizar cliente." });
  }
});

export default router;
