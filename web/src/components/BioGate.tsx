import { useEffect, useState } from "react";
import { scanBiometry } from "../bio";
import CrMark from "./CrMark";

export default function BioGate({ onPassed, onPassword }: { onPassed: () => void; onPassword: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setErr("");
    const r = await scanBiometry();
    setBusy(false);
    if (r.ok) onPassed();
    else setErr(r.reason || "Не удалось подтвердить личность");
  }

  useEffect(() => {
    void run();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <CrMark size={72} title="Цифровой рубль" />
      <p className="mt-6 text-[var(--ink)] text-[22px] font-medium">Подтвердите личность</p>
      <p className="mt-2 text-[var(--muted-70)] text-[14px] max-w-[320px]">
        Отпечаток пальца или скан лица этого устройства. Отдельная база лиц не используется.
      </p>
      <div className="mt-6 flex gap-3">
        <span className="material-symbols-outlined text-[var(--accent)] text-[36px]">fingerprint</span>
        <span className="material-symbols-outlined text-[var(--accent)] text-[36px]">face</span>
      </div>
      {err && <p className="mt-4 text-[var(--danger)] text-[13px]">{err}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="mt-6 w-full max-w-[320px] h-[52px] rounded-[17px] font-medium text-[16px]"
        style={{ background: "linear-gradient(128deg, var(--fill), var(--fill-2))", color: "#0B1A1A", opacity: busy ? 0.6 : 1 }}
      >
        {busy ? "Сканирование…" : "Сканировать ещё раз"}
      </button>
      <button type="button" onClick={onPassword} className="mt-3 text-[13px] text-[var(--muted-70)]">
        Войти паролем
      </button>
    </div>
  );
}
