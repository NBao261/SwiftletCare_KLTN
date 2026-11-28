import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button, ErrorNotice, Input } from '@/components/ui';
import { useAuth } from '@/hooks/auth/useAuth';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { getApiErrorCode, getApiErrorReason } from '@/lib/apiError';
import { useDocumentTitle } from '@/hooks/common/useDocumentTitle'
import { t } from '@/i18n'

// ?email= điền sẵn khi vừa tạo tài khoản ở trang lời mời
export default function LoginPage(): JSX.Element {
  useDocumentTitle(t('Đăng nhập'))
  const { login } = useAuth();
  const apiErrorMessage = useApiErrorMessage();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    login.mutate({ email, password, returnTo });
  }

  // 401 ở đây là sai email hoặc mật khẩu, không phải phiên hết hạn; tài khoản bị khoá kèm lý do Administrator đã ghi
  const lockReason = login.isError && getApiErrorCode(login.error) === 'ACCOUNT_DISABLED' ? getApiErrorReason(login.error) : undefined;
  const errorMessage = login.isError
    ? `${apiErrorMessage(login.error, t('Đăng nhập thất bại'), { 401: t('Sai email hoặc mật khẩu. Kiểm tra lại hoặc đặt lại mật khẩu.') })}${lockReason ? ` ${t('Lý do:')} ${lockReason}` : ''}`
    : undefined;

  return (
    <>
      <h1 className="text-center text-h1 font-bold tracking-tight text-charcoal">Đăng nhập</h1>
      <p className="mt-1.5 text-center text-sm text-warmGray">Giám sát và điều khiển nhà yến từ xa</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <Input
          label="Mật khẩu"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        <Link
          to="/forgot-password"
          className="-mt-2 self-end text-xs font-semibold text-charcoal underline underline-offset-2"
        >
          Quên mật khẩu?
        </Link>
        {errorMessage && <ErrorNotice>{errorMessage}</ErrorNotice>}
        <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
          Đăng nhập
        </Button>
      </form>
      <Link to="/privacy" className="mt-6 self-center text-xs text-warmGray underline underline-offset-2 hover:text-charcoal">
        Chính sách quyền riêng tư
      </Link>
    </>
  );
}
