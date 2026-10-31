const DAY = 86400000;
const MSK = 3 * 60 * 60 * 1000;
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

function mskParts(ts) {
  const d = new Date(ts + MSK);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

function expenseAmount(tx) {
  if (!tx || tx.status === "rejected" || tx.status === "held") return 0;
  const type = tx.type || tx.tx_type;
  const amount = Number(tx.amount);
  if (type === "income" || !(amount < 0 || type === "expense")) return 0;
  return Math.abs(amount);
}

export function forecastNextMonth(txs, now = Date.now()) {
  const cur = mskParts(now);
  const nextMonth = (cur.m + 1) % 12;
  const nextYear = cur.m === 11 ? cur.y + 1 : cur.y;
  const daysNext = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const from = now - 30 * DAY;
  let sum = 0;
  let samples = 0;
  for (const tx of txs || []) {
    const amount = expenseAmount(tx);
    if (!(amount > 0) || Number(tx.createdAt) < from) continue;
    sum += amount;
    samples += 1;
  }
  const amount = Math.round((sum / 30) * daysNext);
  return {
    amount,
    month: MONTHS[nextMonth],
    year: nextYear,
    basis: samples
      ? "Средние траты за последние 30 дней, умноженные на число дней в следующем месяце."
      : "За последние 30 дней списаний не было.",
    samples,
  };
}
