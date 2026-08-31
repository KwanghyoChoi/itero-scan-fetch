// 같은 CDP 크롬을 두 프로세스가 동시에 몰지 못하게 한다.
//
// 왜 필요한가: connectBrowser()는 이미 떠 있는 myitero 탭을 그대로 집는다. 두 다운로더가
// 동시에 돌면 한쪽이 입력한 검색어를 다른 쪽이 덮어쓰고, 표는 B의 결과인데 A가 읽는다 —
// 다른 환자의 스캔을 받을 수 있다. Browser.setDownloadBehavior와 다운로드 이벤트도
// 브라우저 전역이라, 남의 다운로드 guid를 자기 것으로 잡을 수도 있다.
//
// 그래서 **거절하지 않고 줄을 세운다.** 앞 작업이 끝나면 자동으로 이어받는다.
//
// 잠금 키는 레포 경로가 아니라 **CDP 포트**다. 다투는 자원이 "그 포트의 크롬 탭"이므로,
// 서로 다른 폴더에 설치된 사본끼리도 같은 포트를 쓰면 같은 잠금을 본다.
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function lockPathForPort(cdpPort) {
  return join(tmpdir(), `myitero-cdp-${cdpPort}.lock`);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);   // 신호 0 = 존재 확인만, 프로세스를 건드리지 않는다
    return true;
  } catch {
    return false;
  }
}

function readHolder(lockPath) {
  try {
    return Number((readFileSync(lockPath, "utf8") || "").trim()) || null;
  } catch {
    return null;   // 방금 풀렸을 수 있다 — 없는 것도 정상이다
  }
}

/** 한 번 시도. 잡으면 true, 남이 쥐고 있으면 false. 죽은 주인이 남긴 잠금은 회수한다. */
export function tryAcquire(lockPath, { pid = process.pid, onReclaim } = {}) {
  try {
    const fd = openSync(lockPath, "wx");   // 이미 있으면 EEXIST — 원자적이다
    writeSync(fd, String(pid));
    closeSync(fd);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const holder = readHolder(lockPath);
    if (holder && isAlive(holder)) return false;
    // 주인이 죽었다(강제 종료·크래시). 회수하고 다음 회차에 다시 잡는다.
    if (onReclaim) onReclaim(holder);
    try {
      unlinkSync(lockPath);
    } catch {
      // 다른 프로세스가 먼저 치웠다 — 다음 회차에 잡으면 된다
    }
    return false;
  }
}

export function release(lockPath, { pid = process.pid } = {}) {
  if (readHolder(lockPath) !== pid) return false;   // 남의 잠금은 절대 풀지 않는다
  try {
    unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 잠금을 잡을 때까지 기다린다.
 * @returns {Promise<boolean>} 잡았으면 true, 제한 시간을 넘겼으면 false(호출측이 종료 코드를 정한다)
 */
export async function acquire(lockPath, {
  waitMs = 10 * 60 * 1000,
  pollMs = 5000,
  log = () => {},
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const startedAt = now();
  let announced = false;
  for (;;) {
    if (tryAcquire(lockPath, { onReclaim: (holder) => log(`남아 있던 잠금을 회수했습니다 (pid ${holder ?? "?"} 없음)`) })) {
      return true;
    }
    if (now() - startedAt > waitMs) return false;
    if (!announced) {
      const holder = readHolder(lockPath);
      if (holder) {
        log(`다른 다운로드가 진행 중입니다 (pid ${holder}) — 끝나면 이어서 시작합니다`);
        announced = true;
      }
    }
    await sleep(pollMs);
  }
}

/** 프로세스가 어떻게 끝나든 잠금을 돌려준다. */
export function releaseOnExit(lockPath) {
  const give = () => release(lockPath);
  process.on("exit", give);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      give();
      process.exit(130);
    });
  }
}
