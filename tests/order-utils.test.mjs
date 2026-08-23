import test from "node:test";
import assert from "node:assert/strict";

import {
  isExportableStatus,
  parseOrderRow,
  selectOrderRows,
} from "../scripts/order-utils.mjs";

test("완료 상태의 변형을 내보내기 대상으로 판정한다", () => {
  assert.equal(isExportableStatus("완료되었습니다"), true);
  assert.equal(isExportableStatus("연구소에 도착"), true);
  assert.equal(isExportableStatus("완료"), true);
  assert.equal(isExportableStatus("미완료"), false);
});

test("주문 행에서 주문번호와 날짜를 추출한다", () => {
  assert.deepEqual(parseOrderRow("123456789\t2024-02-03\t완료", 4), {
    index: 4,
    orderId: "123456789",
    scanDateKey: "20240203",
    exportable: true,
    rawText: "123456789 2024-02-03 완료",
  });
});

test("기본 선택은 모든 완료 주문이고 endpoints는 명시할 때만 두 건이다", () => {
  const rows = [
    parseOrderRow("111111111\t2022-01-01\t완료", 0),
    parseOrderRow("222222222\t2023-01-01\t완료", 1),
    parseOrderRow("333333333\t2024-01-01\t완료", 2),
  ];
  assert.deepEqual(selectOrderRows(rows, false).map((row) => row.orderId), [
    "111111111",
    "222222222",
    "333333333",
  ]);
  assert.deepEqual(selectOrderRows(rows, true).map((row) => row.orderId), [
    "111111111",
    "333333333",
  ]);
});
