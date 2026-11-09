import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
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
  XCircle,
} from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
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
    <View style={earlierStyles.container}>
      <Pressable
        onPress={() => setIsExpanded(prev => !prev)}
        style={[
          earlierStyles.toggleButton,
          {
            backgroundColor: palette.surfaceStrong,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('Lịch sử báo tương tự')}
      >
        <View style={earlierStyles.toggleContent}>
          <ClockCounterClockwise size={16} color={palette.text} />
          <Text variant="small" weight="semiBold">
            {t('Lịch sử báo tương tự ({count})', { count })}
          </Text>
        </View>
        {isExpanded ? <CaretUp size={16} color={palette.text} /> : <CaretDown size={16} color={palette.text} />}
      </Pressable>

      {isExpanded && (
        <View style={[earlierStyles.listContainer, { backgroundColor: palette.surfaceStrong }]}>
          {items.length === 0 ? (
            <Text variant="small" color={palette.textSecondary} center style={earlierStyles.emptyText}>
              {t('Chưa có cảnh báo tương tự nào tại khu vực này.')}
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
                    index < items.length - 1 && {
                      borderBottomWidth: BorderWidth.hairline,
                      borderBottomColor: palette.divider,
                    },
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
                        {isConfirmed ? t('Báo đúng') : t('Báo ảo')}
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
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  listContainer: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  emptyText: {
    paddingVertical: Spacing.sm,
  },
  itemRow: {
    paddingVertical: Spacing.sm,
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
    paddingHorizontal: Spacing.sm,
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
 * Sử dụng <Card> phẳng không viền đồng bộ 100% với FARM_OWNER.
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

  // Dòng kết luận tóm tắt 1 câu bằng tiếng Việt rõ ràng cho Biểu đồ viễn trắc môi trường
  const telemetrySummary = useMemo(() => {
    const samples = evidence?.telemetry?.samples
    if (!samples || samples.length === 0) {
      return t('Không có số liệu nhiệt ẩm quanh thời điểm này.')
    }
    const temps = samples.map(s => s.temperature).filter((v): v is number => typeof v === 'number')
    const hums = samples.map(s => s.humidity).filter((v): v is number => typeof v === 'number')
    const sounds = samples.map(s => s.sound_db).filter((v): v is number => typeof v === 'number')

    if (temps.length === 0 && hums.length === 0) {
      return t('Dữ liệu cảm biến vi khí hậu trong 60 phút quanh thời điểm báo động.')
    }

    const minT = temps.length > 0 ? Math.min(...temps).toFixed(1) : '--'
    const maxT = temps.length > 0 ? Math.max(...temps).toFixed(1) : '--'
    const minH = hums.length > 0 ? Math.min(...hums).toFixed(0) : '--'
    const maxH = hums.length > 0 ? Math.max(...hums).toFixed(0) : '--'
    const maxS = sounds.length > 0 ? Math.max(...sounds).toFixed(0) : null

    if (maxS && Number(maxS) > 70) {
      return t('Nhiệt độ {minT}–{maxT}°C, độ ẩm {minH}–{maxH}%, phát hiện âm thanh đạt đỉnh {maxS} dB.', {
        minT,
        maxT,
        minH,
        maxH,
        maxS,
      })
    }
    return t('Nhiệt độ dao động {minT}–{maxT}°C, độ ẩm {minH}–{maxH}% trong 60 phút quanh thời điểm báo động.', {
      minT,
      maxT,
      minH,
      maxH,
    })
  }, [evidence?.telemetry?.samples])

  // Dòng kết luận tóm tắt 1 câu bằng tiếng Việt rõ ràng cho Biểu đồ đếm chim
  const birdSummary = useMemo(() => {
    const buckets = evidence?.bird_counts?.buckets
    if (!buckets || buckets.length === 0) {
      return t('Không có dữ liệu đếm chim quanh thời điểm này.')
    }
    const totalIn = buckets.reduce((acc, b) => acc + (b.entry_count || 0), 0)
    const totalOut = buckets.reduce((acc, b) => acc + (b.exit_count || 0), 0)
    return t('Tổng 60 phút: {totalIn} chim bay vào, {totalOut} chim bay ra qua cửa thu.', {
      totalIn,
      totalOut,
    })
  }, [evidence?.bird_counts?.buckets])

  return (
    <Card style={styles.cardContainer}>
      {/* Phần đầu Card — Bấm để bung mở / thu gọn ngăn bằng chứng */}
      <PressableScale
        onPress={onToggleExpand}
        style={styles.headerPressable}
        accessibilityRole="button"
        accessibilityLabel={`${alertTitle}, ${hasVerdict ? 'đã xác nhận' : 'chờ kiểm tra'}`}
      >
        {/* Hàng 1: Trạng thái thẩm định & Thời gian & Mũi tên */}
        <View style={styles.topRow}>
          <View style={styles.badgeWrapper}>
            {!hasVerdict ? (
              <View style={[styles.statusBadge, { backgroundColor: palette.severityP2 }]}>
                <View style={[styles.statusDot, { backgroundColor: palette.alert }]} />
                <Text variant="label" weight="bold" color={palette.severityP2Text}>
                  {t('Chờ kiểm tra')}
                </Text>
              </View>
            ) : isConfirmed ? (
              <View style={[styles.statusBadge, { backgroundColor: palette.primary }]}>
                <Text variant="label" weight="bold" color={palette.onPrimary}>
                  {t('Báo đúng')}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: palette.inverse }]}>
                <Text variant="label" weight="bold" color={palette.onInverse}>
                  {t('Báo ảo')}
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
          <Text variant="heading" weight="semiBold" style={styles.titleText}>
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
              {hasVerdict ? t('Xem dữ liệu & lịch sử →') : t('Xem dữ liệu đo đạc & xác nhận →')}
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
            <Text variant="small" weight="semiBold">
              {t('Số liệu đo đạc (±30 phút trước và sau)')}
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
              {/* Dòng kết luận tóm tắt 1 câu bằng tiếng Việt rõ ràng cho Vi khí hậu */}
              <View style={[styles.chartSummaryBanner, { backgroundColor: palette.surfaceStrong }]}>
                <Text variant="small" weight="semiBold" color={palette.text}>
                  {telemetrySummary}
                </Text>
              </View>

              {/* 1. Biểu đồ viễn trắc môi trường ±30 phút */}
              <EvidenceChart
                telemetry={evidence?.telemetry}
                alertTime={alert.created_at}
                alertType={alert.type}
              />

              {/* Dòng kết luận tóm tắt 1 câu bằng tiếng Việt rõ ràng cho Đếm chim */}
              <View style={[styles.chartSummaryBanner, { backgroundColor: palette.surfaceStrong, marginTop: Spacing.sm }]}>
                <Text variant="small" weight="semiBold" color={palette.text}>
                  {birdSummary}
                </Text>
              </View>

              {/* 2. Biểu đồ cột đếm chim 5 phút ±30 phút */}
              <BirdCountChart birdCounts={evidence?.bird_counts} />

              {/* 3. Danh sách thiết bị lỗi mở của Zone */}
              {evidence?.device_alerts && evidence.device_alerts.length > 0 && (
                <View
                  style={[
                    styles.deviceAlertsBox,
                    { backgroundColor: palette.surfaceStrong },
                  ]}
                >
                  <View style={styles.deviceAlertsHeader}>
                    <Cpu size={14} color={palette.alert} />
                    <Text variant="small" weight="semiBold" color={palette.alert}>
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
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  headerPressable: {
    padding: Spacing.lg,
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
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
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
    borderTopWidth: BorderWidth.hairline,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
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
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  deviceAlertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chartSummaryBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
})
