# Contributing to ArbiTrack

We welcome contributions to ArbiTrack! Whether you are optimizing offline synchronization, enhancing PWA performance, or refining the mobile Capacitor experience, here is how to get started.

---

## 🛠️ Development Setup

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/<your-username>/ArbiTrack.git
   cd ArbiTrack
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Verify TypeScript & Production Build**:
   ```bash
   npm run build
   ```

---

## 🧪 Testing P2P Mesh & Offline Capabilities

- Use two browser profiles or devices to verify WebRTC DataChannel discovery via PeerJS.
- Validate that transactions persist across browser restarts in IndexedDB via Dexie.js.

---

## 📝 Commit Conventions

Use semantic prefixes:
- `feat:` for user-facing features
- `fix:` for bug fixes
- `docs:` for documentation
- `refactor:` for internal restructuring
- `perf:` for offline/PWA caching performance
