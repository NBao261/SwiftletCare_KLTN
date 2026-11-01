import { StyleSheet, View } from 'react-native'
import { CrosshairIcon } from 'phosphor-react-native'
import { SettingsTileButton } from '@/components/farm/settings/SettingsTileButton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useCurrentLocation } from '@/hooks/farm/useCurrentLocation'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Coordinates } from '@/types'
import { t } from '@/utils/i18n.utils'

interface LocateRowProps {
  // Lấy được toạ độ: điền vào hai ô vĩ độ, kinh độ (vẫn sửa tay được)
  onLocated: (coordinates: Coordinates) => void
}

// Dòng "Lấy vị trí hiện tại" như chân card ảnh mẫu: câu hướng dẫn bên trái, ô vuông icon định vị bên phải.
// Chỉ xin quyền vị trí khi bấm (FARM-FR-001)
export function LocateRow({ onLocated }: LocateRowProps) {
  const palette = usePalette()
  const location = useCurrentLocation()

  const handlePress = async () => {
    const coordinates = await location.locate()
    if (coordinates) onLocated(coordinates)
  }

  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold">
          {t('Lấy vị trí hiện tại')}
        </Text>
        <Text variant="small" color={location.error ? palette.alert : palette.textSecondary}>
          {location.error ?? t('Đứng tại nhà yến rồi bấm để điền toạ độ, hoặc gõ tay')}
        </Text>
      </View>
      <SettingsTileButton
        icon={CrosshairIcon}
        label={t('Lấy vị trí hiện tại')}
        onPress={handlePress}
        loading={location.isLocating}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  texts: { flex: 1, gap: Spacing.xs },
})
