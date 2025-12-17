import { Router, Request, Response } from "express";
import { getTokenUsage, resetTokenUsage } from "../utils/tokenTracker";

const router = Router();

// GET /api/token-usage/:clienteId - Consultar uso de tokens de um cliente
router.get("/:clienteId", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
    }

    const usage = await getTokenUsage(clienteId);

    if (!usage) {
      return res.status(404).json({
        success: false,
        error: "Cliente não encontrado ou sem dados de uso de tokens"
      });
    }

    return res.json({
      success: true,
      data: usage
    });
  } catch (error: any) {
    console.error("❌ Erro ao consultar uso de tokens:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao consultar uso de tokens"
    });
  }
});

// POST /api/token-usage/:clienteId/reset - Resetar contador de tokens
router.post("/:clienteId/reset", async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.params;

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: "clienteId é obrigatório"
      });
    }

    await resetTokenUsage(clienteId);

    return res.json({
      success: true,
      message: "Contador de tokens resetado com sucesso"
    });
  } catch (error: any) {
    console.error("❌ Erro ao resetar tokens:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao resetar tokens"
    });
  }
});

export default router;
