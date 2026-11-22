import { AuditLog } from '@/models/auditLog.model'
import logger from '@/utils/logger.util'
import { getRequestActorRole, getRequestClient, getRequestIp } from '@/utils/requestContext.util'

/** Không throw: audit log không được làm hỏng nghiệp vụ. source_ip, client, actor_role lấy từ ngữ cảnh request */
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
      // metadata giữ nguyên cho các màn đang đọc nó
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
