import { t } from '@/i18n'
import type { SystemNodeStatusItem } from '@/types'

// FARM-FR-009 — "Farm A | Nhà chính | Tầng 1 | Phòng 2" của 1 thiết bị trong GET /devices/system-status; bỏ phần trống (backend cũ chưa trả `floor`)
export const nodeLocation = (n: SystemNodeStatusItem) =>
  [n.farm_name, n.house_name, n.floor != null && t('Tầng {{n}}', { n: n.floor }), n.zone_name].filter(Boolean).join(' | ')
