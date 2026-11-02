import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { BellIcon, MagnifyingGlassIcon, ScanIcon } from 'phosphor-react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useUnreadNotificationCount } from '@/hooks/notification/useUnreadNotificationCount'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/utils/name.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const AVATAR_SIZE = 44

// Đầu Trang chủ: ảnh đại diện + tên bên trái; tìm kiếm, quét QR, thông báo bên phải
export function HomeHeader() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const { data: unreadCount = 0 } = useUnreadNotificationCount()

  return (
    <AppHeader
      leading={
        <View style={styles.user}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} accessible={false} />
          ) : (
            <View style={[styles.avatar, styles.initials, { backgroundColor: palette.primary }]}>
              <Text variant="body" weight="bold" color={palette.onPrimary}>
                {getInitials(user?.full_name ?? '')}
              </Text>
            </View>
          )}
          <Text variant="body" weight="bold" numberOfLines={1} style={styles.name}>
            {user?.full_name || '_'}
          </Text>
        </View>
      }
      right={
        <View style={styles.actions}>
          {/* shortcut: chưa có màn tìm kiếm (Report 3 chưa có yêu cầu) — gắn onPress khi nhóm chốt màn */}
          <IconButton icon={MagnifyingGlassIcon} label={t('Tìm kiếm')} />
          {/* Thiết lập thiết bị bằng QR (MF-10) — gắn onPress khi có route device-setup */}
          {canPerform(user, 'setupDevice') && <IconButton icon={ScanIcon} label={t('Quét mã QR thiết bị')} />}
          {/* Thông báo trong ứng dụng (EXPERT-FR-009) — gắn onPress khi có route profile/notifications */}
          <IconButton icon={BellIcon} label={t('Thông báo')} badgeCount={unreadCount} />
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  user: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: Radius.full },
  initials: { alignItems: 'center', justifyContent: 'center' },
  // flex 1 + minWidth 0: tên dài thì cắt "…", không đẩy các nút bên phải
  name: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
})
