import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { KeyStorageService } from '../services/keyStorageService';
import { Lock } from 'lucide-react';


// RBAC Middleware Guard
export const RequireRole = ({ allowedRoles, children }: { allowedRoles: ('OWNER'|'STAFF')[], children: React.ReactNode }) => {
  const role = useAppStore(state => state.role);
  
  if (!role) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '48px', color: 'var(--danger)' }}>
        <Lock size={64} style={{ margin: '0 auto 24px' }} />
        <h2 style={{ fontSize: '2rem' }}>Access Denied</h2>
        <p className="text-muted" style={{ fontSize: '1.2rem', marginTop: '16px' }}>
          Your current role ({role}) does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

// The ReAuth Modal component that sits at the root of the app
export const ReAuthModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [callbacks, setCallbacks] = useState<{onSuccess?: () => void, onCancel?: () => void}>({});

  React.useEffect(() => {
    const handleRequest = (e: Event) => {
      const custom = e as CustomEvent<{ onSuccess?: () => void; onCancel?: () => void }>;
      setCallbacks(custom.detail);
      setIsOpen(true);
    };
    window.addEventListener('REQUEST_REAUTH', handleRequest);
    return () => window.removeEventListener('REQUEST_REAUTH', handleRequest);
  }, []);

  const handleSubmit = async () => {
    const isValid = await KeyStorageService.verifyPinSilent(pin);
    if (isValid) {
      setIsOpen(false);
      setPin('');
      setError('');
      callbacks.onSuccess?.();
    } else {
      setError('Incorrect Master/Staff PIN');
      setPin('');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setPin('');
    setError('');
    callbacks.onCancel?.();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '90%', maxWidth: '360px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '16px' }}><Lock size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/> Security Check</h3>
        <p className="text-muted text-center mb-4">Please verify your PIN to perform this sensitive action.</p>
        <input 
          type="password" 
          className="input-field mb-4" 
          style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem' }} 
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          maxLength={6}
          autoFocus
        />
        {error && <div style={{ color: 'var(--danger)', textAlign: 'center', marginBottom: '16px' }}>{error}</div>}
        <div className="flex-row space-between gap-2">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>Verify</button>
        </div>
      </div>
    </div>
  );
};
