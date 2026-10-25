/**
 * docs/api/api-spec.yaml là nguồn của Swagger UI: app.config.ts chỉ log cảnh báo khi spec
 * lỗi, nên một dòng YAML sai làm mất /api-docs mà không test nào đỏ.
 */
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

const spec = YAML.parse(fs.readFileSync(path.resolve(__dirname, '../../../../docs/api/api-spec.yaml'), 'utf-8')) as {
  paths: Record<string, unknown>
  components: { schemas: Record<string, unknown> }
}

describe('api-spec.yaml', () => {
  it('parses and every schema $ref resolves', () => {
    const refs = [...JSON.stringify(spec).matchAll(/#\/components\/schemas\/(\w+)/g)].map(m => m[1])
    expect(refs.filter(name => !(name in spec.components.schemas))).toEqual([])
  })

  it('has no ticket, SLA or maintenance-schedule routes (Report 3 §8)', () => {
    expect(Object.keys(spec.paths).filter(p => /ticket|\/sla|maintenance-schedules/.test(p))).toEqual([])
  })
})
