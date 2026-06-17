import { useEffect, useMemo, useState } from "react";
import { editPhoneMask } from "../validate";

type UserRow = {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  phone: string;
  passport: string;
  walletId: string;
  createdAt: number;
  balance: number;
  txCount: number;
  lastCode?: string;
  password?: string;
  frozen?: boolean;
  freezeReason?: string;
  sessions?: number;
};

type Detail = {
  user: UserRow;
  wallet: { balance: number; pin: string; hideBalance: boolean; biometric: boolean };
  txs: { id: string; name: string; amount: number; createdAt: number; type: string; counterparty?: string; status?: string; freezeReason?: string; riskScore?: number; riskScoreExact?: number; riskBar?: number; riskLabel?: string; riskExplain?: string[] }[];
  contacts: { name: string; phone: string }[];
  notes: { title: string; body: string; createdAt: number }[];
};

type Overview = {
  users: number;
  frozen: number;
  totalBalance: number;
  txCount: number;
  volumeOut: number;
  volumeIn: number;
  txToday: number;
  newWeek: number;
  audit: { id: string; action: string; at: number; detail: Record<string, unknown> }[];
};

type MlReport = {
  model: string;
  horizonDays: number;
  today?: { date: string; volumeOut: number; volumeIn?: number; txCount: number };
  history?: { date: string; volumeOut: number; volumeIn?: number; volume?: number; txCount?: number; actual?: boolean }[];
  forecast: { date: string; volumeOut: number; volumeIn?: number; volume?: number; usersNew: number; actual?: boolean }[];
  anomalies: { id: string; email: string; amount: number; createdAt: number; counterparty: string; z: number; flags: string[]; explain?: string[]; score: number; scoreExact?: number; scoreBar?: number; status?: string; level?: string; label?: string }[];
  riskUsers: { email: string; risk: number; reasons: string[]; balance: number; volumeOut: number; txCount: number }[];
  features: {
    daily: { date: string; volumeOut: number; txCount: number; usersNew: number }[];
    userCount: number;
    txWindow: number;
    fraudFeatures?: { name: string; title: string; desc: string }[];
    fraud?: Record<string, unknown>[];
  };
  custom: { notes?: string; engine?: string | null } | null;
  scored?: { id: string; email: string; amount: number; createdAt: number; counterparty: string; score: number; scoreExact?: number; scoreBar?: number; level?: string; label?: string; explain?: string[]; flags?: string[] }[];
  generatedAt?: number;
};

const KEY = "alfa-admin-key";
const NOTIFY_DRAFT = "alfa-admin-notify";
const DEFAULT_SMSRU = "E5BC03E1-5193-FFFF-1F0D-CB0DAD2CD255";
type Tab = "overview" | "users" | "ops" | "ml";

async function adminReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Admin-Key", sessionStorage.getItem(KEY) || "");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Ошибка");
  return data as T;
}

function FraudMark({ label, score, ticks, bar }: { label?: string; score?: number | null; ticks?: number | null; bar?: number | null }) {
  if (label !== "Фрод" && label !== "Норма") {
    return <span className="text-[rgba(185,202,203,0.45)]">нет оценки</span>;
  }
  const fraud = label === "Фрод";
  const exact = score != null && Number.isFinite(score) ? score : ticks != null ? Math.round(ticks) / 100 : null;
  const shownTicks = ticks != null && Number.isFinite(ticks) ? ticks : exact != null ? Math.round(exact * 100) : null;
  const fill = bar != null && Number.isFinite(bar) ? bar : shownTicks != null ? Math.min(100, Math.max(0, shownTicks)) : 0;
  return (
    <span className="inline-flex items-center gap-2 align-middle flex-wrap">
      <span style={{ color: fraud ? "#FFB4AB" : "#48FFD5" }}>{label}</span>
      {exact != null ? <span className="text-[rgba(185,202,203,0.7)]">{exact}</span> : null}
      {shownTicks != null ? (
        <>
          <span className="inline-block w-[72px] h-[6px] rounded-full bg-white/10 overflow-hidden shrink-0">
            <span className="block h-full rounded-full" style={{ width: `${fill}%`, background: "linear-gradient(90deg,#00D2D3,#E8C07A)" }} />
          </span>
          <span className="text-[rgba(185,202,203,0.55)]">{shownTicks > 100 ? String(shownTicks) : `${shownTicks}/100`}</span>
        </>
      ) : null}
    </span>
  );
}

