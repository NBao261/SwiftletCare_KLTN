import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraIcon, XIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Colors, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { LocalPhoto } from '@/types'
import { t } from '@/utils/i18n.utils'

const THUMBNAIL_SIZE = 64
const SHUTTER_SIZE = 72
// Chất lượng JPEG: ảnh 12 MP còn khoảng 1–2 MB, dưới giới hạn 5 MB mỗi ảnh của backend
const PHOTO_QUALITY = 0.5

interface PhotoCaptureFieldProps {
  photos: LocalPhoto[]
  onChange: (photos: LocalPhoto[]) => void
  // Số ảnh tối đa (Work Order: 5, kiểm tra tại chỗ: 1)
  maxPhotos: number
  disabled?: boolean
}

// Ô ảnh của form tại chỗ (ALERT-FR-018, EXPERT-FR-021): chụp bằng camera sau (expo-camera), xem ảnh nhỏ, bỏ ảnh; chưa cấp quyền
// camera thì hỏi ngay trong khung chụp. Ảnh chỉ nằm ở file tạm trên máy tới khi form gửi đi
export function PhotoCaptureField({ photos, onChange, maxPhotos, disabled = false }: PhotoCaptureFieldProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [isCameraOpen, setCameraOpen] = useState(false)
  const [isCapturing, setCapturing] = useState(false)
  const canAddMore = photos.length < maxPhotos

  const capture = async () => {
    if (!cameraRef.current || isCapturing) return
    setCapturing(true)
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: PHOTO_QUALITY })
      onChange([...photos, { uri: picture.uri }])
      setCameraOpen(false)
    } catch (error) {
      console.warn('Không chụp được ảnh', error)
    } finally {
      setCapturing(false)
    }
  }

  const renderCamera = () => {
    if (!permission) return null
    if (!permission.granted) {
      return (
        <View style={[styles.permission, { backgroundColor: palette.surface }]}>
          <EmptyState
            message={
              permission.canAskAgain
                ? t('Cần quyền camera để chụp ảnh tại chỗ')
                : t('Camera đã bị chặn. Bật lại trong Cài đặt của máy')
            }
            actionLabel={permission.canAskAgain ? t('Cho phép camera') : undefined}
            onAction={permission.canAskAgain ? requestPermission : undefined}
          />
        </View>
      )
    }
    return (
      <>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" accessibilityLabel={t('Khung chụp ảnh')} />
        <View style={[styles.shutterBar, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <Pressable
            onPress={capture}
            disabled={isCapturing}
            accessibilityRole="button"
            accessibilityLabel={t('Chụp')}
            style={[styles.shutter, { borderColor: Colors.raw.pureWhite, opacity: isCapturing ? 0.5 : 1 }]}
          />
        </View>
      </>
    )
  }

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        {photos.map((photo, index) => (
          <View key={photo.uri} style={styles.thumbnailBox}>
            <Image
              source={{ uri: photo.uri }}
              style={[styles.thumbnail, { backgroundColor: palette.surfaceStrong }]}
              contentFit="cover"
              accessibilityLabel={t('Ảnh {n}', { n: index + 1 })}
            />
            {!disabled && (
              <Pressable
                onPress={() => onChange(photos.filter(item => item.uri !== photo.uri))}
                hitSlop={Spacing.sm}
                accessibilityRole="button"
                accessibilityLabel={t('Bỏ ảnh {n}', { n: index + 1 })}
                style={[styles.remove, { backgroundColor: palette.inverse }]}
              >
                <XIcon size={12} color={palette.onInverse} weight="bold" />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {canAddMore && (
        <Button
          label={photos.length === 0 ? t('Chụp ảnh') : t('Chụp thêm ({n}/{max})', { n: photos.length, max: maxPhotos })}
          variant="secondary"
          size="sm"
          trailingIcon={CameraIcon}
          onPress={() => setCameraOpen(true)}
          disabled={disabled}
          style={[styles.addButton, { borderColor: palette.border }]}
        />
      )}
      <Modal visible={isCameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={[styles.camera, { backgroundColor: Colors.raw.ink }]}>
          {renderCamera()}
          <View style={[styles.closeBar, { top: insets.top + Spacing.sm }]}>
            <View style={[styles.closeButton, { backgroundColor: palette.surface }]}>
              <IconButton icon={XIcon} label={t('Đóng camera')} onPress={() => setCameraOpen(false)} />
            </View>
          </View>
          {!permission && (
            <Text variant="small" color={palette.onInverse} center>
              {t('Đang mở camera')}
            </Text>
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumbnailBox: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
  thumbnail: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: Radius.sm },
  remove: {
    position: 'absolute',
    top: -Spacing.xs,
    right: -Spacing.xs,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: { alignSelf: 'flex-start', borderWidth: BorderWidth.hairline },
  camera: { flex: 1, justifyContent: 'center' },
  permission: { margin: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.lg },
  shutterBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  shutter: { width: SHUTTER_SIZE, height: SHUTTER_SIZE, borderRadius: Radius.full, borderWidth: 4 },
  closeBar: { position: 'absolute', right: Spacing.lg },
  closeButton: { borderRadius: Radius.full },
})
