import { t } from '@/i18n'
import { ringList } from '@/components/common/countingRing.utils'
import type { CountingRing } from '@/types'

// Một thay đổi cụ thể trong nhóm tham số lồng nhau (lịch đếm, vòng đếm)
export interface ChangeLine {
  kind: 'added' | 'removed' | 'changed'
  text: string
}

interface Windows { start?: string; end?: string }
interface DayWindows { morning?: Windows; evening?: Windows }
interface Profile extends DayWindows { name?: string; from?: string; to?: string }

// Khoá lồng nhau mô tả được từng thay đổi; các khoá khác là số hoặc chữ đơn
export const STRUCTURED_KEYS = ['profiles', 'temporary', 'default_windows', 'ring', 'rings']

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

// 'YYYY-MM-DD' → 'DD/MM/YYYY', 'MM-DD' → 'DD/MM'
const dayText = (value?: string) => (value ? value.split('-').reverse().join('/') : '')
const spanText = (from?: string, to?: string) => (from === to ? dayText(from) : `${dayText(from)}–${dayText(to)}`)

// Khung sáng, chiều; thiếu giờ là khung hệ thống
function windowsText(windows?: DayWindows | null): string {
  const { morning, evening } = windows ?? {}
  if (!morning?.start || !morning.end || !evening?.start || !evening.end) return t('Khung hệ thống')
  return t('Sáng {{morning}}, chiều {{evening}}', {
    morning: `${morning.start}–${morning.end}`,
    evening: `${evening.start}–${evening.end}`,
  })
}

// So hai danh sách theo khoá: có ở mới không có ở cũ là thêm, ngược lại là bỏ, cả hai nhưng khác là sửa
function diffByKey<T>(
  before: T[], after: T[], keyOf: (item: T) => string,
  text: { added: (item: T) => string; removed: (item: T) => string; changed: (a: T, b: T) => string },
): ChangeLine[] {
  const beforeByKey = new Map(before.map(item => [keyOf(item), item]))
  const afterByKey = new Map(after.map(item => [keyOf(item), item]))
  const lines: ChangeLine[] = []
  for (const item of after) {
    const old = beforeByKey.get(keyOf(item))
    if (!old) lines.push({ kind: 'added', text: text.added(item) })
    else if (!same(old, item)) lines.push({ kind: 'changed', text: text.changed(old, item) })
  }
  for (const item of before) if (!afterByKey.has(keyOf(item))) lines.push({ kind: 'removed', text: text.removed(item) })
  return lines
}

const hoursText = (window?: Windows) => (window?.start && window.end ? `${window.start}–${window.end}` : '')

// Chỉ ghi phần khác nhau: ngày, giờ sáng, giờ chiều
function differences(old: Profile, next: Profile): string {
  const parts: string[] = []
  if (old.from !== next.from || old.to !== next.to) parts.push(`${t('Ngày')} ${spanText(old.from, old.to)} → ${spanText(next.from, next.to)}`)
  if (!same(old.morning, next.morning)) parts.push(`${t('Sáng')} ${hoursText(old.morning)} → ${hoursText(next.morning)}`)
  if (!same(old.evening, next.evening)) parts.push(`${t('Chiều')} ${hoursText(old.evening)} → ${hoursText(next.evening)}`)
  return parts.join('; ')
}

const directionText = (ring: CountingRing) =>
  ring.into_ring_is_exit ? t('Chim bay vào vòng là chim ra khỏi tổ') : t('Chim bay vào vòng là chim về tổ')

// Vòng cũ và mới cùng số thứ tự: đổi số đỉnh, vị trí đỉnh hoặc hướng
function ringChange(old: CountingRing, next: CountingRing): string {
  const parts: string[] = []
  if (old.points.length !== next.points.length) parts.push(t('{{from}} → {{to}} đỉnh', { from: old.points.length, to: next.points.length }))
  else if (!same(old.points, next.points)) parts.push(t('Đổi vị trí các đỉnh'))
  if (old.into_ring_is_exit !== next.into_ring_is_exit) parts.push(`${directionText(old)} → ${directionText(next)}`)
  return parts.join('; ')
}

// Mô tả từng thay đổi của khoá lồng nhau; null khi khoá không thuộc nhóm đó, danh sách rỗng khi không tìm ra khác biệt
export function describeStructuredChange(key: string, before: unknown, after: unknown): ChangeLine[] | null {
  if (key === 'profiles') {
    return diffByKey<Profile>(list(before), list(after), profile => profile.name ?? '', {
      added: profile => t('Thêm hồ sơ {{name}} ({{span}}): {{windows}}', { name: profile.name ?? '', span: spanText(profile.from, profile.to), windows: windowsText(profile) }),
      removed: profile => t('Bỏ hồ sơ {{name}} ({{span}}): {{windows}}', { name: profile.name ?? '', span: spanText(profile.from, profile.to), windows: windowsText(profile) }),
      changed: (old, next) => t('Sửa hồ sơ {{name}}: {{change}}', { name: next.name ?? '', change: differences(old, next) }),
    })
  }
  if (key === 'temporary') {
    return diffByKey<Profile>(list(before), list(after), window => window.from ?? '', {
      added: window => t('Thêm khung tạm {{span}}: {{windows}}', { span: spanText(window.from, window.to), windows: windowsText(window) }),
      removed: window => t('Bỏ khung tạm {{span}}: {{windows}}', { span: spanText(window.from, window.to), windows: windowsText(window) }),
      changed: (old, next) => t('Sửa khung tạm {{span}}: {{change}}', { span: spanText(old.from, old.to), change: differences(old, next) }),
    })
  }
  if (key === 'default_windows') {
    return [{ kind: 'changed', text: t('Khung mặc định của nhà: {{before}} → {{after}}', { before: windowsText(before as DayWindows | null), after: windowsText(after as DayWindows | null) }) }]
  }
  if (key === 'ring' || key === 'rings') {
    const old = ringList(before)
    const next = ringList(after)
    const lines: ChangeLine[] = []
    next.forEach((ring, index) => {
      if (!old[index]) lines.push({ kind: 'added', text: t('Thêm vòng {{n}}: {{points}} đỉnh, {{direction}}', { n: index + 1, points: ring.points.length, direction: directionText(ring) }) })
      else if (!same(old[index], ring)) lines.push({ kind: 'changed', text: t('Sửa vòng {{n}}: {{change}}', { n: index + 1, change: ringChange(old[index], ring) }) })
    })
    old.forEach((ring, index) => {
      if (!next[index]) lines.push({ kind: 'removed', text: t('Bỏ vòng {{n}}: {{points}} đỉnh', { n: index + 1, points: ring.points.length }) })
    })
    return lines
  }
  return null
}
