import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { EnvelopeSimpleIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Spacing } from '@/constants/theme'
import { useInviteFarmMember } from '@/hooks/farm/useInviteFarmMember'
import { usePalette } from '@/hooks/theme/usePalette'
import type { InvitedRole } from '@/types'
import { getInvitedRoleDescription } from '@/utils/account.utils'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { isValidEmail } from '@/utils/validation.utils'
import { t } from '@/utils/i18n.utils'

interface InviteMemberSheetProps {
  visible: boolean
  farmId: string
  farmName: string
  // Farm chưa có chuyên gia thì chọn sẵn "Chuyên gia"
  defaultRole: InvitedRole
  onInvited: (email: string) => void
  onClose: () => void
}

// Sheet mời thành viên (AUTH-FR-005, EXPERT-FR-001): email và vai trò (đồng sở hữu, chuyên gia, kỹ thuật viên nhà yến — G-20); lời mời hết hạn sau 7 ngày (§6.4).
// Token lời mời trong phản hồi không ra khỏi hook mời; sheet chỉ biết mời xong hay lỗi
export function InviteMemberSheet({ visible, farmId, farmName, defaultRole, onInvited, onClose }: InviteMemberSheetProps) {
  const palette = usePalette()
  const invite = useInviteFarmMember(farmId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitedRole>(defaultRole)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (invite.isPending) return
    setFormError(null)
    const trimmedEmail = email.trim()
    if (!isValidEmail(trimmedEmail)) {
      setEmailError(t('Email không hợp lệ'))
      return
    }
    invite.mutate(
      { email: trimmedEmail, role },
      {
        onSuccess: () => onInvited(trimmedEmail),
        onError: error =>
          setFormError(
            getSettingsErrorMessage(error, {
              403: t('Chỉ chủ chính của farm mới mời được thành viên'),
              409: t('Email này đã là thành viên, đã có lời mời đang chờ, hoặc thuộc tài khoản vai trò khác. Vui lòng dùng email khác'),
            }),
          ),
      },
    )
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading">{t('Mời thành viên')}</Text>
        <Text variant="small" color={palette.textSecondary}>
          {t('Mời vào {farm}. Lời mời hết hạn sau 7 ngày nếu chưa được chấp nhận.', { farm: farmName })}
        </Text>
      </View>
      <TextField
        label={t('Email người được mời')}
        icon={EnvelopeSimpleIcon}
        value={email}
        onChangeText={text => {
          setEmail(text)
          setEmailError(null)
          setFormError(null)
        }}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      <View style={styles.roleBlock}>
        <Text variant="small" color={palette.textSecondary}>
          {t('Vai trò')}
        </Text>
        <ChoiceChips<InvitedRole>
          options={[
            { id: 'DOMAIN_EXPERT', label: t('Chuyên gia') },
            { id: 'FARM_OWNER', label: t('Đồng sở hữu') },
            { id: 'FARM_TECHNICIAN', label: t('Kỹ thuật viên nhà yến') },
          ]}
          selectedId={role}
          onSelect={setRole}
          placement="card"
          accessibilityLabel={t('Vai trò')}
        />
        <Text variant="small" color={palette.textSecondary}>
          {getInvitedRoleDescription(role)}
        </Text>
      </View>
      <FormMessage message={formError} />
      <Button label={t('Gửi lời mời')} onPress={handleSubmit} loading={invite.isPending} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  roleBlock: { gap: Spacing.sm },
})
