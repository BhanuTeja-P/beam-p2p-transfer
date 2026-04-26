import React, { useState, useEffect } from "react";
import SendPage from "./components/SendPage";
import ReceivePage from "./components/ReceivePage";

type Tab = "send" | "receive";

export default function App() {
  const [tab, setTab] = useState<Tab>("send");
  const [initialCode, setInitialCode] = useState<string>("");

  // Handle URL params for QR code deep-linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const mode = params.get("mode");

    if (code && mode === "receive") {
      setInitialCode(code.toUpperCase());
      setTab("receive");
    }
  }, []);

  return (
    <div className="min-h-screen grid-bg relative">
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-accent/3 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 py-8 sm:py-12 min-h-[100dvh] flex flex-col justify-center">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center animate-glow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#00D4FF"/>
              </svg>
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-white">
              BEAM
            </span>
          </div>
          <p className="text-muted text-sm">
            Peer-to-peer file transfer · No servers · No storage
          </p>
        </header>

        {/* Tab switcher */}
        <div className="panel p-1 flex mb-6">
          <button
            onClick={() => setTab("send")}
            className={`flex-1 py-3 rounded-xl font-display font-semibold text-sm transition-all duration-200 ${
              tab === "send"
                ? "bg-accent text-void shadow-lg"
                : "text-muted hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Send File
            </span>
          </button>
          <button
            onClick={() => setTab("receive")}
            className={`flex-1 py-3 rounded-xl font-display font-semibold text-sm transition-all duration-200 ${
              tab === "receive"
                ? "bg-accent text-void shadow-lg"
                : "text-muted hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Receive File
            </span>
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1">
          <div className={tab === "send" ? "block" : "hidden"}>
            <SendPage />
          </div>
          <div className={tab === "receive" ? "block" : "hidden"}>
            <ReceivePage initialCode={initialCode} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <div className="flex items-center justify-center gap-4 text-muted/40 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              End-to-end encrypted
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              WebRTC P2P
            </span>
            <span>·</span>
            <span>Zero storage</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
