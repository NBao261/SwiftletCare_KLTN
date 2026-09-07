/**
 * Express Request augmentation – adds `user` property to all requests
 * after authenticate() middleware runs.
 *
 * This file must be a .d.ts module (not .ts) and must be included via tsconfig.
 */
import type { Role, NotificationPreferences } from './domain'

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
