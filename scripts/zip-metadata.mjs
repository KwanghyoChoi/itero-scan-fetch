import { execFileSync } from "node:child_process";

function readTag(xml, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = xml.match(new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${escaped}>([^<]*)</`, "u"));
  return match?.[1]?.trim() ?? "";
}

export function parseExportMetadata(xml) {
  const orderId = readTag(String(xml), "OrderID");
  const chartNumber = readTag(String(xml), "ChartNumber");
  if (!orderId || !chartNumber) {
    throw new Error("ZIP XML에 OrderID와 ChartNumber가 모두 필요합니다");
  }
  return { orderId, chartNumber };
}

export function readZipMetadata(zipPath) {
  const xml = execFileSync("unzip", ["-p", zipPath, "*.xml"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return parseExportMetadata(xml);
}

export function exportFileName(orderId) {
  return `OrthoCAD_Export_${orderId}.zip`;
}
