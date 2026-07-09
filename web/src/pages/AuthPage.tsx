import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import imgAlfaLogo from "../imports/AndroidCompact2/c4c0fd50168f399240c6e8e131c479f4e660676b.png";
import imgGosuslugi from "../imports/AndroidCompact2/8eaf95343e7f57475685bf10f06a3d8ffb2b9f2f.png";
import { useWallet } from "../wallet";
import { readPayLink } from "../qr";
import OtpPanel, { type OtpChannel } from "../components/OtpPanel";
import {
  maskDate,
  maskDivCode,
  maskPassport,
  editPhoneMask,
  validateDivCode,
  validateEmail,
  validateIssueDate,
  validateName,
  validatePassport,
  validatePassword,
  validatePhone,
  validateSms,
} from "../validate";

type Step = "login" | "register-name" | "register-passport" | "register-phone";

const AUTH_DRAFT = "alfa-auth-draft";

type AuthDraft = {
  step: Step;
  email: string;
  password: string;
  code: string;
  showCode: boolean;
  showRegCode: boolean;
  channel: OtpChannel;
  codeHint: string;
  lastName: string;
  firstName: string;
  middleName: string;
  passport: string;
  issueDate: string;
  divCode: string;
  regPhone: string;
  regEmail: string;
  regPassword: string;
  agreed: boolean;
  resetMode: boolean;
  newPassword: string;
  newPassword2: string;
};

