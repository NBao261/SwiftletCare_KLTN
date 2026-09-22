import { lazy } from 'react'
import { Route } from 'react-router-dom'

/**
 * Route không cần đăng nhập — nằm NGOÀI MainLayout nên không có sidebar/topbar.
 * Trang đăng nhập/đăng ký/nhận lời mời ở `pages/auth/`; trang cho khách xem
 * (chợ tổ yến, 403) nằm thẳng ở `pages/` vì không thuộc nghiệp vụ role nào.
 * Marketplace hiện là stub — backend module Bán hàng còn 501 (Giai đoạn 2).
 */
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const InvitationPage = lazy(() => import('@/pages/auth/InvitationPage'))
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'))
const ListingDetailPage = lazy(() => import('@/pages/ListingDetailPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))

export const publicRoutes = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/invitations/:token" element={<InvitationPage />} />
    <Route path="/marketplace" element={<MarketplacePage />} />
    <Route path="/marketplace/:id" element={<ListingDetailPage />} />
    <Route path="/403" element={<ForbiddenPage />} />
  </>
)
