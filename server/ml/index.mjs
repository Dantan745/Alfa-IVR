/**
 * Аналитика и прогнозы.
 *
 * Сейчас работает baseline (скользящее среднее + линейный тренд + z-score).
 * Коллега: замените `runCustomModel` на свою модель (sklearn / ONNX / TensorFlow).
 * Если `runCustomModel` возвращает объект — он подмешивается в отчёт.
 *
 * Вход extractFeatures(store):
 *   daily[]     — ряды по дням: usersNew, volumeOut, volumeIn, txCount, avgCheck
 *   users[]     — признаки по клиенту: баланс, оборот, частота, уникальные получатели
 *   txs[]       — плоский журнал для обучения
 *
 * Выход buildReport(store):
 *   baseline    — эвристики
 *   custom      — результат runCustomModel или null
 *   forecast    — прогноз оборота на N дней
 *   anomalies   — подозрительные операции
 *   riskUsers   — клиенты с повышенным риском
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFraudRows, FRAUD_FEATURES } from "./features.mjs";

const DAY = 86400000;
const ML_DIR = path.dirname(fileURLToPath(import.meta.url));

let cachedPy;
function pythonBin() {
  if (cachedPy !== undefined) return cachedPy;
  cachedPy = null;
  for (const cmd of [process.env.PYTHON, "python", "py", "python3"].filter(Boolean)) {
    const probe = spawnSync(cmd, ["-c", "import joblib, numpy, sklearn"], { encoding: "utf8", timeout: 15000 });
    if (probe.status === 0) {
      cachedPy = cmd;
      break;
    }
  }
  return cachedPy;
}

export function scoreWithFriendModel(samples) {
  const list = Array.isArray(samples) ? samples : [samples];
  if (!list.length) return [];
  const bin = pythonBin();
  if (!bin) return list.map(() => null);
  const run = spawnSync(bin, [path.join(ML_DIR, "score.py")], {
    input: JSON.stringify(list),
    encoding: "utf8",
    timeout: 45000,
    windowsHide: true,
  });
  if (run.status !== 0) {
    console.warn("[ml] python score failed:", (run.stderr || run.stdout || "").slice(0, 400));
    return list.map(() => null);
  }
  try {
    const text = String(run.stdout || "");
    const start = text.search(/[\[{]/);
    const parsed = JSON.parse(start >= 0 ? text.slice(start) : text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.warn("[ml] python score json:", e.message);
    return list.map(() => null);
  }
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function linearForecast(values, horizon) {
  const n = values.length;
  if (n < 2) return Array.from({ length: horizon }, () => values[n - 1] || 0);
  const xs = values.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const out = [];
  for (let h = 1; h <= horizon; h++) {
    out.push(Math.max(0, intercept + slope * (n - 1 + h)));
  }
  return out;
}

export function extractFeatures(store) {
  const now = Date.now();
  const days = 30;
  const start = now - days * DAY;
  const dailyMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(now - i * DAY);
    dailyMap.set(k, { date: k, usersNew: 0, volumeOut: 0, volumeIn: 0, txCount: 0, avgCheck: 0 });
  }

  for (const u of Object.values(store.users || {})) {
    const k = dayKey(u.createdAt || 0);
    if (dailyMap.has(k)) dailyMap.get(k).usersNew += 1;
  }

  for (const t of store.txs || []) {
    const k = dayKey(t.createdAt || 0);
    const row = dailyMap.get(k);
    if (!row) continue;
    row.txCount += 1;
    if (t.amount < 0) row.volumeOut += Math.abs(t.amount);
    else row.volumeIn += t.amount;
  }
  for (const row of dailyMap.values()) {
    row.avgCheck = row.txCount ? (row.volumeOut + row.volumeIn) / row.txCount : 0;
  }

  const users = Object.values(store.users || {}).map((u) => {
    const txs = (store.txs || []).filter((t) => t.email === u.email);
    const outs = txs.filter((t) => t.amount < 0);
    const counterparties = new Set(outs.map((t) => String(t.counterparty || t.name || "")));
    const last = txs.reduce((m, t) => Math.max(m, t.createdAt || 0), 0);
    const volumeOut = outs.reduce((s, t) => s + Math.abs(t.amount), 0);
    const volumeIn = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    return {
      email: u.email,
      frozen: Boolean(u.frozen),
      ageDays: Math.max(0, (now - (u.createdAt || now)) / DAY),
      balance: store.wallets[u.email]?.balance || 0,
      txCount: txs.length,
      volumeOut,
      volumeIn,
      uniquePayees: counterparties.size,
      avgOut: outs.length ? volumeOut / outs.length : 0,
      idleDays: last ? (now - last) / DAY : (now - (u.createdAt || now)) / DAY,
    };
  });

  const txs = (store.txs || [])
    .filter((t) => (t.createdAt || 0) >= start)
    .map((t) => ({
      id: t.id,
      email: t.email,
      amount: t.amount,
      abs: Math.abs(t.amount),
      type: t.type,
      category: t.category || "",
      counterparty: t.counterparty || t.name || "",
      createdAt: t.createdAt,
    }));

  const fraud = extractFraudRows(store);

  return {
    generatedAt: now,
    daily: [...dailyMap.values()],
    users,
    txs,
    fraud,
    fraudFeatures: FRAUD_FEATURES,
  };
}

function flagsFor(row) {
  const flags = [];
  if (row.is_night) flags.push("ночь 23:00–06:00");
  if (row.is_new_payee) flags.push("новый получатель");
  if (row.new_device || row.is_new_device) flags.push("новое устройство");
  if (row.amount_to_avg_ratio >= 3) flags.push("сумма выше среднего чека");
  if (row.login_attempts >= 4) flags.push("много попыток входа");
  if (row.amount >= 100000) flags.push("очень крупная сумма");
  if (row.amount >= 1e12) flags.push("нереалистичная сумма");
  if (row.type === "income" && row.amount >= 100000) flags.push("крупное пополнение");
  return flags;
}

function isStrange(row, modelAnomaly, final) {
  if (modelAnomaly || final >= 0.55) return true;
  if (row.savedAnomaly) return true;
  if (row.amount >= 50000) return true;
  if (row.amount_to_avg_ratio >= 3 && row.amount >= 1000) return true;
  if (row.is_new_payee && row.amount >= 500) return true;
  if (row.is_night && row.amount >= 3000) return true;
  if (row.type === "income" && row.amount >= 100000) return true;
  return false;
}

export function mergeAnomalies(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const a of list || []) {
      if (!a?.id) continue;
      const prev = map.get(a.id);
      if (!prev) {
        map.set(a.id, a);
        continue;
      }
      map.set(a.id, {
        ...prev,
        ...a,
        score: Math.max(Number(prev.score) || 0, Number(a.score) || 0),
        flags: [...new Set([...(prev.flags || []), ...(a.flags || [])])],
        createdAt: Math.max(prev.createdAt || 0, a.createdAt || 0),
      });
    }
  }
  return [...map.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || b.score - a.score);
}

export function runCustomModel(features) {
  const rows = (features.fraud || []).slice(0, 80);
  const scored = scoreWithFriendModel(rows);
  const anomalies = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const s = scored[i];
    const final = Number(s?.final_score || s?.score || row.savedScore || 0);
    const modelAnomaly = Boolean(s?.anomaly || row.savedAnomaly);
    if (!isStrange(row, modelAnomaly, final)) continue;
    const flags = flagsFor(row);
    const signed = row.signedAmount != null ? row.signedAmount : -row.amount;
    anomalies.push({
      id: row.id,
      email: row.email,
      amount: signed,
      createdAt: row.createdAt,
      counterparty: row.counterparty,
      z: Number(final.toFixed(3)),
      flags: flags.length ? flags : ["модель антифрода"],
      score: Math.min(100, Math.max(1, Math.round((final || (flags.length ? 0.7 : 0)) * 100))),
      engine: s?.engine || (row.savedAnomaly ? "saved" : "rules"),
    });
  }
  if (!anomalies.length && !scored.some(Boolean)) return null;
  return {
    engine: scored.some(Boolean) ? "anti_fraud.joblib" : "rules",
    notes: "Модель коллеги + правила по 8 фичам. Новые операции сверху.",
    anomalies: mergeAnomalies(anomalies).slice(0, 60),
    fraudFeatures: FRAUD_FEATURES,
  };
}

function baselineAnomalies(features) {
  const byUser = new Map();
  for (const t of features.txs) {
    if (!byUser.has(t.email)) byUser.set(t.email, []);
    byUser.get(t.email).push(t.abs);
  }
  const out = [];
  for (const t of features.txs) {
    const hist = byUser.get(t.email) || [];
    const m = mean(hist);
    const s = stdev(hist);
    const z = s ? (t.abs - m) / s : 0;
    const flags = [];
    if (Math.abs(z) >= 2.5 && t.abs >= 10000) flags.push("сумма сильно выше обычного");
    if (t.abs > 10000 && t.type === "expense") flags.push("крупное списание");
    if (t.abs >= 100000 && t.type === "income") flags.push("крупное пополнение");
    if (t.abs >= 1e12) flags.push("нереалистичная сумма");
    if (flags.length) {
      out.push({
        id: t.id,
        email: t.email,
        amount: t.amount,
        createdAt: t.createdAt,
        counterparty: t.counterparty,
        z: Number(z.toFixed(2)),
        flags,
        score: Math.min(100, Math.round(40 + Math.abs(z) * 15)),
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 40);
}

function baselineRisk(features) {
  return features.users
    .map((u) => {
      let score = 0;
      const reasons = [];
      if (u.txCount >= 3 && u.uniquePayees <= 1 && u.volumeOut > 20000) {
        score += 25;
        reasons.push("почти все переводы одному получателю");
      }
      if (u.ageDays < 2 && u.volumeOut > 15000) {
        score += 30;
        reasons.push("новый счёт и крупный оборот");
      }
      if (u.avgOut > 25000) {
        score += 20;
        reasons.push("высокий средний чек");
      }
      if (u.frozen) {
        score += 15;
        reasons.push("уже заморожен");
      }
      if (u.idleDays > 21 && u.balance > 50000) {
        score += 10;
        reasons.push("крупный баланс без активности");
      }
      return { ...u, risk: Math.min(100, score), reasons };
    })
    .filter((u) => u.risk >= 20)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 20);
}

export function buildReport(store, { horizonDays = 7 } = {}) {
  const features = extractFeatures(store);
  const volume = features.daily.map((d) => d.volumeOut);
  const usersNew = features.daily.map((d) => d.usersNew);
  const last = features.daily[features.daily.length - 1];
  const forecastVolume = linearForecast(volume, horizonDays);
  const forecastUsers = linearForecast(usersNew, horizonDays);
  const dates = [];
  const now = Date.now();
  for (let i = 1; i <= horizonDays; i++) dates.push(dayKey(now + i * DAY));

  const baseline = {
    engine: "baseline-v1",
    today: last,
    forecast: dates.map((date, i) => ({
      date,
      volumeOut: Math.round(forecastVolume[i]),
      usersNew: Number(forecastUsers[i].toFixed(2)),
    })),
    anomalies: baselineAnomalies(features),
    riskUsers: baselineRisk(features),
  };

  const custom = runCustomModel(features);
  return {
    model: custom ? "custom+baseline" : "baseline-v1",
    horizonDays,
    features: {
      daily: features.daily,
      userCount: features.users.length,
      txWindow: features.txs.length,
      fraud: features.fraud,
      fraudFeatures: FRAUD_FEATURES,
    },
    baseline,
    custom,
    forecast: custom?.forecast || baseline.forecast,
    anomalies: mergeAnomalies(custom?.anomalies, baseline.anomalies).slice(0, 60),
    riskUsers: custom?.riskUsers || baseline.riskUsers,
  };
}
