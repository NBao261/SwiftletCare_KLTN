import { useRef, useState } from 'react'
import { StyleSheet, View, type TextInputInstance } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { EnvelopeSimpleIcon, LockIcon } from 'phosphor-react-native'
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { getRoleHomeHref } from '@/constants/roleTabs'
import { UnsupportedRoleError, useLogin } from '@/hooks/auth/useLogin'
import { usePalette } from '@/hooks/theme/usePalette'
import { getAuthErrorMessage, readApiError } from '@/utils/apiError.utils'
import { isValidEmail } from '@/utils/validation.utils'

const REQUIRED_MESSAGE = 'Vui lòng nhập đầy đủ thông tin'

/** AUTH-FR-002: đăng nhập bằng email và mật khẩu — dùng chung cho mọi role được vào app */
export default function LoginScreen() {
  const palette = usePalette()
  const { notice } = useLocalSearchParams<{ notice?: string }>()
  const login = useLogin()
  const passwordRef = useRef<TextInputInstance>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState({ email: false, password: false })
  const [formError, setFormError] = useState<string | null>(null)
  // Backend trả 429 thì khoá nút tới khi người dùng sửa lại thông tin
  const [isRateLimited, setRateLimited] = useState(false)

  const clearErrors = () => {
    setFormError(null)
    setRateLimited(false)
  }

  const handleEmailBlur = () => {
    if (email.trim() && !isValidEmail(email)) setEmailError('Email không hợp lệ')
  }

  const handleSubmit = () => {
    // Phím Done trên bàn phím gọi thẳng hàm này, không qua nút đang khoá — chặn gửi lần hai
    if (login.isPending || isRateLimited) return
    const isEmailMissing = !email.trim()
    const isPasswordMissing = !password
    setMissingFields({ email: isEmailMissing, password: isPasswordMissing })
    if (isEmailMissing || isPasswordMissing) {
      setFormError(REQUIRED_MESSAGE)
      return
    }
    if (!isValidEmail(email)) {
      setEmailError('Email không hợp lệ')
      return
    }

    clearErrors()
    login.mutate(
      { email, password },
      {
        onSuccess: user => {
          if (user.must_change_password) {
            router.replace({ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } })
          } else {
            router.replace(getRoleHomeHref(user.role))
          }
        },
        onError: error => {
          if (error instanceof UnsupportedRoleError) {
            setFormError(error.message)
            return
          }
          setRateLimited(readApiError(error).status === 429)
          setFormError(getAuthErrorMessage(error, 'login'))
        },
      },
    )
  }

  return (
    <AuthScreenLayout
      title="Đăng nhập"
      description="Theo dõi và điều khiển nhà yến của bạn"
      showsLogo
      footer={
        <Text variant="small" color={palette.textSecondary} center>
          Chưa có tài khoản? Liên hệ chủ trang trại hoặc quản trị viên
        </Text>
      }
    >
      {notice === 'password-reset' && !formError && (
        <FormMessage tone="success" message="Đã đổi mật khẩu, hãy đăng nhập lại" />
      )}

      <TextField
        label="Email"
        icon={EnvelopeSimpleIcon}
        value={email}
        onChangeText={text => {
          setEmail(text)
          setEmailError(null)
          setMissingFields(fields => ({ ...fields, email: false }))
          clearErrors()
        }}
        onBlur={handleEmailBlur}
        error={emailError}
        hasError={missingFields.email}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />

      <TextField
        ref={passwordRef}
        label="Mật khẩu"
        icon={LockIcon}
        value={password}
        onChangeText={text => {
          setPassword(text)
          setMissingFields(fields => ({ ...fields, password: false }))
          clearErrors()
        }}
        hasError={missingFields.password}
        isPassword
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <View style={styles.forgotRow}>
        <Button
          variant="link"
          label="Quên mật khẩu?"
          onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } })}
        />
      </View>

      <FormMessage message={formError} />

      <Button label="Đăng nhập" onPress={handleSubmit} loading={login.isPending} disabled={isRateLimited} />
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  forgotRow: { alignItems: 'flex-end' },
})
