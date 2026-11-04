import { formatTxDate, useWallet } from "../wallet";

export default function NotificationsPage({ onBack, onNavigate }: { onBack: () => void; onNavigate?: (page: string, extra?: string) => void }) {
  const { notes, markNotesRead, markNoteRead } = useWallet();
  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="page-enter flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center pressable">
          <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
        </button>
        <p className="text-[var(--ink)] text-[20px] font-medium flex-1">Уведомления</p>
        {unread > 0 && (
          <button onClick={() => void markNotesRead()} className="text-[var(--accent)] text-[12px]">Прочитать все</button>
        )}
      </div>
      <div className="px-4 pb-8">
        {notes.length === 0 ? (
          <p className="text-center text-[var(--muted-50)] mt-10">Пока нет уведомлений</p>
        ) : (
          notes.filter((n) => n.kind !== "anomaly" && !/мошенн|антифрод|аномал|подозрит/i.test(`${n.title} ${n.body}`)).map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => {
                void markNoteRead(n.id);
                if (n.txId && onNavigate) onNavigate("tx", n.txId);
              }}
              className="w-full text-left rounded-[20px] px-4 py-3.5 mb-3 pressable"
              style={{
                background: n.read ? "var(--card)" : "rgba(0,210,211,0.1)",
                border: n.kind === "anomaly" ? "1px solid rgba(255,180,171,0.25)" : n.read ? "1px solid var(--line)" : "1px solid rgba(0,210,211,0.25)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[22px]" style={{ color: n.kind === "anomaly" ? "var(--danger)" : "var(--accent)" }}>
                  {n.kind === "anomaly" ? "warning" : n.kind === "transfer" ? "payments" : n.kind === "security" ? "fingerprint" : "info"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--ink)] text-[14px] font-medium">{n.title}</p>
                  <p className="text-[var(--muted-65)] text-[12px] mt-1 leading-snug">{n.body}</p>
                  <p className="text-[var(--muted-40)] text-[11px] mt-2">
                    {formatTxDate(n.createdAt)}{!n.read ? " · нажмите, чтобы прочитать" : ""}
                  </p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-[var(--fill)] mt-2 flex-shrink-0" />}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
