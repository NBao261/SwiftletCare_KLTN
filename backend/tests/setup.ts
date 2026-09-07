/**
 * Jest global setup – tăng timeout cho MongoMemoryServer
 * mongodb-memory-server cần download binary lần đầu (~30s)
 */
import { jest } from '@jest/globals'

jest.setTimeout(30_000)
