import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface PlaceholderScreenProps {
  title: string
}

// Màn tạm cho menu chưa gán route thật — đổi menu ở src/constants/roleTabs.ts
export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  const palette = usePalette()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={title} />
      <View style={styles.content}>
        <Text variant="small" color={palette.textSecondary}>
          Đang xây dựng
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
})
