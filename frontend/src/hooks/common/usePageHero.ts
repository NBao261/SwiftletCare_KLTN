import { useEffect } from 'react';

import { usePageHeroStore, type PageHeroImage } from '@/stores/pageHeroStore';

// Bật ảnh nền tràn đầu trang khi trang mở, rời trang thì gỡ — AppShell vẽ ảnh sau header và các khung nội dung
export function usePageHero(image: PageHeroImage): void {
  const setImage = usePageHeroStore(state => state.setImage);
  const { src, width, height } = image;

  useEffect(() => {
    setImage({ src, width, height });
    return () => setImage(null);
  }, [setImage, src, width, height]);
}
