const EXPORTABLE_STATUS = /완료되었습니다|연구소에 도착|(?:^|\s)완료(?:\s|$)/u;

export function isExportableStatus(value) {
  return EXPORTABLE_STATUS.test(String(value).replace(/\s+/g, " ").trim());
}

export function scanDateKey(value) {
  const text = String(value);
  const iso = text.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/u);
  if (iso) return `${iso[1]}${iso[2].padStart(2, "0")}${iso[3].padStart(2, "0")}`;
  const us = text.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/u);
  if (us) return `${us[3]}${us[1].padStart(2, "0")}${us[2].padStart(2, "0")}`;
  return "";
}

export function parseOrderRow(rawText, index) {
  const compactText = String(rawText).replace(/\s+/g, " ").trim();
  const orderId = compactText.match(/\d{6,}/u)?.[0] ?? null;
  return {
    index,
    orderId,
    scanDateKey: scanDateKey(compactText),
    exportable: isExportableStatus(compactText),
    rawText: compactText,
  };
}

export function selectOrderRows(rows, endpoints) {
  const available = rows.filter((row) => row.orderId && row.exportable);
  if (!endpoints || available.length <= 2 || available.some((row) => !row.scanDateKey)) {
    return available;
  }
  const sorted = [...available].sort((left, right) => left.scanDateKey.localeCompare(right.scanDateKey));
  return [sorted[0], sorted.at(-1)];
}
