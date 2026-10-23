import { lazy } from 'react'
import { Route } from 'react-router-dom'
import AuthLayout from '@/components/layouts/AuthLayout'

/**
 * Route không cần đăng nhập — nằm NGOÀI MainLayout nên không có sidebar/topbar.
 * Trang đăng nhập/đăng ký/nhận lời mời ở `pages/auth/`; trang 403 nằm thẳng ở `pages/`
 * vì không thuộc nghiệp vụ role nào. Chợ tổ yến đã gỡ theo SRS v2.0.0 (bỏ Marketplace).
 */
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const InvitationPage = lazy(() => import('@/pages/auth/InvitationPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))

export const publicRoutes = (
  <>
    {/* Đăng nhập / Đăng ký / Quên mật khẩu chung 1 khung: khung giữ nguyên khi chuyển trang để ảnh trượt qua lại */}
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    </Route>
    <Route path="/invitations/:token" element={<InvitationPage />} />
    <Route path="/403" element={<ForbiddenPage />} />
  </>
)
