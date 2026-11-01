const MSK = 3 * 60 * 60 * 1000;
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

function monthKey(ts) {
  const d = new Date(Number(ts) + MSK);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

function incomeAmount(tx) {
  if (!tx || tx.status === "rejected" || tx.status === "held") return 0;
  const type = tx.type || tx.tx_type;
  const amount = Number(tx.amount);
  if (type === "expense" || !(amount > 0 || type === "income")) return 0;
  return amount > 0 ? amount : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function forecastNextMonth(txs, now = Date.now()) {
  const cur = monthKey(now);
  const nextMonth = (cur.m + 1) % 12;
  const nextYear = cur.m === 11 ? cur.y + 1 : cur.y;
  const byMonth = new Map();
  for (const tx of txs || []) {
    const amount = incomeAmount(tx);
    if (!(amount > 0) || !tx.createdAt) continue;
    const dt = monthKey(tx.createdAt);
    const key = `${dt.y}-${dt.m}`;
    byMonth.set(key, (byMonth.get(key) || 0) + amount);
  }
  const months = [];
  for (let back = 3; back >= 1; back--) {
    const d = new Date(Date.UTC(cur.y, cur.m, 1));
    d.setUTCMonth(d.getUTCMonth() - back);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (byMonth.has(key)) months.push(byMonth.get(key) || 0);
  }
  const current = byMonth.get(`${cur.y}-${cur.m}`) || 0;
  if (cur.day >= 20 && current > 0) months.push(current);
  let amount = 0;
  let basis = "Пока нет зачислений, по которым можно оценить следующий месяц.";
  if (months.length) {
    amount = Math.round(median(months));
    basis = months.length === 1
      ? "По зачислениям за прошлый полный месяц."
      : "Медиана зачислений за последние месяцы. Разовая крупная выплата не раздувает оценку.";
  } else if (current > 0) {
    amount = Math.round(current);
    basis = "Месяц ещё не закрыт, поэтому беру уже пришедшие деньги и не домножаю их на оставшиеся дни.";
  }
  return { amount, month: MONTHS[nextMonth], year: nextYear, basis, samples: months.length };
}
