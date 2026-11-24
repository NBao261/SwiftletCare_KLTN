import { ROSTER_DAY_LABEL, ROSTER_ROLE_LABEL } from '@/components/features/farm-owner/farms/farmStructure.constants'
import type { FarmKey } from '@/constants/farmStructure.i18n'
import { isOvernightShift, WEEK_ORDER } from '@/validations/farm-owner/roster.validation'
import type { RosterShift } from '@/types'

// mỗi ca của kỹ thuật viên một dòng: các ngày (thứ Hai trước) · giờ (kèm "qua đêm") · loại ca
export function ownShiftLines(shifts: RosterShift[], t: (key: FarmKey) => string): string[] {
  return shifts.map(shift => {
    const days = WEEK_ORDER.filter(day => shift.weekdays.includes(day)).map(day => t(ROSTER_DAY_LABEL[day])).join(', ')
    const overnight = isOvernightShift(shift) ? ` (${t('roster.overnight')})` : ''
    return `${days} · ${shift.start}–${shift.end}${overnight} · ${t(ROSTER_ROLE_LABEL[shift.role])}`
  })
}
