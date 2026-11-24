import { StyleSheet, View } from 'react-native'
import { SettingsInput, type SettingsInputProps } from '@/components/farm/settings/SettingsInput'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

export interface SettingsMetaItem {
  label: string
  // Chế độ xem: giá trị đậm dưới nhãn; chưa có thì "_"
  value?: string
  // Chế độ sửa: ô nhập thay cho giá trị
  input?: SettingsInputProps
  error?: string | null
  // Ô chiếm cả hàng (địa chỉ dài)
  isFullWidth?: boolean
}

interface SettingsMetaGridProps {
  items: SettingsMetaItem[]
}

// Lưới thông tin 2 cột như "BILL TO / ISSUED" trong ảnh mẫu: nhãn nhỏ viết hoa, dưới là giá trị đậm hoặc ô nhập
export function SettingsMetaGrid({ items }: SettingsMetaGridProps) {
  const palette = usePalette()

  return (
    <View style={styles.grid}>
      {items.map(item => (
        <View
          key={item.label}
          style={[styles.item, item.isFullWidth && styles.fullWidth]}
          accessible={!item.input}
          accessibilityLabel={item.input ? undefined : `${item.label}: ${item.value ?? '_'}`}
        >
          <Text
            variant="small"
            weight="semiBold"
            color={palette.textSecondary}
            style={styles.overline}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {item.input ? (
            <SettingsInput align="left" {...item.input} hasError={Boolean(item.error)} />
          ) : (
            <Text variant="body" weight="semiBold" numberOfLines={3}>
              {item.value || '_'}
            </Text>
          )}
          {item.error ? (
            <Text variant="small" color={palette.alert} accessibilityLiveRegion="polite">
              {item.error}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.md, columnGap: Spacing.lg },
  // Hai cột: mỗi ô gần nửa hàng
  item: { flexGrow: 1, flexBasis: '40%', minWidth: 0, gap: Spacing.xs },
  fullWidth: { flexBasis: '100%' },
  overline: { textTransform: 'uppercase', letterSpacing: 1 },
})
