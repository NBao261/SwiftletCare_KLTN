import { lazy } from 'react'
import { Route } from 'react-router-dom'

/**
 * Sales Staff mới chỉ có trang nhà dạng stub — module Bán hàng còn là scaffold
 * 501 bên backend (Giai đoạn 2). Không bọc RequireRole vì trang không lộ dữ
 * liệu nghiệp vụ nào; thêm màn hình thật thì siết lại ở đây.
 */
const SalesStaffHomePage = lazy(() => import('@/pages/sales-staff/SalesStaffHomePage'))

export const salesStaffRoutes = (
  <>
    <Route path="sales-home" element={<SalesStaffHomePage />} />
  </>
)