function money(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0 ₽";
  const sign = x < 0 ? "−" : "";
  const abs = Math.abs(x);
  const fmt = (v: number, suffix: string) =>
    sign + v.toLocaleString("ru-RU", { maximumFractionDigits: v >= 100 ? 1 : 2 }) + "\u00a0" + suffix + " ₽";
  if (abs >= 1e18) return fmt(abs / 1e18, "квинтилл.");
  if (abs >= 1e15) return fmt(abs / 1e15, "квадрилл.");
  if (abs >= 1e12) return fmt(abs / 1e12, "трлн");
  if (abs >= 1e9) return fmt(abs / 1e9, "млрд");
  if (abs >= 1e6) return fmt(abs / 1e6, "млн");
  return sign + abs.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " ₽";
}

function downloadJson(name: string, rows: unknown) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AdminPage() {
  const [pass, setPass] = useState("");
  const [ok, setOk] = useState(!!sessionStorage.getItem(KEY));
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editBal, setEditBal] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPass, setEditPass] = useState("");
  const [adjust, setAdjust] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ops, setOps] = useState<{ id: string; email: string; name: string; amount: number; createdAt: number; type: string; counterparty?: string; status?: string; freezeReason?: string; mlAnomaly?: number; riskScore?: number; riskScoreExact?: number; riskBar?: number; riskLabel?: string; riskExplain?: string[] }[]>([]);
  const [opsQ, setOpsQ] = useState("");
  const [opsType, setOpsType] = useState("");
  const [ml, setMl] = useState<MlReport | null>(null);
  const [mlMsg, setMlMsg] = useState("");
  const [notify, setNotify] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTIFY_DRAFT);
      if (raw) return { ...JSON.parse(raw), smsruApiId: JSON.parse(raw).smsruApiId || DEFAULT_SMSRU };
    } catch {
      /* ignore */
    }
    return {
      sms: false,
      email: false,
      smsruApiId: DEFAULT_SMSRU,
      smtpHost: "smtp.mail.ru",
      smtpPort: 465,
      smtpUser: "",
      smtpPass: "",
      smtpFrom: "",
    };
  });
  const [notifyMsg, setNotifyMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  async function saveNotify() {
    const d = await adminReq<typeof notify>("/api/admin/notify", {
      method: "PATCH",
      body: JSON.stringify(notify),
    });
    const next = {
      ...d,
      smsruApiId: d.smsruApiId || notify.smsruApiId || DEFAULT_SMSRU,
      smtpPass: notify.smtpPass,
    };
    setNotify(next);
    try {
      localStorage.setItem(NOTIFY_DRAFT, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  }

  async function loadList() {
    const data = await adminReq<{ users: UserRow[] }>("/api/admin/users");
    setUsers(data.users);
    const n = await adminReq<typeof notify>("/api/admin/notify");
    setNotify((p) => {
      const next = {
        ...p,
        ...n,
        smsruApiId: n.smsruApiId || p.smsruApiId || DEFAULT_SMSRU,
        smtpPass: p.smtpPass,
      };
      try {
        localStorage.setItem(NOTIFY_DRAFT, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    const ov = await adminReq<Overview>("/api/admin/overview");
    setOverview(ov);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem(KEY, pass);
    try {
      await loadList();
      setOk(true);
      setErr("");
    } catch (ex) {
      sessionStorage.removeItem(KEY);
      setErr(ex instanceof Error ? ex.message : "Неверный ключ");
    }
  }

  useEffect(() => {
    if (ok) void loadList().catch(() => { setOk(false); sessionStorage.removeItem(KEY); });
  }, [ok]);

  useEffect(() => {
    if (!sel) { setDetail(null); return; }
    void adminReq<Detail>("/api/admin/users/" + encodeURIComponent(sel)).then((d) => {
      setDetail(d);
      setEditBal(String(d.wallet.balance));
      setEditPhone(d.user.phone);
      setEditEmail(d.user.email);
      setEditPass("");
    });
  }, [sel]);

  useEffect(() => {
    if (!ok || tab !== "ops") return;
    let stop = false;
    async function loadOps() {
      const qs = new URLSearchParams();
      if (opsQ) qs.set("q", opsQ);
      if (opsType) qs.set("type", opsType);
      try {
        const d = await adminReq<{ txs: typeof ops }>("/api/admin/txs?" + qs.toString());
        if (!stop) setOps(d.txs);
      } catch {
        /* ignore */
      }
    }
    void loadOps();
    const id = setInterval(() => void loadOps(), 2500);
    return () => { stop = true; clearInterval(id); };
  }, [ok, tab, opsQ, opsType]);

  useEffect(() => {
    if (!ok || tab !== "ml") return;
    let stop = false;
    async function loadMl(first = false) {
      if (first) setMlMsg("Считаем антифрод…");
      try {
        const d = await adminReq<MlReport>("/api/admin/ml");
        if (stop) return;
        setMl(d);
        setMlMsg(`Операций в отчёте: ${d.scored?.length || 0} · аномалий: ${d.anomalies?.length || 0} · ${new Date(d.generatedAt || Date.now()).toLocaleTimeString("ru-RU")}`);
      } catch (e) {
        if (!stop) setMlMsg(e instanceof Error ? e.message : "Ошибка ML");
      }
    }
    void loadMl(true);
    const id = setInterval(() => void loadMl(false), 2000);
    return () => { stop = true; clearInterval(id); };
  }, [ok, tab]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => `${u.email} ${u.phone} ${u.lastName} ${u.firstName} ${u.walletId}`.toLowerCase().includes(s));
  }, [users, q]);

  async function userOpEmail(email: string, op: string, body: Record<string, unknown> = {}) {
    setActionMsg("");
    try {
      await adminReq("/api/admin/users/" + encodeURIComponent(email) + "/" + op, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setActionMsg("Готово");
      await loadList();
      if (sel === email) {
        const d = await adminReq<Detail>("/api/admin/users/" + encodeURIComponent(email));
        setDetail(d);
      }
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function txOp(id: string, op: "hold" | "release" | "reject", body: Record<string, unknown> = {}) {
    setActionMsg("");
    try {
      await adminReq("/api/admin/txs/" + encodeURIComponent(id) + "/" + op, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setActionMsg("Готово");
      if (tab === "ops") {
        const qs = new URLSearchParams();
        if (opsQ) qs.set("q", opsQ);
        if (opsType) qs.set("type", opsType);
        const d = await adminReq<{ txs: typeof ops }>("/api/admin/txs?" + qs.toString());
        setOps(d.txs);
      }
      if (sel) {
        const d = await adminReq<Detail>("/api/admin/users/" + encodeURIComponent(sel));
        setDetail(d);
      }
      await loadList();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function userOp(op: string, body: Record<string, unknown> = {}) {
    if (!detail) return;
    setActionMsg("");
    try {
      await adminReq("/api/admin/users/" + encodeURIComponent(detail.user.email) + "/" + op, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setActionMsg("Готово");
      await loadList();
      setSel(detail.user.email);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (!ok) {
    return (
      <div className="admin-shell flex items-center justify-center p-6">
        <form onSubmit={(e) => void login(e)} className="w-full max-w-sm rounded-[24px] p-6" style={{ background: "#191C1C" }}>
          <p className="text-[#E0E0E0] text-[20px] mb-1">Кабинет разработчика</p>
          <p className="text-[rgba(185,202,203,0.5)] text-[13px] mb-4">Ключ запускается вместе с сервером (консоль)</p>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Ключ администратора" className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(63,78,79,0.7)] rounded-[14px] px-4 py-3 mb-3 outline-none" />
          {err && <p className="text-[#FFB4AB] text-[13px] mb-2">{err}</p>}
          <button className="w-full h-12 rounded-[14px] text-[#0B1A1A] font-medium" style={{ background: "linear-gradient(128deg,#00D2D3,#48FFD5)" }}>Войти</button>
        </form>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Сводка" },
    { id: "users", label: "Клиенты" },
    { id: "ops", label: "Операции" },
    { id: "ml", label: "ML / прогноз" },
  ];

  return (
    <div className="admin-shell p-4 md:p-8">
      <div className="max-w-[1200px] mx-auto pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[22px] font-medium">Админ-панель Alfa ЦР</p>
            <p className="text-[13px] text-[rgba(185,202,203,0.5)]">{users.length} аккаунтов · перевод себе запрещён</p>
          </div>
          <div className="flex gap-2">
            <a href="/" className="px-4 py-2 rounded-[12px] text-[13px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.1)" }}>Кошелёк</a>
            <button onClick={() => { sessionStorage.removeItem(KEY); setOk(false); }} className="px-4 py-2 rounded-[12px] text-[13px] text-[rgba(185,202,203,0.7)]">Выйти</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-[12px] text-[13px] pressable"
              style={{
                background: tab === t.id ? "rgba(0,210,211,0.18)" : "#191C1C",
                color: tab === t.id ? "#00D2D3" : "rgba(185,202,203,0.7)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                ["Клиенты", String(overview?.users ?? users.length)],
                ["Заморожено", String(overview?.frozen ?? 0)],
                ["Сумма балансов", money(overview?.totalBalance ?? 0)],
                ["Операций сегодня", String(overview?.txToday ?? 0)],
                ["Оборот списаний", money(overview?.volumeOut ?? 0)],
                ["Оборот зачислений", money(overview?.volumeIn ?? 0)],
                ["Всего операций", String(overview?.txCount ?? 0)],
                ["Новых за неделю", String(overview?.newWeek ?? 0)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[16px] p-4" style={{ background: "#191C1C" }}>
                  <p className="text-[12px] text-[rgba(185,202,203,0.5)]">{k}</p>
                  <p className="text-[18px] sm:text-[20px] text-[#00D2D3] mt-1 leading-tight break-words">{v}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[20px] p-4 mb-4" style={{ background: "#191C1C" }}>
              <p className="text-[16px] font-medium mb-1">2FA: СМС и почта</p>
              <p className="text-[12px] text-[rgba(185,202,203,0.5)] mb-3">
                СМС: ключ с sms.ru (API ID). Почта: SMTP ящика (Mail.ru / Яндекс / Gmail с паролем приложения). Сейчас СМС {notify.sms ? "включено" : "не настроено"}, почта {notify.email ? "включена" : "не настроена"}.
                Для Mail.ru обычный пароль от ящика не подходит — нужен пароль приложения.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 text-[13px]">
                <input className="bg-black/30 rounded-[10px] px-3 py-2" placeholder="SMS.ru API ID" value={notify.smsruApiId} onChange={(e) => setNotify({ ...notify, smsruApiId: e.target.value })} />
                <input className="bg-black/30 rounded-[10px] px-3 py-2" placeholder="SMTP хост" value={notify.smtpHost} onChange={(e) => setNotify({ ...notify, smtpHost: e.target.value })} />
                <input className="bg-black/30 rounded-[10px] px-3 py-2" placeholder="SMTP порт" value={String(notify.smtpPort)} onChange={(e) => setNotify({ ...notify, smtpPort: Number(e.target.value) || 465 })} />
                <input className="bg-black/30 rounded-[10px] px-3 py-2" placeholder="SMTP логин (почта)" value={notify.smtpUser} onChange={(e) => setNotify({ ...notify, smtpUser: e.target.value })} />
                <input className="bg-black/30 rounded-[10px] px-3 py-2" type="password" placeholder="Пароль приложения SMTP (не пароль ящика)" value={notify.smtpPass} onChange={(e) => setNotify({ ...notify, smtpPass: e.target.value })} />
                <input className="bg-black/30 rounded-[10px] px-3 py-2" placeholder="От кого (From)" value={notify.smtpFrom} onChange={(e) => setNotify({ ...notify, smtpFrom: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="px-3 py-2 rounded-[10px] text-[#0B1A1A]" style={{ background: "#00D2D3" }} onClick={() => void saveNotify().then(() => setNotifyMsg("Сохранено")).catch((e) => setNotifyMsg(e instanceof Error ? e.message : "Ошибка"))}>Сохранить каналы</button>
                <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void saveNotify().then(() => adminReq("/api/admin/notify/test", { method: "POST", body: JSON.stringify({ channel: "email", email: notify.smtpUser }) })).then((d) => setNotifyMsg("Сохранено. Тест почты: " + JSON.stringify(d))).catch((e) => setNotifyMsg(e instanceof Error ? e.message : "Ошибка"))}>Тест письма</button>
                <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => {
                  const phone = prompt("Номер для тестовой СМС, формат +7 (9XX) XXX-XX-XX");
                  if (!phone) return;
                  void saveNotify().then(() => adminReq("/api/admin/notify/test", { method: "POST", body: JSON.stringify({ channel: "sms", phone }) })).then((d) => setNotifyMsg("Сохранено. Тест СМС: " + JSON.stringify(d))).catch((e) => setNotifyMsg(e instanceof Error ? e.message : "Ошибка"));
                }}>Тест СМС</button>
              </div>
              {notifyMsg && (
                <p className={`text-[12px] mt-2 ${/ошибк|не принял|неверн|535|парол/i.test(notifyMsg) ? "text-[#FFB4AB]" : "text-[#00D2D3]"}`}>
                  {notifyMsg}
                </p>
              )}
            </div>

            <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
              <p className="text-[16px] font-medium mb-3">Журнал админа</p>
              {(overview?.audit || []).length === 0 && <p className="text-[13px] text-[rgba(185,202,203,0.45)]">Пока пусто</p>}
              {(overview?.audit || []).map((a) => (
                <p key={a.id} className="text-[12px] py-1.5 border-b border-white/5">
                  {new Date(a.at).toLocaleString("ru-RU")} · {a.action} · {JSON.stringify(a.detail)}
                </p>
              ))}
            </div>
          </>
        )}

        {tab === "users" && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: ФИО, почта, телефон, ID" className="w-full mb-4 bg-[#191C1C] rounded-[14px] px-4 py-3 outline-none" />
            <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-4">
              <div className="rounded-[20px] overflow-hidden" style={{ background: "#191C1C" }}>
                {filtered.map((u) => (
                  <button key={u.email} type="button" onClick={() => setSel(u.email)} className="w-full text-left px-4 py-3 border-b border-white/5" style={{ background: sel === u.email ? "rgba(0,210,211,0.08)" : "transparent" }}>
                    <p className="text-[14px] font-medium">{u.lastName} {u.firstName} {u.middleName} {u.frozen ? <span className="text-[#FFB4AB] text-[11px]">ЗАМОРОЖЕН</span> : null}</p>
                    <p className="text-[12px] text-[rgba(185,202,203,0.55)]">{u.email} · {u.phone}</p>
                    <p className="text-[12px] text-[rgba(185,202,203,0.55)] mt-0.5">пароль хранится как хеш</p>
                    <p className="text-[12px] text-[#00D2D3] mt-0.5">{u.balance.toLocaleString("ru-RU")} ₽ · операций {u.txCount}</p>
                  </button>
                ))}
                {filtered.length === 0 && <p className="p-6 text-[13px] text-[rgba(185,202,203,0.45)]">Никого нет</p>}
              </div>
              <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
                {!detail ? (
                  <p className="text-[rgba(185,202,203,0.45)] text-[13px]">Выберите пользователя слева</p>
                ) : (
                  <div className="flex flex-col gap-3 text-[13px]">
                    <p className="text-[16px] font-medium">{detail.user.lastName} {detail.user.firstName}</p>
                    <p>ID: {detail.user.walletId}</p>
                    <p>Паспорт: {detail.user.passport || "—"}</p>
                    <p>Пароль: <span className="text-[#00D2D3]">хеш scrypt, открытый текст не хранится</span></p>
                    <p>Создан: {new Date(detail.user.createdAt).toLocaleString("ru-RU")}</p>
                    {detail.user.frozen && <p className="text-[#FFB4AB]">Заморожен: {detail.user.freezeReason || "да"}</p>}
                    {detail.user.lastCode && <p className="text-[#00D2D3]">Последний код: {detail.user.lastCode}</p>}
                    <label>Почта<input className="w-full mt-1 bg-black/30 rounded-[10px] px-3 py-2" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></label>
                    <label>Телефон<input className="w-full mt-1 bg-black/30 rounded-[10px] px-3 py-2" value={editPhone} onChange={(e) => setEditPhone(editPhoneMask(editPhone, e.target.value))} /></label>
                    <label className="block">
                      Пароль клиента
                      <input
                        className="w-full mt-1 bg-black/30 rounded-[10px] px-3 py-2 text-[#00D2D3]"
                        value={editPass}
                        onChange={(e) => setEditPass(e.target.value)}
                        placeholder="новый пароль, от 8 символов"
                        autoComplete="off"
                      />
                    </label>
                    <label>Баланс ₽<input className="w-full mt-1 bg-black/30 rounded-[10px] px-3 py-2" value={editBal} onChange={(e) => setEditBal(e.target.value)} /></label>
                    <label>Корректировка ₽ (+/−)<input className="w-full mt-1 bg-black/30 rounded-[10px] px-3 py-2" value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="например -500 или 1000" /></label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="px-3 py-2 rounded-[10px] text-[#0B1A1A]" style={{ background: "#00D2D3" }} onClick={() => void adminReq("/api/admin/users/" + encodeURIComponent(detail.user.email), { method: "PATCH", body: JSON.stringify({ email: editEmail, phone: editPhone, balance: Number(editBal), password: editPass }) }).then(() => { void loadList(); setSel(editEmail.trim().toLowerCase()); })}>Сохранить</button>
                      <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void userOp("adjust", { amount: Number(adjust), comment: "Ручная корректировка" })}>Провести корректировку</button>
                      {detail.user.frozen ? (
                        <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void userOp("unfreeze")}>Разморозить счёт</button>
                      ) : (
                        <button type="button" className="px-3 py-2 rounded-[10px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.1)" }} onClick={() => {
                          const reason = prompt("Причина заморозки счёта");
                          if (reason === null) return;
                          void userOp("freeze", { reason: reason.trim() || "Заморозка администратором: подозрение на мошенничество" });
                        }}>Заморозить счёт</button>
                      )}
                      <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void userOp("kick")}>Сбросить сессии</button>
                      <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => {
                        const password = prompt("Новый пароль (от 8 символов)");
                        if (password) void userOp("password", { password });
                      }}>Сменить пароль</button>
                      <button type="button" className="px-3 py-2 rounded-[10px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.1)" }} onClick={() => {
                        if (!confirm("Удалить пользователя и все его данные?")) return;
                        void adminReq("/api/admin/users/" + encodeURIComponent(detail.user.email), { method: "DELETE" }).then(() => { setSel(null); void loadList(); });
                      }}>Удалить</button>
                    </div>
                    {actionMsg && <p className="text-[#00D2D3]">{actionMsg}</p>}
                    <p className="uppercase text-[11px] tracking-wider text-[rgba(185,202,203,0.45)] mt-2">Операции</p>
                    <div className="max-h-48 overflow-y-auto">
                      {detail.txs.map((t) => (
                        <div key={t.id} className="py-1.5 border-b border-white/5">
                          <p>{new Date(t.createdAt).toLocaleString("ru-RU")} · {t.name} · {money(t.amount)} · <FraudMark label={t.riskLabel} score={t.riskScoreExact} ticks={t.riskScore} bar={t.riskBar} /> {t.status === "held" ? <span className="text-[#FFB4AB]">ЗАМОРОЖЕНА</span> : t.status === "rejected" ? <span className="text-[#FFB4AB]">ОТКЛОНЕНА</span> : null}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.status === "held" ? (
                              <>
                                <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#0B1A1A]" style={{ background: "#00D2D3" }} onClick={() => void txOp(t.id, "release")}>Провести</button>
                                <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.12)" }} onClick={() => void txOp(t.id, "reject")}>Вернуть</button>
                              </>
                            ) : t.status !== "rejected" ? (
                              <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.12)" }} onClick={() => void txOp(t.id, "hold", { reason: "Заморозка администратором" })}>Заморозить операцию</button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="uppercase text-[11px] tracking-wider text-[rgba(185,202,203,0.45)]">Контакты</p>
                    {detail.contacts.map((c) => <p key={c.phone}>{c.name} · {c.phone}</p>)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "ops" && (
          <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
            {actionMsg && <p className="text-[#00D2D3] text-[13px] mb-2">{actionMsg}</p>}
            <div className="flex flex-wrap gap-2 mb-3">
              <input value={opsQ} onChange={(e) => setOpsQ(e.target.value)} placeholder="Поиск по почте, имени, получателю" className="flex-1 min-w-[200px] bg-black/30 rounded-[10px] px-3 py-2 text-[13px] outline-none" />
              <select value={opsType} onChange={(e) => setOpsType(e.target.value)} className="bg-black/30 rounded-[10px] px-3 py-2 text-[13px]">
                <option value="">Все</option>
                <option value="out">Списания</option>
                <option value="in">Зачисления</option>
                <option value="held">Замороженные</option>
                <option value="rejected">Отклонённые</option>
              </select>
              <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3] text-[13px]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void adminReq<{ rows: unknown[] }>("/api/admin/export?kind=txs").then((d) => downloadJson("txs.json", d.rows))}>Экспорт JSON</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto text-[13px]">
              {ops.map((t) => (
                <div key={t.id} className="py-2 border-b border-white/5">
                  <p>
                    <span className="text-[rgba(185,202,203,0.5)]">{new Date(t.createdAt).toLocaleString("ru-RU")}</span>
                    {" · "}
                    <span className="text-[#00D2D3]">{t.email}</span>
                    {" · "}
                    {t.name} · <span style={{ color: t.amount < 0 ? "#FFB4AB" : "#48FFD5" }}>{money(t.amount)}</span>
                    {t.counterparty ? ` · ${t.counterparty}` : ""}
                    {t.status === "held" ? <span className="text-[#FFB4AB]"> · ЗАМОРОЖЕНА</span> : null}
                    {t.status === "rejected" ? <span className="text-[#FFB4AB]"> · ОТКЛОНЕНА</span> : null}
                    {" · "}
                    <FraudMark label={t.riskLabel} score={t.riskScoreExact} ticks={t.riskScore} bar={t.riskBar} />
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.status === "held" ? (
                      <>
                        <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#0B1A1A]" style={{ background: "#00D2D3" }} onClick={() => void txOp(t.id, "release")}>Провести</button>
                        <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.12)" }} onClick={() => void txOp(t.id, "reject")}>Вернуть</button>
                        <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void userOpEmail(t.email, "unfreeze")}>Разморозить счёт</button>
                      </>
                    ) : t.status !== "rejected" ? (
                      <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.12)" }} onClick={() => void txOp(t.id, "hold", { reason: "Заморозка администратором: подозрение на мошенничество" })}>Заморозить счёт и операцию</button>
                    ) : null}
                  </div>
                </div>
              ))}
              {ops.length === 0 && <p className="text-[rgba(185,202,203,0.45)] py-6">Нет операций</p>}
            </div>
          </div>
        )}

        {tab === "ml" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
              <p className="text-[16px] font-medium">Как считается оценка</p>
              <p className="text-[13px] text-[rgba(185,202,203,0.7)] mt-2 leading-relaxed">
                Рядом с операцией два поля модели. <b className="text-[#FFB4AB]">Фрод / Норма</b> берётся только из <b>anomaly</b>: ниже порога 0.71 — Норма, от 0.71 — Фрод и платёж отклоняется. Число — <b>round(final_score × 100) / 100</b>, это не вероятность. Шкала — <b>min(100, round(final_score × 100))</b>; если скор выше 1, число на экране больше 100, полоска упирается в 100. 66/100 ещё может быть Норма, 71/100 — уже Фрод, если так сказала метка. Клиенту ни метка, ни число не отдаются.
              </p>
              <p className="text-[12px] text-[#00D2D3] mt-2">{mlMsg}</p>

              <div className="mt-4">
                <p className="text-[14px] font-medium mb-2">Фичи, используемые для обучения модели антифрода</p>
                <ol className="text-[13px] text-[rgba(185,202,203,0.8)] list-decimal pl-5 space-y-1">
                  {(ml?.features?.fraudFeatures || [
                    { name: "log_amount", desc: "log1p от абсолютной суммы операции" },
                    { name: "amount_to_avg_ratio", desc: "во сколько раз операция превышает средний чек счёта" },
                    { name: "hour", desc: "час суток (0-23)" },
                    { name: "is_night", desc: "ночная операция с 23:00 до 06:00 (0 или 1)" },
                    { name: "login_attempts", desc: "количество попыток входа (от 1 и выше)" },
                    { name: "is_new_payee", desc: "флаг первого перевода новому получателю (0 или 1)" },
                    { name: "time_since_last_transaction", desc: "секунды после последней транзакции пользователя" },
                    { name: "is_new_device", desc: "пара аккаунт и устройство встретилась впервые" },
                    { name: "amount_to_balance", desc: "сумма операции, делённая на баланс до проводки" },
                  ]).map((f) => (
                    <li key={f.name}><code className="text-[#00D2D3]">{f.name}</code> — {f.desc}</li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="px-3 py-2 rounded-[10px] text-[#0B1A1A] text-[13px]" style={{ background: "#00D2D3" }} onClick={() => void adminReq<MlReport>("/api/admin/ml").then(setMl)}>Пересчитать</button>
                <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3] text-[13px]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void adminReq("/api/admin/ml/features").then((d) => downloadJson("ml-features.json", d))}>Скачать фичи</button>
                <button type="button" className="px-3 py-2 rounded-[10px] text-[#00D2D3] text-[13px]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void adminReq<{ rows: unknown[] }>("/api/admin/export?kind=users").then((d) => downloadJson("users.json", d.rows))}>Экспорт клиентов</button>
              </div>
            </div>

            {ml && (
              <>
                <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
                  <p className="text-[14px] font-medium mb-1">Оборот: факт (7 дн.) и прогноз ({ml.horizonDays} дн.)</p>
                  <p className="text-[12px] text-[rgba(185,202,203,0.55)] mb-3">
                    Сегодня: {money((ml.today?.volumeOut || 0) + (ml.today?.volumeIn || 0))} · списания {money(ml.today?.volumeOut || 0)} · пополнения {money(ml.today?.volumeIn || 0)} · операций {ml.today?.txCount || 0}
                  </p>
                  <div className="flex items-end gap-1 h-36">
                    {[...(ml.history || []), ...ml.forecast].map((f) => {
                      const series = [...(ml.history || []), ...ml.forecast];
                      const val = f.volume ?? ((f.volumeOut || 0) + (f.volumeIn || 0));
                      const max = Math.max(...series.map((x) => x.volume ?? ((x.volumeOut || 0) + (x.volumeIn || 0))), 1);
                      const h = Math.max(6, Math.round((val / max) * 120));
                      return (
                        <div key={f.date} className="flex-1 flex flex-col items-center justify-end">
                          <div className="w-full rounded-t-[6px]" style={{ height: h, background: f.actual ? "linear-gradient(#00D2D3,#48FFD5)" : "linear-gradient(#3d5c5c,#6aa8a8)" }} />
                          <p className="text-[9px] text-[rgba(185,202,203,0.5)] mt-1">{f.date.slice(5)}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-[12px] text-[rgba(185,202,203,0.7)]">
                    {(ml.history || []).map((f) => (
                      <span key={f.date} className="mr-3">{f.date}: {money(f.volume ?? 0)} факт</span>
                    ))}
                    {ml.forecast.map((f) => (
                      <span key={f.date} className="mr-3">{f.date}: {money(f.volume ?? f.volumeOut)} прогноз</span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
                  <p className="text-[14px] font-medium mb-2">Все операции · новые сверху</p>
                  {(ml.scored || []).length === 0 && <p className="text-[13px] text-[rgba(185,202,203,0.45)]">Пока нет операций</p>}
                  {(ml.scored || []).slice(0, 40).map((a) => (
                    <div key={a.id} className="text-[12px] py-1.5 border-b border-white/5">
                      <p>
                        <span className="text-[rgba(185,202,203,0.5)]">{a.createdAt ? new Date(a.createdAt).toLocaleString("ru-RU") : ""}</span>
                        {" · "}
                        <FraudMark label={a.label} score={a.scoreExact} ticks={a.score} bar={a.scoreBar} />
                        {" · "}
                        {a.email} · {money(a.amount)}
                        {a.counterparty ? ` · ${a.counterparty}` : ""}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[20px] p-4" style={{ background: "#191C1C" }}>
                  <p className="text-[14px] font-medium mb-2">Фрод · anomaly = 1</p>
                  {ml.anomalies.length === 0 && <p className="text-[13px] text-[rgba(185,202,203,0.45)]">Модель не пометила ни одной операции</p>}
                  {ml.anomalies.slice(0, 40).map((a) => (
                    <div key={a.id} className="text-[12px] py-1.5 border-b border-white/5">
                      <p>
                        <span className="text-[rgba(185,202,203,0.5)]">{a.createdAt ? new Date(a.createdAt).toLocaleString("ru-RU") : ""}</span>
                        {" · "}
                        <FraudMark label={a.label} score={a.scoreExact} ticks={a.score} bar={a.scoreBar} />
                        {" · "}
                        {a.email} · {money(a.amount)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#FFB4AB]" style={{ background: "rgba(255,180,171,0.12)" }} onClick={() => void txOp(a.id, "hold", { reason: "Антифрод: подозрение на мошенничество" })}>Заморозить</button>
                        <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#0B1A1A]" style={{ background: "#00D2D3" }} onClick={() => void txOp(a.id, "release")}>Провести</button>
                        <button type="button" className="px-2 py-1 rounded-[8px] text-[11px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.12)" }} onClick={() => void userOpEmail(a.email, "unfreeze")}>Разморозить счёт</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
