import test from "node:test";
import assert from "node:assert/strict";

import { exportFileName, parseExportMetadata } from "../scripts/zip-metadata.mjs";

test("ZIP XML의 주문번호와 차트번호를 식별자로 사용한다", () => {
  const xml = `<?xml version="1.0"?><Export><OrderID>987654321</OrderID><ChartNumber>1234567</ChartNumber></Export>`;
  assert.deepEqual(parseExportMetadata(xml), {
    orderId: "987654321",
    chartNumber: "1234567",
  });
  assert.equal(exportFileName("987654321"), "OrthoCAD_Export_987654321.zip");
});

test("필수 XML 식별자가 없으면 명확히 실패한다", () => {
  assert.throws(() => parseExportMetadata("<Export />"), /OrderID|ChartNumber/);
});

test("OrderID 가 숫자가 아니면 거부한다", () => {
  // OrderID 는 저장 파일 이름을 만드는 데 쓰인다. 경로를 벗어나는 값이 들어오면 안 된다.
  assert.throws(
    () => parseExportMetadata("<OrderID>../../escape</OrderID><ChartNumber>1234567</ChartNumber>"),
    /OrderID 형식/u,
  );
});
