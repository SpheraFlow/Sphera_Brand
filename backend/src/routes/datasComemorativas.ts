import { Router, Request, Response } from "express";
import { getDatasComemorativas } from "../services/contextoService";

const router = Router();

// GET /api/datas-comemorativas?mes=12&ano=2025&categorias[]=saude&categorias[]=geral
router.get("/datas-comemorativas", async (req: Request, res: Response) => {
  try {
    const { mes, ano } = req.query;
    let { categorias } = req.query as { categorias?: string | string[] };

    const mesNum = mes ? parseInt(mes as string, 10) : NaN;
    const anoNum = ano ? parseInt(ano as string, 10) : NaN;

    if (!mesNum || !anoNum || isNaN(mesNum) || isNaN(anoNum)) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'mes' e 'ano' são obrigatórios e devem ser numéricos.",
      });
    }

    let categoriasArray: string[] | undefined;
    if (categorias) {
      categoriasArray = Array.isArray(categorias) ? categorias : [categorias];
    }

    const datas = await getDatasComemorativas(mesNum, anoNum, categoriasArray);

    return res.json({ success: true, datas });
  } catch (error) {
    console.error("❌ Erro ao buscar datas comemorativas:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar datas comemorativas." });
  }
});

export default router;
