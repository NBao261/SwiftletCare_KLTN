import { AuditLog } from '@/models/auditLog.model'
import logger from '@/utils/logger.util'

/**
 * AUTH-FR-007 — ghi log hành động quản trị/đăng nhập. Cố tình không throw khi
 * ghi log lỗi: audit log là phụ trợ, không được phép làm hỏng luồng nghiệp vụ
 * chính (ví dụ khoá tài khoản vẫn phải thành công dù ghi log thất bại).
 */
export async function logAction(
  actorId: string | undefined,
  action: string,
  targetType: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({ actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata })
  } catch (err) {
    logger.warn('Ghi audit_log thất bại', { err, action, targetType, targetId })
  }
}
