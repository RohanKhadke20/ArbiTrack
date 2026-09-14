import { useState, useEffect } from 'react';
import { Lock, Unlock, Fingerprint, ShieldOff } from 'lucide-react';
import { KeyStorageService } from '../services/keyStorageService';
import { useSessionManager }    from '../hooks/useSessionManager';
import { DeviceSecurityService } from '../services/deviceSecurityService';
import type { SecurityViolation } from '../services/deviceSecurityService';
import { AuditService } from '../services/auditService';

// ── Biometric helper (native Capacitor only) ─────────────────────────────────
const attemptBiometric = async (): Promise<boolean> => {
  try {
    const pkg = '@capacitor-community/' + 'native-biometric';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { NativeBiometric } = await (import(/* @vite-ignore */ pkg) as Promise<any>);
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock ArbiTrack Offline Shop',
      title:  'Biometric Authentication',
    });
    return true;
  } catch {
    return false;
  }
};

// ── Numpad button ─────────────────────────────────────────────────────────
interface NumpadBtnProps {
  val: string;
  onClick: () => void;
  disabled: boolean;
}

const NumpadBtn = ({ val, onClick, disabled }: NumpadBtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '72px', height: '72px', borderRadius: '50%',
      background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
      color: 'white', fontSize: '1.5rem', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.15s',
      backdropFilter: 'blur(4px)',
    }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
  >
    {val}
  </button>
);

