import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout'
import { Button } from '@/components/ui/button'
import { CodeInput } from '@/components/ui/code-input'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { RESEND_CODE_COOLDOWN_SECONDS, RESET_CODE_LENGTH, RESET_CODE_LIFETIME_MS } from '@/constants/authTiming'
import { useForgotPassword } from '@/hooks/auth/useForgotPassword'
import { usePalette } from '@/hooks/theme/usePalette'
import { getAuthErrorMessage } from '@/utils/apiError.utils'

const REJECTED_CODE_MESSAGE = 'Mã xác thực không đúng hoặc đã hết hạn. Vui lòng thử lại hoặc gửi lại mã'
const EXPIRED_CODE_MESSAGE = "Mã xác thực đã hết hạn. Vui lòng bấm 'Gửi lại mã'"

type VerifyCodeParams = {
  email: string
  // Thời điểm gửi mã (ms) — tính đếm ngược gửi lại và hạn 15 phút
  sentAt: string
  // Có giá trị khi màn đặt mật khẩu quay về vì backend từ chối mã
  rejectedAt?: string
}

/** AUTH-FR-009 bước 2: nhập mã 6 số; mã chỉ được backend kiểm tra ở bước đặt mật khẩu mới */
export default function VerifyCodeScreen() {
  const palette = usePalette()
  const { email, sentAt, rejectedAt } = useLocalSearchParams<VerifyCodeParams>()
  const forgotPassword = useForgotPassword()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [handledRejectedAt, setHandledRejectedAt] = useState<string | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())

  // Đồng hồ mỗi giây cho đếm ngược gửi lại và hạn của mã
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Backend từ chối mã (rejectedAt mới): xoá mã, viền cam và rung các ô — cập nhật ngay khi render, không qua effect
  if (rejectedAt && rejectedAt !== handledRejectedAt) {
    setHandledRejectedAt(rejectedAt)
    setCode('')
    setCodeError(REJECTED_CODE_MESSAGE)
    setShakeKey(key => key + 1)
  }

  const sentAtMs = Number(sentAt) || now
  const secondsUntilResend = Math.max(0, Math.ceil((sentAtMs + RESEND_CODE_COOLDOWN_SECONDS * 1000 - now) / 1000))
  const isExpired = now - sentAtMs >= RESET_CODE_LIFETIME_MS
  const isCodeComplete = code.length === RESET_CODE_LENGTH

  const handleResend = () => {
    setFormError(null)
    forgotPassword.mutate(email, {
      onSuccess: () => {
        // Mã cũ hết hiệu lực vì backend ghi đè mã mới
        setCode('')
        setCodeError(null)
        router.setParams({ sentAt: String(Date.now()), rejectedAt: '' })
      },
      onError: error => setFormError(getAuthErrorMessage(error, 'request-code')),
    })
  }

  const handleConfirm = () => {
    // sentAt đi kèm để khi mã bị từ chối, màn này vẫn giữ đúng đếm ngược và hạn của mã
    router.push({ pathname: '/(auth)/reset-password', params: { mode: 'reset', email, code, sentAt } })
  }

  return (
    <AuthScreenLayout
      title="Nhập mã xác thực"
      description={`Nếu email có tài khoản, mã ${RESET_CODE_LENGTH} số đã được gửi tới ${email}. Mã có hiệu lực 15 phút.`}
      onBack={() => router.back()}
    >
      <CodeInput
        value={code}
        onChange={value => {
          setCode(value)
          setCodeError(null)
        }}
        length={RESET_CODE_LENGTH}
        hasError={Boolean(codeError)}
        shakeKey={shakeKey}
        disabled={isExpired}
        autoFocus
      />

      <FormMessage message={isExpired ? EXPIRED_CODE_MESSAGE : (codeError ?? formError)} />

      <View style={styles.resendRow}>
        {secondsUntilResend > 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            Vui lòng chờ {secondsUntilResend}s trước khi yêu cầu mã mới
          </Text>
        ) : (
          <Button
            variant="link"
            label={forgotPassword.isPending ? 'Đang gửi lại mã…' : 'Gửi lại mã'}
            color={palette.primary}
            disabled={forgotPassword.isPending}
            onPress={handleResend}
          />
        )}
      </View>

      <Button label="Xác nhận" onPress={handleConfirm} disabled={!isCodeComplete || isExpired} />
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  resendRow: { alignItems: 'center', minHeight: 32, justifyContent: 'center' },
})
