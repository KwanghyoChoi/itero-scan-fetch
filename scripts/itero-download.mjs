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
    let everSearched = false;   // 검색이 한 번이라도 실제로 실행됐는가
    for (const query of searchForms(target)) {
      const status = await searchPatients(session.page, config.patientsUrl, query);

      // "검색이 실행되지 않음"을 "결과 0건"으로 취급하면 안 된다. 후자는 대상이 없다는 뜻이고
      // 전자는 아직 묻지 못했다는 뜻이다. 전체 목록을 그대로 훑으면 엉뚱한 행을 고르게 된다.
      if (status === "not-executed") {
        log(`대상 ${target}: 검색어 ${query} — 검색이 실행되지 않았습니다(전체 목록 그대로). 건너뜁니다.`);
        continue;
      }
      everSearched = true;
      if (status === "empty") {
        log(`대상 ${target}: 검색어 ${query} — 검색됨, 결과 0건`);
        continue;
      }

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
    if (!matched) {
      // 「없다」와 「묻지 못했다」를 구분해서 보고한다. 같은 문장으로 뭉치면
      // 화면을 못 읽은 실패가 조용히 「대상 없음」으로 기록된다.
      log(
        everSearched
          ? `대상을 찾지 못했습니다: ${target} (검색은 실행됨 — 실제로 결과가 없습니다)`
          : `대상을 확인하지 못했습니다: ${target} (검색이 한 번도 실행되지 않았습니다 — 화면을 읽지 못한 것이지 대상이 없다는 뜻이 아닙니다)`,
      );
    }
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
