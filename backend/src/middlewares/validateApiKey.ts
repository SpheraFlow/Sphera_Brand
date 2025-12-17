import { Request, Response, NextFunction } from "express";

/**
 * Middleware para validar API Key do n8n
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.N8N_API_KEY;

  if (!expectedKey) {
    console.error("N8N_API_KEY não configurada no .env");
    res.status(500).json({
      success: false,
      error: "Servidor não configurado para aceitar webhooks"
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: "API Key não fornecida. Use o header 'x-api-key'"
    });
    return;
  }

  if (apiKey !== expectedKey) {
    res.status(401).json({
      success: false,
      error: "API Key inválida"
    });
    return;
  }

  next();
};

