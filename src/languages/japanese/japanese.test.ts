import { describe, expect, it } from "vitest";
import { phonemize } from "../../index.ts";
import { phonemizeWord } from "./japanese.ts";

describe("Japanese kana → IPA (Phase 1)", () => {
  it("core kana, youon, sokuon, long vowels, moraic ん", () => {
    const cases: [string, string][] = [
      ["です", "de̞sɯᵝ"],
      ["する", "sɯᵝɾɯᵝ"],
      ["ありがとう", "äɾiɡäto̞ː"],   // おう → o̞ː
      ["がっこう", "ɡäkko̞ː"],        // sokuon geminate + おう
      ["きょう", "kʲo̞ː"],            // youon
      ["とうきょう", "to̞ːkʲo̞ː"],
      ["コーヒー", "ko̞ːçiː"],        // katakana + long mark
      ["いい", "iː"],               // same-vowel coalescence
    ];
    for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
  });

  it("moraic ん place assimilation (n / ŋ / m / ɴ)", () => {
    expect(phonemizeWord("こんにちは")).toBe("ko̞nnit͡ɕihä"); // n before coronal
    expect(phonemizeWord("にほんご")).toBe("niho̞ŋɡo̞");       // ŋ before velar
    expect(phonemizeWord("さんぽ")).toBe("sämpo̞");           // m before labial
    expect(phonemizeWord("にほん")).toBe("niho̞ɴ");           // ɴ word-finally
  });

  it("extended (foreign-sound) katakana", () => {
    expect(phonemizeWord("チェック")).toBe("t͡ɕe̞kkɯᵝ");
    expect(phonemizeWord("ファン")).toBe("ɸäɴ");
    expect(phonemizeWord("メディア")).toBe("me̞diä");
  });

  it("numbers", () => {
    expect(phonemize("0", "ja")).toBe("ɾe̞ː");
    expect(phonemize("4", "ja")).toBe("jo̞ɴ");
    expect(phonemize("300", "ja")).toBe("sämbʲäkɯᵝ");  // rendaku ひゃく→びゃく + ん→m
  });

  it("sentence: clause punctuation → pause marks", () => {
    expect(phonemize("これはペンです。", "ja")).toBe("ko̞ɾe̞häpe̞nde̞sɯᵝ .");
  });
});
