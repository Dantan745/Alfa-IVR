import type { DbContact, DbNote, DbTx, DbUser, DbWallet } from "./db";

export type Snapshot = {
  token?: string;
  user: Omit<DbUser, "passwordHash">;
  wallet: DbWallet;
  txs: DbTx[];
  notes: DbNote[];
  contacts: DbContact[];
  ok?: number;
  fail?: number;
};

const TOKEN_KEY = "alfa-cr-token";
const DEVICE_KEY = "alfa-device-id";

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY) || "";
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() || ("dev-" + Math.random().toString(36).slice(2) + Date.now())).slice(0, 36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function apiUrl(path: string) {
  const origin = String(import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
  return origin ? origin + path : path;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  headers.set("X-Device-Id", getDeviceId());
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new Error(import.meta.env.VITE_API_ORIGIN
      ? "Нет связи с сервером. Проверьте интернет."
      : "Нет связи с сервером. Запустите его на этом компьютере.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка сервера");
  return data as T;
}

function remember(snap: Snapshot) {
  if (snap.token) setToken(snap.token);
  return snap;
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  requestCode: (body: { login?: string; email?: string; phone?: string; password?: string; channel?: "sms" | "email"; purpose?: "login" | "register" | "pay" | "reset"; amount?: number }) =>
    req<{ ok: boolean; via: string; masked?: string; fallback?: boolean; needLink?: boolean; botUrl?: string }>("/api/auth/request-code", { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, password: string, code?: string) =>
    req<Snapshot>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, code }) }).then(remember),
  forgot: (login: string, channel?: "sms" | "email") =>
    req<{ ok: boolean; via: string; masked?: string; fallback?: boolean; needLink?: boolean; botUrl?: string }>("/api/auth/forgot", { method: "POST", body: JSON.stringify({ login, channel: channel || "email" }) }),
  reset: (login: string, code: string, password: string) =>
    req<Snapshot>("/api/auth/reset", { method: "POST", body: JSON.stringify({ login, code, password }) }).then(remember),
  register: (body: Record<string, string>) =>
    req<Snapshot>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }).then(remember),
  logout: () => req("/api/auth/logout", { method: "POST" }).finally(() => setToken(null)),
  me: () => req<Snapshot>("/api/me"),
  transfer: (payee: string, amount: number, comment?: string, code?: string) =>
    req<Snapshot>("/api/transfer", { method: "POST", body: JSON.stringify({ payee, amount, comment, code }) }),
  topUp: (amount: number) => req<Snapshot>("/api/topup", { method: "POST", body: JSON.stringify({ amount }) }),
  qrPay: (amount: number, extra?: { code?: string; merchant?: string; payee?: string }) =>
    req<Snapshot>("/api/qr", { method: "POST", body: JSON.stringify({ amount, ...extra }) }),
  bulkPay: (rows: { name: string; phone: string; amount: number }[], code?: string) =>
    req<Snapshot & { ok: number; fail: number }>("/api/bulk", { method: "POST", body: JSON.stringify({ rows, code }) }),
  addContact: (name: string, phone: string) =>
    req<Snapshot>("/api/contacts", { method: "POST", body: JSON.stringify({ name, phone }) }),
  toggleFav: (id: string, favorite: boolean) =>
    req<Snapshot>("/api/contacts/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ favorite }) }),
  removeContact: (id: string) =>
    req<Snapshot>("/api/contacts/" + encodeURIComponent(id), { method: "DELETE" }),
  markNotesRead: () => req<Snapshot>("/api/notes/read-all", { method: "POST" }),
  markNoteRead: (id: string) =>
    req<Snapshot>("/api/notes/" + encodeURIComponent(id) + "/read", { method: "POST" }),
  updateSecurity: (patch: Partial<Pick<DbWallet, "biometric" | "pin" | "hideBalance">> & { otpChannel?: "sms" | "email" }) =>
    req<Snapshot>("/api/security", { method: "PATCH", body: JSON.stringify(patch) }),
  updateLimits: (patch: Record<string, number>) =>
    req<Snapshot>("/api/limits", { method: "PATCH", body: JSON.stringify(patch) }),
  addSupportNote: (text: string) =>
    req<Snapshot>("/api/support", { method: "POST", body: JSON.stringify({ text }) }),
};
