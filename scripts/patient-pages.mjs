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

/**
 * 돋보기를 **위치로** 찾는다 — 클래스·aria 로 맞히지 못하는 화면이 있다.
 * 실측(2026-09-01): 실제 실행 버튼의 클래스는 `btn btn-primary btn-sm btn-glyph-only` 로
 * `search` 라는 낱말이 어디에도 없고 aria-label·title·type=submit 도 없다.
 * 그때 `button:has([class*="search"])` 는 **다른 버튼을 눌러** 검색이 돌지 않았다.
 * 위치는 화면이 바뀌어도 잘 안 변한다 — 입력창 바로 오른쪽에 붙어 있다는 사실로 고른다.
 */
async function clickSearchButtonByPosition(page, searchBox) {
  const box = await searchBox.boundingBox().catch(() => null);
  if (!box) return false;
  return page.evaluate(({ x, y, width, height }) => {
    const centerY = y + height / 2;
    let best = null;
    for (const element of document.querySelectorAll('button,[role="button"],a')) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.top > centerY || rect.bottom < centerY) continue;   // 세로로 겹칠 것
      const gap = rect.left - (x + width);
      if (gap < -4 || gap > 60) continue;                          // 오른쪽 60px 안
      if (!best || gap < best.gap) best = { gap, element };
    }
    if (!best) return false;
    best.element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  }, box).catch(() => false);
}

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
  if (!triggered) triggered = await clickSearchButtonByPosition(page, searchBox);
  if (!triggered) await searchBox.press("Enter");

  await page.waitForTimeout(3000);

  const afterRows = await rowTexts(page);
  const pageText = await page.locator("body").innerText().catch(() => "");
  // 검색 직후 입력창 값도 같이 넘긴다 — 값이 바뀌어 있으면 그 결과는 내 질의의 것이 아니다.
  const boxValue = await searchBox.inputValue().catch(() => null);
  let status = classifySearch({ beforeRows, afterRows, pageText, query, boxValue });

  // 실행 자체가 안 된 경우에 한해 한 번 더 시도한다(버튼 렌더가 늦는 화면 대비).
  if (status === "not-executed") {
    // 값이 어긋났을 수 있으니 다시 넣고 실행한다.
    await searchBox.fill("");
    await searchBox.fill(query);
    if (await button.count()) {
      await button.click({ timeout: 5000 }).catch(() => {});
    } else if (!(await clickSearchButtonByPosition(page, searchBox))) {
      await searchBox.press("Enter");
    }
    await page.waitForTimeout(3000);
    const retryRows = await rowTexts(page);
    const retryText = await page.locator("body").innerText().catch(() => "");
    const retryValue = await searchBox.inputValue().catch(() => null);
    status = classifySearch({
      beforeRows, afterRows: retryRows, pageText: retryText, query, boxValue: retryValue,
    });
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
