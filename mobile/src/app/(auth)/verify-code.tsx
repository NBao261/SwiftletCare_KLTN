import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout'
import { Button } from '@/components/ui/button'
import { CodeInput } from '@/components/ui/code-input'
import { FormMessage } from '@/components/ui/form-message'
import { RESET_CODE_LENGTH, RESET_CODE_LIFETIME_MS } from '@/constants/authTiming'
import { useForgotPassword } from '@/hooks/auth/useForgotPassword'
import { usePalette } from '@/hooks/theme/usePalette'
import { getAuthErrorMessage, INVALID_CODE_MESSAGE } from '@/utils/apiError.utils'

const EXPIRED_CODE_MESSAGE = 'Mã xác thực đã hết hạn. Vui lòng bấm "Gửi lại mã" để nhận mã mới'
const CODE_LIFETIME_MINUTES = RESET_CODE_LIFETIME_MS / 60_000

type VerifyCodeParams = {
  email: string
  // Thời điểm gửi mã (ms) — tính lúc mã hết hạn
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

  // Không có sentAt (mở màn sai cách) thì coi như mã chưa hết hạn
  const expiresAtMs = Number(sentAt) > 0 ? Number(sentAt) + RESET_CODE_LIFETIME_MS : null
  const isExpired = expiresAtMs !== null && now >= expiresAtMs

  // Hẹn đúng một lần vào lúc mã hết hạn để khoá ô nhập — không đếm mỗi giây làm màn vẽ lại liên tục
  useEffect(() => {
    if (expiresAtMs === null) return
    const remainingMs = expiresAtMs - Date.now()
    if (remainingMs <= 0) return
    const timer = setTimeout(() => setNow(Date.now()), remainingMs)
    return () => clearTimeout(timer)
  }, [expiresAtMs])

  // Backend từ chối mã (rejectedAt mới): xoá mã, viền cam và rung các ô — cập nhật ngay khi render, không qua effect
  if (rejectedAt && rejectedAt !== handledRejectedAt) {
    setHandledRejectedAt(rejectedAt)
    setCode('')
    setCodeError(INVALID_CODE_MESSAGE)
    setShakeKey(key => key + 1)
  }

  const isCodeComplete = code.length === RESET_CODE_LENGTH

  // Không tự đặt thời gian chờ ở máy: bấm quá giới hạn thì backend trả 429 kèm số giây phải chờ
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
    // sentAt đi kèm để khi mã bị từ chối và quay về đây, màn này vẫn biết đúng lúc mã hết hạn
    router.push({ pathname: '/(auth)/reset-password', params: { mode: 'reset', email, code, sentAt } })
  }

  return (
    <AuthScreenLayout
      title="Nhập mã xác thực"
      description={`Nếu email có tài khoản, mã ${RESET_CODE_LENGTH} số đã được gửi tới ${email}. Mã có hiệu lực ${CODE_LIFETIME_MINUTES} phút.`}
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
        <Button
          variant="link"
          label={forgotPassword.isPending ? 'Đang gửi lại mã…' : 'Gửi lại mã'}
          color={palette.text}
          disabled={forgotPassword.isPending}
          onPress={handleResend}
        />
      </View>

      <Button label="Xác nhận" onPress={handleConfirm} disabled={!isCodeComplete || isExpired} />
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  resendRow: { alignItems: 'center', minHeight: 32, justifyContent: 'center' },
})
