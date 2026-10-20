import { create } from 'zustand';

// Ảnh nền tràn đầu trang do trang bật qua usePageHero — dùng Zustand vì AppShell vẽ ảnh nằm ngoài cây của trang, state cục bộ không truyền lên được, React Query chỉ cho dữ liệu server
export interface PageHeroImage {
  src: string;
  // Kích thước thật của ảnh, khai cố định để không nhảy bố cục khi ảnh tải xong
  width: number;
  height: number;
}

interface PageHeroState {
  image: PageHeroImage | null;
  setImage: (image: PageHeroImage | null) => void;
}

export const usePageHeroStore = create<PageHeroState>(set => ({
  image: null,
  setImage: image => set({ image }),
}));
