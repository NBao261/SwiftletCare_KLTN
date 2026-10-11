import { CircleIcon, WarningIcon } from '@phosphor-icons/react'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import type { HouseHealth } from '@/components/features/farm-owner/farms/farmStructure'

/** Màu theo 3 trạng thái vận hành: xám (chưa cấu hình) · cam (sự cố) · Lime Mist CHỈ ở badge + dải thông báo của nhà bình thường (accent mật độ thấp) */
export const HEALTH_STYLE: Record<HouseHealth, { badge: string; card: string; iconBox: string; banner: string }> = {
  EMPTY: {
    badge: 'border-warmGray/15 bg-warmGray/10 text-warmGray',
    card: 'border-warmGray/20',
    iconBox: 'bg-warmGray/10 text-warmGray',
    banner: 'border-warmGray/15 bg-warmGray/5 text-warmGray',
  },
  NORMAL: {
    badge: 'border-success/40 bg-limeMist/30 px-3 text-xs text-accent-900',
    card: 'border-warmGray/20',
    iconBox: 'bg-warmGray/10 text-charcoal',
    banner: 'border-success/30 bg-limeMist/20 text-xs text-accent-900',
  },
  ALERT: {
    badge: 'border-orange-600/40 bg-orange-100 text-orange-800',
    card: 'border-orange-600/30 shadow-sm',
    iconBox: 'bg-orange-100 text-orange-800',
    banner: 'border-orange-600/50 bg-orange-100 text-orange-800',
  },
}

const LABEL_KEY = { EMPTY: 'health.empty', NORMAL: 'health.normal', ALERT: 'health.alert' } as const

/** Nhãn trạng thái nhà/zone — luôn kèm chữ và ký hiệu, không chỉ truyền bằng màu (FE_Design 13.11) */
export default function HealthBadge({ health }: { health: HouseHealth }) {
  const { t } = useT(farmDict)
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-caption', HEALTH_STYLE[health].badge)}>
      {health === 'ALERT' ? <WarningIcon size={12} weight="bold" /> : <CircleIcon size={8} weight={health === 'NORMAL' ? 'fill' : 'bold'} />}
      {t(LABEL_KEY[health])}
    </span>
  )
}
