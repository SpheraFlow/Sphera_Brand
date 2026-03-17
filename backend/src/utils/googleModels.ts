export type GeminiModelTier = "fast" | "quality";

type ModelPricing = {
  input: number;
  output: number;
};

const DEFAULT_FAST_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const;

const DEFAULT_QUALITY_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const;

const parseEnvList = (value?: string): string[] =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function getGeminiModelCandidates(tier: GeminiModelTier = "fast"): string[] {
  const envSpecific =
    tier === "quality"
      ? parseEnvList(process.env.GEMINI_QUALITY_MODELS)
      : parseEnvList(process.env.GEMINI_FAST_MODELS);
  const envPrimary = parseEnvList(process.env.GEMINI_PRIMARY_MODEL);
  const defaults = tier === "quality" ? [...DEFAULT_QUALITY_MODELS] : [...DEFAULT_FAST_MODELS];

  return Array.from(new Set([...envSpecific, ...envPrimary, ...defaults]));
}

export function getPrimaryGeminiModel(tier: GeminiModelTier = "fast"): string {
  return getGeminiModelCandidates(tier)[0] || "gemini-2.5-flash";
}

const MODEL_PRICING_USD_PER_MILLION: Record<string, ModelPricing> = {
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
};

const DEFAULT_PRICING: ModelPricing = { input: 0.3, output: 2.5 };

export function getGeminiModelPricing(model: string): ModelPricing {
  const normalized = String(model || "").trim();
  const key = Object.keys(MODEL_PRICING_USD_PER_MILLION).find((candidate) =>
    normalized.startsWith(candidate)
  );

  if (!key) return DEFAULT_PRICING;
  const pricing = MODEL_PRICING_USD_PER_MILLION[key];
  return pricing || DEFAULT_PRICING;
}
