/**
 * cryptoService.ts
 * Abstraction layer for Cryptographic Operations.
 * Uses Web Crypto API for encryption, decryption, and HMAC generation.
 */

import { KeyStorageService } from './keyStorageService';

// Utilities for Base64 conversion
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

export const CryptoService = {
  /**
   * Encrypts a plaintext string using AES-GCM and the active Master Key.
   * Returns a base64 string containing IV + CIPHERTEXT.
   */
  async encryptData(plaintext: string): Promise<string> {
    const key = KeyStorageService.getAppKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    // Combine IV and Ciphertext for easy storage
    const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertextBuffer), iv.length);

    return arrayBufferToBase64(combined.buffer);
  },

  /**
   * Decrypts a base64 string (IV + CIPHERTEXT) back to plaintext.
   */
  async decryptData(encryptedBase64: string): Promise<string> {
    try {
      const key = KeyStorageService.getAppKey();
      const combinedBuffer = base64ToArrayBuffer(encryptedBase64);
      const combined = new Uint8Array(combinedBuffer);

      // Extract IV and Ciphertext
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (cause) {
      console.error("Decryption failed. Data might be corrupted or key is incorrect.");
      throw new Error("Decryption failed", { cause });
    }
  },

  /**
   * Generates a short HMAC signature for message integrity validation (e.g., WhatsApp intent).
   */
  async generateHMAC(message: string): Promise<string> {
    const key = KeyStorageService.getHMACKeyRef();
    const enc = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(message)
    );
    
    // Return a short base64 snippet (e.g. 8 chars) for easy reading in URLs
    const fullBase64 = arrayBufferToBase64(signatureBuffer);
    // Replace URL unsafe chars
    return fullBase64.substring(0, 8).replace(/\+/g, '-').replace(/\//g, '_');
  }
};
