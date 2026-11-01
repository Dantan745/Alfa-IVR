// код подтверждения. от 10 тысяч сервер без него перевод не примет, тут только ввод
import { useEffect, useRef, useState } from "react";

// порог тот же, что на сервере. если разъедутся, экран попросит код зря или не попросит вовсе
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
    <div className="mb-4 rounded-[16px] p-3" style={{ background: "var(--line)", border: "1px solid var(--stroke-soft)" }}>
      <p className="text-[var(--muted-70)] text-[12px] uppercase tracking-[1px] mb-2">Куда отправить код</p>
      <label className="flex items-start gap-3 mb-2 cursor-pointer">
        <input type="radio" className="mt-1 accent-[var(--accent)]" checked={channel === "sms"} onChange={() => onChange("sms")} />
        <span className="text-[var(--ink)] text-[14px]">Обычное SMS на телефон</span>
      </label>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="radio" className="mt-1 accent-[var(--accent)]" checked={channel === "email"} onChange={() => onChange("email")} />
        <span className="text-[var(--ink)] text-[14px]">На почту</span>
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
  lockChannel,
}: {
  title?: string;
  hint?: string;
  channel: OtpChannel;
  onChannel: (c: OtpChannel) => void;
  code: string;
  onCode: (v: string) => void;
  error?: string;
  lockChannel?: boolean;
}) {
  return (
    <div className="mb-2">
      {title && <p className="text-[var(--ink)] text-[16px] font-medium mb-2">{title}</p>}
      {hint && <p className="text-[var(--muted-70)] text-[13px] mb-3">{hint}</p>}
      {!lockChannel && <ChannelPick channel={channel} onChange={onChannel} />}
      <p className="text-[var(--ink)] text-[13px] mb-2 uppercase tracking-[1px]">Код подтверждения</p>
      <input
        inputMode="numeric"
        value={code}
        onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="4–6 цифр из SMS или письма"
        className="w-full bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[17px] px-4 py-3.5 text-[var(--ink)] text-[18px] tracking-[6px] text-center outline-none mb-2"
      />
      {error && <p className="text-[var(--danger)] text-[12px] mb-2">{error}</p>}
    </div>
  );
}

// шторка перед крупным переводом, qr и массовым. почта одна, если смс человеку некуда слать
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
  emailOnly,
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
  emailOnly?: boolean;
}) {
  const [sent, setSent] = useState(false);
  const cancelRef = useRef(onCancel);
  const sendRef = useRef(onSend);
  cancelRef.current = onCancel;
  sendRef.current = onSend;

  useEffect(() => {
    if (!open) return;
    let closedByPop = false;
    const prev = history.state as { tab?: string; sub?: string | null; txId?: string | null } | null;
    history.pushState({ alfaNav: true, otp: true, tab: prev?.tab || "home", sub: prev?.sub || null, txId: prev?.txId || null }, "");
    const onPop = () => {
      closedByPop = true;
      cancelRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByPop) history.back();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSent(false);
      return;
    }
    if (!emailOnly) return;
    setSent(true);
    sendRef.current();
  }, [open, emailOnly]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55">
      <div className="w-full max-w-[440px] rounded-t-[28px] px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]" style={{ background: "var(--card)" }}>
        <p className="text-[var(--ink)] text-[18px] font-medium">Подтверждение платежа</p>
        <p className="text-[var(--muted-75)] text-[14px] mt-2 mb-4">
          {emailOnly
            ? "Код подтверждения уходит на почту. Введите его и подтвердите массовый платёж."
            : `Сумма ${amount.toLocaleString("ru-RU")} ₽ больше 10 000 ₽. Нужен одноразовый код.`}
        </p>
        <OtpPanel channel={channel} onChannel={onChannel} code={code} onCode={onCode} hint={hint} error={error} lockChannel={emailOnly} />
        <button
          type="button"
          disabled={busy}
          className="w-full h-12 rounded-[16px] font-medium pressable mb-2"
          style={{ background: "linear-gradient(128deg, var(--fill), var(--fill-2))", color: "#0B1A1A", opacity: busy ? 0.6 : 1 }}
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
          <button type="button" className="w-full text-[13px] text-[var(--accent)] mb-2" disabled={busy} onClick={() => onSend()}>
            Отправить код ещё раз
          </button>
        )}
        <button type="button" className="w-full text-[13px] text-[var(--muted-50)]" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
