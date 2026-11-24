import { StyleSheet, View } from 'react-native'
import { LockIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

interface ComingSoonActionProps {
  label: string
}

// Thao tác chưa có API ở backend (sửa tên, xoá nhà và tầng — FARM-FR-002): hiện dạng khoá kèm nhãn "Sắp có", không bấm được
export function ComingSoonAction({ label }: ComingSoonActionProps) {
  const palette = usePalette()

  return (
    <View
      style={[styles.action, { borderColor: palette.border }]}
      accessible
      accessibilityLabel={t('{action}, sắp có', { action: label })}
      accessibilityState={{ disabled: true }}
    >
      <LockIcon size={14} color={palette.textSecondary} />
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {label}
      </Text>
      <View style={[styles.badge, { backgroundColor: palette.surfaceStrong }]}>
        <Text variant="small" color={palette.textSecondary}>
          {t('Sắp có')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.full,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm },
})
