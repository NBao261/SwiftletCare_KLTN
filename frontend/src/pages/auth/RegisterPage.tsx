import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/auth/useAuth';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';

// Trang đăng ký (AUTH-FR-001) — `?email=` điền sẵn khi tới từ link lời mời (Flow 12); khung và ảnh ở AuthLayout
export default function RegisterPage(): JSX.Element {
  const { register } = useAuth();
  const apiErrorMessage = useApiErrorMessage();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ full_name: '', email: searchParams.get('email') ?? '', phone: '', password: '' });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    register.mutate(form);
  }

  const errorMessage = register.isError ? apiErrorMessage(register.error, 'Đăng ký thất bại') : undefined;

  return (
    <>
      <h1 className="text-center text-h1 font-bold tracking-tight text-charcoal">Tạo tài khoản</h1>
      <p className="mt-1.5 text-center text-sm text-warmGray">Farm Owner — quản lý nhà yến của bạn</p>

      {register.isSuccess ? (
        <div className="mt-6 rounded-2xl bg-limeMist p-4 text-sm font-medium text-charcoal">
          Đăng ký thành công! Đang chuyển tới trang đăng nhập...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <Input
            label="Họ và tên"
            required
            value={form.full_name}
            onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
          />
          <Input
            label="Số điện thoại"
            value={form.phone}
            onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
          />
          <Input
            label="Mật khẩu"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
          />
          {errorMessage && (
            <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">{errorMessage}</p>
          )}
          <Button type="submit" size="lg" loading={register.isPending} className="mt-2 w-full">
            Đăng ký
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-warmGray">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-semibold text-charcoal underline underline-offset-2">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
