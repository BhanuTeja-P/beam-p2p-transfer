import { useState, useRef, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import {
  ICE_SERVERS,
  SERVER_URL,
  ConnectionStatus,
  TransferStats,
} from "../lib/webrtc";

interface ReceivedFile {
  name: string;
  size: number;
  fileType: string;
  blob: Blob;
  url: string;
}

export function useReceiver() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [error, setError] = useState<string>("");
  const [receivedFile, setReceivedFile] = useState<ReceivedFile | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    socketRef.current?.disconnect();
    pcRef.current = null;
    socketRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const joinRoom = useCallback(async (code: string) => {
    setError("");
    setStatus("connecting");

    const socket = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    const upperCode = code.toUpperCase().trim();

    socket.on("connect_error", () => {
      setError("Cannot connect to signaling server. Is it running on port 3001?");
      setStatus("error");
    });

    socket.on("connect", () => {
      socket.emit("join-room", upperCode, (res: { ok?: boolean; error?: string }) => {
        if (res.error) {
          setError(res.error);
          setStatus("error");
          return;
        }
        setStatus("waiting");
      });
    });

    socket.on("offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      setStatus("connecting");

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Accumulate received chunks
      const chunks: ArrayBuffer[] = [];
      let meta: { name: string; size: number; fileType: string } | null = null;
      let received = 0;
      let startTime = 0;
      let lastBytes = 0;
      let lastTime = 0;

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
          setStatus("transferring");
          startTime = Date.now();
          lastTime = startTime;
        };

        channel.onmessage = (e) => {
          const data = e.data;

          // First message is JSON metadata
          if (typeof data === "string") {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "meta") {
                meta = { name: parsed.name, size: parsed.size, fileType: parsed.fileType };
                setStats({
                  fileName: parsed.name,
                  fileSize: parsed.size,
                  fileType: parsed.fileType,
                  transferred: 0,
                  speed: 0,
                  progress: 0,
                  startTime: Date.now(),
                  elapsedTime: 0,
                });
              }
            } catch (_) {}
            return;
          }

          // Binary chunk
          if (data instanceof ArrayBuffer) {
            chunks.push(data);
            received += data.byteLength;

            if (meta) {
              const now = Date.now();
              const timeDelta = (now - lastTime) / 1000;
              const bytesDelta = received - lastBytes;

              let speed = 0;
              if (timeDelta >= 0.3) {
                speed = bytesDelta / timeDelta;
                lastBytes = received;
                lastTime = now;
              }

              const progress = Math.min(100, (received / meta.size) * 100);

              setStats({
                fileName: meta.name,
                fileSize: meta.size,
                fileType: meta.fileType,
                transferred: received,
                speed,
                progress,
                startTime,
                elapsedTime: now - startTime,
              });

              // Check completion
              if (received >= meta.size) {
                finalizeFile(chunks, meta);
              }
            }
          }
        };

        channel.onclose = () => {
          // Might have completed already
        };
      };

      function finalizeFile(
        chunks: ArrayBuffer[],
        meta: { name: string; size: number; fileType: string }
      ) {
        const blob = new Blob(chunks, { type: meta.fileType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        setReceivedFile({ name: meta.name, size: meta.size, fileType: meta.fileType, blob, url });
        setStatus("complete");
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("ice-candidate", { code: upperCode, candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setError("Connection lost during transfer.");
          setStatus("error");
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { code: upperCode, answer });
    });

    socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (_) {}
    });

    socket.on("transfer-complete", () => {
      // Server confirmed, ensure state is complete
      setStatus("complete");
    });

    socket.on("peer-disconnected", () => {
      if (status !== "complete") {
        setError("Sender disconnected unexpectedly.");
        setStatus("error");
      }
    });
  }, []);

  const reset = useCallback(() => {
    if (receivedFile?.url) {
      URL.revokeObjectURL(receivedFile.url);
    }
    cleanup();
    setStatus("idle");
    setStats(null);
    setError("");
    setReceivedFile(null);
  }, [cleanup, receivedFile]);

  return {
    status,
    stats,
    error,
    receivedFile,
    joinRoom,
    reset,
  };
}
