import { useRef, useState } from 'react'
import type { TextInputInstance } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { LockIcon, LockKeyIcon } from 'phosphor-react-native'
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { TextField } from '@/components/ui/text-field'
import { getRoleHomeHref } from '@/constants/roleTabs'
import { useChangePassword } from '@/hooks/auth/useChangePassword'
import { useLogout } from '@/hooks/auth/useLogout'
import { useResetPassword } from '@/hooks/auth/useResetPassword'
import { useAuthStore } from '@/stores/authStore'
import { getAuthErrorMessage, readApiError } from '@/utils/apiError.utils'
import { isValidPassword, PASSWORD_MIN_LENGTH } from '@/utils/validation.utils'

const REQUIRED_MESSAGE = 'Vui lòng nhập đầy đủ thông tin'
const PASSWORD_RULE = `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`

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
  const logout = useLogout()
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
      setFormError(REQUIRED_MESSAGE)
      return false
    }
    if (!isValidPassword(newPassword)) {
      setFieldErrors({ new: PASSWORD_RULE })
      return false
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirm: 'Mật khẩu nhập lại không khớp' })
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
    clearErrors()
    if (!validate()) return
    if (isTemporary) submitChange()
    else submitReset()
  }

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => router.replace('/(auth)/login') })
  }

  return (
    <AuthScreenLayout
      title={isTemporary ? 'Đổi mật khẩu tạm' : 'Đặt mật khẩu mới'}
      description={
        isTemporary
          ? 'Tài khoản đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đặt mật khẩu mới để tiếp tục.'
          : 'Mật khẩu mới dùng cho lần đăng nhập sau.'
      }
      onBack={isTemporary ? undefined : () => router.back()}
      footer={
        isTemporary ? (
          <Button variant="link" label="Đăng xuất" onPress={handleLogout} disabled={logout.isPending} />
        ) : undefined
      }
    >
      {isTemporary && (
        <TextField
          label="Mật khẩu tạm"
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
        label="Mật khẩu mới"
        icon={LockKeyIcon}
        value={newPassword}
        onChangeText={text => {
          setNewPassword(text)
          clearErrors()
        }}
        error={fieldErrors.new}
        hasError={missingFields.new}
        helperText={PASSWORD_RULE}
        isPassword
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
      />

      <TextField
        ref={confirmPasswordRef}
        label="Nhập lại mật khẩu"
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
        label="Đổi mật khẩu"
        onPress={handleSubmit}
        loading={resetPassword.isPending || changePassword.isPending}
      />
    </AuthScreenLayout>
  )
}
