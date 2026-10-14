import fs from 'fs'
import os from 'os'
import path from 'path'
import { presignedGetUrl, putObject, removeObject } from '@/config/minio.config'

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
