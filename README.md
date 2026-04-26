# ⚡ BEAM — P2P File Transfer

Browser-based peer-to-peer file transfer using WebRTC Data Channels. No file storage on the server — files go directly between browsers.

## How It Works

```
Device 1 (Sender)          Signaling Server         Device 2 (Receiver)
      │                         │                          │
      │── create-room ─────────>│                          │
      │<─ code: "AB12CD" ───────│                          │
      │                         │<─── join-room "AB12CD" ──│
      │<─ receiver-joined ──────│                          │
      │── offer ───────────────>│──────────────────────────>│
      │<────────────────────────│<──────── answer ──────────│
      │<══════════════ WebRTC Data Channel ═════════════════>│
      │   (direct P2P — server no longer involved)          │
      │── file chunks ─────────────────────────────────────>│
```

## Project Structure

```
beam-p2p-transfer/
├── package.json              # Root scripts
├── README.md
│
├── server/
│   ├── package.json
│   └── index.js              # Express + Socket.io signaling server
│
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx            # Tab navigation + URL param handling
        ├── index.css          # Global styles + Tailwind
        ├── lib/
        │   └── webrtc.ts      # Constants, types, helpers
        ├── hooks/
        │   ├── useSender.ts   # WebRTC sender logic
        │   └── useReceiver.ts # WebRTC receiver logic
        └── components/
            ├── SendPage.tsx   # Drag & drop, code display, progress
            └── ReceivePage.tsx # Code input, download
```

## Setup & Running

### 1. Install dependencies

```bash
# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### 2. Start the signaling server

```bash
cd server
npm run dev       # with nodemon (auto-reload)
# OR
npm start         # plain node
```

Server runs on **http://localhost:3001**

### 3. Start the frontend

```bash
cd client
npm run dev
```

Frontend runs on **http://localhost:5173**

### 4. Test locally (two browser windows)

1. Open **http://localhost:5173** in Window 1 → click **Send File**
2. Drag & drop (or click to select) any file
3. Click **Generate Transfer Code** → note the 6-character code
4. Open **http://localhost:5173** in Window 2 → click **Receive File**
5. Type the code → click **Connect & Receive**
6. Watch the file transfer in real-time
7. Click **Download** when complete

### Testing on two real devices (same network)

1. Find your local IP: `ifconfig` / `ipconfig` — e.g. `192.168.1.50`
2. In `client/src/lib/webrtc.ts`, change:
   ```ts
   export const SERVER_URL = "http://192.168.1.50:3001";
   ```
3. Access frontend from Device 2 at `http://192.168.1.50:5173`

> For cross-network transfers, deploy the server and update `SERVER_URL` to the hosted URL.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Signaling | Node.js + Express + Socket.io |
| Transfer | WebRTC `RTCDataChannel` |
| QR Codes | `qrcode` npm package |

## Key Design Decisions

### Why Socket.io only for signaling?
WebRTC requires a "handshake" (offer/answer + ICE candidates) to establish a peer connection, but after that the data flows directly between browsers. The server is only used for this initial handshake — no file data ever touches it.

### Chunking (16 KB)
Files are split into 16 KB chunks via `File.slice()` → `ArrayBuffer`. This prevents memory issues with large files and allows accurate progress tracking. Back-pressure is handled by checking `channel.bufferedAmount`.

### Metadata packet
The first message sent over the data channel is a JSON string with `{type:"meta", name, size, fileType}`. All subsequent messages are binary `ArrayBuffer` chunks. The receiver uses the metadata to know when transfer is complete.

### No authentication
This is intentional — BEAM is designed for quick, ad-hoc transfers. The 6-character code provides enough entropy for ephemeral pairing (36^6 ≈ 2.2 billion combinations).

## Browser Support

WebRTC Data Channels are supported in all modern browsers:
- Chrome 28+, Firefox 22+, Safari 15.4+, Edge 79+

## Limitations

- Codes are ephemeral — expire when either peer disconnects
- One transfer per room (room deleted after disconnect)
- Very large files (>2GB) may hit browser `Blob` memory limits
- Cross-network transfers require TURN servers for strict NAT environments

## Deploying

### Server (e.g. Railway / Render / Fly.io)
```bash
cd server
# Set PORT env variable if needed
node index.js
```

### Client (e.g. Vercel / Netlify)
```bash
cd client
# Update SERVER_URL in src/lib/webrtc.ts to your deployed server URL
npm run build
# Deploy the dist/ folder
```
