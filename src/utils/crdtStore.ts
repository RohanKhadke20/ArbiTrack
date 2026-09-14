import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { logger } from '../lib/logger';

/** Shared Yjs document — single source of truth for P2P-synced data */
export const ydoc = new Y.Doc();

/** Persistent IndexedDB backing — survives page reloads */
const persistence = new IndexeddbPersistence('arbitrack-crdt', ydoc);
persistence.on('synced', () => {
  logger.info('CRDT store synced with IndexedDB');
});

/**
 * Map of product SKU -> product state (Yjs Map for CRDT convergence)
 * Using a Y.Map means concurrent writes from two peers always converge
 * without silent data loss (unlike Last-Write-Wins timestamp approach).
 */
export const yProducts: Y.Map<any> = ydoc.getMap('products');

/**
 * Applies a remote CRDT update received over PeerJS DataChannel.
 * Merges without conflict — both peers converge to the same state.
 */
export function applyRemoteUpdate(update: Uint8Array): void {
  try {
    Y.applyUpdate(ydoc, update);
    logger.info('Applied remote CRDT update', { bytes: update.byteLength });
  } catch (e: any) {
    logger.error('Failed to apply remote CRDT update', { error: e.message });
  }
}

/**
 * Encodes the full current state as a Uint8Array suitable for
 * sending over PeerJS DataChannel to a newly connected peer.
 */
export function encodeFullState(): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

/**
 * Subscribes to any change in yProducts.
 * Callback receives the changed entries as a plain object.
 */
export function onProductsChange(cb: (products: Record<string, any>) => void): () => void {
  const handler = () => {
    const snapshot: Record<string, any> = {};
    yProducts.forEach((value, key) => { snapshot[key] = value; });
    cb(snapshot);
  };
  yProducts.observe(handler);
  return () => yProducts.unobserve(handler); // returns cleanup function
}
