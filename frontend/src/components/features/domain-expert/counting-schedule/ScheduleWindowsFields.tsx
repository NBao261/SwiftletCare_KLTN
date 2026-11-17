import { TimePicker } from '@/components/ui'
import { countingScheduleDict } from '@/constants/countingSchedule.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import type { DayWindows, TimeWindow } from '@/types/expert.types'

interface Props {
  // Tiền tố id cho các ô, để nhãn trỏ đúng ô
  idPrefix: string
  value: DayWindows
  disabled?: boolean
  onChange: (value: DayWindows) => void
}

// VISION-FR-019 — giờ bắt đầu và kết thúc của phiên sáng và phiên chiều (giờ VN, ô giờ TimePicker của design system)
export default function ScheduleWindowsFields({ idPrefix, value, disabled, onChange }: Props) {
  const { t } = useTranslation(countingScheduleDict)
  const setTime = (session: keyof DayWindows, edge: keyof TimeWindow, time: string) =>
    onChange({ ...value, [session]: { ...value[session], [edge]: time } })

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(['morning', 'evening'] as const).map(session => (
        (['start', 'end'] as const).map(edge => (
          <TimePicker
            key={`${session}-${edge}`}
            id={`${idPrefix}-${session}-${edge}`}
            label={t(`window.${session}.${edge}`)}
            value={value[session][edge]}
            disabled={disabled}
            onChange={time => setTime(session, edge, time)}
          />
        ))
      ))}
    </div>
  )
}
