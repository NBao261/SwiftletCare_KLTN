import { randomUUID } from 'crypto'

/**
 * BR-35 — lệnh relay, audio, RESTART, OTA mang mã lệnh và giờ phát (epoch ms): thiết bị áp mỗi mã
 * 1 lần và bỏ lệnh tới trễ. Gói cấu hình không cần: thiết bị nhận trễ vẫn vô hại.
 */
export function stampCommand<T extends object>(command: T): T & { commandId: string; issuedAt: number } {
  return { ...command, commandId: randomUUID(), issuedAt: Date.now() }
}
