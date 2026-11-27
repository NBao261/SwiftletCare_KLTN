import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Skeleton } from '@/components/ui/skeleton'
import { RetryLine } from '@/components/common/RetryLine'
import { Text } from '@/components/ui/text'
import { Radius } from '@/constants/theme'
import { useHarvestRunPhoto } from '@/hooks/harvest/useHarvestRunPhoto'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Ảnh ngang 4:3 như ảnh chụp từ camera điện thoại
const PHOTO_ASPECT_RATIO = 4 / 3
const PHOTO_SKELETON_HEIGHT = 120

interface HarvestRunPhotoProps {
  harvestIds: string[]
}

// Ảnh đã lưu của một lần thu (HARVEST-FR-001): đang tải thì khung xương, chưa có ảnh thì một dòng chữ. Link ảnh là link ký sẵn
// của kho file; máy không mở được link (mất mạng, link hết hạn, kho file đặt ở địa chỉ điện thoại không tới được) thì báo và cho
// thử lại, không để khung trống
export function HarvestRunPhoto({ harvestIds }: HarvestRunPhotoProps) {
  const palette = usePalette()
  const { photoUrl, isLoading, isError, refetch } = useHarvestRunPhoto(harvestIds)
  // Link ảnh tải không được (ảnh lỗi), khác với lỗi khi đọc chi tiết đợt
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (isLoading) return <Skeleton width="100%" height={PHOTO_SKELETON_HEIGHT} radius={Radius.md} />
  if (isError || (photoUrl && failedUrl === photoUrl)) {
    return (
      <RetryLine
        message={t('Không tải được ảnh lần thu')}
        onRetry={() => {
          setFailedUrl(null)
          refetch()
        }}
      />
    )
  }
  if (!photoUrl) {
    return (
      <Text variant="small" color={palette.textSecondary}>
        {t('Chưa có ảnh')}
      </Text>
    )
  }
  return (
    <Image
      source={{ uri: photoUrl }}
      style={[styles.photo, { backgroundColor: palette.surfaceStrong }]}
      contentFit="cover"
      onError={() => setFailedUrl(photoUrl)}
      accessibilityLabel={t('Ảnh lần thu')}
    />
  )
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: PHOTO_ASPECT_RATIO, borderRadius: Radius.md },
})
