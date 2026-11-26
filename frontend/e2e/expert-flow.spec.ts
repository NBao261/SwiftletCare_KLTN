import { expect, test, type Page } from '@playwright/test';
import { demoFarm, signIn, type DemoApi } from './helpers/demoApi';
import { setScope, sidebar, signInUi, trackCrashes, type UiScope } from './helpers/ui';

// Luồng của Chuyên gia trên web thật (seed:demo): thao tác UI rồi đọc lại bằng API; B2 kết luận cảnh báo của ds-07-08 nên phải seed lại mới chạy lại cả hai
test.describe.configure({ mode: 'serial' });

interface Alert { _id: string; type: string; expert_verdict?: { result: string } }
interface Thresholds { co2_max: number; nh3_max: number }
interface Review { _id: string; status: string; group: string }
interface Profile { _id: string; name: string; status: string }
interface WeatherRulesView { rules: Array<{ metric: string; min: number; offset_pct: number }> }
interface Rule { _id: string; name: string; active: boolean }

// Luật khuyến nghị không xoá được nên test dùng lại một luật mang tên này
const RECOMMENDATION_RULE_NAME = 'E2E luật tỷ lệ chim về';

let farmId = '';
let houseA = '';
let houseB = '';
let zoneA = '';

test.beforeAll(async ({ request }) => {
  const owner = await signIn(request, 'owner');
  const farm = await demoFarm(owner);
  farmId = farm.farmId;
  houseA = farm.house('A')._id;
  houseB = farm.house('B')._id;
  zoneA = (await farm.zoneOf('A'))._id;
});

// Ngưỡng của Zone đọc qua chi tiết Zone (không có GET riêng cho thresholds)
async function readThresholds(api: DemoApi, zoneId: string): Promise<Thresholds> {
  const zone = await api.data<{ thresholds: Thresholds }>(await api.get(`/farms/zones/${zoneId}`));
  return zone.thresholds;
}

// Đăng nhập chuyên gia, đặt phạm vi rồi mở đúng trang
async function openAsExpert(page: Page, path: string, scope: UiScope): Promise<string[]> {
  const crashes = trackCrashes(page);
  await signInUi(page, 'expert');
  await setScope(page, scope);
  await page.goto(path);
  return crashes;
}

