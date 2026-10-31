import { useEffect, useState } from "react";
import { formatRub, useWallet } from "../wallet";
import { editPhoneMask, isOwnPayee } from "../validate";
import { PayOtpSheet, PAY_OTP_LIMIT, type OtpChannel } from "../components/OtpPanel";

interface TransferPageProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}


function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center px-4 pt-4 pb-3 gap-3">
      <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center">
        <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
      </button>
      <p className="text-[#E0E0E0] text-[20px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>{title}</p>
    </div>
  );
}

function Input({ label, placeholder, value, onChange, type = "text" }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[rgba(185,202,203,0.7)] text-[12px] uppercase tracking-[1px] mb-2"
        style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[17px] px-4 py-3.5 text-[#E0E0E0] text-[16px] outline-none focus:border-[rgba(0,210,211,0.5)] placeholder-[#445456] transition-colors"
        style={{ fontFamily: "'Manrope:Regular', sans-serif" }}
      />
    </div>
  );
}

function PrimaryBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[17px] h-[52px] font-medium text-[18px] transition-opacity"
      style={{
        fontFamily: "'Roboto:Medium', sans-serif",
        background: disabled ? "#2A3A3C" : "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)",
        color: disabled ? "#445456" : "#0B1A1A",
        boxShadow: disabled ? "none" : "0 0 30px rgba(72,255,213,0.3)",
      }}
    >
      {label}
    </button>
  );
}

