import { useEffect, useRef, type ReactNode } from 'react';

import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import { cn } from '@/lib/cn';

interface DeviceSectionProps {
  title: string;
  description?: string;
  // Mở từ 1 bộ kit ở trang danh sách: cuộn tới và viền xanh chanh cả khung
  isHighlighted: boolean;
  // Nút góc phải header (VD Ngưỡng cảm biến của Zone)
  action?: ReactNode;
  children: ReactNode;
}

// Khung 1 Zone (1 bộ kit) hoặc nhóm camera trên trang chi tiết thiết bị
export default function DeviceSection({ title, description, isHighlighted, action, children }: DeviceSectionProps): JSX.Element {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted) sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [isHighlighted]);

  return (
    <div ref={sectionRef} className="scroll-mt-24">
      <FarmFrame title={title} description={description} action={action} className={cn(isHighlighted && 'outline outline-2 -outline-offset-2 outline-accent-600')}>
        {children}
      </FarmFrame>
    </div>
  );
}
