import { describe, expect, it } from "vitest";
import { phonemize } from "../../index.ts";
import { phonemizeWord } from "./czech.ts";

describe("Czech g2p", () => {
  it("vowels, palatalisation, ě", () => {
    const cases: [string, string][] = [
      ["divadlo", "ɟˈɪvadlo"], // di → ɟɪ
      ["děti", "ɟˈɛcɪ"],       // dě → ɟɛ, ti → cɪ
      ["běh", "bjˈɛx"],        // bě → bjɛ, ch → x
      ["měl", "mɲˈɛl"],        // mě → mɲɛ
      ["policie", "pˈolɪt͡sˌɪjɛ"], // hiatus i+e → ɪjɛ
      ["venku", "vˈɛŋku"],     // n → ŋ before k
    ];
    for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
  });

  it("voicing assimilation (regressive + final devoicing)", () => {
    expect(phonemizeWord("led")).toBe("lˈɛt");       // final devoicing d→t
    expect(phonemizeWord("kde")).toBe("ɡdˈɛ");       // regressive k→ɡ before d (epitran-corroborated; espeak misses it)
    expect(phonemizeWord("prosba")).toBe("prˈozba"); // s→z before b
    expect(phonemizeWord("vstup")).toBe("fstˈup");   // v→f before st
    expect(phonemizeWord("sníh")).toBe("sɲˈiːx");    // final ɦ→x
    expect(phonemizeWord("rozhodně")).toBe("rˈosɦodɲɛ"); // z→s before ɦ
  });

  it("ř voicing and syllabic consonants", () => {
    expect(phonemizeWord("tři")).toBe("tr̝̊ˈɪ");    // ř devoices after voiceless t
    expect(phonemizeWord("při")).toBe("pr̝̊ˈɪ");    // (ř does not voice the preceding p)
    expect(phonemizeWord("tvář")).toBe("tvˈaːr̝̊"); // final ř devoices
    expect(phonemizeWord("krk")).toBe("kˈr̩k");     // syllabic r̩
    expect(phonemizeWord("vlk")).toBe("vˈl̩k");     // syllabic l̩
  });

  it("stress (first syllable + even non-final secondary) and degemination", () => {
    expect(phonemizeWord("republika")).toBe("rˈɛpublˌɪka");
    expect(phonemizeWord("vyšší")).toBe("vˈɪʃʃiː");   // geminate ʃʃ kept
    expect(phonemizeWord("činnost")).toBe("t͡ʃˈɪnost"); // nn → n
  });

  it("cardinal numbers", () => {
    expect(phonemize("5", "cs")).toBe("pjˈɛt");
    expect(phonemize("10", "cs")).toBe("dˈɛsɛt");
    expect(phonemize("100", "cs")).toBe("stˈo");
    expect(phonemize("1000", "cs")).toBe("cˈɪsiːt͡s"); // first-syllable stress (espeak wrongly stresses the 2nd)
  });
});
