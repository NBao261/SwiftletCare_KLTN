import { StyleSheet, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

interface CellularPlaybackPromptProps {
  onAllow: () => void
  onDecline: () => void
}

// Câu hỏi một lần trong khung camera khi đang dùng dữ liệu di động: có tự phát live stream không
export function CellularPlaybackPrompt({ onAllow, onDecline }: CellularPlaybackPromptProps) {
  const palette = usePalette()

  return (
    <View style={styles.prompt}>
      <Text variant="body" weight="semiBold" color={palette.onInverse} center>
        {t('Bạn đang dùng dữ liệu di động')}
      </Text>
      <Text variant="small" color={palette.onInverseSecondary} center>
        {t('Tự phát camera khi dùng dữ liệu di động?')}
      </Text>
      <View style={styles.actions}>
        <Button label={t('Không')} variant="link" size="sm" color={palette.onInverse} onPress={onDecline} />
        <Button label={t('Luôn phát')} size="sm" onPress={onAllow} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  prompt: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
})
