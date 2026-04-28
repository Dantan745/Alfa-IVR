/** Фичи, используемые для обучения модели антифрода. Не меняет anti_fraud_infer.py. */

export const FRAUD_FEATURES = [
  { name: "amount", title: "amount", desc: "абсолютная сумма операции" },
  { name: "amount_to_avg_ratio", title: "amount_to_avg_ratio", desc: "во сколько раз операция превышает средний чек пользователя" },
  { name: "hour", title: "hour", desc: "час суток (0–23)" },
  { name: "is_night", title: "is_night", desc: "бинарный флаг ночной операции (с 23:00 до 06:00)" },
  { name: "is_new_payee", title: "is_new_payee", desc: "флаг первого перевода новому получателю (0 или 1)" },
  { name: "login_attempts", title: "login_attempts", desc: "количество попыток входа (от 1 и выше)" },
  { name: "time_since_last_transaction", title: "time_since_last_transaction", desc: "время после последней транзакции пользователя (секунды)" },
  { name: "new_device", title: "new_device", desc: "сопоставляет id девайса и id аккаунта: была ли раньше такая пара (1 = новый девайс)" },
];

function meanAbs(amounts) {
  if (!amounts.length) return 0;
  return amounts.reduce((s, x) => s + x, 0) / amounts.length;
}

function payeeKey(v) {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function isNightHour(hour) {
  const h = Number(hour);
  return h >= 23 || h < 6 ? 1 : 0;
}

export function buildFraudSample(store, { email, amount, payee, now = Date.now(), loginAttempts = 1, newDevice = 0, excludeId = "" }) {
  const abs = Math.abs(Number(amount) || 0);
  const txs = (store.txs || [])
    .filter((t) => t.email === email && t.id !== excludeId && (t.createdAt || 0) <= now)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const outs = txs.filter((t) => t.amount < 0);
  const avg = meanAbs(outs.map((t) => Math.abs(t.amount))) || abs || 1;
  const hour = new Date(now).getHours();
  const known = new Set(outs.map((t) => payeeKey(t.counterparty || t.name)));
  const last = txs.length ? txs[txs.length - 1] : null;
  const sample = {
    amount: abs,
    amount_to_avg_ratio: Number((abs / avg).toFixed(6)),
    hour,
    is_night: isNightHour(hour),
    is_new_payee: payee && !known.has(payeeKey(payee)) ? 1 : 0,
    login_attempts: Math.max(1, Number(loginAttempts) || 1),
    time_since_last_transaction: last ? Math.max(0, (now - last.createdAt) / 1000) : 0,
    new_device: newDevice ? 1 : 0,
    is_new_device: newDevice ? 1 : 0,
  };
  return sample;
}

export function extractFraudRows(store) {
  const users = store.users || {};
  return (store.txs || [])
    .filter((t) => t.amount < 0 || Math.abs(t.amount) >= 10000)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 120)
    .map((t) => {
      const u = users[t.email] || {};
      const sample = buildFraudSample(store, {
        email: t.email,
        amount: t.amount,
        payee: t.counterparty || t.name,
        now: t.createdAt,
        loginAttempts: u.lastLoginAttempts || u.loginAttempts || 1,
        newDevice: t.mlFeatures?.new_device || t.mlFeatures?.is_new_device || 0,
        excludeId: t.id,
      });
      return {
        id: t.id,
        email: t.email,
        createdAt: t.createdAt,
        counterparty: t.counterparty || t.name || "",
        signedAmount: t.amount,
        type: t.type,
        savedScore: t.mlScore,
        savedAnomaly: t.mlAnomaly,
        ...sample,
      };
    });
}
