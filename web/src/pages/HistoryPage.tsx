import { useMemo, useState } from "react";
import { formatTxDate, useWallet } from "../wallet";

const filters = ["Все", "Расходы", "Доходы", "Переводы"];
const dateFilters = ["Сегодня", "Неделя", "Месяц", "Всё время"];

export default function HistoryPage({ onOpenTx }: { onOpenTx: (id: string) => void }) {
  const { txs, flashIds } = useWallet();
  const [filter, setFilter] = useState("Все");
  const [dateFilter, setDateFilter] = useState("Всё время");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const minTs =
      dateFilter === "Сегодня" ? startOfToday.getTime()
        : dateFilter === "Неделя" ? now - 7 * 86400000
          : dateFilter === "Месяц" ? now - 30 * 86400000
            : 0;
    return [...txs]
      .filter((tx) => {
        if (tx.createdAt < minTs) return false;
        if (filter === "Расходы" && tx.type !== "expense") return false;
        if (filter === "Доходы" && tx.type !== "income") return false;
        if (filter === "Переводы" && tx.category !== "Переводы") return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${tx.name} ${tx.counterparty} ${tx.category} ${tx.comment}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [txs, filter, dateFilter, search]);

  const totalIn = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 sm:px-6 pt-4 pb-2 max-w-[920px] mx-auto w-full">
        <p className="text-[#E0E0E0] text-[22px] font-medium mb-4" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
          История операций
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(68,84,86,0.7)] text-[20px]">
            search
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск"
            className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[17px] pl-10 pr-4 py-3 text-white text-[16px] outline-none focus:border-[rgba(0,210,211,0.5)] placeholder-[#445456] transition-colors"
            style={{ fontFamily: "'Manrope:Regular', sans-serif" }}
          />
        </div>

        {/* Date filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
          {dateFilters.map(d => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] transition-all"
              style={{
                fontFamily: "'Roboto:Medium', sans-serif",
                background: dateFilter === d ? "rgba(0,210,211,0.15)" : "rgba(255,255,255,0.04)",
                border: dateFilter === d ? "1px solid rgba(0,210,211,0.5)" : "1px solid rgba(255,255,255,0.08)",
                color: dateFilter === d ? "#00D2D3" : "rgba(185,202,203,0.7)",
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] transition-all"
              style={{
                fontFamily: "'Roboto:Medium', sans-serif",
                background: filter === f ? "#00D2D3" : "rgba(255,255,255,0.04)",
                color: filter === f ? "#0B1A1A" : "rgba(185,202,203,0.7)",
                border: filter === f ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="flex gap-3 mb-5">
          <div
            className="flex-1 px-3 py-2.5 rounded-[16px]"
            style={{ background: "rgba(34,141,87,0.1)", border: "1px solid rgba(34,141,87,0.2)" }}
          >
            <p className="text-[rgba(185,202,203,0.6)] text-[10px] uppercase tracking-[1px] mb-1"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Поступления</p>
            <p className="text-[#228D57] text-[16px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
              +{totalIn.toLocaleString("ru-RU")} ₽
            </p>
          </div>
          <div
            className="flex-1 px-3 py-2.5 rounded-[16px]"
            style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}
          >
            <p className="text-[rgba(185,202,203,0.6)] text-[10px] uppercase tracking-[1px] mb-1"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Расходы</p>
            <p className="text-[#FFB4AB] text-[16px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
              −{totalOut.toLocaleString("ru-RU")} ₽
            </p>
          </div>
        </div>
      </div>

      {/* Transactions list */}
      <div className="px-4">
        <div className="rounded-[24px] overflow-hidden" style={{ background: "#191C1C" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <span className="material-symbols-outlined text-[rgba(185,202,203,0.3)] text-[48px]">search_off</span>
              <p className="text-[rgba(185,202,203,0.5)] text-[14px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                Операции не найдены
              </p>
            </div>
          ) : (
            filtered.map((tx, i) => (
              <button
                type="button"
                key={tx.id}
                onClick={() => onOpenTx(tx.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 text-left pressable ${flashIds.includes(tx.id) ? "tx-flash" : ""}`}
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#282A2A" }}
                >
                  <span className="material-symbols-outlined text-[#00D2D3] text-[20px]">{tx.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#E0E0E0] text-[14px] font-medium truncate" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                    {tx.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[rgba(185,202,203,0.5)] text-[11px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                      {formatTxDate(tx.createdAt)}{tx.status === "pending" ? " · в обработке" : ""}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        fontFamily: "'Roboto:Medium', sans-serif",
                        background: "rgba(0,210,211,0.08)",
                        color: "rgba(0,210,211,0.7)",
                      }}
                    >
                      {tx.category}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[14px] font-medium"
                  style={{
                    fontFamily: "'Roboto:Medium', sans-serif",
                    color: tx.type === "income" ? "#228D57" : "#FFB4AB",
                  }}
                >
                  {tx.type === "income" ? "+" : "−"}{Math.abs(tx.amount).toLocaleString("ru-RU")} ₽
                </span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="h-6" />
    </div>
  );
}
