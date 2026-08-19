import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const ADVICE_KEY = "alfa-recommendation";
const CHAT_KEY = "alfa-recommendation-chat";

type Turn = { role: "user" | "model"; text: string };

export default function DiscussPage({ onBack }: { onBack: () => void }) {
  const [advice, setAdvice] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [wait, setWait] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAdvice(sessionStorage.getItem(ADVICE_KEY) || "");
    try {
      const saved = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "[]");
      if (Array.isArray(saved)) setTurns(saved);
    } catch {
      setTurns([]);
    }
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, wait, advice]);

  async function send() {
    const line = text.trim();
    if (!line || wait) return;
    const next = [...turns, { role: "user" as const, text: line }];
    setTurns(next);
    setText("");
    setWait(true);
    setError("");
    try {
      const res = await api.recommendationChat(advice, next);
      const reply = res.reply || res.recommendation_error || res.error || "Ответ не пришёл";
      const done = [...next, { role: "model" as const, text: reply }];
      setTurns(done);
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(done));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Чат сейчас недоступен");
      setTurns(next);
    } finally {
      setWait(false);
    }
  }

  return (
    <div className="page-enter flex min-h-0 flex-1 flex-col">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center pressable">
          <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
        </button>
        <p className="text-[var(--ink)] text-[20px] font-medium">Обсудить рекомендацию</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {advice && (
          <div className="max-w-[90%] rounded-[18px] px-4 py-3 mb-2" style={{ background: "var(--card)" }}>
            <p className="text-[var(--ink)] text-[14px] leading-snug whitespace-pre-wrap">{advice}</p>
          </div>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-[18px] px-4 py-3 mb-2 ${turn.role === "user" ? "ml-auto" : ""}`}
            style={{ background: turn.role === "user" ? "rgba(0,242,255,0.16)" : "var(--card)" }}
          >
            <p className="text-[var(--ink)] text-[14px] leading-snug whitespace-pre-wrap">{turn.text}</p>
          </div>
        ))}
        {wait && <p className="text-[var(--muted-60)] text-[12px] mb-2">Ответ собирается…</p>}
        {error && <p className="text-[var(--danger)] text-[12px] mb-2">{error}</p>}
        <div ref={bottom} />
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder="Напишите вопрос"
          className="flex-1 h-[44px] bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[16px] px-4 text-[var(--ink)] text-[14px] outline-none"
        />
        <button
          type="button"
          disabled={!text.trim() || wait}
          onClick={() => { void send(); }}
          className="h-[44px] px-4 rounded-[16px] text-[13px] font-medium pressable"
          style={{
            background: text.trim() && !wait ? "linear-gradient(128deg, var(--fill), var(--fill-2))" : "var(--avatar-from)",
            color: text.trim() && !wait ? "#0B1A1A" : "var(--disabled-ink)",
          }}
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
