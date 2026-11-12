import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { BellButton } from '@/components/common/BellButton'
import { AppHeader } from '@/components/layout/AppHeader'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/utils/name.utils'
import { t } from '@/utils/i18n.utils'

const AVATAR_SIZE = 44

// Đầu Trang chủ: ảnh đại diện + tên bên trái (bấm mở trang Tài khoản); thông báo bên phải
export function HomeHeader() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)

  return (
    <AppHeader
      leading={
        // Bấm ảnh hoặc tên: chuyển sang tab Tài khoản (navigate như các link chuyển tab khác), mốc thời gian để trang cuộn về đầu
        <PressableScale
          style={styles.user}
          onPress={() => router.navigate({ pathname: '/(tabs)/profile', params: { scrollToTopAt: String(Date.now()) } })}
          accessibilityRole="button"
          accessibilityLabel={t('Mở trang Tài khoản')}
        >
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
        </PressableScale>
      }
      right={
        <View style={styles.actions}>
          <BellButton />
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
