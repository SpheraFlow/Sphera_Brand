import { randomUUID } from "crypto";

/**
 * Gera um UUID v4
 * @returns UUID string
 */
export const generateUUID = (): string => {
  return randomUUID();
};

