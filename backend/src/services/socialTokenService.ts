/**
 * STORY-015 — Servico de criptografia de tokens sociais (AES-256-GCM).
 *
 * Tokens OAuth de longa duracao (Meta) sao dados sensiveis e NUNCA sao
 * persistidos em plaintext. Este modulo encapsula a criptografia simetrica
 * autenticada (AES-256-GCM):
 *   - IV de 96 bits gerado aleatoriamente por operacao (NUNCA reutilizado).
 *   - authTag de 128 bits garante integridade (detecta adulteracao).
 *   - Formato serializado em base64: iv(12) + authTag(16) + ciphertext.
 *
 * A chave vem de `SOCIAL_TOKEN_ENCRYPTION_KEY` (32 bytes em base64) e e
 * validada no carregamento do modulo — falha rapido no startup se ausente
 * ou com tamanho invalido, em vez de falhar silenciosamente em runtime.
 *
 * Seguranca: este modulo nunca loga tokens (nem plaintext, nem ciphertext).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY = Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "", "base64");
if (KEY.length !== 32) {
    throw new Error(
        "SOCIAL_TOKEN_ENCRYPTION_KEY deve ser 32 bytes (256-bit) em base64."
    );
}

/**
 * Criptografa um token em plaintext, retornando string base64
 * (iv + authTag + ciphertext).
 */
export function encrypt(plaintext: string): string {
    const iv = randomBytes(12); // 96-bit IV para GCM
    const cipher = createCipheriv("aes-256-gcm", KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Formato: iv(12) + authTag(16) + ciphertext — tudo em base64
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decripta uma string base64 produzida por `encrypt`. Lanca erro se o
 * authTag nao casar (token adulterado ou chave incorreta).
 */
export function decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final("utf8");
}
