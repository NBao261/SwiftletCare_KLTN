import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { CaretDownIcon } from 'phosphor-react-native'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import type { AlertsScope } from '@/hooks/alert/useAlertsScope'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertType } from '@/types'
import type { VerdictFilter } from '@/utils/alertList.utils'
import { getAlertTypeLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

// Giá trị "Tất cả" trong bảng chọn
const ALL = '__all__'

const ALERT_TYPES: AlertType[] = [
  'RS485_BUS_FAILURE',
  'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE',
  'NODE_OFFLINE',
  'ACTUATOR_FAULT',
  'THRESHOLD_BREACH',
  'CONFIG_MISMATCH',
  'NOISE_ANOMALY',
  'SENSOR_FAULT',
  'SENSOR_ANOMALY',
  'MISTING_INEFFECTIVE',
  'EDGE_AI_DEGRADED',
  'LOW_RETURN_RATE',
  'FORECAST_BREACH',
  'MAINTENANCE_DUE',
]

function getVerdictLabel(verdict: VerdictFilter): string {
  if (verdict === 'pending') return t('Chờ phán quyết')
  if (verdict === 'confirmed') return t('Đã xác nhận đúng')
  return t('Đã bác bỏ')
}

type OpenSheet = 'zone' | 'type' | 'verdict' | null

interface AlertFilterChipsProps {
  scope: AlertsScope
}

// Bộ lọc phụ thu gọn thành chip Tầng ▾ · Loại ▾ · Phán quyết ▾ (đặc tả §2.4), chạm thì mở bảng chọn; đang lọc thì có "Xoá lọc"
export function AlertFilterChips({ scope }: AlertFilterChipsProps) {
  const palette = usePalette()
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null)
  const zoneName = scope.zones.find(zone => zone._id === scope.zoneId)?.name
  const hasFilter = Boolean(scope.zoneId || scope.type || scope.verdict || scope.severity)

  const chips: { id: Exclude<OpenSheet, null>; label: string; isActive: boolean; isVisible: boolean }[] = [
    {
      id: 'zone',
      label: zoneName ?? t('Tất cả tầng'),
      isActive: Boolean(scope.zoneId),
      // Chỉ lọc tầng khi đang xem một nhà có từ 2 tầng
      isVisible: Boolean(scope.house) && scope.zones.length > 1,
    },
    {
      id: 'type',
      label: scope.type ? getAlertTypeLabel(scope.type) : t('Loại'),
      isActive: Boolean(scope.type),
      isVisible: true,
    },
    {
      id: 'verdict',
      label: scope.verdict ? getVerdictLabel(scope.verdict) : t('Phán quyết'),
      isActive: Boolean(scope.verdict),
      isVisible: true,
    },
  ]

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips
          .filter(chip => chip.isVisible)
          .map(chip => (
            <Pressable
              key={chip.id}
              onPress={() => setOpenSheet(chip.id)}
              style={[styles.chip, { backgroundColor: chip.isActive ? palette.inverse : palette.surface }]}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
            >
              <Text
                variant="body"
                weight="semiBold"
                color={chip.isActive ? palette.onInverse : palette.text}
                numberOfLines={1}
              >
                {chip.label}
              </Text>
              <CaretDownIcon size={14} color={chip.isActive ? palette.onInverse : palette.text} weight="bold" />
            </Pressable>
          ))}
        {hasFilter && <Button label={t('Xoá lọc')} variant="link" onPress={scope.clearFilters} />}
      </ScrollView>

      <OptionSheet
        visible={openSheet === 'zone'}
        title={t('Chọn tầng')}
        options={[
          { id: ALL, label: t('Tất cả tầng') },
          ...scope.zones.map(zone => ({ id: zone._id, label: zone.name })),
        ]}
        selectedId={scope.zoneId ?? ALL}
        onSelect={id => {
          setOpenSheet(null)
          scope.selectZone(id === ALL ? null : id)
        }}
        onClose={() => setOpenSheet(null)}
      />
      <OptionSheet
        visible={openSheet === 'type'}
        title={t('Loại cảnh báo')}
        options={[
          { id: ALL, label: t('Tất cả loại') },
          ...ALERT_TYPES.map(type => ({ id: type, label: getAlertTypeLabel(type) })),
        ]}
        selectedId={scope.type ?? ALL}
        onSelect={id => {
          setOpenSheet(null)
          scope.selectType(id === ALL ? null : (id as AlertType))
        }}
        onClose={() => setOpenSheet(null)}
      />
      <OptionSheet
        visible={openSheet === 'verdict'}
        title={t('Phán quyết (cảnh báo suy luận)')}
        options={[
          { id: ALL, label: t('Tất cả') },
          ...(['pending', 'confirmed', 'rejected'] as const).map(verdict => ({
            id: verdict,
            label: getVerdictLabel(verdict),
          })),
        ]}
        selectedId={scope.verdict ?? ALL}
        onSelect={id => {
          setOpenSheet(null)
          scope.selectVerdict(id === ALL ? null : (id as VerdictFilter))
        }}
        onClose={() => setOpenSheet(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
})
