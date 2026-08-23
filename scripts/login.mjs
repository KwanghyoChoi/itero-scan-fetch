export async function login(page, { baseUrl, email, password, log }) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  if (/\/doctors\//u.test(page.url())) {
    log("기존 로그인 세션을 사용합니다");
    return;
  }
  const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 30000 });
  await emailInput.fill(email);
  await page.getByRole("button", { name: /다음|Next|Continue/iu }).first().click();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await page.waitForTimeout(1000);
    if (/\/doctors\//u.test(page.url())) {
      log("로그인 완료");
      return;
    }
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(password);
      await page.getByRole("button", { name: /로그인|Log ?in|Sign ?in/iu }).first().click();
      await page.waitForURL((url) => /\/doctors\//u.test(url.href), { timeout: 120000 });
      log("로그인 완료");
      return;
    }
  }
  throw new Error(`로그인 흐름이 끝나지 않았습니다: ${page.url()}`);
}
