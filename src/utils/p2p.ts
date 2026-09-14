import Peer, { type DataConnection } from 'peerjs';
import { db } from '../db/db';
import { mergeSyncData } from '../db/queries';
import { useAppStore } from '../store/useAppStore';
import { CryptoService } from '../services/cryptoService';

let peer: Peer | null = null;
let connections: DataConnection[] = [];

// Initialize PeerJS
export const initP2P = (peerId: string) => {
  if (peer) {
    peer.destroy();
  }

  peer = new Peer(peerId);

  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);
    useAppStore.getState().setPeerId(id);
  });

  peer.on('connection', (conn) => {
    handleConnection(conn);
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    useAppStore.getState().setConnectionStatus(false);
  });
};

// Connect to a known "Host" or other peer
export const connectToPeer = (targetPeerId: string) => {
  if (!peer) return;
  
  const conn = peer.connect(targetPeerId);
  handleConnection(conn);
};

const handleConnection = (conn: DataConnection) => {
  conn.on('open', () => {
    console.log('Connected to:', conn.peer);
    useAppStore.getState().setConnectionStatus(true);
    connections.push(conn);
    
    // Automatically trigger a sync when connected
    triggerSync(conn);
  });

  conn.on('data', async (encryptedPayload: unknown) => {
    try {
      if (typeof encryptedPayload !== 'string' || !encryptedPayload) {
        return; // Discard invalid or empty frames
      }

      const decryptedString = await CryptoService.decryptData(encryptedPayload);
      const data = JSON.parse(decryptedString) as { type?: string; payload?: { products?: unknown[]; orders?: unknown[] } };

      if (data && data.type === 'SYNC_DATA' && data.payload) {
        console.log('Received secure sync data from', conn.peer);
        const products = Array.isArray(data.payload.products) ? data.payload.products : [];
        const orders = Array.isArray(data.payload.orders) ? data.payload.orders : [];

        await mergeSyncData(
          products as Parameters<typeof mergeSyncData>[0],
          orders as Parameters<typeof mergeSyncData>[1]
        );
        
        // Update local pending orders to 'synced' if they were sent out
        const pendingOrders = await db.orders.where('syncStatus').equals('pending').toArray();
        if (pendingOrders.length > 0) {
          await Promise.all(pendingOrders.map(o => db.orders.update(o.id, { syncStatus: 'synced' })));
        }
      }
    } catch {
      console.error('Failed to decrypt or parse sync payload from', conn.peer);
    }
  });

  conn.on('close', () => {
    console.log('Connection closed:', conn.peer);
    connections = connections.filter(c => c.peer !== conn.peer);
    if (connections.length === 0) {
      useAppStore.getState().setConnectionStatus(false);
    }
  });
};

export const triggerSync = async (specificConn?: DataConnection) => {
  const products = await db.products.toArray();
  const orders = await db.orders.where('syncStatus').equals('pending').toArray();

  const payload = {
    type: 'SYNC_DATA',
    payload: { products, orders }
  };

  const encryptedPayload = await CryptoService.encryptData(JSON.stringify(payload));

  if (specificConn) {
    specificConn.send(encryptedPayload);
  } else {
    connections.forEach(conn => conn.send(encryptedPayload));
  }
};

export const destroyP2P = () => {
  if (peer) {
    peer.destroy();
    peer = null;
    connections = [];
    useAppStore.getState().setConnectionStatus(false);
    useAppStore.getState().setPeerId(null);
  }
};
