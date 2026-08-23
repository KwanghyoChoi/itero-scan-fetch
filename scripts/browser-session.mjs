import { mkdirSync } from "node:fs";

class DownloadTracker {
  constructor(client, log) {
    this.pending = null;
    client.on("Browser.downloadWillBegin", (event) => {
      if (this.pending && !this.pending.guid) {
        this.pending.guid = event.guid;
        log(`다운로드 준비 시작 (${event.suggestedFilename || "파일"})`);
      }
    });
    client.on("Browser.downloadProgress", (event) => {
      if (!this.pending || event.guid !== this.pending.guid) return;
      if (event.state === "completed") {
        const { resolve, timer } = this.pending;
        this.pending = null;
        clearTimeout(timer);
        resolve(event.guid);
      }
      if (event.state === "canceled") {
        const { reject, timer } = this.pending;
        this.pending = null;
        clearTimeout(timer);
        reject(new Error("Chrome이 다운로드를 취소했습니다"));
      }
    });
  }

  waitForDownload(timeoutMs) {
    if (this.pending) throw new Error("동시에 두 다운로드를 기다릴 수 없습니다");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`다운로드 대기 시간 초과 (${timeoutMs / 1000}초)`));
      }, timeoutMs);
      this.pending = { guid: null, resolve, reject, timer };
    });
  }
}

export async function connectBrowser({ cdpPort, destination, log }) {
  const { chromium } = await import("playwright");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("CDP Chrome에 브라우저 컨텍스트가 없습니다");
  const page = context.pages().find((candidate) => {
    const url = candidate.url();
    return /myitero|iterocloud|aligntech|about:blank/iu.test(url);
  }) || await context.newPage();
  mkdirSync(destination, { recursive: true });
  const client = await context.newCDPSession(page);
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allowAndName",
    downloadPath: destination,
    eventsEnabled: true,
  });
  return { browser, context, page, tracker: new DownloadTracker(client, log) };
}
