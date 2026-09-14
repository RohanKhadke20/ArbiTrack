import type { Product, Order } from '../db/db';
import { CryptoService } from './cryptoService';

export const DBEncryptionService = {
  async encryptProduct(product: Partial<Product>): Promise<Product> {
    const p: Partial<Product> & Record<string, unknown> = { ...product };
    if (product.price !== undefined) p.enc_price = await CryptoService.encryptData(product.price.toString());
    if (product.stock !== undefined) p.enc_stock = await CryptoService.encryptData(product.stock.toString());
    if (product.image) p.enc_image = await CryptoService.encryptData(product.image);
    
    delete p.price;
    delete p.stock;
    delete p.image;
    return p as Product;
  },

  async decryptProduct(product: Product): Promise<Product> {
    const p: Partial<Product> & Record<string, unknown> = { ...product };
    if (product.enc_price) p.price = Number(await CryptoService.decryptData(product.enc_price));
    if (product.enc_stock) p.stock = Number(await CryptoService.decryptData(product.enc_stock));
    if (product.enc_image) p.image = await CryptoService.decryptData(product.enc_image);
    return p as Product;
  },

  async encryptOrder(order: Partial<Order>): Promise<Order> {
    const payload = JSON.stringify({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items: order.items,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod
    });
    
    const enc_payload = await CryptoService.encryptData(payload);
    
    return {
      id: order.id!,
      enc_payload,
      status: order.status || 'pending',
      syncStatus: order.syncStatus || 'pending',
      createdAt: order.createdAt || Date.now()
    } as Order;
  },

  async decryptOrder(order: Order): Promise<Order> {
    if (!order.enc_payload) return order;
    
    const payloadStr = await CryptoService.decryptData(order.enc_payload);
    const payload = JSON.parse(payloadStr) as Partial<Order>;
    
    return {
      ...order,
      ...payload
    };
  },

  async encryptConfig(value: unknown): Promise<string> {
    return await CryptoService.encryptData(JSON.stringify(value));
  },

  async decryptConfig(enc_value: string): Promise<unknown> {
    return JSON.parse(await CryptoService.decryptData(enc_value));
  }
};
