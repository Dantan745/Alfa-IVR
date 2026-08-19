const DEVICE = "alfa-bio-device";
const PASSED = "alfa-bio-passed";
const CRED = "alfa-bio-cred";

export function deviceBioOn() {
  try {
    return localStorage.getItem(DEVICE) === "1";
  } catch {
    return false;
  }
}

export function setDeviceBio(on: boolean) {
  if (on) localStorage.setItem(DEVICE, "1");
  else localStorage.removeItem(DEVICE);
}

export function bioPassed() {
  try {
    return sessionStorage.getItem(PASSED) === "1";
  } catch {
    return false;
  }
}

export function markBioPassed() {
  sessionStorage.setItem(PASSED, "1");
}

export function clearBioPassed() {
  sessionStorage.removeItem(PASSED);
}

type BioResult = { ok: boolean; reason?: string };

async function nativePlatform() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function reasonOf(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "userCancel" || code === "systemCancel" || code === "appCancel") return "Скан отменён";
  if (code === "biometryNotEnrolled" || code === "biometryNotAvailable") return "Включите отпечаток или скан лица в настройках телефона";
  if (code === "biometryLockout") return "Слишком много попыток. Разблокируйте телефон и попробуйте снова";
  if (code === "authenticationFailed") return "Не удалось распознать отпечаток или лицо";
  return "Не удалось подтвердить личность";
}

async function nativeScan(): Promise<BioResult> {
  const { BiometricAuth, AndroidBiometryStrength } = await import("@aparajita/capacitor-biometric-auth");
  const info = await BiometricAuth.checkBiometry();
  if (!info.isAvailable) {
    return { ok: false, reason: info.reason || "Включите отпечаток или скан лица в настройках телефона" };
  }
  try {
    await BiometricAuth.authenticate({
      reason: "Вход в Alfa Кошелёк ЦР",
      cancelTitle: "Отмена",
      androidTitle: "Вход в кошелёк",
      androidSubtitle: "Отпечаток пальца или скан лица",
      allowDeviceCredential: false,
      iosFallbackTitle: "",
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: reasonOf(e) };
  }
}

function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64ToBytes(s: string) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "===".slice((pad.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function webHelloAvailable() {
  if (!window.isSecureContext || !window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function webEnroll(): Promise<BioResult> {
  if (!(await webHelloAvailable())) return { ok: false, reason: "На этом устройстве нет отпечатка или скана лица" };
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Alfa Кошелёк ЦР", id: location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "alfa-koshelek",
          displayName: "Alfa Кошелёк ЦР",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, reason: "Скан отменён" };
    localStorage.setItem(CRED, bytesToB64(new Uint8Array(cred.rawId)));
    return { ok: true };
  } catch {
    return { ok: false, reason: "Скан отменён" };
  }
}

async function webScan(): Promise<BioResult> {
  const id = localStorage.getItem(CRED);
  if (!id) return { ok: false, reason: "Сначала включите вход по лицу или отпечатку в разделе безопасности" };
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: b64ToBytes(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return cred ? { ok: true } : { ok: false, reason: "Скан отменён" };
  } catch {
    return { ok: false, reason: "Скан отменён" };
  }
}

export async function enrollBiometry(): Promise<BioResult> {
  if (await nativePlatform()) return nativeScan();
  return webEnroll();
}

export async function scanBiometry(): Promise<BioResult> {
  if (await nativePlatform()) return nativeScan();
  return webScan();
}
