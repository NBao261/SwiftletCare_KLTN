import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { MapPinIcon } from 'phosphor-react-native'
import { LocationMap } from '@/components/farm/LocationMap'
import { LocationPickerModal } from '@/components/farm/settings/LocationPickerModal'
import { Button } from '@/components/ui/button'
import { Spacing } from '@/constants/theme'
import type { Coordinates } from '@/types'
import { t } from '@/utils/i18n.utils'

// Bản đồ xem trước trong form: đủ thấy khu vực quanh ghim mà không chiếm cả màn
const PREVIEW_HEIGHT = 160

interface CoordinatesMapFieldProps {
  // Toạ độ đang có trong form (hai ô vĩ độ, kinh độ đã hợp lệ); null thì chưa có ghim
  value: Coordinates | null
  onChange: (coordinates: Coordinates) => void
}

// Khối bản đồ của form toạ độ trang trại: bản đồ xem trước theo hai ô vĩ độ, kinh độ; chạm vào bản đồ hoặc nút "Ghim trên bản đồ"
// mở màn ghim toàn màn hình (ghim cố định ở giữa, kéo và phóng bản đồ), chọn xong thì điền lại hai ô. Bản đồ xem trước không nhận
// vuốt nên trang vẫn cuộn bình thường khi vuốt qua
export function CoordinatesMapField({ value, onChange }: CoordinatesMapFieldProps) {
  const [isPickerOpen, setPickerOpen] = useState(false)

  return (
    <View style={styles.field}>
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('Mở bản đồ để ghim vị trí')}
      >
        <LocationMap coordinates={value} height={PREVIEW_HEIGHT} />
      </Pressable>
      <Button
        label={value ? t('Sửa ghim trên bản đồ') : t('Ghim trên bản đồ')}
        variant="outline"
        size="md"
        trailingIcon={MapPinIcon}
        onPress={() => setPickerOpen(true)}
      />
      {/* Chỉ dựng màn ghim khi mở: mỗi lần mở bắt đầu từ toạ độ đang có trong form */}
      {isPickerOpen && (
        <LocationPickerModal
          visible
          initial={value}
          onConfirm={coordinates => {
            onChange(coordinates)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
})
