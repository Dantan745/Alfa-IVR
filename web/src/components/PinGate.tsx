// после почты и пароля. сам вход PIN не заменяет
import { useState } from "react";
import { api } from "../api";

export default function PinGate({ onPassed }: { onPassed: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(next: string) {
    if (next.length !== 4 || busy) return;
    setBusy(true);
    setErr("");
    try {
      await api.checkPin(next);
      onPassed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Неверный PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[var(--ink)] text-[22px] font-medium">PIN-код</p>
      <p className="mt-2 text-[var(--muted-70)] text-[14px] max-w-[320px]">
        Четыре цифры из раздела безопасности. Почта и пароль при этом не меняются. У нового счёта, пока не зададите свой, код 1234.
      </p>
      <input
        value={pin}
        autoFocus
        inputMode="numeric"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setPin(v);
          setErr("");
          if (v.length === 4) void submit(v);
        }}
        className="mt-6 w-full max-w-[220px] bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[14px] px-4 py-3 text-[var(--ink)] tracking-[8px] text-center text-[24px] outline-none"
      />
      {err && <p className="mt-3 text-[var(--danger)] text-[13px]">{err}</p>}
    </div>
  );
}
