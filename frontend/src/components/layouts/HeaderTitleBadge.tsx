import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useHeaderSlotStore } from '@/stores/headerSlotStore';

// Đưa một huy hiệu nhỏ lên header, ngay cạnh tên trang; rời trang thì tự gỡ
export default function HeaderTitleBadge({ children }: { children: ReactNode }): JSX.Element | null {
  const slot = useHeaderSlotStore(state => state.titleSlot);
  if (!slot) return null;
  return createPortal(children, slot);
}
