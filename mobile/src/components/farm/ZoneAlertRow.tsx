import { StyleSheet } from 'react-native'
import { CaretRightIcon, WarningIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { getSeverityLevel, getSeverityLevelColors } from '@/utils/severity.utils'
import { t } from '@/utils/i18n.utils'

interface ZoneAlertRowProps {
  count: number
  severity: AlertSeverity
  onPress: () => void
}

// Một hàng cảnh báo ngay trên lưới cảm biến, màu theo mức cao nhất; chỉ hiện khi zone có cảnh báo
export function ZoneAlertRow({ count, severity, onPress }: ZoneAlertRowProps) {
  const palette = usePalette()
  const colors = getSeverityLevelColors(getSeverityLevel(severity), palette)
  const label = t('{count} cảnh báo đang hiệu lực', { count })

  return (
    <Card style={[styles.row, { backgroundColor: colors.background }]} onPress={onPress} accessibilityLabel={label}>
      <WarningIcon size={20} color={colors.text} weight="bold" />
      <Text variant="body" weight="semiBold" color={colors.text} style={styles.text}>
        {label}
      </Text>
      <CaretRightIcon size={16} color={colors.text} />
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  text: { flex: 1 },
})
