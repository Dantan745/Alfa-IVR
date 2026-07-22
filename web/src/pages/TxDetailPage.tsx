import { formatFullDate, formatRub, formatTxDate, txStatusLabel, useWallet } from "../wallet";

export default function TxDetailPage({ txId, onBack, onRepeat }: { txId: string; onBack: () => void; onRepeat: () => void }) {
  const { txs } = useWallet();
  const tx = txs.find((t) => t.id === txId);

  if (!tx) {
    return (
      <div className="page-enter px-4 pt-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
        </button>
        <p className="text-[var(--muted-60)]">Операция не найдена</p>
      </div>
    );
  }

  const rows = [
    ["Статус", txStatusLabel(tx.status)],
    ["Дата", formatFullDate(tx.createdAt)],
    ["Категория", tx.category],
    ["Контрагент", tx.counterparty || tx.name],
    ["Комментарий", tx.comment || "—"],
    ["ID операции", tx.id],
    ["Комиссия", "0,00 ₽"],
    ["Баланс после", tx.balanceAfter < 0 ? "—" : `${formatRub(tx.balanceAfter)} ₽`],
  ];

  return (
    <div className="page-enter flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center pressable">
          <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
        </button>
        <p className="text-[var(--ink)] text-[20px] font-medium">Операция</p>
      </div>
      <div className="px-4 flex flex-col items-center pt-4 pb-6">
        <div className="w-16 h-16 rounded-full bg-[var(--raised)] flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-[var(--accent)] text-[28px]">{tx.icon}</span>
        </div>
        <p className="text-[var(--ink)] text-[18px] font-medium text-center">{tx.name}</p>
        <p className="text-[var(--muted-50)] text-[12px] mt-1">{formatTxDate(tx.createdAt)}</p>
        <p
          className="text-[32px] font-medium mt-3"
          style={{ color: tx.type === "income" ? "#228D57" : "var(--danger)" }}
        >
          {tx.type === "income" ? "+" : "−"}{formatRub(Math.abs(tx.amount))} ₽
        </p>
        {tx.status === "pending" ? (
          <p className="text-[var(--muted-70)] text-[12px] mt-2 text-center px-4">Операция в обработке</p>
        ) : null}
      </div>
      <div className="mx-4 rounded-[24px] overflow-hidden mb-4" style={{ background: "var(--card)" }}>
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between gap-3 px-4 py-3.5" style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none" }}>
            <span className="text-[var(--muted-55)] text-[13px]">{k}</span>
            <span className="text-[var(--ink)] text-[13px] text-right break-all">{v}</span>
          </div>
        ))}
      </div>
      {tx.type === "expense" && tx.category === "Переводы" && tx.status === "done" && (
        <div className="px-4 mb-8">
          <button
            onClick={onRepeat}
            className="w-full h-[52px] rounded-[17px] text-[16px] font-medium pressable"
            style={{ background: "linear-gradient(128deg, var(--fill) 0%, var(--fill-2) 51%, var(--fill) 100%)", color: "#0B1A1A" }}
          >
            Повторить перевод
          </button>
        </div>
      )}
    </div>
  );
}
