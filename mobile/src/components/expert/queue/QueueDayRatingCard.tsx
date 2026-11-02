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
import { Colors, Radius, Spacing } from '@/constants/theme'
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
 * Sử dụng <Card> và <PressableScale> chuẩn hóa đồng bộ với FARM_OWNER.
 */
export function QueueDayRatingCard({
  dayRating,
  onSubmitRating,
  isSubmitting = false,
}: QueueDayRatingCardProps) {
  const palette = usePalette()

  // Trạng thái local cho phép reveal ngay cả trước khi refetch hoàn tất
  const [localRatedStatus, setLocalRatedStatus] = useState<DailyHealthStatus | null>(
    dayRating.assessor_status || null
  )

  const isPending = dayRating.state === 'PENDING' && !localRatedStatus
  const dateFormatted = formatDate(dayRating.date)

  const handleSelectScore = async (status: DailyHealthStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setLocalRatedStatus(status)
    await onSubmitRating(dayRating.house_id, dayRating.date, status)
  }

  return (
    <Card
      style={[
        styles.card,
        { borderColor: palette.border, borderWidth: 1 },
      ]}
    >
      {/* Header thẻ: Ngày đánh giá & Badge quy tắc BR-31 */}
      <View style={styles.headerRow}>
        <View style={styles.dateRow}>
          <CalendarCheck size={16} color={palette.text} weight="bold" />
          <Text variant="heading" weight="bold">
            {t('Ngày {date}', { date: dateFormatted })}
          </Text>
        </View>

        <View
          style={[
            styles.ruleBadge,
            { backgroundColor: palette.surfaceStrong, borderColor: palette.border },
          ]}
        >
          <ShieldCheck size={12} color={palette.textSecondary} weight="bold" />
          <Text variant="label" color={palette.textSecondary}>
            {t('QUY TẮC BR-31')}
          </Text>
        </View>
      </View>

      {/* Trạng thái 1: Khi PENDING — Khóa và ẩn hoàn toàn trạng thái hệ thống */}
      {isPending ? (
        <View style={styles.pendingSection}>
          <View style={[styles.lockBox, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
            <LockKey size={20} color={palette.textSecondary} weight="bold" />
            <Text variant="small" color={palette.textSecondary} center style={styles.lockMessage}>
              {t(
                'Trạng thái hệ thống và chủ trại được ẩn để đảm bảo tính khách quan (Quy tắc mù hai bước BR-31).'
              )}
            </Text>
          </View>

          {/* 3 Nút chấm điểm 1 chạm + nút Bỏ qua */}
          <Text variant="small" weight="bold" style={styles.promptText}>
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
                  backgroundColor: palette.surface,
                  borderColor: Colors.light.deviceOnline,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Đánh giá ngày tốt')}
            >
              <CheckCircle size={16} weight="bold" color={Colors.light.deviceOnline} />
              <Text variant="small" weight="bold" color={Colors.light.deviceOnline}>
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
                  backgroundColor: palette.surface,
                  borderColor: palette.alert,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Đánh giá ngày cần theo dõi')}
            >
              <Warning size={16} weight="bold" color={palette.alert} />
              <Text variant="small" weight="bold" color={palette.alert}>
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
                  backgroundColor: palette.surface,
                  borderColor: Colors.light.deviceError,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Đánh giá ngày cần xử lý')}
            >
              <WarningCircle size={16} weight="bold" color={Colors.light.deviceError} />
              <Text variant="small" weight="bold" color={Colors.light.deviceError}>
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
            <Text variant="small" weight="bold">
              {t('Đối chiếu phán quyết & Hệ thống AI (Đã mở khóa)')}
            </Text>
          </View>

          <View style={[styles.comparisonGrid, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
            {/* Cột Chuyên gia */}
            <View style={styles.compColumn}>
              <Text variant="label" color={palette.textSecondary}>
                {t('CHUYÊN GIA')}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor:
                      localRatedStatus === 'GOOD'
                        ? palette.primary
                        : localRatedStatus === 'WATCH'
                          ? palette.alert
                          : Colors.light.deviceError,
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="bold"
                  color={localRatedStatus === 'GOOD' ? palette.onPrimary : palette.onInverse}
                >
                  {localRatedStatus ? STATUS_LABELS[localRatedStatus] : '--'}
                </Text>
              </View>
            </View>

            <View style={[styles.columnDivider, { backgroundColor: palette.divider }]} />

            {/* Cột Hệ thống AI */}
            <View style={styles.compColumn}>
              <Text variant="label" color={palette.textSecondary}>
                {t('HỆ THỐNG AI')}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor:
                      dayRating.system_status === 'GOOD'
                        ? palette.primary
                        : dayRating.system_status === 'WATCH'
                          ? palette.alert
                          : Colors.light.deviceError,
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="bold"
                  color={dayRating.system_status === 'GOOD' ? palette.onPrimary : palette.onInverse}
                >
                  {dayRating.system_status ? STATUS_LABELS[dayRating.system_status] : '--'}
                </Text>
              </View>
            </View>
          </View>

          {/* Lý do hệ thống viễn trắc */}
          {dayRating.system_reasons && dayRating.system_reasons.length > 0 && (
            <View style={styles.reasonsBox}>
              <Text variant="label" weight="bold" color={palette.textSecondary}>
                {t('CĂN CỨ TỪ HỆ THỐNG VIỄN TRẮC:')}
              </Text>
              {dayRating.system_reasons.map((r, i) => (
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
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pendingSection: {
    marginTop: Spacing.sm,
  },
  lockBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
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
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  revealSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
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
    borderWidth: 1,
    padding: Spacing.sm,
  },
  compColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  columnDivider: {
    width: 1,
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
