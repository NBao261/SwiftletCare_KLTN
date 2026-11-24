import type { Role } from '@/types'
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

// Dòng chân mục nhóm A của BR-22: chủ trại trên farm có chuyên gia sửa vẫn áp ngay, backend mở mục duyệt cho chuyên gia. Chưa biết
// farm có chuyên gia hay không thì không ghi, tránh nói sai
export function getExpertReviewNote(role: Role | undefined, hasExpert: boolean | undefined): string | null {
  if (role !== 'FARM_OWNER' || hasExpert !== true) return null
  return t('Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại')
}

// Câu báo đã lưu của chủ trại trên farm có chuyên gia kèm lời nhắc chuyên gia sẽ xem lại (BR-22 nhóm A)
export function withExpertReviewMessage(message: string, reviewNote: string | null): string {
  return reviewNote ? `${message}. ${t('Chuyên gia sẽ xem lại thay đổi này.')}` : message
}

// Ghép các dòng chân mục, bỏ dòng trống; không còn dòng nào thì undefined để mục không vẽ chân
export function joinFooterNotes(...notes: (string | null | undefined)[]): string | undefined {
  const lines = notes.filter((note): note is string => Boolean(note))
  return lines.length > 0 ? lines.join('\n') : undefined
}
