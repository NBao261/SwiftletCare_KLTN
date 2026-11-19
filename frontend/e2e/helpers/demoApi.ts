import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

// Kịch bản demo DS-01…16 (Design Brief Phụ lục A2) trên dữ liệu của `npm run seed:demo` ở backend; gọi API qua proxy /api của web
export const DEMO_FARM = 'Trại yến Demo A2';
// Mật khẩu của `npm run seed:demo`: DEMO_PASSWORD khi chạy trên staging, mặc định của seed khi chạy trên máy và CI
export const PASSWORD = process.env.DEMO_PASSWORD ?? 'Test1234!';

export const ACCOUNTS = {
  owner: 'owner@swiftletcare.dev',
  technician: 'tech@swiftletcare.dev',
  otherHouseTechnician: 'tech2@swiftletcare.dev',
  expert: 'expert@swiftletcare.dev',
  // Farm Owner của farm demo chưa có chuyên gia (BR-22)
  ownerWithoutExpert: 'owner2@swiftletcare.dev',
} as const;

export type Account = keyof typeof ACCOUNTS;

export interface DemoApi {
  get: (path: string) => Promise<APIResponse>;
  post: (path: string, data?: object) => Promise<APIResponse>;
  put: (path: string, data?: object) => Promise<APIResponse>;
  data: <T>(response: APIResponse) => Promise<T>;
}

// Một người dùng đã đăng nhập: mọi lời gọi mang access token của người đó
export async function signIn(request: APIRequestContext, account: Account): Promise<DemoApi> {
  const login = await request.post('/api/auth/login', { data: { email: ACCOUNTS[account], password: PASSWORD } });
  expect(login.status(), `đăng nhập ${ACCOUNTS[account]}`).toBe(200);
  const token = (await login.json()).data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: path => request.get(`/api${path}`, { headers }),
    post: (path, data) => request.post(`/api${path}`, { headers, data }),
    put: (path, data) => request.put(`/api${path}`, { headers, data }),
    data: async response => {
      expect(response.ok(), await response.text()).toBe(true);
      return (await response.json()).data;
    },
  };
}

interface Named { _id: string; name: string }

export interface DemoFarm {
  farmId: string;
  house: (prefix: 'A' | 'B' | 'C' | 'D') => Named;
  zoneOf: (prefix: 'A' | 'B' | 'C' | 'D') => Promise<Named>;
}

// Farm demo theo tên, nhà theo chữ đầu tên ("A · Nhà điều khiển"); đọc bằng tài khoản Farm Owner
export async function demoFarm(owner: DemoApi): Promise<DemoFarm> {
  const farms = await owner.data<Named[]>(await owner.get('/farms'));
  const farm = farms.find(item => item.name === DEMO_FARM);
  expect(farm, 'farm demo — chạy `npm run seed:demo` ở backend').toBeTruthy();
  const farmId = farm!._id;
  const houses = await owner.data<Named[]>(await owner.get(`/farms/${farmId}/houses`));
  const house = (prefix: string) => {
    const found = houses.find(item => item.name.startsWith(`${prefix} ·`));
    expect(found, `nhà ${prefix}`).toBeTruthy();
    return found!;
  };
  return {
    farmId,
    house,
    zoneOf: async prefix => (await owner.data<Named[]>(await owner.get(`/farms/houses/${house(prefix)._id}/zones`)))[0],
  };
}
