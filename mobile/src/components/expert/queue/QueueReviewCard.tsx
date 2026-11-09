import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import {
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
  Clock,
  SlidersHorizontal,
  User,
  Warning,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { ReviewItem } from '@/types'
import { formatTimeAgo } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

interface QueueReviewCardProps {
  item: ReviewItem
  onAccept: (itemId: string) => Promise<void> | void
  onRevert: (itemId: string) => Promise<void> | void
  isSubmitting?: boolean
}

const PARAM_LABELS: Record<string, string> = {
  temp_min: 'Nhiệt độ tối thiểu (°C)',
  temp_max: 'Nhiệt độ tối đa (°C)',
  humidity_min: 'Độ ẩm tối thiểu (%)',
  humidity_max: 'Độ ẩm tối đa (%)',
  light_max: 'Ánh sáng tối đa (lux)',
  nh3_max: 'Khí NH3 tối đa (ppm)',
  co2_max: 'Khí CO2 tối đa (ppm)',
  fuzzy_humidity_band: 'Dung sai độ ẩm (%)',
  fuzzy_temp_band: 'Dung sai nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt sấy sàn (%)',
  fuzzy_window_sec: 'Cửa sổ lọc (s)',
}

/**
 * Thẻ Kiểm duyệt thay đổi tham số của Chủ nhà.
 * Cho phép Chuyên gia Chấp thuận, Hoàn nguyên hoặc Chỉnh thêm chỉ trong 1 chạm.
 * Sử dụng <Card> phẳng không viền và <BottomSheet> đồng bộ với FARM_OWNER.
 */
export function QueueReviewCard({
  item,
  onAccept,
  onRevert,
  isSubmitting = false,
}: QueueReviewCardProps) {
  const palette = usePalette()
  const router = useRouter()
  const setZoneId = useExpertScopeStore(state => state.setZoneId)

  const [isConfirmRevertOpen, setIsConfirmRevertOpen] = useState(false)

  const changedByName = item.changed_by?.full_name || t('Chủ nhà')
  const timeStr = formatTimeAgo(item.created_at)
  const groupKey = item.group ?? item.parameter_group
  const groupLabel = groupKey === 'thresholds' ? t('Ngưỡng nhiệt ẩm') : t('Độ ẩm & Gió')

  const diffKeys = Object.keys(item.new_values || {})

  const handleAcceptPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    await onAccept(item._id)
  }

  const handleRevertConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setIsConfirmRevertOpen(false)
    await onRevert(item._id)
  }

  const handleAdjustPress = () => {
    if (item.zone_id) {
      setZoneId(item.zone_id)
    }
    router.push({
      pathname: '/(tabs)/tuning',
      params: { zoneId: item.zone_id, chip: 'thresholds' },
    })
  }

  return (
    <Card style={styles.card}>
      {/* Header thẻ: Người sửa & Nhóm tham số & Thời gian */}
      <View style={styles.headerRow}>
        <View style={styles.authorRow}>
          <User size={14} color={palette.textSecondary} />
          <Text variant="small" weight="semiBold">
            {changedByName}
          </Text>
          <View style={[styles.groupTag, { backgroundColor: palette.surfaceStrong }]}>
            <Text variant="label" color={palette.textSecondary}>
              {groupLabel}
            </Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <Clock size={12} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {timeStr}
          </Text>
        </View>
      </View>

      {/* Hộp Diff đối chiếu trực quan Giá trị cũ ➔ Giá trị mới */}
      <View style={[styles.diffBox, { backgroundColor: palette.surfaceStrong }]}>
        {diffKeys.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Không có chi tiết sai lệch')}
          </Text>
        ) : (
          diffKeys.map((key, idx) => {
            const oldVal = item.old_values?.[key] ?? '--'
            const newVal = item.new_values?.[key] ?? '--'
            const label = PARAM_LABELS[key] || key

            return (
              <View
                key={key}
                style={[
                  styles.diffRow,
                  idx < diffKeys.length - 1 && {
                    borderBottomWidth: BorderWidth.hairline,
                    borderBottomColor: palette.divider,
                  },
                ]}
              >
                <Text variant="small" weight="medium" style={styles.paramName} numberOfLines={1}>
                  {label}
                </Text>

                <View style={styles.diffValues}>
                  <Text variant="small" color={palette.textSecondary} style={styles.oldVal}>
                    {oldVal}
                  </Text>
                  <ArrowRight size={12} color={palette.textSecondary} />
                  <Text variant="small" weight="semiBold" color={palette.text} style={styles.newVal}>
                    {newVal}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* Cụm 3 nút hành động thuận tay cái: Nút phụ bên trái, nút chính [Chấp thuận] bên phải */}
      <View style={styles.actionsContainer}>
        {/* Nút 1 (Phụ bên trái): Hoàn nguyên */}
        <PressableScale
          onPress={() => setIsConfirmRevertOpen(true)}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            {
              backgroundColor: palette.surfaceStrong,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Hoàn nguyên giá trị cũ')}
        >
          <ArrowCounterClockwise size={15} color={palette.deviceError} />
          <Text variant="small" weight="semiBold" color={palette.deviceError}>
            {t('Hoàn nguyên')}
          </Text>
        </PressableScale>

        {/* Nút 2 (Phụ bên trái): Chỉnh thêm */}
        <PressableScale
          onPress={handleAdjustPress}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            {
              backgroundColor: palette.surfaceStrong,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Chỉnh thêm trên tab tham số')}
        >
          <SlidersHorizontal size={15} color={palette.text} />
          <Text variant="small" weight="semiBold" color={palette.text}>
            {t('Chỉnh thêm')}
          </Text>
        </PressableScale>

        {/* Nút 3 (Chính bên phải - thuận tay cái): Chấp thuận */}
        <PressableScale
          onPress={handleAcceptPress}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            styles.primaryButton,
            {
              backgroundColor: palette.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Chấp thuận thay đổi này')}
        >
          <CheckCircle size={16} weight="bold" color={palette.onPrimary} />
          <Text variant="small" weight="semiBold" color={palette.onPrimary}>
            {t('Chấp thuận')}
          </Text>
        </PressableScale>
      </View>

      {/* BottomSheet xác nhận Hoàn nguyên đồng bộ với toàn app */}
      <BottomSheet
        visible={isConfirmRevertOpen}
        onClose={() => setIsConfirmRevertOpen(false)}
      >
        <View style={styles.sheetHeaderRow}>
          <Warning size={20} color={palette.deviceError} weight="bold" />
          <Text variant="heading" weight="semiBold">
            {t('Xác nhận hoàn nguyên?')}
          </Text>
        </View>
        <Text variant="body" color={palette.textSecondary}>
          {t(
            'Hệ thống sẽ đặt lại toàn bộ tham số của tầng về giá trị an toàn trước khi chủ trại chỉnh sửa.'
          )}
        </Text>

        <View style={styles.sheetButtons}>
          <Button
            label={t('Hủy')}
            variant="secondary"
            onPress={() => setIsConfirmRevertOpen(false)}
            style={styles.sheetBtn}
          />
          <Button
            label={t('Hoàn nguyên ngay')}
            variant="primary"
            onPress={handleRevertConfirm}
            style={styles.sheetBtn}
          />
        </View>
      </BottomSheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    gap: 0,
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  groupTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginLeft: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  diffBox: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  paramName: {
    flex: 1,
  },
  diffValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  oldVal: {
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  newVal: {
    fontVariant: ['tabular-nums'],
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  primaryButton: {
    flex: 1.25,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sheetBtn: {
    flex: 1,
  },
})
