import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/ui/text'
import { Radius } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { getInitial } from '@/utils/account.utils'

const AVATAR_SIZE = 96

interface ProfileAvatarProps {
  fullName?: string
  avatarUrl?: string
}

// Ảnh đại diện tròn ở đầu trang Tài khoản; chưa có ảnh thì chữ cái đầu của tên. Report 3 không có yêu cầu đổi ảnh
// đại diện nên không có nút sửa
export function ProfileAvatar({ fullName, avatarUrl }: ProfileAvatarProps) {
  const palette = usePalette()

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} accessible={false} />
  }

  return (
    <View style={[styles.avatar, styles.initial, { backgroundColor: palette.primary }]} accessible={false}>
      <Text variant="title" weight="semiBold" color={palette.onPrimary}>
        {getInitial(fullName)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: Radius.full },
  initial: { alignItems: 'center', justifyContent: 'center' },
})
