import { useState } from "react";
import { useWallet } from "../wallet";
import { validatePin } from "../validate";

export default function SecurityPage({ onBack }: { onBack: () => void }) {
  const { wallet, user, updateSecurity } = useWallet();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="page-enter flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center pressable">
          <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
        </button>
        <p className="text-[#E0E0E0] text-[20px] font-medium">Биометрия и безопасность</p>
      </div>
      <div className="px-4 pb-8">
        <Toggle
          title="Вход по биометрии"
          hint="На телефоне будет Face ID / отпечаток. В браузере — имитация."
          on={!!wallet?.biometric}
          onChange={(v) => void updateSecurity({ biometric: v })}
        />
        <Toggle
          title="Скрывать баланс на главной"
          hint="Сумма заменяется на ••••, пока не коснётесь карты"
          on={!!wallet?.hideBalance}
          onChange={(v) => void updateSecurity({ hideBalance: v })}
        />
        <Toggle
          title="Код на почту, а не в Telegram"
          hint="Коды входа, регистрации и крупных платежей пойдут на вашу почту"
          on={user?.otpChannel === "email"}
          onChange={(v) => void updateSecurity({ otpChannel: v ? "email" : "sms" })}
        />
        <div className="rounded-[20px] px-4 py-4 mb-3" style={{ background: "#191C1C" }}>
          <p className="text-[#E0E0E0] text-[15px] font-medium mb-1">PIN-код</p>
          <p className="text-[rgba(185,202,203,0.5)] text-[12px] mb-3">{wallet?.pinSet ? "PIN уже задан. Новый код заменит его, старый на экран не выводится." : "4 цифры для разблокировки приложения. На сервере хранится только хеш."}</p>
          <input
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }}
            inputMode="numeric"
            className="w-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(63,78,79,0.7)] rounded-[14px] px-4 py-3 text-[#E0E0E0] tracking-[8px] text-center text-[20px] outline-none"
          />
          {err && <p className="text-[#FFB4AB] text-[12px] mt-2">{err}</p>}
          <button
            className="w-full mt-3 h-11 rounded-[14px] text-[#0B1A1A] font-medium pressable"
            style={{ background: "linear-gradient(128deg, #00D2D3, #48FFD5)" }}
            onClick={() => {
              const e = validatePin(pin);
              if (e) { setErr(e); return; }
              void updateSecurity({ pin });
            }}
          >
            Сохранить PIN
          </button>
        </div>
        <div className="rounded-[20px] px-4 py-4 mb-3" style={{ background: "#191C1C" }}>
          <p className="text-[#E0E0E0] text-[15px] font-medium">Двухфакторная защита</p>
          <p className="text-[rgba(185,202,203,0.5)] text-[12px] mt-1">
            Код обязателен при входе, регистрации и платежах свыше 10 000 ₽. На телефон он приходит в Telegram. Если Telegram нет, на экране кода выберите почту.
          </p>
        </div>
        <div className="rounded-[20px] px-4 py-4" style={{ background: "#191C1C" }}>
          <p className="text-[#E0E0E0] text-[15px] font-medium">Сессии</p>
          <p className="text-[rgba(185,202,203,0.5)] text-[12px] mt-1">Это устройство · сейчас</p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ title, hint, on, onChange }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-full rounded-[20px] px-4 py-4 mb-3 flex items-center gap-3 text-left pressable"
      style={{ background: "#191C1C" }}
    >
      <div className="flex-1">
        <p className="text-[#E0E0E0] text-[15px] font-medium">{title}</p>
        <p className="text-[rgba(185,202,203,0.5)] text-[12px] mt-1">{hint}</p>
      </div>
      <div
        className="w-11 h-6 rounded-full relative transition-colors"
        style={{ background: on ? "#00D2D3" : "rgba(255,255,255,0.12)" }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
        />
      </div>
    </button>
  );
}
