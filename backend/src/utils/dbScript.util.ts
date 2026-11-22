// Mongo không có DDL: script sinh từ model, test so với docs/database/init.mongo.js
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
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { House, Zone } from '@/models/houseZone.model'
import { Invitation } from '@/models/invitation.model'
import { MaintenancePlan } from '@/models/maintenancePlan.model'
import { Notification } from '@/models/notification.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { PushToken } from '@/models/pushToken.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { WorkOrder } from '@/models/workOrder.model'
import { WeatherCompensation } from '@/models/weatherCompensation.model'
import { ConfigProfile } from '@/models/configProfile.model'
import { Recommendation } from '@/models/recommendation.model'
import { RecommendationRule } from '@/models/recommendationRule.model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- models have different document types
type AnyModel = Model<any>

export const ALL_MODELS: AnyModel[] = [
  WeatherCompensation,
  ConfigProfile,
  Recommendation,
  RecommendationRule,
  Alert, AudioTrack, AuditLog, BirdCountBucket, BirdCountRecord, SensorNode, CameraNode, CoefficientProposal,
  Farm, HarvestBatch, HarvestCycle, House, HouseHealthDay, HouseHealthReport, Zone, Invitation, MaintenancePlan, Notification, ParameterReview,
  PushToken, ProvisionedDevice, RelayOverrideLog, SystemSetting, Telemetry, User, WeatherObservation, WorkOrder,
]

export interface JsonSchemaNode {
  bsonType?: string | string[]
  required?: string[]
  properties?: Record<string, JsonSchemaNode>
  items?: JsonSchemaNode
  enum?: unknown[]
}

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
  // Optional có thể là null (Mongoose lưu null khi xoá trường)
  const bsonType = BSON_TYPES[instance]
  const node: JsonSchemaNode = {}
  if (bsonType) node.bsonType = isRequired(type) ? bsonType : [bsonType, 'null']

  const sub = (type as SchemaType & { schema?: Schema }).schema
  if (sub && instance === 'Embedded') {
    Object.assign(node, schemaToJson(sub), { bsonType: node.bsonType })
  } else if (sub && instance === 'Array') {
    node.items = schemaToJson(sub)
  } else if (instance === 'Array') {
    const caster = (type as SchemaType & { caster?: SchemaType }).caster
    if (caster) {
      const item = nodeForType(caster)
      if (Array.isArray(item.bsonType)) item.bsonType = item.bsonType[0]
      node.items = item
    }
  }

  const values = enumOf(type)
  if (values) node.enum = isRequired(type) ? values : [...values, null]
  return node
}

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
    // expires: '90d' tới đây đã là số giây
    return [fields as Record<string, unknown>, kept]
  })
}

// Chạy hai lần vẫn an toàn
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
