import React, { useCallback, useMemo } from 'react'
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Minus, Plus } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { FontFamily, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

export interface StepperInputProps {
  label: string
  value: number
  onChange: (val: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  defaultValue?: number
  decimals?: number
  disabled?: boolean
  isBreached?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Component StepperInput nguyên tử dùng chung (TC-07, BR-01, BR-02, BR-05, BR-09).
 * - Hiển thị nhãn tiếng Việt, đơn vị đo, giá trị hiện tại ở giữa dùng FontFamily.bold với fontVariant: ['tabular-nums'].
 * - Hai nút [-] và [+] đạt chuẩn công thái học (min 44x44pt), tự động khóa khi chạm min/max, rung xúc giác nhẹ qua expo-haptics.
 * - Tích hợp thanh hiển thị dải chuẩn trực quan (Visual Range Bar) kèm dòng metadata Dải cho phép: min - max | Mặc định: default.
 * - 100% màu sắc qua usePalette() và Colors.light.* (0 mã hex thô).
 */
export function StepperInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue,
  decimals,
  disabled = false,
  isBreached = false,
  style,
}: StepperInputProps) {
  const palette = usePalette()

  // Xác định số chữ số thập phân tự động hoặc theo prop
  const precision = useMemo(() => {
    if (decimals !== undefined) return decimals
    const stepStr = step.toString()
    if (stepStr.includes('.')) {
      return stepStr.split('.')[1].length
    }
    return 0
  }, [decimals, step])

  const canDecrease = !disabled && value > min
  const canIncrease = !disabled && value < max

  const handleDecrease = useCallback(() => {
    if (!canDecrease) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    const nextVal = Math.max(min, Number((value - step).toFixed(precision)))
    onChange(nextVal)
  }, [canDecrease, min, onChange, precision, step, value])

  const handleIncrease = useCallback(() => {
    if (!canIncrease) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    const nextVal = Math.min(max, Number((value + step).toFixed(precision)))
    onChange(nextVal)
  }, [canIncrease, max, onChange, precision, step, value])

  // Tỷ lệ phần trăm trong dải min - max cho thanh trực quan
  const rangePct = useMemo(() => {
    if (max <= min) return 0
    const clamped = Math.max(min, Math.min(max, value))
    return ((clamped - min) / (max - min)) * 100
  }, [max, min, value])

  const defaultPct = useMemo(() => {
    if (defaultValue === undefined || max <= min) return null
    const clamped = Math.max(min, Math.min(max, defaultValue))
    return ((clamped - min) / (max - min)) * 100
  }, [defaultValue, max, min])

  const formattedValue = value.toFixed(precision)
  const defaultText = defaultValue !== undefined ? ` | Mặc định: ${defaultValue.toFixed(precision)} ${unit}`.trimEnd() : ''

  return (
    <View style={[styles.container, style]}>
      {/* Hàng 1: Nhãn tham số & Đơn vị tóm tắt */}
      <View style={styles.headerRow}>
        <Text variant="body" weight="semiBold" color={palette.text} style={styles.label}>
          {label}
        </Text>
        {unit ? (
          <Text variant="small" color={palette.textSecondary}>
            ({unit})
          </Text>
        ) : null}
      </View>

      {/* Hàng 2: Bộ Stepper [-] [ Giá trị ] [+] */}
      <View
        style={[
          styles.stepperBox,
          {
            backgroundColor: palette.surfaceStrong,
            borderColor: isBreached ? palette.alert : 'transparent',
            borderWidth: isBreached ? 1 : 0,
          },
        ]}
      >
        {/* Nút giảm [-] */}
        <PressableScale
          onPress={handleDecrease}
          disabled={!canDecrease}
          style={[
            styles.stepButton,
            {
              backgroundColor: canDecrease ? palette.surface : palette.surfaceStrong,
              opacity: canDecrease ? 1 : 0.4,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Giảm ${label}`}
        >
          <Minus size={18} color={canDecrease ? palette.text : palette.textSecondary} weight="bold" />
        </PressableScale>

        {/* Khối hiển thị giá trị trung tâm */}
        <View style={styles.valueContainer}>
          <Text
            style={[
              styles.valueText,
              {
                color: isBreached ? palette.alert : palette.text,
              },
            ]}
          >
            {formattedValue}
          </Text>
          {unit ? (
            <Text variant="small" color={palette.textSecondary} style={styles.unitText}>
              {unit}
            </Text>
          ) : null}
        </View>

        {/* Nút tăng [+] */}
        <PressableScale
          onPress={handleIncrease}
          disabled={!canIncrease}
          style={[
            styles.stepButton,
            {
              backgroundColor: canIncrease ? palette.surface : palette.surfaceStrong,
              opacity: canIncrease ? 1 : 0.4,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Tăng ${label}`}
        >
          <Plus size={18} color={canIncrease ? palette.text : palette.textSecondary} weight="bold" />
        </PressableScale>
      </View>

      {/* Hàng 3: Thanh hiển thị dải chuẩn trực quan (Visual Range Bar) */}
      <View style={styles.rangeBarWrapper}>
        <View
          style={[
            styles.rangeTrack,
            {
              backgroundColor: palette.divider,
            },
          ]}
        >
          {/* Thanh tiến trình giá trị hiện tại */}
          <View
            style={[
              styles.rangeFill,
              {
                width: `${rangePct}%`,
                backgroundColor: isBreached ? palette.alert : palette.houseHealthy,
              },
            ]}
          />

          {/* Điểm neo giá trị mặc định nếu có */}
          {defaultPct !== null ? (
            <View
              style={[
                styles.defaultMarker,
                {
                  left: `${defaultPct}%`,
                  backgroundColor: palette.text,
                },
              ]}
            />
          ) : null}
        </View>

        {/* Dòng metadata phụ min - max | default */}
        <Text variant="small" color={palette.textSecondary} style={styles.metadataText}>
          {`Dải cho phép: ${min.toFixed(precision)} – ${max.toFixed(precision)} ${unit}${defaultText}`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    flex: 1,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },
  stepButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
  },
  valueText: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    fontFamily: FontFamily.medium,
  },
  rangeBarWrapper: {
    marginTop: 6,
    gap: 4,
  },
  rangeTrack: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  rangeFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  defaultMarker: {
    position: 'absolute',
    width: 2,
    height: 8,
    borderRadius: 1,
    marginLeft: -1,
  },
  metadataText: {
    fontSize: 11,
    lineHeight: 14,
  },
})
