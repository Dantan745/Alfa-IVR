// главная: приветствие, баланс, быстрые кнопки и пять последних операций
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { incomeForecast } from "../forecast";
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
  const { user, wallet, txs, notes, flashIds, createSavings, moveSavings, removeSavings } = useWallet();
  const [now, setNow] = useState(() => new Date());
  const advice = sessionStorage.getItem(ADVICE_KEY) || "";
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
  const noteList = Array.isArray(notes) ? notes : [];
  const txList = Array.isArray(txs) ? txs : [];
  const unread = noteList.filter((n) => !n.read).length;
  const recentTx = [...txList].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  // расход и приход за текущий месяц. отклонённые в сумму не берём
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const monthTx = txList.filter((t) => t.createdAt >= monthStart && t.createdAt < monthEnd && t.status !== "rejected");
  const spent = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const localForecast = incomeForecast(txList, now.getTime());
  const expected = localForecast.amount;
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
          <p className="text-[#228D57] text-[20px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
            {expected > 0 ? `+${formatRub(expected)} ₽` : "0,00 ₽"}
          </p>
          <p className="text-[var(--ink-soft)] text-[11px] mt-1" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            {`Доход на ${localForecast.month}. ${localForecast.basis}`}
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

      <SavingsBlock
        boxes={wallet?.savings || []}
        hidden={hidden}
        onCreate={createSavings}
        onMove={moveSavings}
        onRemove={removeSavings}
      />

      <Card className="px-4 py-4 mb-3" style={{ background: "var(--card)" }}>
        <p className="text-[var(--muted-60)] text-[10px] uppercase tracking-[1px] mb-2" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
          Рекомендация
        </p>
        {advice && !/gemini|error|кластер/i.test(advice) && (
        <p className="text-[var(--ink)] text-[13px] leading-snug mb-2" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
          {advice}
        </p>
        )}
        <button
          type="button"
          onClick={() => onNavigate("discuss")}
          className="h-[32px] px-3 rounded-full text-[12px] font-medium pressable"
          style={{
            background: "linear-gradient(128deg, var(--fill), var(--fill-2))",
            color: "#0B1A1A",
          }}
        >
          Обсудить рекомендацию
        </button>
      </Card>
    </div>
  );
}

function SavingsBlock({
  boxes,
  hidden,
  onCreate,
  onMove,
  onRemove,
}: {
  boxes: { id: string; name: string; amount: number }[];
  hidden: boolean;
  onCreate: (name: string) => Promise<string | null>;
  onMove: (id: string, direction: "in" | "out", amount: number) => Promise<string | null>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");

  function sumOf(id: string) {
    const n = Number(String(draft[id] || "").replace(",", "."));
    if (!(n > 0)) return 0;
    return Math.round(n * 100) / 100;
  }

  return (
    <>
      <p className="text-[var(--ink)] text-[17px] font-medium mb-3" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
        Копилки
      </p>
      {boxes.map((s) => (
        <Card key={s.id} className="px-5 py-4 mb-3" style={{ background: "var(--card)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[var(--ink)] text-[15px] font-medium">{s.name}</p>
            <p className="text-[var(--ink)] text-[20px] font-medium tabular-nums">
              {hidden ? "••••" : `${formatRub(s.amount)} ₽`}
            </p>
          </div>
          <input
            inputMode="decimal"
            placeholder="Сумма"
            value={draft[s.id] || ""}
            onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 10) }))}
            className="mt-3 w-full h-10 rounded-[12px] px-3 bg-[var(--field)] text-[var(--ink)] outline-none border border-[var(--stroke)]"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 h-10 rounded-[12px] text-[13px] font-medium text-[#0B1A1A]"
              style={{ background: "linear-gradient(128deg, var(--fill), var(--fill-2))" }}
              onClick={() => {
                const n = sumOf(s.id);
                if (!n) { setErr("Укажите сумму"); return; }
                void onMove(s.id, "in", n).then((e) => { setErr(e || ""); if (!e) setDraft((d) => ({ ...d, [s.id]: "" })); });
              }}
            >
              Положить
            </button>
            <button
              type="button"
              className="flex-1 h-10 rounded-[12px] text-[13px] font-medium text-[var(--ink)] border border-[var(--stroke)]"
              style={{ background: "var(--field)" }}
              onClick={() => {
                const n = sumOf(s.id);
                if (!n) { setErr("Укажите сумму"); return; }
                void onMove(s.id, "out", n).then((e) => { setErr(e || ""); if (!e) setDraft((d) => ({ ...d, [s.id]: "" })); });
              }}
            >
              Забрать
            </button>
          </div>
          {s.amount <= 0 && (
            <button type="button" className="mt-2 text-[12px] text-[var(--muted-60)]" onClick={() => void onRemove(s.id).then((e) => setErr(e || ""))}>
              Удалить
            </button>
          )}
        </Card>
      ))}
      <Card className="px-5 py-4 mb-3" style={{ background: "var(--card)" }}>
        <p className="text-[var(--muted-60)] text-[12px] mb-2">Новая копилка. Деньги берутся с баланса и так же возвращаются.</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Название"
            className="flex-1 h-10 rounded-[12px] px-3 bg-[var(--field)] text-[var(--ink)] outline-none border border-[var(--stroke)]"
          />
          <button
            type="button"
            className="h-10 px-3 rounded-[12px] text-[13px] font-medium text-[#0B1A1A]"
            style={{ background: "linear-gradient(128deg, var(--fill), var(--fill-2))" }}
            onClick={() => {
              void onCreate(name).then((e) => {
                setErr(e || "");
                if (!e) setName("");
              });
            }}
          >
            Создать
          </button>
        </div>
      </Card>
      {err && <p className="text-[var(--danger)] text-[12px] -mt-1 mb-3">{err}</p>}
    </>
  );
}
