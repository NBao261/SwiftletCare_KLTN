import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { BorderWidth, Radius } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Khung ngắm vuông giữa vùng camera
const FRAME_RATIO = '60%'

interface QrScannerProps {
  // Đọc được một mã: gửi chữ trong mã ra ngoài, rồi khoá tới khi màn dựng lại (đổi key) để không đọc lặp
  onScanned: (data: string) => void
}

// Quét mã QR bằng camera sau (expo-camera, MF-10): chỉ nhận mã QR; chưa cấp quyền camera thì hỏi
export function QrScanner({ onScanned }: QrScannerProps) {
  const palette = usePalette()
  const [permission, requestPermission] = useCameraPermissions()
  const [isLocked, setLocked] = useState(false)

  if (!permission) return <Skeleton width="100%" height={280} />
  if (!permission.granted) {
    return (
      <EmptyState
        message={
          permission.canAskAgain
            ? t('Cần quyền camera để quét nhãn QR')
            : t('Camera đã bị chặn. Bật lại trong Cài đặt của máy hoặc nhập tay')
        }
        actionLabel={permission.canAskAgain ? t('Cho phép camera') : undefined}
        onAction={permission.canAskAgain ? requestPermission : undefined}
      />
    )
  }

  return (
    <View style={[styles.viewport, { backgroundColor: palette.inverse }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          isLocked
            ? undefined
            : ({ data }) => {
                setLocked(true)
                onScanned(data)
              }
        }
        accessibilityLabel={t('Khung camera quét mã QR')}
      />
      <View style={[styles.frame, { borderColor: palette.primary }]} pointerEvents="none" />
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_RATIO,
    aspectRatio: 1,
    borderWidth: BorderWidth.strong * 2,
    borderRadius: Radius.md,
  },
})
