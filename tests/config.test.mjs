import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs } from "../scripts/config.mjs";

test("대상·출력 폴더·다운로드 제한을 명시적으로 읽는다", () => {
  const config = parseArgs([
    "--targets",
    "1234567,가나",
    "--dest",
    "/tmp/itero-public-test",
    "--max-downloads",
    "4",
    "--download-timeout",
    "60",
    "--cdp-port",
    "9444",
  ]);
  assert.deepEqual(config.targets, ["1234567", "가나"]);
  assert.equal(config.destination, "/tmp/itero-public-test");
  assert.equal(config.maxDownloads, 4);
  assert.equal(config.downloadTimeoutMs, 60000);
  assert.equal(config.cdpPort, "9444");
});

test("대상 없이 우연히 첫 환자를 받지 않고 도움말을 요구한다", () => {
  assert.throws(() => parseArgs([]), /--targets 또는 --patients/);
});
