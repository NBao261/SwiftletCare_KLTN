import type { PermissionAction } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Mục trong Cài đặt nhà mở thẳng tới được (khối "Cài đặt zone" ở chi tiết nhà, nút "Chỉnh mức" ở ngày lệch…)
export type SettingsSectionKind =
  | 'thresholds'
  | 'fuzzy'
  | 'detection'
  | 'bird-count'
  | 'stage'
  | 'weather'
  | 'counting-schedule'
  | 'health-levels'

const SECTION_KINDS: readonly SettingsSectionKind[] = [
  'thresholds',
  'fuzzy',
  'detection',
  'bird-count',
  'stage',
  'weather',
  'counting-schedule',
  'health-levels',
]

// Mục thuộc cả nhà (nằm trên nhóm "Theo khu vực"), không kèm id zone
const HOUSE_SECTION_KINDS: ReadonlySet<SettingsSectionKind> = new Set([
  'bird-count',
  'stage',
  'weather',
  'counting-schedule',
  'health-levels',
])

// Quyền sửa của từng mục — cùng bảng canPerform (Report 3 §2.4)
export const SETTINGS_SECTION_EDIT_ACTION: Record<SettingsSectionKind, PermissionAction> = {
  thresholds: 'editThresholds',
  fuzzy: 'editFuzzyTuning',
  detection: 'editDetectionTuning',
  'bird-count': 'editBirdCountTuning',
  stage: 'setHouseStage',
  weather: 'editWeatherRules',
  'counting-schedule': 'editCountingSchedule',
  'health-levels': 'editHealthLevels',
}

// Mục thuộc cả nhà hay thuộc một tầng
export function isHouseSectionKind(kind: SettingsSectionKind): boolean {
  return HOUSE_SECTION_KINDS.has(kind)
}

// Khoá của mục trong trang cài đặt: mục theo tầng kèm id zone, mục của cả nhà thì không
export function getSettingsSectionId(kind: SettingsSectionKind, zoneId?: string): string {
  if (kind === 'bird-count') return 'bird-count-tuning'
  if (isHouseSectionKind(kind)) return `house-${kind}`
  return `${kind}:${zoneId ?? ''}`
}

// Đọc tham số route "section"; giá trị lạ thì null (mở trang cài đặt như bình thường)
export function parseSettingsSectionKind(value: string | undefined): SettingsSectionKind | null {
  return SECTION_KINDS.find(kind => kind === value) ?? null
}

// Vì sao một mục chỉ được xem: chủ trại ở farm đã có chuyên gia thì việc đó của chuyên gia (BR-22); role khác chỉ xem
export function getViewOnlyNote(canEditWithoutExpert: boolean, hasExpert: boolean | undefined): string {
  if (canEditWithoutExpert && hasExpert) return t('Farm đã có chuyên gia: chuyên gia đặt mục này, bạn chỉ xem')
  return t('Bạn chỉ xem mục này')
}
