import fs from 'fs/promises'
import path from 'path'
import type S3 from 'aws-sdk/clients/s3'

/**
 * MinIO (S3-compatible, xem docker-compose.yml) qua `aws-sdk` v2 đã có sẵn trong
 * dependencies. Nạp lười ở lần dùng đầu tiên — boot/test không cần MinIO chạy,
 * và thông báo "maintenance mode" của SDK v2 không in ra mỗi lần khởi động.
 * ponytail: aws-sdk v2 đã hết hỗ trợ — chuyển sang @aws-sdk/client-s3 (v3) nếu cần vá bảo mật.
 */
/**
 * STORAGE_DRIVER=local — lưu file thẳng vào thư mục trên máy thay cho MinIO, để
 * chạy dev khi chưa dựng MinIO. File được phục vụ qua GET /files/<key> (xem
 * app.config.ts) KHÔNG cần đăng nhập và không hết hạn như URL ký của MinIO —
 * chỉ dùng trên máy dev, không dùng khi triển khai thật.
 */
export const isLocalStorage = () => process.env.STORAGE_DRIVER === 'local'
export const localStorageDir = () => path.resolve(process.env.LOCAL_STORAGE_DIR ?? 'storage')

/** Đường dẫn file của 1 key, từ chối key thoát ra ngoài thư mục lưu trữ (../) */
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
      s3ForcePathStyle: true, // MinIO không dùng virtual-hosted bucket
      signatureVersion: 'v4',
    })
  }
  return client
}

/** Tạo bucket nếu chưa có (minio-init trong docker-compose thường đã tạo sẵn) */
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

/** URL tạm để trình duyệt tải/nghe trực tiếp — bucket để private */
export async function presignedGetUrl(key: string, expiresSec = 3600): Promise<string> {
  if (isLocalStorage()) {
    const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    return `${base}/files/${key}`
  }
  const c = await s3()
  return c.getSignedUrlPromise('getObject', { Bucket: bucket(), Key: key, Expires: expiresSec })
}
