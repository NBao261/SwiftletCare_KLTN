import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/auth/useAuth';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';

// Trang quên mật khẩu (AUTH-FR-009, Flow 11 bước 6-7): gửi mã → nhập mã + mật khẩu mới; khung và ảnh ở AuthLayout
export default function ForgotPasswordPage(): JSX.Element {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const apiErrorMessage = useApiErrorMessage();
  const [email, setEmail] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  function handleSend(event: FormEvent): void {
    event.preventDefault();
    forgotPassword.mutate(email, { onSuccess: () => setIsCodeSent(true) });
  }

  function handleReset(event: FormEvent): void {
    event.preventDefault();
    resetPassword.mutate({ email, token, newPassword }, { onSuccess: () => navigate('/login') });
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
          {sendError && (
            <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">{sendError}</p>
          )}
          <Button type="submit" size="lg" loading={forgotPassword.isPending} className="mt-2 w-full">
            Gửi mã đặt lại
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="mt-8 flex flex-col gap-4">
          <p className="rounded-xl bg-limeMist p-3 text-xs font-medium text-charcoal">
            Nếu email tồn tại, mã đặt lại đã được gửi (môi trường dev: xem console log backend, chưa nối SMTP thật).
          </p>
          <Input
            label="Mã đặt lại (6 số)"
            required
            maxLength={6}
            value={token}
            onChange={event => setToken(event.target.value)}
          />
          <Input
            label="Mật khẩu mới"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
          />
          {resetError && (
            <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">{resetError}</p>
          )}
          <Button type="submit" size="lg" loading={resetPassword.isPending} className="mt-2 w-full">
            Đặt lại mật khẩu
          </Button>
        </form>
      )}
    </>
  );
}
