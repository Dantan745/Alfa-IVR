import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { deliver, loadNotify, hydrateNotify, publicNotify, saveNotify } from "./notify.mjs";
import { buildReport, extractFeatures, runCustomModel, scoreWithFriendModelAsync } from "./ml/index.mjs";
import { buildFraudSample } from "./ml/features.mjs";
import { formatRuPhone, isRuMobile, ruMobileDigits, samePhone } from "./phone.mjs";
import { hashPassword, isScryptHash, verifyPassword } from "./passwords.mjs";
import * as db from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");
const DIST = path.join(__dirname, "..", "web", "dist");
const DEMO_EMAIL = "ivan@alfa.demo";
const DEMO_PASS = "Demo1234";
const PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const LOCK_AFTER = 8;
const LOCK_MS = 15 * 60 * 1000;
const EMAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const PAY_OTP_LIMIT = 10000;
const CODE_TTL = 10 * 60 * 1000;

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function uid(prefix = "") {
  return prefix + crypto.randomUUID();
}

function nowOffset(days, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if ((n.family === "IPv4" || n.family === 4) && !n.internal) out.push(n.address);
    }
  }
  const rank = (ip) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : ip.startsWith("172.") ? 2 : 3);
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b));
}

function defaultLimits() {
  return { day: 50000, month: 100000, op: 30000, abroad: 10000, alertDay: 80, alertMonth: 70, alertOp: 90, alertAbroad: 100 };
}

