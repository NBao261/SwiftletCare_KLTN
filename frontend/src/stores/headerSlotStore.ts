import { create } from 'zustand';

// Chỗ trống ở góc phải header (trước nút VI/EN) cho HeaderActions — dùng Zustand vì AppHeader và trang là 2 nhánh cây khác nhau, state cục bộ không chia sẻ được phần tử DOM, React Query chỉ cho dữ liệu server
interface HeaderSlotState {
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
}

export const useHeaderSlotStore = create<HeaderSlotState>(set => ({
  slot: null,
  setSlot: slot => set({ slot }),
}));
