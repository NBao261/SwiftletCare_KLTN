import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { DotsThreeVerticalIcon, GearSixIcon, PencilSimpleIcon } from 'phosphor-react-native'
import { ActionMenuSheet, type MenuAction } from '@/components/farm/ActionMenuSheet'
import { CollapsibleSection } from '@/components/farm/CollapsibleSection'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { DetectionTuning, FuzzyTuning, House, Zone } from '@/types'
import { getDetectionTuningLabel, getFuzzyTuningLabel, getMetricLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { formatThresholdRange } from '@/utils/sensorTile.utils'
import { SETTINGS_SECTION_EDIT_ACTION, type SettingsSectionKind } from '@/utils/settingsSection.utils'
import { formatStoredNumber } from '@/utils/settingsValidation.utils'
import type { ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

const THRESHOLD_METRICS: ThresholdMetric[] = ['temperature', 'humidity', 'light', 'nh3', 'co2']
const FUZZY_KEYS: (keyof FuzzyTuning)[] = [
  'fuzzy_humidity_band',
  'fuzzy_temp_band',
  'fuzzy_fan_dry_level',
  'fuzzy_window_sec',
  'fuzzy_input_filter',
]
const DETECTION_KEYS: (keyof DetectionTuning)[] = [
  'noise_margin_db',
  'noise_min_sec',
  'pump_dry_on_sec',
  'pump_dry_min_rise_pct',
  'speaker_drop_pct',
]

interface SettingRow {
  label: string
  value: string
  // Backend chưa có API: dòng ghi "Sắp có" màu phụ
  isComingSoon?: boolean
}

interface SettingGroupData {
  kind: SettingsSectionKind
  title: string
  rows: SettingRow[]
}

interface ZoneSettingsSectionProps {
  zone: Zone
  house: House
  // Mở Cài đặt nhà ở đúng mục; isEditing: mở sẵn chế độ sửa
  onOpenSettings: (kind: SettingsSectionKind, isEditing: boolean) => void
}

// Giá trị đúng như backend trả kèm đơn vị; bật/tắt ghi chữ; thiếu thì "_"
function formatSetting(value: number | boolean | undefined, unit: string): string {
  if (value === undefined) return '_'
  if (typeof value === 'boolean') return value ? t('Bật') : t('Tắt')
  return `${formatStoredNumber(value)}${unit}`
}

// Một nhóm: tên nhóm và nút ⋮ ở góc phải, dưới là các dòng tên – giá trị
function SettingGroup({ group, onMenu }: { group: SettingGroupData; onMenu: () => void }) {
  const palette = usePalette()
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {group.title}
        </Text>
        <IconButton
          icon={DotsThreeVerticalIcon}
          label={t('Thao tác với {section}', { section: group.title })}
          onPress={onMenu}
        />
      </View>
      {group.rows.map(row => (
        <View key={row.label} style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
          <Text variant="small" color={palette.textSecondary} style={styles.flex}>
            {row.label}
          </Text>
          <Text
            variant="small"
            weight={row.isComingSoon ? 'regular' : 'semiBold'}
            color={row.isComingSoon ? palette.textSecondary : palette.text}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

// Khối "Cài đặt zone" ở chi tiết nhà (thu gọn mặc định) để xem nhanh: ngưỡng (ENV-FR-006), hệ số bộ điều khiển mờ
// (ENV-FR-021), tham số phát hiện của zone và mức giảm tỷ lệ về tổ của nhà (EXPERT-FR-008) — mọi số lấy đúng từ backend.
// Nút ⋮ của từng nhóm: "Chỉnh sửa" mở Cài đặt nhà đúng mục đó, mở sẵn chế độ sửa; không có quyền thì chỉ "Xem trong Cài đặt nhà"
export function ZoneSettingsSection({ zone, house, onOpenSettings }: ZoneSettingsSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const [menuGroup, setMenuGroup] = useState<SettingGroupData | null>(null)

  const groups: SettingGroupData[] = [
    {
      kind: 'thresholds',
      title: t('Ngưỡng'),
      rows: THRESHOLD_METRICS.map(metric => ({
        label: getMetricLabel(metric),
        value: formatThresholdRange(metric, zone.thresholds) ?? '_',
      })),
    },
    {
      kind: 'fuzzy',
      title: t('Hệ số bộ điều khiển mờ'),
      rows: FUZZY_KEYS.map(key => {
        const { label, unit } = getFuzzyTuningLabel(key)
        return { label, value: formatSetting(zone.fuzzy_tuning?.[key], unit) }
      }),
    },
    {
      kind: 'detection',
      title: t('Tham số phát hiện'),
      rows: DETECTION_KEYS.map(key => {
        const { label, unit } = getDetectionTuningLabel(key)
        return { label, value: formatSetting(zone.detection_tuning?.[key], unit) }
      }),
    },
    {
      kind: 'bird-count',
      title: t('Mức giảm tỷ lệ về tổ (cả nhà)'),
      rows: [
        { label: t('Tỷ lệ về tổ giảm'), value: formatSetting(house.bird_count_tuning?.return_rate_drop_pct, '%') },
        // Lịch đếm chim theo mùa (VISION-FR-019) backend chưa có API
        { label: t('Lịch đếm chim'), value: t('Sắp có'), isComingSoon: true },
      ],
    },
  ]

  const getMenuActions = (group: SettingGroupData): MenuAction[] => {
    const canEdit = canPerform(user, SETTINGS_SECTION_EDIT_ACTION[group.kind])
    if (canEdit) {
      return [
        {
          icon: PencilSimpleIcon,
          label: t('Chỉnh sửa'),
          caption: t('Mở Cài đặt nhà, mục này mở sẵn để sửa'),
          onPress: () => onOpenSettings(group.kind, true),
        },
      ]
    }
    return [
      {
        icon: GearSixIcon,
        label: t('Xem trong Cài đặt nhà'),
        // Trong app chỉ gặp ở tham số phát hiện và mức giảm tỷ lệ về tổ với chủ trại
        caption: t('Chỉ chuyên gia sửa được'),
        onPress: () => onOpenSettings(group.kind, false),
      },
    ]
  }

  return (
    <CollapsibleSection title={t('Cài đặt zone')} caption={zone.name}>
      {groups.map((group, index) => (
        <View
          key={group.kind}
          style={index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }}
        >
          <SettingGroup group={group} onMenu={() => setMenuGroup(group)} />
        </View>
      ))}
      <ActionMenuSheet
        visible={menuGroup !== null}
        title={menuGroup?.title ?? ''}
        actions={menuGroup ? getMenuActions(menuGroup) : []}
        onClose={() => setMenuGroup(null)}
      />
    </CollapsibleSection>
  )
}

const styles = StyleSheet.create({
  group: { gap: Spacing.xs, paddingTop: Spacing.xs },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
})
