import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useHeaderSlotStore } from '@/stores/headerSlotStore';

// Đưa nút của trang (VD bộ lọc nhà yến) lên góc phải header, trước nút VI/EN; rời trang thì tự gỡ
export default function HeaderActions({ children }: { children: ReactNode }): JSX.Element | null {
  const slot = useHeaderSlotStore(state => state.slot);
  if (!slot) return null;
  return createPortal(children, slot);
}
