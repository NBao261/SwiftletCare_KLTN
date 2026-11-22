/** npm run db:script: sinh lại docs/database/init.mongo.js sau khi đổi model */
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { buildDbScript } from '@/utils/dbScript.util'

export const DB_SCRIPT_PATH = resolve(__dirname, '../../../docs/database/init.mongo.js')

writeFileSync(DB_SCRIPT_PATH, buildDbScript())
console.log(`Wrote ${DB_SCRIPT_PATH}`)
