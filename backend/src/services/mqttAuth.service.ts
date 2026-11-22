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

// key sai thì 401. Không bao giờ trả is_superuser: quyền topic nằm ở authz của broker
export async function authorizeBrokerClient(key: unknown, body: MqttAuthRequest): Promise<'allow' | 'deny'> {
  if (!safeEqual(key, process.env.MQTT_AUTH_KEY)) throw UnauthorizedError('Sai khóa')
  const { MQTT_USERNAME, MQTT_PASSWORD } = process.env
  if (safeEqual(body.username, MQTT_USERNAME)) return safeEqual(body.password, MQTT_PASSWORD) ? 'allow' : 'deny'
  // Ký tự đại diện MQTT sẽ mở rộng luật ACL
  if (!DEVICE_ID_PATTERN.test(body.username)) return 'deny'
  return (await verifyBrokerCredential(body.username, body.password)) ? 'allow' : 'deny'
}
