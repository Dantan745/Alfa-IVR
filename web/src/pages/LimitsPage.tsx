import { useState } from "react";
import { useWallet } from "../wallet";

interface LimitsPageProps {
  onBack: () => void;
}

const DEFAULTS = {
  day: 50000,
  month: 100000,
  op: 30000,
  abroad: 10000,
  alertDay: 80,
  alertMonth: 70,
  alertOp: 90,
  alertAbroad: 100,
};

export default function LimitsPage({ onBack }: LimitsPageProps) {
  const { wallet, updateLimits } = useWallet();
  const L = { ...DEFAULTS, ...(wallet?.limits || {}) };
  const usage = wallet?.usage || { day: 0, month: 0, abroad: 0 };
  const [editing, setEditing] = useState<null | "day" | "month" | "op" | "abroad">(null);
  const [editVal, setEditVal] = useState("");
  const [alertPct, setAlertPct] = useState("");
  const [err, setErr] = useState("");

  const rows = [
    { key: "day" as const, name: "Дневной лимит переводов", current: usage.day, max: L.day, unit: "₽/день", alert: L.alertDay },
    { key: "month" as const, name: "Месячный лимит расходов", current: usage.month, max: L.month, unit: "₽/мес", alert: L.alertMonth },
    { key: "op" as const, name: "Лимит одной операции", current: Math.min(usage.day, L.op), max: L.op, unit: "₽", alert: L.alertOp },
    { key: "abroad" as const, name: "Лимит переводов за рубеж", current: usage.abroad, max: L.abroad, unit: "₽/день", alert: L.alertAbroad },
  ];

  async function saveEdit() {
    if (!editing) return;
    const max = Number(editVal);
    const alert = Number(alertPct);
    if (!(max > 0)) {
      setErr("Укажите положительный лимит");
      return;
    }
    const patch: Record<string, number> = {
      [editing]: max,
      ["alert" + editing.charAt(0).toUpperCase() + editing.slice(1)]: Math.min(100, Math.max(1, alert || 80)),
    };
    if (editing === "day") patch.alertDay = Math.min(100, Math.max(1, alert || L.alertDay));
    if (editing === "month") patch.alertMonth = Math.min(100, Math.max(1, alert || L.alertMonth));
    if (editing === "op") patch.alertOp = Math.min(100, Math.max(1, alert || L.alertOp));
    if (editing === "abroad") patch.alertAbroad = Math.min(100, Math.max(1, alert || L.alertAbroad));
    const fail = await updateLimits({ ...L, ...patch });
    if (fail) {
      setErr(fail);
      return;
    }
    setEditing(null);
    setErr("");
  }

  if (editing) {
    const l = rows.find((r) => r.key === editing)!;
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center px-4 pt-4 pb-3 gap-3">
          <button onClick={() => setEditing(null)} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
          </button>
          <p className="text-[var(--ink)] text-[18px] font-medium">Изменить лимит</p>
        </div>
        <div className="px-4">
          <p className="text-[var(--muted-70)] text-[14px] mb-5">{l.name}</p>
          <p className="text-[var(--muted-50)] text-[12px] mb-4">Сейчас использовано: {l.current.toLocaleString("ru-RU")} ₽</p>
          <div className="mb-4">
            <p className="text-[var(--muted-70)] text-[12px] uppercase tracking-[1px] mb-2">Максимальная сумма (₽)</p>
            <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)} className="w-full bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[17px] px-4 py-3.5 text-[var(--ink)] text-[16px] outline-none" />
          </div>
          <div className="mb-6">
            <p className="text-[var(--muted-70)] text-[12px] uppercase tracking-[1px] mb-2">Уведомить при достижении (%)</p>
            <input type="number" value={alertPct} onChange={(e) => setAlertPct(e.target.value)} className="w-full bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[17px] px-4 py-3.5 text-[var(--ink)] text-[16px] outline-none" />
          </div>
          {err && <p className="text-[var(--danger)] text-[13px] mb-3">{err}</p>}
          <button onClick={() => void saveEdit()} className="w-full rounded-[17px] h-[52px] font-medium text-[18px]" style={{ background: "linear-gradient(128deg, var(--fill) 0%, var(--fill-2) 51%, var(--fill) 100%)", color: "#0B1A1A" }}>
            Сохранить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center">
          <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
        </button>
        <p className="text-[var(--ink)] text-[20px] font-medium">Лимиты</p>
      </div>
      <div className="mx-4 mb-5 px-4 py-3 rounded-[18px] flex items-center gap-3" style={{ background: "rgba(0,210,211,0.07)", border: "1px solid rgba(0,210,211,0.2)" }}>
        <span className="material-symbols-outlined text-[var(--accent)] text-[20px]">info</span>
        <p className="text-[var(--muted-80)] text-[13px]">
          Счётчики считаются по реальным переводам. Перевод сверх лимита будет отклонён.
        </p>
      </div>
      <div className="px-4">
        {rows.map((limit) => {
          const pct = limit.max ? Math.min(100, Math.round((limit.current / limit.max) * 100)) : 0;
          const isWarning = pct >= limit.alert;
          return (
            <div key={limit.key} className="px-4 py-4 rounded-[24px] mb-3" style={{ background: "var(--card)", border: isWarning ? "1px solid rgba(255,180,171,0.3)" : "1px solid transparent" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[var(--ink)] text-[14px] font-medium">{limit.name}</p>
                  <p className="text-[var(--muted-50)] text-[12px]">{limit.unit}</p>
                </div>
                <button
                  onClick={() => {
                    setEditing(limit.key);
                    setEditVal(String(limit.max));
                    setAlertPct(String(limit.alert));
                    setErr("");
                  }}
                  className="w-8 h-8 rounded-full bg-[var(--raised)] flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[var(--accent)] text-[16px]">edit</span>
                </button>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--raised)] mb-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isWarning ? "linear-gradient(90deg, var(--danger), var(--danger-strong))" : "linear-gradient(90deg, var(--fill), var(--fill-2))" }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: isWarning ? "var(--danger)" : "var(--muted-60)" }}>
                  {limit.current.toLocaleString("ru-RU")} из {limit.max.toLocaleString("ru-RU")} ₽
                </span>
                <span className="text-[12px] font-medium" style={{ color: isWarning ? "var(--danger)" : "var(--accent)" }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-6" />
    </div>
  );
}
