import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, Switch, View } from 'react-native'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { SettingsInput } from '@/components/farm/settings/SettingsInput'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { useTelegramLink } from '@/hooks/auth/useTelegramLink'
import { useUpdateNotificationPreferences } from '@/hooks/auth/useUpdateNotificationPreferences'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { isValidClockTime } from '@/utils/validation.utils'
import { t } from '@/utils/i18n.utils'

interface NotificationSettingsSheetProps {
  visible: boolean
  onClose: () => void
}

// Một dòng công tắc kênh
function ChannelRow({
  label,
  caption,
  value,
  onChange,
  disabled,
}: {
  label: string
  caption: string
  value: boolean
  onChange: (next: boolean) => void
  disabled: boolean
}) {
  const palette = usePalette()
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="body" weight="semiBold">
          {label}
        </Text>
        <Text variant="small" color={palette.textSecondary}>
          {caption}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: palette.border, true: palette.inverse }}
        thumbColor={palette.surface}
      />
    </View>
  )
}

// Cài đặt thông báo ngay từ tab Cảnh báo (đặc tả §7, chỉ chủ trại): kênh push, Telegram (ALERT-FR-005), giờ yên lặng
// (ALERT-FR-006), liên kết bot Telegram (ALERT-FR-013). Backend chỉ có kênh chung, chưa có kênh theo từng loại sự kiện
export function NotificationSettingsSheet({ visible, onClose }: NotificationSettingsSheetProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const updatePreferences = useUpdateNotificationPreferences()
  const { link, unlink } = useTelegramLink()
  const preferences = user?.notification_preferences
  const [quietStart, setQuietStart] = useState(preferences?.quiet_hours.start ?? '')
  const [quietEnd, setQuietEnd] = useState(preferences?.quiet_hours.end ?? '')
  const isQuietValid = isValidClockTime(quietStart) && isValidClockTime(quietEnd)
  const isQuietChanged =
    quietStart.trim() !== preferences?.quiet_hours.start || quietEnd.trim() !== preferences?.quiet_hours.end
  const isLinked = user?.telegram_linked

  const confirmUnlink = () =>
    NativeAlert.alert(t('Huỷ liên kết Telegram?'), t('Bạn sẽ không nhận cảnh báo qua Telegram nữa.'), [
      { text: t('Huỷ'), style: 'cancel' },
      { text: t('Huỷ liên kết'), style: 'destructive', onPress: () => unlink.mutate() },
    ])

  const telegramError = link.error ?? unlink.error
  const telegramMessage = telegramError
    ? getSettingsErrorMessage(telegramError, { 503: t('Bot Telegram chưa được cấu hình trên máy chủ') })
    : null

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">{t('Cài đặt thông báo')}</Text>
      <ChannelRow
        label={t('Thông báo đẩy')}
        caption={t('Cảnh báo gửi tới điện thoại')}
        value={preferences?.push ?? false}
        onChange={next => updatePreferences.mutate({ push: next })}
        disabled={updatePreferences.isPending}
      />
      <ChannelRow
        label={t('Telegram')}
        caption={isLinked ? t('Đã liên kết bot') : t('Cần liên kết bot để nhận')}
        value={preferences?.telegram ?? false}
        onChange={next => updatePreferences.mutate({ telegram: next })}
        disabled={updatePreferences.isPending}
      />
      <View style={[styles.section, { borderTopColor: palette.divider }]}>
        <Text variant="body" weight="semiBold">
          {t('Giờ yên lặng')}
        </Text>
        <Text variant="small" color={palette.textSecondary}>
          {t('Trong khoảng này chỉ cảnh báo nghiêm trọng được gửi; mọi cảnh báo vẫn có trong danh sách.')}
        </Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <SettingsInput
              value={quietStart}
              onChangeText={setQuietStart}
              label={t('Bắt đầu')}
              placeholder="22:00"
              align="left"
              keyboardType="numbers-and-punctuation"
              hasError={quietStart !== '' && !isValidClockTime(quietStart)}
            />
          </View>
          <Text variant="body">–</Text>
          <View style={styles.flex}>
            <SettingsInput
              value={quietEnd}
              onChangeText={setQuietEnd}
              label={t('Kết thúc')}
              placeholder="06:00"
              align="left"
              keyboardType="numbers-and-punctuation"
              hasError={quietEnd !== '' && !isValidClockTime(quietEnd)}
            />
          </View>
          <Button
            label={t('Lưu')}
            size="sm"
            onPress={() =>
              updatePreferences.mutate({ quiet_hours: { start: quietStart.trim(), end: quietEnd.trim() } })
            }
            disabled={!isQuietValid || !isQuietChanged}
            loading={updatePreferences.isPending}
          />
        </View>
      </View>
      <FormMessage message={updatePreferences.error ? getSettingsErrorMessage(updatePreferences.error) : null} />
      <View style={[styles.section, { borderTopColor: palette.divider }]}>
        <Text variant="body" weight="semiBold">
          {t('Liên kết Telegram')}
        </Text>
        <Text variant="small" color={palette.textSecondary}>
          {isLinked === undefined
            ? t('Chưa rõ trạng thái')
            : isLinked
              ? t('Đã liên kết')
              : t(
                  'Chưa liên kết. Bấm Liên kết, Telegram mở bot, bấm Start để hoàn tất (mã dùng một lần trong 10 phút).',
                )}
        </Text>
        <View style={styles.row}>
          <Button label={t('Liên kết')} size="sm" onPress={() => link.mutate()} loading={link.isPending} />
          {isLinked && (
            <Button label={t('Huỷ liên kết')} variant="link" onPress={confirmUnlink} loading={unlink.isPending} />
          )}
        </View>
        {link.isSuccess && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Đã mở Telegram. Trạng thái liên kết cập nhật ở lần đăng nhập sau.')}
          </Text>
        )}
        <FormMessage message={telegramMessage} />
      </View>
      {/* ALERT-FR-005 kênh theo từng loại sự kiện: backend chỉ có push, telegram dùng chung */}
      <ComingSoonAction label={t('Kênh theo từng loại cảnh báo')} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  section: { gap: Spacing.sm, borderTopWidth: BorderWidth.hairline, paddingTop: Spacing.md },
})
