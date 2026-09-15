import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'

/** Express-validator middleware – returns 422 on validation errors */
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() })
    return
  }
  next()
}
