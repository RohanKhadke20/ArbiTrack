import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  name: string;
  // Encrypted fields (Base64)
  enc_price?: string;
  enc_stock?: string;
  enc_image?: string;
  
  // Runtime decrypted fields (not stored in DB, or marked as optional for TS)
  price?: number;
  stock?: number;
  image?: string;
  
  categoryId?: number;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  id: string; // UUID
  // Entire sensitive payload (customerName, phone, items, total, paymentMethod) is encrypted into one string
  enc_payload: string; 
  
  // Runtime decrypted fields
  customerName?: string;
  customerPhone?: string;
  items?: { productId: number; quantity: number; price: number }[];
  totalAmount?: number;
  paymentMethod?: 'upi' | 'cash';
  
  status: 'pending' | 'confirmed' | 'delivered' | 'completed' | 'cancelled';
  syncStatus: 'pending' | 'synced'; // Plaintext for syncing
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
}

export interface Config {
  key: string;
  enc_value: string; // Encrypted JSON
}

export interface AuditLogRaw {
  id?: number;
  encrypted_data: number[];
  iv: number[];
  wrapped_aes_key: number[];
  ephemeral_pub_jwk: JsonWebKey;
  entry_hash: string;
}

export class ShopDatabase extends Dexie {
  products!: Table<Product, number>;
  orders!: Table<Order, string>;
  categories!: Table<Category, number>;
  config!: Table<Config, string>;
  audit_logs!: Table<AuditLogRaw, number>;

  constructor() {
    super('ArbiTrackOfflineShop');
    this.version(3).stores({
      products: '++id, name, isDeleted, updatedAt',
      orders: 'id, status, syncStatus, createdAt',
      categories: '++id, name',
      config: 'key',
      audit_logs: '++id, entry_hash'
    });
  }
}

export const db = new ShopDatabase();
