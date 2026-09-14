import { useState } from 'react';
import { db } from '../../db/db';
import { CryptoService } from '../../services/cryptoService';
import { Download, Upload } from 'lucide-react';

export const BackupRestore = () => {
  const [loading, setLoading] = useState(false);

  const executeBackup = async () => {
    try {
      setLoading(true);
      const products = await db.products.toArray();
      const orders = await db.orders.toArray();
      const config = await db.config.toArray();

      const payload = JSON.stringify({ products, orders, config });
      const encryptedData = await CryptoService.encryptData(payload);

      const blob = new Blob([encryptedData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ShopBackup_${new Date().toISOString().slice(0,10)}.enc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Backup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupRequest = async () => {
    executeBackup();
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      const decrypted = await CryptoService.decryptData(text);
      const data = JSON.parse(decrypted);

      await db.transaction('rw', db.products, db.orders, db.config, async () => {
        await db.products.clear();
        await db.orders.clear();
        await db.config.clear();

        if (data.products?.length) await db.products.bulkAdd(data.products);
        if (data.orders?.length) await db.orders.bulkAdd(data.orders);
        if (data.config?.length) await db.config.bulkAdd(data.config);
      });

      alert('Restore Successful!');
      window.location.reload();
    } catch {
      alert('Restore Failed. Invalid file or incorrect Master PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>बैकअप / Backup & Restore</h2>
      
      <div className="card mb-4 text-center" style={{ padding: '32px 16px', position: 'relative' }}>
        <h3 className="mb-4">Export Encrypted Backup</h3>
        <p className="text-muted mb-4">Downloads a secure, AES-256 encrypted file containing all your products and orders.</p>
        
        <button className="btn btn-primary" onClick={handleBackupRequest} disabled={loading} style={{ width: '100%' }}>
          <Download size={20} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
          <span>{loading ? 'Exporting...' : 'Download Backup'}</span>
        </button>
      </div>

      <div className="card text-center" style={{ padding: '32px 16px' }}>
        <h3 className="mb-4">Restore Backup</h3>
        <p className="text-muted mb-4">Warning: This will overwrite current data. The backup must have been created with the SAME Master PIN.</p>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-secondary" disabled={loading} style={{ width: '100%' }}>
            <Upload size={20} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
            <span>{loading ? 'Restoring...' : 'Upload .enc File'}</span>
          </button>
          <input 
            type="file" 
            accept=".enc" 
            onChange={handleRestore} 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
};
