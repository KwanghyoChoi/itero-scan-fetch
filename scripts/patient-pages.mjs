export async function openPatientList(page, patientsUrl) {
  await page.goto(patientsUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
}

export async function searchPatients(page, patientsUrl, query) {
  await openPatientList(page, patientsUrl);
  const searchBox = page.locator('input[placeholder*="검색"], input[placeholder*="Search" i], input[type="search"]').first();
  await searchBox.waitFor({ state: "visible", timeout: 30000 });
  await searchBox.fill("");
  await searchBox.pressSequentially(query, { delay: 60 });
  await searchBox.press("Enter");
  await page.waitForTimeout(3000);
}

export async function patientRows(page) {
  const rows = page.locator("table tbody tr");
  const count = Math.min(await rows.count(), 50);
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push({
      index,
      text: (await rows.nth(index).innerText()).replace(/\s+/g, " ").trim(),
    });
  }
  return values;
}

export async function openPatientRow(page, index) {
  await page.locator("table tbody tr").nth(index).click();
  await page.waitForURL(/\/doctors\/patients\/[0-9a-f-]{36}/iu, { timeout: 20000 });
  await page.waitForTimeout(4000);
}

export async function orderTexts(page) {
  const rows = page.locator("table tbody tr");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const count = await rows.count();
    if (count > 0 && (await rows.nth(0).innerText()).trim()) {
      const values = [];
      for (let index = 0; index < count; index += 1) {
        values.push(await rows.nth(index).innerText());
      }
      return values;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("주문표가 나타나지 않았습니다");
}
