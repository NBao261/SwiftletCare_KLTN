import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

interface HealthDay {
  _id: string;
  date: string;
  my_rating_state: string | null;
  current_status?: string;
  current_reasons?: Array<{ code: string; source: string | null; values: Record<string, unknown> }>;
}

// WF-06 — DS-11, DS-12 (Design Brief Phụ lục A2): nhà C, ngày đầu chim về giảm rõ và độ ẩm lệch nhẹ, ngày sau đó phiên chiều
// không đầy đủ; seed đã chạy đánh giá ngày như job tối (`npm run seed:demo`). Job tối trên staging chỉ thêm ngày mới hơn,
// nên lấy ngày sớm nhất và ngày kế nó, không lấy ngày cuối danh sách
const sortedDays = (days: HealthDay[]) => [...days].sort((left, right) => left.date.localeCompare(right.date));
const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

test.describe('DS-11, DS-12 Đánh giá sức khỏe ngày', () => {
  test('DS-11 thợ chấm trước khi thấy trạng thái; trạng thái ACTION kèm hai lý do', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const technician = await signIn(request, 'technician');
    const farm = await demoFarm(owner);
    const houseId = farm.house('C')._id;
    const [actionDay] = sortedDays(await technician.data<HealthDay[]>(await technician.get(`/health-reports/days?houseId=${houseId}`)));

    if (actionDay.my_rating_state === 'PENDING') {
      // BR-31: chưa chấm thì không thấy trạng thái
      expect(actionDay.current_status).toBeUndefined();
      const rating = await technician.post(`/health-reports/days/${actionDay._id}/rating`, { rating: 'ACTION', note: 'Chim về ít, trưa nóng khô' });
      expect(rating.ok()).toBe(true);
    }
    const rated = await technician.data<HealthDay>(await technician.get(`/health-reports/days/${actionDay._id}`));
    expect(rated.current_status).toBe('ACTION');
    expect(rated.current_reasons?.map(reason => reason.code)).toEqual(expect.arrayContaining(['FLOCK_DROP', 'ENV_IN_RANGE']));
  });

  test('DS-12 ngày có phiên chiều không đầy đủ là INSUFFICIENT_DATA, lý do nêu phiên thiếu', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const expert = await signIn(request, 'expert');
    const farm = await demoFarm(owner);
    const days = sortedDays(await expert.data<HealthDay[]>(await expert.get(`/health-reports/days?houseId=${farm.house('C')._id}`)));
    const incompleteDay = days.find(day => day.date === nextDate(days[0].date));
    expect(incompleteDay?.current_status).toBe('INSUFFICIENT_DATA');
    const flockReason = incompleteDay?.current_reasons?.find(reason => reason.code === 'MISSING_DATA' && reason.source === 'flock');
    expect(flockReason?.values.missing).toBe('INCOMPLETE');
  });
});
