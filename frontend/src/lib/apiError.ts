// 4 nhóm lỗi API hiển thị cho người dùng
export type ApiErrorGroup = 'permission' | 'notFound' | 'invalid' | 'system';

// Mã HTTP thuộc nhóm phiên / quyền, không tìm thấy, dữ liệu không hợp lệ
const PERMISSION_STATUSES = [401, 403];
const NOT_FOUND_STATUSES = [404, 410];
const INVALID_STATUSES = [400, 409, 413, 415, 422];

// Đổi lỗi axios sang nhóm lỗi, không có phản hồi hoặc mã lạ thì xem là lỗi hệ thống / mạng
export function getApiErrorGroup(error: unknown): ApiErrorGroup {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  if (status === undefined) return 'system';
  if (PERMISSION_STATUSES.includes(status)) return 'permission';
  if (NOT_FOUND_STATUSES.includes(status)) return 'notFound';
  if (INVALID_STATUSES.includes(status)) return 'invalid';
  return 'system';
}
