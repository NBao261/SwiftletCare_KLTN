import type { PermissionAction } from '@/utils/permission.utils'

// Mục trong Cài đặt nhà mà khối "Cài đặt zone" ở chi tiết nhà mở thẳng tới được
export type SettingsSectionKind = 'thresholds' | 'fuzzy' | 'detection' | 'bird-count'

const SECTION_KINDS: readonly SettingsSectionKind[] = ['thresholds', 'fuzzy', 'detection', 'bird-count']

// Quyền sửa của từng mục — cùng bảng canPerform (Report 3 §2.4)
export const SETTINGS_SECTION_EDIT_ACTION: Record<SettingsSectionKind, PermissionAction> = {
  thresholds: 'editThresholds',
  fuzzy: 'editFuzzyTuning',
  detection: 'editDetectionTuning',
  'bird-count': 'editBirdCountTuning',
}

// Khoá của mục trong trang cài đặt: mục theo tầng kèm id zone, mức giảm tỷ lệ về tổ thuộc cả nhà
export function getSettingsSectionId(kind: SettingsSectionKind, zoneId?: string): string {
  if (kind === 'bird-count') return 'bird-count-tuning'
  return `${kind}:${zoneId ?? ''}`
}

// Đọc tham số route "section"; giá trị lạ thì null (mở trang cài đặt như bình thường)
export function parseSettingsSectionKind(value: string | undefined): SettingsSectionKind | null {
  return SECTION_KINDS.find(kind => kind === value) ?? null
}
