import { User } from '../../src/models/User'
import type { IUser } from '../../src/models/User'

describe('User Model', () => {
  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const user = new User({
        email: 'test@swiftletcare.vn',
        password_hash: 'password123',
        full_name: 'Test User',
      }) as IUser

      await user.save()
      const result = await user.comparePassword('password123')
      expect(result).toBe(true)
    })

    it('should return false for wrong password', async () => {
      const user = new User({
        email: 'test2@swiftletcare.vn',
        password_hash: 'password123',
        full_name: 'Test User',
      }) as IUser

      await user.save()
      const result = await user.comparePassword('wrongpassword')
      expect(result).toBe(false)
    })

    it('should not expose password_hash in JSON', () => {
      const user = new User({
        email: 'test3@swiftletcare.vn',
        password_hash: 'password123',
        full_name: 'Test User',
      }) as IUser

      const json = user.toJSON() as Record<string, unknown>
      expect(json.password_hash).toBeUndefined()
    })
  })
})
