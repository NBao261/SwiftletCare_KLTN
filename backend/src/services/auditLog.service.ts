import { AuditLog } from '@/models/auditLog.model'
import logger from '@/utils/logger.util'
import { getRequestActorRole, getRequestClient, getRequestIp } from '@/utils/requestContext.util'

/**
 * AUTH-FR-007 — ghi log hành động quản trị/đăng nhập. Cố tình không throw khi
 * ghi log lỗi: audit log là phụ trợ, không được phép làm hỏng luồng nghiệp vụ
 * chính (ví dụ khoá tài khoản vẫn phải thành công dù ghi log thất bại).
 * `source_ip`, `client`, `correlation_id` và `actor_role` tự lấy từ ngữ cảnh request (middleware requestContext,
 * `authenticate`); rỗng khi hành động do hệ thống tự thực hiện ngoài request.
 * `farmId` gắn hành động vào 1 farm — lịch sử hoạt động chuyên gia đọc theo đó (EXPERT-FR-009).
 * Trả id bản ghi (thông báo của chuyên gia trỏ tới nó), undefined khi ghi lỗi.
 */
export async function logAction(
  actorId: string | undefined,
  action: string,
  targetType: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
  opts: { farmId?: string } = {},
): Promise<string | undefined> {
  try {
    const { client, correlationId } = getRequestClient()
    const entry = await AuditLog.create({
      actor_id: actorId, actor_role: getRequestActorRole(), farm_id: opts.farmId,
      action, target_type: targetType, target_id: targetId, metadata,
      // Report 4 §6.1 — trước/sau ở trường riêng; `metadata` giữ nguyên cho các màn đang đọc nó
      ...(metadata && 'before' in metadata && { before: metadata.before }),
      ...(metadata && 'after' in metadata && { after: metadata.after }),
      source_ip: getRequestIp(), client, correlation_id: correlationId,
    })
    return String(entry._id)
  } catch (err) {
    logger.warn('Ghi audit_log thất bại', { err, action, targetType, targetId })
    return undefined
  }
}
