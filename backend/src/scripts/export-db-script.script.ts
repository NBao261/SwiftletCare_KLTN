/**
 * npm run db:script — regenerate docs/database/init.mongo.js from the Mongoose models
 * (SDD §6.5). Run after changing a model; the unit test fails until the file is regenerated.
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { buildDbScript } from '@/utils/dbScript.util'

export const DB_SCRIPT_PATH = resolve(__dirname, '../../../docs/database/init.mongo.js')

writeFileSync(DB_SCRIPT_PATH, buildDbScript())
console.log(`Wrote ${DB_SCRIPT_PATH}`)
