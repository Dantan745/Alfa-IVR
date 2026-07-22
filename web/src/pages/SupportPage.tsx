import { useState } from "react";
import { useWallet } from "../wallet";

const faq = [
  { q: "Как пополнить кошелёк?", a: "На главной нажмите «Пополнить» и укажите сумму. В прототипе деньги виртуальные." },
  { q: "Почему перевод не ушёл?", a: "Проверьте баланс, формат телефона +7 (9XX) XXX-XX-XX и дневной лимит." },
  { q: "Что такое аномалия?", a: "Эвристика ML помечает нетипичные операции. Это не блокировка счёта." },
];

export default function SupportPage({ onBack }: { onBack: () => void }) {
  const { addSupportNote } = useWallet();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="page-enter flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center pressable">
          <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
        </button>
        <p className="text-[var(--ink)] text-[20px] font-medium">Поддержка</p>
      </div>
      <div className="px-4 pb-8">
        <p className="text-[var(--muted-60)] text-[12px] uppercase tracking-[1px] mb-3">Частые вопросы</p>
        {faq.map((f, i) => (
          <button
            key={f.q}
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left rounded-[18px] px-4 py-3.5 mb-2 pressable"
            style={{ background: "var(--card)" }}
          >
            <p className="text-[var(--ink)] text-[14px] font-medium">{f.q}</p>
            {open === i && <p className="text-[var(--muted-65)] text-[13px] mt-2 leading-snug">{f.a}</p>}
          </button>
        ))}
        <p className="text-[var(--muted-60)] text-[12px] uppercase tracking-[1px] mt-6 mb-3">Написать в чат</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Опишите проблему"
          className="w-full min-h-[110px] bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[16px] px-4 py-3 text-[var(--ink)] text-[14px] outline-none mb-3"
        />
        <button
          disabled={!text.trim()}
          onClick={() => {
            void addSupportNote(text.trim());
            setText("");
          }}
          className="w-full h-[48px] rounded-[16px] font-medium pressable"
          style={{
            background: text.trim() ? "linear-gradient(128deg, var(--fill), var(--fill-2))" : "var(--avatar-from)",
            color: text.trim() ? "#0B1A1A" : "var(--disabled-ink)",
          }}
        >
          Отправить
        </button>
        <p className="text-[var(--muted-40)] text-[11px] mt-3">Ответ придёт в уведомления. Телефон поддержки: 8 800 200-00-00</p>
      </div>
    </div>
  );
}
