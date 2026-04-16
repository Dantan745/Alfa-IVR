import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { deliver, loadNotify, persistNotify, publicNotify, saveNotify } from "./notify.mjs";
import { buildReport, extractFeatures, scoreWithFriendModel } from "./ml/index.mjs";
import { buildFraudSample } from "./ml/features.mjs";
import { formatRuPhone, isRuMobile, ruMobileDigits, samePhone } from "./phone.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");
persistNotify();
const DIST = path.join(__dirname, "..", "web", "dist");
const DEMO_EMAIL = "ivan@alfa.demo";
const DEMO_PASS = "Demo1234";
const ADMIN_KEY = process.env.ADMIN_KEY || "AlfaDev-2026";
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

function emptyDb() {
  return { users: {}, wallets: {}, txs: [], notes: [], contacts: [], sessions: {}, codes: {}, audit: [] };
}

function seedDemo(db) {
  if (db.users[DEMO_EMAIL]) return;
  db.users[DEMO_EMAIL] = {
    email: DEMO_EMAIL,
    passwordHash: sha256(DEMO_PASS),
    passwordPlain: DEMO_PASS,
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
    phone: "+7 (900) 123-45-67",
    passport: "4510 123456",
    walletId: "WLT-00123456-ЦР",
    createdAt: Date.now() - 86400000 * 40,
  };
  db.wallets[DEMO_EMAIL] = {
    email: DEMO_EMAIL,
    balance: 5000,
    savings: [
      { id: "s1", name: "Копилка 1", amount: 200 },
      { id: "s2", name: "Копилка 2", amount: 100 },
    ],
    biometric: false,
    pin: "1234",
    hideBalance: false,
    limits: defaultLimits(),
  };
  const seedTx = [
    { id: "t1", name: "Кофейня «Прим»", amount: -320, type: "expense", icon: "local_cafe", category: "Кафе", createdAt: nowOffset(0, 9, 41), comment: "Капучино", counterparty: "ООО Прим" },
    { id: "t2", name: "Петров А.С.", amount: 5000, type: "income", icon: "person", category: "Переводы", createdAt: nowOffset(1, 18, 22), comment: "Возврат", counterparty: "+7 (900) 123-45-67" },
    { id: "t3", name: "Пятёрочка", amount: -1240, type: "expense", icon: "shopping_cart", category: "Продукты", createdAt: nowOffset(1, 14, 5), comment: "", counterparty: "X5 Group" },
    { id: "t4", name: "Зарплата", amount: 65000, type: "income", icon: "work", category: "Доходы", createdAt: nowOffset(3, 9, 0), comment: "Аванс", counterparty: "ООО Альфа" },
    { id: "t5", name: "Яндекс.Такси", amount: -480, type: "expense", icon: "directions_car", category: "Транспорт", createdAt: nowOffset(4, 22, 30), comment: "", counterparty: "Яндекс Go" },
    { id: "t6", name: "Аптека 36,6", amount: -890, type: "expense", icon: "local_pharmacy", category: "Здоровье", createdAt: nowOffset(5, 16, 10), comment: "", counterparty: "36,6" },
    { id: "t7", name: "Смирнова О.В.", amount: 2500, type: "income", icon: "person", category: "Переводы", createdAt: nowOffset(6, 11, 0), comment: "", counterparty: "+7 (915) 234-56-78" },
    { id: "t8", name: "Связной", amount: -3200, type: "expense", icon: "phone_android", category: "Электроника", createdAt: nowOffset(7, 15, 30), comment: "", counterparty: "Связной" },
    { id: "t9", name: "Оплата QR", amount: -150, type: "expense", icon: "qr_code", category: "Прочее", createdAt: nowOffset(8, 12, 0), comment: "", counterparty: "QR-касса" },
    { id: "t10", name: "Возврат", amount: 750, type: "income", icon: "undo", category: "Переводы", createdAt: nowOffset(9, 10, 0), comment: "", counterparty: "Маркет" },
  ];
  let running = 5000;
  for (const row of [...seedTx].sort((a, b) => b.createdAt - a.createdAt)) {
    db.txs.push({ ...row, email: DEMO_EMAIL, status: "done", balanceAfter: Math.max(0, running) });
    running -= row.amount;
  }
  db.notes.push(
    { id: "n1", email: DEMO_EMAIL, title: "Обнаружена аномалия", body: "Необычная транзакция с незнакомого устройства. Если это были не вы — заблокируйте вход.", kind: "anomaly", createdAt: nowOffset(0, 2, 14), read: false },
    { id: "n2", email: DEMO_EMAIL, title: "Перевод получен", body: "Петров А.С. отправил вам 5 000 ₽", kind: "transfer", createdAt: nowOffset(1, 18, 22), read: false },
    { id: "n3", email: DEMO_EMAIL, title: "Вход в кошелёк", body: "Успешная авторизация с этого устройства", kind: "security", createdAt: nowOffset(0, 8, 0), read: true },
  );
}

