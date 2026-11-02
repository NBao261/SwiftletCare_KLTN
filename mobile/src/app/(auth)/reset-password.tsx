import { useRef, useState } from 'react'
import type { TextInputInstance } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { LockIcon, LockKeyIcon } from 'phosphor-react-native'
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { TextField } from '@/components/ui/text-field'
import { getRoleHomeHref } from '@/constants/roleTabs'
import { useChangePassword } from '@/hooks/auth/useChangePassword'
import { useResetPassword } from '@/hooks/auth/useResetPassword'
import { useAuthStore } from '@/stores/authStore'
import { getAuthErrorMessage, readApiError } from '@/utils/apiError.utils'
import { isValidPassword, PASSWORD_MIN_LENGTH } from '@/utils/validation.utils'
import { t } from '@/utils/i18n.utils'

const REQUIRED_MESSAGE = 'Vui lòng nhập đầy đủ thông tin'
// Câu quy tắc mật khẩu theo ngôn ngữ đang chọn
const getPasswordRule = () => t('Tối thiểu {count} ký tự', { count: PASSWORD_MIN_LENGTH })

type ResetPasswordParams = {
  // reset: quên mật khẩu, đi từ màn nhập mã; temporary: vừa đăng nhập bằng mật khẩu tạm Admin cấp
  mode?: 'reset' | 'temporary'
  email?: string
  code?: string
  sentAt?: string
}

/** AUTH-FR-009 bước 3 (đặt mật khẩu mới bằng mã) và AUTH-FR-005c (đổi mật khẩu tạm ở lần đăng nhập đầu) */
export default function ResetPasswordScreen() {
  const { mode = 'reset', email = '', code = '', sentAt = '' } = useLocalSearchParams<ResetPasswordParams>()
  const isTemporary = mode === 'temporary'
  const user = useAuthStore(state => state.user)
  const resetPassword = useResetPassword()
  const changePassword = useChangePassword()
  const newPasswordRef = useRef<TextInputInstance>(null)
  const confirmPasswordRef = useRef<TextInputInstance>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; new?: string; confirm?: string }>({})
  const [missingFields, setMissingFields] = useState({ current: false, new: false, confirm: false })
  const [formError, setFormError] = useState<string | null>(null)

  const clearErrors = () => {
    setFieldErrors({})
    setMissingFields({ current: false, new: false, confirm: false })
    setFormError(null)
  }

  // Kiểm tra ở máy trước khi gửi: đủ ô, đủ độ dài backend yêu cầu, hai ô khớp nhau
  const validate = (): boolean => {
    const missing = {
      current: isTemporary && !currentPassword,
      new: !newPassword,
      confirm: !confirmPassword,
    }
    setMissingFields(missing)
    if (missing.current || missing.new || missing.confirm) {
      setFormError(t(REQUIRED_MESSAGE))
      return false
    }
    if (!isValidPassword(newPassword)) {
      setFieldErrors({ new: getPasswordRule() })
      return false
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirm: t('Mật khẩu nhập lại không khớp') })
      return false
    }
    return true
  }

  const submitReset = () => {
    resetPassword.mutate(
      { email, token: code, newPassword },
      {
        onSuccess: () => router.dismissTo({ pathname: '/(auth)/login', params: { notice: 'password-reset' } }),
        onError: error => {
          // Mã sai hoặc hết hạn: quay về màn nhập mã để nhập lại hoặc gửi lại
          if (readApiError(error).code === 'INVALID_RESET_TOKEN') {
            router.dismissTo({
              pathname: '/(auth)/verify-code',
              params: { email, sentAt, rejectedAt: String(Date.now()) },
            })
            return
          }
          setFormError(getAuthErrorMessage(error, 'reset-password'))
        },
      },
    )
  }

  const submitChange = () => {
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          if (user) router.replace(getRoleHomeHref(user.role))
        },
        onError: error => {
          const errorCode = readApiError(error).code
          const message = getAuthErrorMessage(error, 'change-password')
          if (errorCode === 'INVALID_CURRENT_PASSWORD') setFieldErrors({ current: message })
          else if (errorCode === 'PASSWORD_UNCHANGED') setFieldErrors({ new: message })
          else setFormError(message)
        },
      },
    )
  }

  const handleSubmit = () => {
    // Phím Done trên bàn phím gọi thẳng hàm này, không qua nút đang khoá — chặn gửi lần hai
    if (resetPassword.isPending || changePassword.isPending) return
    clearErrors()
    if (!validate()) return
    if (isTemporary) submitChange()
    else submitReset()
  }

  return (
    <AuthScreenLayout
      title={isTemporary ? t('Đổi mật khẩu tạm') : t('Đặt mật khẩu mới')}
      description={
        isTemporary
          ? t('Tài khoản đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đặt mật khẩu mới để tiếp tục.')
          : t('Mật khẩu mới dùng cho lần đăng nhập sau.')
      }
      onBack={isTemporary ? undefined : () => router.back()}
      footer={isTemporary ? <LogoutButton variant="link" /> : undefined}
    >
      {isTemporary && (
        <TextField
          label={t('Mật khẩu tạm')}
          icon={LockIcon}
          value={currentPassword}
          onChangeText={text => {
            setCurrentPassword(text)
            clearErrors()
          }}
          error={fieldErrors.current}
          hasError={missingFields.current}
          isPassword
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => newPasswordRef.current?.focus()}
        />
      )}

      <TextField
        ref={newPasswordRef}
        label={t('Mật khẩu mới')}
        icon={LockKeyIcon}
        value={newPassword}
        onChangeText={text => {
          setNewPassword(text)
          clearErrors()
        }}
        error={fieldErrors.new}
        hasError={missingFields.new}
        helperText={getPasswordRule()}
        isPassword
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
      />

      <TextField
        ref={confirmPasswordRef}
        label={t('Nhập lại mật khẩu')}
        icon={LockKeyIcon}
        value={confirmPassword}
        onChangeText={text => {
          setConfirmPassword(text)
          clearErrors()
        }}
        error={fieldErrors.confirm}
        hasError={missingFields.confirm}
        isPassword
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <FormMessage message={formError} />

      <Button
        label={t('Đổi mật khẩu')}
        onPress={handleSubmit}
        loading={resetPassword.isPending || changePassword.isPending}
      />
    </AuthScreenLayout>
  )
}
