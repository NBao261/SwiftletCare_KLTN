import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraIcon, XIcon } from 'phosphor-react-native'
import { BUTTON_HEIGHTS, Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { LocalPhoto } from '@/types'
import { t } from '@/utils/i18n.utils'

const THUMBNAIL_SIZE = 64
const SHUTTER_SIZE = 72
// Nút bỏ ảnh: chấm tròn cỡ Spacing.xl ở góc ảnh nhỏ, hitSlop bù cho đủ vùng chạm 44 (MOBILE_GUIDE 3.7)
const REMOVE_BADGE_SIZE = Spacing.xl
const REMOVE_HIT_SLOP = (BUTTON_HEIGHTS.md - REMOVE_BADGE_SIZE) / 2
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
  const [captureError, setCaptureError] = useState<string | null>(null)
  const canAddMore = photos.length < maxPhotos

  const openCamera = () => {
    setCaptureError(null)
    setCameraOpen(true)
  }

  const capture = async () => {
    if (!cameraRef.current || isCapturing) return
    setCapturing(true)
    setCaptureError(null)
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: PHOTO_QUALITY })
      onChange([...photos, { uri: picture.uri }])
      setCameraOpen(false)
    } catch (error) {
      console.warn('Không chụp được ảnh', error)
      setCaptureError(t('Không chụp được ảnh. Vui lòng thử lại'))
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
          {captureError && (
            <Text variant="small" color={Colors.raw.pureWhite} center accessibilityLiveRegion="polite">
              {captureError}
            </Text>
          )}
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
                hitSlop={REMOVE_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={t('Bỏ ảnh {n}', { n: index + 1 })}
                style={[styles.remove, { backgroundColor: palette.inverse }]}
              >
                <XIcon size={14} color={palette.onInverse} weight="bold" />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {canAddMore && (
        <Button
          label={photos.length === 0 ? t('Chụp ảnh') : t('Chụp thêm ({n}/{max})', { n: photos.length, max: maxPhotos })}
          variant="outline"
          size="sm"
          trailingIcon={CameraIcon}
          onPress={openCamera}
          disabled={disabled}
          style={styles.addButton}
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
    width: REMOVE_BADGE_SIZE,
    height: REMOVE_BADGE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: { alignSelf: 'flex-start' },
  camera: { flex: 1, justifyContent: 'center' },
  permission: { margin: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.lg },
  shutterBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: Spacing.md },
  shutter: { width: SHUTTER_SIZE, height: SHUTTER_SIZE, borderRadius: Radius.full, borderWidth: Spacing.xs },
  closeBar: { position: 'absolute', right: Spacing.lg },
  closeButton: { borderRadius: Radius.full },
})
