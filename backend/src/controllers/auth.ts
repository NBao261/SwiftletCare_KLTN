import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { User, IUser } from '@/models/User'
import type { AuthRequest, JwtAccessPayload } from '@/types'
import logger from '@/utils/logger'

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  ?? '15m'
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '30d'

function signAccess(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TTL } as jwt.SignOptions)
}

function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL } as jwt.SignOptions)
}

/** POST /auth/register – AUTH-FR-001 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, full_name, phone } = req.body as {
      email: string; password: string; full_name: string; phone?: string
    }

    const existing = await User.findOne({ email })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const user = new User({ email, password_hash: password, full_name, phone })
    await user.save()

    logger.info('User registered', { userId: user._id, email })
    res.status(201).json({ data: user })
  } catch (err) {
    logger.error('Register error', { err })
    res.status(500).json({ error: 'Internal server error' })
  }
}

/** POST /auth/login – AUTH-FR-002 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string }

    const user = await User.findOne({ email })
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    if (!user.is_active) {
      res.status(403).json({ error: 'Account disabled' })
      return
    }

    const accessToken  = signAccess(String(user._id), user.role)
    const refreshToken = signRefresh(String(user._id))

    // Store refresh token
    user.refresh_tokens.push({ token: refreshToken, expires: new Date(Date.now() + 30 * 86400 * 1000) })
    await user.save()

    // Send refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 86400 * 1000,
    })

    res.json({ data: { accessToken, user } })
  } catch (err) {
    logger.error('Login error', { err })
    res.status(500).json({ error: 'Internal server error' })
  }
}

/** POST /auth/refresh – AUTH-FR-003 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refreshToken as string | undefined
    if (!token) {
      res.status(401).json({ error: 'No refresh token' })
      return
    }

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { sub: string }
    const user = await User.findById(payload.sub)
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    const isValid = user.refresh_tokens.some(t => t.token === token && t.expires > new Date())
    if (!isValid) {
      res.status(401).json({ error: 'Refresh token revoked or expired' })
      return
    }

    const accessToken = signAccess(String(user._id), user.role)
    res.json({ data: { accessToken } })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
}

/** POST /auth/logout – AUTH-FR-006 */
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refreshToken as string | undefined
    if (token) {
      await User.updateOne({ _id: req.user._id }, { $pull: { refresh_tokens: { token } } })
    }
    res.clearCookie('refreshToken')
    res.json({ data: { message: 'Logged out successfully' } })
  } catch (err) {
    logger.error('Logout error', { err })
    res.status(500).json({ error: 'Internal server error' })
  }
}

/** POST /auth/otp/send – AUTH-FR-005 */
export async function sendOtp(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email: string }
    const user = await User.findOne({ email })
    if (!user) {
      // Security: don't reveal if email exists
      res.json({ data: { message: 'If email exists, OTP was sent' } })
      return
    }

    const otp = crypto.randomInt(100000, 999999).toString()
    user.otp_code    = otp
    user.otp_expires = new Date(Date.now() + 10 * 60 * 1000)  // 10 min
    await user.save()

    // TODO: Send via SMTP / Zalo ZNS (ALERT-FR-003)
    logger.info(`OTP generated for ${email}`)
    res.json({ data: { message: 'OTP sent' } })
  } catch (err) {
    logger.error('Send OTP error', { err })
    res.status(500).json({ error: 'Internal server error' })
  }
}

/** POST /auth/otp/verify – AUTH-FR-005 */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  try {
    const { email, otp } = req.body as { email: string; otp: string }
    const user = await User.findOne({ email })

    if (!user || user.otp_code !== otp || !user.otp_expires || user.otp_expires < new Date()) {
      res.status(400).json({ error: 'Invalid or expired OTP' })
      return
    }

    user.otp_code    = undefined
    user.otp_expires = undefined
    await user.save()

    const accessToken = signAccess(String(user._id), user.role)
    res.json({ data: { accessToken, user } })
  } catch (err) {
    logger.error('Verify OTP error', { err })
    res.status(500).json({ error: 'Internal server error' })
  }
}
