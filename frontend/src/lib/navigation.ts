/**
 * Cầu nối điều hướng cho code ngoài React tree (vd axios interceptor trong
 * services/api/client.ts) — cho phép gọi navigate() của react-router thay vì
 * window.location.href (tránh full reload, giữ được SPA state).
 */
type NavigateFn = (to: string, opts?: { replace?: boolean }) => void

let navigateFn: NavigateFn | null = null

/** Gọi 1 lần trong App() bằng useNavigate() sau khi router đã mount. */
export function setNavigate(fn: NavigateFn | null): void {
  navigateFn = fn
}

/** Điều hướng về /login, giữ lại đường dẫn hiện tại qua ?returnTo= để quay lại sau khi đăng nhập. */
export function redirectToLogin(returnTo?: string): void {
  const to = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'
  if (navigateFn) {
    navigateFn(to, { replace: true })
  } else {
    // Fallback: interceptor bắn trước khi router mount (hiếm khi xảy ra)
    window.location.href = to
  }
}
