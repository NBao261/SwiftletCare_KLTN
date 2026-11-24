import { create } from 'zustand';

// Zustand vì AppHeader và trang ở 2 nhánh cây khác nhau
interface HeaderSlotState {
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
}

export const useHeaderSlotStore = create<HeaderSlotState>(set => ({
  slot: null,
  setSlot: slot => set({ slot }),
}));
