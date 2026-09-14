# 📱 ArbiTrack (ShopApp) — Offline-First PWA & Mobile Retail Engine

> A high-performance, offline-first Point of Sale (POS) and inventory orchestration engine featuring peer-to-peer data synchronization (WebRTC / PeerJS), IndexedDB persistence via Dexie.js, role-based access control, and cross-platform native deployment with Capacitor.

---

## 🌟 Overview

**ArbiTrack** is built for mission-critical retail environments where network connectivity is intermittent or unavailable. Unlike traditional cloud-dependent POS systems, ArbiTrack operates **100% client-side** using browser-native IndexedDB for data persistence, while facilitating mesh data synchronization across local devices via WebRTC/PeerJS without requiring a centralized server.

The application includes dual operating modes:
1. **Customer Front-End**: Product browsing, responsive shopping cart, and offline checkout simulator.
2. **Retailer Admin Suite**: Inventory tracking, product catalogs, order processing, localized backup & restoration, and peer-to-peer device sync.

---

## 🚀 Key Architectural Features

- **📶 100% Offline-First Architecture**:
  - Engineered with Progressive Web App (PWA) service workers via `vite-plugin-pwa` and Workbox caching.
  - Client-side database powered by **Dexie.js** (IndexedDB) for ACID transactional order and catalog management.
- **🔗 Decentralized P2P Mesh Sync (PeerJS & WebRTC)**:
  - Synchronizes inventory and orders between store devices in real-time without external cloud infrastructure.
- **🛡️ Enterprise Security & Role-Based Access Control (RBAC)**:
  - Multi-tier role permissions: `OWNER`, `STAFF`, and `CUSTOMER`.
  - Sensitive operations protected with `withReAuth()` verification modals.
  - Pin-based `AppLock` screen shield protecting admin panels during inactivity.
  - Security banner inspecting device integrity and environment trust.
- **📲 Cross-Platform Mobile Ready (Capacitor)**:
  - Configured with `@capacitor/core` and `@capacitor/cli` for zero-overhead compilation to Android and iOS APKs.
- **🌐 Global State & Internationalization**:
  - Global reactive stores orchestrated via **Zustand**.
  - Multi-language interface support powered by **i18next** and `react-i18next`.
- **💾 Encrypted Backup & Restore**:
  - Complete JSON-based database export, schema migration, and snapshot recovery tools.

---

## 📁 Repository Structure

```text
ArbiTrack/
├── capacitor.config.ts    # Capacitor mobile native configuration
├── vite.config.ts         # Vite build configuration with PWA & Terser optimization
├── package.json           # Dependencies & build scripts
├── public/                # Static PWA assets & manifests
├── src/
│   ├── components/        # AppLock, SecurityBanner, Guards & Modal primitives
│   ├── db/                # Dexie.js IndexedDB schema, models & typed queries
│   ├── hooks/             # Reactive hooks for cart, inventory & security
│   ├── locales/           # Multilingual i18n translation bundles
│   ├── pages/
│   │   ├── customer/      # Shop, Cart & Checkout customer views
│   │   └── retailer/      # Products, Orders, P2P Sync, Settings & Backups
│   ├── services/          # Crypto & secure storage services
│   ├── store/             # Zustand state stores (Cart, Auth, Settings)
│   └── utils/             # P2P mesh networking & cryptographic helpers
└── README.md              # Project documentation
```

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript (Strict Type Checking) |
| **Build & Bundler** | Vite 8 + Rolldown / Terser Optimization |
| **Client Database** | Dexie.js (IndexedDB wrapper) |
| **P2P Networking** | PeerJS (WebRTC DataChannels) |
| **State Management** | Zustand |
| **Mobile Runtime** | Capacitor 8 |
| **Internationalization**| i18next + react-i18next |
| **Styling & UI Icons** | Custom Responsive CSS + Lucide React |

---

## 🏃 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```

### 3. Production Build & PWA Generation
```bash
npm run build
```

### 4. Running Capacitor Mobile Sync & Native Build
```bash
# Add Android platform target (first time)
npx cap add android

# Sync production bundle into Android project
npx cap sync android

# Open Android Studio to build signed APK
npx cap open android
```

---

## 🧪 Real-World Testing & Verification Workflows

### 1. P2P Mesh Sync Verification (Multi-Device / Tab)
1. Open two separate browser tabs or devices:
   - **Terminal A (Retailer Device)**: Navigate to `/#/admin/sync` to obtain your unique Peer ID.
   - **Terminal B (Counter Device)**: Enter Terminal A's Peer ID in the connect box and click **Connect**.
2. Once the WebRTC data channel transitions to `CONNECTED`, modify an inventory item or create an order on Terminal A.
3. Observe real-time state synchronization reflected in Terminal B's local Dexie database without any intermediate server!

### 2. Encrypted Backup & Disaster Recovery
- Navigate to **Admin > Backup & Restore**.
- Click **Export Database Snapshot** to download an encrypted JSON replica of all products, inventory balances, and historical orders.
- To simulate disaster recovery, wipe browser IndexedDB data and upload the snapshot file to restore full operational capability.

---

## 📜 License

MIT License &copy; 2026 Rohan Khadke.