function GlowLogo() {
  return (
    <div className="flex flex-col items-center pt-[max(12px,env(safe-area-inset-top))] pb-4 sm:pt-12 sm:pb-6">
      <div className="relative w-[72px] h-[72px] sm:w-[100px] sm:h-[100px]">
        <div className="absolute inset-0 rounded-full opacity-20 blur-[20px]" style={{ background: "radial-gradient(circle, #00D2D3 0%, transparent 70%)" }} />
        <div
          className="absolute inset-0 rounded-full border-2 border-[#348997]"
          style={{ background: "radial-gradient(circle at 50% 30%, #1A2F2F 0%, #0B0E14 100%)", boxShadow: "0 0 40px rgba(0,210,211,0.2)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="40" height="44" viewBox="0 0 40 44" fill="none">
            <path d="M20 2 L38 12 L38 32 L20 42 L2 32 L2 12 Z" stroke="url(#lg)" strokeWidth="2.5" fill="none"/>
            <path d="M20 10 L20 34 M12 16 L28 28 M28 16 L12 28" stroke="#00D2D3" strokeWidth="1.5" strokeOpacity="0.6"/>
            <defs>
              <linearGradient id="lg" x1="20" y1="2" x2="20" y2="42" gradientUnits="userSpaceOnUse">
                <stop stopColor="white"/>
                <stop offset="1" stopColor="#348997"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <p className="mt-4 text-[#E0E0E0] text-[22px] font-medium tracking-wide">Alfa Кошелёк ЦР</p>
      <p className="text-[rgba(185,202,203,0.6)] text-[12px] tracking-widest uppercase mt-1">Цифровой рубль</p>
    </div>
  );
}

function InputField({
  label, placeholder, type = "text", value, onChange, icon, error, inputMode,
}: {
  label: string; placeholder: string; type?: string; value: string;
  onChange: (v: string) => void; icon?: string; error?: string; inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="mb-4">
      <p className="text-[#E0E0E0] text-[13px] mb-2 uppercase tracking-[1px]">{label}</p>
      <div className="relative">
        {icon && <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#00F2FF] text-[20px]">{icon}</span>}
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[rgba(255,255,255,0.05)] border-2 rounded-[17px] px-4 py-3.5 text-[#E0E0E0] text-[16px] outline-none transition-colors"
          style={{
            fontFamily: "'Manrope:Regular', sans-serif",
            paddingLeft: icon ? "42px" : "16px",
            borderColor: error ? "rgba(255,180,171,0.7)" : "rgba(63,78,79,0.7)",
          }}
        />
      </div>
      {error && <p className="text-[#FFB4AB] text-[12px] mt-1.5">{error}</p>}
    </div>
  );
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className="w-full relative rounded-[17px] h-[52px] mt-2 overflow-hidden pressable"
      style={disabled
        ? { background: "#1E2525", opacity: 0.5, cursor: "not-allowed" }
        : { background: "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)", boxShadow: "0 10px 20px -2px rgba(0,0,0,0.2), 0 0 30px rgba(72,255,213,0.4)" }}
    >
      <span className="relative text-[18px] font-medium" style={{ color: disabled ? "#445456" : "#0B1A1A" }}>{label}</span>
    </button>
  );
}

export default function AuthPage() {
  const { login, register, requestCode, forgotPassword, resetPassword } = useWallet();
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [showRegCode, setShowRegCode] = useState(false);
  const [channel, setChannel] = useState<OtpChannel>("sms");
  const [codeHint, setCodeHint] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [passport, setPassport] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [divCode, setDivCode] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [soon, setSoon] = useState<"alfa" | "gosuslugi" | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const skipWipe = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_DRAFT);
      if (raw) {
        const d = JSON.parse(raw) as Partial<AuthDraft>;
        if (d.step) setStep(d.step);
        if (d.email != null) setEmail(d.email);
        if (d.showCode) setShowCode(true);
        if (d.showRegCode) setShowRegCode(true);
        if (d.channel === "email" || d.channel === "sms") setChannel(d.channel);
        if (d.codeHint != null) setCodeHint(d.codeHint);
        if (d.lastName != null) setLastName(d.lastName);
        if (d.firstName != null) setFirstName(d.firstName);
        if (d.middleName != null) setMiddleName(d.middleName);
        if (d.issueDate != null) setIssueDate(d.issueDate);
        if (d.divCode != null) setDivCode(d.divCode);
        if (d.regPhone != null) setRegPhone(d.regPhone);
        if (d.regEmail != null) setRegEmail(d.regEmail);
        if (d.agreed) setAgreed(true);
        if (d.resetMode) setResetMode(true);
      }
    } catch {
      /* ignore broken draft */
    }
    skipWipe.current = true;
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    if (skipWipe.current) {
      skipWipe.current = false;
      return;
    }
    const draft: AuthDraft = {
      step, email, password: "", code: "", showCode, showRegCode, channel, codeHint,
      lastName, firstName, middleName, passport: "", issueDate, divCode,
      regPhone, regEmail, regPassword: "", agreed, resetMode, newPassword: "", newPassword2: "",
    };
    try {
      localStorage.setItem(AUTH_DRAFT, JSON.stringify(draft));
    } catch {
      /* quota */
    }
  }, [
    draftHydrated, step, email, password, code, showCode, showRegCode, channel, codeHint,
    lastName, firstName, middleName, passport, issueDate, divCode,
    regPhone, regEmail, regPassword, agreed, resetMode, newPassword, newPassword2,
  ]);

  function clearAuthDraft() {
    try {
      localStorage.removeItem(AUTH_DRAFT);
    } catch {
      /* ignore */
    }
  }

  function loginIdError(v: string) {
    const t = v.trim();
    if (!t) return "Укажите почту или телефон";
    if (t.includes("@")) return validateEmail(t);
    return validatePhone(t);
  }

  async function sendLoginCode() {
    const next: Record<string, string> = {
      email: loginIdError(email),
      password: validatePassword(password),
    };
    setErrors(next);
    if (next.email || next.password) return;
    const r = await requestCode({ login: email, password, channel, purpose: "login" });
    if (r.error) {
      setFormError(r.error);
      return;
    }
    if (r.needLink) {
      setBotUrl(r.botUrl || "");
      setCodeHint("Код бесплатно придёт в Telegram на этот номер. Откройте бота, нажмите «Поделиться номером» и запросите код ещё раз.");
      setShowCode(true);
      setFormError("");
      return;
    }
    setBotUrl("");
    if (r.via === "skip") {
      const err = await login(email, password);
      setFormError(err || "");
      if (!err) clearAuthDraft();
      return;
    }
    setShowCode(true);
    const hint =
      r.via === "demo"
        ? "Демо: любые 4 цифры"
        : r.via === "telegram"
          ? `Код в Telegram на ${r.masked}.`
          : r.fallback
            ? `На телефон не дошло — код отправлен на почту ${r.masked}.`
            : `Код отправлен на ${r.masked}.`;
    setCodeHint(hint);
    setFormError("");
  }

  async function handleLogin() {
    const next: Record<string, string> = {
      email: loginIdError(email),
      password: validatePassword(password),
    };
    if (!showCode) {
      await sendLoginCode();
      return;
    }
    next.code = validateSms(code);
    setErrors(next);
    if (next.email || next.password || next.code) return;
    const err = await login(email, password, code);
    setFormError(err || "");
    if (!err) clearAuthDraft();
  }

  async function sendResetCode() {
    const idErr = loginIdError(email);
    setErrors({ email: idErr });
    if (idErr) return;
    const ch = resetMode ? channel : "email";
    if (!resetMode) setChannel("email");
    const r = await forgotPassword(email, ch);
    if (r.error) {
      setFormError(r.error);
      return;
    }
    if (r.needLink) {
      setBotUrl(r.botUrl || "");
      setResetMode(true);
      setShowCode(true);
      setCodeHint("Код бесплатно придёт в Telegram на этот номер. Откройте бота, нажмите «Поделиться номером» и запросите код ещё раз.");
      setFormError("");
      return;
    }
    setBotUrl("");
    setResetMode(true);
    setShowCode(true);
    const hint =
      r.via === "demo"
        ? "Демо: любые 4 цифры, затем задайте новый пароль"
        : r.via === "telegram"
          ? `Код в Telegram на ${r.masked}.`
          : r.fallback
            ? `На телефон не дошло — код восстановления на почте ${r.masked}.`
            : `Код восстановления отправлен на ${r.masked}.`;
    setCodeHint(hint);
    setFormError("");
  }

  async function handleReset() {
    const next: Record<string, string> = {
      email: loginIdError(email),
      password: validatePassword(newPassword),
      code: validateSms(code),
    };
    if (newPassword !== newPassword2) next.password2 = "Пароли не совпадают";
    setErrors(next);
    if (next.email || next.password || next.password2 || next.code) return;
    const err = await resetPassword(email, code, newPassword);
    setFormError(err || "");
    if (!err) clearAuthDraft();
  }

  async function finishRegister() {
    const next: Record<string, string> = {
      phone: validatePhone(regPhone),
      email: validateEmail(regEmail),
      password: validatePassword(regPassword),
      agreed: agreed ? "" : "Нужно согласие на обработку данных",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    if (!showRegCode) {
      const r = await requestCode({ purpose: "register", channel, email: regEmail, phone: regPhone });
      if (r.error) {
        setFormError(r.error);
        return;
      }
      if (r.needLink) {
        setBotUrl(r.botUrl || "");
        setShowRegCode(true);
        setCodeHint("Код бесплатно придёт в Telegram на этот номер. Откройте бота, нажмите «Поделиться номером» и запросите код ещё раз.");
        setFormError("");
        return;
      }
      setBotUrl("");
      if (r.via === "skip") {
        const err = await register({
          lastName, firstName, middleName, passport, phone: regPhone, email: regEmail, password: regPassword, code: "000000", channel,
        });
        setFormError(err || "");
        if (!err) clearAuthDraft();
        return;
      }
      setShowRegCode(true);
      setCodeHint(r.via === "telegram" ? `Код в Telegram на ${r.masked}.` : r.fallback ? `На телефон не дошло — код на почте ${r.masked}.` : `Код отправлен на ${r.masked}.`);
      setFormError("");
      return;
    }
    next.code = validateSms(code);
    setErrors(next);
    if (next.code) return;
    const err = await register({
      lastName, firstName, middleName, passport, phone: regPhone, email: regEmail, password: regPassword, code, channel,
    });
    setFormError(err || "");
    if (!err) clearAuthDraft();
  }

  return (
    <div className="flex-1 min-h-0 bg-[#121212] flex flex-col relative overflow-hidden page-enter">
      <GlowLogo />
      {readPayLink() && (
        <p className="mx-4 mb-2 rounded-[16px] bg-[#191C1C] px-4 py-3 text-center text-[14px] text-[#E0E0E0]">
          Войдите, чтобы оплатить {readPayLink()?.title}
        </p>
      )}
      <div className="flex-1 overflow-y-auto pb-8">
        {step === "login" && (
          <div className="px-4 sm:px-6 max-w-[440px] mx-auto w-full">
            <p className="text-[#E0E0E0] text-[24px] text-center mb-6 font-medium">Авторизация</p>
            <InputField label="Почта или телефон" placeholder="name@mail.ru или +7 9XX" value={email} onChange={(v) => { setEmail(v.includes("@") || /[a-zA-Z]/.test(v) ? v : editPhoneMask(email, v)); setErrors((e) => ({ ...e, email: "" })); }} icon="mail" error={errors.email} />
            <InputField label="Пароль" placeholder="минимум 8 символов" type="password" value={password} onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: "" })); }} icon="lock" error={errors.password} />
            <p className="text-right text-[#00D2D3] text-[13px] mb-4 -mt-1 cursor-pointer" onClick={() => void sendResetCode()}>Забыли пароль?</p>
            {resetMode && (
              <>
                <InputField label="Новый пароль" placeholder="от 8 символов" type="password" value={newPassword} onChange={setNewPassword} icon="lock" error={errors.password} />
                <InputField label="Повторите пароль" placeholder="ещё раз" type="password" value={newPassword2} onChange={setNewPassword2} icon="lock" error={errors.password2} />
              </>
            )}
            {showCode && (
              <OtpPanel
                channel={channel}
                onChannel={setChannel}
                code={code}
                onCode={setCode}
                hint={codeHint}
                error={errors.code}
                botUrl={botUrl}
              />
            )}
            {formError && <p className="text-[#FFB4AB] text-[13px] mb-3">{formError}</p>}
            {showCode && (
              <button
                type="button"
                className="w-full text-[13px] text-[#00D2D3] mb-2"
                onClick={() => void (resetMode ? sendResetCode() : sendLoginCode())}
              >
                Выслать код ещё раз
              </button>
            )}
            {resetMode ? (
              <>
                <PrimaryButton label="Сменить пароль и войти" onClick={() => void handleReset()} />
                <button type="button" className="w-full text-[13px] text-[rgba(185,202,203,0.6)] mt-3" onClick={() => { setResetMode(false); setShowCode(false); setFormError(""); setCodeHint(""); }}>
                  Назад ко входу
                </button>
              </>
            ) : (
              <PrimaryButton label={showCode ? "Подтвердить" : "Войти"} onClick={() => void handleLogin()} />
            )}
            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-[rgba(68,84,86,0.3)]" />
              <span className="mx-3 text-[#E0E0E0] text-[10px] uppercase tracking-[2px]">или через</span>
              <div className="flex-1 h-px bg-[rgba(68,84,86,0.3)]" />
            </div>
            <button type="button" onClick={() => setSoon("alfa")} className="w-full flex items-center bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.3)] rounded-[40px] h-[52px] px-4 mb-3 pressable">
              <img src={imgAlfaLogo} alt="" className="w-10 h-10 object-cover opacity-90" />
              <span className="flex-1 text-center text-[#E0E0E0] text-[16px]">Альфа-Банк</span>
            </button>
            <button type="button" onClick={() => setSoon("gosuslugi")} className="w-full flex items-center bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.3)] rounded-[40px] h-[52px] px-4 mb-6 pressable">
              <img src={imgGosuslugi} alt="" className="w-10 h-10 object-contain" />
              <span className="flex-1 text-center text-[#E0E0E0] text-[16px]">Госуслуги</span>
            </button>
            <p className="text-center text-[14px] text-[#E0E0E0]">
              Нет аккаунта?{" "}
              <button type="button" className="text-[#00D2D3]" onClick={() => { setStep("register-name"); setFormError(""); }}>Зарегистрироваться</button>
            </p>
            <p className="text-center text-[11px] text-[rgba(185,202,203,0.35)] mt-4">Нужны реальные почта и мобильный РФ. Демо: ivan@alfa.demo / Demo1234</p>
          </div>
        )}

        {step === "register-name" && (
          <div className="px-4 sm:px-6 max-w-[440px] mx-auto w-full">
            <RegHead step={0} onBack={() => setStep("login")} />
            <p className="text-[#E0E0E0] text-[18px] mb-4">ФИО:</p>
            <InputField label="Фамилия" placeholder="Иванов" value={lastName} onChange={setLastName} error={errors.last} />
            <InputField label="Имя" placeholder="Иван" value={firstName} onChange={setFirstName} error={errors.first} />
            <InputField label="Отчество" placeholder="Иванович" value={middleName} onChange={setMiddleName} error={errors.middle} />
            <PrimaryButton label="Далее" onClick={() => {
              const next = {
                last: validateName("Фамилия", lastName),
                first: validateName("Имя", firstName),
                middle: validateName("Отчество", middleName, false),
              };
              setErrors(next);
              if (!next.last && !next.first && !next.middle) setStep("register-passport");
            }} />
          </div>
        )}

        {step === "register-passport" && (
          <div className="px-4 sm:px-6 max-w-[440px] mx-auto w-full">
            <RegHead step={1} onBack={() => setStep("register-name")} />
            <p className="text-[#E0E0E0] text-[18px] mb-4">Паспортные данные:</p>
            <InputField label="Серия и номер паспорта" placeholder="0000 000000" value={passport} onChange={(v) => setPassport(maskPassport(v))} error={errors.passport} inputMode="numeric" />
            <InputField label="Дата выдачи" placeholder="ДД.ММ.ГГГГ" value={issueDate} onChange={(v) => setIssueDate(maskDate(v))} error={errors.issue} inputMode="numeric" />
            <InputField label="Код подразделения" placeholder="000-000" value={divCode} onChange={(v) => setDivCode(maskDivCode(v))} error={errors.div} inputMode="numeric" />
            <PrimaryButton label="Далее" onClick={() => {
              const next = {
                passport: validatePassport(passport),
                issue: validateIssueDate(issueDate),
                div: validateDivCode(divCode),
              };
              setErrors(next);
              if (!next.passport && !next.issue && !next.div) setStep("register-phone");
            }} />
          </div>
        )}

        {step === "register-phone" && (
          <div className="px-4 sm:px-6 max-w-[440px] mx-auto w-full">
            <RegHead step={2} onBack={() => setStep("register-passport")} />
            <p className="text-[#E0E0E0] text-[18px] mb-4">Вход в систему:</p>
            <InputField label="Номер телефона" placeholder="+7 926 682-19-74 или 8926…" value={regPhone} onChange={(v) => setRegPhone(editPhoneMask(regPhone, v))} icon="smartphone" error={errors.phone} inputMode="tel" />
            <InputField label="Почта" placeholder="ivan@mail.ru" value={regEmail} onChange={setRegEmail} icon="mail" error={errors.email} />
            <InputField label="Пароль" placeholder="от 8 символов, без пробелов" type="password" value={regPassword} onChange={setRegPassword} icon="lock" error={errors.password} />
            <button onClick={() => setAgreed((a) => !a)} className="w-full flex items-start gap-3 bg-[rgba(25,28,28,0.5)] border rounded-[16px] p-4 mb-3 text-left" style={{ borderColor: agreed ? "rgba(0,210,211,0.55)" : "rgba(58,73,75,0.25)" }}>
              <div
                className="w-5 h-5 rounded-[6px] flex-shrink-0 mt-0.5 flex items-center justify-center"
                style={agreed
                  ? { background: "#00D2D3", boxShadow: "0 0 10px rgba(0,210,211,0.45)" }
                  : { background: "transparent", border: "2px solid rgba(185,202,203,0.55)" }}
              >
                {agreed && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1.5 5.2L4.4 8.2L10.5 1.5" stroke="#0B1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <p className="text-[#E0E0E0] text-[13px]">Я даю согласие на обработку персональных данных и принимаю правила платформы цифрового рубля</p>
            </button>
            {errors.agreed && <p className="text-[#FFB4AB] text-[12px] mb-2">{errors.agreed}</p>}
            {showRegCode && (
              <OtpPanel
                channel={channel}
                onChannel={setChannel}
                code={code}
                onCode={setCode}
                hint={codeHint}
                error={errors.code}
                botUrl={botUrl}
              />
            )}
            {formError && <p className="text-[#FFB4AB] text-[13px] mb-2">{formError}</p>}
            {showRegCode && (
              <button
                type="button"
                className="w-full text-[13px] text-[#00D2D3] mb-2"
                onClick={async () => {
                  const r = await requestCode({ purpose: "register", channel, email: regEmail, phone: regPhone });
                  setFormError(r.error || "");
                  if (r.needLink) {
                    setBotUrl(r.botUrl || "");
                    setCodeHint("Откройте Telegram, поделитесь номером и запросите код ещё раз.");
                  } else if (!r.error) {
                    setBotUrl("");
                    setCodeHint(r.via === "telegram" ? `Код в Telegram на ${r.masked}.` : `Код отправлен на ${r.masked}.`);
                  }
                }}
              >
                Выслать код ещё раз
              </button>
            )}
            <PrimaryButton label={showRegCode ? "Подтвердить и создать" : "Получить код"} onClick={() => void finishRegister()} />
          </div>
        )}
      </div>

      {soon && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/55 page-enter">
          <div className="w-full max-w-[393px] rounded-t-[28px] px-5 pt-5 pb-8" style={{ background: "#191C1C" }}>
            <p className="text-[#E0E0E0] text-[18px] font-medium">{soon === "alfa" ? "Альфа-Банк" : "Госуслуги"}</p>
            <p className="text-[rgba(185,202,203,0.75)] text-[14px] mt-2 leading-relaxed">
              Это пока не реализовано, но скоро будет. OAuth банка и ЕСИА подключим на этапе с сервером.
            </p>
            <button
              className="w-full h-12 rounded-[16px] mt-5 font-medium pressable"
              style={{ background: "linear-gradient(128deg, #00D2D3, #48FFD5)", color: "#0B1A1A" }}
              onClick={() => setSoon(null)}
            >
              Понятно
            </button>
            <button
              className="w-full mt-3 text-[12px] text-[rgba(185,202,203,0.45)]"
              onClick={async () => {
                setSoon(null);
                const err = await login("ivan@alfa.demo", "Demo1234");
                setFormError(err || "");
              }}
            >
              Служебный вход в демо
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RegHead({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div className="flex items-center mb-4">
      <button onClick={onBack} className="mr-3 pressable"><span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span></button>
      <p className="text-[#E0E0E0] text-[22px] font-medium">Регистрация</p>
      <div className="ml-auto flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-3 h-3 rounded-full" style={{ background: i <= step ? "linear-gradient(#48FFD5, #00D2D3)" : "rgba(30,37,37,1)" }} />
        ))}
      </div>
    </div>
  );
}
