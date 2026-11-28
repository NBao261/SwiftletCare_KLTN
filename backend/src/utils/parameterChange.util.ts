import { isDeepStrictEqual } from 'node:util'

// Bộ giá trị mới giống hệt bộ đang áp dụng thì không có gì để ghi: không lịch sử, không phát lại cấu hình xuống thiết bị,
// không báo Farm Owner hay chuyên gia, không mở mục duyệt. Khoá sắp xếp khác nhau và giá trị undefined không làm khác đi
export function isUnchanged(before: unknown, after: unknown): boolean {
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as unknown
  return isDeepStrictEqual(plain(before), plain(after))
}
