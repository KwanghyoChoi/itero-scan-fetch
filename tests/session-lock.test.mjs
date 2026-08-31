import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { acquire, lockPathForPort, release, tryAcquire } from "../scripts/session-lock.mjs";

const scratch = () => join(mkdtempSync(join(tmpdir(), "itero-lock-")), "cdp.lock");

test("잠금 키는 CDP 포트로 정해진다", () => {
  // 폴더가 아니라 포트가 키여야 서로 다른 위치에 설치된 사본끼리도 같은 잠금을 본다.
  assert.equal(lockPathForPort(9334), lockPathForPort(9334));
  assert.notEqual(lockPathForPort(9334), lockPathForPort(9222));
});

test("비어 있으면 잡고, 이미 잡혀 있으면 실패한다", () => {
  const path = scratch();
  assert.equal(tryAcquire(path), true);
  assert.equal(Number(readFileSync(path, "utf8")), process.pid);
  assert.equal(tryAcquire(path, { pid: process.pid + 1 }), false);
});

test("죽은 주인이 남긴 잠금은 회수한다", () => {
  const path = scratch();
  writeFileSync(path, "999999");           // 존재하지 않는 pid
  let reclaimed = null;
  assert.equal(tryAcquire(path, { onReclaim: (holder) => { reclaimed = holder; } }), false);
  assert.equal(reclaimed, 999999);         // 회수는 알린다 — 조용히 뺏지 않는다
  assert.equal(tryAcquire(path), true);    // 다음 회차에 잡힌다
});

test("남의 잠금은 풀지 않는다", () => {
  const path = scratch();
  writeFileSync(path, String(process.pid + 1));
  assert.equal(release(path), false);
  assert.equal(readFileSync(path, "utf8"), String(process.pid + 1));
});

test("앞 작업이 끝나면 이어받는다", async () => {
  const path = scratch();
  writeFileSync(path, String(process.pid));   // 살아있는 주인(자기 자신)
  const messages = [];
  let clock = 0;
  const done = acquire(path, {
    pid: process.pid,
    waitMs: 60_000,
    log: (m) => messages.push(m),
    now: () => clock,
    sleep: async () => {
      clock += 5000;
      if (clock >= 15_000) release(path, { pid: process.pid });   // 앞 작업 종료
    },
  });
  assert.equal(await done, true);
  assert.ok(messages.some((m) => m.includes("진행 중입니다")));
});

test("제한 시간을 넘기면 거짓을 돌려준다 — 호출측이 종료 코드를 정한다", async () => {
  const path = scratch();
  writeFileSync(path, String(process.pid));
  let clock = 0;
  const got = await acquire(path, {
    waitMs: 10_000,
    now: () => clock,
    sleep: async () => { clock += 5000; },
  });
  assert.equal(got, false);
});
