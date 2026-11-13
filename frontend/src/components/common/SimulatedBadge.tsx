import { Badge } from '@/components/ui'
import { t } from '@/i18n'

// SYSTEM-FR-004 — thiết bị của bộ giả lập: màn nào hiện thiết bị cũng phải ghi rõ, thiết bị thật thì không hiện gì
export default function SimulatedBadge({ simulated }: { simulated?: boolean }) {
  if (!simulated) return null
  return (
    <Badge tone="info" className="shrink-0 px-2 py-0.5" title={t('Thiết bị của bộ giả lập, không phải thiết bị thật')}>
      Giả lập
    </Badge>
  )
}
