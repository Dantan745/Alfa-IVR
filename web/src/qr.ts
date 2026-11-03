export type QrBill = {
  title: string;
  payee: string;
  amount: number | null;
};

export function encodeAlfaQr(opts: { walletId: string; title: string; amount?: number }) {
  const amount = opts.amount && opts.amount > 0 ? String(Math.round(opts.amount * 100) / 100) : "";
  const title = opts.title.replace(/[|\n\r]/g, " ").slice(0, 80);
  return `ALFACR1|${opts.walletId}|${amount}|${title}`;
}

function money(raw: string) {
  const n = Number(String(raw || "").replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function parseQr(raw: string): QrBill | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (text.startsWith("ALFACR1|")) {
    const parts = text.split("|");
    const payee = parts[1] || "";
    const amount = money(parts[2] || "");
    const title = parts.slice(3).join("|").trim() || "Оплата QR";
    if (!payee && amount == null) return null;
    return { payee, title, amount };
  }
  if (text.startsWith("ST0001")) {
    const fields = new Map<string, string>();
    for (const part of text.split("|").slice(1)) {
      const i = part.indexOf("=");
      if (i > 0) fields.set(part.slice(0, i), part.slice(i + 1));
    }
    const kopecks = Number(fields.get("Sum") || "");
    const amount = Number.isFinite(kopecks) && kopecks > 0 ? Math.round(kopecks) / 100 : null;
    return {
      payee: fields.get("PersonalAcc") || fields.get("Phone") || "",
      title: fields.get("Name") || fields.get("Purpose") || "Оплата по QR",
      amount,
    };
  }
  try {
    const url = new URL(text);
    const amount = money(url.searchParams.get("amount") || url.searchParams.get("sum") || "");
    const payee = url.searchParams.get("wallet") || url.searchParams.get("to") || url.searchParams.get("phone") || "";
    const title = url.searchParams.get("name") || url.searchParams.get("merchant") || "Оплата по QR";
    if (payee || amount != null) return { payee, title, amount };
  } catch {
    /* not a url */
  }
  return null;
}
