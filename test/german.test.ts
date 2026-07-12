import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/german/german.ts";

// Canonical-IPA goldens for Standard German (de), espeak-independent. Rule-based g2p (long/short vowels from
// spelling, diphthongs aɪ̯/aʊ̯/ɔʏ̯, ch ich-/ach-laut, sch, sp-/st-→ʃ, final devoicing, r-vocalization ɐ̯,
// schwa in weak endings) + mostly-Germanic stress (first syllable, or after an unstressed prefix) with a
// kaikki stress lexicon for loanwords. Stress mark is placed before the stressed VOWEL (repo convention).
describe("german canonical IPA", () => {
  test("vowel length + schwa endings + r-vocalization", () => {
    expect(phonemizeWord("Vater")).toBe("fˈaːtɐ");     // long aː (single C), -er → ɐ
    expect(phonemizeWord("Wasser")).toBe("vˈasɐ");     // short a (double s → single), -er → ɐ
    expect(phonemizeWord("machen")).toBe("mˈaxən");    // -en → ə
    expect(phonemizeWord("über")).toBe("ˈyːbɐ");
    expect(phonemizeWord("lieben")).toBe("lˈiːbən");   // ie → iː
    expect(phonemizeWord("sehen")).toBe("zˈeːən");     // silent h, s → z
    expect(phonemizeWord("Hamburg")).toBe("hˈambʊɐ̯k"); // coda r → ɐ̯, final g → k
    expect(phonemizeWord("das")).toBe("das");          // short function-word monosyllable
  });

  test("ch split, sch, sp/st, diphthongs, devoicing", () => {
    expect(phonemizeWord("ich")).toBe("ɪç");           // ich-laut
    expect(phonemizeWord("Buch")).toBe("buːx");        // ach-laut, long u
    expect(phonemizeWord("König")).toBe("kˈøːnɪç");    // -ig → ɪç
    expect(phonemizeWord("Straße")).toBe("ʃtʁˈaːsə");  // st- → ʃt, ß → s
    expect(phonemizeWord("Zeit")).toBe("t͡saɪ̯t");     // z → t͡s, ei → aɪ̯
    expect(phonemizeWord("Deutschland")).toBe("dˈɔʏ̯t͡ʃlant"); // eu → ɔʏ̯, tsch → t͡ʃ, final d → t
    expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ");   // äu → ɔʏ̯
    expect(phonemizeWord("müssen")).toBe("mˈʏsən");    // short ü → ʏ (the census primitive)
    expect(phonemizeWord("Tag")).toBe("taːk");         // final devoicing g → k
    expect(phonemizeWord("Hund")).toBe("hʊnt");
  });

  test("prefix reduction, sp/st after prefix", () => {
    expect(phonemizeWord("gemacht")).toBe("ɡəmˈaxt");  // ge- prefix → ə
    expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // be- → ə, st after prefix → ʃt
    expect(phonemizeWord("gehen")).toBe("ɡˈeːən");     // ge- ROOT not reduced (stress on first)
  });

  test("morphology: compound + affix boundary phonology", () => {
    // Compound seams reset element-initial context (sp/st→ʃ), devoice the preceding stem, and block assimilation.
    expect(phonemizeWord("Laubsturm")).toBe("lˈaʊ̯pʃtʊɐ̯m");  // st→ʃt at seam, b→p devoiced
    expect(phonemizeWord("Warenkorb")).toBe("vˈaːʁənkɔɐ̯p");  // n·k NOT assimilated to ŋ
    expect(phonemizeWord("aufstehen")).toBe("ˈaʊ̯fʃteːən");   // separable prefix stressed, st→ʃt
    expect(phonemizeWord("verstehen")).toBe("fɛɐ̯ʃtˈeːən");   // ver- prefix, st→ʃt, stress on stem
    expect(phonemizeWord("freundlich")).toBe("fʁˈɔʏ̯ntlɪç");  // -lich suffix, d→t devoiced at boundary
    expect(phonemizeWord("Zeitung")).toBe("t͡sˈaɪ̯tʊŋ");      // -ung
    // Vowel-initial inflection resyllabifies (no boundary): lieben not lieb·en, Häuser not häus·er.
    expect(phonemizeWord("lieben")).toBe("lˈiːbən");         // b stays (not devoiced)
    expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ");         // s → z (onset), not final s
  });

  test("numbers + text", () => {
    expect(phonemize("21", "de")).toBe("ˈaɪ̯nʊntt͡svant͡sɪç");  // einundzwanzig
    expect(phonemize("100", "de")).toBe("ˈaɪ̯nhʊndɐt");         // einhundert
    expect(phonemize("Ich wohne in Berlin.", "de")).toBe("ɪç vˈoːnə ɪn bəɐ̯lˈiːn .");
  });
});