function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts = Date.now()) {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function limitsOf(email) {
  const wallet = await db.getWallet(email);
  return { ...defaultLimits(), ...(wallet?.limits || {}) };
}

async function usageOf(email) {
  return {
    day: await db.spentSince(email, startOfDay(), true),
    month: await db.spentSince(email, startOfMonth(), false),
    abroad: 0,
  };
}

async function assertLimits(email, amount) {
  const L = await limitsOf(email);
  const u = await usageOf(email);
  if (amount > L.op) {
    throw new Error(`Превышен лимит одной операции (${L.op.toLocaleString("ru-RU")} ₽)`);
  }
  if (u.day + amount > L.day) {
    throw new Error(`Превышен дневной лимит переводов (${L.day.toLocaleString("ru-RU")} ₽). Уже использовано ${u.day.toLocaleString("ru-RU")} ₽`);
  }
  if (u.month + amount > L.month) {
    throw new Error(`Превышен месячный лимит расходов (${L.month.toLocaleString("ru-RU")} ₽). Уже использовано ${u.month.toLocaleString("ru-RU")} ₽`);
  }
}

function locked(fn) {
  return db.withTx(fn);
}

function adminKeyOk(presented) {
  const expected = ADMIN_KEY || (PRODUCTION ? "" : "AlfaDev-2026");
  if (!expected || (PRODUCTION && (expected === "AlfaDev-2026" || expected.length < 16))) return false;
  const a = Buffer.from(String(presented || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
  const fly = String(req.headers["fly-client-ip"] || "").trim();
  if (fly) return fly.slice(0, 64);
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return (forwarded || req.socket?.remoteAddress || "local").slice(0, 64);
}

const hits = new Map();
function tooMany(key, limit, windowMs) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.reset <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  row.n += 1;
  return row.n > limit;
}

function rateOver(key, limit) {
  const row = hits.get(key);
  return Boolean(row && row.reset > Date.now() && row.n >= limit);
}

function publicError(err) {
  const m = String(err?.message || "");
  if (!m || m.length > 240 || /select |insert |update |delete |syntax|econn|authentication|relation |column |scrypt|password_hash/i.test(m)) {
    return "Ошибка сервера";
  }
  return m;
}

function publicWallet(wallet, extra = {}) {
  if (!wallet) return null;
  const { pin, ...rest } = wallet;
  return { ...rest, pinSet: Boolean(pin), ...extra };
}

function publicUser(u, extra = {}) {
  if (!u) return null;
  const { passwordHash, devices, freezeReason, frozenBy, frozenTxId, frozenAt, lockedUntil, ...rest } = u;
  if (extra.admin) {
    return {
      ...rest,
      freezeReason,
      frozenBy,
      frozenTxId,
      frozenAt,
      devices: devices || [],
      deviceCount: (devices || []).length,
    };
  }
  return rest;
}

async function setUserPassword(user, password) {
  user.passwordHash = await hashPassword(password);
  await db.saveUser(user);
}

async function passwordOk(user, password) {
  const p = String(password || "");
  if (!p || !user?.passwordHash) return false;
  const ok = await verifyPassword(p, user.passwordHash);
  if (!ok) return false;
  if (!isScryptHash(user.passwordHash)) {
    user.passwordHash = await hashPassword(p);
    await db.saveUser(user);
  }
  return true;
}

function modelMarked(anomaly) {
  return anomaly === 0 || anomaly === 1 || anomaly === "0" || anomaly === "1";
}

function scoreNumber(final) {
  const n = Number(final);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function scoreScale(final) {
  const exact = scoreNumber(final);
  if (exact == null) return { exact: null, ticks: null, bar: null };
  const ticks = Math.round(Number(final) * 100);
  return { exact, ticks, bar: Math.min(100, Math.max(0, ticks)) };
}

async function liveModelMarks() {
  const scored = runCustomModel(extractFeatures(await db.loadModelStore())).scored || [];
  const map = new Map();
  for (const row of scored) {
    if (row.label === "Фрод" || row.label === "Норма") map.set(row.id, row);
  }
  return map;
}

function decorateAdminTx(t, marks) {
  const live = marks.get(t.id);
  if (!live) return decorateTx(t);
  return decorateTx({
    ...t,
    mlScore: live.scoreExact,
    mlAnomaly: live.label === "Фрод" ? 1 : 0,
  });
}

function decorateTx(t) {
  const scale = scoreScale(t.mlScore);
  const marked = modelMarked(t.mlAnomaly);
  const anomaly = marked && Number(t.mlAnomaly) === 1 ? 1 : marked ? 0 : null;
  return {
    ...t,
    mlScore: scale.exact,
    mlAnomaly: anomaly,
    riskLabel: anomaly == null ? "" : anomaly ? "Фрод" : "Норма",
    riskScoreExact: scale.exact,
    riskExplain: [],
    riskScore: scale.ticks,
    riskBar: scale.bar,
    riskLevel: anomaly == null ? "" : anomaly ? "fraud" : "ok",
  };
}

function publicTx(t) {
  const row = { ...t };
  delete row.mlFeatures;
  delete row.mlScore;
  delete row.mlAnomaly;
  delete row.riskLevel;
  delete row.riskLabel;
  delete row.riskExplain;
  delete row.riskScore;
  delete row.riskScoreExact;
  delete row.riskBar;
  delete row.freezeReason;
  delete row.heldBy;
  delete row.heldAt;
  delete row.holdQuery;
  delete row.reviewedBy;
  if (row.status === "held") row.status = "pending";
  return row;
}

async function publicNotes(email) {
  const notes = await db.listNotes(email);
  return notes
    .filter((n) => n.kind !== "anomaly")
    .filter((n) => !/мошенн|антифрод|аномал|подозрит/i.test(`${n.title} ${n.body}`));
}

async function snapshot(email) {
  const user = await db.getUser(email);
  const wallet = await db.getWallet(email);
  const txs = (await db.listTxsByEmail(email)).map(publicTx);
  const notes = await publicNotes(email);
  const contacts = await db.listContacts(email);
  const L = await limitsOf(email);
  const usage = await usageOf(email);
  return { user: publicUser(user), wallet: publicWallet(wallet, { limits: L, usage }), txs, notes, contacts };
}

function requestDeviceId(req) {
  const h = String(req.headers["x-device-id"] || "").trim().slice(0, 64);
  if (h) return h;
  const ua = String(req.headers["user-agent"] || "ua");
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");
  return sha256(ua + "|" + ip.split(",")[0]).slice(0, 32);
}

async function issueSession(email, extra = {}) {
  const token = crypto.randomBytes(24).toString("hex");
  await db.insertSession(token, {
    email,
    exp: Date.now() + 14 * 86400000,
    deviceId: extra.deviceId || "",
    newDevice: extra.newDevice ? 1 : 0,
    loginAttempts: Math.max(1, Number(extra.loginAttempts) || 1),
  });
  return token;
}

async function sessionOf(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return db.getSession(token);
}

async function authEmail(req) {
  return (await sessionOf(req))?.email || null;
}

function lockedMessage(user) {
  if (!user?.lockedUntil || user.lockedUntil <= Date.now()) return "";
  const min = Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
  return `Слишком много попыток. Повторите через ${min} мин.`;
}

async function rememberLoginFail(user) {
  if (!user) return;
  user.loginAttempts = Math.max(1, Number(user.loginAttempts) || 1) + 1;
  if (user.loginAttempts >= LOCK_AFTER) user.lockedUntil = Date.now() + LOCK_MS;
  await db.saveUser(user);
}

async function rememberLoginOk(user, deviceId) {
  const attempts = Math.max(1, Number(user.loginAttempts) || 1);
  user.lastLoginAttempts = attempts;
  user.loginAttempts = 1;
  user.lockedUntil = 0;
  user.devices = Array.isArray(user.devices) ? user.devices : [];
  const known = Boolean(deviceId && user.devices.includes(deviceId));
  const newDevice = deviceId && !known ? 1 : 0;
  if (deviceId && !known) user.devices.push(deviceId);
  if (user.devices.length > 24) user.devices = user.devices.slice(-24);
  await db.saveUser(user);
  return { attempts, newDevice };
}

async function scoreOutgoing(email, amount, payee, sess, type = "expense") {
  const user = await db.getUser(email);
  const wallet = await db.getWallet(email);
  const txs = await db.listTxsByEmail(email);
  const sample = buildFraudSample({ users: { [email]: user }, wallets: { [email]: wallet }, txs }, {
    email,
    amount,
    payee,
    loginAttempts: sess?.loginAttempts || user?.lastLoginAttempts || 1,
    newDevice: sess?.newDevice || 0,
    type,
  });
  const scored = (await scoreWithFriendModelAsync([sample]))[0];
  if (!scored || !modelMarked(scored.anomaly)) {
    console.warn("[ml] IsolationForest недоступен, операция без метки модели");
    return { sample, score: null, final_score: null, anomaly: null, engine: "unavailable" };
  }
  const final = scoreNumber(scored.final_score ?? scored.score);
  return {
    sample,
    ...scored,
    final_score: final,
    anomaly: Number(scored.anomaly) === 1 ? 1 : 0,
    engine: scored.engine || "anti_fraud.joblib",
  };
}

function modelBlocks(fraud) {
  return Boolean(fraud && fraud.engine !== "unavailable" && Number(fraud.anomaly) === 1);
}

function clientBlockedMsg() {
  return "Операция отклонена. Попробуйте позже или напишите в поддержку.";
}

function mlPatch(fraud) {
  const marked = fraud && fraud.engine !== "unavailable" && modelMarked(fraud.anomaly);
  return {
    mlFeatures: fraud.sample,
    mlScore: marked ? fraud.final_score : null,
    mlAnomaly: marked ? (Number(fraud.anomaly) === 1 ? 1 : 0) : null,
  };
}

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

function findUserByLogin(login) {
  return db.findUserByLogin(login);
}

function phoneTaken(phone, exceptEmail) {
  return db.phoneTaken(phone, exceptEmail);
}

function findPayee(query, fromEmail) {
  return db.findPayee(query, fromEmail);
}

async function isSelfPayee(fromEmail, query) {
  const me = await db.getUser(fromEmail);
  if (!me) return false;
  const q = String(query || "").trim();
  if (!q) return false;
  const qn = q.toLowerCase();
  if (qn === String(me.email || "").toLowerCase()) return true;
  if (me.walletId && qn === String(me.walletId).toLowerCase()) return true;
  return samePhone(q, me.phone);
}

async function assertNotSelf(fromEmail, query) {
  if (await isSelfPayee(fromEmail, query)) {
    throw new Error("Нельзя перевести деньги самому себе");
  }
}

async function assertNotFrozen(email) {
  const user = await db.getUser(email);
  if (user?.frozen) {
    throw new Error("Счёт временно ограничен. Операции недоступны, обратитесь в поддержку.");
  }
}

async function freezeAccount(email, reason, extra = {}) {
  const user = await db.getUser(email);
  if (!user) return false;
  const why = String(reason || "Подозрение на мошенничество").trim();
  const already = Boolean(user.frozen);
  user.frozen = true;
  user.freezeReason = why;
  user.frozenAt = Date.now();
  user.frozenBy = extra.by || "antifraud";
  if (extra.txId) user.frozenTxId = extra.txId;
  await db.saveUser(user);
  if (!already) await addNote(email, "Счёт временно ограничен", "Операции недоступны. При необходимости напишите в поддержку.", "system", extra.txId ? { txId: extra.txId } : {});
  await audit("user.freeze", { email, reason: why, by: user.frozenBy, txId: extra.txId || "" });
  return !already;
}

async function unfreezeAccount(email) {
  const user = await db.getUser(email);
  if (!user) return false;
  user.frozen = false;
  user.freezeReason = "";
  user.frozenBy = "";
  user.frozenTxId = "";
  await db.saveUser(user);
  await addNote(email, "Счёт снова доступен", "Ограничения сняты.", "system");
  await audit("user.unfreeze", { email });
  return true;
}

async function holdTx(tx, reason, extra = {}) {
  if (!tx || tx.status === "held" || tx.status === "rejected") return;
  tx.status = "held";
  tx.freezeReason = reason;
  tx.heldAt = Date.now();
  tx.heldBy = extra.by || "antifraud";
  await db.saveTx(tx);
  await addNote(tx.email, "Операция в обработке", `${tx.name}: ${Math.abs(tx.amount).toLocaleString("ru-RU")} ₽`, "transfer", { txId: tx.id });
  await audit("tx.hold", { email: tx.email, txId: tx.id, reason, by: tx.heldBy });
}

async function creditPayeeFromHeld(tx) {
  const query = tx.holdQuery || tx.counterparty || tx.name;
  const other = await findPayee(query, tx.email);
  if (!other) return null;
  const abs = Math.abs(tx.amount);
  const sender = await db.getUser(tx.email);
  const inTx = await addTx(other.email, {
    name: `${sender.lastName} ${sender.firstName}`.trim() || "Перевод",
    amount: abs,
    type: "income",
    icon: "person",
    category: "Переводы",
    comment: tx.comment || "После проверки антифрода",
    counterparty: sender.phone || tx.email,
    linkedTxId: tx.id,
  });
  await addNote(other.email, "Перевод получен", `${sender.firstName} отправил ${abs.toLocaleString("ru-RU")} ₽`, "transfer", { txId: inTx.id });
  tx.linkedTxId = inTx.id;
  await db.saveTx(tx);
  return inTx;
}

async function releaseHeldTx(tx, by = "admin") {
  if (!tx || tx.status !== "held") throw new Error("Операция не заморожена");
  if (tx.amount < 0 && !tx.linkedTxId) await creditPayeeFromHeld(tx);
  tx.status = "done";
  tx.freezeReason = "";
  tx.reviewedAt = Date.now();
  tx.reviewedBy = by;
  await db.saveTx(tx);
  await addNote(tx.email, "Операция выполнена", `${tx.name}: ${Math.abs(tx.amount).toLocaleString("ru-RU")} ₽`, "transfer", { txId: tx.id });
  await audit("tx.release", { email: tx.email, txId: tx.id, by });
}

async function rejectHeldTx(tx, by = "admin") {
  if (!tx || tx.status !== "held") throw new Error("Операция не заморожена");
  const abs = Math.abs(tx.amount);
  if (tx.amount < 0) {
    await addTx(tx.email, {
      name: "Возврат заморозки",
      amount: abs,
      type: "income",
      icon: "undo",
      category: "Служебное",
      comment: `Возврат ${tx.id}`,
      counterparty: "Антифрод",
      linkedTxId: tx.id,
    });
  } else {
    await addTx(tx.email, {
      name: "Отмена заморозки",
      amount: -abs,
      type: "expense",
      icon: "block",
      category: "Служебное",
      comment: `Отмена ${tx.id}`,
      counterparty: "Антифрод",
      linkedTxId: tx.id,
    });
  }
  tx.status = "rejected";
  tx.freezeReason = "Отклонено администратором как мошенничество";
  tx.reviewedAt = Date.now();
  tx.reviewedBy = by;
  await db.saveTx(tx);
  await addNote(tx.email, "Операция отменена", `${tx.name}: ${abs.toLocaleString("ru-RU")} ₽ возвращены`, "transfer", { txId: tx.id });
  await audit("tx.reject", { email: tx.email, txId: tx.id, by });
}

function audit(action, detail) {
  return db.insertAudit(uid("a-"), action, detail || {}, Date.now());
}

async function putCode(purpose, email, channel, dest) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const prev = await db.getCode(purpose, email);
  if (prev && Date.now() - (prev.sentAt || 0) < 40000) {
    const wait = Math.ceil((40000 - (Date.now() - prev.sentAt)) / 1000);
    throw new Error(`Подождите ${wait} с перед повторной отправкой`);
  }
  const rec = { code, exp: Date.now() + CODE_TTL, channel, dest, sentAt: Date.now(), purpose };
  await db.saveCode(purpose, email, rec);
  return rec;
}

const otpFails = new Map();
async function takeCode(purpose, email, code) {
  const rec = await db.getCode(purpose, email);
  const got = String(code || "").trim();
  const key = `${purpose}:${email}`;
  if (!rec || rec.exp < Date.now()) return false;
  if ((!PRODUCTION && rec.bypass) || rec.code === got) {
    otpFails.delete(key);
    await db.deleteCode(purpose, email);
    return true;
  }
  const n = (otpFails.get(key) || 0) + 1;
  if (n >= 5) {
    otpFails.delete(key);
    await db.deleteCode(purpose, email);
  } else otpFails.set(key, n);
  return false;
}

function lastCodeFor(email) {
  return db.lastCodeFor(email);
}

function needPayOtp(email, amount) {
  return amount > PAY_OTP_LIMIT && email !== DEMO_EMAIL;
}

async function assertPayCode(email, amount, code) {
  if (!needPayOtp(email, amount)) return true;
  if (!(await takeCode("pay", email, code))) {
    throw new Error("Для платежа свыше 10 000 ₽ нужен актуальный код из СМС или письма");
  }
  return true;
}

function addNote(email, title, body, kind = "transfer", extra = {}) {
  return db.insertNote({
    id: uid("n-"),
    email,
    title,
    body,
    kind,
    createdAt: Date.now(),
    read: false,
    ...extra,
  });
}

async function addTx(email, partial) {
  const wallet = await db.lockWallet(email);
  const nextBal = Math.round((Number(wallet.balance) + Number(partial.amount)) * 100) / 100;
  if (partial.amount < 0 && nextBal < -0.001) throw new Error("Недостаточно средств");
  wallet.balance = nextBal;
  await db.saveWallet(wallet);
  const row = {
    id: uid("t-"),
    email,
    createdAt: Date.now(),
    status: "done",
    balanceAfter: nextBal,
    comment: "",
    ...partial,
  };
  await db.insertTx(row);
  return row;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
  ...(PRODUCTION ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
};

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(data);
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function insideDist(file) {
  const root = path.resolve(DIST);
  const rel = path.relative(root, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function serveStatic(req, res, urlPath) {
  if (!fs.existsSync(DIST)) return false;
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.resolve(DIST, rel.replace(/^[/\\]+/, ""));
  if (!insideDist(file)) return false;
  const headers = { ...SECURITY_HEADERS, "Cache-Control": rel === "/index.html" ? "no-cache" : "public, max-age=3600" };
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const buf = fs.readFileSync(file);
    res.writeHead(200, { ...headers, "Content-Type": mime(file), "Content-Length": buf.length });
    res.end(buf);
    return true;
  }
  const index = path.resolve(DIST, "index.html");
  if (fs.existsSync(index) && !path.extname(rel)) {
    const buf = fs.readFileSync(index);
    res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "Content-Length": buf.length });
    res.end(buf);
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, SECURITY_HEADERS);
    res.end();
    return;
  }

  try {
    await locked(async () => {
      if (req.method === "GET" && p === "/api/health") {
        send(res, 200, { ok: true, payOtpFrom: PAY_OTP_LIMIT });
        return;
      }

      if (req.method === "POST" && p.startsWith("/api/auth") && tooMany("auth:" + clientIp(req), 30, 10 * 60 * 1000)) {
        send(res, 429, { error: "Слишком много запросов. Подождите несколько минут." });
        return;
      }

      if (req.method === "POST" && (p === "/api/auth/request-code" || p === "/api/otp/send")) {
        const b = await readBody(req);
        const purpose = ["login", "register", "pay"].includes(b.purpose) ? b.purpose : "login";
        const channel = b.channel === "email" || b.channel === "sms" ? b.channel : "";
        const authed = await authEmail(req);

        if (purpose === "pay") {
          if (!authed) return send(res, 401, { error: "Нужна авторизация" });
          try { await assertNotFrozen(authed); } catch (e) { return send(res, 403, { error: e.message }); }
          const amount = Number(b.amount);
          if (!needPayOtp(authed, amount)) {
            return send(res, 200, { ok: true, via: "skip", masked: "" });
          }
          const user = await db.getUser(authed);
          const ch = channel || user.otpChannel || "sms";
          try {
            const rec = await putCode("pay", authed, ch, ch === "email" ? user.email : user.phone);
            if (!PRODUCTION) console.log(`[код pay] ${authed} → ${rec.code} (${ch})`);
            res.otpJob = { channel: ch, phone: user.phone, email: user.email, code: rec.code, purpose: "pay", owner: authed };
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
          return;
        }

        if (purpose === "register") {
          const email = String(b.email || "").trim().toLowerCase();
          const phone = String(b.phone || "").trim();
          if (!EMAIL_OK.test(email)) return send(res, 400, { error: "Укажите настоящую почту" });
          if (!isRuMobile(phone)) return send(res, 400, { error: "Укажите российский мобильный (+7, 8 или 9…)" });
          if (await db.getUser(email)) return send(res, 400, { error: "Такой email уже зарегистрирован" });
          if (await phoneTaken(phone, email)) return send(res, 400, { error: "Этот номер телефона уже занят" });
          const ch = channel || "sms";
          try {
            const rec = await putCode("register", email, ch, ch === "email" ? email : phone);
            if (!PRODUCTION) console.log(`[код register] ${email} / ${phone} → ${rec.code} (${ch})`);
            res.otpJob = { channel: ch, phone: formatRuPhone(phone), email, code: rec.code, purpose: "register", owner: email };
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
          return;
        }

        const user = await findUserByLogin(b.login || b.email);
        if (!user) return send(res, 400, { error: "Пользователь с такой почтой или телефоном не найден" });
        const wait = lockedMessage(user);
        if (wait) return send(res, 429, { error: wait });
        if (purpose === "login" && !(await passwordOk(user, b.password))) {
          await rememberLoginFail(user);
          return send(res, 400, { error: "Неверный пароль" });
        }
        if (user.email === DEMO_EMAIL) return send(res, 200, { ok: true, via: "demo", masked: "демо" });
        const ch = channel || user.otpChannel || "sms";
        try {
          const rec = await putCode("login", user.email, ch, ch === "email" ? user.email : user.phone);
          if (!PRODUCTION) console.log(`[код login] ${user.email} / ${user.phone} → ${rec.code} (${ch})`);
          res.otpJob = { channel: ch, phone: user.phone, email: user.email, code: rec.code, purpose: "login", owner: user.email };
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
        return;
      }

      if (req.method === "POST" && p === "/api/auth/register") {
        const b = await readBody(req);
        const email = String(b.email || "").trim().toLowerCase();
        const password = String(b.password || "");
        const phone = String(b.phone || "").trim();
        if (!EMAIL_OK.test(email)) return send(res, 400, { error: "Укажите настоящую почту (например ivan@mail.ru)" });
        if (email.endsWith(".demo") && email !== DEMO_EMAIL) return send(res, 400, { error: "Нужна реальная почта, не демо-домен" });
        if (!isRuMobile(phone)) return send(res, 400, { error: "Укажите российский мобильный (+7, 8 или 9…)" });
        if (!email || password.length < 8) return send(res, 400, { error: "Укажите email и пароль от 8 символов" });
        if (await db.getUser(email)) return send(res, 400, { error: "Такой email уже зарегистрирован" });
        if (await phoneTaken(phone, email)) return send(res, 400, { error: "Этот номер телефона уже занят" });
        if (!(await takeCode("register", email, b.code))) {
          return send(res, 400, { error: "Подтвердите регистрацию кодом из СМС или письма" });
        }
        const deviceId = requestDeviceId(req);
        await db.insertUser({
          email,
          passwordHash: await hashPassword(password),
          lastName: String(b.lastName || "").trim(),
          firstName: String(b.firstName || "").trim(),
          middleName: String(b.middleName || "").trim(),
          phone: formatRuPhone(phone),
          passport: String(b.passport || "").trim(),
          walletId: "WLT-" + crypto.randomBytes(4).toString("hex").toUpperCase() + "-ЦР",
          createdAt: Date.now(),
          otpChannel: b.channel === "email" ? "email" : "sms",
          loginAttempts: 1,
          lastLoginAttempts: 1,
          devices: deviceId ? [deviceId] : [],
        });
        await db.insertWallet({
          email,
          balance: 0,
          savings: [],
          biometric: false,
          pin: "1234",
          hideBalance: false,
          limits: defaultLimits(),
        });
        await addNote(email, "Кошелёк создан", "Баланс 0 ₽. Пополните кошелёк, чтобы отправлять переводы.", "system");
        const token = await issueSession(email, { deviceId, newDevice: 1, loginAttempts: 1 });
        send(res, 200, { token, ...(await snapshot(email)) });
        return;
      }

      if (req.method === "POST" && p === "/api/auth/login") {
        const b = await readBody(req);
        const user = await findUserByLogin(b.email || b.login);
        if (!user) return send(res, 400, { error: "Пользователь не найден" });
        const wait = lockedMessage(user);
        if (wait) return send(res, 429, { error: wait });
        if (!(await passwordOk(user, b.password))) {
          await rememberLoginFail(user);
          return send(res, 400, { error: "Неверный пароль" });
        }
        if (user.email !== DEMO_EMAIL) {
          if (!(await takeCode("login", user.email, b.code))) {
            await rememberLoginFail(user);
            return send(res, 400, { error: "Неверный или просроченный код из СМС или письма" });
          }
        }
        const deviceId = requestDeviceId(req);
        const ok = await rememberLoginOk(user, deviceId);
        const token = await issueSession(user.email, { deviceId, newDevice: ok.newDevice, loginAttempts: ok.attempts });
        send(res, 200, { token, ...(await snapshot(user.email)) });
        return;
      }

      if (req.method === "POST" && p === "/api/auth/forgot") {
        const b = await readBody(req);
        const user = await findUserByLogin(b.login || b.email || b.phone);
        if (!user) return send(res, 400, { error: "Пользователь с такой почтой или телефоном не найден" });
        const wait = lockedMessage(user);
        if (wait) return send(res, 429, { error: wait });
        if (user.frozen) return send(res, 403, { error: "Счёт заблокирован. Обратитесь в поддержку." });
        if (user.email === DEMO_EMAIL) return send(res, 200, { ok: true, via: "demo", masked: "демо" });
        const ch = b.channel === "sms" ? "sms" : "email";
        try {
          const rec = await putCode("reset", user.email, ch, ch === "sms" ? user.phone : user.email);
          if (!PRODUCTION) console.log(`[код reset] ${user.email} → ${rec.code} (${ch})`);
          res.otpJob = { channel: ch, phone: user.phone, email: user.email, code: rec.code, purpose: "reset", owner: user.email };
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
        return;
      }

      if (req.method === "POST" && p === "/api/auth/reset") {
        const b = await readBody(req);
        const user = await findUserByLogin(b.login || b.email);
        const password = String(b.password || "");
        if (!user) return send(res, 400, { error: "Пользователь не найден" });
        const wait = lockedMessage(user);
        if (wait) return send(res, 429, { error: wait });
        if (password.length < 8) return send(res, 400, { error: "Новый пароль от 8 символов" });
        if (user.email !== DEMO_EMAIL && !(await takeCode("reset", user.email, b.code))) {
          return send(res, 400, { error: "Неверный или просроченный код из письма" });
        }
        await setUserPassword(user, password);
        const deviceId = requestDeviceId(req);
        const ok = await rememberLoginOk(user, deviceId);
        const token = await issueSession(user.email, { deviceId, newDevice: ok.newDevice, loginAttempts: ok.attempts });
        send(res, 200, { token, ...(await snapshot(user.email)) });
        return;
      }

      const adminKey = req.headers["x-admin-key"];
      if (p.startsWith("/api/admin")) {
        const adminBucket = "adminfail:" + clientIp(req);
        if (rateOver(adminBucket, 12)) return send(res, 429, { error: "Слишком много запросов. Подождите несколько минут." });
        if (!adminKeyOk(adminKey)) {
          tooMany(adminBucket, 12, 15 * 60 * 1000);
          return send(res, 401, { error: "Неверный ключ администратора" });
        }
        if (req.method === "GET" && p === "/api/admin/notify") {
          send(res, 200, publicNotify());
          return;
        }
        if (req.method === "PATCH" && p === "/api/admin/notify") {
          const b = await readBody(req);
          send(res, 200, await saveNotify(b));
          return;
        }
        if (req.method === "POST" && p === "/api/admin/notify/test") {
          const b = await readBody(req);
          const channel = b.channel === "sms" ? "sms" : "email";
          const cfg = loadNotify();
          try {
            const out = await deliver({
              channel,
              phone: b.phone || "",
              email: b.email || cfg.smtpUser,
              code: "000000",
              purpose: "login",
            });
            send(res, 200, { ok: true, ...out });
          } catch (e) {
            send(res, 400, { error: e.message });
          }
          return;
        }
        if (req.method === "GET" && p === "/api/admin/overview") {
          send(res, 200, {
            ...(await db.overview()),
            notify: publicNotify(),
            audit: await db.recentAudit(30),
          });
          return;
        }
        if (req.method === "GET" && p === "/api/admin/txs") {
          const q = String(url.searchParams.get("q") || "").toLowerCase();
          const type = String(url.searchParams.get("type") || "");
          const listed = await db.adminTxs({ q, type });
          const marks = await liveModelMarks();
          send(res, 200, { txs: listed.txs.map((t) => decorateAdminTx(t, marks)), total: listed.total });
          return;
        }
        const txAct = p.match(/^\/api\/admin\/txs\/([^/]+)\/(hold|release|reject)$/);
        if (txAct && req.method === "POST") {
          const txId = decodeURIComponent(txAct[1]);
          const op = txAct[2];
          const tx = await db.getTx(txId);
          if (!tx) return send(res, 404, { error: "Нет операции" });
          const b = await readBody(req).catch(() => ({}));
          try {
            if (op === "hold") {
              const reason = String(b.reason || "Заморозка администратором: подозрение на мошенничество");
              if (tx.status !== "held") await holdTx(tx, reason, { by: "admin" });
              await freezeAccount(tx.email, reason, { txId: tx.id, by: "admin" });
            }
            if (op === "release") await releaseHeldTx(tx, "admin");
            if (op === "reject") await rejectHeldTx(tx, "admin");
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
          send(res, 200, { ok: true, tx: await db.getTx(txId) });
          return;
        }
        if (req.method === "GET" && p === "/api/admin/ml") {
          send(res, 200, buildReport(await db.loadModelStore(), { horizonDays: Number(url.searchParams.get("horizon") || 7) }));
          return;
        }
        if (req.method === "GET" && p === "/api/admin/ml/features") {
          send(res, 200, extractFeatures(await db.loadModelStore()));
          return;
        }
        if (req.method === "GET" && p === "/api/admin/export") {
          const kind = String(url.searchParams.get("kind") || "users");
          if (kind === "txs") send(res, 200, { rows: await db.exportTxs() });
          else if (kind === "audit") send(res, 200, { rows: await db.exportAudit() });
          else {
            const rows = await db.listUsersAdmin();
            send(res, 200, { rows: rows.map((u) => ({ ...publicUser(u, { admin: true }), balance: u.balance || 0 })) });
          }
          return;
        }
        if (req.method === "GET" && p === "/api/admin/users") {
          const rows = await db.listUsersAdmin();
          const users = [];
          for (const u of rows) {
            users.push({
              ...publicUser(u, { admin: true }),
              balance: u.balance || 0,
              txCount: u.txCount,
              codePending: Boolean(await lastCodeFor(u.email)),
              sessions: await db.countSessions(u.email),
            });
          }
          send(res, 200, { users });
          return;
        }
        const freeze = p.match(/^\/api\/admin\/users\/(.+)\/(freeze|unfreeze|kick|adjust|password)$/);
        if (freeze && req.method === "POST") {
          const email = decodeURIComponent(freeze[1]).toLowerCase();
          const op = freeze[2];
          const user = await db.getUser(email);
          if (!user) return send(res, 404, { error: "Нет пользователя" });
          const b = await readBody(req).catch(() => ({}));
          if (op === "freeze") {
            await freezeAccount(email, String(b.reason || "Блокировка администратором"), { by: "admin" });
          }
          if (op === "unfreeze") {
            await unfreezeAccount(email);
          }
          if (op === "kick") {
            await db.deleteUserSessions(email);
            await audit("user.kick", { email });
          }
          if (op === "adjust") {
            const amount = Number(b.amount);
            if (!Number.isFinite(amount) || !amount) return send(res, 400, { error: "Укажите сумму корректировки" });
            await addTx(email, {
              name: amount > 0 ? "Корректировка +" : "Корректировка −",
              amount,
              type: amount > 0 ? "income" : "expense",
              icon: "admin_panel_settings",
              category: "Служебное",
              comment: String(b.comment || "Администратор"),
              counterparty: "Админ",
            });
            await audit("user.adjust", { email, amount, comment: b.comment || "" });
          }
          if (op === "password") {
            const password = String(b.password || "");
            if (password.length < 8) return send(res, 400, { error: "Пароль от 8 символов" });
            await setUserPassword(user, password);
            await audit("user.password", { email });
          }
          send(res, 200, { ok: true, user: publicUser(await db.getUser(email), { admin: true }), wallet: publicWallet(await db.getWallet(email)) });
          return;
        }
        const one = p.match(/^\/api\/admin\/users\/([^/]+)$/);
        if (one) {
          const email = decodeURIComponent(one[1]).toLowerCase();
          const user = await db.getUser(email);
          if (!user) return send(res, 404, { error: "Нет пользователя" });
          if (req.method === "GET") {
            const marks = await liveModelMarks();
            const wallet = await db.getWallet(email);
            send(res, 200, {
              user: { ...publicUser(user, { admin: true }), codePending: Boolean(await lastCodeFor(email)), balance: wallet?.balance || 0, txCount: await db.countTxs(email) },
              wallet: publicWallet(wallet),
              txs: (await db.listTxsByEmail(email)).map((t) => decorateAdminTx(t, marks)),
              contacts: await db.listContacts(email),
              notes: await db.listNotes(email),
            });
            return;
          }
          if (req.method === "DELETE") {
            await db.deleteUser(email);
            send(res, 200, { ok: true });
            return;
          }
          if (req.method === "PATCH") {
            const b = await readBody(req);
            let nextEmail = email;
            if (b.email) {
              nextEmail = String(b.email).trim().toLowerCase();
              if (!EMAIL_OK.test(nextEmail)) return send(res, 400, { error: "Некорректная почта" });
              if (nextEmail !== email && await db.getUser(nextEmail)) return send(res, 400, { error: "Почта занята" });
            }
            if (b.phone) {
              if (!isRuMobile(b.phone)) return send(res, 400, { error: "Некорректный телефон" });
              if (await phoneTaken(b.phone, email)) return send(res, 400, { error: "Телефон занят" });
              user.phone = formatRuPhone(b.phone);
            }
            const wallet = await db.getWallet(email);
            if (typeof b.balance === "number" && Number.isFinite(b.balance)) {
              wallet.balance = Math.max(0, b.balance);
              await db.saveWallet(wallet);
            }
            if (typeof b.password === "string" && b.password.trim()) {
              if (b.password.trim().length < 8) return send(res, 400, { error: "Пароль от 8 символов" });
              user.passwordHash = await hashPassword(b.password.trim());
            }
            await db.saveUser(user);
            if (nextEmail !== email) await db.renameUser(email, nextEmail);
            await audit("user.patch", { email, nextEmail, balance: b.balance, phone: b.phone });
            send(res, 200, { ok: true, email: nextEmail });
            return;
          }
        }
        send(res, 404, { error: "Нет такого метода" });
        return;
      }

      if (req.method === "POST" && p === "/api/auth/logout") {
        const h = req.headers.authorization || "";
        const token = h.startsWith("Bearer ") ? h.slice(7) : "";
        await db.deleteSession(token);
        send(res, 200, { ok: true });
        return;
      }

      const sess = await sessionOf(req);
      const email = sess?.email || null;
      if (p.startsWith("/api/") && !email) {
        send(res, 401, { error: "Нужна авторизация" });
        return;
      }

      if (req.method === "GET" && (p === "/api/me" || p === "/api/state")) {
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/transfer") {
        const b = await readBody(req);
        const amount = Number(b.amount);
        const payee = String(b.payee || "").trim();
        const comment = String(b.comment || "").trim();
        const wallet = await db.getWallet(email);
        const me = await db.getUser(email);
        if (!(amount > 0)) return send(res, 400, { error: "Укажите сумму" });
        if (!payee) return send(res, 400, { error: "Укажите получателя" });
        try { await assertNotFrozen(email); await assertNotSelf(email, payee); await assertLimits(email, amount); } catch (e) { return send(res, 400, { error: e.message }); }
        if (amount > wallet.balance) return send(res, 400, { error: "Недостаточно средств" });
        try { await assertPayCode(email, amount, b.code); } catch (e) { return send(res, 400, { error: e.message }); }
        const fraud = await scoreOutgoing(email, amount, payee, sess, "expense");
        if (modelBlocks(fraud)) {
          console.warn("[ml] transfer blocked", { email, anomaly: fraud.anomaly, final_score: fraud.final_score });
          return send(res, 400, { error: clientBlockedMsg() });
        }
        const outTx = await addTx(email, {
          name: isRuMobile(payee) ? formatRuPhone(payee) : payee,
          amount: -amount,
          type: "expense",
          icon: "person",
          category: "Переводы",
          comment,
          counterparty: payee,
          holdQuery: payee,
          ...mlPatch(fraud),
        });
        await addNote(email, "Списание", `${payee}: ${amount.toLocaleString("ru-RU")} ₽`, "transfer", { txId: outTx.id });
        const other = await findPayee(payee, email);
        if (other) {
          const inTx = await addTx(other.email, {
            name: `${me.lastName} ${me.firstName}`.trim(),
            amount,
            type: "income",
            icon: "person",
            category: "Переводы",
            comment,
            counterparty: me.phone || email,
            linkedTxId: outTx.id,
          });
          outTx.linkedTxId = inTx.id;
          await db.saveTx(outTx);
          await addNote(other.email, "Перевод получен", `${me.firstName} отправил ${amount.toLocaleString("ru-RU")} ₽`, "transfer", { txId: inTx.id });
        }
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/topup") {
        const b = await readBody(req);
        const amount = Number(b.amount);
        try { await assertNotFrozen(email); } catch (e) { return send(res, 400, { error: e.message }); }
        if (!(amount > 0)) return send(res, 400, { error: "Укажите сумму" });
        const fraud = await scoreOutgoing(email, amount, "Альфа-Банк", sess, "income");
        if (modelBlocks(fraud)) {
          console.warn("[ml] topup blocked", { email, anomaly: fraud.anomaly, final_score: fraud.final_score });
          return send(res, 400, { error: clientBlockedMsg() });
        }
        const inTx = await addTx(email, {
          name: "Пополнение",
          amount,
          type: "income",
          icon: "add_circle",
          category: "Доходы",
          comment: "С карты",
          counterparty: "Альфа-Банк",
          ...mlPatch(fraud),
        });
        await addNote(email, "Поступление", `Пополнение: ${amount.toLocaleString("ru-RU")} ₽`, "transfer", { txId: inTx.id });
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/qr") {
        const b = await readBody(req);
        const amount = Number(b.amount);
        const wallet = await db.getWallet(email);
        const me = await db.getUser(email);
        const merchant = String(b.merchant || "QR-касса").trim().slice(0, 80) || "QR-касса";
        const payee = String(b.payee || "").trim();
        if (!(amount > 0)) return send(res, 400, { error: "Укажите сумму" });
        try { await assertNotFrozen(email); await assertLimits(email, amount); } catch (e) { return send(res, 400, { error: e.message }); }
        if (payee && await isSelfPayee(email, payee)) return send(res, 400, { error: "Нельзя оплатить свой QR" });
        if (amount > wallet.balance) return send(res, 400, { error: "Недостаточно средств" });
        try { await assertPayCode(email, amount, b.code); } catch (e) { return send(res, 400, { error: e.message }); }
        const other = payee ? await findPayee(payee, email) : null;
        const fraud = await scoreOutgoing(email, amount, other ? (other.phone || payee) : "QR-касса", sess, "expense");
        if (modelBlocks(fraud)) {
          console.warn("[ml] qr blocked", { email, anomaly: fraud.anomaly, final_score: fraud.final_score });
          return send(res, 400, { error: clientBlockedMsg() });
        }
        const title = other ? `${other.lastName} ${other.firstName}`.trim() : merchant;
        const qrTx = await addTx(email, {
          name: title,
          amount: -amount,
          type: "expense",
          icon: "qr_code",
          category: other ? "Переводы" : "Прочее",
          comment: "Оплата QR",
          counterparty: other ? (other.phone || other.walletId) : merchant,
          ...mlPatch(fraud),
        });
        await addNote(email, "Списание", `QR · ${title}: ${amount.toLocaleString("ru-RU")} ₽`, "transfer", { txId: qrTx.id });
        if (other) {
          const inTx = await addTx(other.email, {
            name: `${me.lastName} ${me.firstName}`.trim(),
            amount,
            type: "income",
            icon: "qr_code",
            category: "Переводы",
            comment: "Оплата QR",
            counterparty: me.phone || email,
            linkedTxId: qrTx.id,
          });
          qrTx.linkedTxId = inTx.id;
          await db.saveTx(qrTx);
          await addNote(other.email, "Перевод получен", `${me.firstName} оплатил ${amount.toLocaleString("ru-RU")} ₽ по QR`, "transfer", { txId: inTx.id });
        }
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/bulk") {
        const b = await readBody(req);
        const rows = Array.isArray(b.rows) ? b.rows : [];
        const bulkTotal = rows.reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
        try { await assertNotFrozen(email); await assertLimits(email, bulkTotal); await assertPayCode(email, bulkTotal, b.code); } catch (e) { return send(res, 400, { error: e.message }); }
        let ok = 0;
        let fail = 0;
        const me = await db.getUser(email);
        for (const row of rows) {
          const amount = Number(row.amount);
          const name = String(row.name || "").trim() || "Получатель";
          const phone = String(row.phone || "").trim();
          const walletNow = await db.getWallet(email);
          if (await isSelfPayee(email, phone || name) || (phone && !isRuMobile(phone)) || !(amount > 0) || amount > walletNow.balance) {
            fail += 1;
            continue;
          }
          const fraud = await scoreOutgoing(email, amount, phone || name, sess, "expense");
          if (modelBlocks(fraud)) {
            fail += 1;
            continue;
          }
          const bulkTx = await addTx(email, {
            name: `Массовый: ${name}`,
            amount: -amount,
            type: "expense",
            icon: "upload_file",
            category: "Переводы",
            comment: "Массовый платёж",
            counterparty: phone || name,
            ...mlPatch(fraud),
          });
          const other = await findPayee(phone || name, email);
          if (other) {
            const inTx = await addTx(other.email, {
              name: `Массовый от ${me.firstName}`,
              amount,
              type: "income",
              icon: "upload_file",
              category: "Переводы",
              comment: "Массовый платёж",
              counterparty: me.phone || email,
              linkedTxId: bulkTx.id,
            });
            bulkTx.linkedTxId = inTx.id;
            await db.saveTx(bulkTx);
          }
          ok += 1;
        }
        await addNote(email, "Массовый платёж", `Успешно: ${ok}, ошибок: ${fail}`, "system");
        send(res, 200, { ok, fail, ...(await snapshot(email)) });
        return;
      }

      if (req.method === "POST" && p === "/api/contacts") {
        const b = await readBody(req);
        const name = String(b.name || "").trim();
        const phone = String(b.phone || "").trim();
        if (!name || !phone) return send(res, 400, { error: "Укажите имя и телефон" });
        if (!isRuMobile(phone)) return send(res, 400, { error: "Укажите российский мобильный (+7, 8 или 9…)" });
        const colors = ["#00D2D3", "#228D57", "#48FFD5", "#FFB4AB"];
        await db.insertContact({
          id: uid("c-"),
          email,
          name,
          phone: formatRuPhone(phone),
          wallet: "WLT-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-ЦР",
          initials: name.charAt(0).toUpperCase(),
          color: colors[Math.floor(Math.random() * colors.length)],
          favorite: false,
        });
        send(res, 200, await snapshot(email));
        return;
      }

      const contactMatch = p.match(/^\/api\/contacts\/([^/]+)$/);
      if (contactMatch) {
        const id = decodeURIComponent(contactMatch[1]);
        const contact = await db.getContact(email, id);
        if (!contact) return send(res, 404, { error: "Контакт не найден" });
        if (req.method === "DELETE") await db.deleteContact(email, id);
        if (req.method === "PATCH") {
          const b = await readBody(req);
          if (typeof b.favorite === "boolean") await db.setContactFavorite(email, id, b.favorite);
        }
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/notes/read-all") {
        await db.markNotesRead(email);
        send(res, 200, await snapshot(email));
        return;
      }

      const noteMatch = p.match(/^\/api\/notes\/([^/]+)\/read$/);
      if (req.method === "POST" && noteMatch) {
        const id = decodeURIComponent(noteMatch[1]);
        await db.markNoteRead(email, id);
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "PATCH" && p === "/api/limits") {
        const b = await readBody(req);
        const w = await db.getWallet(email);
        const cur = await limitsOf(email);
        const num = (v, fallback) => {
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : fallback;
        };
        w.limits = {
          day: num(b.day, cur.day),
          month: num(b.month, cur.month),
          op: num(b.op, cur.op),
          abroad: num(b.abroad, cur.abroad),
          alertDay: Math.min(100, Math.max(1, num(b.alertDay, cur.alertDay))),
          alertMonth: Math.min(100, Math.max(1, num(b.alertMonth, cur.alertMonth))),
          alertOp: Math.min(100, Math.max(1, num(b.alertOp, cur.alertOp))),
          alertAbroad: Math.min(100, Math.max(1, num(b.alertAbroad, cur.alertAbroad))),
        };
        await db.saveWallet(w);
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "PATCH" && p === "/api/security") {
        const b = await readBody(req);
        const w = await db.getWallet(email);
        if (typeof b.biometric === "boolean") w.biometric = b.biometric;
        if (typeof b.hideBalance === "boolean") w.hideBalance = b.hideBalance;
        if (typeof b.pin === "string" && b.pin) w.pin = await hashPassword(b.pin);
        await db.saveWallet(w);
        if (b.otpChannel === "email" || b.otpChannel === "sms") {
          const user = await db.getUser(email);
          user.otpChannel = b.otpChannel;
          await db.saveUser(user);
        }
        send(res, 200, await snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/support") {
        const b = await readBody(req);
        const text = String(b.text || "").trim();
        if (!text) return send(res, 400, { error: "Введите текст" });
        const note = await addNote(email, "Обращение в поддержку", text, "system");
        await db.markNoteRead(email, note.id);
        send(res, 200, await snapshot(email));
        return;
      }

      if (p.startsWith("/api/")) {
        send(res, 404, { error: "Нет такого метода" });
        return;
      }
    });

    if (res.otpJob && !res.writableEnded) {
      try {
        const del = await deliver(res.otpJob);
        send(res, 200, { ok: true, via: del.via, masked: del.masked, ttl: 600, fallback: Boolean(del.fallback) });
      } catch (e) {
        const job = res.otpJob;
        const canSkip = !PRODUCTION && job && ["login", "register"].includes(job.purpose) && job.owner;
        if (canSkip) {
          const rec = await db.getCode(job.purpose, job.owner);
          if (rec) {
            rec.bypass = true;
            await db.saveCode(job.purpose, job.owner, rec);
          }
          send(res, 200, {
            ok: true,
            via: "skip",
            masked: "",
            fallback: true,
            notice: e.message || "Код не удалось отправить, продолжаем по паролю.",
          });
        } else {
          if (job?.purpose && job?.owner) {
            await db.deleteCode(job.purpose, job.owner);
          }
          send(res, 400, { error: e.message || "Не удалось отправить код" });
        }
      }
      return;
    }
    if (res.writableEnded) return;
    if (serveStatic(req, res, p)) return;
    send(res, 200, PRODUCTION
      ? { name: "Alfa Кошелёк ЦР", api: "/api/health" }
      : {
        name: "Alfa Кошелёк ЦР",
        api: "/api/health",
        web: "http://localhost:8443/",
        lan: lanAddresses().map((ip) => `http://${ip}:8443/`),
      });
  } catch (err) {
    if (!res.writableEnded) send(res, 500, { error: publicError(err) });
  }
});

await db.initDb();
await hydrateNotify();

server.listen(PORT, HOST, () => {
  const lan = lanAddresses();
  console.log(`Alfa CR API  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`LAN          http://${ip}:${PORT}`);
  console.log(`Web UI       http://localhost:8443`);
  for (const ip of lan) console.log(`Web LAN      http://${ip}:8443`);
  if (!PRODUCTION) {
    console.log(`Демо         ${DEMO_EMAIL} / ${DEMO_PASS}`);
    console.log(`Админ        http://localhost:8443/admin  ключ: ${ADMIN_KEY || "AlfaDev-2026"}`);
  }
  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="api_base" translatable="false">http://${lan[0] || "10.0.2.2"}:${PORT}</string>\n</resources>\n`;
    const dir = path.join(__dirname, "..", "android", "app", "src", "main", "res", "values");
    if (fs.existsSync(dir)) fs.writeFileSync(path.join(dir, "api_url.xml"), xml);
  } catch {
    /* android folder optional */
  }
});
