// Định nghĩa kiểu của frontend, tách theo module nghiệp vụ giống `apis/`.
// Kiểu là shape thực thể mirror model backend nên dùng chung nhiều role —
// chia theo module đúng hơn chia theo role. Barrel này giữ `@/types` chạy như cũ.
// Nguồn: SRS §8.2 MongoDB Schemas.

export type * from '@/types/common.types'
export type * from '@/types/auth.types'
export type * from '@/types/farm.types'
export type * from '@/types/device.types'
export type * from '@/types/telemetry.types'
export type * from '@/types/alert.types'
export type * from '@/types/ticket.types'
export type * from '@/types/harvest.types'
export type * from '@/types/vision.types'
export type * from '@/types/system.types'
export type * from '@/types/socket.types'
