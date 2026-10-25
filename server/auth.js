// Senhas e sessões. A senha nunca é gravada: o banco guarda só um hash scrypt com sal aleatório.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };
export const SESSION_DAYS = 30;
export const SESSION_COOKIE = "bandd_session";

// Formato salvo: scrypt$N$r$p$sal$hash (sal e hash em base64url).
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(expected, actual);
}

// Hash fixo usado quando o e-mail não existe, para o login levar o mesmo tempo nos dois casos.
let dummyHash = null;
export async function verifyAgainstDummy(password) {
  dummyHash ??= await hashPassword("bandd-dummy-password");
  await verifyPassword(password, dummyHash);
  return false;
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Limite simples em memória para tentativas de login e cadastro.
export function createRateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}
