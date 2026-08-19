export type NavSnap = {
  alfaNav: true;
  otp?: boolean;
  tab: string;
  sub: string | null;
  txId: string | null;
};

export function ensureRoot() {
  const s = history.state as NavSnap | null;
  if (!s?.alfaNav) history.replaceState({ alfaNav: true, tab: "home", sub: null, txId: null }, "");
}

export function pushNav(next: { tab: string; sub: string | null; txId: string | null }) {
  const s = history.state as NavSnap | null;
  if (s?.alfaNav && !s.otp && s.tab === next.tab && s.sub === next.sub && (s.txId || null) === (next.txId || null)) return;
  history.pushState({ alfaNav: true, tab: next.tab, sub: next.sub, txId: next.txId }, "");
}

export function backNav() {
  const s = history.state as NavSnap | null;
  if (s?.alfaNav && history.length > 1) {
    history.back();
    return true;
  }
  return false;
}