function loadDb() {
  let db = emptyDb();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) db = { ...emptyDb(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch {
    db = emptyDb();
  }
  seedDemo(db);
  if (db.users[DEMO_EMAIL] && !db.users[DEMO_EMAIL].passwordPlain) {
    db.users[DEMO_EMAIL].passwordPlain = DEMO_PASS;
    db.users[DEMO_EMAIL].passwordHash = sha256(DEMO_PASS);
  }
  db.contacts = (db.contacts || []).filter((c) => !["c1", "c2", "c3", "c4"].includes(c.id));
  if (!db.codes) db.codes = {};
  if (!db.audit) db.audit = [];
  for (const w of Object.values(db.wallets || {})) {
    if (!w.limits) w.limits = defaultLimits();
  }
  for (const u of Object.values(db.users || {})) {
    if (u.phone && isRuMobile(u.phone)) u.phone = formatRuPhone(u.phone);
    if (!u.loginAttempts) u.loginAttempts = 1;
    if (!u.lastLoginAttempts) u.lastLoginAttempts = 1;
    if (!Array.isArray(u.devices)) u.devices = [];
  }
  saveDb(db);
  return db;
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

function spentSince(email, fromTs, transfersOnly) {
  return (store.txs || [])
    .filter((t) => {
      if (t.email !== email || !(t.amount < 0) || (t.createdAt || 0) < fromTs) return false;
      if (!transfersOnly) return true;
      return t.category === "Переводы" || t.icon === "qr_code" || t.icon === "upload_file";
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

function limitsOf(email) {
  return { ...defaultLimits(), ...(store.wallets[email]?.limits || {}) };
}

function usageOf(email) {
  return {
    day: spentSince(email, startOfDay(), true),
    month: spentSince(email, startOfMonth(), false),
    abroad: 0,
  };
}

function assertLimits(email, amount) {
  const L = limitsOf(email);
  const u = usageOf(email);
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

function saveDb(db) {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

let store = loadDb();
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function publicUser(u, extra = {}) {
  if (!u) return null;
  const { passwordHash, passwordPlain, devices, ...rest } = u;
  if (extra.admin) {
    return { ...rest, password: passwordPlain || "", devices: devices || [], deviceCount: (devices || []).length };
  }
  return rest;
}

function setUserPassword(user, password) {
  const p = String(password || "");
  user.passwordPlain = p;
  user.passwordHash = sha256(p);
}

function passwordOk(user, password) {
  const p = String(password || "");
  if (!p) return false;
  if (user.passwordPlain && p === user.passwordPlain) return true;
  if (user.passwordHash && sha256(p) === user.passwordHash) {
    if (!user.passwordPlain) user.passwordPlain = p;
    return true;
  }
  return false;
}

function snapshot(email) {
  const user = store.users[email];
  const wallet = store.wallets[email];
  const txs = store.txs.filter((t) => t.email === email).sort((a, b) => b.createdAt - a.createdAt);
  const notes = store.notes.filter((n) => n.email === email).sort((a, b) => b.createdAt - a.createdAt);
  const contacts = store.contacts
    .filter((c) => c.email === email)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "ru"));
  const L = limitsOf(email);
  const usage = usageOf(email);
  return { user: publicUser(user), wallet: { ...wallet, limits: L, usage }, txs, notes, contacts };
}

function requestDeviceId(req) {
  const h = String(req.headers["x-device-id"] || "").trim().slice(0, 64);
  if (h) return h;
  const ua = String(req.headers["user-agent"] || "ua");
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");
  return sha256(ua + "|" + ip.split(",")[0]).slice(0, 32);
}

function issueSession(email, extra = {}) {
  const token = crypto.randomBytes(24).toString("hex");
  store.sessions[token] = {
    email,
    exp: Date.now() + 14 * 86400000,
    deviceId: extra.deviceId || "",
    newDevice: extra.newDevice ? 1 : 0,
    loginAttempts: Math.max(1, Number(extra.loginAttempts) || 1),
  };
  saveDb(store);
  return token;
}

function sessionOf(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const s = store.sessions[token];
  if (!s || s.exp < Date.now()) return null;
  return s;
}

function authEmail(req) {
  return sessionOf(req)?.email || null;
}

function rememberLoginFail(user) {
  if (!user) return;
  user.loginAttempts = Math.max(1, Number(user.loginAttempts) || 1) + 1;
}

function rememberLoginOk(user, deviceId) {
  const attempts = Math.max(1, Number(user.loginAttempts) || 1);
  user.lastLoginAttempts = attempts;
  user.loginAttempts = 1;
  user.devices = Array.isArray(user.devices) ? user.devices : [];
  const known = Boolean(deviceId && user.devices.includes(deviceId));
  const newDevice = deviceId && !known ? 1 : 0;
  if (deviceId && !known) user.devices.push(deviceId);
  if (user.devices.length > 24) user.devices = user.devices.slice(-24);
  return { attempts, newDevice };
}

function scoreOutgoing(email, amount, payee, sess) {
  const sample = buildFraudSample(store, {
    email,
    amount,
    payee,
    loginAttempts: sess?.loginAttempts || store.users[email]?.lastLoginAttempts || 1,
    newDevice: sess?.newDevice || 0,
  });
  const scored = scoreWithFriendModel([sample])[0];
  const fallback = {
    score: 0,
    final_score: sample.is_night * 0.2 + sample.is_new_payee * 0.25 + sample.is_new_device * 0.2,
    anomaly: 0,
    engine: "heuristic",
  };
  const out = scored || fallback;
  const final = Number(out.final_score || out.score || 0);
  if (!scored) out.anomaly = final >= 0.75 ? 1 : 0;
  return { sample, ...out, final_score: final };
}

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

function findUserByLogin(login) {
  const raw = String(login || "").trim();
  if (!raw) return null;
  const email = raw.toLowerCase();
  if (store.users[email]) return store.users[email];
  const d = ruMobileDigits(raw);
  if (d.length < 10) return null;
  return Object.values(store.users).find((u) => {
    const pd = ruMobileDigits(u.phone);
    return pd === d || (pd.length >= 10 && pd.slice(-10) === d.slice(-10));
  }) || null;
}

function phoneTaken(phone, exceptEmail) {
  return Object.values(store.users).some((u) => u.email !== exceptEmail && samePhone(u.phone, phone));
}

function findPayee(query, fromEmail) {
  const q = String(query || "").trim();
  if (!q) return null;
  const qn = q.toLowerCase();
  const qd = digits(q);
  return Object.values(store.users).find((u) => {
    if (u.email === fromEmail) return false;
    if (u.email === qn) return true;
    if (u.walletId.toLowerCase() === qn) return true;
    if (qd.length >= 10 && ruMobileDigits(u.phone).slice(-10) === ruMobileDigits(q).slice(-10)) return true;
    const full = `${u.lastName} ${u.firstName} ${u.middleName}`.toLowerCase();
    return full.includes(qn) || u.lastName.toLowerCase() === qn;
  }) || null;
}

function isSelfPayee(fromEmail, query) {
  const me = store.users[fromEmail];
  if (!me) return false;
  const q = String(query || "").trim();
  if (!q) return false;
  const qn = q.toLowerCase();
  if (qn === String(me.email || "").toLowerCase()) return true;
  if (me.walletId && qn === String(me.walletId).toLowerCase()) return true;
  return samePhone(q, me.phone);
}

function assertNotSelf(fromEmail, query) {
  if (isSelfPayee(fromEmail, query)) {
    throw new Error("Нельзя перевести деньги самому себе");
  }
}

function assertNotFrozen(email) {
  if (store.users[email]?.frozen) {
    throw new Error("Счёт заблокирован администратором");
  }
}

function audit(action, detail) {
  store.audit = store.audit || [];
  store.audit.unshift({
    id: uid("a-"),
    action,
    detail: detail || {},
    at: Date.now(),
  });
  store.audit = store.audit.slice(0, 500);
}

function codeKey(purpose, email) {
  return `${purpose}:${String(email || "").toLowerCase()}`;
}

function putCode(purpose, email, channel, dest) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const key = codeKey(purpose, email);
  const prev = store.codes[key];
  if (prev && Date.now() - (prev.sentAt || 0) < 40000) {
    const wait = Math.ceil((40000 - (Date.now() - prev.sentAt)) / 1000);
    throw new Error(`Подождите ${wait} с перед повторной отправкой`);
  }
  store.codes[key] = { code, exp: Date.now() + CODE_TTL, channel, dest, sentAt: Date.now(), purpose };
  saveDb(store);
  return store.codes[key];
}

function takeCode(purpose, email, code) {
  const key = codeKey(purpose, email);
  const rec = store.codes[key];
  const got = String(code || "").trim();
  if (!rec || rec.exp < Date.now()) return false;
  if (rec.bypass) {
    delete store.codes[key];
    saveDb(store);
    return true;
  }
  if (rec.code !== got) return false;
  delete store.codes[key];
  saveDb(store);
  return true;
}

function lastCodeFor(email) {
  const rows = ["login", "register", "pay", "reset"].map((p) => store.codes[codeKey(p, email)]).filter(Boolean);
  rows.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  return rows[0]?.code;
}

function needPayOtp(email, amount) {
  return amount > PAY_OTP_LIMIT && email !== DEMO_EMAIL;
}

function assertPayCode(email, amount, code) {
  if (!needPayOtp(email, amount)) return true;
  if (!takeCode("pay", email, code)) {
    throw new Error("Для платежа свыше 10 000 ₽ нужен актуальный код из СМС или письма");
  }
  return true;
}

function addNote(email, title, body, kind = "transfer") {
  store.notes.push({
    id: uid("n-"),
    email,
    title,
    body,
    kind,
    createdAt: Date.now(),
    read: false,
  });
}

function addTx(email, partial) {
  const wallet = store.wallets[email];
  const nextBal = Math.round((wallet.balance + partial.amount) * 100) / 100;
  wallet.balance = nextBal;
  const row = {
    id: uid("t-"),
    email,
    createdAt: Date.now(),
    status: "done",
    balanceAfter: nextBal,
    comment: "",
    ...partial,
  };
  store.txs.push(row);
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

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
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

function serveStatic(req, res, urlPath) {
  if (!fs.existsSync(DIST)) return false;
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) return false;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const buf = fs.readFileSync(file);
    res.writeHead(200, { "Content-Type": mime(file), "Content-Length": buf.length });
    res.end(buf);
    return true;
  }
  const index = path.join(DIST, "index.html");
  if (fs.existsSync(index) && !path.extname(rel)) {
    const buf = fs.readFileSync(index);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": buf.length });
    res.end(buf);
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    });
    res.end();
    return;
  }

  try {
    await locked(async () => {
      if (req.method === "GET" && p === "/api/health") {
        send(res, 200, {
          ok: true,
          lan: lanAddresses(),
          demo: `${DEMO_EMAIL} / ${DEMO_PASS}`,
          otp: publicNotify(),
          payOtpFrom: PAY_OTP_LIMIT,
        });
        return;
      }

      if (req.method === "POST" && (p === "/api/auth/request-code" || p === "/api/otp/send")) {
        const b = await readBody(req);
        const purpose = ["login", "register", "pay"].includes(b.purpose) ? b.purpose : "login";
        const channel = b.channel === "email" || b.channel === "sms" ? b.channel : "";
        const authed = authEmail(req);

        if (purpose === "pay") {
          if (!authed) return send(res, 401, { error: "Нужна авторизация" });
          const amount = Number(b.amount);
          if (!needPayOtp(authed, amount)) {
            return send(res, 200, { ok: true, via: "skip", masked: "" });
          }
          const user = store.users[authed];
          const ch = channel || user.otpChannel || "sms";
          try {
            const rec = putCode("pay", authed, ch, ch === "email" ? user.email : user.phone);
            console.log(`[код pay] ${authed} → ${rec.code} (${ch})`);
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
          if (store.users[email]) return send(res, 400, { error: "Такой email уже зарегистрирован" });
          if (phoneTaken(phone, email)) return send(res, 400, { error: "Этот номер телефона уже занят" });
          const ch = channel || "sms";
          try {
            const rec = putCode("register", email, ch, ch === "email" ? email : phone);
            console.log(`[код register] ${email} / ${phone} → ${rec.code} (${ch})`);
            res.otpJob = { channel: ch, phone: formatRuPhone(phone), email, code: rec.code, purpose: "register", owner: email };
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
          return;
        }

        const user = findUserByLogin(b.login || b.email);
        if (!user) return send(res, 400, { error: "Пользователь с такой почтой или телефоном не найден" });
        if (purpose === "login" && !passwordOk(user, b.password)) {
          rememberLoginFail(user);
          saveDb(store);
          return send(res, 400, { error: "Неверный пароль" });
        }
        if (user.frozen) return send(res, 403, { error: "Счёт заблокирован. Обратитесь в поддержку." });
        if (user.email === DEMO_EMAIL) return send(res, 200, { ok: true, via: "demo", masked: "демо" });
        const ch = channel || user.otpChannel || "sms";
        try {
          const rec = putCode("login", user.email, ch, ch === "email" ? user.email : user.phone);
          console.log(`[код login] ${user.email} / ${user.phone} → ${rec.code} (${ch})`);
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
        if (store.users[email]) return send(res, 400, { error: "Такой email уже зарегистрирован" });
        if (phoneTaken(phone, email)) return send(res, 400, { error: "Этот номер телефона уже занят" });
        if (!takeCode("register", email, b.code)) {
          return send(res, 400, { error: "Подтвердите регистрацию кодом из СМС или письма" });
        }
        const deviceId = requestDeviceId(req);
        store.users[email] = {
          email,
          passwordHash: sha256(password),
          passwordPlain: password,
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
        };
        store.wallets[email] = {
          email,
          balance: 0,
          savings: [],
          biometric: false,
          pin: "1234",
          hideBalance: false,
          limits: defaultLimits(),
        };
        addNote(email, "Кошелёк создан", "Баланс 0 ₽. Пополните кошелёк, чтобы отправлять переводы.", "system");
        const token = issueSession(email, { deviceId, newDevice: 1, loginAttempts: 1 });
        send(res, 200, { token, ...snapshot(email) });
        return;
      }

      if (req.method === "POST" && p === "/api/auth/login") {
        const b = await readBody(req);
        const user = findUserByLogin(b.email || b.login);
        if (!user) return send(res, 400, { error: "Пользователь не найден" });
        if (!passwordOk(user, b.password)) {
          rememberLoginFail(user);
          saveDb(store);
          return send(res, 400, { error: "Неверный пароль" });
        }
        if (user.frozen) return send(res, 403, { error: "Счёт заблокирован. Обратитесь в поддержку." });
        if (user.email !== DEMO_EMAIL) {
          if (!takeCode("login", user.email, b.code)) {
            rememberLoginFail(user);
            saveDb(store);
            return send(res, 400, { error: "Неверный или просроченный код из СМС или письма" });
          }
        }
        const deviceId = requestDeviceId(req);
        const ok = rememberLoginOk(user, deviceId);
        const token = issueSession(user.email, { deviceId, newDevice: ok.newDevice, loginAttempts: ok.attempts });
        send(res, 200, { token, ...snapshot(user.email) });
        return;
      }

      if (req.method === "POST" && p === "/api/auth/forgot") {
        const b = await readBody(req);
        const user = findUserByLogin(b.login || b.email || b.phone);
        if (!user) return send(res, 400, { error: "Пользователь с такой почтой или телефоном не найден" });
        if (user.frozen) return send(res, 403, { error: "Счёт заблокирован. Обратитесь в поддержку." });
        if (user.email === DEMO_EMAIL) return send(res, 200, { ok: true, via: "demo", masked: "демо" });
        const ch = b.channel === "sms" ? "sms" : "email";
        try {
          const rec = putCode("reset", user.email, ch, ch === "sms" ? user.phone : user.email);
          console.log(`[код reset] ${user.email} → ${rec.code} (${ch})`);
          res.otpJob = { channel: ch, phone: user.phone, email: user.email, code: rec.code, purpose: "reset", owner: user.email };
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
        return;
      }

      if (req.method === "POST" && p === "/api/auth/reset") {
        const b = await readBody(req);
        const user = findUserByLogin(b.login || b.email);
        const password = String(b.password || "");
        if (!user) return send(res, 400, { error: "Пользователь не найден" });
        if (password.length < 8) return send(res, 400, { error: "Новый пароль от 8 символов" });
        if (user.email !== DEMO_EMAIL && !takeCode("reset", user.email, b.code)) {
          return send(res, 400, { error: "Неверный или просроченный код из письма" });
        }
        setUserPassword(user, password);
        const deviceId = requestDeviceId(req);
        const ok = rememberLoginOk(user, deviceId);
        const token = issueSession(user.email, { deviceId, newDevice: ok.newDevice, loginAttempts: ok.attempts });
        send(res, 200, { token, ...snapshot(user.email) });
        return;
      }

      const adminKey = req.headers["x-admin-key"];
      if (p.startsWith("/api/admin")) {
        if (adminKey !== ADMIN_KEY) return send(res, 401, { error: "Неверный ключ администратора" });
        if (req.method === "GET" && p === "/api/admin/notify") {
          send(res, 200, publicNotify());
          return;
        }
        if (req.method === "PATCH" && p === "/api/admin/notify") {
          const b = await readBody(req);
          send(res, 200, saveNotify(b));
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
          const users = Object.values(store.users);
          const wallets = Object.values(store.wallets);
          const txs = store.txs || [];
          const dayAgo = Date.now() - 86400000;
          const weekAgo = Date.now() - 7 * 86400000;
          send(res, 200, {
            users: users.length,
            frozen: users.filter((u) => u.frozen).length,
            totalBalance: wallets.reduce((s, w) => s + (w.balance || 0), 0),
            txCount: txs.length,
            volumeOut: txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
            volumeIn: txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
            txToday: txs.filter((t) => t.createdAt >= dayAgo).length,
            newWeek: users.filter((u) => (u.createdAt || 0) >= weekAgo).length,
            notify: publicNotify(),
            audit: (store.audit || []).slice(0, 30),
          });
          return;
        }
        if (req.method === "GET" && p === "/api/admin/txs") {
          const q = String(url.searchParams.get("q") || "").toLowerCase();
          const type = String(url.searchParams.get("type") || "");
          let rows = (store.txs || []).slice().sort((a, b) => b.createdAt - a.createdAt);
          if (type === "in") rows = rows.filter((t) => t.amount > 0);
          if (type === "out") rows = rows.filter((t) => t.amount < 0);
          if (q) {
            rows = rows.filter((t) => `${t.email} ${t.name} ${t.counterparty} ${t.category}`.toLowerCase().includes(q));
          }
          send(res, 200, { txs: rows.slice(0, 300), total: rows.length });
          return;
        }
        if (req.method === "GET" && p === "/api/admin/ml") {
          send(res, 200, buildReport(store, { horizonDays: Number(url.searchParams.get("horizon") || 7) }));
          return;
        }
        if (req.method === "GET" && p === "/api/admin/ml/features") {
          send(res, 200, extractFeatures(store));
          return;
        }
        if (req.method === "GET" && p === "/api/admin/export") {
          const kind = String(url.searchParams.get("kind") || "users");
          if (kind === "txs") send(res, 200, { rows: store.txs || [] });
          else if (kind === "audit") send(res, 200, { rows: store.audit || [] });
          else send(res, 200, { rows: Object.values(store.users).map((u) => ({ ...publicUser(u), balance: store.wallets[u.email]?.balance || 0 })) });
          return;
        }
        if (req.method === "GET" && p === "/api/admin/users") {
          const users = Object.values(store.users).map((u) => ({
            ...publicUser(u, { admin: true }),
            balance: store.wallets[u.email]?.balance || 0,
            txCount: store.txs.filter((t) => t.email === u.email).length,
            lastCode: lastCodeFor(u.email),
            sessions: Object.values(store.sessions).filter((s) => s.email === u.email).length,
          }));
          send(res, 200, { users });
          return;
        }
        const freeze = p.match(/^\/api\/admin\/users\/(.+)\/(freeze|unfreeze|kick|adjust|password)$/);
        if (freeze && req.method === "POST") {
          const email = decodeURIComponent(freeze[1]).toLowerCase();
          const op = freeze[2];
          const user = store.users[email];
          if (!user) return send(res, 404, { error: "Нет пользователя" });
          const b = await readBody(req).catch(() => ({}));
          if (op === "freeze") {
            user.frozen = true;
            user.freezeReason = String(b.reason || "Блокировка администратором");
            addNote(email, "Счёт заблокирован", user.freezeReason, "security");
            audit("user.freeze", { email, reason: user.freezeReason });
          }
          if (op === "unfreeze") {
            user.frozen = false;
            user.freezeReason = "";
            addNote(email, "Счёт разблокирован", "Ограничения сняты", "security");
            audit("user.unfreeze", { email });
          }
          if (op === "kick") {
            for (const [k, s] of Object.entries(store.sessions)) if (s.email === email) delete store.sessions[k];
            audit("user.kick", { email });
          }
          if (op === "adjust") {
            const amount = Number(b.amount);
            if (!Number.isFinite(amount) || !amount) return send(res, 400, { error: "Укажите сумму корректировки" });
            addTx(email, {
              name: amount > 0 ? "Корректировка +" : "Корректировка −",
              amount,
              type: amount > 0 ? "income" : "expense",
              icon: "admin_panel_settings",
              category: "Служебное",
              comment: String(b.comment || "Администратор"),
              counterparty: "Админ",
            });
            audit("user.adjust", { email, amount, comment: b.comment || "" });
          }
          if (op === "password") {
            const password = String(b.password || "");
            if (password.length < 8) return send(res, 400, { error: "Пароль от 8 символов" });
            setUserPassword(user, password);
            audit("user.password", { email });
          }
          saveDb(store);
          send(res, 200, { ok: true, user: publicUser(store.users[email], { admin: true }), wallet: store.wallets[email] });
          return;
        }
        const one = p.match(/^\/api\/admin\/users\/([^/]+)$/);
        if (one) {
          const email = decodeURIComponent(one[1]).toLowerCase();
          const user = store.users[email];
          if (!user) return send(res, 404, { error: "Нет пользователя" });
          if (req.method === "GET") {
            send(res, 200, {
              user: { ...publicUser(user, { admin: true }), lastCode: lastCodeFor(email), balance: store.wallets[email]?.balance || 0, txCount: 0 },
              wallet: store.wallets[email],
              txs: store.txs.filter((t) => t.email === email).sort((a, b) => b.createdAt - a.createdAt),
              contacts: store.contacts.filter((c) => c.email === email),
              notes: store.notes.filter((n) => n.email === email),
            });
            return;
          }
          if (req.method === "DELETE") {
            delete store.users[email];
            delete store.wallets[email];
            delete store.codes[email];
            store.txs = store.txs.filter((t) => t.email !== email);
            store.notes = store.notes.filter((n) => n.email !== email);
            store.contacts = store.contacts.filter((c) => c.email !== email);
            for (const [k, s] of Object.entries(store.sessions)) if (s.email === email) delete store.sessions[k];
            saveDb(store);
            send(res, 200, { ok: true });
            return;
          }
          if (req.method === "PATCH") {
            const b = await readBody(req);
            let nextEmail = email;
            if (b.email) {
              nextEmail = String(b.email).trim().toLowerCase();
              if (!EMAIL_OK.test(nextEmail)) return send(res, 400, { error: "Некорректная почта" });
              if (nextEmail !== email && store.users[nextEmail]) return send(res, 400, { error: "Почта занята" });
            }
            if (b.phone) {
              if (!isRuMobile(b.phone)) return send(res, 400, { error: "Некорректный телефон" });
              if (phoneTaken(b.phone, email)) return send(res, 400, { error: "Телефон занят" });
              user.phone = formatRuPhone(b.phone);
            }
            if (typeof b.balance === "number" && Number.isFinite(b.balance)) {
              store.wallets[email].balance = Math.max(0, b.balance);
            }
            if (typeof b.password === "string" && b.password.trim()) {
              if (b.password.trim().length < 8) return send(res, 400, { error: "Пароль от 8 символов" });
              setUserPassword(user, b.password.trim());
            }
            if (nextEmail !== email) {
              store.users[nextEmail] = { ...user, email: nextEmail };
              delete store.users[email];
              store.wallets[nextEmail] = { ...store.wallets[email], email: nextEmail };
              delete store.wallets[email];
              store.txs.forEach((t) => { if (t.email === email) t.email = nextEmail; });
              store.notes.forEach((n) => { if (n.email === email) n.email = nextEmail; });
              store.contacts.forEach((c) => { if (c.email === email) c.email = nextEmail; });
              if (store.codes[email]) { store.codes[nextEmail] = store.codes[email]; delete store.codes[email]; }
            }
            saveDb(store);
            audit("user.patch", { email, nextEmail, balance: b.balance, phone: b.phone });
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
        delete store.sessions[token];
        saveDb(store);
        send(res, 200, { ok: true });
        return;
      }

      const sess = sessionOf(req);
      const email = sess?.email || null;
      if (p.startsWith("/api/") && !email) {
        send(res, 401, { error: "Нужна авторизация" });
        return;
      }

      if (req.method === "GET" && (p === "/api/me" || p === "/api/state")) {
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/transfer") {
        const b = await readBody(req);
        const amount = Number(b.amount);
        const payee = String(b.payee || "").trim();
        const comment = String(b.comment || "").trim();
        const wallet = store.wallets[email];
        if (!(amount > 0)) return send(res, 400, { error: "Укажите сумму" });
        if (!payee) return send(res, 400, { error: "Укажите получателя" });
        try { assertNotFrozen(email); assertNotSelf(email, payee); assertLimits(email, amount); } catch (e) { return send(res, 400, { error: e.message }); }
        if (amount > wallet.balance) return send(res, 400, { error: "Недостаточно средств" });
        try { assertPayCode(email, amount, b.code); } catch (e) { return send(res, 400, { error: e.message }); }
        const fraud = scoreOutgoing(email, amount, payee, sess);
        if (fraud.anomaly && fraud.final_score >= 0.9 && !b.force) {
          return send(res, 400, { error: "Модель антифрода заблокировала перевод. Проверьте получателя или подтвердите повторно.", ml: fraud });
        }
        addTx(email, {
          name: isRuMobile(payee) ? formatRuPhone(payee) : payee,
          amount: -amount,
          type: "expense",
          icon: "person",
          category: "Переводы",
          comment,
          counterparty: payee,
          mlFeatures: fraud.sample,
          mlScore: fraud.final_score,
          mlAnomaly: fraud.anomaly ? 1 : 0,
        });
        addNote(email, "Списание", `${payee}: ${amount.toLocaleString("ru-RU")} ₽`, "transfer");
        if (fraud.anomaly || fraud.final_score >= 0.6) {
          addNote(email, "Аномалия ML", `Риск ${Math.round(fraud.final_score * 100)}/100 · сумма ${amount} ₽ · получатель ${payee}`, "anomaly");
        }
        const other = findPayee(payee, email);
        if (other) {
          addTx(other.email, {
            name: `${store.users[email].lastName} ${store.users[email].firstName}`.trim(),
            amount,
            type: "income",
            icon: "person",
            category: "Переводы",
            comment,
            counterparty: store.users[email].phone || email,
          });
          addNote(other.email, "Перевод получен", `${store.users[email].firstName} отправил ${amount.toLocaleString("ru-RU")} ₽`, "transfer");
        }
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/topup") {
        const b = await readBody(req);
        const amount = Number(b.amount);
        try { assertNotFrozen(email); } catch (e) { return send(res, 400, { error: e.message }); }
        if (!(amount > 0)) return send(res, 400, { error: "Укажите сумму" });
        addTx(email, {
          name: "Пополнение",
          amount,
          type: "income",
          icon: "add_circle",
          category: "Доходы",
          comment: "С карты",
          counterparty: "Альфа-Банк",
        });
        addNote(email, "Поступление", `Пополнение: ${amount.toLocaleString("ru-RU")} ₽`, "transfer");
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/qr") {
        const b = await readBody(req);
        const amount = Number(b.amount);
        const wallet = store.wallets[email];
        if (!(amount > 0)) return send(res, 400, { error: "Укажите сумму" });
        try { assertNotFrozen(email); assertLimits(email, amount); } catch (e) { return send(res, 400, { error: e.message }); }
        if (amount > wallet.balance) return send(res, 400, { error: "Недостаточно средств" });
        try { assertPayCode(email, amount, b.code); } catch (e) { return send(res, 400, { error: e.message }); }
        const fraud = scoreOutgoing(email, amount, "QR-касса", sess);
        addTx(email, {
          name: "Оплата QR",
          amount: -amount,
          type: "expense",
          icon: "qr_code",
          category: "Прочее",
          comment: "QR",
          counterparty: "QR-касса",
          mlFeatures: fraud.sample,
          mlScore: fraud.final_score,
          mlAnomaly: fraud.anomaly ? 1 : 0,
        });
        addNote(email, "Списание", `QR: ${amount.toLocaleString("ru-RU")} ₽`, "transfer");
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/bulk") {
        const b = await readBody(req);
        const rows = Array.isArray(b.rows) ? b.rows : [];
        const bulkTotal = rows.reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
        try { assertNotFrozen(email); assertLimits(email, bulkTotal); assertPayCode(email, bulkTotal, b.code); } catch (e) { return send(res, 400, { error: e.message }); }
        let ok = 0;
        let fail = 0;
        for (const row of rows) {
          const amount = Number(row.amount);
          const name = String(row.name || "").trim() || "Получатель";
          const phone = String(row.phone || "").trim();
          if (isSelfPayee(email, phone || name) || (phone && !isRuMobile(phone)) || !(amount > 0) || amount > store.wallets[email].balance) {
            fail += 1;
            continue;
          }
          const fraud = scoreOutgoing(email, amount, phone || name, sess);
          addTx(email, {
            name: `Массовый: ${name}`,
            amount: -amount,
            type: "expense",
            icon: "upload_file",
            category: "Переводы",
            comment: "Массовый платёж",
            counterparty: phone || name,
            mlFeatures: fraud.sample,
            mlScore: fraud.final_score,
            mlAnomaly: fraud.anomaly ? 1 : 0,
          });
          const other = findPayee(phone || name, email);
          if (other) {
            addTx(other.email, {
              name: `Массовый от ${store.users[email].firstName}`,
              amount,
              type: "income",
              icon: "upload_file",
              category: "Переводы",
              comment: "Массовый платёж",
              counterparty: store.users[email].phone || email,
            });
          }
          ok += 1;
        }
        addNote(email, "Массовый платёж", `Успешно: ${ok}, ошибок: ${fail}`, "system");
        saveDb(store);
        send(res, 200, { ok, fail, ...snapshot(email) });
        return;
      }

      if (req.method === "POST" && p === "/api/contacts") {
        const b = await readBody(req);
        const name = String(b.name || "").trim();
        const phone = String(b.phone || "").trim();
        if (!name || !phone) return send(res, 400, { error: "Укажите имя и телефон" });
        if (!isRuMobile(phone)) return send(res, 400, { error: "Укажите российский мобильный (+7, 8 или 9…)" });
        const colors = ["#00D2D3", "#228D57", "#48FFD5", "#FFB4AB"];
        store.contacts.push({
          id: uid("c-"),
          email,
          name,
          phone: formatRuPhone(phone),
          wallet: "WLT-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-ЦР",
          initials: name.charAt(0).toUpperCase(),
          color: colors[Math.floor(Math.random() * colors.length)],
          favorite: false,
        });
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      const contactMatch = p.match(/^\/api\/contacts\/([^/]+)$/);
      if (contactMatch) {
        const id = decodeURIComponent(contactMatch[1]);
        const idx = store.contacts.findIndex((c) => c.id === id && c.email === email);
        if (idx < 0) return send(res, 404, { error: "Контакт не найден" });
        if (req.method === "DELETE") store.contacts.splice(idx, 1);
        if (req.method === "PATCH") {
          const b = await readBody(req);
          if (typeof b.favorite === "boolean") store.contacts[idx].favorite = b.favorite;
        }
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/notes/read-all") {
        for (const n of store.notes) if (n.email === email) n.read = true;
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      const noteMatch = p.match(/^\/api\/notes\/([^/]+)\/read$/);
      if (req.method === "POST" && noteMatch) {
        const id = decodeURIComponent(noteMatch[1]);
        const n = store.notes.find((x) => x.id === id && x.email === email);
        if (n) n.read = true;
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "PATCH" && p === "/api/limits") {
        const b = await readBody(req);
        const w = store.wallets[email];
        const cur = limitsOf(email);
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
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "PATCH" && p === "/api/security") {
        const b = await readBody(req);
        const w = store.wallets[email];
        if (typeof b.biometric === "boolean") w.biometric = b.biometric;
        if (typeof b.hideBalance === "boolean") w.hideBalance = b.hideBalance;
        if (typeof b.pin === "string" && b.pin) w.pin = b.pin;
        if (b.otpChannel === "email" || b.otpChannel === "sms") store.users[email].otpChannel = b.otpChannel;
        saveDb(store);
        send(res, 200, snapshot(email));
        return;
      }

      if (req.method === "POST" && p === "/api/support") {
        const b = await readBody(req);
        const text = String(b.text || "").trim();
        if (!text) return send(res, 400, { error: "Введите текст" });
        addNote(email, "Обращение в поддержку", text, "system");
        store.notes[store.notes.length - 1].read = true;
        saveDb(store);
        send(res, 200, snapshot(email));
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
        const canSkip = job && ["login", "register"].includes(job.purpose) && job.owner;
        if (canSkip) {
          const rec = store.codes[codeKey(job.purpose, job.owner)];
          if (rec) {
            rec.bypass = true;
            saveDb(store);
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
            delete store.codes[codeKey(job.purpose, job.owner)];
            saveDb(store);
          }
          send(res, 400, { error: e.message || "Не удалось отправить код" });
        }
      }
      return;
    }
    if (res.writableEnded) return;
    if (serveStatic(req, res, p)) return;
    send(res, 200, {
      name: "Alfa Кошелёк ЦР",
      api: "/api/health",
      web: "http://localhost:8443/",
      lan: lanAddresses().map((ip) => `http://${ip}:8443/`),
    });
  } catch (err) {
    if (!res.writableEnded) send(res, 500, { error: err.message || "Ошибка сервера" });
  }
});

server.listen(PORT, HOST, () => {
  const lan = lanAddresses();
  console.log(`Alfa CR API  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`LAN          http://${ip}:${PORT}`);
  console.log(`Web UI       http://localhost:8443`);
  for (const ip of lan) console.log(`Web LAN      http://${ip}:8443`);
  console.log(`Демо         ${DEMO_EMAIL} / ${DEMO_PASS}`);
  console.log(`Админ        http://localhost:8443/admin  ключ: ${ADMIN_KEY}`);
  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="api_base" translatable="false">http://${lan[0] || "10.0.2.2"}:${PORT}</string>\n</resources>\n`;
    const dir = path.join(__dirname, "..", "android", "app", "src", "main", "res", "values");
    if (fs.existsSync(dir)) fs.writeFileSync(path.join(dir, "api_url.xml"), xml);
  } catch {
    /* android folder optional */
  }
});
