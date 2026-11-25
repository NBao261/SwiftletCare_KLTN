import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export interface StatItem {
  label: string
  value: string
  unit?: string
  // Dòng phụ dưới số
  sub?: string
  // Số đang báo vấn đề: cam kèm dòng phụ, không chỉ màu
  isWarning?: boolean
}

// Dải số liệu gọn trong khung: các số cách nhau bằng vạch mảnh, thay cho một lưới ô viền lồng trong thẻ
export default function StatStrip({ items }: { items: StatItem[] }): JSX.Element {
  return (
    <dl
      className="grid grid-cols-2 gap-y-5 rounded-2xl bg-warmGray/[0.06] py-4 sm:[grid-template-columns:repeat(var(--stat-count),minmax(0,1fr))]"
      style={{ '--stat-count': items.length } as CSSProperties}
    >
      {items.map((item, index) => (
        <div key={item.label} className={cn('min-w-0 px-5', index > 0 && 'sm:border-l sm:border-warmGray/20', index % 2 === 1 && 'max-sm:border-l max-sm:border-warmGray/20')}>
          <dt className="text-small font-semibold text-warmGray">{item.label}</dt>
          <dd className={cn('mt-1 text-2xl font-extrabold leading-none tracking-tight tabular-nums', item.isWarning ? 'text-climateOrange' : 'text-charcoal')}>
            {item.value}
            {item.unit && <span className="ml-1 text-small font-medium text-warmGray">{item.unit}</span>}
          </dd>
          {item.sub && <dd className="mt-1.5 text-small font-medium text-warmGray">{item.sub}</dd>}
        </div>
      ))}
    </dl>
  )
}
