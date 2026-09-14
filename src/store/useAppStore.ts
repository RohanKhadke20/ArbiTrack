import { create } from 'zustand';

interface AppState {
  isP2PConnected: boolean;
  syncProgress: number;
  peerId: string | null;
  role: 'OWNER' | 'STAFF' | null;
  setConnectionStatus: (status: boolean) => void;
  setSyncProgress: (progress: number) => void;
  setPeerId: (id: string | null) => void;
  setRole: (role: 'OWNER' | 'STAFF' | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isP2PConnected: false,
  syncProgress: 0,
  peerId: null,
  role: null,
  setConnectionStatus: (status) => set({ isP2PConnected: status }),
  setSyncProgress: (progress) => set({ syncProgress: progress }),
  setPeerId: (id) => set({ peerId: id }),
  setRole: (role) => set({ role })
}));
