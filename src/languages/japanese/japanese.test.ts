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

  it("kanji → kana readings (Phase 2)", () => {
    expect(phonemizeWord("日本語")).toBe("niho̞ŋɡo̞");
    expect(phonemizeWord("東京")).toBe("to̞ːkʲo̞ː");
    expect(phonemizeWord("食べる")).toBe("täbe̞ɾɯᵝ");
    expect(phonemizeWord("十")).toBe("d͡ʑɯᵝɯᵝ");     // youon blocks same-vowel coalescence
  });

  it("bunsetsu segmentation of spaceless kanji text", () => {
    // 私は | 学生です — the particle は attaches to the preceding kanji head, one space at the bunsetsu boundary.
    expect(phonemize("私は学生です", "ja")).toBe("wätäɕihä ɡäkɯᵝse̞ːde̞sɯᵝ");
    // 語を stays ɡo̞o̞ (を is a distinct kana, no same-vowel fold across the particle).
    expect(phonemize("日本語を", "ja")).toBe("niho̞ŋɡo̞o̞");
  });
});
