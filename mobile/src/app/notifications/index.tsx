import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { NotificationInboxList } from '@/components/notification/NotificationInboxList'
import { PendingAlertList } from '@/components/notification/PendingAlertList'
import { Button } from '@/components/ui/button'
import { Spacing } from '@/constants/theme'
import { useBellCounts } from '@/hooks/notification/useBellCounts'
import { useMarkAllNotificationsRead } from '@/hooks/notification/useMarkAllNotificationsRead'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

type BellSection = 'notifications' | 'alerts'

/** Chuông: màn riêng ở stack gốc, ngoài các tab (thanh tab ẩn, tab Tài khoản không giữ màn này). Hai mục — Thông báo (hộp thư
 * trong app, EXPERT-FR-007/009) và Cảnh báo (chưa xác nhận, ALERT-FR-009), mỗi mục một số; số trên chuông là tổng hai số.
 * Param section=alerts mở thẳng mục Cảnh báo. Nút ‹ quay về màn đã mở chuông */
export default function NotificationsScreen() {
  const palette = usePalette()
  const goBack = useGoBackOrHome()
  const { section: initialSection } = useLocalSearchParams<{ section?: string }>()
  const [section, setSection] = useState<BellSection>(initialSection === 'alerts' ? 'alerts' : 'notifications')
  const user = useAuthStore(state => state.user)
  const counts = useBellCounts()
  const markAllRead = useMarkAllNotificationsRead()

  if (!canPerform(user, 'viewBell')) return <Redirect href="/(tabs)/home" />

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        title={t('Thông báo')}
        onBack={goBack}
        right={
          section === 'notifications' && counts.notificationCount > 0 ? (
            <Button
              variant="link"
              size="sm"
              label={t('Đọc hết')}
              onPress={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
            />
          ) : undefined
        }
      />
      <View style={styles.sections}>
        <ChoiceChips
          options={[
            { id: 'notifications', label: t('Thông báo ({count})', { count: counts.notificationCount }) },
            { id: 'alerts', label: t('Cảnh báo ({count})', { count: counts.alertCount }) },
          ]}
          selectedId={section}
          onSelect={setSection}
          accessibilityLabel={t('Mục của chuông')}
        />
      </View>
      {section === 'notifications' ? <NotificationInboxList /> : <PendingAlertList />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  sections: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
})
