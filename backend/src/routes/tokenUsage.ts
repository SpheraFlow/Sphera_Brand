import { Router, Response } from "express";
import { getTokenUsage, resetTokenUsage } from "../utils/tokenTracker";
import { requireAuth, requirePermission, AuthRequest } from "../middlewares/requireAuth";

const router = Router();

// Todas as rotas de Token Usage exigem autenticação
router.use(requireAuth);

// GET /api/token-usage/:clienteId - Consultar uso de tokens de um cliente
router.get("/:clienteId", requirePermission('dashboard_view'), async (req: AuthRequest, res: Response) => {
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

// POST /api/token-usage/:clienteId/reset - Resetar contador de tokens (Apenas admin via dashboard_view ou clients_manage)
// Vamos usar clients_manage pois envolver resetar billing/gastos
router.post("/:clienteId/reset", requirePermission('clients_manage'), async (req: AuthRequest, res: Response) => {
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
