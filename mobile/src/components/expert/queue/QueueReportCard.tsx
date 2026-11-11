import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import {
  NotePencil,
  Sparkle,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { ZoneHealthReportItem } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

interface QueueReportCardProps {
  report: ZoneHealthReportItem
  onSetConclusion: (reportId: string, text: string) => Promise<void> | void
  isSubmitting?: boolean
}

const TEMPLATE_CONCLUSIONS = [
  'Vận hành ổn định, tiếp tục duy trì dải thông số hiện tại.',
  'Độ ẩm tầng trên có dấu hiệu khô, cần tăng thời gian phun sương +30s.',
  'Phát hiện âm thanh lạ về đêm, khuyến nghị kiểm tra loa dẫn dụ và cửa thu chim.',
]

/**
 * Thẻ Báo cáo sức khỏe định kỳ cần Chuyên gia kết luận (EXPERT-FR-005, 006, 013).
 * Tích hợp BottomSheet ban hành kết luận chỉ trong đúng 2 chạm.
 * Sử dụng <Card> phẳng không viền đồng bộ 100% với ReportTab của FARM_OWNER.
 */
export function QueueReportCard({
  report,
  onSetConclusion,
  isSubmitting = false,
}: QueueReportCardProps) {
  const palette = usePalette()

  const existingConclusionText =
    typeof report.expert_conclusion === 'object' && report.expert_conclusion !== null
      ? report.expert_conclusion.text
      : report.expert_conclusion || ''
  const existingConclusionAt =
    typeof report.expert_conclusion === 'object' && report.expert_conclusion !== null
      ? report.expert_conclusion.at
      : report.expert_conclusion_at

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [conclusionText, setConclusionText] = useState(existingConclusionText)
  const [errorText, setErrorText] = useState<string | null>(null)

  const hasConclusion = Boolean(existingConclusionText)
  const title = t('Báo cáo {type} kỳ {start}', {
    type: report.report_type === 'DAILY' ? 'ngày' : report.report_type === 'WEEKLY' ? 'tuần' : 'tháng',
    start: report.period_start?.slice(0, 10) || '',
  })

  const rawInRangePct = report.metrics?.humidity_in_range_pct ?? report.time_in_range_pct
  const rawAutonomyPct = report.metrics?.auto_mode_pct ?? report.autonomy_pct
  const inRangePct = rawInRangePct != null ? `${Math.round(rawInRangePct)}%` : '_'
  const autonomyPct = rawAutonomyPct != null ? `${Math.round(rawAutonomyPct)}%` : '_'

  const alertsCount =
    report.alerts_count ??
    (report.metrics?.alerts_by_type
      ? Object.values(report.metrics.alerts_by_type).reduce((sum, n) => sum + (n || 0), 0)
      : 0)

  const handleSelectTemplate = (template: string) => {
    setErrorText(null)
    setConclusionText(template)
  }

  const handlePublish = async () => {
    if (!conclusionText.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
      setErrorText(t('Vui lòng nhập kết luận và khuyến nghị chuyên môn'))
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setErrorText(null)
    setIsSheetOpen(false)
    await onSetConclusion(report._id, conclusionText.trim())
  }

  return (
    <Card style={styles.card}>
      {/* Header: Tên báo cáo & Trạng thái kết luận */}
      <View style={styles.headerRow}>
        <Text variant="heading" weight="semiBold" style={{ flex: 1 }}>
          {title}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: hasConclusion ? palette.primary : palette.surfaceStrong,
            },
          ]}
        >
          <Text
            variant="label"
            weight="bold"
            color={hasConclusion ? palette.onPrimary : palette.textSecondary}
          >
            {hasConclusion ? t('Có kết luận') : t('Chưa có kết luận')}
          </Text>
        </View>
      </View>

      {/* 3 Chỉ số tóm tắt vi khí hậu */}
      <View style={[styles.statsBox, { backgroundColor: palette.surfaceStrong }]}>
        <View style={styles.statCol}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Trong ngưỡng')}
          </Text>
          <Text variant="body" weight="semiBold" style={styles.statVal}>
            {inRangePct}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />

        <View style={styles.statCol}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Máy tự chạy')}
          </Text>
          <Text variant="body" weight="semiBold" style={styles.statVal}>
            {autonomyPct}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />

        <View style={styles.statCol}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Sự cố khẩn')}
          </Text>
          <Text
            variant="body"
            weight="semiBold"
            color={alertsCount > 0 ? palette.alert : palette.text}
            style={styles.statVal}
          >
            {alertsCount}
          </Text>
        </View>
      </View>

      {/* Hiển thị kết luận hiện tại nếu có (giống ReportTab.conclusionBox của Farmer) */}
      {hasConclusion && (
        <View style={[styles.conclusionBox, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary}>
            {existingConclusionAt
              ? t('Kết luận chuyên gia ({at}):', {
                  at: formatDateTime(existingConclusionAt),
                })
              : t('Kết luận chuyên gia:')}
          </Text>
          <Text variant="body" color={palette.text}>
            {existingConclusionText}
          </Text>
        </View>
      )}

      {/* Nút Viết / Sửa kết luận */}
      <View style={styles.bottomActions}>
        <PressableScale
          onPress={() => setIsSheetOpen(true)}
          disabled={isSubmitting}
          style={[
            styles.writeBtn,
            {
              backgroundColor: hasConclusion ? palette.surfaceStrong : palette.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Viết kết luận và khuyến nghị')}
        >
          <NotePencil
            size={16}
            weight="bold"
            color={hasConclusion ? palette.text : palette.onPrimary}
          />
          <Text
            variant="small"
            weight="semiBold"
            color={hasConclusion ? palette.text : palette.onPrimary}
          >
            {hasConclusion ? t('Sửa kết luận') : t('Viết kết luận →')}
          </Text>
        </PressableScale>
      </View>

      {/* BottomSheet: Viết kết luận & 3 Chip mẫu gợi ý nhanh (2 chạm) */}
      <BottomSheet
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      >
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">
            {t('Kết luận & Khuyến nghị')}
          </Text>
          <Text variant="small" color={palette.textSecondary}>
            {t('Chọn nhanh mẫu khuyến nghị chuyên gia hoặc nhập nội dung tùy biến.')}
          </Text>
        </View>

        <View style={styles.sheetBody}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={{ marginBottom: 4 }}>
            {t('Mẫu khuyến nghị nhanh (1 chạm):')}
          </Text>
          <View style={styles.templatesContainer}>
            {TEMPLATE_CONCLUSIONS.map((tmpl, idx) => {
              const isSelected = conclusionText === tmpl
              return (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectTemplate(tmpl)}
                  style={[
                    styles.templateChip,
                    {
                      backgroundColor: isSelected ? palette.inverse : palette.surfaceStrong,
                    },
                  ]}
                >
                  <Sparkle
                    size={12}
                    color={isSelected ? palette.onInverse : palette.textSecondary}
                    weight="bold"
                  />
                  <Text
                    variant="small"
                    weight={isSelected ? 'semiBold' : 'regular'}
                    color={isSelected ? palette.onInverse : palette.text}
                    numberOfLines={2}
                    style={{ flex: 1 }}
                  >
                    {tmpl}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <TextField
            label={t('Nội dung kết luận')}
            value={conclusionText}
            onChangeText={val => {
              setConclusionText(val)
              if (errorText) setErrorText(null)
            }}
            placeholder={t('Nhập nhận định chuyên môn cho kỳ báo cáo này...')}
            multiline
            numberOfLines={4}
            error={errorText}
          />

          <View style={styles.sheetActions}>
            <Button
              label={t('Đóng')}
              variant="secondary"
              onPress={() => setIsSheetOpen(false)}
              style={styles.sheetBtn}
            />
            <Button
              label={t('Ban hành kết luận')}
              variant="primary"
              onPress={handlePublish}
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
    gap: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: BorderWidth.hairline,
    height: 24,
  },
  conclusionBox: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  writeBtn: {
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
  templatesContainer: {
    gap: Spacing.xs,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
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
