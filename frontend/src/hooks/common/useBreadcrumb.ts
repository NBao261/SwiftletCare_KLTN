import { useEffect, useRef } from 'react'
import { useBreadcrumbStore, type Crumb } from '@/stores/breadcrumbStore'

// Dùng signal (nhãn nối lại) làm dependency: mảng literal mới mỗi render sẽ chạy vô hạn
export function usePageBreadcrumb(crumbs: Crumb[], rootState?: unknown) {
  const setTrail = useBreadcrumbStore(s => s.setTrail)
  const crumbsRef = useRef(crumbs)
  crumbsRef.current = crumbs
  const signal = crumbs.map(c => c.label).join('›')

  useEffect(() => {
    setTrail(crumbsRef.current, rootState)
    return () => setTrail([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, setTrail, rootState])
}

// to là path cha cố định, không navigate(-1): vào thẳng bằng URL vẫn quay lại đúng
export function usePageBack(to: string, label: string, state?: unknown) {
  const setBack = useBreadcrumbStore(s => s.setBack)

  useEffect(() => {
    setBack({ to, label, state })
    return () => setBack(null)
  }, [to, label, state, setBack])
}
