const CYRILLIC_NAME = /^[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?$/;
const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD = /^\S{8,64}$/;
const PASSPORT = /^\d{4} \d{6}$/;
const DIV_CODE = /^\d{3}-\d{3}$/;
const SMS = /^\d{4,6}$/;
const PIN = /^\d{4}$/;

export function digits(s: string) {
  return s.replace(/\D/g, "");
}

export function ruMobileDigits(raw: string) {
  let d = digits(raw);
  if (!d) return "";
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("9")) d = "7" + d;
  return d.slice(0, 11);
}

export function isRuMobile(raw: string) {
  return /^79\d{9}$/.test(ruMobileDigits(raw));
}

export function maskPhone(raw: string) {
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

/** Маска, которая даёт стереть скобку/дефис: стирается последняя цифра. */
export function editPhoneMask(prev: string, next: string) {
  const pd = ruMobileDigits(prev);
  const nd = ruMobileDigits(next);
  if ((next || "").length < (prev || "").length && nd.length >= pd.length && pd.length) {
    return maskPhone(pd.slice(0, -1));
  }
  return maskPhone(nd);
}

export function maskPassport(raw: string) {
  const d = digits(raw).slice(0, 10);
  if (d.length <= 4) return d;
  return d.slice(0, 4) + " " + d.slice(4);
}

export function maskDivCode(raw: string) {
  const d = digits(raw).slice(0, 6);
  if (d.length <= 3) return d;
  return d.slice(0, 3) + "-" + d.slice(3);
}

export function maskDate(raw: string) {
  const d = digits(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + "." + d.slice(2);
  return d.slice(0, 2) + "." + d.slice(2, 4) + "." + d.slice(4);
}

export function validateName(label: string, value: string, required = true) {
  const v = value.trim();
  if (!v) return required ? `Укажите ${label.toLowerCase()}` : "";
  if (!CYRILLIC_NAME.test(v)) return `${label}: кириллица, с заглавной (например Иванов)`;
  return "";
}

export function validateEmail(value: string) {
  const v = value.trim();
  if (!v) return "Укажите электронную почту";
  if (!EMAIL.test(v)) return "Некорректный email (например ivan@bank.ru)";
  return "";
}

export function validatePassword(value: string) {
  if (!value) return "Укажите пароль";
  if (value.length < 8) return "Пароль не короче 8 символов";
  if (value.length > 64) return "Пароль не длиннее 64 символов";
  if (!PASSWORD.test(value)) return "Пароль без пробелов, от 8 символов";
  return "";
}

export function validatePhone(value: string) {
  if (!value || !digits(value)) return "Укажите номер телефона";
  if (!isRuMobile(value)) return "Российский мобильный: +7 / 8 / 9 и 10 цифр номера";
  return "";
}

export function validatePassport(value: string) {
  if (!PASSPORT.test(value)) return "Серия и номер: 0000 000000";
  return "";
}

export function validateIssueDate(value: string) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return "Дата выдачи: ДД.ММ.ГГГГ";
  const [dd, mm, yyyy] = value.split(".").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return "Несуществующая дата";
  const now = new Date();
  if (d > now) return "Дата выдачи не может быть в будущем";
  if (yyyy < 1997) return "Паспорт РФ выдаётся с 1997 года";
  const ageDays = (now.getTime() - d.getTime()) / 86400000;
  if (ageDays > 365 * 30 + 30) return "Срок паспорта истёк — укажите действующий";
  return "";
}

export function validateDivCode(value: string) {
  if (!DIV_CODE.test(value)) return "Код подразделения: 000-000";
  return "";
}

export function validateSms(value: string) {
  if (!SMS.test(value)) return "Код из СМС: 4–6 цифр";
  return "";
}

export function validatePin(value: string) {
  if (!PIN.test(value)) return "PIN: 4 цифры";
  return "";
}

export function isOwnPayee(
  user: { email?: string; phone?: string; walletId?: string } | null | undefined,
  query: string,
) {
  if (!user) return false;
  const q = String(query || "").trim();
  if (!q) return false;
  const qn = q.toLowerCase();
  if (user.email && qn === user.email.toLowerCase()) return true;
  if (user.walletId && qn === user.walletId.toLowerCase()) return true;
  const qd = ruMobileDigits(q);
  const md = ruMobileDigits(user.phone || "");
  return qd.length >= 10 && md.length >= 10 && qd.slice(-10) === md.slice(-10);
}