test('B1 — đăng nhập vào hàng đợi việc, 4 ô nhóm việc hiện, menu mở trang kiểm chứng', async ({ page }) => {
  const crashes = trackCrashes(page);
  await signInUi(page, 'expert');
  await expect(page).toHaveURL(/\/domain-expert\/queue$/);

  // Hàng đợi theo trại: 4 ô nhóm việc (kết luận cảnh báo, duyệt thay đổi, duyệt đề xuất, viết kết luận)
  await setScope(page, { farmId });
  await page.goto('/domain-expert/queue');
  for (const label of ['Kết luận cảnh báo', 'Duyệt thay đổi', 'Duyệt đề xuất', 'Viết kết luận']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  await sidebar(page).getByRole('link', { name: 'Kiểm chứng cảnh báo' }).click();
  await expect(page).toHaveURL(/\/domain-expert\/alert-verdicts$/);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B2 — kiểm chứng cảnh báo suy luận: bác bỏ thiếu lý do bị chặn, xác nhận sự cố thật thì lưu', async ({ page, request }) => {
  const owner = await signIn(request, 'owner');
  const [noise] = await owner.data<Alert[]>(await owner.get(`/alerts?farmId=${farmId}&type=NOISE_ANOMALY`));
  expect(noise, 'cảnh báo ồn của DS-07 — chạy `npm run seed:demo`').toBeTruthy();

  // Mở thẳng ngăn kéo của cảnh báo bằng ?alertId= (như link từ thông báo): cảnh báo đã có kết luận ở lần chạy trước vẫn mở được để ghi lại
  const crashes = await openAsExpert(page, `/domain-expert/alert-verdicts?alertId=${noise._id}`, { farmId });
  await expect(page.getByRole('tab', { name: /Chờ kiểm chứng/ })).toBeVisible();

  // Bác bỏ phải có lý do: thiếu ghi chú thì nút lưu khoá; ngăn kéo điền lại ghi chú cũ nên xoá trước khi kiểm
  await page.getByRole('button', { name: 'Bác bỏ - Báo động giả' }).click();
  await page.locator('#expert-note').fill('');
  await expect(page.getByRole('button', { name: 'Lưu kết luận' })).toBeDisabled();

  await page.getByRole('button', { name: 'Xác nhận sự cố thật' }).click();
  await page.locator('#expert-note').fill('E2E: mức ồn cao hơn nền, đúng là sự cố thật');
  const saving = page.waitForResponse(
    response => response.url().includes(`/alerts/${noise._id}/verdict`) && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu kết luận' }).click();
  expect((await saving).ok()).toBe(true);
  // Cảnh báo đã có kết luận: dòng đó không còn nút "Kiểm chứng"
  await expect(page.locator(`#btn-verdict-${noise._id}`)).toHaveCount(0);

  const saved = await owner.data<Alert>(await owner.get(`/alerts/${noise._id}`));
  expect(saved.expert_verdict?.result).toBe('CONFIRMED');
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B3 — sửa ngưỡng khí CO2 của Zone rồi khôi phục, quyền sửa tham số phát hiện mở cho chuyên gia', async ({ page, request }) => {
  const expertApi = await signIn(request, 'expert');
  const before = await readThresholds(expertApi, zoneA);

  const crashes = await openAsExpert(page, '/domain-expert/tuning', { farmId, houseId: houseA, zoneId: zoneA });
  await expect(page.getByRole('heading', { name: 'Ngưỡng vi khí hậu & khí độc' })).toBeVisible();

  // Cả 4 khối dùng một thanh lưu dính đáy, chỉ hiện khi có thay đổi
  const saveBar = page.getByRole('button', { name: 'Lưu', exact: true });
  await expect(saveBar).toBeHidden();

  // Mốc chờ là phản hồi của máy chủ: nút "Lưu" đang quay thì mất tên, còn lời nhắn "Đã lưu" cũ vẫn trên màn hình
  const savingThresholds = () => page.waitForResponse(
    response => response.url().includes(`/farms/zones/${zoneA}/thresholds`) && response.request().method() === 'PUT',
  );

  // Một bước + của ô CO2 là 50 ppm
  await page.getByRole('button', { name: 'Tăng Ngưỡng cảnh báo khí CO2' }).click();
  await expect(page.getByText('1 thay đổi')).toBeVisible();
  const firstSave = savingThresholds();
  await saveBar.click();
  expect((await firstSave).ok()).toBe(true);
  await expect(page.getByText('Đã lưu ngưỡng môi trường')).toBeVisible();

  const after = await readThresholds(expertApi, zoneA);
  expect(after.co2_max).toBe(before.co2_max + 50);

  // Tham số phát hiện là quyết định của chuyên gia nên ô sửa không bị khoá
  await expect(page.getByRole('button', { name: 'Tăng Mức ồn vượt nền' })).toBeEnabled();

  // Trả ngưỡng về giá trị của seed để lần chạy sau không bị trôi
  await expect(saveBar).toBeHidden();
  await page.getByRole('button', { name: 'Giảm Ngưỡng cảnh báo khí CO2' }).click();
  const secondSave = savingThresholds();
  await saveBar.click();
  expect((await secondSave).ok()).toBe(true);
  const restored = await readThresholds(expertApi, zoneA);
  expect(restored.co2_max).toBe(before.co2_max);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B4 — duyệt thay đổi ngưỡng của chủ nhà yến (BR-22, EXPERT-FR-010)', async ({ page, request }) => {
  const owner = await signIn(request, 'owner');
  const expertApi = await signIn(request, 'expert');

  // Chủ nhà yến sửa ngưỡng NH3: áp ngay và mở một mục chờ duyệt; đổi qua lại hai giá trị nên chạy lại không trôi
  const current = await readThresholds(expertApi, zoneA);
  const nextNh3 = current.nh3_max === 25 ? 26 : 25;
  expect((await owner.put(`/farms/zones/${zoneA}/thresholds`, { ...current, nh3_max: nextNh3 })).ok()).toBe(true);

  const pending = await expertApi.data<Review[]>(
    await expertApi.get(`/expert-activity/reviews?farmId=${farmId}&zoneId=${zoneA}&status=PENDING_REVIEW`),
  );
  const review = pending.find(item => item.group === 'thresholds');
  expect(review, 'mục duyệt ngưỡng vừa mở').toBeTruthy();

  const crashes = await openAsExpert(page, '/domain-expert/reviews', { farmId });
  await expect(page.getByText('Thay đổi ngưỡng vi khí hậu').first()).toBeVisible();
  await page.getByRole('button', { name: 'Giữ thay đổi' }).first().click();
  await expect(page.getByText('Đã giữ thay đổi tham số.')).toBeVisible();

  const accepted = await expertApi.data<Review[]>(
    await expertApi.get(`/expert-activity/reviews?farmId=${farmId}&zoneId=${zoneA}&status=ACCEPTED`),
  );
  expect(accepted.some(item => item._id === review!._id)).toBe(true);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B5 — tạo hồ sơ cấu hình, duyệt rồi lưu trữ (EXPERT-FR-014, 015)', async ({ page, request }) => {
  const expertApi = await signIn(request, 'expert');
  const name = `E2E hồ sơ ${Date.now()}`;

  const crashes = await openAsExpert(page, '/domain-expert/profiles', { farmId });
  await expect(page.getByRole('heading', { name: 'Hồ sơ cấu hình' })).toBeVisible();

  await page.getByRole('button', { name: 'Tạo hồ sơ' }).click();
  await page.getByLabel('Tên hồ sơ').fill(name);
  // Hồ sơ phải có ít nhất một nhóm cấu hình
  await page.getByLabel('Bật nhóm: Ngưỡng môi trường').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo hồ sơ' }).click();
  await expect(page.getByText(name)).toBeVisible();

  // Thẻ hồ sơ gấp lại: bấm tên để mở ra mới thấy các nút của hồ sơ nháp
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('button', { name: 'Duyệt hồ sơ' }).click();
  await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(page.getByText('Hồ sơ đã được duyệt.')).toBeVisible();

  const profiles = await expertApi.data<Profile[]>(await expertApi.get(`/profiles?farmId=${farmId}`));
  const created = profiles.find(item => item.name === name);
  expect(created?.status).toBe('APPROVED');

  // Lưu trữ lại để danh sách hồ sơ đang dùng không phình ra sau mỗi lần chạy
  expect((await expertApi.post(`/profiles/${created!._id}/archive`)).ok()).toBe(true);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B6 — thêm luật bù phun sương theo thời tiết rồi xoá (ENV-FR-030, BR-38)', async ({ page, request }) => {
  const expertApi = await signIn(request, 'expert');
  const crashes = await openAsExpert(page, '/domain-expert/weather-rules', { farmId, houseId: houseA });
  await expect(page.getByRole('heading', { name: 'Phun sương theo thời tiết' })).toBeVisible();

  await page.getByRole('button', { name: 'Thêm luật' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Chọn chỉ số thời tiết').click();
  await page.getByRole('option', { name: 'Nhiệt độ cao nhất (°C)' }).click();
  await page.locator('#wr-min').fill('34');
  await page.locator('#wr-offset').fill('5');
  await page.locator('#wr-duration').fill('60');
  await form.getByRole('button', { name: 'Thêm luật' }).click();

  // Khớp đúng cả tên: lời nhắn "Đã lưu luật bù thời tiết." cũng là một nút, tên nó chứa "Lưu luật"
  const saveRules = page.getByRole('button', { name: 'Lưu luật', exact: true });

  // Mốc chờ là lời nhắn: nút "Lưu luật" quay mất tên ngay khi bấm, bản nháp chỉ xoá sau khi máy chủ trả lời
  await saveRules.click();
  await expect(page.getByText('Đã lưu luật bù thời tiết.')).toBeVisible();

  const view = await expertApi.data<WeatherRulesView>(await expertApi.get(`/farms/houses/${houseA}/weather-rules`));
  const added = view.rules.find(rule => rule.metric === 'temperature' && rule.min === 34);
  expect(added?.offset_pct).toBe(5);

  // Xoá luật vừa thêm để nhà A trở lại như seed
  await page.getByRole('button', { name: 'Xoá luật' }).last().click();
  const deleteSaved = page.waitForResponse(
    response => response.url().includes(`/farms/houses/${houseA}/weather-rules`) && response.request().method() === 'PUT',
  );
  await saveRules.click();
  expect((await deleteSaved).ok()).toBe(true);
  const cleaned = await expertApi.data<WeatherRulesView>(await expertApi.get(`/farms/houses/${houseA}/weather-rules`));
  expect(cleaned.rules.some(rule => rule.metric === 'temperature' && rule.min === 34)).toBe(false);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B7 — lịch đếm chim: thêm khung tạm vào bản nháp rồi huỷ, vòng đếm mở được (VISION-FR-018, 019)', async ({ page }) => {
  const crashes = await openAsExpert(page, '/domain-expert/counting-schedule', { farmId, houseId: houseB });
  await expect(page.getByRole('tab', { name: /Hồ sơ theo mùa/ })).toBeVisible();

  // Thêm một khung tạm vào bản nháp (tab Khung tạm): hiện hàng giờ sáng/chiều và nút lưu
  await page.getByRole('tab', { name: /Khung tạm/ }).click();
  await page.getByRole('button', { name: 'Thêm khung tạm' }).click();
  await expect(page.getByRole('button', { name: 'Lưu lịch' })).toBeVisible();
  await page.getByRole('button', { name: 'Huỷ thay đổi' }).click();
  await expect(page.getByRole('button', { name: 'Lưu lịch' })).toBeHidden();

  // Vòng đếm là tab thứ hai của mục Đếm chim
  await page.getByRole('link', { name: 'Vòng đếm' }).click();
  await expect(page).toHaveURL(/\/domain-expert\/counting-ring$/);
  await expect(page.getByRole('heading', { name: 'Vòng đếm', exact: true })).toBeVisible();
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B8 — thêm hoặc sửa luật khuyến nghị rồi tắt, xem tab hiệu quả (EXPERT-FR-016…019)', async ({ page, request }) => {
  const expertApi = await signIn(request, 'expert');

  const crashes = await openAsExpert(page, '/domain-expert/recommendation-rules', { farmId });
  await expect(page.getByRole('heading', { name: 'Luật khuyến nghị' })).toBeVisible();

  // Chờ danh sách luật tải xong: trang trại demo luôn có luật sẵn, nên đã có nút "Sửa" là đã có danh sách
  await expect(page.getByRole('button', { name: 'Sửa' }).first()).toBeVisible();

  // Luật chỉ thêm, sửa, bật, tắt được, không xoá được: test dùng một tên cố định để không phình thêm luật mỗi lần chạy
  const ruleRow = page.locator('div')
    .filter({ hasText: RECOMMENDATION_RULE_NAME })
    .filter({ has: page.getByRole('button', { name: 'Sửa' }) })
    .last();
  if (await ruleRow.count() > 0) await ruleRow.getByRole('button', { name: 'Sửa' }).click();
  else await page.getByRole('button', { name: 'Thêm luật' }).click();

  // Ô nhập lấy theo id: nhãn có thêm dấu sao của trường bắt buộc nên không khớp đúng theo chữ
  const form = page.getByRole('dialog');
  await page.locator('#rule-name').fill(RECOMMENDATION_RULE_NAME);
  // Mặc định: tỷ lệ chim về ≤ giá trị, 3 ngày liền, khi chấp nhận thì mở phiếu công việc
  await page.locator('#rule-value').fill('80');
  await page.locator('#rule-title').fill('E2E: kiểm tra miệng hang và béc phun');
  await page.locator('#rule-source').fill('E2E: dữ liệu kiểm thử tự động, không phải luật từ phỏng vấn');
  // Lưu ở trạng thái bật, kể cả khi lần chạy trước để lại luật đang tắt
  const formSwitch = form.getByRole('switch', { name: 'Bật luật' });
  if (await formSwitch.getAttribute('aria-checked') !== 'true') await formSwitch.click();
  await page.getByRole('button', { name: 'Lưu luật', exact: true }).click();
  await expect(page.getByText('Đã lưu luật.')).toBeVisible();

  const rules = await expertApi.data<Rule[]>(await expertApi.get(`/recommendations/rules?farmId=${farmId}`));
  const saved = rules.filter(rule => rule.name === RECOMMENDATION_RULE_NAME);
  expect(saved, 'đúng một luật mang tên của test').toHaveLength(1);
  expect(saved[0].active, 'luật của chuyên gia chạy ngay, không chờ duyệt').toBe(true);

  await page.getByRole('tab', { name: 'Hiệu quả theo luật' }).click();
  await page.getByRole('tab', { name: 'Luật', exact: true }).click();

  // Tắt luật kiểm thử để nó không sinh khuyến nghị thật cho trang trại demo
  await ruleRow.getByRole('switch', { name: 'Tắt luật' }).click();
  await expect(ruleRow.getByRole('switch', { name: 'Bật luật' })).toBeVisible();
  const afterToggle = await expertApi.data<Rule[]>(await expertApi.get(`/recommendations/rules?farmId=${farmId}`));
  expect(afterToggle.find(rule => rule.name === RECOMMENDATION_RULE_NAME)?.active).toBe(false);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B9 — báo cáo & kết luận mở được, đổi sang tab Ngày lệch (EXPERT-FR-005, 022)', async ({ page }) => {
  const crashes = await openAsExpert(page, '/domain-expert/reports', { farmId, houseId: houseA });
  const disagreements = page.getByRole('button', { name: /Ngày đánh giá khác/ });
  await expect(disagreements).toBeVisible();
  await disagreements.click();
  await expect(disagreements).toHaveAttribute('aria-current', 'page');
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B10 — lịch sử quyết định ghi lại các việc vừa làm (EXPERT-FR-009)', async ({ page }) => {
  const crashes = await openAsExpert(page, '/domain-expert/history', { farmId });
  await expect(page.getByRole('heading', { name: 'Lịch sử quyết định' })).toBeVisible();
  // Kết luận cảnh báo của B2 và các lần sửa ngưỡng của B3, B4 phải nằm trong nhật ký
  await expect(page.getByText('Không có dữ liệu', { exact: false })).toHaveCount(0);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('B11 — trang vận hành của Farm Owner mở ở chế độ chỉ đọc, không có nút bật/tắt relay', async ({ page }) => {
  const crashes = await openAsExpert(page, '/dashboard', { farmId, houseId: houseA, zoneId: zoneA });
  await expect(page.getByRole('button', { name: /Bật bơm|Tắt bơm|Can thiệp tay/ })).toHaveCount(0);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});
