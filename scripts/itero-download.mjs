#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { connectBrowser } from "./browser-session.mjs";
import { parseArgs, HELP_TEXT } from "./config.mjs";
import { readCredentials } from "./credentials.mjs";
import { login } from "./login.mjs";
import { downloadPatientOrders } from "./order-export.mjs";
import { rowMatches, searchForms } from "./patient-search.mjs";
import { openPatientList, openPatientRow, patientRows, searchPatients } from "./patient-pages.mjs";

function existingOrderIds(destination) {
  return new Set(
    readdirSync(destination, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(/^OrthoCAD_Export_(\d+)\.zip$/u)?.[1])
      .filter(Boolean),
  );
}

async function downloadTargets({ session, config, log, existingIds }) {
  let downloaded = 0;
  for (const target of config.targets) {
    if (downloaded >= config.maxDownloads) break;
    let matched = false;
    for (const query of searchForms(target)) {
      await searchPatients(session.page, config.patientsUrl, query);
      const candidates = await patientRows(session.page);
      const hits = candidates.filter(({ text }) => rowMatches(text, target));
      log(`대상 ${target}: 검색어 ${query}, 후보 ${candidates.length}행, 일치 ${hits.length}행`);
      if (!hits.length) continue;
      matched = true;
      for (let hitIndex = 0; hitIndex < hits.length; hitIndex += 1) {
        if (downloaded >= config.maxDownloads) break;
        await openPatientRow(session.page, hits[hitIndex].index);
        downloaded += await downloadPatientOrders({
          page: session.page,
          tracker: session.tracker,
          config: { ...config, maxDownloads: config.maxDownloads - downloaded },
          log,
          expectedChartNumber: /^\d{7}$/u.test(target) ? target : null,
          existingIds,
        });
        if (hitIndex + 1 < hits.length) await searchPatients(session.page, config.patientsUrl, query);
      }
      break;
    }
    if (!matched) log(`대상을 찾지 못했습니다: ${target}`);
  }
  return downloaded;
}

async function downloadPatientCount({ session, config, log, existingIds }) {
  let downloaded = 0;
  for (let index = 0; index < config.patientCount && downloaded < config.maxDownloads; index += 1) {
    await openPatientList(session.page, config.patientsUrl);
    const rows = await patientRows(session.page);
    if (!rows[index]) throw new Error(`환자 목록에 ${index + 1}번째 행이 없습니다`);
    await openPatientRow(session.page, rows[index].index);
    downloaded += await downloadPatientOrders({
      page: session.page,
      tracker: session.tracker,
      config: { ...config, maxDownloads: config.maxDownloads - downloaded },
      log,
      expectedChartNumber: null,
      existingIds,
    });
  }
  return downloaded;
}

export async function run(config, dependencies = {}) {
  const log = dependencies.log || ((message) => console.log(`[itero] ${message}`));
  const credentials = dependencies.credentials || readCredentials(config.credentialsFile);
  const session = dependencies.session || await connectBrowser({
    cdpPort: config.cdpPort,
    destination: config.destination,
    log,
  });
  const existingIds = existingOrderIds(config.destination);
  try {
    await login(session.page, { baseUrl: config.baseUrl, ...credentials, log });
    const downloaded = config.targets.length
      ? await downloadTargets({ session, config, log, existingIds })
      : await downloadPatientCount({ session, config, log, existingIds });
    log(`완료: 새 ZIP ${downloaded}개`);
    return downloaded;
  } finally {
    await session.browser.close();
  }
}

async function main() {
  try {
    const config = parseArgs(process.argv.slice(2));
    if (config.help) {
      console.log(HELP_TEXT);
      return;
    }
    await run(config);
  } catch (error) {
    console.error(`[itero] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
