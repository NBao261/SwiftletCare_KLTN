import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import {
  CalendarCheck,
  CheckCircle,
  Eye,
  LockKey,
  ShieldCheck,
  Warning,
  WarningCircle,
} from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { DailyHealthStatus, DayRating } from '@/types'
import { formatDate } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

interface QueueDayRatingCardProps {
  dayRating: DayRating
  onSubmitRating: (
    houseId: string,
    date: string,
    status: DailyHealthStatus,
    note?: string
  ) => Promise<void> | void
  isSubmitting?: boolean
}

const STATUS_LABELS: Record<DailyHealthStatus, string> = {
  GOOD: 'Tốt',
  WATCH: 'Theo dõi',
  ACTION: 'Cần xử lý',
  INSUFFICIENT_DATA: 'Thiếu dữ liệu',
}

/**
 * Thẻ Đánh giá ngày độc lập theo quy tắc mù hai bước (EXPERT-FR-012, Quy tắc BR-31).
 * Che ẩn hoàn toàn hệ thống khi PENDING, mở khóa và bung thẻ đối chiếu ngay sau khi chấm.
 * Sử dụng <Card> phẳng không viền đồng bộ 100% với FARM_OWNER.
 */
export function QueueDayRatingCard({
  dayRating,
  onSubmitRating,
  isSubmitting = false,
}: QueueDayRatingCardProps) {
  const palette = usePalette()

  const [prevRatingKey, setPrevRatingKey] = useState(
    `${dayRating._id}-${dayRating.state}-${dayRating.assessor_status ?? ''}`
  )
  const [localRatedStatus, setLocalRatedStatus] = useState<DailyHealthStatus | null>(
    dayRating.assessor_status || null
  )

  const currentRatingKey = `${dayRating._id}-${dayRating.state}-${dayRating.assessor_status ?? ''}`
  if (currentRatingKey !== prevRatingKey) {
    setPrevRatingKey(currentRatingKey)
    setLocalRatedStatus(dayRating.assessor_status || null)
  }

  const effectiveRatedStatus = dayRating.assessor_status ?? localRatedStatus
  const isPending = dayRating.state === 'PENDING' && !effectiveRatedStatus
  const dateFormatted = formatDate(dayRating.date)

  // BR-31 guardrail: tuyệt đối ẩn trạng thái và lý do hệ thống khi chưa hoàn tất chấm điểm
  const revealedSystemStatus = !isPending ? dayRating.system_status : undefined
  const revealedSystemReasons = !isPending ? dayRating.system_reasons : undefined

  const handleSelectScore = async (status: DailyHealthStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    try {
      await onSubmitRating(dayRating.house_id, dayRating.date, status)
      setLocalRatedStatus(status)
    } catch {
      // Giữ nguyên trạng thái PENDING nếu API lỗi để không rò rỉ dữ liệu hệ thống (BR-31)
    }
  }

  return (
    <Card style={styles.card}>
      {/* Header thẻ: Ngày đánh giá & Badge quy tắc BR-31 */}
      <View style={styles.headerRow}>
        <View style={styles.dateRow}>
          <CalendarCheck size={16} color={palette.text} weight="bold" />
          <Text variant="heading" weight="semiBold">
            {t('Ngày {date}', { date: dateFormatted })}
          </Text>
        </View>

        <View style={[styles.ruleBadge, { backgroundColor: palette.surfaceStrong }]}>
          <ShieldCheck size={12} color={palette.textSecondary} weight="bold" />
          <Text variant="label" color={palette.textSecondary}>
            {t('Đánh giá độc lập')}
          </Text>
        </View>
      </View>

      {/* Trạng thái 1: Khi PENDING — Khóa và ẩn hoàn toàn trạng thái hệ thống */}
      {isPending ? (
        <View style={styles.pendingSection}>
          <View style={[styles.lockBox, { backgroundColor: palette.surfaceStrong }]}>
            <LockKey size={20} color={palette.textSecondary} weight="bold" />
            <Text variant="small" color={palette.textSecondary} center style={styles.lockMessage}>
              {t('Trạng thái hệ thống và chủ trại được ẩn để đảm bảo đánh giá khách quan.')}
            </Text>
          </View>

          <Text variant="small" weight="semiBold" style={styles.promptText}>
            {t('Chuyên gia đánh giá ngày này:')}
          </Text>

          <View style={styles.scoreRow}>
            {/* Nút 1: Tốt */}
            <PressableScale
              onPress={() => handleSelectScore('GOOD')}
              disabled={isSubmitting}
              style={[
                styles.scoreBtn,
                {
                  backgroundColor: palette.surfaceStrong,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Đánh giá ngày tốt')}
            >
              <CheckCircle size={16} weight="bold" color={palette.houseHealthy} />
              <Text variant="small" weight="semiBold" color={palette.houseHealthy}>
                {t('Tốt')}
              </Text>
            </PressableScale>

            {/* Nút 2: Theo dõi */}
            <PressableScale
              onPress={() => handleSelectScore('WATCH')}
              disabled={isSubmitting}
              style={[
                styles.scoreBtn,
                {
                  backgroundColor: palette.surfaceStrong,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Đánh giá ngày cần theo dõi')}
            >
              <Warning size={16} weight="bold" color={palette.alert} />
              <Text variant="small" weight="semiBold" color={palette.alert}>
                {t('Theo dõi')}
              </Text>
            </PressableScale>

            {/* Nút 3: Cần xử lý */}
            <PressableScale
              onPress={() => handleSelectScore('ACTION')}
              disabled={isSubmitting}
              style={[
                styles.scoreBtn,
                {
                  backgroundColor: palette.surfaceStrong,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Đánh giá ngày cần xử lý')}
            >
              <WarningCircle size={16} weight="bold" color={palette.deviceError} />
              <Text variant="small" weight="semiBold" color={palette.deviceError}>
                {t('Cần xử lý')}
              </Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        /* Trạng thái 2: Sau khi chấm — Bung mở đối chiếu kết quả */
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(150)}
          style={[styles.revealSection, { borderTopColor: palette.divider }]}
        >
          <View style={styles.revealHeader}>
            <Eye size={16} color={palette.text} weight="bold" />
            <Text variant="small" weight="semiBold">
              {t('Đối chiếu kết quả đánh giá & Hệ thống')}
            </Text>
          </View>

          <View style={[styles.comparisonGrid, { backgroundColor: palette.surfaceStrong }]}>
            {/* Cột Chuyên gia */}
            <View style={styles.compColumn}>
              <Text variant="small" color={palette.textSecondary}>
                {t('Chuyên gia')}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor:
                      effectiveRatedStatus === 'GOOD'
                        ? palette.primary
                        : effectiveRatedStatus === 'WATCH'
                          ? palette.alert
                          : palette.deviceError,
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="bold"
                  color={effectiveRatedStatus === 'GOOD' ? palette.onPrimary : palette.onInverse}
                >
                  {effectiveRatedStatus ? STATUS_LABELS[effectiveRatedStatus] : '--'}
                </Text>
              </View>
            </View>

            <View style={[styles.columnDivider, { backgroundColor: palette.divider }]} />

            {/* Cột Hệ thống AI */}
            <View style={styles.compColumn}>
              <Text variant="small" color={palette.textSecondary}>
                {t('Hệ thống AI')}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor:
                      revealedSystemStatus === 'GOOD'
                        ? palette.primary
                        : revealedSystemStatus === 'WATCH'
                          ? palette.alert
                          : palette.deviceError,
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="bold"
                  color={revealedSystemStatus === 'GOOD' ? palette.onPrimary : palette.onInverse}
                >
                  {revealedSystemStatus ? STATUS_LABELS[revealedSystemStatus] : '--'}
                </Text>
              </View>
            </View>
          </View>

          {/* Lý do hệ thống viễn trắc */}
          {revealedSystemReasons && revealedSystemReasons.length > 0 && (
            <View style={styles.reasonsBox}>
              <Text variant="small" weight="semiBold" color={palette.textSecondary}>
                {t('Căn cứ từ hệ thống viễn trắc:')}
              </Text>
              {revealedSystemReasons.map((r, i) => (
                <Text key={i} variant="small" color={palette.text} style={styles.reasonLine}>
                  • {r}
                </Text>
              ))}
            </View>
          )}

          {/* Ghi chú nếu có */}
          {Boolean(dayRating.note) && (
            <Text variant="small" color={palette.textSecondary} style={styles.noteLine}>
              {t('Ghi chú: {note}', { note: dayRating.note || '' })}
            </Text>
          )}
        </Animated.View>
      )}
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  pendingSection: {
    marginTop: Spacing.sm,
  },
  lockBox: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lockMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  promptText: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  scoreBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  revealSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: BorderWidth.hairline,
  },
  revealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  comparisonGrid: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  compColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  columnDivider: {
    width: BorderWidth.hairline,
    height: '100%',
  },
  statusTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  reasonsBox: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  reasonLine: {
    fontSize: 12,
    lineHeight: 16,
  },
  noteLine: {
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
})
