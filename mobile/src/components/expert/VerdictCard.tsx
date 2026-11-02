import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import {
  CaretDown,
  CaretUp,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  Cpu,
  MapPin,
  ShieldCheck,
  WarningCircle,
  XCircle,
} from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useAlertEvidence } from '@/hooks/expert/useInferredAlerts'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, InferredAlert, VerdictResult } from '@/types'
import { formatDateTime, formatTimeAgo } from '@/utils/date.utils'
import { getInferredAlertDescription, getInferredAlertLabel } from '@/utils/inferredAlert.utils'
import { t } from '@/utils/i18n.utils'
import { BirdCountChart } from './BirdCountChart'
import { EvidenceChart } from './EvidenceChart'
import { InlineVerdictForm } from './InlineVerdictForm'

interface EarlierVerdictsListProps {
  earlierVerdicts?: InferredAlert[]
}

/**
 * Danh sách 10 tiền lệ phán quyết gần nhất cùng loại tại Zone/House (EXPERT-FR-003).
 * Được gộp tại chỗ vào VerdictCard để giảm phân mảnh file.
 */
function EarlierVerdictsList({ earlierVerdicts = [] }: EarlierVerdictsListProps) {
  const palette = usePalette()
  const [isExpanded, setIsExpanded] = useState(false)

  const items = earlierVerdicts.slice(0, 10)
  const count = items.length

  return (
    <View style={[earlierStyles.container, { borderColor: palette.border }]}>
      <PressableScale
        onPress={() => setIsExpanded(prev => !prev)}
        style={[
          earlierStyles.toggleButton,
          {
            backgroundColor: palette.surfaceStrong,
            borderColor: palette.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('10 tiền lệ phán quyết gần nhất')}
      >
        <View style={earlierStyles.toggleContent}>
          <ClockCounterClockwise size={16} color={palette.text} />
          <Text variant="small" weight="bold">
            {t('10 Tiền lệ gần nhất ({count})', { count })}
          </Text>
        </View>
        {isExpanded ? <CaretUp size={16} color={palette.text} /> : <CaretDown size={16} color={palette.text} />}
      </PressableScale>

      {isExpanded && (
        <View style={[earlierStyles.listContainer, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
          {items.length === 0 ? (
            <Text variant="small" color={palette.textSecondary} center style={earlierStyles.emptyText}>
              {t('Chưa có tiền lệ phán quyết tương tự tại khu vực này.')}
            </Text>
          ) : (
            items.map((item, index) => {
              const isConfirmed = item.expert_verdict?.result === 'CONFIRMED'
              const expertName = item.expert_verdict?.by?.full_name || t('Chuyên gia')
              const verdictDate = item.expert_verdict?.at
                ? formatDateTime(item.expert_verdict.at)
                : formatDateTime(item.created_at)
              const note = item.expert_verdict?.note

              return (
                <View
                  key={item._id || index}
                  style={[
                    earlierStyles.itemRow,
                    index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.divider },
                  ]}
                >
                  <View style={earlierStyles.badgeRow}>
                    <View
                      style={[
                        earlierStyles.verdictBadge,
                        {
                          backgroundColor: isConfirmed ? palette.primary : palette.inverse,
                        },
                      ]}
                    >
                      {isConfirmed ? (
                        <CheckCircle size={12} weight="bold" color={palette.onPrimary} />
                      ) : (
                        <XCircle size={12} weight="bold" color={palette.onInverse} />
                      )}
                      <Text
                        variant="label"
                        weight="bold"
                        color={isConfirmed ? palette.onPrimary : palette.onInverse}
                      >
                        {isConfirmed ? t('XÁC NHẬN') : t('BÁC BỎ')}
                      </Text>
                    </View>

                    <Text variant="small" weight="semiBold" numberOfLines={1} style={earlierStyles.alertLabel}>
                      {getInferredAlertLabel(item.type)}
                    </Text>
                  </View>

                  <Text variant="small" color={palette.textSecondary} style={earlierStyles.metaText}>
                    {expertName} · {verdictDate}
                  </Text>

                  {Boolean(note) && (
                    <Text variant="small" color={palette.text} style={earlierStyles.noteText}>
                      {`"${note}"`}
                    </Text>
                  )}
                </View>
              )
            })
          )}
        </View>
      )}
    </View>
  )
}

const earlierStyles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  listContainer: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  emptyText: {
    paddingVertical: Spacing.sm,
  },
  itemRow: {
    paddingVertical: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  alertLabel: {
    flex: 1,
  },
  metaText: {
    marginTop: 2,
    fontSize: 11,
  },
  noteText: {
    marginTop: 2,
    fontStyle: 'italic',
    fontSize: 12,
  },
})

interface VerdictCardProps {
  alert: InferredAlert
  isExpanded: boolean
  onToggleExpand: () => void
  onVerdictSubmit: (alertId: string, result: VerdictResult, note?: string) => Promise<void>
  isSubmitting?: boolean
}

/**
 * Thẻ cảnh báo suy luận tích hợp Ngăn bằng chứng đa phương thức tại chỗ (Inline Evidence Drawer).
 * Đáp ứng EXPERT-FR-003, ALERT-FR-007, ALERT-FR-014.
 * Sử dụng <Card> và <PressableScale> đồng bộ với FARM_OWNER.
 */
export function VerdictCard({
  alert,
  isExpanded,
  onToggleExpand,
  onVerdictSubmit,
  isSubmitting = false,
}: VerdictCardProps) {
  const palette = usePalette()

  // Bằng chứng đa phương thức chỉ tải khi chuyên gia bung mở ngăn
  const { data: evidence, isLoading: isEvidenceLoading } = useAlertEvidence(isExpanded ? alert._id : '')

  const hasVerdict = Boolean(alert.expert_verdict)
  const isConfirmed = alert.expert_verdict?.result === 'CONFIRMED'

  const alertTitle = getInferredAlertLabel(alert.type)
  const alertDescription = alert.message || getInferredAlertDescription(alert.type)
  const timeString = formatTimeAgo(alert.created_at)

  return (
    <Card
      style={[
        styles.cardContainer,
        {
          borderColor: palette.border,
          borderWidth: 1,
          borderLeftColor: !hasVerdict ? palette.alert : palette.border,
          borderLeftWidth: !hasVerdict ? 4 : 1,
        },
      ]}
    >
      {/* Phần đầu Card — Bấm để bung mở / thu gọn ngăn bằng chứng */}
      <PressableScale
        onPress={onToggleExpand}
        style={styles.headerPressable}
        accessibilityRole="button"
        accessibilityLabel={`${alertTitle}, ${hasVerdict ? 'đã phán quyết' : 'chờ thẩm định'}`}
      >
        {/* Hàng 1: Trạng thái thẩm định & Thời gian & Mũi tên */}
        <View style={styles.topRow}>
          <View style={styles.badgeWrapper}>
            {!hasVerdict ? (
              <View style={[styles.statusBadge, { backgroundColor: palette.alert }]}>
                <WarningCircle size={12} weight="bold" color={palette.surface} />
                <Text variant="label" weight="bold" color={palette.surface}>
                  {t('CHỜ THẨM ĐỊNH')}
                </Text>
              </View>
            ) : isConfirmed ? (
              <View style={[styles.statusBadge, { backgroundColor: palette.primary }]}>
                <Text variant="label" weight="bold" color={palette.onPrimary}>
                  {t('ĐÃ XÁC NHẬN')}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: palette.inverse }]}>
                <Text variant="label" weight="bold" color={palette.onInverse}>
                  {t('ĐÃ BÁC BỎ')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.timeAndCaret}>
            <View style={styles.timeItem}>
              <Clock size={12} color={palette.textSecondary} />
              <Text variant="small" color={palette.textSecondary}>
                {timeString}
              </Text>
            </View>
            {isExpanded ? (
              <CaretUp size={16} color={palette.text} />
            ) : (
              <CaretDown size={16} color={palette.text} />
            )}
          </View>
        </View>

        {/* Hàng 2: Tên sự cố suy luận & Vị trí Zone */}
        <View style={styles.titleRow}>
          <Text variant="heading" weight="bold" style={styles.titleText}>
            {alertTitle}
          </Text>
          <View style={styles.locationWrapper}>
            <MapPin size={13} color={palette.textSecondary} />
            <Text variant="small" color={palette.textSecondary}>
              {alert.zone_id ? t('Tầng / Zone') : t('Toàn nhà')}
            </Text>
          </View>
        </View>

        {/* Hàng 3: Nội dung chi tiết viễn trắc tóm tắt */}
        {Boolean(alertDescription) && (
          <Text
            variant="body"
            color={palette.text}
            numberOfLines={isExpanded ? undefined : 2}
            style={styles.descriptionText}
          >
            {alertDescription}
          </Text>
        )}

        {/* Gợi ý mở rộng khi chưa mở */}
        {!isExpanded && (
          <View style={styles.expandHintRow}>
            <Text variant="small" weight="semiBold" color={palette.alert}>
              {hasVerdict ? t('Xem bằng chứng & lịch sử →') : t('Xem bằng chứng đa phương thức & thẩm định →')}
            </Text>
          </View>
        )}
      </PressableScale>

      {/* Ngăn mở rộng Bằng chứng đa phương thức tại chỗ (Inline Drawer) */}
      {isExpanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.drawerContainer, { borderTopColor: palette.divider }]}
        >
          <View style={styles.drawerHeader}>
            <ShieldCheck size={16} weight="bold" color={palette.text} />
            <Text variant="small" weight="bold">
              {t('BẰNG CHỨNG ĐA PHƯƠNG THỨC (±30 MIN)')}
            </Text>
          </View>

          {isEvidenceLoading ? (
            <View style={styles.skeletonContainer}>
              <Skeleton width="100%" height={160} radius={Radius.md} />
              <View style={{ height: Spacing.sm }} />
              <Skeleton width="100%" height={140} radius={Radius.md} />
              <View style={{ height: Spacing.sm }} />
              <Skeleton width="100%" height={44} radius={Radius.full} />
            </View>
          ) : (
            <>
              {/* 1. Biểu đồ viễn trắc môi trường ±30 phút */}
              <EvidenceChart
                telemetry={evidence?.telemetry}
                alertTime={alert.created_at}
                alertType={alert.type}
              />

              {/* 2. Biểu đồ cột đếm chim 5 phút ±30 phút */}
              <BirdCountChart birdCounts={evidence?.bird_counts} />

              {/* 3. Danh sách thiết bị lỗi mở của Zone */}
              {evidence?.device_alerts && evidence.device_alerts.length > 0 && (
                <View
                  style={[
                    styles.deviceAlertsBox,
                    { backgroundColor: palette.surfaceStrong, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.deviceAlertsHeader}>
                    <Cpu size={14} color={palette.alert} />
                    <Text variant="small" weight="bold" color={palette.alert}>
                      {t('Cảnh báo thiết bị liên quan ({count})', {
                        count: evidence.device_alerts.length,
                      })}
                    </Text>
                  </View>
                  {evidence.device_alerts.map((da: Alert) => (
                    <Text key={da._id} variant="small" color={palette.text} style={{ marginTop: 2 }}>
                      • {da.title} ({da.severity})
                    </Text>
                  ))}
                </View>
              )}

              {/* 4. 10 Tiền lệ gần nhất cùng loại */}
              <EarlierVerdictsList earlierVerdicts={evidence?.earlier_verdicts} />

              {/* 5. Cụm Form Kiểm chứng tại chỗ */}
              <InlineVerdictForm
                alert={alert}
                onSubmitVerdict={(result, note) => onVerdictSubmit(alert._id, result, note)}
                isSubmitting={isSubmitting}
              />
            </>
          )}
        </Animated.View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  cardContainer: {
    padding: 0,
    gap: 0,
    elevation: 0,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  headerPressable: {
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  timeAndCaret: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleRow: {
    marginTop: Spacing.xs,
  },
  titleText: {
    fontSize: 16,
  },
  locationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  descriptionText: {
    marginTop: Spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },
  expandHintRow: {
    marginTop: Spacing.sm,
  },
  drawerContainer: {
    borderTopWidth: 1,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  skeletonContainer: {
    paddingVertical: Spacing.sm,
  },
  deviceAlertsBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  deviceAlertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
})
