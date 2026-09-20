import { useEffect, useRef } from 'react'
import { useBreadcrumbStore, type Crumb } from '@/store/breadcrumbStore'

/**
 * Trang gọi hook này để đăng ký các cấp breadcrumb PHÍA SAU tên trang gốc — VD
 * `usePageBreadcrumb([{ label: farm.name, onClick: () => navigate(`/farms/${farmId}`) }, { label: house.name }])`
 * cho path `/farms/:farmId/houses/:houseId` sẽ ra "Trang trại / Nhà Yến Demo / Tầng 1".
 * Phần tử cuối trong mảng là vị trí hiện tại — không cần gắn onClick, TopBar tự
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
