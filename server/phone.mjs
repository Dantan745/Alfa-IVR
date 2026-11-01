// Российский мобильный. В базе и в смс номер один и тот же, в интерфейсе с пробелами.
// к 11 цифрам, 8 в начале меняем на 7
export function ruMobileDigits(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("9")) d = "7" + d;
  if (d.length > 11 && d.startsWith("7")) d = d.slice(0, 11);
  return d.slice(0, 11);
}

// мобильный РФ: 79 и ещё 9 цифр
export function isRuMobile(raw) {
  return /^79\d{9}$/.test(ruMobileDigits(raw));
}

// как показываем в интерфейсе: +7 (9xx) xxx-xx-xx
export function formatRuPhone(raw) {
  let d = ruMobileDigits(raw);
  if (!d) return "";
  if (d.startsWith("9")) d = ("7" + d).slice(0, 11);
  if (!d.startsWith("7")) d = ("7" + d).slice(0, 11);
  const rest = d.slice(1);
  let out = "+7";
  if (!rest.length) return out;
  out += " (" + rest.slice(0, Math.min(3, rest.length));
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += " " + rest.slice(3, 6);
  if (rest.length > 6) out += "-" + rest.slice(6, 8);
  if (rest.length > 8) out += "-" + rest.slice(8, 10);
  return out;
}

// один номер, даже если записан по-разному
export function samePhone(a, b) {
  const da = ruMobileDigits(a);
  const db = ruMobileDigits(b);
  if (da.length < 10 || db.length < 10) return false;
  return da.slice(-10) === db.slice(-10);
}
