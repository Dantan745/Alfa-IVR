const KEY = "alfa-pin-passed";

export function pinPassed() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markPinPassed() {
  sessionStorage.setItem(KEY, "1");
}

export function clearPinPassed() {
  sessionStorage.removeItem(KEY);
}
