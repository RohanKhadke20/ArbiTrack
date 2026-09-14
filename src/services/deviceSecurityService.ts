/**
 * deviceSecurityService.ts
 *
 * Handles:
 *  1. Persistent device binding — the app is tied to the first device it was
 *     configured on via a device fingerprint stored in localStorage.
 *  2. Web-layer tamper heuristics — DevTools open detection, suspicious UA,
 *     running inside an iframe (e.g. extension sandbox), abnormal screen ratios.
 *  3. Native layer (Android/iOS via Capacitor) — delegates to @capacitor/device
 *     and the native runtime. Real root/jailbreak detection requires a signed APK
 *     with SafetyNet / Play Integrity — this file wires up the bridge point.
 *
 * IMPORTANT: Web-layer checks are heuristic — an attacker who controls the
 * browser can bypass them. They are a deterrent, NOT a guarantee. For real
 * protection, compile to a signed Android APK and use Play Integrity API.
 */

import { AuditService } from './auditService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SecurityViolation =
  | 'DEVICE_MISMATCH'
  | 'DEVTOOLS_OPEN'
  | 'IFRAME_EMBEDDED'
  | 'SUSPICIOUS_UA'
  | 'NATIVE_TAMPER';

export interface SecurityReport {
  passed: boolean;
  violations: SecurityViolation[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a stable fingerprint from browser/device traits. */
function buildBrowserFingerprint(): string {
  const parts = [
    navigator.language,
    navigator.platform,
    String(screen.colorDepth),
    String(screen.width),
    String(screen.height),
    // Timezone offset in minutes
    String(new Date().getTimezoneOffset()),
    // Rough CPU core count
    String(navigator.hardwareConcurrency ?? 'n'),
    // Memory bucket (rough) — deviceMemory is not in all TS DOM libs
    String((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 'n'),
  ];
  return parts.join('|');
}

/** Persist the fingerprint on first run. */
function ensureDeviceRegistered(): string {
  const stored = localStorage.getItem('device_fingerprint');
  if (stored) return stored;

  const fp = buildBrowserFingerprint();
  localStorage.setItem('device_fingerprint', fp);
  return fp;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function checkDeviceBinding(): boolean {
  const stored = localStorage.getItem('device_fingerprint');
  if (!stored) return true; // first run — will be registered now
  return stored === buildBrowserFingerprint();
}

/**
 * DevTools detection — measures the gap between window outer/inner dimensions,
 * which DevTools artificially widens when docked to the side.
 */
function checkDevToolsOpen(): boolean {
  const threshold = 160;
  const widthDiff  = window.outerWidth  - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;
  return widthDiff > threshold || heightDiff > threshold;
}

/** Detect if we're running inside an iframe (extension sandbox, clickjacking). */
function checkIframeEmbedding(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin iframe — always suspicious
  }
}

/**
 * Detect obviously automated / emulator user-agents.
 * (Very rough heuristic — headless Chrome in CI will also match.)
 */
function checkSuspiciousUA(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('headless') ||
    ua.includes('phantom')  ||
    ua.includes('selenium') ||
    ua.includes('puppeteer')
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const DeviceSecurityService = {

  /**
   * Call once at app boot (before unlock screen renders).
   * Returns a report; the caller decides how to react to violations.
   */
  async runSecurityChecks(): Promise<SecurityReport> {
    // Ensure the device is registered on very first run.
    ensureDeviceRegistered();

    const violations: SecurityViolation[] = [];

    if (!checkDeviceBinding())  violations.push('DEVICE_MISMATCH');
    if (checkIframeEmbedding()) violations.push('IFRAME_EMBEDDED');
    if (checkSuspiciousUA())    violations.push('SUSPICIOUS_UA');
    // DevTools check is intentionally skipped at boot to avoid false positives
    // during development; call `checkDevToolsAtRuntime()` after unlock instead.

    if (violations.length > 0) {
      try {
        await AuditService.logAction(`SECURITY_VIOLATION: ${violations.join(', ')}`);
      } catch {
        // Audit logging must never crash the security check itself.
      }
    }

    return { passed: violations.length === 0, violations };
  },

  /**
   * Call this after the user is authenticated to begin continuous monitoring.
   * Returns a cleanup function — call it on unmount / app lock.
   */
  startRuntimeMonitoring(onViolation: (violation: SecurityViolation) => void): () => void {
    let alive = true;

    const poll = () => {
      if (!alive) return;
      if (checkDevToolsOpen()) {
        AuditService.logAction('RUNTIME_VIOLATION: DEVTOOLS_OPEN').catch(() => {});
        onViolation('DEVTOOLS_OPEN');
      }
      setTimeout(poll, 3000); // check every 3 seconds
    };

    poll();

    return () => { alive = false; };
  },

  /**
   * Register (or refresh) this device's fingerprint.
   * Useful when the Owner deliberately moves the app to a new device.
   */
  reRegisterDevice(): void {
    const fp = buildBrowserFingerprint();
    localStorage.setItem('device_fingerprint', fp);
    AuditService.logAction('DEVICE_REREGISTERED').catch(() => {});
  },

  /**
   * Native bridge point for Capacitor.
   * On a real Android build, wire this to @capacitor-community/safe-area
   * or your own root-detection plugin. Returns false (safe) on web.
   */
  async checkNativeTamper(): Promise<boolean> {
    try {
      // Build the specifier at runtime — prevents Vite from resolving it
      // statically during dev-mode import analysis. Falls back to false on web.
      const pkg = '@capacitor-community/' + 'safety-net';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { SafetyNet } = await (import(/* @vite-ignore */ pkg) as Promise<any>);
      const result = await SafetyNet.attest({ nonce: crypto.randomUUID() });
      return !result.isBasicIntegrity; // true = tampered
    } catch {
      return false; // plugin not available on web — assume safe
    }
  },
};
