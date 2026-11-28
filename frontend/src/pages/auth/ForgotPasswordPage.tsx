import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ErrorNotice, Input } from '@/components/ui';
import { useAuth } from '@/hooks/auth/useAuth';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useDocumentTitle } from '@/hooks/common/useDocumentTitle'
import { t } from '@/i18n'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePasswordReset } from '@/validations/common/passwordChange.validation'

// Trang quên mật khẩu: gửi mã → nhập mã + mật khẩu mới; khung và ảnh ở AuthLayout
export default function ForgotPasswordPage(): JSX.Element {
  useDocumentTitle(t('Quên mật khẩu'))
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const apiErrorMessage = useApiErrorMessage();
  const [email, setEmail] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const errors = validatePasswordReset({ code: token, newPassword, confirmPassword });

  function handleSend(event: FormEvent): void {
    event.preventDefault();
    forgotPassword.mutate(email, { onSuccess: () => setIsCodeSent(true) });
  }

  function handleReset(event: FormEvent): void {
    event.preventDefault();
    setIsSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    resetPassword.mutate({ email, token: token.trim(), newPassword }, { onSuccess: () => navigate('/login') });
  }

  const sendError = forgotPassword.isError ? apiErrorMessage(forgotPassword.error, 'Gửi mã thất bại') : undefined;
  const resetError = resetPassword.isError
    ? apiErrorMessage(resetPassword.error, 'Đặt lại mật khẩu thất bại')
    : undefined;

  return (
    <>
      <h1 className="text-center text-h1 font-bold tracking-tight text-charcoal">Quên mật khẩu</h1>
      <p className="mt-1.5 text-center text-sm text-warmGray">Nhập email để nhận mã đặt lại mật khẩu</p>

      {!isCodeSent ? (
        <form onSubmit={handleSend} className="mt-8 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
          {sendError && <ErrorNotice>{sendError}</ErrorNotice>}
          <Button type="submit" size="lg" loading={forgotPassword.isPending} className="mt-2 w-full">
            Gửi mã đặt lại
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} noValidate className="mt-8 flex flex-col gap-4">
          <p className="rounded-xl bg-limeMist p-3 text-xs font-medium text-charcoal">
            Nếu email tồn tại, mã đặt lại đã được gửi (môi trường dev: xem console log backend, chưa nối SMTP thật).
          </p>
          <Input
            label="Mã đặt lại (6 số)"
            required
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={token}
            onChange={event => setToken(event.target.value)}
            error={isSubmitted ? errors.code : undefined}
          />
          <Input
            label="Mật khẩu mới"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            error={isSubmitted ? errors.newPassword : undefined}
          />
          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            error={isSubmitted ? errors.confirmPassword : undefined}
          />
          {resetError && <ErrorNotice>{resetError}</ErrorNotice>}
          <Button type="submit" size="lg" loading={resetPassword.isPending} className="mt-2 w-full">
            Đặt lại mật khẩu
          </Button>
        </form>
      )}
    </>
  );
}
