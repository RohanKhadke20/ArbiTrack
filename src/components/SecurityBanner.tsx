/**
 * SecurityBanner.tsx
 * 
 * Displays a sticky banner when device security checks fail.
 * Runs once on mount — lightweight, no heavy libraries required.
 */
import { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { DeviceSecurityService } from '../services/deviceSecurityService';
import type { SecurityViolation } from '../services/deviceSecurityService';

const VIOLATION_MESSAGES: Record<SecurityViolation, string> = {
  DEVICE_MISMATCH: 'Unrecognised device detected. Owner re-authentication may be required.',
  DEVTOOLS_OPEN:   'Developer tools are open. Sensitive features are restricted.',
  IFRAME_EMBEDDED: 'App is running inside an embedded frame — possible clickjacking risk.',
  SUSPICIOUS_UA:   'Automated browser detected. Access may be restricted.',
  NATIVE_TAMPER:   'Device integrity check failed. Root/jailbreak may be present.',
};

export const SecurityBanner = () => {
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [dismissed, setDismissed]   = useState(false);

  useEffect(() => {
    DeviceSecurityService.runSecurityChecks().then(report => {
      if (!report.passed) setViolations(report.violations);
    });

    // Also start runtime DevTools polling
    const stop = DeviceSecurityService.startRuntimeMonitoring(v => {
      setViolations(prev => prev.includes(v) ? prev : [...prev, v]);
      setDismissed(false); // re-show if a new violation appears after dismissal
    });

    return stop;
  }, []);

  if (dismissed || violations.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
      background: '#7F1D1D', color: 'white',
      padding: '10px 16px',
      display: 'flex', alignItems: 'flex-start', gap: '10px',
    }}>
      <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, fontSize: '0.85rem' }}>
        <strong>Security Warning</strong>
        <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
          {violations.map(v => <li key={v}>{VIOLATION_MESSAGES[v]}</li>)}
        </ul>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', flexShrink: 0 }}
      >
        <X size={18} />
      </button>
    </div>
  );
};
