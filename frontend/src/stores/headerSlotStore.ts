import { create } from 'zustand';

// Chỗ trống ở góc phải header (trước nút VI/EN) — trang đặt nút riêng vào qua HeaderActions
interface HeaderSlotState {
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
}

export const useHeaderSlotStore = create<HeaderSlotState>(set => ({
  slot: null,
  setSlot: slot => set({ slot }),
}));
