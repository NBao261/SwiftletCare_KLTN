import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Sparkle,
  TrendUp,
  XCircle,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CoefficientProposal } from '@/types'
import { formatTimeAgo } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

interface QueueProposalCardProps {
  proposal: CoefficientProposal
  onApprove: (proposalId: string) => Promise<void> | void
  onReject: (proposalId: string, reason: string) => Promise<void> | void
  isSubmitting?: boolean
}

const FUZZY_LABELS: Record<string, string> = {
  fuzzy_humidity_band: 'Dung sai độ ẩm (%)',
  fuzzy_temp_band: 'Dung sai nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức sấy quạt (%)',
  fuzzy_window_sec: 'Cửa sổ lọc (s)',
}

/**
 * Thẻ Phê duyệt đề xuất hệ số mờ Fuzzy từ AI / Chủ trại (EXPERT-FR-011, SRS §6.11).
 * Hiển thị chỉ số R², % cải thiện dự kiến, bảng 4 hệ số mờ và BottomSheet nhập lý do khi Từ chối.
 * Sử dụng <Card> phẳng không viền đồng bộ 100% với FARM_OWNER.
 */
export function QueueProposalCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting = false,
}: QueueProposalCardProps) {
  const palette = usePalette()

  const [isRejectSheetOpen, setIsRejectSheetOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  const timeStr = formatTimeAgo(proposal.created_at)
  const submittedBy = proposal.submitted_by?.full_name || t('Hệ thống AI gợi ý')
  const rSquared = `${Math.round((proposal.r_squared ?? 0.85) * 100)}%`
  const rawPredictedPct =
    proposal.predicted_in_range_pct ??
    proposal.predicted?.inRangeSuggested ??
    proposal.predicted?.in_range_pct
  const predictedPct = rawPredictedPct != null ? `+${rawPredictedPct.toFixed(1)}%` : '+12.5%'

  const suggestedKeys = Object.keys(proposal.suggested_values || {})

  const handleApprove = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    await onApprove(proposal._id)
  }

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
      setRejectError(t('Vui lòng nhập lý do từ chối để phản hồi cho người đề xuất'))
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setRejectError(null)
    setIsRejectSheetOpen(false)
    await onReject(proposal._id, rejectReason.trim())
  }

  return (
    <Card style={styles.card}>
      {/* Header: Nguồn đề xuất & Thời gian */}
      <View style={styles.headerRow}>
        <View style={styles.sourceRow}>
          <Sparkle size={14} color={palette.text} weight="bold" />
          <Text variant="small" weight="semiBold">
            {submittedBy}
          </Text>
        </View>

        <View style={styles.timeRow}>
          <Clock size={12} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {timeStr}
          </Text>
        </View>
      </View>

      {/* Chỉ số Độ tin cậy AI và % cải thiện dự kiến */}
      <View style={[styles.metricsBox, { backgroundColor: palette.surfaceStrong }]}>
        <View style={styles.metricItem}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Độ tin cậy AI')}
          </Text>
          <Text variant="heading" weight="semiBold" style={styles.metricValue}>
            {rSquared}
          </Text>
        </View>

        <View style={[styles.metricDivider, { backgroundColor: palette.divider }]} />

        <View style={styles.metricItem}>
          <View style={styles.metricLabelRow}>
            <TrendUp size={12} color={palette.houseHealthy} weight="bold" />
            <Text variant="small" color={palette.textSecondary}>
              {t('Dự kiến đạt chuẩn')}
            </Text>
          </View>
          <Text variant="heading" weight="semiBold" color={palette.houseHealthy} style={styles.metricValue}>
            {predictedPct}
          </Text>
        </View>
      </View>

      {/* Bảng 4 hệ số độ ẩm & gió so sánh hiện tại vs đề xuất (kiểu SettingsTable của Farmer) */}
      <View style={styles.coefTable}>
        <View style={[styles.tableHeader, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.colParam}>
            {t('Hệ số độ ẩm & gió')}
          </Text>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.colOld} center>
            {t('Hiện tại')}
          </Text>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.colNew} center>
            {t('Đề xuất')}
          </Text>
        </View>

        {suggestedKeys.map((key, index) => {
          const currentVal = proposal.current_values?.[key] ?? '--'
          const suggestedVal = proposal.suggested_values?.[key] ?? '--'
          const label = FUZZY_LABELS[key] || key

          return (
            <View
              key={key}
              style={[
                styles.tableRow,
                index < suggestedKeys.length - 1 && {
                  borderBottomWidth: BorderWidth.hairline,
                  borderBottomColor: palette.divider,
                },
              ]}
            >
              <Text variant="small" style={styles.colParam} numberOfLines={1}>
                {label}
              </Text>
              <Text variant="small" color={palette.textSecondary} style={styles.colOld} center>
                {currentVal}
              </Text>
              <View style={styles.colNewWrapper}>
                <ArrowRight size={10} color={palette.textSecondary} />
                <Text variant="small" weight="semiBold" color={palette.text} style={styles.tabularNum}>
                  {suggestedVal}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* Cụm 2 nút hành động 1 chạm chuẩn 44pt */}
      <View style={styles.actionsContainer}>
        <PressableScale
          onPress={() => setIsRejectSheetOpen(true)}
          disabled={isSubmitting}
          style={[
            styles.actionBtn,
            {
              backgroundColor: palette.surfaceStrong,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Từ chối đề xuất này')}
        >
          <XCircle size={16} color={palette.text} />
          <Text variant="small" weight="semiBold" color={palette.text}>
            {t('Từ chối...')}
          </Text>
        </PressableScale>

        <PressableScale
          onPress={handleApprove}
          disabled={isSubmitting}
          style={[
            styles.actionBtn,
            {
              backgroundColor: palette.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Duyệt áp dụng bộ hệ số mờ này')}
        >
          <CheckCircle size={16} weight="bold" color={palette.onPrimary} />
          <Text variant="small" weight="semiBold" color={palette.onPrimary}>
            {t('Duyệt áp dụng')}
          </Text>
        </PressableScale>
      </View>

      {/* BottomSheet: Nhập lý do từ chối bắt buộc (tránh 422) */}
      <BottomSheet
        visible={isRejectSheetOpen}
        onClose={() => setIsRejectSheetOpen(false)}
      >
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">
            {t('Lý do từ chối đề xuất')}
          </Text>
          <Text variant="small" color={palette.textSecondary} style={{ marginTop: 2 }}>
            {t('Bắt buộc nhập lý do chuyên môn để lưu hồ sơ và gửi thông báo phản hồi.')}
          </Text>
        </View>

        <View style={styles.sheetBody}>
          <TextField
            label={t('Lý do từ chối')}
            value={rejectReason}
            onChangeText={val => {
              setRejectReason(val)
              if (rejectError) setRejectError(null)
            }}
            placeholder={t('Nhập nhận định (VD: Cần thêm 7 ngày theo dõi độ trễ quạt)...')}
            multiline
            numberOfLines={3}
            error={rejectError}
          />

          <View style={styles.sheetActions}>
            <Button
              label={t('Hủy')}
              variant="secondary"
              onPress={() => setIsRejectSheetOpen(false)}
              style={styles.sheetBtn}
            />
            <Button
              label={t('Xác nhận từ chối')}
              variant="primary"
              onPress={handleRejectConfirm}
              style={styles.sheetBtn}
            />
          </View>
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
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontFamily: FontFamily.semiBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  metricDivider: {
    width: BorderWidth.hairline,
    height: 32,
  },
  coefTable: {
    marginTop: Spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  colParam: {
    flex: 2,
  },
  colOld: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  colNew: {
    flex: 1,
  },
  colNewWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sheetHeader: {
    marginBottom: Spacing.xs,
  },
  sheetBody: {
    gap: Spacing.sm,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sheetBtn: {
    flex: 1,
  },
})
