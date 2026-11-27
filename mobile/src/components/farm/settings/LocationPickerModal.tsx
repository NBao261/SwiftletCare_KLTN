import { useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CrosshairIcon } from 'phosphor-react-native'
import { LocationMap } from '@/components/farm/LocationMap'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useCurrentLocation } from '@/hooks/farm/useCurrentLocation'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Coordinates } from '@/types'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Toạ độ hiện 6 chữ số lẻ như lúc lấy từ GPS
const COORDINATE_DECIMALS = 6

interface LocationPickerModalProps {
  visible: boolean
  // Vị trí lúc mở; null thì bản đồ mở ở khung cả Việt Nam
  initial: Coordinates | null
  onConfirm: (coordinates: Coordinates) => void
  onClose: () => void
}

// Màn ghim vị trí trang trại toàn màn hình (FARM-FR-001): ghim đứng yên ở giữa bản đồ. Đứng tại trang trại thì bấm "Vị trí hiện
// tại", bản đồ tự tới đó; ở nơi khác thì kéo, phóng bản đồ cho ghim nằm đúng nhà yến. "Dùng vị trí này" điền toạ độ vào form;
// quay lại thì không đổi gì
export function LocationPickerModal({ visible, initial, onConfirm, onClose }: LocationPickerModalProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const location = useCurrentLocation()
  const [picked, setPicked] = useState<Coordinates | null>(initial)

  const locateHere = async () => {
    const coordinates = await location.locate()
    if (coordinates) setPicked(coordinates)
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <AppHeader title={t('Ghim vị trí trên bản đồ')} onBack={onClose} />
        <View style={styles.map}>
          <LocationMap coordinates={picked} onPick={setPicked} />
        </View>
        <View style={[styles.panel, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: palette.surface }]}>
          <Text variant="body" weight="semiBold">
            {picked
              ? t('Vĩ độ {lat} · Kinh độ {lng}', {
                  lat: formatDecimal(picked.lat, COORDINATE_DECIMALS),
                  lng: formatDecimal(picked.lng, COORDINATE_DECIMALS),
                })
              : t('Kéo bản đồ để đặt ghim')}
          </Text>
          <Text variant="small" color={palette.textSecondary}>
            {t('Đứng tại trang trại thì bấm Vị trí hiện tại. Ở nơi khác thì kéo bản đồ cho ghim ở giữa nằm đúng nhà yến.')}
          </Text>
          <FormMessage message={location.error} />
          <View style={styles.actions}>
            <Button
              label={t('Vị trí hiện tại')}
              variant="outline"
              size="md"
              trailingIcon={CrosshairIcon}
              onPress={locateHere}
              loading={location.isLocating}
              style={styles.flex}
            />
            <Button
              label={t('Dùng vị trí này')}
              size="md"
              onPress={() => picked && onConfirm(picked)}
              disabled={!picked}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  panel: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
})
