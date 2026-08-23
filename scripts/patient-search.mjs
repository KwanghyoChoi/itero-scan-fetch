const COMPOUND_SURNAMES = [
  "남궁",
  "황보",
  "제갈",
  "사공",
  "선우",
  "서문",
  "독고",
  "동방",
];

export function splitName(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.includes(" ")) {
    const [surname, ...givenParts] = text.split(" ");
    return [surname, givenParts.join(" ")];
  }
  if (!/[가-힣]/u.test(text)) return [null, text];
  const surnameLength = COMPOUND_SURNAMES.includes(text.slice(0, 2)) ? 2 : 1;
  return text.length > surnameLength
    ? [text.slice(0, surnameLength), text.slice(surnameLength)]
    : [null, text];
}

export function searchForms(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (/^\d+$/u.test(text)) return [text];
  const [surname, givenName] = splitName(text);
  if (!surname) return [text];
  return [givenName, `${surname} ${givenName}`, `${surname}${givenName}`, surname];
}

export function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/gu, "");
}

export function rowMatches(rowText, target) {
  const row = normalizeText(rowText);
  if (!row) return false;
  if (row.includes(normalizeText(target))) return true;
  const [surname, givenName] = splitName(target);
  const parts = surname ? [surname, givenName] : [givenName];
  return parts.every((part) => part && row.includes(normalizeText(part)));
}
