const DAY = 86400000;
const MSK = 3 * 60 * 60 * 1000;
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

function mskParts(ts) {
  const d = new Date(ts + MSK);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
    wd: d.getUTCDay(),
  };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  const byDay = new Map();
  for (const tx of txs || []) {
    const amount = expenseAmount(tx);
    if (!(amount > 0) || !tx.createdAt) continue;
    const dt = mskParts(Number(tx.createdAt));
    const key = `${dt.y}-${dt.m}-${dt.day}`;
    byDay.set(key, (byDay.get(key) || 0) + amount);
  }

  const windowDays = 84;
  const series = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const dt = mskParts(now - i * DAY);
    series.push({ wd: dt.wd, amount: byDay.get(`${dt.y}-${dt.m}-${dt.day}`) || 0 });
  }
  const buckets = Array.from({ length: 7 }, () => []);
  for (const row of series) buckets[row.wd].push(row.amount);

  const typical = buckets.map((values) => {
    const spent = values.filter((v) => v > 0);
    if (!spent.length) return 0;
    return (spent.length / values.length) * median(spent);
  });

  const recent = series.slice(-28).reduce((s, row) => s + row.amount, 0);
  const older = series.slice(-56, -28).reduce((s, row) => s + row.amount, 0);
  const activeDays = series.filter((row) => row.amount > 0).length;
  let trend = 1;
  if (older > 0 && activeDays >= 8) trend = Math.min(1.35, Math.max(0.75, recent / older));

  let total = 0;
  for (let day = 1; day <= daysNext; day++) {
    const wd = new Date(Date.UTC(nextYear, nextMonth, day)).getUTCDay();
    total += typical[wd] * trend;
  }

  let basis = "По обычным дням недели за последние 12 недель. Редкие крупные дни не тянут оценку вверх: берётся медиана, а не среднее.";
  if (activeDays < 4) {
    const seen = [];
    for (let day = 1; day <= cur.day; day++) seen.push(byDay.get(`${cur.y}-${cur.m}-${day}`) || 0);
    const spentDays = seen.filter((v) => v > 0);
    const daily = median(spentDays);
    total = daily * daysNext * (spentDays.length / Math.max(1, seen.length));
    basis = "Операций пока мало, поэтому следующий месяц оценён по тем дням этого месяца, когда траты уже были.";
  }

  return {
    amount: Math.round(Math.max(0, total)),
    month: MONTHS[nextMonth],
    year: nextYear,
    basis,
    samples: activeDays,
  };
}
