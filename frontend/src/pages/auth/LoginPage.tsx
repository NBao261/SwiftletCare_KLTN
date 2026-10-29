import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/auth/useAuth';
import { getApiErrorMessage } from '@/lib/helpers';

// Trang đăng nhập (AUTH-FR-002) — khung và ảnh ở AuthLayout. Không có link đăng ký: tài khoản do Admin tạo hoặc
// tạo từ link lời mời; `?email=` điền sẵn khi vừa tạo tài khoản ở trang lời mời
export default function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    login.mutate({ email, password, returnTo });
  }

  const errorMessage = login.isError ? getApiErrorMessage(login.error, 'Đăng nhập thất bại') : undefined;

  return (
    <>
      <h1 className="text-center text-h1 font-bold tracking-tight text-charcoal">Đăng nhập</h1>
      <p className="mt-1.5 text-center text-sm text-warmGray">Giám sát và điều khiển nhà yến từ xa</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <Input
          label="Mật khẩu"
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
        {errorMessage && (
          <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">{errorMessage}</p>
        )}
        <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
          Đăng nhập
        </Button>
      </form>
    </>
  );
}
