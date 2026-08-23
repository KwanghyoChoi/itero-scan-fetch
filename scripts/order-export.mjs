import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseOrderRow, selectOrderRows } from "./order-utils.mjs";
import { exportFileName, readZipMetadata } from "./zip-metadata.mjs";
import { orderTexts } from "./patient-pages.mjs";

async function chooseExportOption(page, label, option) {
  const labelBox = await page.getByText(label, { exact: false }).first().boundingBox();
  if (!labelBox) throw new Error(`내보내기 항목을 찾지 못했습니다: ${label}`);
  await page.mouse.click(labelBox.x + 400, labelBox.y + labelBox.height / 2);
  await page.waitForTimeout(700);
  await page.getByText(option).last().click({ timeout: 10000 });
  await page.waitForTimeout(500);
}

function freshDownload(destination, before) {
  const candidate = readdirSync(destination).find((name) => {
    return !before.has(name) && !name.endsWith(".crdownload");
  });
  return candidate ? join(destination, candidate) : null;
}

async function waitForDownload({ downloadPromise, destination, before }) {
  try {
    const guid = await downloadPromise;
    const path = join(destination, guid);
    for (let attempt = 0; attempt < 20 && !existsSync(path); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (existsSync(path)) return path;
  } catch (error) {
    const fallback = freshDownload(destination, before);
    if (fallback) return fallback;
    throw error;
  }
  const fallback = freshDownload(destination, before);
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
  });
  const metadata = readZipMetadata(downloadedPath);
  if (expectedChartNumber && metadata.chartNumber !== expectedChartNumber) {
    const rejectedPath = join(config.destination, `unverified-${metadata.orderId}-${Date.now()}.zip`);
    renameSync(downloadedPath, rejectedPath);
    throw new Error(`XML ChartNumber 불일치: ${metadata.chartNumber}`);
  }
  const targetPath = join(config.destination, exportFileName(metadata.orderId));
  renameSync(downloadedPath, targetPath);
  log(`저장 완료: ${exportFileName(metadata.orderId)} (${(statSync(targetPath).size / 1e6).toFixed(1)} MB)`);
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
