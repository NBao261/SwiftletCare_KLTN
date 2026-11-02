import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ArrowsCounterClockwise, CheckCircle, XCircle } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { FontFamily, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { InferredAlert, VerdictResult } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

interface InlineVerdictFormProps {
  alert: InferredAlert
  onSubmitVerdict: (result: VerdictResult, note?: string) => Promise<void> | void
  isSubmitting?: boolean
}

const REASON_SUGGESTIONS = [
  'Cảm biến trôi số',
  'Mưa to gây ồn',
  'Chủ nhà thao tác tay',
  'Sự cố quạt thông gió',
]

/**
 * Cụm Form Kiểm chứng tại chỗ (Inline Verdict Form).
 * Đặt ngay dưới ngăn bằng chứng đa phương thức (EXPERT-FR-003, ALERT-FR-014).
 * Sử dụng TextField & PressableScale chuẩn hóa đồng bộ với FARM_OWNER.
 */
export function InlineVerdictForm({ alert, onSubmitVerdict, isSubmitting = false }: InlineVerdictFormProps) {
  const palette = usePalette()
  const hasExistingVerdict = Boolean(alert.expert_verdict)

  const [isEditing, setIsEditing] = useState(!hasExistingVerdict)
  const [note, setNote] = useState(alert.expert_verdict?.note ?? '')
  const [errorText, setErrorText] = useState<string | null>(null)

  const handleSelectReason = (reason: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    setErrorText(null)
    setNote(prev => {
      const trimmed = prev.trim()
      if (!trimmed) return reason
      if (trimmed.includes(reason)) return prev
      return `${trimmed}; ${reason}`
    })
  }

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setErrorText(null)
    await onSubmitVerdict('CONFIRMED', note.trim() || undefined)
    setIsEditing(false)
  }

  const handleReject = async () => {
    if (!note.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
      setErrorText(t('Bắt buộc nhập lý do khi bác bỏ cảnh báo (tránh lỗi 422)'))
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setErrorText(null)
    await onSubmitVerdict('REJECTED', note.trim())
    setIsEditing(false)
  }

  // Nếu đã có phán quyết và chưa bật chế độ sửa: Hiện thẻ tóm tắt kết quả
  if (hasExistingVerdict && !isEditing && alert.expert_verdict) {
    const isConfirmed = alert.expert_verdict.result === 'CONFIRMED'
    const expertName = alert.expert_verdict.by?.full_name || t('Chuyên gia')
    const verdictTime = formatDateTime(alert.expert_verdict.at)

    return (
      <View style={[styles.existingCard, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
        <View style={styles.existingHeader}>
          <View
            style={[
              styles.existingBadge,
              { backgroundColor: isConfirmed ? palette.primary : palette.inverse },
            ]}
          >
            {isConfirmed ? (
              <CheckCircle size={14} weight="bold" color={palette.onPrimary} />
            ) : (
              <XCircle size={14} weight="bold" color={palette.onInverse} />
            )}
            <Text
              variant="label"
              weight="bold"
              color={isConfirmed ? palette.onPrimary : palette.onInverse}
            >
              {isConfirmed ? t('ĐÃ XÁC NHẬN SỰ CỐ') : t('ĐÃ BÁC BỎ (BÁO SAI)')}
            </Text>
          </View>

          <PressableScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
              setIsEditing(true)
            }}
            style={[
              styles.changeVerdictButton,
              {
                borderColor: palette.border,
                backgroundColor: palette.surface,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('Đổi phán quyết')}
          >
            <ArrowsCounterClockwise size={14} color={palette.text} />
            <Text variant="small" weight="semiBold" color={palette.text} style={{ marginLeft: 4 }}>
              {t('Đổi phán quyết')}
            </Text>
          </PressableScale>
        </View>

        <Text variant="small" color={palette.textSecondary} style={styles.existingMeta}>
          {expertName} · {verdictTime}
        </Text>

        {Boolean(alert.expert_verdict.note) && (
          <Text variant="small" style={styles.existingNote}>
            {`"${alert.expert_verdict.note}"`}
          </Text>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.formContainer, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
      <Text variant="small" weight="bold">
        {t('Phán quyết chuyên môn (EXPERT-FR-003)')}
      </Text>

      {/* 4 Chip gợi ý lý do 1 chạm */}
      <View style={styles.chipsContainer}>
        {REASON_SUGGESTIONS.map(reason => {
          const isSelected = note.includes(reason)
          return (
            <PressableScale
              key={reason}
              onPress={() => handleSelectReason(reason)}
              style={[
                styles.reasonChip,
                {
                  backgroundColor: isSelected ? palette.text : palette.surface,
                  borderColor: isSelected ? palette.text : palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={reason}
            >
              <Text
                variant="small"
                weight={isSelected ? 'bold' : 'medium'}
                color={isSelected ? palette.onInverse : palette.text}
              >
                {reason}
              </Text>
            </PressableScale>
          )
        })}
      </View>

      {/* Ô nhập ghi chú dùng TextField gốc */}
      <View style={styles.inputWrapper}>
        <TextField
          label={t('Ghi chú phán quyết')}
          value={note}
          onChangeText={val => {
            setNote(val)
            if (errorText) setErrorText(null)
          }}
          placeholder={t('Nhập nhận định chuyên môn (bắt buộc khi Bác bỏ)...')}
          multiline
          numberOfLines={3}
          error={errorText}
        />
      </View>

      {/* Cụm 2 nút hành động chính cao 44pt dùng PressableScale */}
      <View style={styles.actionRow}>
        <PressableScale
          onPress={handleReject}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            styles.rejectButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Bác bỏ báo sai')}
        >
          <XCircle size={18} weight="bold" color={palette.text} />
          <Text variant="body" weight="bold" color={palette.text}>
            {t('✕ Bác bỏ')}
          </Text>
        </PressableScale>

        <PressableScale
          onPress={handleConfirm}
          disabled={isSubmitting}
          style={[
            styles.actionButton,
            styles.confirmButton,
            {
              backgroundColor: palette.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Xác nhận sự cố')}
        >
          <CheckCircle size={18} weight="bold" color={palette.onPrimary} />
          <Text variant="body" weight="bold" color={palette.onPrimary}>
            {t('✓ Xác nhận sự cố')}
          </Text>
        </PressableScale>
      </View>

      {/* Nút hủy khi đang ở chế độ đổi phán quyết */}
      {hasExistingVerdict && isEditing && (
        <PressableScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
            setIsEditing(false)
            setNote(alert.expert_verdict?.note ?? '')
            setErrorText(null)
          }}
          style={styles.cancelButton}
          accessibilityRole="button"
          accessibilityLabel={t('Hủy chỉnh sửa')}
        >
          <Text variant="small" color={palette.textSecondary}>
            {t('Hủy thay đổi')}
          </Text>
        </PressableScale>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  formContainer: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  reasonChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  inputWrapper: {
    marginTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
  },
  rejectButton: {
    borderWidth: 1,
  },
  confirmButton: {
    borderWidth: 0,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  existingCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  existingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  existingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  changeVerdictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  existingMeta: {
    marginTop: 4,
  },
  existingNote: {
    marginTop: 4,
    fontFamily: FontFamily.medium,
    fontStyle: 'italic',
  },
})
