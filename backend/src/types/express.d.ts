/** Phải là .d.ts và nằm trong tsconfig */
import type { Role, NotificationPreferences } from './domain.types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: {
        _id: string
        email: string
        role: Role
        full_name: string
        is_active: boolean
        notification_preferences: NotificationPreferences
      }
    }
  }
}

export {}
