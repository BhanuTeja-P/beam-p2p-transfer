const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// In-memory room registry: code -> { sender, receiver }
const rooms = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", rooms: rooms.size });
});

io.on("connection", (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // ─── Sender creates a room ───────────────────────────────────────────────
  socket.on("create-room", (callback) => {
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (rooms.has(code) && attempts < 20);

    if (rooms.has(code)) {
      return callback({ error: "Could not generate unique code. Try again." });
    }

    rooms.set(code, { sender: socket.id, receiver: null });
    socket.join(code);
    socket.data.code = code;
    socket.data.role = "sender";

    console.log(`[Room] Created: ${code} by ${socket.id}`);
    callback({ code });
  });

  // ─── Receiver joins a room ───────────────────────────────────────────────
  socket.on("join-room", (code, callback) => {
    const upperCode = code.toUpperCase().trim();
    const room = rooms.get(upperCode);

    if (!room) {
      return callback({ error: "Room not found. Check the code and try again." });
    }
    if (room.receiver) {
      return callback({ error: "Room is already occupied." });
    }

    room.receiver = socket.id;
    socket.join(upperCode);
    socket.data.code = upperCode;
    socket.data.role = "receiver";

    console.log(`[Room] ${upperCode}: receiver joined ${socket.id}`);

    // Notify sender that receiver is ready
    io.to(room.sender).emit("receiver-joined", { receiverId: socket.id });
    callback({ ok: true });
  });

  // ─── WebRTC signaling relay ──────────────────────────────────────────────
  socket.on("offer", ({ code, offer }) => {
    const room = rooms.get(code);
    if (!room || !room.receiver) return;
    io.to(room.receiver).emit("offer", { offer, senderId: socket.id });
  });

  socket.on("answer", ({ code, answer }) => {
    const room = rooms.get(code);
    if (!room || !room.sender) return;
    io.to(room.sender).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ code, candidate }) => {
    const room = rooms.get(code);
    if (!room) return;
    // Relay to the other peer
    const target =
      socket.id === room.sender ? room.receiver : room.sender;
    if (target) {
      io.to(target).emit("ice-candidate", { candidate });
    }
  });

  // ─── Transfer complete ───────────────────────────────────────────────────
  socket.on("transfer-complete", ({ code }) => {
    console.log(`[Room] ${code}: transfer complete`);
    io.to(code).emit("transfer-complete");
  });

  // ─── Disconnect cleanup ──────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    console.log(`[-] Socket disconnected: ${socket.id} (room: ${code})`);

    // Notify peer
    io.to(code).emit("peer-disconnected");

    // Clean up room
    rooms.delete(code);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Signaling server running on http://localhost:${PORT}\n`);
});
