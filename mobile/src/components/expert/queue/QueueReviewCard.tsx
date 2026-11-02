import React, { useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
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
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Colors, Radius, Spacing } from '@/constants/theme'
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
  fuzzy_humidity_band: 'Dải dung sai độ ẩm (%)',
  fuzzy_temp_band: 'Dải dung sai nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt sấy sàn (%)',
  fuzzy_window_sec: 'Cửa sổ trượt Fuzzy (s)',
}

/**
 * Thẻ Kiểm duyệt thay đổi tham số của Chủ trại (EXPERT-FR-010, SRS §6.10).
 * Cho phép Chuyên gia Chấp thuận, Hoàn nguyên hoặc Hiệu chỉnh chỉ trong 1 chạm.
 * Sử dụng <Card> và <PressableScale> chuẩn hóa đồng bộ với FARM_OWNER.
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

  const changedByName = item.changed_by?.full_name || t('Chủ nhà yến')
  const timeStr = formatTimeAgo(item.created_at)
  const groupLabel = item.parameter_group === 'thresholds' ? t('Ngưỡng an toàn') : t('Hệ số Fuzzy')

  // Danh sách các cặp tham số thay đổi
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    if (item.zone_id) {
      setZoneId(item.zone_id)
    }
    router.push('/(tabs)/tuning')
  }

  return (
    <Card
      style={[
        styles.card,
        { borderColor: palette.border, borderWidth: 1 },
      ]}
    >
      {/* Header thẻ: Người sửa & Nhóm tham số & Thời gian */}
      <View style={styles.headerRow}>
        <View style={styles.authorRow}>
          <User size={14} color={palette.textSecondary} />
          <Text variant="small" weight="bold">
            {changedByName}
          </Text>
          <View style={[styles.groupTag, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
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
      <View style={[styles.diffBox, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
        {diffKeys.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Không có chi tiết sai lệch')}
          </Text>
        ) : (
          diffKeys.map(key => {
            const oldVal = item.old_values?.[key] ?? '--'
            const newVal = item.new_values?.[key] ?? '--'
            const label = PARAM_LABELS[key] || key

            return (
              <View key={key} style={styles.diffRow}>
                <Text variant="small" weight="medium" style={styles.paramName} numberOfLines={1}>
                  {label}:
                </Text>

                <View style={styles.diffValues}>
                  <Text variant="small" color={palette.textSecondary} style={styles.oldVal}>
                    {oldVal}
                  </Text>
                  <ArrowRight size={12} color={palette.textSecondary} />
                  <Text variant="small" weight="bold" color={palette.text} style={styles.newVal}>
                    {newVal}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* Cụm 3 nút hành động 1 chạm chuẩn công thái học 44pt */}
      <View style={styles.actionsContainer}>
        {/* Nút 1: Chấp thuận */}
        <PressableScale
          onPress={handleAcceptPress}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            {
              backgroundColor: palette.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Chấp thuận thay đổi này')}
        >
          <CheckCircle size={16} weight="bold" color={palette.onPrimary} />
          <Text variant="small" weight="bold" color={palette.onPrimary}>
            {t('Chấp thuận')}
          </Text>
        </PressableScale>

        {/* Nút 2: Hoàn nguyên */}
        <PressableScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
            setIsConfirmRevertOpen(true)
          }}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            styles.outlinedButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Hoàn nguyên giá trị cũ')}
        >
          <ArrowCounterClockwise size={16} color={Colors.light.deviceError} />
          <Text variant="small" weight="bold" color={Colors.light.deviceError}>
            {t('Hoàn nguyên')}
          </Text>
        </PressableScale>

        {/* Nút 3: Hiệu chỉnh */}
        <PressableScale
          onPress={handleAdjustPress}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            styles.outlinedButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Hiệu chỉnh trên tab tham số')}
        >
          <SlidersHorizontal size={16} color={palette.text} />
          <Text variant="small" weight="bold" color={palette.text}>
            {t('Hiệu chỉnh')}
          </Text>
        </PressableScale>
      </View>

      {/* Modal xác nhận Hoàn nguyên nhanh */}
      <Modal
        visible={isConfirmRevertOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfirmRevertOpen(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: palette.secondary }]}>
          <View style={[styles.modalContent, { backgroundColor: palette.surface }]}>
            <View style={styles.modalTitleRow}>
              <Warning size={20} color={Colors.light.deviceError} weight="bold" />
              <Text variant="heading" weight="bold">
                {t('Xác nhận hoàn nguyên?')}
              </Text>
            </View>
            <Text variant="body" color={palette.textSecondary} style={{ marginTop: Spacing.xs }}>
              {t(
                'Hệ thống sẽ đặt lại toàn bộ tham số của Zone về giá trị an toàn trước khi Chủ trại chỉnh sửa.'
              )}
            </Text>

            <View style={styles.modalButtons}>
              <PressableScale
                onPress={() => setIsConfirmRevertOpen(false)}
                style={[styles.modalBtn, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
              >
                <Text variant="body" weight="medium">
                  {t('Hủy')}
                </Text>
              </PressableScale>
              <PressableScale
                onPress={handleRevertConfirm}
                style={[styles.modalBtn, { backgroundColor: Colors.light.deviceError }]}
              >
                <Text variant="body" weight="bold" color={palette.onInverse}>
                  {t('Hoàn nguyên ngay')}
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    gap: 0,
    elevation: 0,
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
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginLeft: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  diffBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  newVal: {},
  actionsContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
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
  outlinedButton: {
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
})
