/**
 * keyStorageService.ts
 * Enterprise Cryptography Architecture:
 * - Dual-Key Hierarchy (MasterKey for Owner, AppKey for Shared)
 * - Audit Key Pair (ECDH Asymmetric for Log Encapsulation)
 * - Multi-PIN Wrapping (Owner wraps all, Staff wraps only AppKey)
 * - Session-based IDB Storage (Wiped on lock)
 */

import { useAppStore } from '../store/useAppStore';

const DB_NAME = 'ArbiTrackKeyStore';
const STORE_NAME = 'session_keys';
const KEY_ID = 'active_session';

// Memory References
let activeAppKey: CryptoKey | null = null;
let activeMasterKey: CryptoKey | null = null;
let activeHMACKey: CryptoKey | null = null;
let auditPublicKey: CryptoKey | null = null;

// --- IDB Session Helpers ---
const initKeyDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e: Event) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject('Failed to open KeyDB');
  });
};

interface SessionKeys {
  appKey: CryptoKey;
  masterKey?: CryptoKey;
  hmacKey: CryptoKey;
  auditPublicKey: CryptoKey;
  role: 'OWNER' | 'STAFF';
}

const storeSessionKeys = async (keys: SessionKeys) => {
  const db = await initKeyDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(keys, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject();
  });
};

const loadSessionKeys = async (): Promise<SessionKeys | null> => {
  const db = await initKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY_ID);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject();
  });
};

const clearSessionKeys = async () => {
  const db = await initKeyDB();
  return new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY_ID);
    tx.oncomplete = () => resolve();
  });
};

