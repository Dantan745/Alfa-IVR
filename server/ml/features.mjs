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

export function isSystemPayee(payee) {
  const s = payeeKey(payee);
  return !s || /альфа|банк|qr|касс|пополнен|админ|антифрод|служебн|карт/.test(s);
}

export function clampRisk01(v) {
  const n = Number(v) || 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1.5) return Math.min(1, n / 100);
  return Math.min(1, n);
}

export function isNightHour(hour) {
  const h = Number(hour);
  return h >= 23 || h < 6 ? 1 : 0;
}

export function buildFraudSample(store, { email, amount, payee, now = Date.now(), loginAttempts = 1, newDevice = 0, excludeId = "", type = "" }) {
  const abs = Math.abs(Number(amount) || 0);
  const txs = (store.txs || [])
    .filter((t) => t.email === email && t.id !== excludeId && (t.createdAt || 0) <= now)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const outs = txs.filter((t) => t.amount < 0);
  const avg = meanAbs(outs.map((t) => Math.abs(t.amount))) || abs || 1;
  const hour = new Date(now).getHours();
  const known = new Set(outs.map((t) => payeeKey(t.counterparty || t.name)));
  const last = txs.length ? txs[txs.length - 1] : null;
  const person = type !== "income" && payee && !isSystemPayee(payee);
  const sample = {
    amount: abs,
    amount_to_avg_ratio: Number((abs / avg).toFixed(6)),
    hour,
    is_night: isNightHour(hour),
    is_new_payee: person && !known.has(payeeKey(payee)) ? 1 : 0,
    login_attempts: Math.max(1, Number(loginAttempts) || 1),
    time_since_last_transaction: last ? Math.max(0, (now - last.createdAt) / 1000) : 0,
    new_device: newDevice ? 1 : 0,
    is_new_device: newDevice ? 1 : 0,
    type: type || (Number(amount) > 0 ? "income" : "expense"),
  };
  return sample;
}

export function assessRisk(row, modelAnomaly, finalRaw) {
  const model = clampRisk01(finalRaw);
  const abs = Math.abs(Number(row.amount ?? row.signedAmount) || 0);
  const income = row.type === "income" || Number(row.signedAmount) > 0;
  const flags = [];
  if (!income && row.is_night) flags.push("ночь 23:00–06:00");
  if (!income && row.is_new_payee) flags.push("новый получатель");
  if (!income && (row.new_device || row.is_new_device)) flags.push("новое устройство");
  if (!income && row.amount_to_avg_ratio >= 5 && abs >= 5000) flags.push("сумма выше среднего чека");
  if (row.login_attempts >= 4) flags.push("много попыток входа");
  if (abs >= 100000) flags.push(income ? "крупное пополнение" : "очень крупная сумма");
  if (abs >= 1e12) flags.push("нереалистичная сумма");

  const explain = [];
  let pts = 8;
  explain.push("базовые 8 баллов");
  if (model > 0.05) {
    const add = Math.round(model * 26);
    pts += add;
    explain.push(`модель коллеги +${add}`);
  }
  if (!income && row.is_new_payee) {
    let add = 0;
    if (abs >= 50000) add = 38;
    else if (abs >= 30000) add = 28;
    else if (abs >= 10000) add = 16;
    else if (abs >= 3000) add = 10;
    else if (abs >= 500) add = 5;
    if (add) {
      pts += add;
      explain.push(`новый получатель +${add}`);
    }
  }
  if (!income && (row.new_device || row.is_new_device) && abs >= 3000) {
    pts += 10;
    explain.push("новое устройство +10");
  }
  if (!income && row.is_night && abs >= 5000) {
    pts += 8;
    explain.push("ночь +8");
  }
  if (!income && row.amount_to_avg_ratio >= 5 && abs >= 5000) {
    pts += 8;
    explain.push(`сумма ×${Number(row.amount_to_avg_ratio).toFixed(1)} к среднему чеку +8`);
  }
  if (row.login_attempts >= 4 && abs >= 3000) {
    pts += 8;
    explain.push("много попыток входа +8");
  }
  if (abs >= 1e12) {
    pts += 50;
    explain.push("нереалистичная сумма +50");
  } else if (abs >= 100000) {
    const add = income ? 30 : 34;
    pts += add;
    explain.push(`сумма ${abs.toLocaleString("ru-RU")} ₽ +${add}`);
  } else if (!income && abs >= 50000) {
    pts += 14;
    explain.push("крупное списание +14");
  }
  if (income && abs < 30000) {
    pts = Math.min(pts, 28);
    explain.push("обычное пополнение, потолок 28");
  }
  if (modelAnomaly && !income && abs >= 20000) {
    pts += 6;
    explain.push("аномалия модели +6");
  }

  let score = Math.max(1, Math.min(100, Math.round(pts)));
  let level = "ok";
  let label = "Норма";
  if (score >= 75 || abs >= 1e12 || abs >= 100000 || (!income && row.is_new_payee && abs >= 30000)) {
    level = "fraud";
    label = "Мошенник";
    score = Math.max(score, 80);
  } else if (score >= 35 || flags.length) {
    level = "watch";
    label = "Терпимо";
  }
  if (level === "ok" && flags.length === 0) explain.push("типичная операция, без признаков мошенничества");
  return { score, level, label, flags, model, explain };
}

export function extractFraudRows(store) {
  const users = store.users || {};
  return (store.txs || [])
    .slice()
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
        type: t.type,
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
        riskScore: t.riskScore,
        riskLabel: t.riskLabel,
        riskExplain: t.riskExplain,
        riskLevel: t.riskLevel,
        ...sample,
      };
    });
}
