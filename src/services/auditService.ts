import { db } from '../db/db';
import { KeyStorageService } from './keyStorageService';
import { useAppStore } from '../store/useAppStore';

export interface AuditLogEntry {
  timestamp: string;
  role: 'OWNER' | 'STAFF' | 'SYSTEM';
  device_id: string;
  action: string;
  prev_hash: string;
}

export const AuditService = {
  
  async getDeviceId(): Promise<string> {
    try {
      const pkg = '@capacitor/' + 'device';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Device } = await (import(/* @vite-ignore */ pkg) as Promise<any>);
      const info = await Device.getId();
      return info.identifier;
    } catch {
      // Fallback for pure web environments
      let id = localStorage.getItem('web_device_id');
      if (!id) {
        id = 'web-' + crypto.randomUUID();
        localStorage.setItem('web_device_id', id);
      }
      return id;
    }
  },

  async computeHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async logAction(action: string): Promise<void> {
    try {
      const role = useAppStore.getState().role || 'SYSTEM';
      const deviceId = await this.getDeviceId();
      const timestamp = new Date().toISOString();
      
      // Get previous hash to maintain chain
      const lastLog = await db.audit_logs.orderBy('id').last();
      const prev_hash = lastLog ? lastLog.entry_hash : 'GENESIS';

      const logEntry: AuditLogEntry = {
        timestamp,
        role,
        device_id: deviceId,
        action,
        prev_hash
      };

      const logString = JSON.stringify(logEntry);
      const entry_hash = await this.computeHash(logString);

      // --- Hybrid Encryption ---
      const auditPublicKey = KeyStorageService.getAuditPublicKey();

      // 1. Generate random AES key for this specific log entry
      const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      
      // 2. Encrypt log string with AES key
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedDataBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(logString)
      );

      // 3. Encapsulate AES key using ECDH public key
      // Standard ECDH requires generating an ephemeral keypair to derive bits
      const ephemeralKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
      
      const sharedSecret = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: auditPublicKey },
        ephemeralKeyPair.privateKey,
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey']
      );

      // 4. Wrap the random AES key with the derived shared secret
      const wrappedAesKey = await crypto.subtle.wrapKey('raw', aesKey, sharedSecret, 'AES-KW');

      // Export ephemeral public key so Owner can derive the same shared secret later to decrypt
      const ephemeralPubKeyJwk = await crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

      // Store in IndexedDB
      await db.audit_logs.add({
        encrypted_data: Array.from(new Uint8Array(encryptedDataBuffer)),
        iv: Array.from(iv),
        wrapped_aes_key: Array.from(new Uint8Array(wrappedAesKey)),
        ephemeral_pub_jwk: ephemeralPubKeyJwk,
        entry_hash
      });

    } catch (e) {
      console.error("Failed to append audit log:", e);
      // In a strict environment, failure to log might halt the application.
    }
  }
};
