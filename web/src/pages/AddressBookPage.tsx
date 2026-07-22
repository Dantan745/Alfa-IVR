import { useState, type ReactNode } from "react";
import { useWallet } from "../wallet";
import { editPhoneMask, validatePhone } from "../validate";

export default function AddressBookPage({ onBack, onTransfer }: { onBack: () => void; onTransfer: () => void }) {
  const { contacts, addContact, toggleFav, removeContact, setPendingPayee, setToast } = useWallet();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search),
  );
  const favorites = filtered.filter((c) => c.favorite);
  const rest = filtered.filter((c) => !c.favorite);

  async function save() {
    const pe = validatePhone(newPhone);
    if (!newName.trim()) { setErr("Укажите имя"); return; }
    if (pe) { setErr(pe); return; }
    const fail = await addContact(newName, newPhone);
    if (fail) { setErr(fail); return; }
    setAdding(false);
    setNewName("");
    setNewPhone("");
    setErr("");
  }

  return (
    <div className="page-enter flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center pressable">
            <span className="material-symbols-outlined text-[var(--accent)]">arrow_back</span>
          </button>
          <p className="text-[var(--ink)] text-[20px] font-medium">Адресная книга</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center pressable"
          style={{ background: "rgba(0,210,211,0.15)", border: "1px solid rgba(0,210,211,0.3)" }}
        >
          <span className="material-symbols-outlined text-[var(--accent)] text-[20px]">add</span>
        </button>
      </div>

      <div className="px-4 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или номеру"
          className="w-full bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[17px] px-4 py-3 text-[15px] outline-none"
        />
      </div>

      {adding && (
        <div className="mx-4 mb-4 p-4 rounded-[24px]" style={{ background: "var(--card)" }}>
          <p className="text-[var(--ink)] text-[16px] font-medium mb-3">Новый контакт</p>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ФИО" className="w-full bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[14px] px-4 py-3 mb-3 outline-none" />
          <input value={newPhone} onChange={(e) => setNewPhone(editPhoneMask(newPhone, e.target.value))} placeholder="+7 926… или 8 926…" className="w-full bg-[var(--field)] border-2 border-[var(--stroke)] rounded-[14px] px-4 py-3 mb-3 outline-none" />
          {err && <p className="text-[var(--danger)] text-[12px] mb-2">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setAdding(false); setErr(""); }} className="flex-1 py-2.5 rounded-[14px] text-[var(--muted-60)] border border-[var(--line-strong)]">Отмена</button>
            <button onClick={() => void save()} className="flex-1 py-2.5 rounded-[14px] text-[#0B1A1A]" style={{ background: "linear-gradient(128deg, var(--fill), var(--fill-2))" }}>Добавить</button>
          </div>
        </div>
      )}

      {contacts.length === 0 && !adding && (
        <div className="px-6 pt-10 text-center">
          <span className="material-symbols-outlined text-[var(--accent)] text-[40px]">contacts</span>
          <p className="text-[var(--ink)] text-[16px] mt-3">Пока нет получателей</p>
          <p className="text-[var(--muted-50)] text-[13px] mt-1">Добавьте человека, чтобы переводить в один тап</p>
        </div>
      )}

      {favorites.length > 0 && (
        <Block title="Избранные">
          {favorites.map((c) => (
            <Row
              key={c.id}
              c={c}
              open={openId === c.id}
              onOpen={() => setOpenId(openId === c.id ? null : c.id)}
              onFav={() => void toggleFav(c.id)}
              onCopy={() => { void navigator.clipboard.writeText(c.phone); setToast("Номер скопирован"); }}
              onPay={() => { setPendingPayee(c.phone); onTransfer(); }}
              onDelete={() => void removeContact(c.id)}
            />
          ))}
        </Block>
      )}
      {rest.length > 0 && (
        <Block title="Все контакты">
          {rest.map((c) => (
            <Row
              key={c.id}
              c={c}
              open={openId === c.id}
              onOpen={() => setOpenId(openId === c.id ? null : c.id)}
              onFav={() => void toggleFav(c.id)}
              onCopy={() => { void navigator.clipboard.writeText(c.phone); setToast("Номер скопирован"); }}
              onPay={() => { setPendingPayee(c.phone); onTransfer(); }}
              onDelete={() => void removeContact(c.id)}
            />
          ))}
        </Block>
      )}
      <div className="h-8" />
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-4 text-[var(--muted-50)] text-[11px] uppercase tracking-[1px] mb-2">{title}</p>
      <div className="mx-4 rounded-[24px] overflow-hidden" style={{ background: "var(--card)" }}>{children}</div>
    </div>
  );
}

function Row({
  c, open, onOpen, onFav, onCopy, onPay, onDelete,
}: {
  c: { id: string; name: string; phone: string; wallet: string; initials: string; color: string; favorite: boolean };
  open: boolean; onOpen: () => void; onFav: () => void; onCopy: () => void; onPay: () => void; onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 text-left">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-[#0B1A1A] text-[18px] font-bold" style={{ background: c.color }}>{c.initials}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--ink)] text-[14px] font-medium truncate">{c.name}</p>
          <p className="text-[var(--muted-50)] text-[12px]">{c.phone}</p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onFav(); }} className="w-8 h-8">
          <span className="material-symbols-outlined text-[18px]" style={{ color: c.favorite ? "var(--accent)" : "var(--muted-30)" }}>{c.favorite ? "star" : "star_border"}</span>
        </button>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={onPay} className="py-2 rounded-[12px] text-[12px] text-[#0B1A1A]" style={{ background: "var(--fill)" }}>Перевести</button>
          <button onClick={onCopy} className="py-2 rounded-[12px] text-[12px] text-[var(--accent)]" style={{ background: "rgba(0,210,211,0.1)" }}>Копировать</button>
          <button onClick={onDelete} className="py-2 rounded-[12px] text-[12px] text-[var(--danger)]" style={{ background: "rgba(255,180,171,0.08)" }}>Удалить</button>
        </div>
      )}
    </div>
  );
}
