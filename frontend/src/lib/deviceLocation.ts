import { t } from '@/i18n'
import type { SystemNodeStatusItem } from '@/types'

// Bỏ phần trống
export const nodeLocation = (n: SystemNodeStatusItem) =>
  [n.farm_name, n.house_name, n.floor != null && t('Tầng {{n}}', { n: n.floor }), n.zone_name].filter(Boolean).join(' | ')
