/**
 * Прогноз оборота и показ скора антифрода.
 * Фрод / Норма ставит только anomaly из anti_fraud.joblib.
 * anti_fraud_infer.py и joblib отсюда не меняются.
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
    const probe = spawnSync(cmd, ["-c", "import joblib, numpy, sklearn"], { encoding: "utf8", timeout: 20000 });
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
  let run;
  try {
    run = spawnSync(bin, [path.join(ML_DIR, "score.py")], {
      input: JSON.stringify(list),
      encoding: "utf8",
      timeout: 20000,
      windowsHide: true,
    });
  } catch (e) {
    console.warn("[ml] python score threw:", e.message);
    return list.map(() => null);
  }
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

function linearForecast(values, horizon) {
  const n = values.length;
  const last = values[n - 1] || 0;
  if (n < 2) return Array.from({ length: horizon }, () => last);
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
    const lin = intercept + slope * (n - 1 + h);
    out.push(Math.max(0, last * 0.55 + Math.max(0, lin) * 0.45));
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

function modelMarked(anomaly) {
  return anomaly === 0 || anomaly === 1 || anomaly === "0" || anomaly === "1";
}

function scoreNumber(final) {
  const n = Number(final);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function runCustomModel(features) {
  const rows = (features.fraud || []).slice(0, 80);
  const scoredRaw = scoreWithFriendModel(rows);
  const scored = [];
  const anomalies = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const s = scoredRaw[i];
    const live = s && modelMarked(s.anomaly);
    const saved = !live && modelMarked(row.savedAnomaly);
    const final = live ? scoreNumber(s.final_score ?? s.score) : saved ? scoreNumber(row.savedScore) : null;
    const anomaly = live ? (Number(s.anomaly) === 1 ? 1 : 0) : saved ? (Number(row.savedAnomaly) === 1 ? 1 : 0) : null;
    const item = {
      id: row.id,
      email: row.email,
      amount: row.signedAmount != null ? row.signedAmount : -row.amount,
      createdAt: row.createdAt,
      counterparty: row.counterparty,
      score: final,
      scoreExact: final,
      label: anomaly == null ? "" : anomaly ? "Фрод" : "Норма",
      engine: live ? (s.engine || "anti_fraud.joblib") : saved ? "anti_fraud.joblib" : "unavailable",
    };
    scored.push(item);
    if (anomaly === 1) anomalies.push(item);
  }
  return {
    engine: scoredRaw.some((s) => s && modelMarked(s.anomaly)) ? "anti_fraud.joblib" : "unavailable",
    notes: "Метку ставит только anomaly модели. Скор — final_score. Отдельных правил нет.",
    anomalies: anomalies.slice(0, 60),
    scored: scored.slice(0, 80),
    fraudFeatures: FRAUD_FEATURES,
  };
}

export function buildReport(store, { horizonDays = 7 } = {}) {
  const features = extractFeatures(store);
  const volume = features.daily.map((d) => d.volumeOut + d.volumeIn);
  const volumeOut = features.daily.map((d) => d.volumeOut);
  const volumeIn = features.daily.map((d) => d.volumeIn);
  const usersNew = features.daily.map((d) => d.usersNew);
  const last = features.daily[features.daily.length - 1];
  const forecastVolume = linearForecast(volume, horizonDays);
  const forecastOut = linearForecast(volumeOut, horizonDays);
  const forecastIn = linearForecast(volumeIn, horizonDays);
  const forecastUsers = linearForecast(usersNew, horizonDays);
  const dates = [];
  const now = Date.now();
  for (let i = 1; i <= horizonDays; i++) dates.push(dayKey(now + i * DAY));
  const history = features.daily.slice(-7).map((d) => ({
    date: d.date,
    volumeOut: Math.round(d.volumeOut),
    volumeIn: Math.round(d.volumeIn),
    volume: Math.round(d.volumeOut + d.volumeIn),
    txCount: d.txCount,
    actual: true,
  }));

  const forecast = dates.map((date, i) => ({
    date,
    volumeOut: Math.round(forecastOut[i]),
    volumeIn: Math.round(forecastIn[i]),
    volume: Math.round(forecastVolume[i]),
    usersNew: Number(forecastUsers[i].toFixed(2)),
    actual: false,
  }));

  const custom = runCustomModel(features);
  return {
    model: custom.engine,
    horizonDays,
    features: {
      daily: features.daily,
      userCount: features.users.length,
      txWindow: features.txs.length,
      fraud: features.fraud,
      fraudFeatures: FRAUD_FEATURES,
    },
    baseline: {
      engine: "forecast-v1",
      today: last,
      history,
      forecast,
    },
    custom,
    forecast,
    history,
    scored: custom.scored,
    generatedAt: Date.now(),
    today: last,
    anomalies: custom.anomalies,
    riskUsers: [],
  };
}
