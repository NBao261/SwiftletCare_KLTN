import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import {
  CaretDown,
  CaretUp,
  Clock,
  MapPin,
  ShieldCheck,
} from 'phosphor-react-native'
import { AlertEvidence } from '@/components/alert/AlertEvidence'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'
import type { InferredAlert, VerdictResult } from '@/types'
import { formatTimeAgo } from '@/utils/date.utils'
import { getInferredAlertDescription, getInferredAlertLabel } from '@/utils/inferredAlert.utils'
import { t } from '@/utils/i18n.utils'
import { InlineVerdictForm } from './InlineVerdictForm'

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
 * Tái sử dụng trực tiếp <AlertEvidence> chuẩn của hệ thống để đồng bộ 100% với FARM_OWNER.
 */
export function VerdictCard({
  alert,
  isExpanded,
  onToggleExpand,
  onVerdictSubmit,
  isSubmitting = false,
}: VerdictCardProps) {
  const palette = usePalette()
  const directory = useZoneDirectory()

  const hasVerdict = Boolean(alert.expert_verdict)
  const isConfirmed = alert.expert_verdict?.result === 'CONFIRMED'

  const alertTitle = getInferredAlertLabel(alert.type)
  const alertDescription = alert.message || getInferredAlertDescription(alert.type)
  const timeString = formatTimeAgo(alert.created_at)

  const zone = alert.zone_id ? directory.zoneById.get(alert.zone_id) : undefined
  const house = directory.houseById.get(alert.house_id ?? zone?.house_id ?? '')
  const scopeLabel = [house?.name, zone?.name].filter(Boolean).join(' › ') || (alert.zone_id ? t('Tầng / Zone') : t('Toàn nhà'))

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
              {scopeLabel}
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
              {t('Gói bằng chứng đa phương thức')}
            </Text>
          </View>

          {/* Gói bằng chứng đồng bộ 100% với AlertDetailContent của Chủ trại (hỗ trợ cả LOW_RETURN_RATE & 5 chỉ số) */}
          <AlertEvidence alert={alert} enabled={isExpanded} />

          {/* Cụm Form Kiểm chứng tại chỗ */}
          <InlineVerdictForm
            alert={alert}
            onSubmitVerdict={(result, note) => onVerdictSubmit(alert._id, result, note)}
            isSubmitting={isSubmitting}
          />
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
    gap: Spacing.sm,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})
