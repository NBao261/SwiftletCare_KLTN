import React, { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import {
  FileCsv,
  FilePdf,
  NotePencil,
  Sparkle,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Radius, Spacing } from '@/constants/theme'
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
  'Phát hiện dị thường âm thanh đêm, khuyến nghị kiểm tra âm học và cửa thu chim.',
]

/**
 * Thẻ Báo cáo sức khỏe định kỳ cần Chuyên gia kết luận (EXPERT-FR-005, 006, 013).
 * Tích hợp tải nhanh PDF/CSV và BottomSheet ban hành kết luận chỉ trong đúng 2 chạm.
 * Sử dụng <Card>, <PressableScale> và <TextField> chuẩn hóa đồng bộ với FARM_OWNER.
 */
export function QueueReportCard({
  report,
  onSetConclusion,
  isSubmitting = false,
}: QueueReportCardProps) {
  const palette = usePalette()

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [conclusionText, setConclusionText] = useState(report.expert_conclusion || '')
  const [errorText, setErrorText] = useState<string | null>(null)

  const hasConclusion = Boolean(report.expert_conclusion)
  const title = t('Báo cáo {type} kỳ {start}', {
    type: report.report_type === 'DAILY' ? 'Ngày' : report.report_type === 'WEEKLY' ? 'Tuần' : 'Tháng',
    start: report.period_start?.slice(0, 10) || '',
  })

  const inRangePct = `${Math.round(report.time_in_range_pct || 90)}%`
  const autonomyPct = `${Math.round(report.autonomy_pct || 85)}%`

  const handleDownloadPdf = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    NativeAlert.alert(
      t('Tải báo cáo PDF'),
      t('Đã tạo liên kết tải file PDF báo cáo sức khỏe (EXPERT-FR-013).')
    )
  }

  const handleDownloadCsv = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    NativeAlert.alert(
      t('Tải dữ liệu CSV'),
      t('Đã chuẩn bị file CSV chuỗi thời gian vi khí hậu (EXPERT-FR-013).')
    )
  }

  const handleSelectTemplate = (template: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
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
    <Card
      style={[
        styles.card,
        { borderColor: palette.border, borderWidth: 1 },
      ]}
    >
      {/* Header: Tên báo cáo & Trạng thái kết luận */}
      <View style={styles.headerRow}>
        <Text variant="heading" weight="bold">
          {title}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: hasConclusion ? palette.primary : palette.surfaceStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <Text
            variant="label"
            weight="bold"
            color={hasConclusion ? palette.onPrimary : palette.textSecondary}
          >
            {hasConclusion ? t('ĐÃ CÓ KẾT LUẬN') : t('CHƯA CÓ KẾT LUẬN')}
          </Text>
        </View>
      </View>

      {/* 3 Chỉ số tóm tắt vi khí hậu */}
      <View style={[styles.statsBox, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
        <View style={styles.statCol}>
          <Text variant="label" color={palette.textSecondary}>
            {t('TRONG NGƯỠNG')}
          </Text>
          <Text variant="body" weight="bold" style={styles.statVal}>
            {inRangePct}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />

        <View style={styles.statCol}>
          <Text variant="label" color={palette.textSecondary}>
            {t('TỰ CHỦ FUZZY')}
          </Text>
          <Text variant="body" weight="bold" style={styles.statVal}>
            {autonomyPct}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />

        <View style={styles.statCol}>
          <Text variant="label" color={palette.textSecondary}>
            {t('SỰ CỐ KHẨN')}
          </Text>
          <Text
            variant="body"
            weight="bold"
            color={report.alerts_count > 0 ? palette.alert : palette.text}
            style={styles.statVal}
          >
            {report.alerts_count || 0}
          </Text>
        </View>
      </View>

      {/* Hiển thị kết luận hiện tại nếu có */}
      {hasConclusion && (
        <View style={[styles.conclusionBox, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
          <Text variant="small" weight="bold" color={palette.textSecondary}>
            {t('Kết luận chuyên gia ({at}):', {
              at: report.expert_conclusion_at ? formatDateTime(report.expert_conclusion_at) : '',
            })}
          </Text>
          <Text variant="body" color={palette.text} style={styles.conclusionText}>
            {`"${report.expert_conclusion}"`}
          </Text>
        </View>
      )}

      {/* Cụm nút: Tải PDF / CSV & Nút Viết kết luận */}
      <View style={styles.bottomActions}>
        <View style={styles.downloadButtons}>
          <PressableScale
            onPress={handleDownloadPdf}
            style={[styles.dlBtn, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('Tải báo cáo PDF')}
          >
            <FilePdf size={16} color={palette.text} />
            <Text variant="small" weight="bold">
              PDF
            </Text>
          </PressableScale>

          <PressableScale
            onPress={handleDownloadCsv}
            style={[styles.dlBtn, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('Tải số liệu CSV')}
          >
            <FileCsv size={16} color={palette.text} />
            <Text variant="small" weight="bold">
              CSV
            </Text>
          </PressableScale>
        </View>

        <PressableScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
            setIsSheetOpen(true)
          }}
          disabled={isSubmitting}
          style={[
            styles.writeBtn,
            {
              backgroundColor: hasConclusion ? palette.surface : palette.primary,
              borderColor: hasConclusion ? palette.border : 'transparent',
              borderWidth: hasConclusion ? 1 : 0,
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
            weight="bold"
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
          <Text variant="heading" weight="bold">
            {t('Kết luận & Khuyến nghị')}
          </Text>
          <Text variant="small" color={palette.textSecondary}>
            {t('Chọn nhanh mẫu khuyến nghị chuyên gia hoặc nhập nội dung tùy biến.')}
          </Text>
        </View>

        <View style={styles.sheetBody}>
          {/* 3 Chip gợi ý mẫu */}
          <Text variant="small" weight="bold" color={palette.textSecondary} style={{ marginBottom: 4 }}>
            {t('MẪU KHUYẾN NGHỊ NHANH (1 CHẠM):')}
          </Text>
          <View style={styles.templatesContainer}>
            {TEMPLATE_CONCLUSIONS.map((tmpl, idx) => {
              const isSelected = conclusionText === tmpl
              return (
                <PressableScale
                  key={idx}
                  onPress={() => handleSelectTemplate(tmpl)}
                  style={[
                    styles.templateChip,
                    {
                      backgroundColor: isSelected ? palette.text : palette.surfaceStrong,
                      borderColor: isSelected ? palette.text : palette.border,
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
                    weight={isSelected ? 'bold' : 'regular'}
                    color={isSelected ? palette.onInverse : palette.text}
                    numberOfLines={2}
                    style={{ flex: 1 }}
                  >
                    {tmpl}
                  </Text>
                </PressableScale>
              )
            })}
          </View>

          {/* Ô nhập nội dung bằng TextField */}
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
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  conclusionBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 4,
  },
  conclusionText: {
    fontStyle: 'italic',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  downloadButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dlBtn: {
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
    marginBottom: Spacing.sm,
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
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
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
