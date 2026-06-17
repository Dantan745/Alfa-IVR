import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password), salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function verifyPassword(password, stored) {
  const raw = String(stored || "");
  const parts = raw.split("$");
  if (parts[0] === "scrypt" && parts.length === 6) {
    const key = await scrypt(String(password), Buffer.from(parts[4], "hex"), Buffer.from(parts[5], "hex").length, {
      N: Number(parts[1]),
      r: Number(parts[2]),
      p: Number(parts[3]),
      maxmem: SCRYPT.maxmem,
    });
    return safeEqual(key, Buffer.from(parts[5], "hex"));
  }
  const sha = parts[0] === "sha256" ? parts[1] : (/^[a-f0-9]{64}$/i.test(raw) ? raw : "");
  if (!sha) return false;
  const got = crypto.createHash("sha256").update(String(password), "utf8").digest("hex");
  return safeEqual(got, sha.toLowerCase());
}

export function isScryptHash(stored) {
  return String(stored || "").startsWith("scrypt$");
}
