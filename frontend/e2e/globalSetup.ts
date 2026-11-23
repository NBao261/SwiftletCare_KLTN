import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Test E2E ghi dữ liệu thật (hồ sơ, luật, kết luận): chỉ chạy với database trên máy hoặc của CI, không với Atlas dùng chung.
// CI không có backend/.env (biến môi trường của job) nên bỏ qua; muốn chạy với database khác thì đặt E2E_ALLOW_REMOTE_DB=1
const LOCAL_HOSTS = /^mongodb:\/\/(?:[^@/]*@)?(localhost|127\.0\.0\.1|mongodb|\[::1\])(?::\d+)?\//;

export default function globalSetup(): void {
  if (process.env.E2E_ALLOW_REMOTE_DB === '1') return;
  const envFile = fileURLToPath(new URL('../../backend/.env', import.meta.url));
  if (!existsSync(envFile)) return;
  const uri = /^MONGODB_URI=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim() ?? '';
  if (uri && !LOCAL_HOSTS.test(uri)) {
    throw new Error(
      'backend/.env trỏ MONGODB_URI tới một database không ở máy này (ví dụ Atlas dùng chung). '
      + 'Test E2E sẽ để lại dữ liệu "E2E …" ở đó. Đổi sang MongoDB local, hoặc đặt E2E_ALLOW_REMOTE_DB=1 nếu thật sự muốn.',
    );
  }
}
