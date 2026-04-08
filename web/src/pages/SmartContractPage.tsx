import { useState } from "react";

interface SmartContractProps {
  onBack: () => void;
}

type TriggerType = "date" | "balance" | "event";
type FreqType = "once" | "daily" | "weekly" | "monthly";

interface Contract {
  id: number;
  name: string;
  trigger: string;
  amount: number;
  recipient: string;
  active: boolean;
  nextRun: string;
}

const initialContracts: Contract[] = [
  { id: 1, name: "Аренда квартиры", trigger: "1 число месяца", amount: 25000, recipient: "Петров А.С.", active: true, nextRun: "1 окт 2026" },
  { id: 2, name: "Пополнение копилки", trigger: "Каждую пятницу", amount: 2000, recipient: "Копилка 1", active: true, nextRun: "19 сен 2026" },
  { id: 3, name: "Страховой взнос", trigger: "15 числа", amount: 5500, recipient: "Страховая СК", active: false, nextRun: "Пауза" },
];

export default function SmartContractPage({ onBack }: SmartContractProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("date");
  const [freq, setFreq] = useState<FreqType>("monthly");
  const [day, setDay] = useState("1");

  function toggleActive(id: number) {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  }

  function addContract() {
    if (!name || !amount || !recipient) return;
    const triggerLabel = freq === "monthly" ? `${day} число месяца` :
      freq === "weekly" ? "Каждую неделю" :
      freq === "daily" ? "Каждый день" : "Один раз";
    setContracts(prev => [...prev, {
      id: Date.now(),
      name,
      trigger: triggerLabel,
      amount: parseInt(amount),
      recipient,
      active: true,
      nextRun: "20 сен 2026",
    }]);
    setCreating(false);
    setName(""); setAmount(""); setRecipient("");
  }

  const triggers: { key: TriggerType; label: string; icon: string }[] = [
    { key: "date", label: "По дате", icon: "event" },
    { key: "balance", label: "По балансу", icon: "account_balance_wallet" },
    { key: "event", label: "По событию", icon: "bolt" },
  ];

  const freqs: { key: FreqType; label: string }[] = [
    { key: "once", label: "Один раз" },
    { key: "daily", label: "Каждый день" },
    { key: "weekly", label: "Каждую неделю" },
    { key: "monthly", label: "Ежемесячно" },
  ];

  if (creating) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center px-4 pt-4 pb-3 gap-3">
          <button onClick={() => setCreating(false)} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
          </button>
          <p className="text-[#E0E0E0] text-[20px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Новый смарт-контракт
          </p>
        </div>

        <div className="px-4">
          {/* Visual builder */}
          <div
            className="p-4 rounded-[24px] mb-5"
            style={{ background: "#191C1C", border: "1px solid rgba(0,210,211,0.15)" }}
          >
            <p className="text-[rgba(185,202,203,0.6)] text-[11px] uppercase tracking-[1px] mb-3"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Визуальный конструктор</p>

            <div className="flex items-center gap-2 mb-4">
              {triggers.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTrigger(t.key)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-[14px] transition-all"
                  style={{
                    background: trigger === t.key ? "rgba(0,210,211,0.12)" : "rgba(255,255,255,0.03)",
                    border: trigger === t.key ? "1px solid rgba(0,210,211,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]"
                    style={{ color: trigger === t.key ? "#00D2D3" : "rgba(185,202,203,0.4)" }}>{t.icon}</span>
                  <span className="text-[10px]" style={{
                    fontFamily: "'Roboto:Medium', sans-serif",
                    color: trigger === t.key ? "#00D2D3" : "rgba(185,202,203,0.4)",
                  }}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Flow visualization */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 w-full px-2 py-2 rounded-[12px]"
                style={{ background: "rgba(0,210,211,0.06)" }}>
                <span className="material-symbols-outlined text-[#00D2D3] text-[16px]">
                  {trigger === "date" ? "event" : trigger === "balance" ? "account_balance_wallet" : "bolt"}
                </span>
                <span className="text-[#00D2D3] text-[12px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                  {trigger === "date" ? "Срабатывает по расписанию" : trigger === "balance" ? "При изменении баланса" : "По внешнему событию"}
                </span>
              </div>
              <div className="w-px h-4 bg-[rgba(0,210,211,0.3)]" />
              <div className="flex items-center gap-2 w-full px-2 py-2 rounded-[12px]"
                style={{ background: "rgba(0,210,211,0.06)" }}>
                <span className="material-symbols-outlined text-[#00D2D3] text-[16px]">sync_alt</span>
                <span className="text-[#00D2D3] text-[12px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                  Выполнить перевод {amount ? `${parseInt(amount).toLocaleString("ru-RU")} ₽` : "___"}
                </span>
              </div>
              <div className="w-px h-4 bg-[rgba(0,210,211,0.3)]" />
              <div className="flex items-center gap-2 w-full px-2 py-2 rounded-[12px]"
                style={{ background: "rgba(0,210,211,0.06)" }}>
                <span className="material-symbols-outlined text-[#00D2D3] text-[16px]">person</span>
                <span className="text-[#00D2D3] text-[12px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                  Получатель: {recipient || "___"}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          {[
            { label: "Название", value: name, set: setName, ph: "Оплата аренды" },
            { label: "Сумма (₽)", value: amount, set: setAmount, ph: "0,00" },
            { label: "Получатель", value: recipient, set: setRecipient, ph: "Номер телефона или ID" },
          ].map(f => (
            <div key={f.label} className="mb-4">
              <p className="text-[rgba(185,202,203,0.7)] text-[12px] uppercase tracking-[1px] mb-2"
                style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>{f.label}</p>
              <input
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[17px] px-4 py-3.5 text-[#E0E0E0] text-[15px] outline-none focus:border-[rgba(0,210,211,0.5)] placeholder-[#445456] transition-colors"
                style={{ fontFamily: "'Manrope:Regular', sans-serif" }}
              />
            </div>
          ))}

          <div className="mb-5">
            <p className="text-[rgba(185,202,203,0.7)] text-[12px] uppercase tracking-[1px] mb-2"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Периодичность</p>
            <div className="grid grid-cols-2 gap-2">
              {freqs.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFreq(f.key)}
                  className="py-2.5 rounded-[14px] text-[13px] transition-all"
                  style={{
                    fontFamily: "'Roboto:Medium', sans-serif",
                    background: freq === f.key ? "rgba(0,210,211,0.12)" : "rgba(255,255,255,0.03)",
                    border: freq === f.key ? "1px solid rgba(0,210,211,0.4)" : "1px solid rgba(255,255,255,0.06)",
                    color: freq === f.key ? "#00D2D3" : "rgba(185,202,203,0.5)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={addContract}
            className="w-full rounded-[17px] h-[52px] font-medium text-[18px] mb-4"
            style={{
              fontFamily: "'Roboto:Medium', sans-serif",
              background: "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)",
              color: "#0B1A1A",
              boxShadow: "0 0 30px rgba(72,255,213,0.3)",
            }}
          >
            Создать контракт
          </button>
        </div>
        <div className="h-6" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
          </button>
          <p className="text-[#E0E0E0] text-[20px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Смарт-контракты
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[14px]"
          style={{ background: "rgba(0,210,211,0.12)", border: "1px solid rgba(0,210,211,0.3)" }}
        >
          <span className="material-symbols-outlined text-[#00D2D3] text-[18px]">add</span>
          <span className="text-[#00D2D3] text-[13px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Создать</span>
        </button>
      </div>

      <div
        className="mx-4 mb-4 px-4 py-3 rounded-[18px] flex items-center gap-3"
        style={{ background: "rgba(0,210,211,0.07)", border: "1px solid rgba(0,210,211,0.2)" }}
      >
        <span className="material-symbols-outlined text-[#00D2D3] text-[20px]">smart_toy</span>
        <p className="text-[rgba(185,202,203,0.8)] text-[13px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
          Автоматические платежи по условиям — без ручного управления
        </p>
      </div>

      <div className="px-4">
        {contracts.map((c) => (
          <div
            key={c.id}
            className="p-4 rounded-[24px] mb-3"
            style={{ background: "#191C1C" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[#E0E0E0] text-[15px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                  {c.name}
                </p>
                <p className="text-[rgba(185,202,203,0.5)] text-[12px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                  {c.recipient}
                </p>
              </div>
              {/* Toggle */}
              <button
                onClick={() => toggleActive(c.id)}
                className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                style={{
                  background: c.active ? "rgba(0,210,211,0.3)" : "rgba(255,255,255,0.08)",
                  border: c.active ? "1px solid rgba(0,210,211,0.5)" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{
                    left: c.active ? "calc(100% - 22px)" : "2px",
                    background: c.active ? "#00D2D3" : "rgba(185,202,203,0.3)",
                  }}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[rgba(185,202,203,0.4)] text-[14px]">schedule</span>
                <span className="text-[rgba(185,202,203,0.5)] text-[12px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                  {c.trigger}
                </span>
              </div>
              <span
                className="text-[16px] font-bold"
                style={{ fontFamily: "'Roboto:Bold', sans-serif", color: c.active ? "#00D2D3" : "rgba(185,202,203,0.4)" }}
              >
                {c.amount.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="material-symbols-outlined text-[rgba(185,202,203,0.3)] text-[12px]">event</span>
              <span className="text-[rgba(185,202,203,0.4)] text-[11px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                Следующий запуск: {c.nextRun}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="h-6" />
    </div>
  );
}
