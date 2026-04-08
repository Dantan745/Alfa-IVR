import { useState } from "react";
import { formatRub, useWallet } from "../wallet";

interface TopUpPageProps {
  onBack: () => void;
}

const presets = [500, 1000, 2500, 5000];

export default function TopUpPage({ onBack }: TopUpPageProps) {
  const { wallet, topUp } = useWallet();
  const balance = wallet?.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const n = Number(String(amount).replace(",", "."));

  async function send() {
    const err = await topUp(n);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex-1 overflow-y-auto px-5 flex flex-col">
        <Header title="Пополнение" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,210,211,0.15)", border: "2px solid #00D2D3" }}
          >
            <span className="material-symbols-outlined text-[#00D2D3] text-[40px]">check_circle</span>
          </div>
          <p className="text-[#E0E0E0] text-[24px] font-medium" style={{ fontFamily: "Roboto, sans-serif" }}>
            Кошелёк пополнен
          </p>
          <p className="text-[#00D2D3] text-[32px] font-bold" style={{ fontFamily: "Roboto, sans-serif" }}>
            +{formatRub(n)} ₽
          </p>
          <button
            onClick={onBack}
            className="w-full rounded-[17px] h-[52px] text-[18px] font-medium mt-4"
            style={{
              fontFamily: "Roboto, sans-serif",
              background: "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)",
              color: "#0B1A1A",
            }}
          >
            Готово
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Пополнение" onBack={onBack} />
      <div className="px-4">
        <p className="text-[rgba(185,202,203,0.7)] text-[12px] uppercase tracking-[1px] mb-2" style={{ fontFamily: "Roboto, sans-serif" }}>
          Сумма (₽)
        </p>
        <input
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(""); }}
          placeholder="0,00"
          className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[17px] px-4 py-3.5 text-[#E0E0E0] text-[16px] outline-none mb-4"
        />
        <div className="grid grid-cols-4 gap-2 mb-5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className="py-2 rounded-[12px] text-[13px] text-[#00D2D3]"
              style={{ background: "rgba(0,210,211,0.08)", border: "1px solid rgba(0,210,211,0.25)", fontFamily: "Roboto, sans-serif" }}
            >
              {p}
            </button>
          ))}
        </div>
        <div
          className="flex items-center justify-between px-4 py-3 rounded-[16px] mb-4"
          style={{ background: "rgba(0,210,211,0.05)", border: "1px solid rgba(0,210,211,0.15)" }}
        >
          <span className="text-[rgba(185,202,203,0.7)] text-[13px]">На счёте</span>
          <span className="text-[#00D2D3] text-[15px] font-medium">{formatRub(balance)} ₽</span>
        </div>
        {error && <p className="text-[#FFB4AB] text-[13px] mb-3">{error}</p>}
        <button
          onClick={send}
          disabled={!(n > 0)}
          className="w-full rounded-[17px] h-[52px] text-[18px] font-medium"
          style={{
            fontFamily: "Roboto, sans-serif",
            background: n > 0 ? "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)" : "#2A3A3C",
            color: n > 0 ? "#0B1A1A" : "#445456",
          }}
        >
          Пополнить
        </button>
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center px-4 pt-4 pb-3 gap-3">
      <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center">
        <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
      </button>
      <p className="text-[#E0E0E0] text-[20px] font-medium" style={{ fontFamily: "Roboto, sans-serif" }}>{title}</p>
    </div>
  );
}