export default function TransferPage({ onBack, onNavigate }: TransferPageProps) {
  const { wallet, transfer, contacts, pendingPayee, setPendingPayee, requestCode, user } = useWallet();
  const balance = wallet?.balance ?? 0;
  const [tab, setTab] = useState<"phone" | "id">("phone");
  const [phone, setPhone] = useState(pendingPayee || "");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>(user?.otpChannel === "email" ? "email" : "sms");
  const [otpHint, setOtpHint] = useState("");

  useEffect(() => {
    if (pendingPayee) {
      setPhone(pendingPayee);
      setPendingPayee("");
    }
  }, [pendingPayee, setPendingPayee]);

  async function handleSend(code?: string) {
    const n = Number(String(amount).replace(",", "."));
    if (!(n > 0)) {
      setError("Укажите сумму");
      return;
    }
    if (isOwnPayee(user, phone)) {
      setError("Нельзя перевести деньги самому себе");
      return;
    }
    if (n > PAY_OTP_LIMIT && user?.email !== "ivan@alfa.demo" && !code) {
      setOtpOpen(true);
      setError("");
      return;
    }
    const err = await transfer(phone, n, comment, code);
    if (err) {
      setError(err);
      return;
    }
    setOtpOpen(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex-1 overflow-y-auto px-5 flex flex-col">
        <PageHeader title="Перевод" onBack={() => setSent(false)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,210,211,0.15)", border: "2px solid #00D2D3" }}
          >
            <span className="material-symbols-outlined text-[#00D2D3] text-[40px]">check_circle</span>
          </div>
          <p className="text-[#E0E0E0] text-[24px] font-medium text-center" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Перевод выполнен
          </p>
          <p className="text-[#00D2D3] text-[32px] font-bold" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
            {amount} ₽
          </p>
          <p className="text-[rgba(185,202,203,0.7)] text-[14px] text-center" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Средства переведены на номер {phone}
          </p>
          <div className="w-full mt-4">
            <PrimaryBtn label="Готово" onClick={onBack} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto relative">
      <PageHeader title="Перевод" onBack={onBack} />

      {/* Tabs */}
      <div className="flex mx-4 mb-5 bg-[#191C1C] rounded-[16px] p-1">
        {([["phone", "По номеру телефона"], ["id", "По ID кошелька"]] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as "phone" | "id")}
            className="flex-1 py-2.5 rounded-[12px] text-[13px] font-medium transition-all"
            style={{
              fontFamily: "'Roboto:Medium', sans-serif",
              background: tab === key ? "#282A2A" : "transparent",
              color: tab === key ? "#00D2D3" : "rgba(185,202,203,0.6)",
              boxShadow: tab === key ? "0 0 10px rgba(0,210,211,0.1)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {contacts.length > 0 && (
      <div className="px-4 mb-5">
        <p className="text-[rgba(185,202,203,0.6)] text-[12px] uppercase tracking-[1px] mb-3"
          style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Частые получатели</p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setPhone(c.phone)}
              className="flex flex-col items-center gap-1.5 min-w-[60px]"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(#2A3A3C, #1A2426)" }}
              >
                <span className="text-[#00D2D3] text-[18px]" style={{ fontFamily: "'Roboto:Bold', sans-serif" }}>
                  {c.initials}
                </span>
              </div>
              <span className="text-[rgba(185,202,203,0.8)] text-[11px] text-center" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
                {c.name.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      <div className="px-4">
        <Input
          label={tab === "phone" ? "Номер телефона" : "ID кошелька"}
          placeholder={tab === "phone" ? "+7 (___) ___-__-__" : "Введите ID получателя"}
          value={phone}
          onChange={(v) => setPhone(tab === "phone" ? editPhoneMask(phone, v) : v)}
        />
        <Input label="Сумма (₽)" placeholder="0,00" value={amount} onChange={setAmount} type="number" />
        <Input label="Комментарий (необязательно)" placeholder="За что платёж?" value={comment} onChange={setComment} />

        {/* Balance display */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-[16px] mb-5"
          style={{ background: "rgba(0,210,211,0.05)", border: "1px solid rgba(0,210,211,0.15)" }}
        >
          <span className="text-[rgba(185,202,203,0.7)] text-[13px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
            Доступно
          </span>
          <span className="text-[#00D2D3] text-[15px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            {formatRub(balance)} ₽
          </span>
        </div>

        {error && <p className="text-[#FFB4AB] text-[13px] mb-3">{error}</p>}
        <PrimaryBtn label="Перевести" onClick={() => void handleSend()} disabled={!phone || !amount} />

        <div className="mt-4 mb-2 flex gap-3">
          <button
            onClick={() => onNavigate("bulk")}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[17px] border border-[rgba(0,210,211,0.3)]"
            style={{ background: "rgba(0,210,211,0.05)" }}
          >
            <span className="material-symbols-outlined text-[#00D2D3] text-[18px]">upload_file</span>
            <span className="text-[#00D2D3] text-[13px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Массовый платёж</span>
          </button>
          <button
            onClick={() => onNavigate("smart")}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[17px] border border-[rgba(0,210,211,0.3)]"
            style={{ background: "rgba(0,210,211,0.05)" }}
          >
            <span className="material-symbols-outlined text-[#00D2D3] text-[18px]">smart_toy</span>
            <span className="text-[#00D2D3] text-[13px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>Смарт-контракт</span>
          </button>
        </div>
      </div>
      <PayOtpSheet
        open={otpOpen}
        amount={Number(String(amount).replace(",", ".")) || 0}
        channel={otpChannel}
        onChannel={setOtpChannel}
        code={otpCode}
        onCode={setOtpCode}
        hint={otpHint}
        error={error}
        busy={otpBusy}
        onCancel={() => setOtpOpen(false)}
        onSend={async () => {
          setOtpBusy(true);
          const r = await requestCode({ purpose: "pay", channel: otpChannel, amount: Number(String(amount).replace(",", ".")) });
          setOtpBusy(false);
          if (r.error) setError(r.error);
          else {
            setError("");
            setOtpHint(r.fallback ? `СМС не дошло — код на почте ${r.masked}.` : `Код отправлен на ${r.masked}.`);
          }
        }}
        onConfirm={() => void handleSend(otpCode)}
      />
    </div>
  );
}
