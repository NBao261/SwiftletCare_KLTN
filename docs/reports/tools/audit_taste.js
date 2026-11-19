// Đo các tiêu chí của taste-skill (system.md, cards.md, layout-v4.md) trên từng trang trong menu của 1 role.
// Đổi ROLE ở dòng dưới rồi chạy bằng browser_run_code_unsafe.
async (page) => {
  const ROLE = globalThis.__AUDIT_ROLE || 'owner';
  const EMAIL = { owner: 'owner@swiftletcare.dev', expert: 'expert@swiftletcare.dev', technician: 'tech@swiftletcare.dev', admin: 'admin@swiftletcare.dev' }[ROLE];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().clearCookies();
  await page.goto('http://localhost:5173/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill('Test1234!');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForTimeout(2000);
  const links = await page.$$eval('aside a[href]', as => [...new Set(as.map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')))]);
  const rows = [];
  for (const href of links) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173' + href);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    const desktop = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const all = [...main.querySelectorAll('*')].filter(vis);
      // Hộp: có nền hoặc viền và bo góc
      const isBox = el => { const s = getComputedStyle(el); const bg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent'; const bd = parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none'; return (bg || bd) && parseFloat(s.borderTopLeftRadius) >= 8 && el.getBoundingClientRect().width > 120 && el.getBoundingClientRect().height > 40; };
      let maxDepth = 0, deepSample = '';
      for (const el of all) {
        if (!isBox(el) || !el.innerText || el.children.length > 2) continue;
        let d = 0, p = el;
        while (p && p !== main) { if (isBox(p)) d++; p = p.parentElement; }
        if (d > maxDepth) { maxDepth = d; deepSample = (el.innerText || '').trim().slice(0, 40); }
      }
      // Chữ nhỏ: phần tử lá có chữ
      const leaves = all.filter(el => el.children.length === 0 && (el.textContent || '').trim().length > 1);
      const fs = el => parseFloat(getComputedStyle(el).fontSize);
      const tiny = leaves.filter(el => fs(el) < 13);
      const greyPara = leaves.filter(el => fs(el) <= 14 && (el.textContent || '').trim().length > 60);
      const sizes = new Set(leaves.map(el => Math.round(fs(el))));
      const radii = new Set(all.filter(isBox).map(el => getComputedStyle(el).borderTopLeftRadius));
      // Nút tô đậm (nền tối) và vùng bấm nhỏ
      const buttons = all.filter(el => el.matches('button, a[href], [role="button"]'));
      const dark = buttons.filter(el => { const c = getComputedStyle(el).backgroundColor.match(/\d+/g); return c && +c[0] < 70 && +c[1] < 70 && +c[2] < 70 && (c[3] === undefined || +c[3] > 0); });
      const small = buttons.filter(el => el.getBoundingClientRect().height < 36);
      const h1 = document.querySelectorAll('h1').length;
      const headingSizes = new Set([...main.querySelectorAll('h2,h3')].filter(vis).map(el => Math.round(fs(el))));
      // Hàng thẻ không đều: các con trực tiếp của grid có chiều cao lệch
      let unevenRows = 0;
      for (const g of all.filter(el => getComputedStyle(el).display === 'grid' && el.children.length >= 2)) {
        const kids = [...g.children].filter(vis);
        const tops = new Map();
        for (const k of kids) { const r = k.getBoundingClientRect(); const key = Math.round(r.top); tops.set(key, [...(tops.get(key) || []), Math.round(r.height)]); }
        for (const hs of tops.values()) if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 24) unevenRows++;
      }
      const upper = all.filter(el => getComputedStyle(el).textTransform === 'uppercase' && !el.closest('aside')).length;
      const img = [...main.querySelectorAll('img')].filter(vis).filter(i => i.getBoundingClientRect().width > 400).length + (document.querySelector('main [aria-hidden="true"] img') ? 1 : 0);
      const words = (main.innerText || '').split(/\s+/).length;
      return { boxDepth: maxDepth, deepSample, tiny: tiny.length, tinySample: tiny.slice(0, 2).map(e => e.textContent.trim().slice(0, 30)), greyPara: greyPara.length, fontSizes: sizes.size, radii: radii.size, darkButtons: dark.length, smallTargets: small.length, h1, headingSizes: [...headingSizes].join('/'), unevenRows, upper, bigImages: img, words };
    });
    // Điện thoại 390: tràn ngang
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    const mobile = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const over = [...document.querySelectorAll('main *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 2 && !el.closest('[class*="overflow-x"]'); });
      const scrollX = [...document.querySelectorAll('main *')].filter(el => el.scrollWidth > el.clientWidth + 4 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)).length;
      return { spill: over.length, hScroll: scrollX };
    });
    rows.push({ page: href, ...desktop, ...mobile });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return JSON.stringify(rows);
}
