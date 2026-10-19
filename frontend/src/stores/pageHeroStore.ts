import { create } from 'zustand';

// Ảnh nền tràn đầu trang (nằm sau header và các khung nội dung) — trang tự đăng ký qua usePageHero
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
