import { useEffect, useRef, useState, type ReactNode } from "react";
import { clearPayLink, readPayLink, type QrBill } from "./qr";
import { backNav, ensureRoot, pushNav, type NavSnap } from "./navHistory";
import { bioPassed, deviceBioOn, markBioPassed } from "./bio";
import BioGate from "./components/BioGate";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import PaymentsPage from "./pages/PaymentsPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import TransferPage from "./pages/TransferPage";
import QRPage from "./pages/QRPage";
import LimitsPage from "./pages/LimitsPage";
import AddressBookPage from "./pages/AddressBookPage";
import BulkPaymentsPage from "./pages/BulkPaymentsPage";
import SmartContractPage from "./pages/SmartContractPage";
import TopUpPage from "./pages/TopUpPage";
import TxDetailPage from "./pages/TxDetailPage";
import NotificationsPage from "./pages/NotificationsPage";
import SecurityPage from "./pages/SecurityPage";
import SupportPage from "./pages/SupportPage";
import BottomNav from "./components/BottomNav";
import AdminPage from "./pages/AdminPage";
import { useWallet } from "./wallet";

type Tab = "home" | "payments" | "history" | "profile";
type SubPage =
  | "transfer" | "qr" | "limits" | "address"
  | "bulk" | "smart" | "topup" | "tx" | "notifications" | "security" | "support" | null;

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="app-stage">
      <div className="app-frame">{children}</div>
    </div>
  );
}

export default function App() {
  const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const { ready, authed, toast, logout } = useWallet();
  if (isAdmin) return <AdminPage />;
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<SubPage>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [payLink, setPayLink] = useState<QrBill | null>(() => readPayLink());
  const [unlocked, setUnlocked] = useState(false);
  const place = useRef({ tab, sub });
  place.current = { tab, sub };
  const qrPushed = useRef(false);

  useEffect(() => {
    if (authed && bioPassed()) setUnlocked(true);
  }, [authed]);

  useEffect(() => {
    ensureRoot();
    const onPop = (e: PopStateEvent) => {
      const s = e.state as NavSnap | null;
      if (!s?.alfaNav || s.otp) return;
      setTab((s.tab as Tab) || "home");
      setSub((s.sub as SubPage) || null);
      setTxId(s.txId);
      if (!s.sub) {
        setPayLink(null);
        clearPayLink();
      }
    };
    const onStay = () => {
      const p = place.current;
      if (p.sub) {
        setSub(null);
        setTxId(null);
        setPayLink(null);
        clearPayLink();
        return;
      }
      if (p.tab !== "home") setTab("home");
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("alfa-back", onStay);
    let stop = false;
    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (stop || !Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
            return;
          }
          const p = place.current;
          if (p.sub || p.tab !== "home") {
            window.dispatchEvent(new Event("alfa-back"));
            return;
          }
          void App.exitApp();
        });
        if (stop) {
          void handle.remove();
          return;
        }
        remove = () => { void handle.remove(); };
      } catch {
        /* браузер и рабочий стол */
      }
    })();
    return () => {
      stop = true;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("alfa-back", onStay);
      remove?.();
    };
  }, []);

  useEffect(() => {
    if (authed && payLink && !qrPushed.current) {
      qrPushed.current = true;
      setSub("qr");
      pushNav({ tab: "home", sub: "qr", txId: null });
    }
  }, [authed, payLink]);

  function navigate(page: string, extra?: string) {
    const subs: SubPage[] = ["transfer", "qr", "limits", "address", "bulk", "smart", "topup", "tx", "notifications", "security", "support"];
    const tabs: Tab[] = ["home", "payments", "history", "profile"];
    if (page === "tx" && extra) {
      setTxId(extra);
      setSub("tx");
      pushNav({ tab, sub: "tx", txId: extra });
      return;
    }
    if (subs.includes(page as SubPage)) {
      setSub(page as SubPage);
      pushNav({ tab, sub: page, txId: null });
    } else if (tabs.includes(page as Tab)) {
      setTab(page as Tab);
      setSub(null);
      pushNav({ tab: page, sub: null, txId: null });
    }
  }

  function goBack() {
    if (backNav()) return;
    setSub(null);
    setTxId(null);
    setPayLink(null);
    clearPayLink();
  }

  function openTab(next: Tab) {
    setTab(next);
    setSub(null);
    pushNav({ tab: next, sub: null, txId: null });
  }

  if (!ready) {
    return (
      <Frame>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[var(--accent)] text-sm">Загрузка кошелька…</p>
        </div>
      </Frame>
    );
  }

  if (!authed) {
    return (
      <Frame>
        <AuthPage />
      </Frame>
    );
  }

  if (deviceBioOn() && !unlocked) {
    return (
      <Frame>
        <BioGate
          onPassed={() => { markBioPassed(); setUnlocked(true); }}
          onPassword={() => { setUnlocked(false); void logout(); }}
        />
      </Frame>
    );
  }

  function renderSubPage() {
    switch (sub) {
      case "transfer": return <TransferPage onBack={goBack} onNavigate={navigate} />;
      case "qr": return <QRPage onBack={goBack} incoming={payLink} />;
      case "limits": return <LimitsPage onBack={goBack} />;
      case "address": return <AddressBookPage onBack={goBack} onTransfer={() => navigate("transfer")} />;
      case "bulk": return <BulkPaymentsPage onBack={goBack} />;
      case "smart": return <SmartContractPage onBack={goBack} />;
      case "topup": return <TopUpPage onBack={goBack} />;
      case "tx": return <TxDetailPage txId={txId || ""} onBack={goBack} onRepeat={() => navigate("transfer")} />;
      case "notifications": return <NotificationsPage onBack={goBack} onNavigate={navigate} />;
      case "security": return <SecurityPage onBack={goBack} />;
      case "support": return <SupportPage onBack={goBack} />;
      default: return null;
    }
  }

  function renderTab() {
    switch (tab) {
      case "home": return <HomePage onNavigate={navigate} />;
      case "payments": return <PaymentsPage onNavigate={navigate} />;
      case "history": return <HistoryPage onOpenTx={(id) => navigate("tx", id)} />;
      case "profile": return <ProfilePage onNavigate={navigate} />;
    }
  }

  return (
    <Frame>
      <div className="relative z-10 flex flex-1 min-h-0 min-w-0 flex-col md:flex-row">
        {!sub && (
          <BottomNav
            variant="side"
            current={tab}
            onNavigate={openTab}
          />
        )}
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] z-0 hidden sm:block" style={{ background: "linear-gradient(to bottom, rgba(0,242,255,0.05), transparent)" }} />
          {sub ? (
            <div key={sub || "sub"} className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto page-swap">{renderSubPage()}</div>
          ) : (
            <>
              <div key={tab} className="relative z-10 min-h-0 flex-1 overflow-y-auto page-swap">{renderTab()}</div>
              <BottomNav
                variant="bottom"
                current={tab}
                onNavigate={openTab}
              />
            </>
          )}
        </div>
        {toast && (
          <div className="absolute left-4 right-4 z-30 rounded-[16px] px-4 py-3 text-center text-[13px] text-[#0B1A1A] page-enter bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:left-auto md:right-8 md:bottom-8 md:w-[320px]">
            <span className="block rounded-[16px] px-4 py-3" style={{ background: "var(--fill)" }}>{toast}</span>
          </div>
        )}
      </div>
    </Frame>
  );
}
