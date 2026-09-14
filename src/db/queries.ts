import { db, type Product, type Order } from './db';
import { DBEncryptionService } from '../services/dbService';



// --- Products ---
export const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => {
  const now = Date.now();
  const encryptedProduct = await DBEncryptionService.encryptProduct({
    ...product,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  });
  return await db.products.add(encryptedProduct as Product);
};

export const updateProduct = async (id: number, changes: Partial<Product>) => {
  const encryptedChanges = await DBEncryptionService.encryptProduct(changes);
  return await db.products.update(id, { ...encryptedChanges, updatedAt: Date.now() });
};

export const deleteProduct = async (id: number) => {
  return await db.products.update(id, { isDeleted: true, updatedAt: Date.now() });
};

// --- Orders ---

/** Build a human-readable, collision-resistant order ID */
const buildOrderId = async (): Promise<string> => {
  const shopId = (await db.config.get('shopId'))?.enc_value ?? 'SHOP';
  const ts     = Date.now().toString(36).toUpperCase();
  const rand   = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${shopId}-${ts}-${rand}`;
};

export const addOrder = async (
  order: Omit<Order, 'id' | 'syncStatus' | 'createdAt' | 'enc_payload'>,
  idempotencyKey?: string          // caller can pass a client-generated key to prevent double-submit
): Promise<string> => {
  // Duplicate prevention: same idempotency key → return existing order ID
  if (idempotencyKey) {
    const existing = await db.orders.where('id').equals(idempotencyKey).first();
    if (existing) return existing.id;
  }

  const id = idempotencyKey ?? await buildOrderId();

  const newOrderData = {
    ...order,
    id,
    syncStatus: 'pending' as const,
    createdAt: Date.now(),
  };

  const encryptedOrder = await DBEncryptionService.encryptOrder(newOrderData);

  await db.transaction('rw', db.orders, db.products, async () => {
    await db.orders.add(encryptedOrder as Order);

    // Deduct stock for each item
    for (const item of order.items ?? []) {
      const product = await db.products.get(item.productId);
      if (product) {
        const decryptedProduct = await DBEncryptionService.decryptProduct(product);
        if (decryptedProduct.stock !== undefined) {
          const newStock = Math.max(0, decryptedProduct.stock - item.quantity);
          const stockChanges = await DBEncryptionService.encryptProduct({ stock: newStock });
          await db.products.update(item.productId, {
            enc_stock: stockChanges.enc_stock,
            updatedAt: Date.now(),
          });
        }
      }
    }
  });

  return id;
};

export const updateOrderStatus = async (id: string, status: 'pending' | 'confirmed' | 'delivered' | 'completed' | 'cancelled') => {
  return await db.orders.update(id, { status, syncStatus: 'pending' });
};

// --- Config ---
export const setConfig = async (key: string, value: unknown) => {
  const enc_value = await DBEncryptionService.encryptConfig(value);
  return await db.config.put({ key, enc_value });
};

export const getConfig = async (key: string) => {
  const config = await db.config.get(key);
  if (!config?.enc_value) return null;
  return await DBEncryptionService.decryptConfig(config.enc_value);
};

// --- Sync Merging (LWW) ---
export const mergeSyncData = async (incomingProducts: Product[], incomingOrders: Order[]) => {
  await db.transaction('rw', db.products, db.orders, async () => {
    // Merge Products (Last-Write-Wins)
    for (const remote of incomingProducts) {
      if (!remote.id) continue;
      const local = await db.products.get(remote.id);
      if (!local || remote.updatedAt > local.updatedAt) {
        await db.products.put(remote);
      }
    }

    // Merge Orders
    for (const remote of incomingOrders) {
      const local = await db.orders.get(remote.id);
      if (!local) {
        await db.orders.put({ ...remote, syncStatus: 'synced' });
      }
    }
  });
};

/** Seed sample demo products for instant onboarding & zero-friction evaluation */
export const seedDemoProducts = async (): Promise<number> => {
  const existingCount = await db.products.count();
  if (existingCount > 0) return 0;

  const demoItems = [
    { name: 'Quantum Core Processor', price: 499.99, stock: 15, barcode: 'QCP-9901' },
    { name: 'Neural Link Interface', price: 129.50, stock: 40, barcode: 'NLI-8822' },
    { name: 'Cryo Cooling Module', price: 89.00, stock: 25, barcode: 'CCM-7711' },
    { name: 'Holographic Display Unit', price: 349.00, stock: 12, barcode: 'HDU-6633' },
    { name: 'Fiber Bus Transceiver', price: 45.00, stock: 60, barcode: 'FBT-5544' },
  ];

  for (const item of demoItems) {
    await addProduct(item);
  }
  return demoItems.length;
};
