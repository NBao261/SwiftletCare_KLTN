import { ArrowLeftIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

// Nút quay lại đăng nhập ở hàng logo của trang Quên mật khẩu / Chính sách — khung ảnh trượt về bên phải
export default function AuthBackLink({ label = 'Quay lại đăng nhập' }: { label?: string }): JSX.Element {
  return (
    <Link
      to="/login"
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-warmGray/20 px-3 py-1.5 text-xs font-semibold text-warmGray transition-colors hover:border-warmGray/40 hover:text-charcoal"
    >
      <ArrowLeftIcon size={14} weight="bold" />
      {label}
    </Link>
  );
}
