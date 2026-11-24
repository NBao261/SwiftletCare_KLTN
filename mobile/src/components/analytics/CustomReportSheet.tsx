import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useCreateHealthReport } from '@/hooks/analytics/useCreateHealthReport'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HouseHealthReport } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { getVietnamDate } from '@/utils/date.utils'
import { formatHealthDate, shiftDate } from '@/utils/healthDay.utils'
import { countDaysInclusive, validateCustomReportRange } from '@/utils/healthReport.utils'
import { t } from '@/utils/i18n.utils'

// Khoảng mặc định khi mở: 7 ngày gần nhất
const DEFAULT_RANGE_DAYS = 7

interface CustomReportSheetProps {
  visible: boolean
  houseId: string
  onClose: () => void
  onCreated: (report: HouseHealthReport) => void
}

interface DateStepperProps {
  label: string
  date: string
  onChange: (date: string) => void
  canGoForward: boolean
}

// Một ngày chọn bằng nút lùi / tiến từng ngày (app chưa có thư viện lịch)
function DateStepper({ label, date, onChange, canGoForward }: DateStepperProps) {
  const palette = usePalette()

  return (
    <View style={styles.stepper}>
      <Text variant="body" color={palette.textSecondary} style={styles.flex}>
        {label}
      </Text>
      <IconButton icon={CaretLeftIcon} label={t('{label}: lùi 1 ngày', { label })} onPress={() => onChange(shiftDate(date, -1))} />
      <Text variant="body" weight="semiBold" style={styles.date}>
        {formatHealthDate(date)}
      </Text>
      {/* Không tiến được (đã tới ngày cuối / hôm nay) thì nút bị khoá */}
      <IconButton
        icon={CaretRightIcon}
        label={t('{label}: tới 1 ngày', { label })}
        onPress={canGoForward ? () => onChange(shiftDate(date, 1)) : undefined}
      />
    </View>
  )
}

// Tạo báo cáo theo yêu cầu cho 1 nhà, tối đa 31 ngày, ngày cuối không sau hôm nay (EXPERT-FR-005, POST /health-reports)
export function CustomReportSheet({ visible, houseId, onClose, onCreated }: CustomReportSheetProps) {
  const palette = usePalette()
  const createReport = useCreateHealthReport()
  const today = getVietnamDate()
  const [from, setFrom] = useState(() => shiftDate(today, 1 - DEFAULT_RANGE_DAYS))
  const [to, setTo] = useState(today)
  const rangeError = validateCustomReportRange(from, to, today)

  const handleCreate = () => {
    if (rangeError) return
    createReport.mutate({ houseId, from, to }, { onSuccess: onCreated })
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">{t('Báo cáo theo yêu cầu')}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {t('Chọn khoảng tối đa 31 ngày. Báo cáo được lưu vào danh sách "Theo yêu cầu"; ngày bạn chưa đánh giá vẫn bị ẩn.')}
      </Text>
      <DateStepper label={t('Từ ngày')} date={from} onChange={setFrom} canGoForward={from < to} />
      <DateStepper label={t('Đến ngày')} date={to} onChange={setTo} canGoForward={to < today} />
      <Text variant="small" color={palette.textSecondary}>
        {t('{count} ngày', { count: Math.max(0, countDaysInclusive(from, to)) })}
      </Text>
      <FormMessage message={rangeError ?? (createReport.error ? getSettingsErrorMessage(createReport.error) : null)} />
      <Button label={t('Tạo báo cáo')} onPress={handleCreate} disabled={Boolean(rangeError)} loading={createReport.isPending} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  date: { minWidth: 56, textAlign: 'center' },
})
