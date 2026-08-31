import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseOrderRow, selectOrderRows } from "./order-utils.mjs";
import { exportFileName, readZipMetadata, verifyZipIntegrity } from "./zip-metadata.mjs";
import { orderTexts } from "./patient-pages.mjs";

async function chooseExportOption(page, label, option) {
  const labelBox = await page.getByText(label, { exact: false }).first().boundingBox();
  if (!labelBox) throw new Error(`내보내기 항목을 찾지 못했습니다: ${label}`);
  await page.mouse.click(labelBox.x + 400, labelBox.y + labelBox.height / 2);
  await page.waitForTimeout(700);
  await page.getByText(option).last().click({ timeout: 10000 });
  await page.waitForTimeout(500);
}

/**
 * 다운로드 이벤트를 놓쳤을 때의 대비책.
 *
 * "새로 생긴 파일"이 **내가 받으려던 그 파일이라는 보장은 없다.** 동시에 끝난 다른 내보내기나
 * 앞선 시도의 늦은 착지가 그 자리에 있을 수 있다. 그대로 집으면 기록은 A 인데 내용은 B 가 된다.
 * 그래서 집기 전에 ZIP 안 XML 의 OrderID 가 지금 받는 주문과 같은지 확인한다.
 */
function freshDownload(destination, before, expectedOrderId, log) {
  const candidates = readdirSync(destination).filter(
    (name) => !before.has(name) && !name.endsWith(".crdownload"),
  );
  for (const name of candidates) {
    const path = join(destination, name);
    try {
      const metadata = readZipMetadata(path);
      if (!expectedOrderId || String(metadata.orderId) === String(expectedOrderId)) return path;
    } catch {
      // 읽히지 않는 파일은 후보가 아니다(아직 쓰는 중이거나 손상).
    }
  }
  if (candidates.length && log) {
    log(`새로 생긴 파일 ${candidates.length}개가 있었지만 주문번호가 달라 사용하지 않았습니다`);
  }
  return null;
}

async function waitForDownload({ downloadPromise, destination, before, expectedOrderId, log }) {
  try {
    const guid = await downloadPromise;
    const path = join(destination, guid);
    for (let attempt = 0; attempt < 20 && !existsSync(path); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (existsSync(path)) return path;
  } catch (error) {
    const fallback = freshDownload(destination, before, expectedOrderId, log);
    if (fallback) return fallback;
    throw error;
  }
  const fallback = freshDownload(destination, before, expectedOrderId, log);
  if (fallback) return fallback;
  throw new Error("다운로드 이벤트는 끝났지만 파일을 찾지 못했습니다");
}

async function exportOrder({ page, row, tracker, config, log, expectedChartNumber }) {
  await page.locator("table tbody tr").nth(row.index).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /내보내기/iu }).first().click();
  await page.waitForTimeout(2000);
  await chooseExportOption(page, "내보내기 유형", /쉘 열기/iu);
  await chooseExportOption(page, "데이터 형식", /개별 악궁 파일 \(교합상태의 악궁\)/u);
  await chooseExportOption(page, "파일 유형", /STL \(색상 없음\)/u);
  const before = new Set(readdirSync(config.destination));
  const downloadPromise = tracker.waitForDownload(config.downloadTimeoutMs);
  await page.getByRole("button", { name: "내보내기", exact: true }).last().click();
  const downloadedPath = await waitForDownload({
    downloadPromise,
    destination: config.destination,
    before,
    expectedOrderId: row.orderId,
    log,
  });
  // 내용을 확인할 수 없는 파일은 "받았다"로 세지 않는다. 격리해 두면 나중에 열어볼 수 있다.
  const integrity = verifyZipIntegrity(downloadedPath);
  if (!integrity.ok) {
    const brokenPath = join(config.destination, `invalid-${row.orderId}-${Date.now()}.zip`);
    renameSync(downloadedPath, brokenPath);
    throw new Error(`받은 파일이 온전하지 않습니다 — ${integrity.reason}`);
  }
  const metadata = readZipMetadata(downloadedPath);
  if (expectedChartNumber && metadata.chartNumber !== expectedChartNumber) {
    const rejectedPath = join(config.destination, `unverified-${metadata.orderId}-${Date.now()}.zip`);
    renameSync(downloadedPath, rejectedPath);
    throw new Error(`XML ChartNumber 불일치: ${metadata.chartNumber}`);
  }
  const targetPath = join(config.destination, exportFileName(metadata.orderId));
  renameSync(downloadedPath, targetPath);
  log(`저장 완료: ${exportFileName(metadata.orderId)} (${(statSync(targetPath).size / 1e6).toFixed(1)} MB · STL ${integrity.stlCount}개 · 무결성 확인)`);
  await page.goto(page.url().split("?")[0], { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return metadata;
}

export async function downloadPatientOrders({ page, tracker, config, log, expectedChartNumber, existingIds }) {
  const parsedRows = (await orderTexts(page)).map((text, index) => parseOrderRow(text, index));
  const selectedRows = selectOrderRows(parsedRows, config.endpoints);
  log(`주문 ${parsedRows.length}건 중 ${selectedRows.length}건을 검사합니다`);
  let downloaded = 0;
  const failures = [];
  for (const row of selectedRows) {
    if (downloaded >= config.maxDownloads) break;
    if (existingIds.has(row.orderId)) {
      log(`건너뜀: ${row.orderId} (이미 존재)`);
      continue;
    }
    try {
      log(`내보내기 시작: ${row.orderId}`);
      const metadata = await exportOrder({ page, row, tracker, config, log, expectedChartNumber });
      existingIds.add(metadata.orderId);
      downloaded += 1;
    } catch (error) {
      failures.push(`${row.orderId}: ${error instanceof Error ? error.message : String(error)}`);
      log(`실패: ${row.orderId}`);
      await page.keyboard.press("Escape");
      await page.goto(page.url().split("?")[0], { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
    }
  }
  if (failures.length) throw new AggregateError(failures.map((message) => new Error(message)), "주문 다운로드 실패");
  return downloaded;
}
