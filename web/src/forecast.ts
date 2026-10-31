const DAY = 86400000;
const MSK = 3 * 60 * 60 * 1000;
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

export function spendForecast(txs: { amount: number; type?: string; status?: string; createdAt: number }[], now = Date.now()) {
  const shifted = new Date(now + MSK);
  const month = shifted.getUTCMonth();
  const year = shifted.getUTCFullYear();
  const nextMonth = (month + 1) % 12;
  const nextYear = month === 11 ? year + 1 : year;
  const daysNext = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const from = now - 30 * DAY;
  let sum = 0;
  for (const tx of txs) {
    if (tx.status === "rejected" || tx.type === "income" || !(tx.amount < 0 || tx.type === "expense")) continue;
    if (tx.createdAt < from) continue;
    sum += Math.abs(tx.amount);
  }
  return {
    amount: Math.round((sum / 30) * daysNext),
    month: MONTHS[nextMonth],
    basis: "Средние траты за 30 дней",
  };
}
