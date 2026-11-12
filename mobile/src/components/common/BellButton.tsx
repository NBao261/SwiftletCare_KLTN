import { router } from 'expo-router'
import { BellIcon } from 'phosphor-react-native'
import { IconButton } from '@/components/ui/icon-button'
import { useBellCounts } from '@/hooks/notification/useBellCounts'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Chuông dùng chung ở đầu Trang chủ và tab Trang trại: số = thông báo chưa đọc + cảnh báo chưa xác nhận, bấm mở màn chuông
// (hai mục Thông báo | Cảnh báo). Màn chuông là màn riêng ở stack gốc (thanh tab ẩn, nút ‹ quay về đây), chỉ mở cho Farm Owner và kỹ thuật viên
export function BellButton() {
  const user = useAuthStore(state => state.user)
  const { total } = useBellCounts()

  return (
    <IconButton
      icon={BellIcon}
      label={t('Thông báo')}
      badgeCount={total}
      onPress={
        canPerform(user, 'viewBell')
          ? () => router.push('/notifications')
          : undefined
      }
    />
  )
}
