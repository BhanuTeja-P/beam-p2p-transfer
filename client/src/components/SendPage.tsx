import React, { useCallback, useRef, useState, useEffect } from "react";
import { useSender } from "../hooks/useSender";
import { formatBytes, formatSpeed, formatDuration } from "../lib/webrtc";
import QRCode from "qrcode";

export default function SendPage() {
  const { status, code, file, stats, error, selectFile, createRoom, reset } = useSender();
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate QR code when code is available
  useEffect(() => {
    if (code) {
      const receiveUrl = `${window.location.origin}?code=${code}&mode=receive`;
      QRCode.toDataURL(receiveUrl, {
        width: 160,
        margin: 1,
        color: { dark: "#00D4FF", light: "#0D1117" },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [code]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files[0]) selectFile(files[0]);
    },
    [selectFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isReady = status === "idle" && file;
  const isWaiting = status === "waiting";
  const isTransferring = status === "transferring" || status === "connecting";
  const isComplete = status === "complete";
  const isError = status === "error";

  return (
    <div className="animate-fade-in space-y-6">
      {/* File Drop Zone */}
      {(status === "idle" || status === "creating") && (
        <div
          className={`drag-zone p-10 text-center cursor-pointer ${dragging ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {file ? (
            <div className="space-y-3">
              <div className="text-4xl">📄</div>
              <div className="font-display text-lg text-white">{file.name}</div>
              <div className="text-muted text-sm font-mono">{formatBytes(file.size)}</div>
              <div className="text-accent text-xs">Click to change file</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl border border-border flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8892A4" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <p className="font-display text-white text-lg">Drop file here</p>
                <p className="text-muted text-sm mt-1">or click to browse</p>
              </div>
              <p className="text-xs text-muted/60">Any file type · Any size</p>
            </div>
          )}
        </div>
      )}

      {/* File info when in active state */}
      {file && status !== "idle" && status !== "creating" && (
        <div className="panel p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{file.name}</p>
            <p className="text-muted text-sm font-mono">{formatBytes(file.size)}</p>
          </div>
        </div>
      )}

      {/* Generate Code Button */}
      {isReady && (
        <button className="btn-primary w-full text-lg" onClick={createRoom}>
          Generate Transfer Code →
        </button>
      )}

      {/* Waiting for receiver */}
      {isWaiting && (
        <div className="animate-slide-up space-y-6">
          {/* Code display */}
          <div className="panel p-6 text-center space-y-4">
            <p className="text-muted text-sm font-display tracking-widest uppercase">Transfer Code</p>
            <div className="flex justify-center gap-2">
              {code.split("").map((char, i) => (
                <div key={i} className={`code-char ${char ? "filled" : ""}`}>
                  {char}
                </div>
              ))}
            </div>
            <button
              onClick={copyCode}
              className="text-sm text-muted hover:text-accent transition-colors flex items-center gap-2 mx-auto"
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="text-success">Copied!</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy code
                </>
              )}
            </button>
          </div>

          {/* QR Code */}
          {qrDataUrl && (
            <div className="panel p-4 flex items-center gap-4">
              <img src={qrDataUrl} alt="QR Code" className="w-20 h-20 rounded-lg" />
              <div>
                <p className="text-white text-sm font-display">Scan to receive</p>
                <p className="text-muted text-xs mt-1">Share QR or code with recipient</p>
              </div>
            </div>
          )}

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="status-dot connecting" />
            <span className="text-muted text-sm">Waiting for receiver to connect…</span>
          </div>
        </div>
      )}

      {/* Connecting */}
      {status === "connecting" && (
        <div className="panel p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="status-dot connecting" />
            <span className="text-warning font-mono text-sm">Establishing peer connection…</span>
          </div>
          <p className="text-muted text-xs">Exchanging WebRTC handshake</p>
        </div>
      )}

      {/* Transfer in Progress */}
      {status === "transferring" && stats && (
        <div className="animate-slide-up panel p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="status-dot connected" />
            <span className="font-display text-white">Transferring</span>
            <span className="ml-auto font-mono text-accent text-sm">
              {stats.progress.toFixed(1)}%
            </span>
          </div>

          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${stats.progress}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-muted text-xs mb-1">Sent</p>
              <p className="font-mono text-white text-sm">{formatBytes(stats.transferred)}</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-muted text-xs mb-1">Speed</p>
              <p className="font-mono text-accent text-sm">{formatSpeed(stats.speed)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted text-xs mb-1">Elapsed</p>
              <p className="font-mono text-white text-sm">{formatDuration(stats.elapsedTime)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Complete */}
      {isComplete && stats && (
        <div className="animate-slide-up panel p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <p className="font-display text-white text-xl">Transfer Complete</p>
            <p className="text-muted text-sm mt-1">
              {formatBytes(stats.fileSize)} sent in {formatDuration(stats.elapsedTime)}
            </p>
          </div>
          <button className="btn-ghost text-sm" onClick={reset}>
            Send another file
          </button>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="animate-slide-up panel p-6 border-danger/30 space-y-4">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-danger font-mono text-sm">{error || "Connection error"}</span>
          </div>
          <button className="btn-ghost text-sm w-full" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
