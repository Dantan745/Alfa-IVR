import { useMemo, useRef, useState } from "react";
import { useWallet } from "../wallet";
import { editPhoneMask, isOwnPayee, maskPhone, validatePhone } from "../validate";
import { PayOtpSheet, PAY_OTP_LIMIT, type OtpChannel } from "../components/OtpPanel";

interface BulkPaymentsProps {
  onBack: () => void;
}

type Status = "pending" | "success" | "error";
type Row = { id: string; phone: string; name: string; amount: string; status: Status; error?: string };

function parseCsv(text: string): { phone: string; name: string; amount: string }[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: { phone: string; name: string; amount: string }[] = [];
  for (const line of lines) {
    if (/телефон|phone|имя|name|сумма|amount/i.test(line) && out.length === 0) continue;
    const parts = line.split(/[;,]\s*/);
    if (parts.length < 2) continue;
    const nums = parts.map((p) => p.replace(/\D/g, ""));
    const amountPart = parts.find((p) => /^\d+([.,]\d+)?$/.test(p.trim().replace(/\s/g, ""))) || parts[parts.length - 1];
    const phonePart = parts.find((p) => p.replace(/\D/g, "").length >= 10) || parts[0];
    const namePart = parts.find((p) => /[А-ЯA-Zа-яa-z]/.test(p) && p.replace(/\D/g, "").length < 10) || "Получатель";
    out.push({
      phone: maskPhone(phonePart),
      name: namePart.replace(/["']/g, "").trim(),
      amount: String(amountPart).replace(/\s/g, "").replace(",", "."),
    });
    void nums;
  }
  return out;
}

export default function BulkPaymentsPage({ onBack }: BulkPaymentsProps) {
  const { bulkPay, wallet, contacts, requestCode, user } = useWallet();
  const [rows, setRows] = useState<Row[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState(false);
  const [manual, setManual] = useState({ name: "", phone: "", amount: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>(user?.otpChannel === "email" ? "email" : "sms");
  const [otpHint, setOtpHint] = useState("");

  const parsed = useMemo(
    () =>
      rows.map((r) => {
        const amount = Number(String(r.amount).replace(",", "."));
        const pe = validatePhone(r.phone);
        const self = isOwnPayee(user, r.phone) ? "Нельзя платить самому себе" : "";
        const err = !r.name.trim() ? "Нет имени" : pe || self || (!(amount > 0) ? "Сумма" : "");
        return { ...r, amount, error: err };
      }),
    [rows, user],
  );
  const valid = parsed.filter((r) => !r.error && r.status !== "success");
  const total = valid.reduce((s, r) => s + r.amount, 0);
  const errorCount = parsed.filter((r) => r.error || r.status === "error").length;

  function addRows(list: { phone: string; name: string; amount: string }[]) {
    setSent(false);
    setRows((prev) => {
      const next = [...prev];
      for (const item of list) {
        const phone = maskPhone(item.phone);
        if (next.some((r) => r.phone === phone && r.name === item.name)) continue;
        next.push({ id: crypto.randomUUID(), phone, name: item.name, amount: item.amount, status: "pending" });
      }
      return next;
    });
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => addRows(parseCsv(String(reader.result || "")));
    reader.readAsText(file, "utf-8");
  }

  async function handleSend() {
    if (!valid.length) {
      setMsg("Добавьте получателей с телефоном и суммой");
      return;
    }
    if (total > (wallet?.balance ?? 0)) {
      setMsg(`Недостаточно средств: нужно ${total.toLocaleString("ru-RU")} ₽, на счёте ${wallet?.balance ?? 0} ₽`);
      return;
    }
    if (total > PAY_OTP_LIMIT && user?.email !== "ivan@alfa.demo") {
      setOtpOpen(true);
      return;
    }
    await runBulk();
  }

  async function runBulk(code?: string) {
    setSending(true);
    const res = await bulkPay(valid.map((r) => ({ name: r.name, phone: r.phone, amount: r.amount })), code);
    const okIds = new Set(valid.slice(0, res.ok).map((r) => r.id));
    setRows((prev) =>
      prev.map((r) => {
        const row = parsed.find((p) => p.id === r.id);
        if (row?.error) return { ...r, status: "error" as Status, error: row.error };
        if (okIds.has(r.id) || (res.fail === 0 && !row?.error)) return { ...r, status: "success" as Status };
        return { ...r, status: res.ok ? "error" : r.status, error: res.error };
      }),
    );
    setMsg(res.error || (res.fail ? `Отправлено ${res.ok}, ошибок ${res.fail}` : `Отправлено ${res.ok} платежей`));
    setSending(false);
    if (!res.error) setOtpOpen(false);
    else setMsg(res.error);
    setSent(true);
  }

  return (
    <div className="flex-1 overflow-y-auto relative">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
        </button>
        <p className="text-[#E0E0E0] text-[20px] font-medium">Массовые платежи</p>
      </div>

      <div className="px-4 mb-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className="border-2 border-dashed rounded-[24px] p-5 flex flex-col items-center gap-2"
          style={{
            borderColor: dragOver ? "#00D2D3" : "rgba(63,78,79,0.5)",
            background: dragOver ? "rgba(0,210,211,0.05)" : "rgba(255,255,255,0.02)",
          }}
        >
          <span className="material-symbols-outlined text-[#00D2D3] text-[28px]">upload_file</span>
          <p className="text-[#E0E0E0] text-[15px]">CSV: телефон, имя, сумма</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <div className="flex flex-wrap gap-2 mt-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-[14px] text-[13px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.1)", border: "1px solid rgba(0,210,211,0.3)" }}>Выбрать файл</button>
            <button type="button" onClick={() => setPick((v) => !v)} className="px-4 py-2 rounded-[14px] text-[13px] text-[#00D2D3]" style={{ background: "rgba(0,210,211,0.1)", border: "1px solid rgba(0,210,211,0.3)" }}>Из адресной книги</button>
          </div>
        </div>
      </div>

      {pick && (
        <div className="mx-4 mb-4 p-4 rounded-[20px]" style={{ background: "#191C1C" }}>
          <p className="text-[#E0E0E0] text-[14px] mb-2">Ваши получатели</p>
          {contacts.length === 0 ? (
            <p className="text-[rgba(185,202,203,0.5)] text-[13px]">Адресная книга пуста — добавьте контакты сами</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {contacts.map((c) => {
                const on = rows.some((r) => r.phone === c.phone);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (on) setRows((prev) => prev.filter((r) => r.phone !== c.phone));
                      else addRows([{ name: c.name, phone: c.phone, amount: "" }]);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-[12px] text-left"
                    style={{ background: on ? "rgba(0,210,211,0.12)" : "rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-[#E0E0E0] text-[13px]">{c.name}<span className="block text-[11px] text-[rgba(185,202,203,0.45)]">{c.phone}</span></span>
                    <span className="material-symbols-outlined text-[#00D2D3] text-[18px]">{on ? "check_circle" : "add_circle"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mx-4 mb-4 p-4 rounded-[20px]" style={{ background: "#191C1C" }}>
        <p className="text-[#E0E0E0] text-[14px] mb-3">Добавить вручную</p>
        <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Имя" className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(63,78,79,0.7)] rounded-[12px] px-3 py-2 mb-2 outline-none text-[14px]" />
        <input value={manual.phone} onChange={(e) => setManual({ ...manual, phone: editPhoneMask(manual.phone, e.target.value) })} placeholder="+7 926… / 8 926…" className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(63,78,79,0.7)] rounded-[12px] px-3 py-2 mb-2 outline-none text-[14px]" />
        <input value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="Сумма ₽" inputMode="decimal" className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(63,78,79,0.7)] rounded-[12px] px-3 py-2 mb-3 outline-none text-[14px]" />
        <button
          type="button"
          onClick={() => {
            if (!manual.name.trim() || validatePhone(manual.phone) || !(Number(manual.amount.replace(",", ".")) > 0)) {
              setMsg("Нужны имя, российский мобильный и сумма");
              return;
            }
            addRows([manual]);
            setManual({ name: "", phone: "", amount: "" });
            setMsg("");
          }}
          className="w-full py-2.5 rounded-[12px] text-[13px] text-[#0B1A1A]"
          style={{ background: "linear-gradient(128deg, #00D2D3, #48FFD5)" }}
        >
          Добавить в список
        </button>
      </div>

      <div className="flex gap-3 px-4 mb-4">
        <div className="flex-1 px-4 py-3 rounded-[18px]" style={{ background: "#191C1C" }}>
          <p className="text-[rgba(185,202,203,0.5)] text-[10px] uppercase tracking-[1px]">Получателей</p>
          <p className="text-[#E0E0E0] text-[22px] font-bold mt-1">{rows.length}</p>
        </div>
        <div className="flex-1 px-4 py-3 rounded-[18px]" style={{ background: "#191C1C" }}>
          <p className="text-[rgba(185,202,203,0.5)] text-[10px] uppercase tracking-[1px]">Итого</p>
          <p className="text-[#00D2D3] text-[22px] font-bold mt-1">{total.toLocaleString("ru-RU")} ₽</p>
        </div>
      </div>

      <div className="px-4 mb-5">
        <p className="text-[rgba(185,202,203,0.5)] text-[11px] uppercase tracking-[1px] mb-3">Список платежей</p>
        <div className="rounded-[24px] overflow-hidden" style={{ background: "#191C1C" }}>
          {rows.length === 0 && (
            <p className="text-center text-[rgba(185,202,203,0.45)] text-[13px] py-8 px-4">Список пуст. Добавьте людей из своей адресной книги, вручную или CSV.</p>
          )}
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div className="flex-1 min-w-0">
                <input value={r.name} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, name: e.target.value, status: "pending" } : x))} className="w-full bg-transparent text-[#E0E0E0] text-[13px] outline-none" />
                <input value={r.phone} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, phone: maskPhone(e.target.value), status: "pending" } : x))} className="w-full bg-transparent text-[11px] text-[rgba(185,202,203,0.5)] outline-none" />
              </div>
              <input value={r.amount} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, amount: e.target.value.replace(/[^\d.,]/g, ""), status: "pending" } : x))} className="w-[72px] bg-transparent text-right text-[#E0E0E0] text-[13px] outline-none" />
              <span className="text-[rgba(185,202,203,0.4)] text-[12px]">₽</span>
              {r.status === "success" ? <span className="material-symbols-outlined text-[#228D57] text-[18px]">check_circle</span> : (parsed.find((p) => p.id === r.id)?.error || r.status === "error") ? <span className="material-symbols-outlined text-[#FFB4AB] text-[18px]">error</span> : <span className="material-symbols-outlined text-[rgba(185,202,203,0.3)] text-[18px]">radio_button_unchecked</span>}
              <button type="button" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))} className="text-[rgba(185,202,203,0.35)]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8">
        {msg && <p className="text-[13px] mb-3" style={{ color: sent && !errorCount ? "#228D57" : "#FFB4AB" }}>{msg}</p>}
        <button
          onClick={() => void handleSend()}
          disabled={sending || !valid.length}
          className="w-full rounded-[17px] h-[52px] font-medium text-[16px]"
          style={{
            background: sending || !valid.length ? "#2A3A3C" : "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)",
            color: sending || !valid.length ? "#668" : "#0B1A1A",
          }}
        >
          {sending ? "Отправка..." : `Отправить ${valid.length} платежей`}
        </button>
      </div>
      <PayOtpSheet
        open={otpOpen}
        amount={total}
        channel={otpChannel}
        onChannel={setOtpChannel}
        code={otpCode}
        onCode={setOtpCode}
        hint={otpHint}
        error={msg}
        busy={otpBusy || sending}
        onCancel={() => setOtpOpen(false)}
        onSend={async () => {
          setOtpBusy(true);
          const r = await requestCode({ purpose: "pay", channel: otpChannel, amount: total });
          setOtpBusy(false);
          if (r.error) setMsg(r.error);
          else {
            setMsg("");
            setOtpHint(r.fallback ? `СМС не дошло — код на почте ${r.masked}.` : `Код отправлен на ${r.masked}.`);
          }
        }}
        onConfirm={() => void runBulk(otpCode)}
      />
    </div>
  );
}
