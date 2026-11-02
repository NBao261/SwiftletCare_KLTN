import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { EnvelopeSimpleIcon } from 'phosphor-react-native'
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { TextField } from '@/components/ui/text-field'
import { useForgotPassword } from '@/hooks/auth/useForgotPassword'
import { getAuthErrorMessage } from '@/utils/apiError.utils'
import { isValidEmail } from '@/utils/validation.utils'
import { t } from '@/utils/i18n.utils'

/** AUTH-FR-009 bước 1: nhập email để nhận mã đặt lại mật khẩu */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const forgotPassword = useForgotPassword()
  const [email, setEmail] = useState(params.email ?? '')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = () => {
    // Phím Done trên bàn phím gọi thẳng hàm này, không qua nút đang khoá — chặn gửi lần hai
    if (forgotPassword.isPending) return
    if (!isValidEmail(email)) {
      setEmailError(t('Email không hợp lệ'))
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    forgotPassword.mutate(normalizedEmail, {
      // Backend luôn trả 200 kể cả email chưa có tài khoản, nên luôn sang bước nhập mã
      onSuccess: () =>
        router.push({
          pathname: '/(auth)/verify-code',
          params: { email: normalizedEmail, sentAt: String(Date.now()) },
        }),
      onError: error => setFormError(getAuthErrorMessage(error, 'request-code')),
    })
  }

  return (
    <AuthScreenLayout
      title={t('Quên mật khẩu')}
      description={t('Nhập email của tài khoản. Nếu email có tài khoản, mã xác thực 6 số sẽ được gửi tới email này.')}
      onBack={() => router.back()}
    >
      <TextField
        label="Email"
        icon={EnvelopeSimpleIcon}
        value={email}
        onChangeText={text => {
          setEmail(text)
          setEmailError(null)
          setFormError(null)
        }}
        error={emailError}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        autoFocus={!email}
      />

      <FormMessage message={formError} />

      <Button label={t('Gửi mã')} onPress={handleSubmit} loading={forgotPassword.isPending} />
    </AuthScreenLayout>
  )
}
