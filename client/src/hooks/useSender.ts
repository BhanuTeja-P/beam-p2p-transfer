import { useState, useRef, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import {
  CHUNK_SIZE,
  ICE_SERVERS,
  SERVER_URL,
  ConnectionStatus,
  TransferStats,
} from "../lib/webrtc";

export function useSender() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [code, setCode] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [error, setError] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const fileRef = useRef<File | null>(null);

  const cleanup = useCallback(() => {
    channelRef.current?.close();
    pcRef.current?.close();
    socketRef.current?.disconnect();
    channelRef.current = null;
    pcRef.current = null;
    socketRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const selectFile = useCallback((f: File) => {
    setFile(f);
    fileRef.current = f;
    setStatus("idle");
    setError("");
    setStats(null);
  }, []);

  const sendFileOverChannel = useCallback(
    (channel: RTCDataChannel, socket: Socket, roomCode: string) => {
      const f = fileRef.current;
      if (!f) return;

      const startTime = Date.now();
      let offset = 0;
      let lastBytes = 0;
      let lastTime = startTime;

      setStats({
        fileName: f.name,
        fileSize: f.size,
        fileType: f.type || "application/octet-stream",
        transferred: 0,
        speed: 0,
        progress: 0,
        startTime,
        elapsedTime: 0,
      });

      channel.send(
        JSON.stringify({
          type: "meta",
          name: f.name,
          size: f.size,
          fileType: f.type || "application/octet-stream",
        })
      );

      function sendChunk() {
        const currentFile = fileRef.current;
        if (!currentFile || channel.readyState !== "open") return;

        if (channel.bufferedAmount > 1024 * 1024) {
          setTimeout(sendChunk, 50);
          return;
        }

        const slice = currentFile.slice(offset, offset + CHUNK_SIZE);
        slice.arrayBuffer().then((buffer) => {
          channel.send(buffer);
          offset += buffer.byteLength;

          const now = Date.now();
          const timeDelta = (now - lastTime) / 1000;

          if (timeDelta >= 0.4) {
            const speed = (offset - lastBytes) / timeDelta;
            lastBytes = offset;
            lastTime = now;

            setStats({
              fileName: currentFile.name,
              fileSize: currentFile.size,
              fileType: currentFile.type,
              transferred: offset,
              speed,
              progress: Math.min(100, (offset / currentFile.size) * 100),
              startTime,
              elapsedTime: now - startTime,
            });
          }

          if (offset < currentFile.size) {
            setTimeout(sendChunk, 0);
          } else {
            const end = Date.now();
            setStats({
              fileName: currentFile.name,
              fileSize: currentFile.size,
              fileType: currentFile.type,
              transferred: currentFile.size,
              speed: 0,
              progress: 100,
              startTime,
              elapsedTime: end - startTime,
            });
            socket.emit("transfer-complete", { code: roomCode });
            setStatus("complete");
          }
        });
      }

      sendChunk();
    },
    []
  );

  const createRoom = useCallback(async () => {
    if (!fileRef.current) return;
    setError("");
    setStatus("creating");

    const socket = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    let roomCode = "";

    socket.on("connect_error", () => {
      setError("Cannot connect to signaling server. Is it running on port 3001?");
      setStatus("error");
    });

    socket.on("connect", () => {
      socket.emit("create-room", (res: { code?: string; error?: string }) => {
        if (res.error) {
          setError(res.error);
          setStatus("error");
          return;
        }
        roomCode = res.code!;
        setCode(roomCode);
        setStatus("waiting");
      });
    });

    socket.on("receiver-joined", async () => {
      setStatus("connecting");

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      const channel = pc.createDataChannel("fileTransfer", { ordered: true });
      channelRef.current = channel;
      channel.binaryType = "arraybuffer";

      channel.onopen = async () => {
        // Check if connection is using TURN server
        let isTurn = false;
        try {
          if (pcRef.current) {
            const stats = await pcRef.current.getStats();
            let activePairId: string | null = null;
            
            stats.forEach((stat) => {
              if (
                stat.type === "candidate-pair" &&
                stat.state === "succeeded" &&
                stat.nominated
              ) {
                activePairId = stat.localCandidateId;
              }
            });

            if (activePairId) {
              const localCandidate = stats.get(activePairId);
              if (localCandidate && localCandidate.candidateType === "relay") {
                isTurn = true;
              }
            }
          }
        } catch (e) {
          console.error("Failed to get WebRTC stats", e);
        }

        const currentFile = fileRef.current;
        if (isTurn && currentFile && currentFile.size > 50 * 1024 * 1024) {
          setError("File too large. Max size for relayed connections is 50MB.");
          setStatus("error");
          socket.emit("peer-disconnected"); // Notify receiver
          cleanup();
          return;
        }

        setStatus("transferring");
        sendFileOverChannel(channel, socket, roomCode);
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit("ice-candidate", { code: roomCode, candidate });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { code: roomCode, offer });
    });

    socket.on(
      "answer",
      async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        try {
          if (pcRef.current && pcRef.current.signalingState !== "stable") {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
          }
        } catch (_) {}
      }
    );

    socket.on(
      "ice-candidate",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
    );

    socket.on("peer-disconnected", () => {
      setError("Receiver disconnected unexpectedly.");
      setStatus("error");
    });
  }, [sendFileOverChannel, cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setCode("");
    setFile(null);
    fileRef.current = null;
    setStats(null);
    setError("");
  }, [cleanup]);

  return {
    status,
    code,
    file,
    stats,
    error,
    selectFile,
    createRoom,
    reset,
  };
}
