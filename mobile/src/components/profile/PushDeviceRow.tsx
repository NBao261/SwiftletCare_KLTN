import { DeviceMobileIcon } from 'phosphor-react-native'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { usePushRegistration } from '@/hooks/profile/usePushRegistration'
import { t } from '@/utils/i18n.utils'

interface PushDeviceRowProps {
  hasDivider?: boolean
  // Báo một câu ngắn (từ chối quyền thông báo)
  onMessage: (message: string) => void
}

// Dòng "Nhận push trên máy này" (ALERT-FR-002), dùng ở trang Tài khoản của chủ trại và của kỹ thuật viên: trạng thái đăng ký
// với máy chủ; chỉ xin quyền khi người dùng chạm, cho phép xong thì máy đăng ký nhận push ngay (usePushTokenStatus)
export function PushDeviceRow({ hasDivider = false, onMessage }: PushDeviceRowProps) {
  const push = usePushRegistration()

  const enablePush = () =>
    push.enable.mutate(undefined, {
      onSuccess: isGranted => {
        if (!isGranted) onMessage(t('Chưa được cấp quyền thông báo'))
      },
    })
  // Đang tải, lỗi gửi lên máy chủ, đã nhận, chưa cho phép, hoặc bản app này chưa nhận được push
  const caption = push.isLoading
    ? '_'
    : push.isError
      ? t('Chưa đăng ký được với máy chủ, chạm để thử lại')
      : push.status === 'registered'
        ? t('Đang nhận cảnh báo trên máy này')
        : push.status === 'no-permission'
          ? t('Chưa cho phép, chạm để bật')
          : t('Bản app này chưa nhận được push')
  const handlePress = push.isError
    ? () => void push.retry()
    : push.status === 'no-permission' && !push.enable.isPending
      ? enablePush
      : undefined

  return (
    <ProfileRow
      icon={DeviceMobileIcon}
      label={t('Nhận push trên máy này')}
      caption={caption}
      onPress={handlePress}
      hasDivider={hasDivider}
    />
  )
}
