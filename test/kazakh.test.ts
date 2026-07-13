import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/kazakh/kazakh.ts";

describe("Kazakh Cyrillic g2p", () => {
  it("core words, vowels, canonical relabels", () => {
    const cases: [string, string][] = [
      ["Қазақстан", "qɑzɑqstˈɑn"], // қ → q, а → ɑ
      ["мен", "mˈen"],
      ["ғылым", "ʁˈəɫəm"],          // ғ → ʁ, ы → ə
      ["тоғыз", "tˈoʁəz"],
      ["хат", "χˈɑt"],              // х → χ
      ["түрі", "tʏrˈɪ"],            // ү → ʏ, і → ɪ
    ];
    for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
  });

  it("л vowel harmony (dark ɫ in back words, clear l in front)", () => {
    expect(phonemizeWord("қол")).toBe("qˈoɫ");   // back word → dark ɫ
    expect(phonemizeWord("алма")).toBe("ɑɫmˈɑ");
    expect(phonemizeWord("тіл")).toBe("tˈɪl");   // front vowel ɪ → clear l
    expect(phonemizeWord("Солтүстік")).toBe("soltʏstˈɪk"); // ʏ/ɪ front → all l
  });

  it("glides and word-initial е → je", () => {
    expect(phonemizeWord("ел")).toBe("jˈel");    // word-initial е → je (stress on the vowel)
    expect(phonemizeWord("кино").replace(/ˈ/u, "")).toBe("kəjno"); // и → əj (кино is loan-stressed by espeak; assert the segment)
    expect(phonemizeWord("тау")).toBe("tˈɑw");   // у → glide w
  });

  it("stress: espeak STRESSPOSN_1RU (last syllable before the first reduced ы→ə)", () => {
    expect(phonemizeWord("Санат")).toBe("sɑnˈɑt");    // no reduced vowel → final
    expect(phonemizeWord("бойынша")).toBe("bˈojənʃɑ"); // ы between full vowels pulls stress left
    expect(phonemizeWord("коды")).toBe("kˈodə");
  });

  it("initial-cluster epenthesis and abbreviation letter-spelling", () => {
    expect(phonemizeWord("стратегия")).toBe("sətrɑtˈeɡəjja"); // ≥3 initial consonants → schwa after the first
    expect(phonemizeWord("км")).toBe("kəmˈə");   // consonant-only token → each letter named Cə
    expect(phonemizeWord("РФ")).toBe("rəfˈə");
  });

  it("cardinal numbers", () => {
    expect(phonemize("5", "kk")).toBe("bˈes");
    expect(phonemize("21", "kk")).toBe("ʒəjərmˈɑbˈɪr");
    expect(phonemize("100", "kk")).toBe("ʒˈʏz");
    expect(phonemize("1000", "kk")).toBe("bˈɪr mˈəŋ");
  });
});
