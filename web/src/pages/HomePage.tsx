import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../api";
import { formatHomeDate, formatRub, formatTxDate, greetingByHour, useWallet } from "../wallet";

const ADVICE_KEY = "alfa-recommendation";

interface HomePageProps {
  onNavigate: (page: string, extra?: string) => void;
}

const quickActions = [
  { icon: "sync_alt", label: "Перевод", page: "transfer" },
  { icon: "qr_code_scanner", label: "Оплата QR", page: "qr" },
  { icon: "add_circle", label: "Пополнить", page: "topup" },
  { icon: "tune", label: "Лимиты", page: "limits" },
];


function Card({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={`rounded-[28px] ${className || ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const { user, wallet, txs, notes, flashIds } = useWallet();
  const [now, setNow] = useState(() => new Date());
  const [advice, setAdvice] = useState("");
  const [adviceWait, setAdviceWait] = useState(true);
  const [canDiscuss, setCanDiscuss] = useState(false);
  useEffect(() => {
    const saved = sessionStorage.getItem(ADVICE_KEY) || "";
    if (saved) {
      setAdvice(saved);
      setCanDiscuss(true);
      setAdviceWait(false);
      return;
    }
    let stop = false;
    api.recommendation().then((res) => {
      if (stop) return;
      if (res.recommendation) {
        setAdvice(res.recommendation);
        setCanDiscuss(true);
        sessionStorage.setItem(ADVICE_KEY, res.recommendation);
      } else {
        setAdvice(res.recommendation_error || res.error || "Рекомендация сейчас недоступна");
      }
      setAdviceWait(false);
    }).catch((err: Error) => {
      if (stop) return;
      setAdvice(err.message || "Рекомендация сейчас недоступна");
      setAdviceWait(false);
    });
    return () => { stop = true; };
  }, []);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  const balance = wallet?.balance ?? 0;
  const unread = notes.filter((n) => !n.read).length;
  const recentTx = [...txs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const monthTx = txs.filter((t) => t.createdAt >= monthStart && t.createdAt < monthEnd && t.status !== "rejected");
  const spent = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(0, daysInMonth - day);
  const expected = day > 0 ? Math.round((spent / day) * daysLeft) : 0;
  const hidden = !!wallet?.hideBalance;
  const frozen = !!user?.frozen;
  return (
    <div className="flex-1 overflow-y-auto pb-4 px-4 sm:px-6 pt-2 max-w-[920px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <div className="flex items-center gap-3">
          <div
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(var(--avatar-from), var(--avatar-to))" }}
          >
            <span className="text-[var(--ink)] text-[18px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>{user?.firstName.charAt(0) || "И"}</span>
          </div>
          <div>
            <p className="text-[var(--ink)] text-[20px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
              {greetingByHour(now)}, {user?.firstName || "Иван"}
            </p>
            <p className="text-[var(--muted-60)] text-[12px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
              {formatHomeDate(now)}
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate("notifications")}
          className="relative w-[44px] h-[44px] rounded-full bg-[var(--card)] flex items-center justify-center pressable"
        >
          <span className="material-symbols-outlined text-[var(--accent)] text-[22px]">notifications</span>
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--danger)] text-[#0B1A1A] text-[10px] leading-4">
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* Balance card */}
      <Card
        className="mb-4 px-6 py-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(108.8deg, var(--raised) 0%, var(--card) 100%)",
          boxShadow: "0 0 40px rgba(0,242,255,0.1)",
        }}
      >
        <div className="absolute top-3 right-4">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(0,242,255,0.1)", border: "1px solid rgba(0,242,255,0.2)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--fill)]" />
            <span className="text-[var(--accent)] text-[11px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Онлайн</span>
          </div>
        </div>
        <p className="text-[var(--ink-soft)] text-[15px] mb-1" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
          Общий баланс
        </p>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-[var(--ink)] text-[34px] font-medium leading-none" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            {hidden ? "••••" : formatRub(balance)}
          </span>
          <span className="text-[var(--accent)] text-[18px] mb-0.5">₽</span>
        </div>
        <p className="text-[var(--muted-50)] text-[12px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
          Цифровой рубль · ЦР кошелёк
        </p>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {quickActions.map((a) => (
          <button
            key={a.page}
            onClick={() => onNavigate(a.page)}
            className="flex flex-col items-center gap-2 pressable"
          >
            <div
              className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
              style={{ background: "var(--raised)", boxShadow: "0 0 15px rgba(0,242,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[var(--accent)] text-[24px]">{a.icon}</span>
            </div>
            <span
              className="text-[var(--muted-90)] text-[11px] text-center leading-tight"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}
            >
              {a.label}
            </span>
          </button>
        ))}
      </div>

      {frozen && (
      <div
        className="mb-4 px-4 py-3 rounded-[20px] flex items-center gap-3"
        style={{ background: "rgba(255,180,171,0.12)", border: "1px solid rgba(255,180,171,0.35)" }}
      >
        <span className="material-symbols-outlined text-[var(--danger)] text-[22px]">ac_unit</span>
        <div className="min-w-0 flex-1">
          <p className="text-[var(--danger)] text-[13px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Счёт временно ограничен
          </p>
          <p className="text-[var(--muted-70)] text-[12px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Операции недоступны. При необходимости напишите в поддержку.
          </p>
        </div>
      </div>
      )}


      {/* Analytics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card className="p-4" style={{ background: "var(--card)" }}>
          <p
            className="text-[var(--muted-60)] text-[10px] uppercase tracking-[1px] mb-3"
            style={{ fontFamily: "'Roboto:Medium', sans-serif" }}
          >
            Расходы
          </p>
          <p className="text-[var(--danger)] text-[20px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
            {formatRub(spent)} ₽
          </p>
          <p className="text-[var(--ink-soft)] text-[11px] mt-1" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Текущие расходы в месяце
          </p>
        </Card>
        <Card className="p-4" style={{ background: "var(--card)" }}>
          <p
            className="text-[var(--muted-60)] text-[10px] uppercase tracking-[1px] mb-3"
            style={{ fontFamily: "'Roboto:Medium', sans-serif" }}
          >
            Доходы
          </p>
          <p className="text-[#228D57] text-[20px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
            {formatRub(income)} ₽
          </p>
          <p className="text-[var(--ink-soft)] text-[11px] mt-1" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Текущий доход в месяце
          </p>
        </Card>
        <Card className="p-4" style={{ background: "var(--card)" }}>
          <p
            className="text-[var(--muted-60)] text-[10px] uppercase tracking-[1px] mb-3"
            style={{ fontFamily: "'Roboto:Medium', sans-serif" }}
          >
            Прогноз
          </p>
          <p className="text-[var(--danger)] text-[20px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
            {expected > 0 ? `−${formatRub(expected)} ₽` : "0,00 ₽"}
          </p>
          <p className="text-[var(--ink-soft)] text-[11px] mt-1" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Ожидаемые расходы до конца месяца
          </p>
        </Card>
        <Card className="p-4" style={{ background: "var(--card)" }}>
          <p
            className="text-[var(--muted-60)] text-[10px] uppercase tracking-[1px] mb-3"
            style={{ fontFamily: "'Roboto:Medium', sans-serif" }}
          >
            Безопасность
          </p>
          <span className="material-symbols-outlined text-[var(--accent)] text-[22px]">security</span>
          <p className="text-[var(--ink-soft)] text-[11px] mt-1" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Проверка биометрии рекомендована
          </p>
        </Card>
      </div>

      {/* Recent transactions */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[var(--ink)] text-[17px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Последние операции
          </p>
          <button onClick={() => onNavigate("history")}>
            <span className="text-[var(--accent)] text-[13px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
              Все →
            </span>
          </button>
        </div>
        <Card style={{ background: "var(--card)" }}>
          {recentTx.length === 0 && (
            <p className="text-center text-[var(--muted-45)] text-[13px] py-8">Операций пока нет</p>
          )}
          {recentTx.map((tx, i) => (
            <button
              type="button"
              key={tx.id}
              onClick={() => onNavigate("tx", tx.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left pressable ${flashIds.includes(tx.id) ? "tx-flash" : ""}`}
              style={{ borderBottom: i < recentTx.length - 1 ? "1px solid var(--line)" : "none" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--raised)" }}
              >
                <span className="material-symbols-outlined text-[var(--accent)] text-[18px]">{tx.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--ink)] text-[14px] font-medium truncate" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                  {tx.name}
                </p>
                <p className="text-[var(--muted-60)] text-[12px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                  {formatTxDate(tx.createdAt)}{tx.status === "pending" ? " · в обработке" : ""}
                </p>
              </div>
              <span
                className="text-[14px] font-medium"
                style={{
                  fontFamily: "'Roboto:Medium', sans-serif",
                  color: tx.type === "income" ? "#228D57" : "var(--danger)",
                }}
              >
                {tx.amount > 0 ? `+${formatRub(tx.amount)} ₽` : `−${formatRub(Math.abs(tx.amount))} ₽`}
              </span>
            </button>
          ))}
        </Card>
      </div>

      {(wallet?.savings?.length || 0) > 0 && (
      <>
      <p className="text-[var(--ink)] text-[17px] font-medium mb-3" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
        Копилки
      </p>
      {(wallet?.savings || []).map((s) => (
        <Card
          key={s.id}
          className="px-6 py-5 mb-3 relative overflow-hidden"
          style={{
            background: "linear-gradient(108.8deg, var(--raised) 0%, var(--card) 100%)",
            boxShadow: "0 0 40px rgba(0,242,255,0.08)",
          }}
        >
          <p className="text-[var(--ink-soft)] text-[15px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>{s.name}</p>
          <p className="flex items-baseline gap-1.5 mt-1 leading-none">
            <span className="text-[var(--ink)] text-[30px] font-medium tabular-nums" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
              {hidden ? "••••" : formatRub(s.amount)}
            </span>
            <span className="text-[var(--accent)] text-[18px] font-medium">₽</span>
          </p>
        </Card>
      ))}
      </>
      )}

      <Card className="px-4 py-4 mb-3" style={{ background: "var(--card)" }}>
        <p className="text-[var(--muted-60)] text-[10px] uppercase tracking-[1px] mb-2" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
          Рекомендация
        </p>
        <p className="text-[var(--ink)] text-[13px] leading-snug" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
          {adviceWait ? "Собираем рекомендацию…" : advice}
        </p>
        <button
          type="button"
          disabled={adviceWait || !canDiscuss}
          onClick={() => onNavigate("discuss")}
          className="mt-3 h-[32px] px-3 rounded-full text-[12px] font-medium pressable"
          style={{
            background: adviceWait || !canDiscuss ? "var(--avatar-from)" : "linear-gradient(128deg, var(--fill), var(--fill-2))",
            color: adviceWait || !canDiscuss ? "var(--disabled-ink)" : "#0B1A1A",
          }}
        >
          Обсудить рекомендацию
        </button>
      </Card>
    </div>
  );
}
