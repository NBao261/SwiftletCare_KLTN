import { create } from 'zustand';

// Zustand vì AppHeader và trang ở 2 nhánh cây khác nhau
interface HeaderSlotState {
  // Góc phải header: bộ lọc phạm vi của trang
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
  // Ngay cạnh tên trang: huy hiệu nhỏ của trang (VD quyền hạn trên trang chuyên môn)
  titleSlot: HTMLElement | null;
  setTitleSlot: (slot: HTMLElement | null) => void;
}

export const useHeaderSlotStore = create<HeaderSlotState>(set => ({
  slot: null,
  setSlot: slot => set({ slot }),
  titleSlot: null,
  setTitleSlot: titleSlot => set({ titleSlot }),
}));
