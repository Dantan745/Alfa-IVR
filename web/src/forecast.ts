const MSK = 3 * 60 * 60 * 1000;
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

type Row = { amount: number; type?: string; status?: string; createdAt: number };

function monthKey(ts: number) {
  const d = new Date(ts + MSK);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

function incomeAmount(tx: Row) {
  if (tx.status === "rejected" || tx.status === "held" || tx.type === "expense") return 0;
  if (tx.type === "income" || tx.amount > 0) return Math.abs(tx.amount);
  return 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function incomeForecast(txs: Row[], now = Date.now()) {
  const cur = monthKey(now);
  const nextMonth = (cur.m + 1) % 12;
  const byMonth = new Map<string, number>();
  for (const tx of txs) {
    const amount = incomeAmount(tx);
    if (!(amount > 0) || !tx.createdAt) continue;
    const dt = monthKey(tx.createdAt);
    const key = `${dt.y}-${dt.m}`;
    byMonth.set(key, (byMonth.get(key) || 0) + amount);
  }

  const months: number[] = [];
  for (let back = 3; back >= 1; back--) {
    const d = new Date(Date.UTC(cur.y, cur.m, 1));
    d.setUTCMonth(d.getUTCMonth() - back);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (byMonth.has(key)) months.push(byMonth.get(key) || 0);
  }
  const currentKey = `${cur.y}-${cur.m}`;
  const current = byMonth.get(currentKey) || 0;
  if (cur.day >= 20 && current > 0) months.push(current);

  let amount = 0;
  let basis = "Пока нет зачислений, по которым можно оценить следующий месяц.";
  if (months.length) {
    amount = Math.round(median(months));
    basis = months.length === 1
      ? "По зачислениям за прошлый полный месяц"
      : "Медиана зачислений за последние месяцы";
  } else if (current > 0) {
    amount = Math.round(current);
    basis = "Месяц ещё не закрыт, беру уже пришедшие деньги без домножения";
  }

  return { amount, month: MONTHS[nextMonth], basis };
}
