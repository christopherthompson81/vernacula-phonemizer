import { describe, expect, it } from "vitest";
import { phonemize } from "../../index.ts";
import { phonemizeWord } from "./turkish.ts";

describe("Turkish g2p (segmental)", () => {
  it("vowels, palatalization, dark-l, ğ", () => {
    const cases: [string, string][] = [
      ["merhaba", "mˈeɾhaba"],
      ["türkiye", "tˈyɾcije"],   // ü→y, k→c before front i
      ["güzel", "ɟyzˈel"],       // g→ɟ before front ü
      ["okul", "okˈuɫ"],         // dark l after back u
      ["dil", "dˈil"],           // clear l after front i
      ["çocuk", "t͡ʃod͡ʒˈuk"],
      ["dağ", "dˈaː"],           // ğ lengthens
      ["değil", "dejˈil"],       // ğ→j between front vowels
      ["düğün", "dˈyːn"],        // ğ merges identical ü
      ["asker", "ascˈeɾ"],       // k→c after consonant before front e
      ["teşekkür", "teʃekːˈyɾ"], // doubled stop → geminate ː
      ["anne", "annˈe"],         // doubled sonorant stays double
      ["İzmir", "ˈizmiɾ"],       // İ→i locale fold (+ lexicon stress)
    ];
    for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
  });

  it("progressive -Iyor pre-stressing suffix", () => {
    expect(phonemizeWord("geliyor")).toBe("ɟelˈijoɾ");
    expect(phonemizeWord("istiyorum")).toBe("istˈijoɾum");
  });

  it("numbers", () => {
    expect(phonemize("0", "tr")).toBe("sɯfˈɯɾ");
    expect(phonemize("42", "tr")).toBe("kˈɯɾk icˈi");
    expect(phonemize("1985", "tr")).toBe("bˈin dokˈuz jˈyz seksˈen bˈeʃ");
  });
});
