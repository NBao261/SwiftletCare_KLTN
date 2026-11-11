import { useRef, useState } from 'react'
import type { TextInputInstance } from 'react-native'
import { LockIcon, LockKeyIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { TextField } from '@/components/ui/text-field'
import { useChangePassword } from '@/hooks/auth/useChangePassword'
import { getAuthErrorMessage, readApiError } from '@/utils/apiError.utils'
import { isValidPassword, PASSWORD_MIN_LENGTH } from '@/utils/validation.utils'
import { t } from '@/utils/i18n.utils'

const REQUIRED_MESSAGE = 'Vui lòng nhập đầy đủ thông tin'
// Câu quy tắc mật khẩu theo ngôn ngữ đang chọn
const getPasswordRule = () => t('Tối thiểu {count} ký tự', { count: PASSWORD_MIN_LENGTH })

interface ChangePasswordFormProps {
  // Nhãn ô mật khẩu đang dùng: "Mật khẩu tạm" ở lần đăng nhập đầu, "Mật khẩu hiện tại" ở tab Tài khoản
  currentPasswordLabel: string
  // Lần đăng nhập đầu với mật khẩu tạm: câu báo lỗi nói "mật khẩu tạm" thay vì "mật khẩu hiện tại"
  isTemporary?: boolean
  onSuccess: () => void
}

// Form đổi mật khẩu khi đang đăng nhập (PUT /auth/password, AUTH-FR-005c) — dùng chung cho màn mật khẩu tạm
// ((auth)/reset-password) và tab Tài khoản (profile/change-password), theo MOBILE_GUIDE §2.2
export function ChangePasswordForm({ currentPasswordLabel, isTemporary = false, onSuccess }: ChangePasswordFormProps) {
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
    const missing = { current: !currentPassword, new: !newPassword, confirm: !confirmPassword }
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

  const handleSubmit = () => {
    // Phím Done trên bàn phím gọi thẳng hàm này, không qua nút đang khoá — chặn gửi lần hai
    if (changePassword.isPending) return
    clearErrors()
    if (!validate()) return
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess,
        onError: error => {
          const errorCode = readApiError(error).code
          const message = getAuthErrorMessage(error, isTemporary ? 'change-temporary-password' : 'change-password')
          if (errorCode === 'INVALID_CURRENT_PASSWORD') setFieldErrors({ current: message })
          else if (errorCode === 'PASSWORD_UNCHANGED') setFieldErrors({ new: message })
          else setFormError(message)
        },
      },
    )
  }

  return (
    <>
      <TextField
        label={currentPasswordLabel}
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

      <Button label={t('Đổi mật khẩu')} onPress={handleSubmit} loading={changePassword.isPending} />
    </>
  )
}