// ── Component ─────────────────────────────────────────────────────────────────
export const AppLock = ({ children }: { children: React.ReactNode }) => {
  const [isSetup,       setIsSetup]       = useState(false);
  const [isUnlocked,    setIsUnlocked]    = useState(false);
  const [isIdleLocked,  setIsIdleLocked]  = useState(false);
  const [pin,           setPin]           = useState('');
  const [error,         setError]         = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil,  setLockoutUntil]  = useState<number | null>(null);
  const [timeLeftMs,    setTimeLeftMs]    = useState<number>(0);
  const [secViolations, setSecViolations] = useState<SecurityViolation[]>([]);
  const [bootDone,      setBootDone]      = useState(false);

  // ── Session manager: idle 5 min + background 30 s ─────────────────────────
  useSessionManager(isUnlocked, () => {
    setIsIdleLocked(true);
    setIsUnlocked(false);
  });

  // ── Boot: device security check + session restore ─────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Device security
      const report = await DeviceSecurityService.runSecurityChecks();
      if (!report.passed) setSecViolations(report.violations);

      // 2. Restore persisted lockout
      const storedLockout  = localStorage.getItem('lockout_until');
      const storedAttempts = localStorage.getItem('failed_attempts');
      if (storedLockout && parseInt(storedLockout) > Date.now()) {
        const parsed = parseInt(storedLockout);
        setLockoutUntil(parsed);
        setTimeLeftMs(parsed - Date.now());
      }
      if (storedAttempts) setFailedAttempts(parseInt(storedAttempts));

      // 3. Auto-setup or auto-login with default PIN '123456' to bypass PIN UI
      const hasSetup = KeyStorageService.hasSetup();
      setIsSetup(hasSetup);

      try {
        if (!hasSetup) {
          await KeyStorageService.generateOwnerEnvironment('123456');
          DeviceSecurityService.reRegisterDevice();
          await AuditService.logAction('OWNER_SETUP_COMPLETE');
          setIsSetup(true);
        } else {
          const role = await KeyStorageService.login('123456');
          if (!role) {
            // Stale setup or mismatched PIN wraps. Wipe and recreate with default PIN.
            await KeyStorageService.wipeSession();
            localStorage.clear();
            await KeyStorageService.generateOwnerEnvironment('123456');
            DeviceSecurityService.reRegisterDevice();
          }
        }
        setIsUnlocked(true);
      } catch (err) {
        console.error("Auto login/setup failed:", err);
      }

      setBootDone(true);
    })();
  }, []);

  // ── Lockout countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = lockoutUntil - Date.now();
      if (remaining <= 0) {
        setLockoutUntil(null);
        setTimeLeftMs(0);
        setFailedAttempts(0);
        localStorage.removeItem('lockout_until');
        localStorage.setItem('failed_attempts', '0');
      } else {
        setTimeLeftMs(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleNumpadClick = (num: string) => {
    setPin(p => {
      if (p.length < 6) {
        setError('');
        return p + num;
      }
      return p;
    });
  };
  const handleBackspace = () => { setPin(p => p.slice(0, -1)); setError(''); };



  const recordFailure = () => {
    const n = failedAttempts + 1;
    setFailedAttempts(n);
    localStorage.setItem('failed_attempts', String(n));
    AuditService.logAction(`LOGIN_FAILED (attempt ${n}/5)`).catch(() => {});

    if (n >= 5) {
      // Exponential backoff: 30s, 60s, 120s … capped at 30 min
      const backoffMs = Math.min(30_000 * Math.pow(2, Math.floor(n / 5) - 1), 30 * 60_000);
      const until = Date.now() + backoffMs;
      setLockoutUntil(until);
      setTimeLeftMs(backoffMs);
      localStorage.setItem('lockout_until', String(until));
      setError(`Too many attempts. Locked for ${Math.round(backoffMs / 60_000)} min.`);
    } else {
      setError(`Incorrect PIN — ${5 - n} attempt${5 - n === 1 ? '' : 's'} remaining.`);
    }
  };

  // ── First-time setup ──────────────────────────────────────────────────────
  const handleSetup = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    try {
      await KeyStorageService.generateOwnerEnvironment(pin);
      DeviceSecurityService.reRegisterDevice();
      await AuditService.logAction('OWNER_SETUP_COMPLETE');
      setIsSetup(true);
      setIsUnlocked(true);
    } catch {
      setError('Failed to initialise security environment');
    }
  };

  // ── PIN unlock ────────────────────────────────────────────────────────────
  const handleUnlock = async () => {
    if (lockoutUntil) return;

    try {
      // Idle-locked: session keys still in IDB, just need role re-confirmation
      if (isIdleLocked) {
        const role = await KeyStorageService.login(pin);
        if (role) {
          await AuditService.logAction(`IDLE_UNLOCK (${role})`);
          setIsUnlocked(true);
          setIsIdleLocked(false);
          setPin('');
          setError('');
          setFailedAttempts(0);
          localStorage.setItem('failed_attempts', '0');
          return;
        }
      } else {
        // Hard unlock: keys cleared from IDB, must re-derive from PIN
        const role = await KeyStorageService.login(pin);
        if (role) {
          await AuditService.logAction(`LOGIN_SUCCESS (${role})`);
          setIsUnlocked(true);
          setPin('');
          setError('');
          setFailedAttempts(0);
          localStorage.setItem('failed_attempts', '0');
          return;
        }
      }
      recordFailure();
      setPin('');
    } catch {
      setError('An error occurred during unlock');
    }
  };

  // ── Biometric unlock (idle only) ──────────────────────────────────────────
  const handleBiometricUnlock = async () => {
    if (lockoutUntil) return;
    const ok = await attemptBiometric();
    if (ok && isIdleLocked) {
      await AuditService.logAction('BIOMETRIC_IDLE_UNLOCK');
      setIsUnlocked(true);
      setIsIdleLocked(false);
      setError('');
    } else if (ok && !isIdleLocked) {
      setError('Biometrics only available for idle unlock. Enter PIN to restore keys.');
    } else {
      recordFailure();
    }
  };

  // ── Keyboard Support ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutUntil) return;
      if (e.key >= '0' && e.key <= '9') {
        handleNumpadClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        // Prevent trigger if pin is too short
        if (pin.length >= 4) {
          if (!isSetup) {
            handleSetup();
          } else {
            handleUnlock();
          }
        }
      } else if (e.key.toLowerCase() === 'c' || e.key === 'Escape') {
        setPin('');
        setError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isSetup, isIdleLocked, lockoutUntil, handleSetup, handleUnlock]);

  // ── Render: pass through if unlocked ─────────────────────────────────────
  if (!bootDone) return null; // wait for async boot
  if (isUnlocked) return <>{children}</>;

  // ── Security violation banner ─────────────────────────────────────────────
  const showViolationWarning = secViolations.length > 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: 'white', fontFamily: "'Inter', sans-serif",
    }}>
      {/* ── Security violation banner ── */}
      {showViolationWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#DC2626', color: 'white', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.85rem', zIndex: 100,
        }}>
          <ShieldOff size={18} />
          <span>
            <strong>Security Alert:</strong>{' '}
            {secViolations.includes('DEVICE_MISMATCH')
              ? 'Unrecognised device — Owner re-authentication required.'
              : `Warning: ${secViolations.join(', ')}`}
          </span>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '360px', padding: '0 24px' }}>
        {/* Icon + title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {isSetup
            ? <Lock size={56} color="rgba(255,255,255,0.9)" />
            : <Unlock size={56} color="rgba(255,255,255,0.9)" />}
          <h1 style={{ marginTop: '16px', fontSize: '1.8rem', fontWeight: 700 }}>
            {lockoutUntil
              ? '🔒 Locked Out'
              : !isSetup
              ? 'Secure Your Shop'
              : isIdleLocked
              ? 'App Locked'
              : 'Enter PIN'}
          </h1>
          <p style={{ opacity: 0.7, marginTop: '8px', lineHeight: 1.4 }}>
            {lockoutUntil
              ? `Too many attempts. Wait ${Math.ceil(timeLeftMs / 60_000)} min.`
              : !isSetup
              ? 'Create a 4–6 digit Owner PIN. This encrypts all your data.'
              : isIdleLocked
              ? 'App locked after inactivity.'
              : 'Enter your Owner or Staff PIN to continue.'}
          </p>
        </div>

        {/* PIN dots display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '24px', minHeight: '24px' }}>
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <div key={i} style={{
              width: '14px', height: '14px', borderRadius: '50%',
              background: i < pin.length ? 'white' : 'rgba(255,255,255,0.25)',
              transition: 'background 0.1s',
            }} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            textAlign: 'center', color: '#FCA5A5', fontWeight: 600,
            marginBottom: '16px', fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', justifyItems: 'center', marginBottom: '24px' }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <NumpadBtn key={n} val={String(n)} onClick={() => handleNumpadClick(String(n))} disabled={!!lockoutUntil} />
          ))}
          <NumpadBtn val="C"  onClick={() => { setPin(''); setError(''); }} disabled={!!lockoutUntil} />
          <NumpadBtn val="0"  onClick={() => handleNumpadClick('0')} disabled={!!lockoutUntil} />
          <NumpadBtn val="⌫" onClick={handleBackspace} disabled={!!lockoutUntil} />
        </div>

        {/* Primary action button */}
        <button
          onClick={!isSetup ? handleSetup : handleUnlock}
          disabled={!!lockoutUntil || pin.length < 4}
          style={{
            width: '100%', padding: '16px',
            background: (lockoutUntil || pin.length < 4) ? 'rgba(255,255,255,0.15)' : 'white',
            color: 'var(--primary, #302b63)', border: 'none', borderRadius: '12px',
            fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
            marginBottom: '12px', transition: 'background 0.2s',
          }}
        >
          {!isSetup ? 'Create Owner PIN' : 'Unlock'}
        </button>

        {/* Biometric (idle-lock only) */}
        {isSetup && isIdleLocked && !lockoutUntil && (
          <button
            onClick={handleBiometricUnlock}
            style={{
              width: '100%', padding: '14px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', borderRadius: '12px', fontSize: '1rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '10px',
            }}
          >
            <Fingerprint size={22} /> Use Biometrics
          </button>
        )}
      </div>
    </div>
  );
};
