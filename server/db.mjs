import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword } from "./passwords.mjs";
import { formatRuPhone, isRuMobile, ruMobileDigits } from "./phone.mjs";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");
const NOTIFY_FILE = path.join(DATA_DIR, "notify.json");

pg.types.setTypeParser(20, (value) => (value == null ? null : Number(value)));
pg.types.setTypeParser(1700, (value) => (value == null ? null : Math.round(Number(value) * 100) / 100));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_user (
  email               text PRIMARY KEY,
  phone               text NOT NULL,
  phone_key           text GENERATED ALWAYS AS (right(regexp_replace(phone, '\\D', '', 'g'), 10)) STORED,
  wallet_id           text NOT NULL UNIQUE,
  password_hash       text NOT NULL,
  last_name           text NOT NULL DEFAULT '',
  first_name          text NOT NULL DEFAULT '',
  middle_name         text NOT NULL DEFAULT '',
  passport            text NOT NULL DEFAULT '',
  otp_channel         text NOT NULL DEFAULT 'sms' CHECK (otp_channel IN ('sms', 'email')),
  login_attempts      integer NOT NULL DEFAULT 1 CHECK (login_attempts >= 1),
  last_login_attempts integer NOT NULL DEFAULT 1 CHECK (last_login_attempts >= 1),
  frozen              boolean NOT NULL DEFAULT false,
  freeze_reason       text NOT NULL DEFAULT '',
  frozen_at           bigint,
  frozen_by           text NOT NULL DEFAULT '',
  frozen_tx_id        text,
  locked_until        bigint,
  created_at          bigint NOT NULL
);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS locked_until bigint;
DROP INDEX IF EXISTS app_user_phone_key_idx;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_phone_key_idx ON app_user (phone_key) WHERE phone_key <> '';

CREATE TABLE IF NOT EXISTS user_device (
  email     text NOT NULL REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  device_id text NOT NULL,
  PRIMARY KEY (email, device_id)
);