// --- Cryptography Helpers ---
const generateSalt = () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hexToUint8Array = (hexString: string) => {
  const match = hexString.match(/.{1,2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
};

const deriveKEK = async (pin: string, saltHex: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: hexToUint8Array(saltHex), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
};

export const KeyStorageService = {
  
  async checkSession(): Promise<boolean> {
    const session = await loadSessionKeys();
    if (session) {
      activeAppKey = session.appKey;
      activeHMACKey = session.hmacKey;
      activeMasterKey = session.masterKey || null; // Staff won't have this
      auditPublicKey = session.auditPublicKey;
      useAppStore.getState().setRole(session.role);
      return true;
    }
    return false;
  },

  async wipeSession(): Promise<void> {
    activeAppKey = null;
    activeMasterKey = null;
    activeHMACKey = null;
    useAppStore.getState().setRole(null);
    await clearSessionKeys();
  },

  // Called on VERY FIRST LAUNCH
  async generateOwnerEnvironment(ownerPin: string): Promise<void> {
    // Generate Core Keys (Extractable temporarily for wrapping)
    const appKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const hmacKey = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign', 'verify']);
    
    // Generate Audit KeyPair (ECDH for key encapsulation)
    const auditKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);

    // Wrap for Owner
    const salt = generateSalt();
    const kek = await deriveKEK(ownerPin, salt);

    const wrap = async (k: CryptoKey) => crypto.subtle.wrapKey('raw', k, kek, 'AES-KW');
    
    localStorage.setItem('owner_salt', salt);
    localStorage.setItem('owner_app', Array.from(new Uint8Array(await wrap(appKey))).map(b => b.toString(16).padStart(2, '0')).join(''));
    localStorage.setItem('owner_master', Array.from(new Uint8Array(await wrap(masterKey))).map(b => b.toString(16).padStart(2, '0')).join(''));
    localStorage.setItem('owner_hmac', Array.from(new Uint8Array(await wrap(hmacKey))).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Export Audit Public Key natively (plaintext JWK or Raw)
    const pubJwk = await crypto.subtle.exportKey('jwk', auditKeyPair.publicKey);
    localStorage.setItem('audit_pub_jwk', JSON.stringify(pubJwk));

    // Convert keys to non-extractable for memory session
    const makeSafe = async (k: CryptoKey, algo: AlgorithmIdentifier | HmacImportParams, usages: KeyUsage[]) => {
      const raw = await crypto.subtle.exportKey('raw', k);
      return await crypto.subtle.importKey('raw', raw, algo, false, usages);
    };



    activeAppKey = await makeSafe(appKey, 'AES-GCM', ['encrypt', 'decrypt']);
    activeMasterKey = await makeSafe(masterKey, 'AES-GCM', ['encrypt', 'decrypt']);
    activeHMACKey = await makeSafe(hmacKey, { name: 'HMAC', hash: 'SHA-256' }, ['sign', 'verify']);
    auditPublicKey = auditKeyPair.publicKey;

    useAppStore.getState().setRole('OWNER');
    await storeSessionKeys({ 
      appKey: activeAppKey, 
      masterKey: activeMasterKey, 
      hmacKey: activeHMACKey, 
      auditPublicKey,
      role: 'OWNER' 
    });
  },

  async login(pin: string): Promise<'OWNER' | 'STAFF' | false> {
    // 1. Try Owner
    const ownerSalt = localStorage.getItem('owner_salt');
    if (ownerSalt) {
      try {
        const kek = await deriveKEK(pin, ownerSalt);
        const wApp = hexToUint8Array(localStorage.getItem('owner_app')!);
        const wMaster = hexToUint8Array(localStorage.getItem('owner_master')!);
        const wHmac = hexToUint8Array(localStorage.getItem('owner_hmac')!);
        
        activeAppKey = await crypto.subtle.unwrapKey('raw', wApp, kek, 'AES-KW', 'AES-GCM', false, ['encrypt', 'decrypt']);
        activeMasterKey = await crypto.subtle.unwrapKey('raw', wMaster, kek, 'AES-KW', 'AES-GCM', false, ['encrypt', 'decrypt']);
        activeHMACKey = await crypto.subtle.unwrapKey('raw', wHmac, kek, 'AES-KW', { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
        
        const pubJwk = JSON.parse(localStorage.getItem('audit_pub_jwk')!);
        auditPublicKey = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

        useAppStore.getState().setRole('OWNER');
        await storeSessionKeys({ appKey: activeAppKey, masterKey: activeMasterKey, hmacKey: activeHMACKey, auditPublicKey, role: 'OWNER' });
        return 'OWNER';
      } catch {
        // Fall through to try Staff
      }
    }

    // 2. Try Staff
    const staffSalt = localStorage.getItem('staff_salt');
    if (staffSalt) {
      try {
        const kek = await deriveKEK(pin, staffSalt);
        const wApp = hexToUint8Array(localStorage.getItem('staff_app')!);
        const wHmac = hexToUint8Array(localStorage.getItem('staff_hmac')!);
        
        activeAppKey = await crypto.subtle.unwrapKey('raw', wApp, kek, 'AES-KW', 'AES-GCM', false, ['encrypt', 'decrypt']);
        activeHMACKey = await crypto.subtle.unwrapKey('raw', wHmac, kek, 'AES-KW', { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
        
        const pubJwk = JSON.parse(localStorage.getItem('audit_pub_jwk')!);
        auditPublicKey = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

        activeMasterKey = null; // STAFF HAS NO MASTER KEY
        useAppStore.getState().setRole('STAFF');
        await storeSessionKeys({ appKey: activeAppKey, hmacKey: activeHMACKey, auditPublicKey, role: 'STAFF' });
        return 'STAFF';
      } catch {
        return false;
      }
    }

    return false;
  },

  async verifyPinSilent(pin: string): Promise<boolean> {
    const role = useAppStore.getState().role;
    const salt = localStorage.getItem(role === 'OWNER' ? 'owner_salt' : 'staff_salt');
    if (!salt) return false;
    try {
      const kek = await deriveKEK(pin, salt);
      const wApp = hexToUint8Array(localStorage.getItem(role === 'OWNER' ? 'owner_app' : 'staff_app')!);
      await crypto.subtle.unwrapKey('raw', wApp, kek, 'AES-KW', 'AES-GCM', false, ['encrypt', 'decrypt']);
      return true;
    } catch {
      return false;
    }
  },


  async executeStaffPinRotation(ownerPin: string, basePin: string): Promise<void> {
    // 1. Derive Owner KEK to extract the raw App Key
    const ownerSalt = localStorage.getItem('owner_salt')!;
    const ownerKek = await deriveKEK(ownerPin, ownerSalt);
    
    const wApp = hexToUint8Array(localStorage.getItem('owner_app')!);
    const wHmac = hexToUint8Array(localStorage.getItem('owner_hmac')!);
    
    // Unwrap as EXTRACTABLE for exactly 1 millisecond
    const rawAppKey = await crypto.subtle.unwrapKey('raw', wApp, ownerKek, 'AES-KW', 'AES-GCM', true, ['encrypt', 'decrypt']);
    const rawHmacKey = await crypto.subtle.unwrapKey('raw', wHmac, ownerKek, 'AES-KW', { name: 'HMAC', hash: 'SHA-256' }, true, ['sign', 'verify']);

    // 2. Generate Staff KEK
    const dailySalt = new Date().toISOString().slice(0, 10);
    const effectiveStaffPin = basePin + dailySalt;
    const staffSalt = generateSalt();
    const staffKek = await deriveKEK(effectiveStaffPin, staffSalt);

    // 3. Wrap with Staff KEK
    const staffWrappedApp = await crypto.subtle.wrapKey('raw', rawAppKey, staffKek, 'AES-KW');
    const staffWrappedHmac = await crypto.subtle.wrapKey('raw', rawHmacKey, staffKek, 'AES-KW');

    localStorage.setItem('staff_salt', staffSalt);
    localStorage.setItem('staff_app', Array.from(new Uint8Array(staffWrappedApp)).map(b => b.toString(16).padStart(2, '0')).join(''));
    localStorage.setItem('staff_hmac', Array.from(new Uint8Array(staffWrappedHmac)).map(b => b.toString(16).padStart(2, '0')).join(''));
  },

  hasSetup(): boolean {
    return !!localStorage.getItem('owner_salt');
  },

  getAppKey(): CryptoKey {
    if (!activeAppKey) throw new Error("Session locked. AppKey missing.");
    return activeAppKey;
  },

  getMasterKey(): CryptoKey {
    if (!activeMasterKey) throw new Error("Unauthorized. MasterKey missing (Staff session).");
    return activeMasterKey;
  },

  getHMACKeyRef(): CryptoKey {
    if (!activeHMACKey) throw new Error('Session locked. HMACKey missing.');
    return activeHMACKey;
  },

  getAuditPublicKey(): CryptoKey {
    if (!auditPublicKey) throw new Error("Audit key missing.");
    return auditPublicKey;
  }
};
