import fs from 'fs'
import os from 'os'
import path from 'path'
import { presignedGetUrl, putObject, removeObject, s3Endpoint } from '@/config/minio.config'

describe('local storage driver (STORAGE_DRIVER=local)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swiftlet-storage-'))
  beforeAll(() => {
    process.env.STORAGE_DRIVER = 'local'
    process.env.LOCAL_STORAGE_DIR = dir
  })
  afterAll(() => {
    delete process.env.STORAGE_DRIVER
    delete process.env.LOCAL_STORAGE_DIR
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes, exposes and removes a file without MinIO', async () => {
    await putObject('audio-tracks/n1/a.mp3', Buffer.from('mp3'), 'audio/mpeg')
    expect(fs.readFileSync(path.join(dir, 'audio-tracks/n1/a.mp3'), 'utf8')).toBe('mp3')
    expect(await presignedGetUrl('audio-tracks/n1/a.mp3')).toMatch(/\/files\/audio-tracks\/n1\/a\.mp3$/)

    await removeObject('audio-tracks/n1/a.mp3')
    expect(fs.existsSync(path.join(dir, 'audio-tracks/n1/a.mp3'))).toBe(false)
  })

  it('rejects keys that escape the storage directory', async () => {
    await expect(putObject('../outside.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(/không hợp lệ/)
  })
})

describe('S3 endpoint (MinIO in dev, R2 on staging)', () => {
  const keys = ['MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_USE_SSL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET'] as const
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('keeps the port of a local MinIO', () => {
    delete process.env.MINIO_PORT
    delete process.env.MINIO_USE_SSL
    process.env.MINIO_ENDPOINT = 'localhost'
    expect(s3Endpoint()).toBe('http://localhost:9000')
  })

  it('leaves out the default port of the protocol', () => {
    process.env.MINIO_ENDPOINT = 'acc.r2.cloudflarestorage.com'
    process.env.MINIO_USE_SSL = 'true'
    process.env.MINIO_PORT = '443'
    expect(s3Endpoint()).toBe('https://acc.r2.cloudflarestorage.com')
    process.env.MINIO_USE_SSL = 'false'
    process.env.MINIO_PORT = '80'
    expect(s3Endpoint()).toBe('http://acc.r2.cloudflarestorage.com')
  })

  it('keeps a port that is not the default and falls back to 9000 when it is empty', () => {
    process.env.MINIO_ENDPOINT = 'files.example.com'
    process.env.MINIO_USE_SSL = 'true'
    process.env.MINIO_PORT = '9443'
    expect(s3Endpoint()).toBe('https://files.example.com:9443')
    process.env.MINIO_PORT = ''
    expect(s3Endpoint()).toBe('https://files.example.com:9000')
  })

  it('signs a URL a browser can open: no port in the host', async () => {
    process.env.MINIO_ENDPOINT = 'acc.r2.cloudflarestorage.com'
    process.env.MINIO_USE_SSL = 'true'
    process.env.MINIO_PORT = '443'
    process.env.MINIO_ACCESS_KEY = 'key'
    process.env.MINIO_SECRET_KEY = 'secret'
    process.env.MINIO_BUCKET = 'swiftletcare-files'
    // Chuỗi thô: new URL() tự bỏ ":443" nên che mất lỗi mà trình duyệt gặp
    const url = await presignedGetUrl('work-orders/a.jpg')
    expect(url.startsWith('https://acc.r2.cloudflarestorage.com/swiftletcare-files/work-orders/a.jpg?')).toBe(true)
  })
})
