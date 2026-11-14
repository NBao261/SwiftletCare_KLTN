import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { NotePencil } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HouseHealthReportSummary } from '@/types'
import { t } from '@/utils/i18n.utils'

interface QueueReportCardProps {
  report: HouseHealthReportSummary
  onSetConclusion: (reportId: string, text: string) => Promise<void> | void
  isSubmitting?: boolean
}

const KIND_LABEL: Record<HouseHealthReportSummary['kind'], string> = {
  DAILY: 'ngày',
  WEEKLY: 'tuần',
  MONTHLY: 'tháng',
  CUSTOM: 'theo yêu cầu',
}

/**
 * Thẻ Báo cáo sức khỏe theo nhà cần Chuyên gia kết luận (EXPERT-FR-005, 006, 013).
 * Danh sách báo cáo chỉ trả tóm tắt (HouseHealthReportSummary) nên thẻ hiện nhà, kỳ và trạng thái kết luận;
 * chỉ số chi tiết nằm ở báo cáo đầy đủ (màn Phân tích của Farm Owner). Hàng đợi lọc hasConclusion=false.
 */
export function QueueReportCard({ report, onSetConclusion, isSubmitting = false }: QueueReportCardProps) {
  const palette = usePalette()

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [conclusionText, setConclusionText] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)

  const title = t('Báo cáo {kind}: {house}', {
    kind: KIND_LABEL[report.kind],
    house: report.house_name,
  })
  // Báo cáo ngày (hoặc kỳ gói gọn trong 1 ngày) chỉ hiện 1 mốc, không lặp "x → x"
  const period =
    report.period_start === report.period_end
      ? t('Kỳ {date}', { date: report.period_start })
      : t('Kỳ {start} → {end}', { start: report.period_start, end: report.period_end })

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
        <View style={[styles.statusBadge, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="label" weight="bold" color={palette.textSecondary}>
            {report.has_conclusion ? t('Có kết luận') : t('Chưa có kết luận')}
          </Text>
        </View>
      </View>

      <Text variant="small" color={palette.textSecondary} style={styles.period}>
        {period}
      </Text>

      {/* Nút Viết kết luận */}
      <View style={styles.bottomActions}>
        <PressableScale
          onPress={() => setIsSheetOpen(true)}
          disabled={isSubmitting}
          style={[styles.writeBtn, { backgroundColor: palette.surfaceStrong, opacity: isSubmitting ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('Viết kết luận và khuyến nghị')}
        >
          <NotePencil size={16} weight="bold" color={palette.text} />
          <Text variant="small" weight="semiBold" color={palette.text}>
            {t('Viết kết luận →')}
          </Text>
        </PressableScale>
      </View>

      {/* BottomSheet: Viết kết luận */}
      <BottomSheet visible={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">
            {t('Kết luận & Khuyến nghị')}
          </Text>
          <Text variant="small" color={palette.textSecondary}>
            {t('Nhận định chuyên môn cho kỳ báo cáo này của nhà {house}.', { house: report.house_name })}
          </Text>
        </View>

        <View style={styles.sheetBody}>
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
  period: {
    marginTop: Spacing.xs,
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
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sheetBtn: {
    flex: 1,
  },
})
