import { useState } from "react";
import { useWallet } from "../wallet";
import { useTheme, type ThemeChoice } from "../theme";

interface ProfilePageProps {
  onNavigate: (page: string, extra?: string) => void;
}

const menuItems = [
  { icon: "contacts", label: "Адресная книга", page: "address" },
  { icon: "tune", label: "Лимиты и безопасность", page: "limits" },
  { icon: "receipt_long", label: "История операций", page: "history" },
  { icon: "smart_toy", label: "Смарт-контракты", page: "smart" },
  { icon: "upload_file", label: "Массовые платежи", page: "bulk" },
  { icon: "notifications", label: "Уведомления", page: "notifications" },
  { icon: "fingerprint", label: "Биометрия и безопасность", page: "security" },
  { icon: "help_outline", label: "Поддержка", page: "support" },
];

const themeOptions: { id: ThemeChoice; icon: string; label: string }[] = [
  { id: "dark", icon: "dark_mode", label: "Тёмная" },
  { id: "light", icon: "light_mode", label: "Светлая" },
  { id: "system", icon: "contrast", label: "Системная" },
];

export default function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { user, logout, copyWalletId } = useWallet();
  const { choice, setChoice } = useTheme();
  const [confirmOut, setConfirmOut] = useState(false);
  const initials = `${user?.lastName.charAt(0) || "И"}${user?.firstName.charAt(0) || "И"}`;
  const fullName = `${user?.lastName || ""} ${user?.firstName || ""} ${user?.middleName || ""}`.trim();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 sm:px-6 pt-5 pb-3 max-w-[920px] mx-auto w-full">
        <p className="text-[var(--ink)] text-[22px] font-medium mb-5" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
          Профиль
        </p>

        {/* Avatar + info */}
        <div
          className="px-5 py-5 rounded-[28px] mb-5 flex items-center gap-4"
          style={{
            background: "linear-gradient(108.8deg, var(--raised) 0%, var(--card) 100%)",
            boxShadow: "0 0 40px rgba(0,242,255,0.08)",
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-[26px] font-bold flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--fill), var(--fill-2))",
              color: "#0B1A1A",
              fontFamily: "'Roboto:Bold', sans-serif",
            }}
          >
            {initials}
          </div>
          <div>
            <p className="text-[var(--ink)] text-[19px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
              {fullName}
            </p>
            <p className="text-[var(--muted-60)] text-[13px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
              {user?.phone}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="material-symbols-outlined text-[var(--accent)] text-[14px]">verified</span>
              <span className="text-[var(--accent)] text-[12px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                Верифицирован
              </span>
            </div>
          </div>
        </div>

        {/* Wallet ID */}
        <div
          className="px-4 py-3.5 rounded-[20px] mb-5 flex items-center justify-between"
          style={{ background: "var(--card)" }}
        >
          <div>
            <p className="text-[var(--muted-50)] text-[11px] uppercase tracking-[1px]"
              style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>ID кошелька ЦР</p>
            <p className="text-[var(--ink)] text-[15px] font-medium mt-0.5" style={{ fontFamily: "'Manrope:Regular', sans-serif" }}>
              {user?.walletId}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyWalletId()}
            className="w-9 h-9 rounded-full bg-[var(--raised)] flex items-center justify-center pressable"
          >
            <span className="material-symbols-outlined text-[var(--accent)] text-[16px]">content_copy</span>
          </button>
        </div>

        <div className="px-4 py-4 rounded-[24px] mb-5" style={{ background: "var(--card)", boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,210,211,0.12)" }}>
              <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--accent)" }}>palette</span>
            </div>
            <div>
              <p className="text-[15px] font-medium" style={{ color: "var(--ink)", fontFamily: "'Roboto:Medium', sans-serif" }}>Цветовая тема</p>
              <p className="text-[12px]" style={{ color: "var(--muted-60)", fontFamily: "'Roboto:Regular', sans-serif" }}>Выберите оформление приложения</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const on = choice === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setChoice(opt.id)}
                  className="flex flex-col items-center gap-1 rounded-[16px] py-3 pressable"
                  style={{
                    background: on ? "var(--fill)" : "var(--field)",
                    color: on ? "#0B1A1A" : "var(--muted-70)",
                    border: on ? "1px solid transparent" : "1px solid var(--stroke-soft)",
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
                  <span className="text-[12px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {user?.frozen && (
        <div
          className="w-full px-4 py-3 rounded-[20px] mb-5 flex items-center gap-3"
          style={{ background: "rgba(255,180,171,0.12)", border: "1px solid rgba(255,180,171,0.35)" }}
        >
          <span className="material-symbols-outlined text-[var(--danger)] text-[22px]">ac_unit</span>
          <div className="flex-1 min-w-0">
            <p className="text-[var(--danger)] text-[13px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
              Счёт временно ограничен
            </p>
            <p className="text-[var(--muted-60)] text-[12px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>
              Операции недоступны. При необходимости напишите в поддержку.
            </p>
          </div>
        </div>
        )}

        {/* Menu */}
        <div className="rounded-[24px] overflow-hidden mb-5" style={{ background: "var(--card)" }}>
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={() => item.page && onNavigate(item.page)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--hover)]"
              style={{ borderBottom: i < menuItems.length - 1 ? "1px solid var(--line)" : "none" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,210,211,0.08)" }}
              >
                <span className="material-symbols-outlined text-[var(--accent)] text-[18px]">{item.icon}</span>
              </div>
              <span className="flex-1 text-[var(--ink)] text-[15px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
                {item.label}
              </span>
              <span className="material-symbols-outlined text-[var(--muted-30)] text-[18px]">chevron_right</span>
            </button>
          ))}
        </div>

        {/* App info */}
        <div className="px-4 py-3 rounded-[20px] mb-5" style={{ background: "var(--card)" }}>
          <div className="flex justify-between mb-2">
            <span className="text-[var(--muted-50)] text-[13px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>Версия приложения</span>
            <span className="text-[var(--muted-70)] text-[13px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-50)] text-[13px]" style={{ fontFamily: "'Roboto:Regular', sans-serif" }}>Платформа</span>
            <span className="text-[var(--muted-70)] text-[13px]" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>RuStore</span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => setConfirmOut(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-[20px] mb-6"
          style={{ background: "rgba(255,180,171,0.08)", border: "1px solid rgba(255,180,171,0.2)" }}
        >
          <span className="material-symbols-outlined text-[var(--danger)] text-[20px]">logout</span>
          <span className="text-[var(--danger)] text-[15px] font-medium" style={{ fontFamily: "'Roboto:Medium', sans-serif" }}>
            Выйти из аккаунта
          </span>
        </button>
      </div>
      {confirmOut && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55">
          <div className="w-full max-w-[393px] rounded-t-[24px] px-5 pt-5 pb-8" style={{ background: "var(--card)" }}>
            <p className="text-[var(--ink)] text-[18px] font-medium">Выйти из аккаунта?</p>
            <p className="text-[var(--muted-65)] text-[13px] mt-2">Сессия на этом устройстве будет завершена. Данные кошелька останутся в базе.</p>
            <button
              onClick={logout}
              className="w-full h-12 rounded-[16px] mt-5 font-medium text-[var(--danger)]"
              style={{ background: "rgba(255,180,171,0.12)", border: "1px solid rgba(255,180,171,0.3)" }}
            >
              Да, выйти
            </button>
            <button onClick={() => setConfirmOut(false)} className="w-full h-12 rounded-[16px] mt-2 text-[var(--ink)]">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
