import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/ui/text'
import { Radius } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { getInitials } from '@/utils/name.utils'

const AVATAR_SIZE = 80

interface ProfileAvatarProps {
  fullName?: string
  avatarUrl?: string
}

// Ảnh đại diện tròn ở đầu trang Tài khoản; chưa có ảnh thì 2 chữ viết tắt như ở Trang chủ (getInitials). Report 3
// không có yêu cầu đổi ảnh đại diện nên không có nút sửa
export function ProfileAvatar({ fullName, avatarUrl }: ProfileAvatarProps) {
  const palette = usePalette()

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} accessible={false} />
  }

  return (
    <View style={[styles.avatar, styles.initials, { backgroundColor: palette.primary }]} accessible={false}>
      <Text variant="title" weight="bold" color={palette.onPrimary}>
        {getInitials(fullName ?? '')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: Radius.full },
  initials: { alignItems: 'center', justifyContent: 'center' },
})
