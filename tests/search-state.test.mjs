import assert from "node:assert/strict";
import test from "node:test";

import { classifySearch, hasEmptyMarker } from "../scripts/search-state.mjs";

const FULL_LIST = ["행1 1000001", "행2 1000002", "행3 1000003"];

test("결과 없음 문구를 인식한다", () => {
  assert.equal(hasEmptyMarker("일치 항목을 찾을 수 없습니다"), true);
  assert.equal(hasEmptyMarker("No matching records found"), true);
  assert.equal(hasEmptyMarker("환자 목록"), false);
});

test("검색 전후가 동일하면 '실행되지 않음'이다", () => {
  // 입력만 하고 실행 버튼을 누르지 않으면 전체 목록이 그대로 남는다.
  // 이걸 0건으로 읽으면 「없다」와 「묻지 못했다」를 같은 것으로 취급하게 된다.
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: FULL_LIST, pageText: "환자 목록" }),
    "not-executed",
  );
});

test("결과가 줄어들면 '적용됨'이다", () => {
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: ["행2 1000002"], pageText: "환자 목록" }),
    "applied",
  );
});

test("안내 문구가 있으면 표가 그대로여도 '결과 없음'이다", () => {
  assert.equal(
    classifySearch({
      beforeRows: FULL_LIST,
      afterRows: FULL_LIST,
      pageText: "일치 항목을 찾을 수 없습니다",
    }),
    "empty",
  );
});

test("표가 비었고 이전에 행이 있었으면 '결과 없음'이다", () => {
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: [], pageText: "" }),
    "empty",
  );
});

test("처음부터 표가 없으면 '실행되지 않음'으로 본다", () => {
  // 아직 그리는 중일 수 있으므로 0건이라 단정하지 않는다.
  assert.equal(classifySearch({ beforeRows: [], afterRows: [], pageText: "" }), "not-executed");
});

test("검색어가 입력창에서 바뀌어 있으면 결과를 믿지 않는다", () => {
  // 헤드리스 실측(2026-09-01): 넣은 검색어와 다른 값이 입력창에 들어가 있었고
  // 표는 그 다른 값의 결과로 걸러져 있었다. 행 집합이 달라졌으므로 옛 판정은 "applied"였다.
  // 즉 **다른 대상의 결과를 내 검색 결과로 읽는다.** 이름으로 찾을 때는 뒤쪽 행 대조도 못 막는다.
  assert.equal(
    classifySearch({
      beforeRows: FULL_LIST,
      afterRows: ["행9 9000009"],
      pageText: "환자 목록",
      query: "1000001",
      boxValue: "9000009",
    }),
    "not-executed",
  );
});

test("입력창 값이 그대로면 정상 판정한다", () => {
  assert.equal(
    classifySearch({
      beforeRows: FULL_LIST,
      afterRows: ["행1 1000001"],
      pageText: "환자 목록",
      query: "1000001",
      boxValue: "1000001",
    }),
    "applied",
  );
});

test("걸러진 행이 검색어와 무관하면 '실행되지 않음'으로 본다", () => {
  // 이전 질의의 잔상이거나 아직 다시 그리는 중이다.
  // 「없다」보다 「못 물어봤다」 쪽으로 틀리는 게 안전하다 — 재시도할 여지를 남긴다.
  assert.equal(
    classifySearch({
      beforeRows: FULL_LIST,
      afterRows: ["행9 9000009"],
      pageText: "환자 목록",
      query: "1000001",
    }),
    "not-executed",
  );
});

test("query 를 주지 않으면 기존 판정 그대로다(하위호환)", () => {
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: ["행1 1000001"], pageText: "환자 목록" }),
    "applied",
  );
});
