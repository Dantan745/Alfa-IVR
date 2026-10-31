let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, when: number, duration: number, volume: number) {
  const current = audio();
  if (!current) return;
  const osc = current.createOscillator();
  const gain = current.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(current.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function unlockSound() {
  audio();
}

export function playPaid() {
  const current = audio();
  if (!current) return;
  const start = current.currentTime;
  beep(523, start, 0.12, 0.07);
  beep(784, start + 0.11, 0.18, 0.06);
}

export function playDenied() {
  const current = audio();
  if (!current) return;
  beep(196, current.currentTime, 0.22, 0.06);
}

export function playReply() {
  const current = audio();
  if (!current) return;
  beep(660, current.currentTime, 0.16, 0.05);
}
