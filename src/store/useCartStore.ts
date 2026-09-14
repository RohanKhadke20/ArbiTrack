import { create } from 'zustand';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  addToCart: (item) => set((state) => {
    const existing = state.items.find(i => i.productId === item.productId);
    if (existing) {
      return {
        items: state.items.map(i => 
          i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
        )
      };
    }
    return { items: [...state.items, item] };
  }),
  removeFromCart: (productId) => set((state) => ({
    items: state.items.filter(i => i.productId !== productId)
  })),
  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map(i => i.productId === productId ? { ...i, quantity } : i)
  })),
  clearCart: () => set({ items: [] }),
  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
  getTotal: () => get().items.reduce((total, item) => total + (item.price * item.quantity), 0)
}));
