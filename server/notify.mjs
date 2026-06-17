import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { ruMobileDigits } from "./phone.mjs";
import { readNotify, writeNotify } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || __dirname;
const FILE = path.join(DATA_DIR, "notify.json");
const ENV_FILE = path.join(__dirname, ".env");

function loadDotEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv();

const DEFAULT_SMSRU = "E5BC03E1-5193-FFFF-1F0D-CB0DAD2CD255";

function keep(val, fallback) {
  const s = val == null ? "" : String(val).trim();
  return s || fallback || "";
}

let cache = null;

function fromEnv(file = {}) {
  return {
    smsruApiId: keep(file.smsruApiId, process.env.SMSRU_API_ID) || DEFAULT_SMSRU,
    smsFrom: keep(file.smsFrom, process.env.SMSRU_FROM),
    smtpHost: keep(file.smtpHost, process.env.SMTP_HOST) || "smtp.mail.ru",
    smtpPort: Number(file.smtpPort || process.env.SMTP_PORT || 465),
    smtpUser: keep(file.smtpUser, process.env.SMTP_USER),
    smtpPass: keep(file.smtpPass, process.env.SMTP_PASS).replace(/\s/g, ""),
    smtpFrom: keep(file.smtpFrom, process.env.SMTP_FROM) || keep(file.smtpUser, process.env.SMTP_USER),
  };
}

export function loadNotify() {
  return cache || fromEnv();
}

export async function hydrateNotify() {
  let file = {};
  try {
    if (fs.existsSync(FILE)) file = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    file = {};
  }
  const row = await readNotify();
  cache = fromEnv(row || file);
  if (!row) await writeNotify(cache);
}

export async function saveNotify(patch) {
  const cur = loadNotify();
  const next = {
    smsruApiId: keep(patch.smsruApiId, cur.smsruApiId) || DEFAULT_SMSRU,
    smsFrom: keep(patch.smsFrom, cur.smsFrom),
    smtpHost: keep(patch.smtpHost, cur.smtpHost) || "smtp.mail.ru",
    smtpPort: Number(patch.smtpPort != null ? patch.smtpPort : cur.smtpPort) || 465,
    smtpUser: keep(patch.smtpUser, cur.smtpUser),
    smtpPass: keep(patch.smtpPass, cur.smtpPass).replace(/\s/g, ""),
    smtpFrom: keep(patch.smtpFrom, cur.smtpFrom) || keep(patch.smtpUser, cur.smtpUser),
  };
  cache = next;
  await writeNotify(next);
  return publicNotify(next);
}

export function publicNotify(cfg = loadNotify()) {
  return {
    sms: Boolean(cfg.smsruApiId),
    email: Boolean(cfg.smtpUser && cfg.smtpPass),
    smsruApiId: cfg.smsruApiId || "",
    smsFrom: cfg.smsFrom || "",
    smtpHost: cfg.smtpHost,
    smtpPort: cfg.smtpPort,
    smtpUser: cfg.smtpUser,
    smtpFrom: cfg.smtpFrom || cfg.smtpUser,
  };
}

export function maskPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length < 10) return "телефон";
  const n = d.length === 11 ? d : "7" + d.slice(-10);
  return `+7 (${n.slice(1, 4)}) ***-**-${n.slice(-2)}`;
}

export function maskEmail(e) {
  const [u, d] = String(e || "").split("@");
  if (!d) return "почту";
  return `${u.slice(0, 2)}***@${d}`;
}

function ruPhone(p) {
  return ruMobileDigits(p);
}

function ruSmtpError(err) {
  const m = String(err && err.message ? err.message : err || "");
  const low = m.toLowerCase();
  if (low.includes("application password") || low.includes("parol prilozheniya") || low.includes("neobhodim") || /535/.test(m)) {
    return "Почта не приняла пароль. В Mail.ru нужен пароль приложения: Настройки → Безопасность → Пароли для внешних приложений. Обычный пароль от ящика не подойдёт.";
  }
  if (low.includes("invalid login") || low.includes("authentication") || low.includes("auth")) {
    return "Неверный логин или пароль SMTP. Проверьте почту и пароль приложения в /admin.";
  }
  if (low.includes("timeout") || low.includes("econn") || low.includes("connect")) {
    return "Не удалось подключиться к почтовому серверу. Проверьте SMTP-хост и порт.";
  }
  if (low.includes("certificate") || low.includes("ssl") || low.includes("tls")) {
    return "Ошибка защищённого соединения с почтой. Для Mail.ru используйте порт 465.";
  }
  return "Не удалось отправить письмо. " + (m ? "Подробности: " + m : "Проверьте SMTP в /admin.");
}

