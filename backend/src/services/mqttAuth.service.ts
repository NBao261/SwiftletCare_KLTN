import crypto from 'crypto'
import { verifyBrokerCredential } from '@/services/provisionedDevice.service'
import { UnauthorizedError } from '@/utils/appError.util'
import { DEVICE_ID_PATTERN } from '@/utils/deviceCommand.util'

const safeEqual = (a: unknown, b: string | undefined): boolean => {
  if (typeof a !== 'string' || !b) return false
  const hash = (s: string) => crypto.createHash('sha256').update(s).digest()
  return crypto.timingSafeEqual(hash(a), hash(b))
}

export interface MqttAuthRequest {
  username: string
  password: string
}

/**
 * NFR-10 d — HTTP authentication của EMQX. `key` sai là bên gọi không phải EMQX: 401. Còn lại luôn trả
 * kết quả để EMQX đọc từ thân phản hồi. Quyền theo topic nằm ở file authz của broker (deploy/emqx/),
 * nên không bao giờ trả `is_superuser: true`.
 */
export async function authorizeBrokerClient(key: unknown, body: MqttAuthRequest): Promise<'allow' | 'deny'> {
  if (!safeEqual(key, process.env.MQTT_AUTH_KEY)) throw UnauthorizedError('Sai khóa')
  const { MQTT_USERNAME, MQTT_PASSWORD } = process.env
  if (safeEqual(body.username, MQTT_USERNAME)) return safeEqual(body.password, MQTT_PASSWORD) ? 'allow' : 'deny'
  // Username có ký tự đại diện của MQTT sẽ mở rộng luật ACL `swiftletcare/dev/${username}/#`: không bao giờ cho vào
  if (!DEVICE_ID_PATTERN.test(body.username)) return 'deny'
  return (await verifyBrokerCredential(body.username, body.password)) ? 'allow' : 'deny'
}
