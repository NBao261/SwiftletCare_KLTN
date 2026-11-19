import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { WeatherMetric, WeatherRule } from '@/types'
import { getWeatherMetricLabel } from '@/utils/label.utils'
import {
  formatRuleRange,
  parseNumberInput,
  toInputText,
  validateWeatherRuleDraft,
  WEATHER_DURATION_RULE,
  WEATHER_METRIC_RULES,
  WEATHER_OFFSET_RULE,
  type WeatherRuleDraft,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const WEATHER_METRICS: readonly WeatherMetric[] = ['temperature', 'humidity', 'rain']
// Luật mới mặc định bù 60 phút, cùng giá trị với form thêm luật trên web (WeatherRuleAddForm)
const DEFAULT_DURATION_MIN = 60

interface WeatherRuleSheetProps {
  // null: thêm luật mới
  initial: WeatherRule | null
  onSubmit: (rule: WeatherRule) => void
  // Chỉ có khi sửa luật đã có
  onDelete?: () => void
  onClose: () => void
}

// Sheet nhập một luật bù thời tiết (ENV-FR-030, BR-38): chỉ số dự báo, ngưỡng, điểm % cộng vào mức phun (âm là giảm), thời hạn,
// bật / tắt. "Xong" chỉ đổi bản nháp của mục; lưu cả danh sách ở nút Cập nhật của mục
export function WeatherRuleSheet({ initial, onSubmit, onDelete, onClose }: WeatherRuleSheetProps) {
  const palette = usePalette()
  const [draft, setDraft] = useState<WeatherRuleDraft>(() => ({
    metric: initial?.metric ?? 'temperature',
    min: toInputText(initial?.min),
    offset: toInputText(initial?.offset_pct),
    duration: toInputText(initial?.duration_min ?? DEFAULT_DURATION_MIN),
  }))
  const [isActive, setActive] = useState(initial?.active ?? true)
  const errors = validateWeatherRuleDraft(draft)
  const hasErrors = Object.keys(errors).length > 0
  const { label: metricLabel, unit } = getWeatherMetricLabel(draft.metric)

  const change = (field: keyof WeatherRuleDraft, value: string) => setDraft(current => ({ ...current, [field]: value }))

  const submit = () => {
    if (hasErrors) return
    onSubmit({
      ...(initial?._id ? { _id: initial._id } : {}),
      metric: draft.metric,
      min: parseNumberInput(draft.min) as number,
      offset_pct: parseNumberInput(draft.offset) as number,
      duration_min: parseNumberInput(draft.duration) as number,
      active: isActive,
    })
  }

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading">{initial ? t('Sửa luật bù thời tiết') : t('Thêm luật bù thời tiết')}</Text>
      <View style={styles.field}>
        <Text variant="small" weight="semiBold" color={palette.textSecondary}>
          {t('Khi dự báo 2 giờ tới')}
        </Text>
        <ChoiceChips
          options={WEATHER_METRICS.map(metric => ({ id: metric, label: getWeatherMetricLabel(metric).label }))}
          selectedId={draft.metric}
          onSelect={metric => change('metric', metric)}
          placement="card"
          accessibilityLabel={t('Chọn chỉ số dự báo')}
        />
      </View>
      <TextField
        label={t('{metric} từ ({unit}, {range})', {
          metric: metricLabel,
          unit,
          range: formatRuleRange(WEATHER_METRIC_RULES[draft.metric]),
        })}
        value={draft.min}
        onChangeText={value => change('min', value)}
        keyboardType="decimal-pad"
        error={draft.min ? errors.min : null}
      />
      <TextField
        label={t('Điểm % cộng vào mức phun, âm là giảm ({range})', { range: formatRuleRange(WEATHER_OFFSET_RULE) })}
        value={draft.offset}
        onChangeText={value => change('offset', value)}
        keyboardType="numbers-and-punctuation"
        error={draft.offset ? errors.offset : null}
      />
      <TextField
        label={t('Thời hạn mỗi lần bù (phút, {range})', { range: formatRuleRange(WEATHER_DURATION_RULE) })}
        value={draft.duration}
        onChangeText={value => change('duration', value)}
        keyboardType="number-pad"
        error={draft.duration ? errors.duration : null}
      />
      <View style={styles.switchRow}>
        <Text variant="body" style={styles.flex}>
          {t('Đang dùng luật này')}
        </Text>
        <Switch value={isActive} onValueChange={setActive} accessibilityLabel={t('Đang dùng luật này')} />
      </View>
      <Button label={t('Xong')} onPress={submit} disabled={hasErrors} />
      {onDelete && <Button label={t('Xoá luật')} variant="link" color={palette.alert} onPress={onDelete} style={styles.center} />}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
})
