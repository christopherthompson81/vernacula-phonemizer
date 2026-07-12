import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/russian/russian.ts";

// Canonical-IPA goldens for Russian (ru) — standard Moscow Russian, espeak-independent. Stress is lexical
// (stress.tsv, from kaikki); the rule g2p derives palatalization (Cʲ), iotation (я/е/ё/ю → jV), stress-based
// reduction (akanye/ikanye), final devoicing + regressive voicing assimilation, and the ɵ/æ/ʉ frontings.
// Stress mark is placed before the stressed VOWEL (repo convention); monosyllables carry none.
describe("russian canonical IPA", () => {
  test("vowel reduction (akanye/ikanye)", () => {
    expect(phonemizeWord("молоко")).toBe("məɫɐkˈo");   // мə-lɐ-ˈko (2nd-pretonic ə, 1st-pretonic ɐ)
    expect(phonemizeWord("голова")).toBe("ɡəɫɐvˈa");
    expect(phonemizeWord("город")).toBe("ɡˈorət");     // post-tonic ə, final д → t (devoiced)
    expect(phonemizeWord("собака")).toBe("sɐbˈakə");
    expect(phonemizeWord("хорошо")).toBe("xərɐʂˈo");
  });

  test("palatalization, iotation, frontings ɵ/æ", () => {
    expect(phonemizeWord("дядя")).toBe("dʲˈædʲə");     // æ between soft C, final я → ə
    expect(phonemizeWord("тётя")).toBe("tʲˈɵtʲə");     // ё after soft → ɵ
    expect(phonemizeWord("боксёр")).toBe("bɐksʲˈɵr");
    expect(phonemizeWord("язык")).toBe("jɪzˈɨk");      // initial я → jɪ (unstressed)
    expect(phonemizeWord("человек")).toBe("t͡ɕɪɫɐvʲˈek");
  });

  test("devoicing, sibilants, geminates, affrication", () => {
    expect(phonemizeWord("друг")).toBe("druk");        // final г → k
    expect(phonemizeWord("жизнь")).toBe("ʐɨznʲ");      // и after ж → ɨ
    expect(phonemizeWord("русский")).toBe("rˈusːkʲɪj"); // geminate сс → sː
    expect(phonemizeWord("детский")).toBe("dʲˈet͡skʲɪj"); // тс → t͡s
    expect(phonemizeWord("пятиться")).toBe("pʲˈætʲɪt͡sːə"); // -ться → t͡sː
  });

  test("stress dictionary + monosyllable (no mark)", () => {
    expect(phonemizeWord("что")).toBe("ʂto");          // irregular ч→ʂ is in the dict; monosyllable, no ˈ
    expect(phonemizeWord("кот")).toBe("kot");
    expect(phonemizeWord("большой")).toBe("bɐlʲʂˈoj");
  });

  test("Phase 2: genitive г→v + loanword hard е/и", () => {
    expect(phonemizeWord("красного")).toBe("krˈasnəvə");  // genitive -ого → v
    expect(phonemizeWord("большого")).toBe("bˈolʲʂəvə");
    expect(phonemizeWord("много")).toBe("mnˈoɡə");        // adverb exception → keeps ɡ
    expect(phonemizeWord("тест")).toBe("tɛst");           // loanword hard т → tɛ (not tʲe)
    expect(phonemizeWord("отель")).toBe("ɐtˈɛlʲ");
    expect(phonemizeWord("форель")).toBe("fɐrˈɛlʲ");
    expect(phonemizeWord("тема")).toBe("tʲˈemə");         // native → stays soft
  });

  test("numbers", () => {
    expect(phonemize("21", "ru")).toBe("dvˈatt͡sətʲ ɐdʲˈin");        // двадцать один
    expect(phonemize("100", "ru")).toBe("sto");                    // сто
    expect(phonemize("2024", "ru")).toBe("dvʲe tˈɨsʲət͡ɕɪ dvˈatt͡sətʲ t͡ɕɪtˈɨrʲe"); // две тысячи…
  });

  test("text: reduction + punctuation", () => {
    expect(phonemize("Я люблю русский язык.", "ru")).toBe("ja lʲʊblʲˈu rˈusːkʲɪj jɪzˈɨk .");
  });
});
