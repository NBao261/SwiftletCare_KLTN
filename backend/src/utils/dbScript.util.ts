/**
 * Database script (Review 2 – SDD §6.5): build a mongosh script that creates every
 * collection with a `$jsonSchema` validator and the indexes declared in the Mongoose
 * models. Mongo has no DDL file of its own, so the models are the single source and the
 * script is generated from them — `docs/database/init.mongo.js` is checked against this
 * output in `tests/unit/utils/dbScript.util.test.ts`, so the script never drifts from code.
 */
import type { Model, Schema, SchemaType } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { AudioTrack } from '@/models/audioTrack.model'
import { AuditLog } from '@/models/auditLog.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { SensorNode, CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { Invitation } from '@/models/invitation.model'
import { Notification } from '@/models/notification.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { ZoneHealthReport } from '@/models/zoneHealthReport.model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- models have different document types
type AnyModel = Model<any>

export const ALL_MODELS: AnyModel[] = [
  Alert, AudioTrack, AuditLog, BirdCountBucket, BirdCountRecord, SensorNode, CameraNode, CoefficientProposal,
  Farm, HarvestBatch, House, Zone, Invitation, Notification, ParameterReview,
  ProvisionedDevice, RelayOverrideLog, SystemSetting, Telemetry, User, ZoneHealthReport,
]

export interface JsonSchemaNode {
  bsonType?: string | string[]
  required?: string[]
  properties?: Record<string, JsonSchemaNode>
  items?: JsonSchemaNode
  enum?: unknown[]
}

/** Mongoose instance name → BSON type; Mixed has no type constraint */
const BSON_TYPES: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Boolean: 'bool',
  Date: 'date',
  ObjectId: 'objectId',
  Buffer: 'binData',
  Decimal128: 'decimal',
  Map: 'object',
  Embedded: 'object',
  Array: 'array',
}

function isRequired(type: SchemaType): boolean {
  return (type as SchemaType & { isRequired?: boolean }).isRequired === true
}

function enumOf(type: SchemaType): unknown[] | undefined {
  const values = (type as SchemaType & { enumValues?: unknown[] }).enumValues
  return values && values.length > 0 ? values : undefined
}

function nodeForType(type: SchemaType): JsonSchemaNode {
  const instance = type.instance
  // A required field has its type and enum checked; an optional one may also be null
  // (Mongoose stores `null` for cleared optional fields)
  const bsonType = BSON_TYPES[instance]
  const node: JsonSchemaNode = {}
  if (bsonType) node.bsonType = isRequired(type) ? bsonType : [bsonType, 'null']

  // Single nested schemas report `Embedded`; arrays of subdocuments report `Array` with a `schema`
  const sub = (type as SchemaType & { schema?: Schema }).schema
  if (sub && instance === 'Embedded') {
    Object.assign(node, schemaToJson(sub), { bsonType: node.bsonType })
  } else if (sub && instance === 'Array') {
    node.items = schemaToJson(sub)
  } else if (instance === 'Array') {
    const caster = (type as SchemaType & { caster?: SchemaType }).caster
    if (caster) {
      const item = nodeForType(caster)
      // array elements are never null on their own
      if (Array.isArray(item.bsonType)) item.bsonType = item.bsonType[0]
      node.items = item
    }
  }

  const values = enumOf(type)
  if (values) node.enum = isRequired(type) ? values : [...values, null]
  return node
}

/** Nested plain objects (`thresholds.temp_min`) become nested `properties` */
export function schemaToJson(schema: Schema): JsonSchemaNode {
  const root: JsonSchemaNode = { bsonType: 'object', properties: {} }
  schema.eachPath((path, type) => {
    if (path === '__v') return
    const parts = path.split('.')
    let parent = root
    for (const part of parts.slice(0, -1)) {
      parent.properties ??= {}
      parent.properties[part] ??= { bsonType: ['object', 'null'], properties: {} }
      parent = parent.properties[part]
    }
    const name = parts[parts.length - 1]
    parent.properties ??= {}
    parent.properties[name] = nodeForType(type)
    if (isRequired(type)) (parent.required ??= []).push(name)
  })
  return root
}

/** Pretty JSON, but arrays of plain values stay on one line so the script stays readable */
function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(
    /\[\s*((?:"[^"\n]*"|-?\d+(?:\.\d+)?|null|true|false)(?:,\s*(?:"[^"\n]*"|-?\d+(?:\.\d+)?|null|true|false))*)\s*\]/g,
    (_match, items: string) => `[${items.split(/,\s*/).join(', ')}]`,
  )
}

const INDEX_OPTIONS = ['name', 'unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression'] as const

export function indexesOf(schema: Schema): Array<[Record<string, unknown>, Record<string, unknown>]> {
  return schema.indexes().map(([fields, options]) => {
    const kept: Record<string, unknown> = {}
    for (const key of INDEX_OPTIONS) {
      const value = (options as Record<string, unknown>)[key]
      if (value !== undefined) kept[key] = value
    }
    // `expires: '90d'` on a path reaches here as the number of seconds already
    return [fields as Record<string, unknown>, kept]
  })
}

/** mongosh script: create or update each collection, then its indexes; safe to run twice */
export function buildDbScript(models: AnyModel[] = ALL_MODELS): string {
  const sorted = [...models].sort((a, b) => a.collection.collectionName.localeCompare(b.collection.collectionName))
  const lines = [
    '// SwiftletCare – MongoDB database script (collections, validators, indexes).',
    '// GENERATED from backend/src/models by `npm run db:script` – do not edit by hand.',
    '// Run: mongosh "<MONGODB_URI>" docs/database/init.mongo.js',
    '// Safe to run twice: existing collections get their validator updated (collMod).',
    '',
    'const existing = db.getCollectionNames()',
    'function ensureCollection(name, schema) {',
    "  const validator = { $jsonSchema: schema }",
    "  if (existing.includes(name)) db.runCommand({ collMod: name, validator, validationLevel: 'moderate' })",
    "  else db.createCollection(name, { validator, validationLevel: 'moderate' })",
    '}',
    '',
  ]
  for (const model of sorted) {
    const name = model.collection.collectionName
    lines.push(`// ── ${name} (model ${model.modelName}) ──`)
    lines.push(`ensureCollection(${JSON.stringify(name)}, ${stringify(schemaToJson(model.schema))})`)
    for (const [fields, options] of indexesOf(model.schema)) {
      const opts = Object.keys(options).length > 0 ? `, ${JSON.stringify(options)}` : ''
      lines.push(`db.getCollection(${JSON.stringify(name)}).createIndex(${JSON.stringify(fields)}${opts})`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
