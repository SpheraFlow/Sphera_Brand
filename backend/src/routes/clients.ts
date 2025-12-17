import { Router, Request, Response } from "express";
import db from "../config/database";

const router = Router();

// POST /api/clients - Criar novo cliente
router.post("/", async (req: Request, res: Response) => {
  console.log("📝 POST /api/clients - Recebido:", req.body);
  
  try {
    const { nome } = req.body;

    if (!nome) {
      console.warn("⚠️ Nome não fornecido");
      return res.status(400).json({ 
        success: false, 
        error: "Campo 'nome' é obrigatório." 
      });
    }

    console.log("💾 Inserindo cliente no banco:", nome);
    const result = await db.query(
      `INSERT INTO clientes (nome) 
       VALUES ($1) 
       RETURNING id, nome, criado_em`,
      [nome]
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
      "SELECT id, nome, persona_atualizada, criado_em FROM clientes ORDER BY criado_em DESC"
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
      "SELECT id, nome, persona_atualizada, criado_em FROM clientes WHERE id = $1",
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

export default router;
