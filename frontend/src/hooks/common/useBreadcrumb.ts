import { useEffect, useRef } from 'react'
import { useBreadcrumbStore, type Crumb } from '@/stores/breadcrumbStore'

/**
 * Trang gọi hook này để đăng ký các cấp breadcrumb PHÍA SAU tên trang gốc — VD
 * `usePageBreadcrumb([{ label: farm.name, onClick: () => navigate(`/farms/${farmId}`) }, { label: house.name }])`
 * cho path `/farms/:farmId/houses/:houseId` sẽ ra "Trang trại / Nhà Yến Demo / Tầng 1".
 * Phần tử cuối trong mảng là vị trí hiện tại — không cần gắn onClick, AppHeader tự
 * hiển thị mờ và không cho bấm.
 *
 * Dùng `signal` (chuỗi nhãn nối lại) làm dependency thay vì mảng `crumbs` — mảng
 * literal tạo mới mỗi render nên so sánh tham chiếu sẽ chạy lại vô hạn; nhãn đổi
 * mới thực sự là lúc cần cập nhật store.
 */
export function usePageBreadcrumb(crumbs: Crumb[]) {
  const setTrail = useBreadcrumbStore(s => s.setTrail)
  const crumbsRef = useRef(crumbs)
  crumbsRef.current = crumbs
  const signal = crumbs.map(c => c.label).join('›')

  useEffect(() => {
    setTrail(crumbsRef.current)
    return () => setTrail([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, setTrail])
}

/**
 * Trang gọi hook này để hiện 1 dòng mô tả ngắn dưới breadcrumb trong topbar
 * (AppHeader) — thay cho việc mỗi trang tự vẽ lại tiêu đề/mô tả trong nội dung,
 * vốn trùng lặp với tên trang topbar đã tự lấy từ menu. Trang không gọi hook
 * thì AppHeader không hiện dòng này.
 */
export function usePageSubtitle(subtitle: string) {
  const setSubtitle = useBreadcrumbStore(s => s.setSubtitle)

  useEffect(() => {
    setSubtitle(subtitle)
    return () => setSubtitle('')
  }, [subtitle, setSubtitle])
}

/**
 * Trang drill-down gọi hook này để hiện "← Quay lại <label>" NGOÀI khung trắng nội
 * dung (AppShell vẽ, trên nền xám) — trang chỉ render được bên trong khung nên phải
 * đi qua store như breadcrumb. `to` là path trang cha cố định (không navigate(-1)):
 * vào thẳng bằng URL vẫn quay lại đúng chỗ.
 */
export function usePageBack(to: string, label: string) {
  const setBack = useBreadcrumbStore(s => s.setBack)

  useEffect(() => {
    setBack({ to, label })
    return () => setBack(null)
  }, [to, label, setBack])
}
