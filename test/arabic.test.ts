import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/arabic/arabic.ts";

// Canonical-IPA goldens for Arabic (ar) — Phase 1: the DIACRITIZED input path (broad MSA, cleanroom rules,
// no lexicon). Emphatics sˤ dˤ tˤ ðˤ, pharyngeals ʕ ħ (the census gaps), gemination Cː, al- sun/moon
// assimilation + hamzat-wasl ʔ, quantity-sensitive stress. Validated vs espeak-portable canonical (2500
// diacritized words): 96% segments. Short-vowel restoration for bare text is a Phase-2 diacritizer pre-pass.
describe("arabic canonical IPA — diacritized path", () => {
  test("consonants, emphatics, pharyngeals, gemination, stress", () => {
    expect(phonemizeWord("كَتَبَ")).toBe("kˈataba");        // antepenult stress (all light)
    expect(phonemizeWord("كِتَاب")).toBe("kitˈaːb");        // final superheavy → final
    expect(phonemizeWord("مُدَرِّس")).toBe("mudˈarːis");    // shadda → Cː, penult (heavy)
    expect(phonemizeWord("صَلَاة")).toBe("sˤˈalaː");        // emphatic sˤ, ة silent (pausal)
    expect(phonemizeWord("نَعَمْ")).toBe("nˈaʕam");         // pharyngeal ʕ
    expect(phonemizeWord("حَجّ")).toBe("ħˈad͡ʒː");           // ħ + geminate d͡ʒ
    expect(phonemizeWord("بَيْت")).toBe("bˈajt");           // diphthong aj
  });

  test("definite article: sun/moon assimilation + hamzat-wasl", () => {
    expect(phonemizeWord("الْقَمَر")).toBe("ʔalqˈamar");    // moon letter → keep l
    expect(phonemizeWord("الشَّمْس")).toBe("ʔaʃːˈams");     // sun letter → l assimilates (ʃ geminate)
    expect(phonemizeWord("الَّذِي")).toBe("ʔalːˈaðiː");     // lam-initial → geminate ll
  });

  test("proclitic + article (alif elides)", () => {
    expect(phonemizeWord("وَالْكُفْر")).toBe("walkˈufr");   // wa + al (moon)
    expect(phonemizeWord("لِلنَّاس")).toBe("linːˈaːs");     // li + al (sun n)
  });

  test("numbers → IPA (MSA counting forms)", () => {
    expect(phonemize("٢٠٢٤", "ar")).toBe("ʔalfaːn wa ʔarbaʕa wa ʕiʃruːn"); // 2000 and 24
    expect(phonemize("100", "ar")).toBe("miʔa");
    expect(phonemize("21", "ar")).toBe("waːħid wa ʕiʃruːn");               // ones precede tens
  });

  test("text: words + numbers + punctuation → pause", () => {
    expect(phonemize("كَتَبَ الطَّالِبُ.", "ar")).toBe("kˈataba ʔatˤːˈaːlibu .");
    expect(phonemize("الْقَمَر وَالشَّمْس", "ar")).toBe("ʔalqˈamar waʃːˈams");
  });
});
