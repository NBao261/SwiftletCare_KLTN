import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { Button, ErrorNotice, Input } from '@/components/ui';
import { useAuth } from '@/hooks/auth/useAuth';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useAuthStore } from '@/stores/authStore';
import { validatePasswordChange } from '@/validations/common/passwordChange.validation';
import { useDocumentTitle } from '@/hooks/common/useDocumentTitle'
import { t } from '@/i18n'

// Đổi mật khẩu tạm: tài khoản do Admin tạo phải đổi trước khi vào hệ thống; khung ở AuthLayout
export default function ChangePasswordPage(): JSX.Element {
  useDocumentTitle(t('Đổi mật khẩu'))
  const { changePassword, logout } = useAuth();
  const apiErrorMessage = useApiErrorMessage();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasHydrated = useAuthStore(s => s.hasHydrated);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (hasHydrated && !isAuthenticated) return <Navigate to="/login" replace />;

  const errors = validatePasswordChange({ currentPassword, newPassword, confirmPassword });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    changePassword.mutate({ current_password: currentPassword, new_password: newPassword });
  }

  const submitError = changePassword.isError ? apiErrorMessage(changePassword.error, 'Đổi mật khẩu thất bại') : undefined;

  return (
    <>
      <h1 className="text-center text-h1 font-bold tracking-tight text-charcoal">Đổi mật khẩu</h1>
      <p className="mt-1.5 text-center text-sm text-warmGray">
        Tài khoản đang dùng mật khẩu tạm. Đặt mật khẩu của riêng bạn để tiếp tục.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
        <Input
          label="Mật khẩu tạm"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
          error={submitted ? errors.currentPassword : undefined}
        />
        <Input
          label="Mật khẩu mới"
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          error={submitted ? errors.newPassword : undefined}
        />
        <Input
          label="Nhập lại mật khẩu mới"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          error={submitted ? errors.confirmPassword : undefined}
        />
        {submitError && <ErrorNotice>{submitError}</ErrorNotice>}
        <Button type="submit" size="lg" loading={changePassword.isPending} className="mt-2 w-full">
          Đổi mật khẩu
        </Button>
      </form>
      <button
        type="button"
        onClick={() => logout.mutate()}
        className="mt-6 self-center text-xs text-warmGray underline underline-offset-2 hover:text-charcoal"
      >
        Đăng xuất
      </button>
    </>
  );
}
