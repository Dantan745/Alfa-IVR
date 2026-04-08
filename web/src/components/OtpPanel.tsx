import { useState } from "react";

export const PAY_OTP_LIMIT = 10000;

export type OtpChannel = "sms" | "email";

export function ChannelPick({
  channel,
  onChange,
}: {
  channel: OtpChannel;
  onChange: (c: OtpChannel) => void;
}) {
  return (
    <div className="mb-4 rounded-[16px] p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(63,78,79,0.5)" }}>
      <p className="text-[rgba(185,202,203,0.7)] text-[12px] uppercase tracking-[1px] mb-2">Куда отправить код</p>
      <label className="flex items-start gap-3 mb-2 cursor-pointer">
        <input type="radio" className="mt-1 accent-[#00D2D3]" checked={channel === "sms"} onChange={() => onChange("sms")} />
        <span className="text-[#E0E0E0] text-[14px]">На номер телефона (СМС)</span>
      </label>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="radio" className="mt-1 accent-[#00D2D3]" checked={channel === "email"} onChange={() => onChange("email")} />
        <span className="text-[#E0E0E0] text-[14px]">Телефон не работает — отправить на почту</span>
      </label>
    </div>
  );
}

export default function OtpPanel({
  title,
  hint,
  channel,
  onChannel,
  code,
  onCode,
  error,
}: {
  title?: string;
  hint?: string;
  channel: OtpChannel;
  onChannel: (c: OtpChannel) => void;
  code: string;
  onCode: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="mb-2">
      {title && <p className="text-[#E0E0E0] text-[16px] font-medium mb-2">{title}</p>}
      {hint && <p className="text-[rgba(185,202,203,0.7)] text-[13px] mb-3">{hint}</p>}
      <ChannelPick channel={channel} onChange={onChannel} />
      <p className="text-[#E0E0E0] text-[13px] mb-2 uppercase tracking-[1px]">Код подтверждения</p>
      <input
        inputMode="numeric"
        value={code}
        onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="4–6 цифр из СМС или письма"
        className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[17px] px-4 py-3.5 text-[#E0E0E0] text-[18px] tracking-[6px] text-center outline-none mb-2"
      />
      {error && <p className="text-[#FFB4AB] text-[12px] mb-2">{error}</p>}
    </div>
  );
}

export function PayOtpSheet({
  open,
  amount,
  channel,
  onChannel,
  code,
  onCode,
  hint,
  error,
  busy,
  onCancel,
  onSend,
  onConfirm,
}: {
  open: boolean;
  amount: number;
  channel: OtpChannel;
  onChannel: (c: OtpChannel) => void;
  code: string;
  onCode: (v: string) => void;
  hint: string;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onSend: () => void;
  onConfirm: () => void;
}) {
  const [sent, setSent] = useState(false);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55">
      <div className="w-full max-w-[440px] rounded-t-[28px] px-5 pt-5 pb-8" style={{ background: "#191C1C" }}>
        <p className="text-[#E0E0E0] text-[18px] font-medium">Подтверждение платежа</p>
        <p className="text-[rgba(185,202,203,0.75)] text-[14px] mt-2 mb-4">
          Сумма {amount.toLocaleString("ru-RU")} ₽ больше 10 000 ₽. Нужен одноразовый код.
        </p>
        <OtpPanel channel={channel} onChannel={onChannel} code={code} onCode={onCode} hint={hint} error={error} />
        <button
          type="button"
          disabled={busy}
          className="w-full h-12 rounded-[16px] font-medium pressable mb-2"
          style={{ background: "linear-gradient(128deg, #00D2D3, #48FFD5)", color: "#0B1A1A", opacity: busy ? 0.6 : 1 }}
          onClick={() => {
            if (!sent || !code) {
              setSent(true);
              onSend();
              return;
            }
            onConfirm();
          }}
        >
          {busy ? "Отправка…" : sent && code.length >= 4 ? "Подтвердить" : "Выслать код"}
        </button>
        {sent && (
          <button type="button" className="w-full text-[13px] text-[#00D2D3] mb-2" disabled={busy} onClick={() => onSend()}>
            Отправить код ещё раз
          </button>
        )}
        <button type="button" className="w-full text-[13px] text-[rgba(185,202,203,0.5)]" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
