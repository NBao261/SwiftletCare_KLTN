import { cn } from '@/lib/cn'

export interface StatusTab<Id extends string> {
  id: Id
  label: string
  // Số cần chú ý ghi ngay trên tab (VD chờ xác nhận); 0 hoặc không có thì không hiện
  badge?: number
}

interface StatusTabsProps<Id extends string> {
  tabs: StatusTab<Id>[]
  value: Id
  onChange: (id: Id) => void
  ariaLabel: string
  // pill: đứng một mình trên thẻ (trang không có tab nhóm); underline: nằm trong thẻ, dưới tab nhóm (nhóm Công việc)
  variant?: 'pill' | 'underline'
}

const BADGE_CLASS = 'min-w-5 rounded-full bg-safetyOrange px-1.5 text-center text-xs font-bold leading-5 text-white tabular-nums'

// Hàng tab trạng thái của các trang danh sách (Cảnh báo, Phiếu công việc, Kế hoạch bảo trì, Khuyến nghị): cuộn ngang trên điện thoại
export default function StatusTabs<Id extends string>({ tabs, value, onChange, ariaLabel, variant = 'pill' }: StatusTabsProps<Id>): JSX.Element {
  const isPill = variant === 'pill'
  return (
    <div className={cn('max-w-full overflow-x-auto', isPill && 'self-start')}>
      <div className={cn(isPill ? 'inline-flex gap-1 rounded-full bg-warmGray/10 p-1' : 'flex min-w-max gap-6 border-b border-warmGray/15')} role="tablist" aria-label={ariaLabel}>
        {tabs.map(tab => {
          const isActive = value === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap text-small font-semibold transition-colors duration-150',
                isPill
                  ? cn('h-9 rounded-full px-4', isActive ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal')
                  : cn('-mb-px border-b-2 pb-3 pt-1 max-sm:min-h-11', isActive ? 'border-charcoal text-charcoal' : 'border-transparent text-warmGray hover:text-charcoal'),
              )}
            >
              {tab.label}
              {!!tab.badge && <span className={BADGE_CLASS}>{tab.badge}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
