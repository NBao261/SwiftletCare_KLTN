// Barrel của design system. `icons` CỐ Ý không nằm ở đây: mỗi màn chỉ dùng vài
// icon nên import thẳng `@/components/ui/icons` để không kéo cả bộ vào chunk.

// Primitive nguyên tử
export * from '@/components/ui/Button'
export * from '@/components/ui/Card'
export * from '@/components/ui/Badge'
export * from '@/components/ui/Toggle'
export * from '@/components/ui/Input'
export * from '@/components/ui/Select'
export * from '@/components/ui/Textarea'
export * from '@/components/ui/Modal'

// Widget tổ hợp — vẫn thuộc ui/ vì không biết gì về domain
export { default as ActionsMenu, type ActionsMenuItem } from '@/components/ui/ActionsMenu'
export { default as SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu'
export { default as DataTable, type DataTableColumn } from '@/components/ui/DataTable'
export { default as Pagination } from '@/components/ui/Pagination'
export { default as FilterChip } from '@/components/ui/FilterChip'
export { default as EmptyState } from '@/components/ui/EmptyState'
export { default as LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
export { default as StarRating } from '@/components/ui/StarRating'
export { default as RadialGauge } from '@/components/ui/RadialGauge'
export { default as ConfirmModal } from '@/components/ui/ConfirmModal'
export { default as NoteActionModal } from '@/components/ui/NoteActionModal'
export { default as ComingSoon } from '@/components/ui/ComingSoon'