function ruSmsError(err) {
  const m = String(err && err.message ? err.message : err || "");
  const low = m.toLowerCase();
  if (low.includes("отправител") || low.includes("sender") || low.includes("буквенн") || low.includes("panel=senders")) {
    return "SMS.ru не отправляет СМС без буквенного отправителя (sms.ru → Отправители). Пока СМС недоступно, вход идёт по паролю или на почту.";
  }
  if (low.includes("balance") || low.includes("баланс") || low.includes("money") || low.includes("недостаточно")) {
    return "На SMS.ru закончились средства. Пополните баланс или войдите по паролю.";
  }
  return m || "СМС не отправлено. Проверьте ключ SMS.ru.";
}

async function sendSms(apiId, phone, text, from) {
  const to = ruPhone(phone);
  const url = new URL("https://sms.ru/sms/send");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("to", to);
  url.searchParams.set("msg", text);
  url.searchParams.set("json", "1");
  if (from) url.searchParams.set("from", String(from).trim());
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  const item = data.sms?.[to] || data.sms?.[Object.keys(data.sms || {})[0]];
  if (data.status === "OK" && (!item || item.status === "OK")) return;
  throw new Error(ruSmsError(item?.status_text || data.status_text || "СМС не отправлено. Проверьте ключ SMS.ru."));
}

async function sendMail(cfg, to, subject, text) {
  const pass = String(cfg.smtpPass || "").replace(/\s/g, "");
  const ports = Number(cfg.smtpPort) === 587 ? [587, 465] : [465, 587];
  let last = null;
  for (const port of ports) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost || "smtp.mail.ru",
        port,
        secure: port === 465,
        auth: { user: cfg.smtpUser, pass },
        connectionTimeout: 12000,
        greetingTimeout: 12000,
      });
      await transporter.sendMail({
        from: `"Alfa Кошелёк ЦР" <${cfg.smtpFrom || cfg.smtpUser}>`,
        to,
        subject,
        text,
      });
      return;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(ruSmtpError(last));
}

const PURPOSE = {
  login: "входа",
  register: "регистрации",
  pay: "платежа",
  reset: "восстановления пароля",
};

async function tryEmail(cfg, email, code, text) {
  if (!cfg.smtpUser || !cfg.smtpPass) {
    throw new Error("Почта для кодов не настроена. Откройте /admin и укажите SMTP (Mail.ru / Яндекс / Gmail).");
  }
  if (!email) throw new Error("Нет адреса почты для кода");
  await sendMail(cfg, email, `Код ${code} — Alfa Кошелёк ЦР`, text);
  return { via: "email", masked: maskEmail(email) };
}

export async function deliver({ channel, phone, email, code, purpose }) {
  const cfg = loadNotify();
  const label = PURPOSE[purpose] || "подтверждения";
  const smsText = `Kod Alfa CR ${code}`;
  const mailText = `Код ${label} Alfa Кошелёк ЦР: ${code}. Никому не говорите этот код. Срок 10 минут.`;

  if (channel === "email") {
    return tryEmail(cfg, email, code, mailText);
  }

  let smsErr = "";
  if (cfg.smsruApiId && phone) {
    try {
      await sendSms(cfg.smsruApiId, phone, smsText, cfg.smsFrom);
      return { via: "sms", masked: maskPhone(phone) };
    } catch (e) {
      smsErr = ruSmsError(e);
    }
  } else if (!cfg.smsruApiId) {
    smsErr = "СМС не настроено (нужен API ID SMS.ru в /admin).";
  } else {
    smsErr = "Нет номера телефона для кода.";
  }

  if (cfg.smtpUser && cfg.smtpPass && email) {
    try {
      const mail = await tryEmail(cfg, email, code, mailText);
      return { ...mail, fallback: true };
    } catch (e) {
      const mailErr = e instanceof Error ? e.message : String(e);
      throw new Error(smsErr + " Почта тоже недоступна: " + mailErr);
    }
  }

  throw new Error(smsErr);
}
