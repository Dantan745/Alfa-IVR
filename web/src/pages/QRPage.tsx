import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PayOtpSheet, PAY_OTP_LIMIT, type OtpChannel } from "../components/OtpPanel";
import { encodeAlfaQr, parseQr, type QrBill } from "../qr";
import { useWallet } from "../wallet";

interface QRPageProps {
  onBack: () => void;
  incoming?: QrBill | null;
}

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]> };

function detectorOf(): Detector | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function readFile(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0);
  const detector = detectorOf();
  if (detector) {
    const codes = await detector.detect(canvas);
    if (codes[0]?.rawValue) return codes[0].rawValue;
  }
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height)?.data || "";
}

export default function QRPage({ onBack, incoming = null }: QRPageProps) {
  const { qrPay, requestCode, user } = useWallet();
  const [tab, setTab] = useState<"generate" | "scan">("scan");
  const [amount, setAmount] = useState("");
  const [image, setImage] = useState("");
  const [copied, setCopied] = useState("");
  const [camError, setCamError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [bill, setBill] = useState<QrBill | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState("");
  const [done, setDone] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>(user?.otpChannel === "email" ? "email" : "sms");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seen = useRef("");

  const title = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Кошелёк ЦР";
  const walletId = user?.walletId || "";
  const sum = Number(String(amount).replace(",", "."));
  const payload = encodeAlfaQr({ walletId, title, amount: sum > 0 ? sum : undefined });

  useEffect(() => {
    if (!incoming) return;
    if (incoming.payee && walletId && incoming.payee.toLowerCase() === walletId.toLowerCase()) {
      setCamError("Это ваш QR");
      setBill(null);
      return;
    }
    setBill(incoming);
    setPayAmount(incoming.amount != null ? String(incoming.amount) : "");
  }, [incoming, walletId]);

  useEffect(() => {
    let stop = false;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#062424", light: "#F7FFFE" },
    }).then((url) => {
      if (!stop) setImage(url);
    }).catch(() => {
      if (!stop) setImage("");
    });
    return () => { stop = true; };
  }, [payload]);

  function openBill(raw: string) {
    if (!raw || raw === seen.current) return;
    const parsed = parseQr(raw);
    if (!parsed) {
      seen.current = raw;
      setCamError("Этот QR не для оплаты в Альфа Кошельке");
      window.setTimeout(() => {
        if (seen.current === raw) seen.current = "";
      }, 2000);
      return;
    }
    if (parsed.payee && walletId && parsed.payee.toLowerCase() === walletId.toLowerCase()) {
      setCamError("Это ваш QR");
      return;
    }
    seen.current = raw;
    setCamError("");
    setPayError("");
    setDone("");
    setBill(parsed);
    setPayAmount(parsed.amount != null ? String(parsed.amount) : "");
  }

  useEffect(() => {
    if (tab !== "scan" || bill) return;
    let stop = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const detector = detectorOf();
    setCamError("");
    setTorchOk(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stop) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchOk(Boolean(caps?.torch));
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stop) return;
          if (video.readyState >= 2) {
            let text = "";
            if (detector) {
              const codes = await detector.detect(video);
              text = codes[0]?.rawValue || "";
            } else if (ctx) {
              const w = video.videoWidth;
              const h = video.videoHeight;
              if (w && h) {
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                text = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data || "";
              }
            }
            if (text) {
              openBill(text);
              return;
            }
          }
          if (!stop) requestAnimationFrame(() => { void tick(); });
        };
        void tick();
      } catch {
        if (!stop) setCamError("Нет доступа к камере. Разрешите камеру или загрузите фото QR.");
      }
    })();
    return () => {
      stop = true;
      setTorchOn(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [tab, bill]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchOk(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Оплата в Альфа Кошельке", url: payload });
        return;
      }
    } catch {
      /* user cancelled or share failed */
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopied("Ссылка скопирована");
    } catch {
      setCopied(payload);
    }
  }

  async function pay(code?: string) {
    if (!bill) return;
    const value = Number(String(payAmount).replace(",", "."));
    if (!(value > 0)) {
      setPayError("Укажите сумму");
      return;
    }
    if (value > PAY_OTP_LIMIT && !code) {
      setOtpOpen(true);
      return;
    }
    setPayError("");
    const err = await qrPay(value, {
      code,
      merchant: bill.title,
      payee: bill.payee,
    });
    if (err) {
      setPayError(err);
      return;
    }
    setOtpOpen(false);
    setDone(`Оплачено ${value.toLocaleString("ru-RU")} ₽`);
    setBill(null);
    seen.current = "";
    if (incoming) onBack();
  }

  const payValue = Number(String(payAmount).replace(",", "."));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#191C1C] flex items-center justify-center pressable">
          <span className="material-symbols-outlined text-[#00D2D3]">arrow_back</span>
        </button>
        <p className="text-[#E0E0E0] text-[20px] font-medium">QR-оплата</p>
      </div>

      <div className="flex mx-4 mb-4 bg-[#191C1C] rounded-[16px] p-1">
        {([["scan", "Сканировать"], ["generate", "Мой QR"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setBill(null); seen.current = ""; setDone(""); setCamError(""); }}
            className="flex-1 py-2.5 rounded-[12px] text-[13px] font-medium pressable"
            style={{ background: tab === key ? "#282A2A" : "transparent", color: tab === key ? "#00D2D3" : "rgba(185,202,203,0.6)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "scan" ? (
        <div className="px-4">
          <div className="relative w-full overflow-hidden rounded-[28px] bg-black" style={{ aspectRatio: "3 / 4", maxHeight: 460 }}>
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[230px] w-[230px]">
                <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-[8px] border-l-[3px] border-t-[3px] border-[#48FFD5]" />
                <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-[8px] border-r-[3px] border-t-[3px] border-[#48FFD5]" />
                <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-[8px] border-b-[3px] border-l-[3px] border-[#48FFD5]" />
                <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-[8px] border-b-[3px] border-r-[3px] border-[#48FFD5]" />
                <div className="qr-beam absolute left-3 right-3 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #48FFD5, transparent)", boxShadow: "0 0 12px #48FFD5" }} />
              </div>
            </div>
            {torchOk && (
              <button type="button" onClick={() => void toggleTorch()} className="absolute right-3 top-3 pressable rounded-full bg-black/50 px-3 py-2 text-[12px] text-[#48FFD5]">
                {torchOn ? "Вспышка вкл" : "Вспышка"}
              </button>
            )}
          </div>
          <p className="mt-4 text-center text-[16px] text-[#E0E0E0]">Наведите рамку на QR</p>
          <p className="mt-1 text-center text-[13px] text-[rgba(185,202,203,0.55)]">Код кассы, счёта или кошелька ЦР</p>
          {camError && <p className="mt-3 text-center text-[13px] text-[#FFB4AB]">{camError}</p>}
          {done && <p className="mt-3 text-center text-[14px] text-[#48FFD5]">{done}</p>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void readFile(file).then((text) => openBill(text || " ")).catch(() => setCamError("Не удалось прочитать фото"));
          }} />
          <button type="button" className="mt-4 w-full rounded-[17px] border border-[rgba(0,210,211,0.3)] py-3 text-[14px] text-[#00D2D3] pressable" onClick={() => fileRef.current?.click()}>
            Загрузить фото QR
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center px-4">
          <div className="mb-4 rounded-[28px] bg-[#F7FFFE] p-4">
            {image ? <img src={image} alt="QR для оплаты" width={260} height={260} className="rounded-[12px]" /> : <div className="h-[260px] w-[260px]" />}
          </div>
          <p className="text-[16px] text-[#E0E0E0]">{title}</p>
          <p className="mt-1 text-[13px] text-[rgba(185,202,203,0.6)]">{user?.phone || walletId}</p>
          <p className="mt-1 text-[12px] text-[rgba(185,202,203,0.4)]">{walletId}</p>
          <p className="mt-3 text-center text-[13px] text-[rgba(185,202,203,0.55)]">Камера телефона откроет оплату в Альфа Кошельке</p>
          <div className="mt-4 w-full">
            <p className="mb-2 text-[12px] uppercase tracking-[1px] text-[rgba(185,202,203,0.7)]">Сумма в QR, необязательно</p>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Пусто — плательщик введёт сам"
              className="w-full rounded-[17px] border-2 border-[rgba(63,78,79,0.7)] bg-[rgba(255,255,255,0.05)] px-4 py-3.5 text-[16px] text-[#E0E0E0] outline-none"
            />
          </div>
          <button type="button" onClick={() => void share()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[17px] border border-[rgba(0,210,211,0.3)] py-3.5 pressable">
            <span className="material-symbols-outlined text-[20px] text-[#00D2D3]">share</span>
            <span className="text-[15px] text-[#00D2D3]">Поделиться QR</span>
          </button>
          {copied && <p className="mt-2 break-all text-center text-[12px] text-[#48FFD5]">{copied}</p>}
        </div>
      )}

      {bill && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/55">
          <div className="w-full rounded-t-[28px] bg-[#191C1C] px-5 pb-8 pt-5">
            <p className="text-[13px] uppercase tracking-[1px] text-[rgba(185,202,203,0.5)]">К оплате</p>
            <p className="mt-1 text-[20px] text-[#E0E0E0]">{bill.title}</p>
            {bill.payee ? <p className="mt-1 text-[13px] text-[rgba(185,202,203,0.55)]">{bill.payee}</p> : null}
            <p className="mb-2 mt-4 text-[12px] uppercase tracking-[1px] text-[rgba(185,202,203,0.7)]">Сумма</p>
            <input
              inputMode="decimal"
              value={payAmount}
              readOnly={bill.amount != null}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-[17px] border-2 border-[rgba(63,78,79,0.7)] bg-[rgba(255,255,255,0.05)] px-4 py-3.5 text-[22px] text-[#E0E0E0] outline-none"
            />
            {payError && <p className="mt-2 text-[13px] text-[#FFB4AB]">{payError}</p>}
            <button
              type="button"
              className="mt-4 h-[52px] w-full rounded-[17px] text-[18px] font-medium pressable"
              style={{ background: "linear-gradient(128deg, #00D2D3 0%, #48FFD5 51%, #00D2D3 100%)", color: "#0B1A1A" }}
              onClick={() => void pay()}
            >
              {payValue > 0 ? `Оплатить ${payValue.toLocaleString("ru-RU")} ₽` : "Оплатить"}
            </button>
            <button type="button" className="mt-2 w-full py-2 text-[14px] text-[rgba(185,202,203,0.7)]" onClick={() => { setBill(null); seen.current = ""; if (incoming) onBack(); }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <PayOtpSheet
        open={otpOpen}
        amount={payValue}
        channel={otpChannel}
        onChannel={setOtpChannel}
        code={otpCode}
        onCode={setOtpCode}
        hint={otpHint}
        error={payError}
        busy={otpBusy}
        onCancel={() => setOtpOpen(false)}
        onSend={() => {
          setOtpBusy(true);
          void requestCode({ purpose: "pay", amount: payValue, channel: otpChannel }).then((r) => {
            setOtpHint(r.error ? "" : `Код отправлен${r.masked ? ` на ${r.masked}` : ""}`);
            if (r.error) setPayError(r.error);
          }).finally(() => setOtpBusy(false));
        }}
        onConfirm={() => { void pay(otpCode); }}
      />
      <div className="h-8" />
    </div>
  );
}
