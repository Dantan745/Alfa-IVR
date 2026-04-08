import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken, type Snapshot } from "./api";
import type { DbContact, DbNote, DbTx, DbUser, DbWallet } from "./db";

export type Tx = DbTx;
export type Note = DbNote;
export type Contact = DbContact;
export type WalletUser = Omit<DbUser, "passwordHash">;

export function formatRub(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTxDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Сегодня, ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Вчера, ${time}`;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatFullDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatHomeDate(d = new Date()) {
  const s = d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).replace(/\s*г\.?\s*$/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greetingByHour(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  if (h >= 17 && h < 23) return "Добрый вечер";
  return "Доброй ночи";
}

type WalletCtx = {
  ready: boolean;
  authed: boolean;
  toast: string;
  user: WalletUser | null;
  wallet: DbWallet | null;
  txs: Tx[];
  notes: Note[];
  contacts: Contact[];
  pendingPayee: string;
  setPendingPayee: (v: string) => void;
  login: (email: string, password: string, code?: string) => Promise<string | null>;
  requestCode: (opts: { login?: string; email?: string; phone?: string; password?: string; channel?: "sms" | "email"; purpose?: "login" | "register" | "pay" | "reset"; amount?: number }) => Promise<{ via?: string; masked?: string; fallback?: boolean; error?: string }>;
  forgotPassword: (login: string, channel?: "sms" | "email") => Promise<{ via?: string; masked?: string; fallback?: boolean; error?: string }>;
  resetPassword: (login: string, code: string, password: string) => Promise<string | null>;
  register: (u: Omit<DbUser, "passwordHash" | "walletId" | "createdAt"> & { password: string; code: string; channel?: "sms" | "email" }) => Promise<string | null>;
  logout: () => void;
  transfer: (payee: string, amount: number, comment?: string, code?: string) => Promise<string | null>;
  topUp: (amount: number) => Promise<string | null>;
  qrPay: (amount: number, code?: string) => Promise<string | null>;
  copyWalletId: () => Promise<void>;
  markNotesRead: () => Promise<void>;
  markNoteRead: (id: string) => Promise<void>;
  addContact: (name: string, phone: string) => Promise<string | null>;
  toggleFav: (id: string) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  bulkPay: (rows: { name: string; phone: string; amount: number }[], code?: string) => Promise<{ ok: number; fail: number; error?: string }>;
  updateSecurity: (patch: Partial<Pick<DbWallet, "biometric" | "pin" | "hideBalance">> & { otpChannel?: "sms" | "email" }) => Promise<void>;
  updateLimits: (patch: Record<string, number>) => Promise<string | null>;
  addSupportNote: (text: string) => Promise<void>;
  setToast: (t: string) => void;
};

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState<WalletUser | null>(null);
  const [wallet, setWallet] = useState<DbWallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingPayee, setPendingPayee] = useState("");

  const apply = useCallback((snap: Snapshot) => {
    setUser(snap.user);
    setWallet(snap.wallet);
    setTxs(snap.txs);
    setNotes(snap.notes);
    setContacts(snap.contacts);
    setAuthed(true);
  }, []);

  const fail = useCallback((e: unknown) => (e instanceof Error ? e.message : "Ошибка сервера"), []);

  useEffect(() => {
    (async () => {
      try {
        await api.health();
        if (getToken()) apply(await api.me());
      } catch {
        setToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, [apply]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const requestCode = useCallback(async (opts: { login?: string; email?: string; phone?: string; password?: string; channel?: "sms" | "email"; purpose?: "login" | "register" | "pay" | "reset"; amount?: number }) => {
    try {
      const r = await api.requestCode(opts);
      return { via: r.via, masked: r.masked, fallback: r.fallback };
    } catch (e) {
      return { error: fail(e) };
    }
  }, [fail]);

  const forgotPassword = useCallback(async (loginId: string, channel?: "sms" | "email") => {
    try {
      const r = await api.forgot(loginId, channel);
      return { via: r.via, masked: r.masked, fallback: r.fallback };
    } catch (e) {
      return { error: fail(e) };
    }
  }, [fail]);

  const resetPassword = useCallback(async (loginId: string, code: string, password: string) => {
    try {
      apply(await api.reset(loginId, code, password));
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const login = useCallback(async (email: string, password: string, code?: string) => {
    try {
      apply(await api.login(email, password, code));
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const register = useCallback(async (input: Omit<DbUser, "passwordHash" | "walletId" | "createdAt"> & { password: string; code: string; channel?: "sms" | "email" }) => {
    try {
      apply(await api.register({
        lastName: input.lastName,
        firstName: input.firstName,
        middleName: input.middleName,
        phone: input.phone,
        passport: input.passport,
        email: input.email,
        password: input.password,
        code: input.code,
        channel: input.channel || "",
      }));
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const logout = useCallback(() => {
    void api.logout();
    setAuthed(false);
    setUser(null);
    setWallet(null);
    setTxs([]);
    setNotes([]);
    setContacts([]);
    setPendingPayee("");
  }, []);

  const transfer = useCallback(async (payee: string, amount: number, comment?: string, code?: string) => {
    try {
      apply(await api.transfer(payee, amount, comment, code));
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const topUp = useCallback(async (amount: number) => {
    try {
      apply(await api.topUp(amount));
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const qrPay = useCallback(async (amount: number, code?: string) => {
    try {
      apply(await api.qrPay(amount, code));
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const copyWalletId = useCallback(async () => {
    const id = user?.walletId || "";
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const el = document.createElement("textarea");
      el.value = id;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setToast("ID кошелька скопирован");
  }, [user]);

  const markNotesRead = useCallback(async () => {
    try { apply(await api.markNotesRead()); } catch { /* ignore */ }
  }, [apply]);

  const markNoteRead = useCallback(async (id: string) => {
    try { apply(await api.markNoteRead(id)); } catch { /* ignore */ }
  }, [apply]);

  const addContact = useCallback(async (name: string, phone: string) => {
    try {
      apply(await api.addContact(name, phone));
      setToast("Контакт сохранён");
      return null;
    } catch (e) {
      return fail(e);
    }
  }, [apply, fail]);

  const toggleFav = useCallback(async (id: string) => {
    const cur = contacts.find((c) => c.id === id);
    if (!cur) return;
    try { apply(await api.toggleFav(id, !cur.favorite)); } catch { /* ignore */ }
  }, [apply, contacts]);

  const removeContact = useCallback(async (id: string) => {
    try {
      apply(await api.removeContact(id));
      setToast("Контакт удалён");
    } catch { /* ignore */ }
  }, [apply]);

  const bulkPay = useCallback(async (rows: { name: string; phone: string; amount: number }[], code?: string) => {
    try {
      const snap = await api.bulkPay(rows, code);
      apply(snap);
      return { ok: snap.ok || 0, fail: snap.fail || 0 };
    } catch (e) {
      return { ok: 0, fail: rows.length, error: fail(e) };
    }
  }, [apply, fail]);

  const updateLimits = useCallback(async (patch: Record<string, number>) => {
    try {
      apply(await api.updateLimits(patch));
      setToast("Лимиты сохранены");
      return null;
    } catch (e) {
      const msg = fail(e);
      setToast(msg);
      return msg;
    }
  }, [apply, fail]);

  const updateSecurity = useCallback(async (patch: Partial<Pick<DbWallet, "biometric" | "pin" | "hideBalance">> & { otpChannel?: "sms" | "email" }) => {
    try {
      apply(await api.updateSecurity(patch));
      setToast("Настройки сохранены");
    } catch (e) {
      setToast(fail(e));
    }
  }, [apply, fail]);

  const addSupportNote = useCallback(async (text: string) => {
    try {
      apply(await api.addSupportNote(text));
      setToast("Обращение отправлено");
    } catch (e) {
      setToast(fail(e));
    }
  }, [apply, fail]);

  const value = useMemo(
    () => ({
      ready, authed, toast, user, wallet, txs, notes, contacts, pendingPayee, setPendingPayee,
      login, requestCode, forgotPassword, resetPassword, register, logout, transfer, topUp, qrPay,
      copyWalletId, markNotesRead, markNoteRead, addContact, toggleFav, removeContact, bulkPay,
      updateSecurity, updateLimits, addSupportNote, setToast,
    }),
    [ready, authed, toast, user, wallet, txs, notes, contacts, pendingPayee, login, requestCode, forgotPassword, resetPassword, register, logout, transfer, topUp, qrPay, copyWalletId, markNotesRead, markNoteRead, addContact, toggleFav, removeContact, bulkPay, updateSecurity, updateLimits, addSupportNote],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("WalletProvider missing");
  return ctx;
}
