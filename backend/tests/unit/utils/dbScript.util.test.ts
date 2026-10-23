/**
 * Database script (SDD §6.5): docs/database/init.mongo.js is generated from the models and
 * must stay identical to what the models produce today.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Schema } from 'mongoose'
import { buildDbScript, indexesOf, schemaToJson } from '@/utils/dbScript.util'

const SCRIPT_PATH = resolve(__dirname, '../../../../docs/database/init.mongo.js')

describe('dbScript.util', () => {
  it('docs/database/init.mongo.js matches the models (run `npm run db:script` after a model change)', () => {
    expect(readFileSync(SCRIPT_PATH, 'utf8')).toBe(buildDbScript())
  })

  it('maps types, required fields, enums, nested objects and subdocument arrays', () => {
    const schema = new Schema({
      name: { type: String, required: true },
      status: { type: String, enum: ['A', 'B'], default: 'A' },
      owner: { type: Schema.Types.ObjectId, required: true },
      limits: { min: Number, max: { type: Number, required: true } },
      tags: [String],
      history: [{ at: { type: Date, required: true }, note: String }],
      extra: Schema.Types.Mixed,
    })
    const json = schemaToJson(schema)

    expect(json.required).toEqual(['name', 'owner'])
    expect(json.properties?.name).toEqual({ bsonType: 'string' })
    expect(json.properties?.status).toEqual({ bsonType: ['string', 'null'], enum: ['A', 'B', null] })
    expect(json.properties?.owner).toEqual({ bsonType: 'objectId' })
    expect(json.properties?.limits).toMatchObject({
      bsonType: ['object', 'null'],
      required: ['max'],
      properties: { min: { bsonType: ['number', 'null'] }, max: { bsonType: 'number' } },
    })
    expect(json.properties?.tags).toEqual({ bsonType: ['array', 'null'], items: { bsonType: 'string' } })
    expect(json.properties?.history?.items).toMatchObject({
      bsonType: 'object', required: ['at'], properties: { at: { bsonType: 'date' }, note: { bsonType: ['string', 'null'] } },
    })
    expect(json.properties?.extra).toEqual({})
  })

  it('keeps unique, TTL and partial index options', () => {
    const schema = new Schema({ code: { type: String, unique: true }, at: Date, kind: String })
    schema.index({ at: 1 }, { expireAfterSeconds: 60 })
    schema.index({ kind: 1 }, { partialFilterExpression: { kind: { $exists: true } } })

    expect(indexesOf(schema)).toEqual([
      [{ code: 1 }, { unique: true }],
      [{ at: 1 }, { expireAfterSeconds: 60 }],
      [{ kind: 1 }, { partialFilterExpression: { kind: { $exists: true } } }],
    ])
  })
})
