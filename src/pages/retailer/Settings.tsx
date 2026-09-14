import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { initP2P, connectToPeer, destroyP2P, triggerSync } from '../../utils/p2p';
import { getConfig, setConfig } from '../../db/queries';
import { Wifi, WifiOff, RefreshCw, Save } from 'lucide-react';

export const Settings = () => {
  const { isP2PConnected, peerId } = useAppStore();
  const [shopId, setShopId] = useState('');
  const [targetId, setTargetId] = useState('');
  
  const [upiId, setUpiId] = useState('');
  const [shopName, setShopName] = useState('');

  // Auto-connect if there's internet
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const loadConfig = async () => {
      const savedUpi = await getConfig('upiId') as string | null;
      const savedName = await getConfig('shopName') as string | null;
      if (savedUpi) setUpiId(savedUpi);
      if (savedName) setShopName(savedName);
    };
    loadConfig();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSaveConfig = async () => {
    await setConfig('upiId', upiId);
    await setConfig('shopName', shopName);
    alert('Secure settings saved successfully!');
  };

  const handleStartHost = () => {
    if (!shopId) return alert('Enter a Shop ID first (e.g. shri-kirana-1)');
    initP2P(shopId);
  };

  const handleConnect = () => {
    if (!targetId) return alert('Enter the target Shop ID to connect to.');
    if (!peerId) {
      // Initialize as a random node if not already a host
      initP2P('node-' + Math.random().toString(36).substring(7));
      setTimeout(() => connectToPeer(targetId), 2000); // give it time to open
    } else {
      connectToPeer(targetId);
    }
  };

  const handleManualSync = () => {
    triggerSync();
    alert('Sync triggered!');
  };

  return (
    <div className="page-container">
      <div className="flex-row space-between mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>सेटिंग्स / Settings</h2>
        {isOnline ? <Wifi color="var(--secondary)" /> : <WifiOff color="var(--danger)" />}
      </div>

      <div className="card mb-4" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>P2P Sync Status</div>
        {isP2PConnected ? (
          <div style={{ color: 'var(--secondary)', fontWeight: 700, fontSize: '1.4rem' }}>Connected / जुड़ा हुआ है</div>
        ) : (
          <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1.4rem' }}>Disconnected / संपर्क टूट गया</div>
        )}
        
        {peerId && <div className="text-muted mt-4">My ID: {peerId}</div>}
      </div>

      {!isP2PConnected && (
        <>
          <div className="card mb-4">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>Secure Payment Config</h3>
            <div className="input-group">
              <label>Merchant UPI ID</label>
              <input 
                type="text" 
                className="input-field" 
                value={upiId} 
                onChange={(e) => setUpiId(e.target.value)} 
                placeholder="e.g. 9999999999@upi" 
              />
            </div>
            <div className="input-group">
              <label>Shop Name (For UPI)</label>
              <input 
                type="text" 
                className="input-field" 
                value={shopName} 
                onChange={(e) => setShopName(e.target.value)} 
                placeholder="e.g. Shri Kirana" 
              />
            </div>
            <button className="btn btn-primary" onClick={handleSaveConfig} style={{ width: '100%' }}>
              <Save size={20} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} /> Save Payment Settings
            </button>
          </div>

          <div className="card mb-4">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>1. Host Sync Server (Main Device)</h3>
            <div className="input-group">
              <label>Shop Sync ID</label>
              <input 
                type="text" 
                className="input-field" 
                value={shopId} 
                onChange={(e) => setShopId(e.target.value)} 
                placeholder="e.g. shri-kirana-1" 
              />
            </div>
            <button className="btn btn-primary" onClick={handleStartHost}>Start Hosting</button>
          </div>

          <div className="card mb-4">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>2. Connect to Main Device (Staff/Customer)</h3>
            <div className="input-group">
              <label>Target Shop Sync ID</label>
              <input 
                type="text" 
                className="input-field" 
                value={targetId} 
                onChange={(e) => setTargetId(e.target.value)} 
                placeholder="e.g. shri-kirana-1" 
              />
            </div>
            <button className="btn btn-secondary" onClick={handleConnect}>Connect & Sync</button>
          </div>
        </>
      )}

      {isP2PConnected && (
        <div className="card">
          <button className="btn btn-primary mb-4" style={{ display: 'flex', gap: 8, justifyContent: 'center' }} onClick={handleManualSync}>
            <RefreshCw size={24} /> <span>Sync Now / सिंक करें</span>
          </button>
          <button className="btn" style={{ background: '#F1F5F9', color: 'var(--danger)' }} onClick={destroyP2P}>
            Disconnect / डिसकनेक्ट
          </button>
        </div>
      )}
    </div>
  );
};
