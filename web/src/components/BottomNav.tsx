type Page = "home" | "payments" | "history" | "profile";

interface BottomNavProps {
  current: Page;
  onNavigate: (page: Page) => void;
  variant?: "bottom" | "side";
}

const tabs: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Главная", icon: "home" },
  { id: "payments", label: "Платежи", icon: "payments" },
  { id: "history", label: "История", icon: "history" },
  { id: "profile", label: "Профиль", icon: "person" },
];

export default function BottomNav({ current, onNavigate, variant = "bottom" }: BottomNavProps) {
  if (variant === "side") {
    return (
      <nav className="hidden md:flex w-[212px] shrink-0 flex-col border-r border-[rgba(0,210,211,0.12)] px-4 py-6" style={{ background: "rgba(25,28,28,0.92)" }}>
        <div className="mb-8 px-2">
          <p className="text-[#E0E0E0] text-[16px] font-medium">Alfa Кошелёк ЦР</p>
          <p className="text-[rgba(185,202,203,0.45)] text-[11px] uppercase tracking-[1.5px] mt-1">Цифровой рубль</p>
        </div>
        <div className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const active = current === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-left pressable"
                style={{ background: active ? "rgba(0,210,211,0.12)" : "transparent" }}
              >
                <span className="material-symbols-outlined text-[24px]" style={{ color: active ? "#00D2D3" : "rgba(185,202,203,0.6)" }}>
                  {tab.icon}
                </span>
                <span className="text-[14px] font-medium" style={{ color: active ? "#00D2D3" : "rgba(185,202,203,0.75)" }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <div
      className="shrink-0 w-full rounded-tl-[30px] rounded-tr-[30px] border-t border-[rgba(0,210,211,0.1)] md:hidden"
      style={{ background: "rgba(25,28,28,0.92)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-around px-2 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        {tabs.map((tab) => {
          const active = current === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className="flex flex-col items-center gap-1 min-w-[56px] py-1 pressable"
            >
              <span
                className="material-symbols-outlined text-[26px] transition-colors"
                style={{ color: active ? "#00D2D3" : "rgba(185,202,203,0.6)" }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[11px] font-medium transition-colors"
                style={{
                  fontFamily: "'Roboto:Medium', sans-serif",
                  color: active ? "#00D2D3" : "rgba(185,202,203,0.7)",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
