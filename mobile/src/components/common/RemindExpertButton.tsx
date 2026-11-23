import { StyleSheet, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useRemindExpert } from '@/hooks/expert-activity/useRemindExpert'
import { usePalette } from '@/hooks/theme/usePalette'
import type { ExpertReminderKind } from '@/types'
import { t } from '@/utils/i18n.utils'

interface RemindExpertButtonProps {
  kind: ExpertReminderKind
  // Id của cảnh báo, báo cáo hoặc mùa vụ cần chuyên gia kết luận
  id: string
  remindedAt: string | null | undefined
}

// "Nhắc chuyên gia" cho việc chỉ chuyên gia làm (BR-22 nhóm C): nhắc rồi thành chữ "Đã nhắc chuyên gia", backend báo 409 thì ẩn.
// Màn gọi chỉ hiện nút cho Farm Owner trên farm có chuyên gia (canPerform remindExpert) và khi việc còn chờ
export function RemindExpertButton({ kind, id, remindedAt }: RemindExpertButtonProps) {
  const palette = usePalette()
  const reminder = useRemindExpert(kind, id, remindedAt)

  if (reminder.isHidden) return null
  if (reminder.reminded) {
    return (
      <Text variant="small" color={palette.textSecondary}>
        {t('Đã nhắc chuyên gia')}
      </Text>
    )
  }
  return (
    <View style={styles.block}>
      <Button
        label={t('Nhắc chuyên gia')}
        variant="outline"
        size="sm"
        onPress={reminder.remind}
        loading={reminder.isPending}
        style={styles.button}
      />
      <FormMessage message={reminder.error} />
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: Spacing.xs },
  button: { alignSelf: 'flex-start' },
})
