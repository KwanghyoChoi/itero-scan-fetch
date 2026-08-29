import { classifySearch } from "./search-state.mjs";

export async function openPatientList(page, patientsUrl) {
  await page.goto(patientsUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
}

const SEARCH_BOX =
  'input[placeholder*="검색"], input[placeholder*="Search" i], input[type="search"]';

// 검색 실행 버튼(돋보기). 이 화면은 입력만으로는 필터링되지 않는다 — 실행 버튼을 눌러야 한다.
const SEARCH_BUTTON = [
  'button[aria-label*="검색"]',
  'button[aria-label*="search" i]',
  'button[title*="검색"]',
  'button[title*="search" i]',
  'button[type="submit"]',
  'button:has(svg[data-icon="search"])',
  'button:has([class*="search" i])',
].join(", ");

async function rowTexts(page, limit = 50) {
  const rows = page.locator("table tbody tr");
  const count = Math.min(await rows.count(), limit);
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await rows.nth(index).innerText()).replace(/\s+/g, " ").trim());
  }
  return values;
}

/**
 * 환자를 검색한다.
 *
 * 이 함수가 반환하는 상태를 반드시 확인할 것:
 *   "applied"      결과가 있다
 *   "empty"        검색은 됐고 결과가 없다
 *   "not-executed" 검색이 실행되지 않았다 — **0건이 아니다.** 이 값을 0건으로 다루면 안 된다.
 */
export async function searchPatients(page, patientsUrl, query) {
  await openPatientList(page, patientsUrl);

  const searchBox = page.locator(SEARCH_BOX).first();
  await searchBox.waitFor({ state: "visible", timeout: 30000 });

  const beforeRows = await rowTexts(page);

  // fill() 로 값을 한 번에 넣는다. 한 글자씩 입력(pressSequentially)하면 한글 IME 조합 중
  // 중복 입력이 생겨("채리" → "채채리") 실제로 없는 검색어가 만들어진다.
  await searchBox.fill("");
  await searchBox.fill(query);

  // 실행 버튼을 먼저 시도하고, 없으면 Enter 로 넘어간다.
  // Enter 만으로는 검색이 돌지 않는 화면이 있어 버튼이 1순위다.
  let triggered = false;
  const button = page.locator(SEARCH_BUTTON).first();
  if (await button.count()) {
    try {
      await button.click({ timeout: 5000 });
      triggered = true;
    } catch {
      triggered = false;
    }
  }
  if (!triggered) await searchBox.press("Enter");

  await page.waitForTimeout(3000);

  const afterRows = await rowTexts(page);
  const pageText = await page.locator("body").innerText().catch(() => "");
  let status = classifySearch({ beforeRows, afterRows, pageText });

  // 실행 자체가 안 된 경우에 한해 한 번 더 시도한다(버튼 렌더가 늦는 화면 대비).
  if (status === "not-executed") {
    if (await button.count()) {
      await button.click({ timeout: 5000 }).catch(() => {});
    } else {
      await searchBox.press("Enter");
    }
    await page.waitForTimeout(3000);
    const retryRows = await rowTexts(page);
    const retryText = await page.locator("body").innerText().catch(() => "");
    status = classifySearch({ beforeRows, afterRows: retryRows, pageText: retryText });
  }

  return status;
}

export async function patientRows(page) {
  return (await rowTexts(page)).map((text, index) => ({ index, text }));
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
