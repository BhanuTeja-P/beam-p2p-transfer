import React, { useState, useEffect, useRef } from "react";
import { useReceiver } from "../hooks/useReceiver";
import { formatBytes, formatSpeed, formatDuration } from "../lib/webrtc";

interface ReceivePageProps {
  initialCode?: string;
}

export default function ReceivePage({ initialCode }: ReceivePageProps) {
  const { status, stats, error, receivedFile, joinRoom, reset } = useReceiver();
  const [inputCode, setInputCode] = useState(initialCode || "");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [chars, setChars] = useState<string[]>(
    initialCode ? initialCode.split("").slice(0, 6) : Array(6).fill("")
  );

  // Auto-join if code provided via URL
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      joinRoom(initialCode);
    }
  }, []);

  const fullCode = chars.join("");

  const handleCharInput = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!upper) return;

    const newChars = [...chars];
    newChars[index] = upper[upper.length - 1];
    setChars(newChars);

    if (index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      const newChars = [...chars];
      if (chars[index]) {
        newChars[index] = "";
        setChars(newChars);
      } else if (index > 0) {
        newChars[index - 1] = "";
        setChars(newChars);
        inputs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (pasted.length >= 6) {
      const newChars = pasted.slice(0, 6).split("");
      setChars(newChars);
      inputs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleJoin = () => {
    if (fullCode.length === 6) {
      joinRoom(fullCode);
    }
  };

  const isIdle = status === "idle";
  const isConnecting = status === "connecting" || status === "waiting";
  const isTransferring = status === "transferring";
  const isComplete = status === "complete";
  const isError = status === "error";

  return (
    <div className="animate-fade-in space-y-6">
      {/* Code input */}
      {(isIdle || isError) && (
        <div className="animate-slide-up space-y-6">
          <div className="panel p-6 space-y-5">
            <div className="text-center">
              <p className="text-muted text-sm font-display tracking-widest uppercase mb-4">
                Enter Transfer Code
              </p>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {chars.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputs.current[i] = el)}
                    type="text"
                    maxLength={1}
                    value={char}
                    onChange={(e) => handleCharInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`code-char ${char ? "filled" : ""} outline-none cursor-text bg-transparent text-center`}
                    style={{ caretColor: "#00D4FF" }}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>

            <button
              className="btn-primary w-full text-lg"
              onClick={handleJoin}
              disabled={fullCode.length !== 6}
            >
              Connect & Receive →
            </button>
          </div>

          {isError && (
            <div className="panel p-4 border-danger/30">
              <div className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-danger text-sm font-mono">{error}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connecting state */}
      {isConnecting && (
        <div className="animate-slide-up panel p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto relative">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
            <div className="absolute inset-2 rounded-full border border-accent/10" />
          </div>
          <div>
            <p className="font-display text-white text-lg">
              {status === "waiting" ? "Waiting for sender…" : "Connecting to peer…"}
            </p>
            <p className="text-muted text-sm mt-1">
              {status === "waiting"
                ? "Joined room. Sender will initiate the transfer."
                : "Establishing secure WebRTC connection"}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="status-dot connecting" />
            <span className="font-mono text-xs text-muted">
              CODE: {fullCode}
            </span>
          </div>
        </div>
      )}

      {/* Transferring */}
      {isTransferring && stats && (
        <div className="animate-slide-up panel p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="status-dot connected" />
            <div className="flex-1">
              <p className="font-display text-white">{stats.fileName}</p>
              <p className="text-muted text-xs font-mono">{formatBytes(stats.fileSize)}</p>
            </div>
            <span className="font-mono text-accent font-semibold">
              {stats.progress.toFixed(1)}%
            </span>
          </div>

          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${stats.progress}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-muted text-xs mb-1">Received</p>
              <p className="font-mono text-white text-sm">{formatBytes(stats.transferred)}</p>
            </div>
            <div className="border-x border-border">
              <p className="text-muted text-xs mb-1">Speed</p>
              <p className="font-mono text-accent text-sm">{formatSpeed(stats.speed)}</p>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Elapsed</p>
              <p className="font-mono text-white text-sm">{formatDuration(stats.elapsedTime)}</p>
            </div>
          </div>

          <p className="text-center text-muted text-xs">
            Receiving directly from sender — no server involved
          </p>
        </div>
      )}

      {/* Complete & Download */}
      {isComplete && receivedFile && (
        <div className="animate-slide-up space-y-4">
          <div className="panel p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p className="font-display text-white text-xl">File Received!</p>
              <p className="text-muted text-sm mt-1">
                {receivedFile.name} · {formatBytes(receivedFile.size)}
              </p>
            </div>
          </div>

          <a
            href={receivedFile.url}
            download={receivedFile.name}
            className="btn-primary w-full text-lg flex items-center justify-center gap-3 no-underline"
            style={{ display: "flex" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {receivedFile.name}
          </a>

          <button className="btn-ghost w-full text-sm" onClick={reset}>
            Receive another file
          </button>
        </div>
      )}
    </div>
  );
}
