import { formatRub, formatTxDate, useWallet } from "../wallet";

interface PaymentsPageProps {
  onNavigate: (page: string, extra?: string) => void;
}

const services = [
  { icon: "sync_alt", label: "Перевод по телефону", page: "transfer", desc: "P2P мгновенно" },
  { icon: "qr_code_scanner", label: "QR-оплата", page: "qr", desc: "Сканировать или показать" },
  { icon: "upload_file", label: "Массовый платёж", page: "bulk", desc: "CSV загрузка" },
  { icon: "smart_toy", label: "Смарт-контракт", page: "smart", desc: "Автоплатежи" },
  { icon: "contacts", label: "Адресная книга", page: "address", desc: "Частые получатели" },
  { icon: "tune", label: "Лимиты", page: "limits", desc: "Настройка ограничений" },
];

export default function PaymentsPage({ onNavigate }: PaymentsPageProps) {
  const { txs } = useWallet();
  const recent = txs.slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto pb-4 px-4 sm:px-6 pt-4 max-w-[920px] mx-auto w-full">
      <p className="text-[var(--ink)] text-[22px] font-medium mb-5">Платежи</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {services.map((s) => (
          <button
            key={s.page}
            onClick={() => onNavigate(s.page)}
            className="p-4 rounded-[24px] text-left flex flex-col gap-2 pressable"
            style={{ background: "var(--card)" }}
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(0,210,211,0.1)" }}>
              <span className="material-symbols-outlined text-[var(--accent)] text-[22px]">{s.icon}</span>
            </div>
            <p className="text-[var(--ink)] text-[13px] font-medium leading-tight">{s.label}</p>
            <p className="text-[var(--muted-45)] text-[11px]">{s.desc}</p>
          </button>
        ))}
      </div>

      <p className="text-[var(--ink)] text-[17px] font-medium mb-3">Последние платежи</p>
      <div className="rounded-[24px] overflow-hidden" style={{ background: "var(--card)" }}>
        {recent.length === 0 ? (
          <p className="text-center text-[var(--muted-45)] text-[13px] py-10 px-4">
            Операций ещё нет — сделайте перевод или пополнение
          </p>
        ) : (
          recent.map((r, i) => (
            <button
              type="button"
              key={r.id}
              onClick={() => onNavigate("tx", r.id)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left pressable"
              style={{ borderBottom: i < recent.length - 1 ? "1px solid var(--line)" : "none" }}
            >
              <div className="w-10 h-10 rounded-full bg-[var(--raised)] flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--accent)] text-[18px]">{r.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--ink)] text-[14px] font-medium truncate">{r.name}</p>
                <p className="text-[var(--muted-50)] text-[12px]">{formatTxDate(r.createdAt)}</p>
              </div>
              <span className="text-[14px] font-medium" style={{ color: r.type === "income" ? "#228D57" : "var(--danger)" }}>
                {r.amount > 0 ? `+${formatRub(r.amount)} ₽` : `−${formatRub(Math.abs(r.amount))} ₽`}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
