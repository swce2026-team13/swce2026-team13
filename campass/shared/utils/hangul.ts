// '○○이에요' / '○○예요'. 끝의 닫는 괄호는 빼고 보고, 숫자는 읽는 소리로, 영문은 '예요'
// 받침 있는 숫자: 0(영) 1(일) 3(삼) 6(육) 7(칠) 8(팔)
export function withCopula(word: string) {
  const last =
    word
      .trim()
      .replace(/[)\]}]+$/, "")
      .at(-1) ?? "";
  if (/\d/.test(last))
    return `${word}${/[013678]/.test(last) ? "이에요" : "예요"}`;
  const code = last.charCodeAt(0) - 0xac00;
  const final = code >= 0 && code < 11172 && code % 28 !== 0;
  return `${word}${final ? "이에요" : "예요"}`;
}
