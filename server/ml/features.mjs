export const FRAUD_FEATURES = [
  { name: "log_amount", title: "log_amount", desc: "log1p от абсолютной суммы операции" },
  { name: "amount_to_avg_ratio", title: "amount_to_avg_ratio", desc: "во сколько раз операция превышает средний чек счёта" },
  { name: "hour", title: "hour", desc: "час суток (0–23)" },
  { name: "is_night", title: "is_night", desc: "ночная операция с 23:00 до 06:00 (0 или 1)" },
  { name: "login_attempts", title: "login_attempts", desc: "количество попыток входа (от 1 и выше)" },
  { name: "is_new_payee", title: "is_new_payee", desc: "флаг первого перевода новому получателю (0 или 1)" },
  { name: "time_since_last_transaction", title: "time_since_last_transaction", desc: "секунды после последней транзакции пользователя" },
  { name: "is_new_device", title: "is_new_device", desc: "пара аккаунт и устройство встретилась впервые (1 = новый девайс)" },
  { name: "amount_to_balance", title: "amount_to_balance", desc: "сумма операции, делённая на баланс до проводки" },
];

function payeeKey(v) {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function isSystemPayee(payee) {
  const s = payeeKey(payee);
  return !s || /альфа|банк|qr|касс|пополнен|админ|антифрод|служебн|карт/.test(s);
}

export function isNightHour(hour) {
  const h = Number(hour);
  return h >= 23 || h < 6 ? 1 : 0;
}

export function buildFraudSample(store, { email, amount, payee, now = Date.now(), loginAttempts = 1, newDevice = 0, excludeId = "", type = "", balance }) {
  const abs = Math.abs(Number(amount) || 0);
  const txs = (store.txs || [])
    .filter((t) => t.email === email && t.id !== excludeId && (t.createdAt || 0) <= now)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const hist = txs.map((t) => Math.abs(Number(t.amount) || 0));
  const avg = (hist.reduce((s, x) => s + x, 0) + abs) / (hist.length + 1);
  const hour = new Date(now).getHours();
  const known = new Set(txs.filter((t) => t.amount < 0).map((t) => payeeKey(t.counterparty || t.name)));
  const last = txs.length ? txs[txs.length - 1] : null;
  const person = type !== "income" && payee && !isSystemPayee(payee);
  const bal = Math.max(1, Number(balance ?? store.wallets?.[email]?.balance) || 0);
  const sample = {
    log_amount: Math.log1p(abs),
    amount_to_avg_ratio: Number((abs / (avg + 1e-5)).toFixed(4)),
    hour,
    is_night: isNightHour(hour),
    is_new_payee: person && !known.has(payeeKey(payee)) ? 1 : 0,
    login_attempts: Math.max(1, Number(loginAttempts) || 1),
    time_since_last_transaction: last ? Math.max(0, (now - last.createdAt) / 1000) : 0,
    new_device: newDevice ? 1 : 0,
    is_new_device: newDevice ? 1 : 0,
    amount_to_balance: abs / bal,
    type: type || (Number(amount) > 0 ? "income" : "expense"),
  };
  return sample;
}

export function extractFraudRows(store) {
  const users = store.users || {};
  return (store.txs || [])
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 120)
    .map((t) => {
      const u = users[t.email] || {};
      const before = t.balanceAfter != null ? Number(t.balanceAfter) - Number(t.amount) : undefined;
      const sample = buildFraudSample(store, {
        email: t.email,
        amount: t.amount,
        payee: t.counterparty || t.name,
        now: t.createdAt,
        loginAttempts: u.lastLoginAttempts || u.loginAttempts || 1,
        newDevice: t.mlFeatures?.new_device || t.mlFeatures?.is_new_device || 0,
        excludeId: t.id,
        type: t.type,
        balance: before,
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
