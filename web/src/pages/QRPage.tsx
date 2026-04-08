import { useState } from "react";
import { useWallet } from "../wallet";

interface QRPageProps {
  onBack: () => void;
}

function QRPattern({ size = 200 }: { size?: number }) {
  const cells = 21;
  const cellSize = size / cells;
  const pattern: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if ((r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)) return true;
      return Math.abs(Math.sin(r * 3.7 + c * 2.1)) > 0.45;
    })
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#1A2426" rx="12" />
      {pattern.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize + 1}
              y={r * cellSize + 1}
              width={cellSize - 2}
              height={cellSize - 2}
              fill="#00D2D3"
              rx="1"
            />
          ) : null
        )
      )}
      {/* Corner squares */}
      {[[0, 0], [0, cells - 7], [cells - 7, 0]].map(([r, c], i) => (
        <g key={i}>
          <rect x={c * cellSize} y={r * cellSize} width={7 * cellSize} height={7 * cellSize}
            fill="none" stroke="#00D2D3" strokeWidth="2" rx="3" />
          <rect x={c * cellSize + cellSize + 1} y={r * cellSize + cellSize + 1}
            width={5 * cellSize - 2} height={5 * cellSize - 2} fill="#00D2D3" rx="2" />
          <rect x={c * cellSize + 2 * cellSize + 1} y={r * cellSize + 2 * cellSize + 1}
            width={3 * cellSize - 2} height={3 * cellSize - 2} fill="#1A2426" rx="1" />
        </g>
      ))}
    </svg>
  );
}

export default function QRPage({ onBack }: QRPageProps) {
  const { qrPay } = useWallet();
  const [tab, setTab] = useState<"generate" | "scan">("generate");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
        </button>
        <p className="text-[#E0E0E0] text-[20px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>QR-код</p>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mb-6 bg-[#191C1C] rounded-[16px] p-1">
        {([["generate", "Мой QR"], ["scan", "Сканировать"]] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as "generate" | "scan")}
            className="flex-1 py-2.5 rounded-[12px] text-[13px] font-medium transition-all"
            style={{
              fontFamily: "'Roboto:Medium', sans-serif",
              background: tab === key ? "#282A2A" : "transparent",
              color: tab === key ? "#00D2D3" : "rgba(185,202,203,0.6)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <div className="px-4 flex flex-col items-center">
          <div
            className="p-5 rounded-[28px] mb-5"
            style={{
              background: "linear-gradient(108.8deg, #282A2A 0%, #191C1C 100%)",
              boxShadow: "0 0 40px rgba(0,242,255,0.12)",
            }}
          >
            <QRPattern size={220} />
            <p className="text-center text-[#B9CACB] text-[12px] mt-4" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
              Иван Иванов · ЦР кошелёк
            </p>
            <p className="text-center text-[rgba(185,202,203,0.5)] text-[11px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
              +7 (900) 123-45-67
            </p>
          </div>

          <div className="w-full mb-4">
            <p className="text-[rgba(185,202,203,0.7)] text-[12px] uppercase tracking-[1px] mb-2"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Указать сумму (необязательно)</p>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00 ₽"
              className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[17px] px-4 py-3.5 text-[#E0E0E0] text-[16px] outline-none focus:border-[rgba(0,210,211,0.5)] placeholder-[#445456] transition-colors"
              style={{ fontFamily: "'Manrope:Regular', sans-serif" }}
            />
          </div>

          <button
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[17px] border border-[rgba(0,210,211,0.3)]"
            style={{ background: "rgba(0,210,211,0.05)" }}
          >
            <span className="material-symbols-outlined text-[#00D2D3] text-[20px]">share</span>
            <span className="text-[#00D2D3] text-[15px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Поделиться QR</span>
          </button>
        </div>
      ) : (
        <div className="px-4 flex flex-col items-center">
          <div
            className="w-full aspect-square rounded-[28px] overflow-hidden mb-5 flex items-center justify-center relative"
            style={{ background: "#0B1A1A", maxWidth: 300 }}
          >
            {/* Simulated scanner viewfinder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[200px] h-[200px]">
                {/* Corner markers */}
                {[
                  "top-0 left-0 border-t-2 border-l-2",
                  "top-0 right-0 border-t-2 border-r-2",
                  "bottom-0 left-0 border-b-2 border-l-2",
                  "bottom-0 right-0 border-b-2 border-r-2",
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-[#00D2D3] rounded-[4px] ${cls}`} />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-full h-0.5 opacity-60"
                    style={{ background: "linear-gradient(90deg, transparent, #00D2D3, transparent)" }}
                  />
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined text-[rgba(0,210,211,0.15)] text-[120px]">qr_code_scanner</span>
          </div>

          <p className="text-center text-[#E0E0E0] text-[16px] mb-2" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Наведите камеру на QR-код
          </p>
          <p className="text-center text-[rgba(185,202,203,0.5)] text-[13px] mb-6" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Для оплаты или получения перевода
          </p>

          <button
            onClick={async () => {
              const err = await qrPay(150);
              setPaid(err || "Оплачено 150 ₽");
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-[17px]"
            style={{ background: "rgba(0,210,211,0.1)", border: "1px solid rgba(0,210,211,0.3)" }}
          >
            <span className="material-symbols-outlined text-[#00D2D3] text-[18px]">qr_code_scanner</span>
            <span className="text-[#00D2D3] text-[14px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Демо: оплатить 150 ₽</span>
          </button>
          {paid && <p className="text-[#00D2D3] text-[13px] mt-3">{paid}</p>}
        </div>
      )}
      <div className="h-8" />
    </div>
  );
}
