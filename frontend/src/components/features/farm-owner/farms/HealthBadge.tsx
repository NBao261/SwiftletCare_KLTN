import { Badge } from '@/components/ui'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { Health } from '@/components/features/farm-owner/farms/farmStructure'

/** Nhãn "Cảnh báo" / "Bình thường" của nhà hoặc zone — luôn kèm chữ, không chỉ truyền bằng màu (FE_Design 13.11) */
export default function HealthBadge({ health }: { health: Health }) {
  const { t } = useT(farmDict)
  return (
    <Badge tone={health === 'ALERT' ? 'warning' : 'neutral'}>
      {health === 'ALERT' ? t('health.alert') : t('health.normal')}
    </Badge>
  )
}