CREATE TABLE IF NOT EXISTS wallet (
  email         text PRIMARY KEY REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  balance       numeric(14,2) NOT NULL DEFAULT 0,
  biometric     boolean NOT NULL DEFAULT false,
  pin           text NOT NULL DEFAULT '',
  hide_balance  boolean NOT NULL DEFAULT false,
  limit_op      numeric(14,2) NOT NULL DEFAULT 30000,
  limit_day     numeric(14,2) NOT NULL DEFAULT 50000,
  limit_month   numeric(14,2) NOT NULL DEFAULT 100000,
  limit_abroad  numeric(14,2) NOT NULL DEFAULT 10000,
  alert_op      smallint NOT NULL DEFAULT 90,
  alert_day     smallint NOT NULL DEFAULT 80,
  alert_month   smallint NOT NULL DEFAULT 70,
  alert_abroad  smallint NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS savings (
  id     text PRIMARY KEY,
  email  text NOT NULL REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  name   text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS savings_email_idx ON savings (email);

CREATE TABLE IF NOT EXISTS session (
  token           text PRIMARY KEY,
  email           text NOT NULL REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  expires_at      bigint NOT NULL,
  device_id       text NOT NULL DEFAULT '',
  new_device      boolean NOT NULL DEFAULT false,
  login_attempts  integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS session_email_idx ON session (email);

CREATE TABLE IF NOT EXISTS otp_code (
  purpose      text NOT NULL CHECK (purpose IN ('login', 'register', 'pay', 'reset')),
  email        text NOT NULL,
  code         text NOT NULL,
  channel      text NOT NULL,
  destination  text NOT NULL DEFAULT '',
  sent_at      bigint NOT NULL,
  expires_at   bigint NOT NULL,
  bypass       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (purpose, email)
);
ALTER TABLE otp_code DROP CONSTRAINT IF EXISTS otp_code_email_fkey;
CREATE INDEX IF NOT EXISTS otp_email_idx ON otp_code (email);

CREATE TABLE IF NOT EXISTS tx (
  id             text PRIMARY KEY,
  email          text NOT NULL REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  linked_tx_id   text,
  amount         numeric(14,2) NOT NULL,
  tx_type        text NOT NULL CHECK (tx_type IN ('income', 'expense')),
  status         text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'held', 'rejected')),
  name           text NOT NULL DEFAULT '',
  icon           text NOT NULL DEFAULT '',
  category       text NOT NULL DEFAULT '',
  comment        text NOT NULL DEFAULT '',
  counterparty   text NOT NULL DEFAULT '',
  hold_query     text NOT NULL DEFAULT '',
  balance_after  numeric(14,2) NOT NULL,
  created_at     bigint NOT NULL,
  freeze_reason  text NOT NULL DEFAULT '',
  held_at        bigint,
  held_by        text NOT NULL DEFAULT '',
  reviewed_at    bigint,
  reviewed_by    text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS tx_email_time_idx ON tx (email, created_at DESC);
DO $$ BEGIN
  ALTER TABLE tx ADD CONSTRAINT tx_linked_fk FOREIGN KEY (linked_tx_id) REFERENCES tx (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE app_user ADD CONSTRAINT app_user_frozen_tx_fk FOREIGN KEY (frozen_tx_id) REFERENCES tx (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tx_mark (
  tx_id       text PRIMARY KEY REFERENCES tx (id) ON DELETE CASCADE,
  anomaly     smallint CHECK (anomaly IN (0, 1)),
  final_score numeric(12,4),
  features    jsonb
);

CREATE TABLE IF NOT EXISTS note (
  id          text PRIMARY KEY,
  email       text NOT NULL REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  tx_id       text REFERENCES tx (id) ON DELETE SET NULL,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  kind        text NOT NULL DEFAULT 'transfer',
  created_at  bigint NOT NULL,
  read        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS note_email_time_idx ON note (email, created_at DESC);

CREATE TABLE IF NOT EXISTS contact (
  id            text PRIMARY KEY,
  owner_email   text NOT NULL REFERENCES app_user (email) ON DELETE CASCADE ON UPDATE CASCADE,
  name          text NOT NULL,
  phone         text NOT NULL,
  shown_wallet  text NOT NULL DEFAULT '',
  initials      text NOT NULL DEFAULT '',
  color         text NOT NULL DEFAULT '',
  favorite      boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS contact_owner_idx ON contact (owner_email);

CREATE TABLE IF NOT EXISTS audit_log (
  id          text PRIMARY KEY,
  action      text NOT NULL,
  created_at  bigint NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS notify_settings (
  id           smallint PRIMARY KEY CHECK (id = 1),
  smsru_api_id text NOT NULL DEFAULT '',
  sms_from     text NOT NULL DEFAULT '',
  smtp_host    text NOT NULL DEFAULT 'smtp.mail.ru',
  smtp_port    integer NOT NULL DEFAULT 465,
  smtp_user    text NOT NULL DEFAULT '',
  smtp_pass    text NOT NULL DEFAULT '',
  smtp_from    text NOT NULL DEFAULT ''
);
`;

const userSql = `
  SELECT u.*,
         COALESCE(array_agg(d.device_id) FILTER (WHERE d.device_id IS NOT NULL), '{}') AS devices
  FROM app_user u
  LEFT JOIN user_device d ON d.email = u.email
`;

const txSql = `
  SELECT t.*, m.anomaly AS ml_anomaly, m.final_score AS ml_score, m.features AS ml_features
  FROM tx t
  LEFT JOIN tx_mark m ON m.tx_id = t.id
`;

let pool;
const als = new AsyncLocalStorage();

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production") throw new Error("Задайте DATABASE_URL для PostgreSQL");
  return "postgresql://alfa:alfa@127.0.0.1:5432/alfa";
}

function client() {
  return als.getStore() || pool;
}

export function query(text, params = []) {
  return client().query(text, params);
}

export function withTx(fn) {
  if (als.getStore()) return fn();
  return pool.connect().then(async (conn) => {
    try {
      await conn.query("BEGIN");
      const result = await als.run(conn, fn);
      await conn.query("COMMIT");
      return result;
    } catch (err) {
      try { await conn.query("ROLLBACK"); } catch { /* already closed */ }
      throw err;
    } finally {
      conn.release();
    }
  });
}

function mapUser(row) {
  if (!row) return null;
  return {
    email: row.email,
    passwordHash: row.password_hash,
    lastName: row.last_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    phone: row.phone,
    passport: row.passport,
    walletId: row.wallet_id,
    createdAt: Number(row.created_at),
    otpChannel: row.otp_channel,
    loginAttempts: row.login_attempts,
    lastLoginAttempts: row.last_login_attempts,
    frozen: row.frozen,
    freezeReason: row.freeze_reason,
    frozenAt: row.frozen_at == null ? undefined : Number(row.frozen_at),
    frozenBy: row.frozen_by,
    frozenTxId: row.frozen_tx_id || "",
    lockedUntil: row.locked_until == null ? 0 : Number(row.locked_until),
    devices: row.devices || [],
  };
}

function mapWallet(row, savings) {
  if (!row) return null;
  return {
    email: row.email,
    balance: Number(row.balance),
    biometric: row.biometric,
    pin: row.pin,
    hideBalance: row.hide_balance,
    savings: savings || [],
    limits: {
      op: Number(row.limit_op),
      day: Number(row.limit_day),
      month: Number(row.limit_month),
      abroad: Number(row.limit_abroad),
      alertOp: row.alert_op,
      alertDay: row.alert_day,
      alertMonth: row.alert_month,
      alertAbroad: row.alert_abroad,
    },
  };
}

function mapTx(row) {
  if (!row) return null;
  const features = row.ml_features && typeof row.ml_features === "object" ? row.ml_features : null;
  return {
    id: row.id,
    email: row.email,
    linkedTxId: row.linked_tx_id || "",
    amount: Number(row.amount),
    type: row.tx_type,
    status: row.status,
    name: row.name,
    icon: row.icon,
    category: row.category,
    comment: row.comment || "",
    counterparty: row.counterparty || "",
    holdQuery: row.hold_query || "",
    balanceAfter: Number(row.balance_after),
    createdAt: Number(row.created_at),
    freezeReason: row.freeze_reason || "",
    heldAt: row.held_at == null ? undefined : Number(row.held_at),
    heldBy: row.held_by || "",
    reviewedAt: row.reviewed_at == null ? undefined : Number(row.reviewed_at),
    reviewedBy: row.reviewed_by || "",
    mlAnomaly: row.ml_anomaly == null ? null : Number(row.ml_anomaly),
    mlScore: row.ml_score == null ? null : Number(row.ml_score),
    mlFeatures: features,
  };
}

function mapNote(row) {
  return {
    id: row.id,
    email: row.email,
    txId: row.tx_id || undefined,
    title: row.title,
    body: row.body,
    kind: row.kind,
    createdAt: Number(row.created_at),
    read: row.read,
  };
}

function mapContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.owner_email,
    name: row.name,
    phone: row.phone,
    wallet: row.shown_wallet,
    initials: row.initials,
    color: row.color,
    favorite: row.favorite,
  };
}

async function savingsOf(email) {
  const r = await query("SELECT id, name, amount FROM savings WHERE email = $1 ORDER BY id", [email]);
  return r.rows.map((row) => ({ id: row.id, name: row.name, amount: Number(row.amount) }));
}

export async function getUser(email) {
  const r = await query(`${userSql} WHERE u.email = $1 GROUP BY u.email`, [String(email || "").toLowerCase()]);
  return mapUser(r.rows[0]);
}

export async function findUserByLogin(login) {
  const raw = String(login || "").trim();
  if (!raw) return null;
  const byEmail = await getUser(raw.toLowerCase());
  if (byEmail) return byEmail;
  const digits = ruMobileDigits(raw);
  if (digits.length < 10) return null;
  const r = await query(`${userSql} WHERE u.phone_key = $1 GROUP BY u.email LIMIT 1`, [digits.slice(-10)]);
  return mapUser(r.rows[0]);
}

export async function findPayee(queryText, fromEmail) {
  const q = String(queryText || "").trim();
  if (!q) return null;
  const digits = q.replace(/\D/g, "");
  const phoneKey = digits.length >= 10 ? digits.slice(-10) : "";
  const r = await query(
    `${userSql}
     WHERE u.email <> $1
       AND (
         u.email = $2
         OR lower(u.wallet_id) = $2
         OR ($3 <> '' AND u.phone_key = $3)
         OR lower(u.last_name) = $2
         OR lower(u.last_name || ' ' || u.first_name || ' ' || u.middle_name) LIKE $4
       )
     GROUP BY u.email
     LIMIT 1`,
    [fromEmail, q.toLowerCase(), phoneKey, `%${q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`],
  );
  return mapUser(r.rows[0]);
}

export async function phoneTaken(phone, exceptEmail) {
  const digits = ruMobileDigits(phone);
  if (digits.length < 10) return false;
  const r = await query(
    "SELECT 1 FROM app_user WHERE phone_key = $1 AND email <> $2 LIMIT 1",
    [digits.slice(-10), String(exceptEmail || "").toLowerCase()],
  );
  return r.rowCount > 0;
}

export async function insertUser(user) {
  await query(
    `INSERT INTO app_user (
      email, phone, wallet_id, password_hash, last_name, first_name, middle_name, passport,
      otp_channel, login_attempts, last_login_attempts, frozen, freeze_reason, frozen_at, frozen_by, frozen_tx_id, locked_until, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      user.email, user.phone, user.walletId, user.passwordHash,
      user.lastName || "", user.firstName || "", user.middleName || "", user.passport || "",
      user.otpChannel === "email" ? "email" : "sms",
      user.loginAttempts || 1, user.lastLoginAttempts || 1,
      Boolean(user.frozen), user.freezeReason || "", user.frozenAt || null, user.frozenBy || "",
      user.frozenTxId || null, user.lockedUntil || null, user.createdAt || Date.now(),
    ],
  );
  for (const deviceId of user.devices || []) {
    if (deviceId) await query("INSERT INTO user_device (email, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.email, deviceId]);
  }
}

export async function saveUser(user) {
  await query(
    `UPDATE app_user SET
      phone = $2, password_hash = $3, last_name = $4, first_name = $5, middle_name = $6, passport = $7,
      otp_channel = $8, login_attempts = $9, last_login_attempts = $10, frozen = $11, freeze_reason = $12,
      frozen_at = $13, frozen_by = $14, frozen_tx_id = $15, locked_until = $16
     WHERE email = $1`,
    [
      user.email, user.phone, user.passwordHash, user.lastName || "", user.firstName || "", user.middleName || "",
      user.passport || "", user.otpChannel === "email" ? "email" : "sms",
      Math.max(1, Number(user.loginAttempts) || 1), Math.max(1, Number(user.lastLoginAttempts) || 1),
      Boolean(user.frozen), user.freezeReason || "", user.frozenAt || null, user.frozenBy || "", user.frozenTxId || null, user.lockedUntil || null,
    ],
  );
  if (Array.isArray(user.devices)) {
    await query("DELETE FROM user_device WHERE email = $1", [user.email]);
    for (const deviceId of user.devices) {
      if (deviceId) await query("INSERT INTO user_device (email, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.email, deviceId]);
    }
  }
}

export async function renameUser(from, to) {
  await query("UPDATE otp_code SET email = $2 WHERE email = $1", [from, to]);
  await query("UPDATE app_user SET email = $2 WHERE email = $1", [from, to]);
}

export async function deleteUser(email) {
  await query("DELETE FROM otp_code WHERE email = $1", [email]);
  await query("DELETE FROM app_user WHERE email = $1", [email]);
}

export async function getWallet(email) {
  const r = await query("SELECT * FROM wallet WHERE email = $1", [email]);
  if (!r.rows[0]) return null;
  return mapWallet(r.rows[0], await savingsOf(email));
}

export async function lockWallet(email) {
  const r = await query("SELECT * FROM wallet WHERE email = $1 FOR UPDATE", [email]);
  if (!r.rows[0]) return null;
  return mapWallet(r.rows[0], await savingsOf(email));
}

function money(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n * 100) / 100;
  if (rounded > 999999999999.99) return 999999999999.99;
  if (rounded < -999999999999.99) return -999999999999.99;
  return rounded;
}

function percent(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

export async function insertWallet(wallet) {
  const limits = wallet.limits || {};
  await query(
    `INSERT INTO wallet (
      email, balance, biometric, pin, hide_balance,
      limit_op, limit_day, limit_month, limit_abroad, alert_op, alert_day, alert_month, alert_abroad
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      wallet.email, money(wallet.balance, 0), Boolean(wallet.biometric), String(wallet.pin || ""), Boolean(wallet.hideBalance),
      money(limits.op, 30000), money(limits.day, 50000), money(limits.month, 100000), money(limits.abroad, 10000),
      percent(limits.alertOp, 90), percent(limits.alertDay, 80), percent(limits.alertMonth, 70), percent(limits.alertAbroad, 100),
    ],
  );
  for (const box of wallet.savings || []) {
    await query("INSERT INTO savings (id, email, name, amount) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [box.id, wallet.email, box.name, money(box.amount, 0)]);
  }
}

export async function saveWallet(wallet) {
  const limits = wallet.limits || {};
  await query(
    `UPDATE wallet SET
      balance = $2, biometric = $3, pin = $4, hide_balance = $5,
      limit_op = $6, limit_day = $7, limit_month = $8, limit_abroad = $9,
      alert_op = $10, alert_day = $11, alert_month = $12, alert_abroad = $13
     WHERE email = $1`,
    [
      wallet.email, money(wallet.balance, 0), Boolean(wallet.biometric), String(wallet.pin || ""), Boolean(wallet.hideBalance),
      money(limits.op, 30000), money(limits.day, 50000), money(limits.month, 100000), money(limits.abroad, 10000),
      percent(limits.alertOp, 90), percent(limits.alertDay, 80), percent(limits.alertMonth, 70), percent(limits.alertAbroad, 100),
    ],
  );
}

export async function spentSince(email, fromTs, transfersOnly) {
  const r = await query(
    `SELECT COALESCE(SUM(ABS(amount)), 0) AS spent
     FROM tx
     WHERE email = $1 AND amount < 0 AND created_at >= $2
       AND ($3::boolean = false OR category = 'Переводы' OR icon IN ('qr_code', 'upload_file'))`,
    [email, fromTs, Boolean(transfersOnly)],
  );
  return Number(r.rows[0].spent);
}

async function writeMark(tx) {
  const marked = tx.mlAnomaly === 0 || tx.mlAnomaly === 1 || tx.mlScore != null || tx.mlFeatures;
  if (!marked) return;
  await query(
    `INSERT INTO tx_mark (tx_id, anomaly, final_score, features)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tx_id) DO UPDATE SET anomaly = EXCLUDED.anomaly, final_score = EXCLUDED.final_score, features = EXCLUDED.features`,
    [tx.id, tx.mlAnomaly == null ? null : Number(tx.mlAnomaly), tx.mlScore == null ? null : Number(tx.mlScore), tx.mlFeatures || null],
  );
}

export async function insertTx(tx) {
  await query(
    `INSERT INTO tx (
      id, email, linked_tx_id, amount, tx_type, status, name, icon, category, comment, counterparty,
      hold_query, balance_after, created_at, freeze_reason, held_at, held_by, reviewed_at, reviewed_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      tx.id, tx.email, tx.linkedTxId || null, money(tx.amount, 0), tx.type, tx.status || "done", tx.name || "", tx.icon || "",
      tx.category || "", tx.comment || "", tx.counterparty || "", tx.holdQuery || "", money(tx.balanceAfter, 0), tx.createdAt,
      tx.freezeReason || "", tx.heldAt || null, tx.heldBy || "", tx.reviewedAt || null, tx.reviewedBy || "",
    ],
  );
  await writeMark(tx);
  return tx;
}

export async function saveTx(tx) {
  await query(
    `UPDATE tx SET
      linked_tx_id = $2, status = $3, freeze_reason = $4, held_at = $5, held_by = $6, reviewed_at = $7, reviewed_by = $8, name = $9
     WHERE id = $1`,
    [tx.id, tx.linkedTxId || null, tx.status, tx.freezeReason || "", tx.heldAt || null, tx.heldBy || "", tx.reviewedAt || null, tx.reviewedBy || "", tx.name || ""],
  );
  await writeMark(tx);
}

export async function getTx(id) {
  const r = await query(`${txSql} WHERE t.id = $1`, [id]);
  return mapTx(r.rows[0]);
}

export async function listTxsByEmail(email) {
  const r = await query(`${txSql} WHERE t.email = $1 ORDER BY t.created_at DESC`, [email]);
  return r.rows.map(mapTx);
}

export async function countTxs(email) {
  const r = await query("SELECT count(*)::int AS n FROM tx WHERE email = $1", [email]);
  return r.rows[0].n;
}

export async function adminTxs({ q = "", type = "" } = {}) {
  const where = [];
  const params = [];
  if (type === "in") where.push("t.amount > 0");
  if (type === "out") where.push("t.amount < 0");
  if (type === "held") where.push("t.status = 'held'");
  if (type === "rejected") where.push("t.status = 'rejected'");
  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where.push(`lower(t.email || ' ' || t.name || ' ' || t.counterparty || ' ' || t.category) LIKE $${params.length}`);
  }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = await query(`SELECT count(*)::int AS n FROM tx t ${filter}`, params);
  const rows = await query(`${txSql} ${filter} ORDER BY t.created_at DESC LIMIT 300`, params);
  return { txs: rows.rows.map(mapTx), total: total.rows[0].n };
}

export async function insertNote(note) {
  await query(
    "INSERT INTO note (id, email, tx_id, title, body, kind, created_at, read) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [note.id, note.email, note.txId || null, note.title, note.body || "", note.kind || "transfer", note.createdAt, Boolean(note.read)],
  );
  return note;
}

export async function listNotes(email) {
  const r = await query("SELECT * FROM note WHERE email = $1 ORDER BY created_at DESC", [email]);
  return r.rows.map(mapNote);
}

export async function markNotesRead(email) {
  await query("UPDATE note SET read = true WHERE email = $1", [email]);
}

export async function markNoteRead(email, id) {
  await query("UPDATE note SET read = true WHERE email = $1 AND id = $2", [email, id]);
}

export async function insertContact(contact) {
  await query(
    "INSERT INTO contact (id, owner_email, name, phone, shown_wallet, initials, color, favorite) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [contact.id, contact.email, contact.name, contact.phone, contact.wallet || "", contact.initials || "", contact.color || "", Boolean(contact.favorite)],
  );
}

export async function listContacts(email) {
  const r = await query("SELECT * FROM contact WHERE owner_email = $1 ORDER BY favorite DESC, name", [email]);
  return r.rows.map(mapContact);
}

export async function getContact(email, id) {
  const r = await query("SELECT * FROM contact WHERE owner_email = $1 AND id = $2", [email, id]);
  return mapContact(r.rows[0] || null) || null;
}

export async function deleteContact(email, id) {
  const r = await query("DELETE FROM contact WHERE owner_email = $1 AND id = $2", [email, id]);
  return r.rowCount > 0;
}

export async function setContactFavorite(email, id, favorite) {
  const r = await query("UPDATE contact SET favorite = $3 WHERE owner_email = $1 AND id = $2", [email, id, favorite]);
  return r.rowCount > 0;
}

function sessionKey(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export async function insertSession(token, session) {
  await query(
    "INSERT INTO session (token, email, expires_at, device_id, new_device, login_attempts) VALUES ($1,$2,$3,$4,$5,$6)",
    [sessionKey(token), session.email, session.exp, session.deviceId || "", Boolean(session.newDevice), session.loginAttempts || 1],
  );
}

export async function getSession(token) {
  if (!token) return null;
  const r = await query("SELECT * FROM session WHERE token = $1", [sessionKey(token)]);
  const row = r.rows[0];
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) {
    await query("DELETE FROM session WHERE token = $1", [sessionKey(token)]);
    return null;
  }
  return {
    email: row.email,
    exp: Number(row.expires_at),
    deviceId: row.device_id,
    newDevice: row.new_device ? 1 : 0,
    loginAttempts: row.login_attempts,
  };
}

export async function deleteSession(token) {
  if (token) await query("DELETE FROM session WHERE token = $1", [sessionKey(token)]);
}

export async function deleteUserSessions(email) {
  await query("DELETE FROM session WHERE email = $1", [email]);
}

export async function countSessions(email) {
  const r = await query("SELECT count(*)::int AS n FROM session WHERE email = $1 AND expires_at >= $2", [email, Date.now()]);
  return r.rows[0].n;
}

export async function getCode(purpose, email) {
  const r = await query("SELECT * FROM otp_code WHERE purpose = $1 AND email = $2", [purpose, email]);
  const row = r.rows[0];
  if (!row) return null;
  return { code: row.code, exp: Number(row.expires_at), channel: row.channel, dest: row.destination, sentAt: Number(row.sent_at), purpose: row.purpose, bypass: row.bypass };
}

export async function saveCode(purpose, email, rec) {
  await query(
    `INSERT INTO otp_code (purpose, email, code, channel, destination, sent_at, expires_at, bypass)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (purpose, email) DO UPDATE SET
       code = EXCLUDED.code, channel = EXCLUDED.channel, destination = EXCLUDED.destination,
       sent_at = EXCLUDED.sent_at, expires_at = EXCLUDED.expires_at, bypass = EXCLUDED.bypass`,
    [purpose, email, rec.code, rec.channel, rec.dest || "", rec.sentAt, rec.exp, Boolean(rec.bypass)],
  );
}

export async function deleteCode(purpose, email) {
  await query("DELETE FROM otp_code WHERE purpose = $1 AND email = $2", [purpose, email]);
}

export async function lastCodeFor(email) {
  const r = await query(
    "SELECT code FROM otp_code WHERE email = $1 AND expires_at >= $2 ORDER BY sent_at DESC LIMIT 1",
    [email, Date.now()],
  );
  return r.rows[0]?.code;
}

export async function insertAudit(id, action, detail, at) {
  await query("INSERT INTO audit_log (id, action, created_at, detail) VALUES ($1, $2, $3, $4)", [id, action, at, JSON.stringify(detail || {})]);
  await query("DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log ORDER BY created_at DESC OFFSET 500)");
}

export async function recentAudit(limit = 30) {
  const r = await query("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1", [limit]);
  return r.rows.map((row) => ({ id: row.id, action: row.action, at: Number(row.created_at), detail: row.detail || {} }));
}

export async function overview() {
  const dayAgo = Date.now() - 86400000;
  const weekAgo = Date.now() - 7 * 86400000;
  const r = await query(
    `SELECT
      (SELECT count(*)::int FROM app_user) AS users,
      (SELECT count(*)::int FROM app_user WHERE frozen) AS frozen,
      (SELECT COALESCE(sum(balance), 0) FROM wallet) AS total_balance,
      (SELECT count(*)::int FROM tx) AS tx_count,
      (SELECT COALESCE(sum(abs(amount)), 0) FROM tx WHERE amount < 0) AS volume_out,
      (SELECT COALESCE(sum(amount), 0) FROM tx WHERE amount > 0) AS volume_in,
      (SELECT count(*)::int FROM tx WHERE created_at >= $1) AS tx_today,
      (SELECT count(*)::int FROM app_user WHERE created_at >= $2) AS new_week`,
    [dayAgo, weekAgo],
  );
  const row = r.rows[0];
  return {
    users: row.users,
    frozen: row.frozen,
    totalBalance: Number(row.total_balance),
    txCount: row.tx_count,
    volumeOut: Number(row.volume_out),
    volumeIn: Number(row.volume_in),
    txToday: row.tx_today,
    newWeek: row.new_week,
  };
}

export async function listUsersAdmin() {
  const r = await query(
    `SELECT u.*, w.balance,
            (SELECT count(*)::int FROM tx t WHERE t.email = u.email) AS tx_count,
            COALESCE(array_agg(d.device_id) FILTER (WHERE d.device_id IS NOT NULL), '{}') AS devices
     FROM app_user u
     LEFT JOIN wallet w ON w.email = u.email
     LEFT JOIN user_device d ON d.email = u.email
     GROUP BY u.email, w.balance
     ORDER BY u.created_at DESC`,
  );
  return r.rows.map((row) => ({ ...mapUser(row), balance: Number(row.balance || 0), txCount: row.tx_count }));
}

export async function exportUsers() {
  const rows = await listUsersAdmin();
  return rows;
}

export async function exportTxs() {
  const r = await query(`${txSql} ORDER BY t.created_at DESC`);
  return r.rows.map(mapTx);
}

export async function exportAudit() {
  const r = await query("SELECT * FROM audit_log ORDER BY created_at DESC");
  return r.rows.map((row) => ({ id: row.id, action: row.action, at: Number(row.created_at), detail: row.detail || {} }));
}

export async function loadModelStore() {
  const users = await query(`${userSql} GROUP BY u.email`);
  const wallets = await query("SELECT * FROM wallet");
  const txs = await query(`${txSql} ORDER BY t.created_at`);
  const userMap = {};
  for (const row of users.rows) userMap[row.email] = mapUser(row);
  const walletMap = {};
  for (const row of wallets.rows) walletMap[row.email] = mapWallet(row, []);
  return { users: userMap, wallets: walletMap, txs: txs.rows.map(mapTx) };
}

export async function readNotify() {
  const r = await query("SELECT * FROM notify_settings WHERE id = 1");
  const row = r.rows[0];
  if (!row) return null;
  return {
    smsruApiId: row.smsru_api_id,
    smsFrom: row.sms_from,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpUser: row.smtp_user,
    smtpPass: row.smtp_pass,
    smtpFrom: row.smtp_from,
  };
}

export async function writeNotify(cfg) {
  await query(
    `INSERT INTO notify_settings (id, smsru_api_id, sms_from, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       smsru_api_id = EXCLUDED.smsru_api_id, sms_from = EXCLUDED.sms_from, smtp_host = EXCLUDED.smtp_host,
       smtp_port = EXCLUDED.smtp_port, smtp_user = EXCLUDED.smtp_user, smtp_pass = EXCLUDED.smtp_pass, smtp_from = EXCLUDED.smtp_from`,
    [cfg.smsruApiId || "", cfg.smsFrom || "", cfg.smtpHost || "smtp.mail.ru", Number(cfg.smtpPort) || 465, cfg.smtpUser || "", cfg.smtpPass || "", cfg.smtpFrom || ""],
  );
}

function splitSql(sql) {
  const parts = [];
  let current = "";
  let dollar = null;
  let inSingle = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        current += dollar;
        i += dollar.length - 1;
        dollar = null;
        continue;
      }
      current += c;
      continue;
    }
    if (inSingle) {
      current += c;
      if (c === "'" && sql[i + 1] === "'") {
        current += "'";
        i += 1;
        continue;
      }
      if (c === "'") inSingle = false;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      current += c;
      continue;
    }
    if (c === "$") {
      const tag = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (tag) {
        dollar = tag[0];
        current += dollar;
        i += dollar.length - 1;
        continue;
      }
    }
    if (c === ";") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

async function importJson(raw) {
  const users = Object.values(raw.users || {});
  for (const user of users) {
    const phone = user.phone && isRuMobile(user.phone) ? formatRuPhone(user.phone) : (user.phone || "");
    let passwordHash = user.passwordHash || "";
    if (user.passwordPlain) passwordHash = await hashPassword(user.passwordPlain);
    else if (/^[a-f0-9]{64}$/i.test(passwordHash)) passwordHash = `sha256$${passwordHash.toLowerCase()}`;
    else if (!passwordHash.startsWith("scrypt$")) passwordHash = await hashPassword(user.email === "ivan@alfa.demo" ? "Demo1234" : user.email);
    await insertUser({
      ...user,
      phone,
      passwordHash,
      loginAttempts: user.loginAttempts || 1,
      lastLoginAttempts: user.lastLoginAttempts || 1,
      devices: Array.isArray(user.devices) ? user.devices : [],
      frozenTxId: null,
    });
  }
  for (const wallet of Object.values(raw.wallets || {})) {
    if (!raw.users?.[wallet.email]) continue;
    const pin = wallet.pin && !String(wallet.pin).startsWith("scrypt$") ? await hashPassword(String(wallet.pin)) : (wallet.pin || "");
    await insertWallet({ ...wallet, pin });
  }
  for (const tx of raw.txs || []) {
    if (!raw.users?.[tx.email]) continue;
    await insertTx({ ...tx, linkedTxId: null });
  }
  for (const tx of raw.txs || []) {
    if (tx.linkedTxId) {
      await query(
        "UPDATE tx SET linked_tx_id = $2 WHERE id = $1 AND EXISTS (SELECT 1 FROM tx WHERE id = $2)",
        [tx.id, tx.linkedTxId],
      );
    }
  }
  for (const user of users) {
    if (user.frozenTxId) {
      await query(
        "UPDATE app_user SET frozen_tx_id = $2 WHERE email = $1 AND EXISTS (SELECT 1 FROM tx WHERE id = $2)",
        [user.email, user.frozenTxId],
      );
    }
  }
  for (const note of raw.notes || []) {
    if (!raw.users?.[note.email]) continue;
    if (note.id === "n1") continue;
    await insertNote(note);
  }
  for (const contact of raw.contacts || []) {
    if (!raw.users?.[contact.email] || ["c1", "c2", "c3", "c4"].includes(contact.id)) continue;
    await insertContact(contact);
  }
  for (const [token, session] of Object.entries(raw.sessions || {})) {
    if (!raw.users?.[session.email]) continue;
    await insertSession(token, session);
  }
  for (const [key, rec] of Object.entries(raw.codes || {})) {
    const split = String(key).indexOf(":");
    if (split < 1) continue;
    const purpose = key.slice(0, split);
    const email = key.slice(split + 1);
    if (!["login", "register", "pay", "reset"].includes(purpose) || !raw.users?.[email]) continue;
    await saveCode(purpose, email, rec);
  }
  for (const row of raw.audit || []) {
    await insertAudit(row.id, row.action, row.detail || {}, row.at || Date.now());
  }
}

function offset(days, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

async function seedDemo() {
  const exists = await getUser("ivan@alfa.demo");
  if (exists) return;
  const email = "ivan@alfa.demo";
  await insertUser({
    email,
    passwordHash: await hashPassword("Demo1234"),
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
    phone: "+7 (900) 123-45-67",
    passport: "4510 123456",
    walletId: "WLT-00123456-ЦР",
    createdAt: Date.now() - 86400000 * 40,
    otpChannel: "sms",
    loginAttempts: 1,
    lastLoginAttempts: 1,
    devices: [],
  });
  await insertWallet({
    email,
    balance: 5000,
    biometric: false,
    pin: await hashPassword("1234"),
    hideBalance: false,
    savings: [
      { id: "s1", name: "Копилка 1", amount: 200 },
      { id: "s2", name: "Копилка 2", amount: 100 },
    ],
    limits: { day: 50000, month: 100000, op: 30000, abroad: 10000, alertDay: 80, alertMonth: 70, alertOp: 90, alertAbroad: 100 },
  });
  const seedTx = [
    { id: "t1", name: "Кофейня «Прим»", amount: -320, type: "expense", icon: "local_cafe", category: "Кафе", createdAt: offset(0, 9, 41), comment: "Капучино", counterparty: "ООО Прим" },
    { id: "t2", name: "Петров А.С.", amount: 5000, type: "income", icon: "person", category: "Переводы", createdAt: offset(1, 18, 22), comment: "Возврат", counterparty: "+7 (900) 123-45-67" },
    { id: "t3", name: "Пятёрочка", amount: -1240, type: "expense", icon: "shopping_cart", category: "Продукты", createdAt: offset(1, 14, 5), comment: "", counterparty: "X5 Group" },
    { id: "t4", name: "Зарплата", amount: 65000, type: "income", icon: "work", category: "Доходы", createdAt: offset(3, 9, 0), comment: "Аванс", counterparty: "ООО Альфа" },
    { id: "t5", name: "Яндекс.Такси", amount: -480, type: "expense", icon: "directions_car", category: "Транспорт", createdAt: offset(4, 22, 30), comment: "", counterparty: "Яндекс Go" },
    { id: "t6", name: "Аптека 36,6", amount: -890, type: "expense", icon: "local_pharmacy", category: "Здоровье", createdAt: offset(5, 16, 10), comment: "", counterparty: "36,6" },
    { id: "t7", name: "Смирнова О.В.", amount: 2500, type: "income", icon: "person", category: "Переводы", createdAt: offset(6, 11, 0), comment: "", counterparty: "+7 (915) 234-56-78" },
    { id: "t8", name: "Связной", amount: -3200, type: "expense", icon: "phone_android", category: "Электроника", createdAt: offset(7, 15, 30), comment: "", counterparty: "Связной" },
    { id: "t9", name: "Оплата QR", amount: -150, type: "expense", icon: "qr_code", category: "Прочее", createdAt: offset(8, 12, 0), comment: "", counterparty: "QR-касса" },
    { id: "t10", name: "Возврат", amount: 750, type: "income", icon: "undo", category: "Переводы", createdAt: offset(9, 10, 0), comment: "", counterparty: "Маркет" },
  ];
  let running = 5000;
  for (const row of [...seedTx].sort((a, b) => b.createdAt - a.createdAt)) {
    const balanceAfter = Math.max(0, running);
    await insertTx({ ...row, email, status: "done", balanceAfter });
    running -= row.amount;
  }
  await insertNote({ id: "n2", email, title: "Перевод получен", body: "Петров А.С. отправил вам 5 000 ₽", kind: "transfer", createdAt: offset(1, 18, 22), read: false, txId: "t2" });
  await insertNote({ id: "n3", email, title: "Вход в кошелёк", body: "Успешная авторизация с этого устройства", kind: "security", createdAt: offset(0, 8, 0), read: true });
}

export async function initDb() {
  pool = new Pool({ connectionString: databaseUrl(), max: 10 });
  for (const statement of splitSql(SCHEMA)) await pool.query(statement);
  const count = await pool.query("SELECT count(*)::int AS n FROM app_user");
  if (count.rows[0].n === 0) {
    const raw = readJson(DATA_FILE);
    try {
      await withTx(async () => {
        if (raw && raw.users && Object.keys(raw.users).length) await importJson(raw);
        await seedDemo();
      });
    } catch (err) {
      console.error("Перенос data.json не удался:", err.message);
      const again = await pool.query("SELECT count(*)::int AS n FROM app_user");
      if (again.rows[0].n === 0) await withTx(() => seedDemo());
    }
  }
  const notify = await readNotify();
  if (!notify) {
    const file = readJson(NOTIFY_FILE);
    if (file) await writeNotify(file);
  }
}

export function notifyFileHint() {
  return readJson(NOTIFY_FILE);
}
