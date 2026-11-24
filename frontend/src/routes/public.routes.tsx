import { lazy } from 'react'
import { Route } from 'react-router-dom'
import AuthLayout from '@/components/layouts/AuthLayout'

// Không cần đăng nhập, nằm ngoài MainLayout; không có đăng ký công khai
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ChangePasswordPage = lazy(() => import('@/pages/auth/ChangePasswordPage'))
const InvitationPage = lazy(() => import('@/pages/auth/InvitationPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'))

export const publicRoutes = (
  <>
    {/* Đăng nhập / Quên mật khẩu chung 1 khung: khung giữ nguyên khi chuyển trang để ảnh trượt qua lại */}
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      {/* cần đăng nhập nhưng nằm ngoài khung role: tài khoản còn mật khẩu tạm chưa được vào trang nào */}
      <Route path="/change-password" element={<ChangePasswordPage />} />
    </Route>
    <Route path="/invitations/:token" element={<InvitationPage />} />
    <Route path="/403" element={<ForbiddenPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
  </>
)
