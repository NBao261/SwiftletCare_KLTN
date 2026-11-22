import fs from 'fs/promises'
import path from 'path'
import type S3 from 'aws-sdk/clients/s3'

// Nạp lười: boot/test không cần MinIO. Aws-sdk v2 hết hỗ trợ, chuyển sang v3 nếu cần vá bảo mật
// Chỉ dùng khi dev: file ở /files/<key> không cần đăng nhập, không hết hạn
export const isLocalStorage = () => process.env.STORAGE_DRIVER === 'local'
export const localStorageDir = () => path.resolve(process.env.LOCAL_STORAGE_DIR ?? 'storage')

// Chặn key thoát khỏi thư mục lưu
function localPath(key: string): string {
  const root = localStorageDir()
  const full = path.resolve(root, key)
  if (!full.startsWith(root + path.sep)) throw new Error(`Storage key không hợp lệ: ${key}`)
  return full
}

let client: S3 | null = null
let bucketReady = false

const bucket = () => process.env.MINIO_BUCKET ?? 'swiftletcare-snapshots'

async function s3(): Promise<S3> {
  if (!client) {
    process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE ??= '1'
    const { default: S3Client } = await import('aws-sdk/clients/s3')
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
    client = new S3Client({
      endpoint: `${protocol}://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9000'}`,
      accessKeyId: process.env.MINIO_ACCESS_KEY,
      secretAccessKey: process.env.MINIO_SECRET_KEY,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    })
  }
  return client
}

async function ensureBucket(c: S3): Promise<void> {
  if (bucketReady) return
  try {
    await c.headBucket({ Bucket: bucket() }).promise()
  } catch {
    await c.createBucket({ Bucket: bucket() }).promise()
  }
  bucketReady = true
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (isLocalStorage()) {
    const file = localPath(key)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, body)
    return
  }
  const c = await s3()
  await ensureBucket(c)
  await c.putObject({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }).promise()
}

export async function removeObject(key: string): Promise<void> {
  if (isLocalStorage()) {
    await fs.rm(localPath(key), { force: true })
    return
  }
  const c = await s3()
  await c.deleteObject({ Bucket: bucket(), Key: key }).promise()
}

// Bucket private: trình duyệt dùng URL ký tạm
export async function presignedGetUrl(key: string, expiresSec = 3600): Promise<string> {
  if (isLocalStorage()) {
    const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    return `${base}/files/${key}`
  }
  const c = await s3()
  return c.getSignedUrlPromise('getObject', { Bucket: bucket(), Key: key, Expires: expiresSec })
}
