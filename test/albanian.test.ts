import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords, phonemizeWord } from "../src/languages/albanian/albanian.ts";

// Canonical-IPA goldens for Standard Albanian (sq) — Shqip (Tosk-based), Latin script, its own Indo-European
// branch. Signature: a rich DIGRAPH system — ⟨dh th sh zh xh⟩→[ð θ ʃ ʒ d͡ʒ], the PALATALS ⟨gj⟩→[ɟ]
// / ⟨q⟩→[c], ⟨nj⟩→[ɲ], ⟨ll⟩→[ɫ] (dark l), ⟨rr⟩→[r] (trill) vs ⟨r⟩→[ɾ] (tap); ⟨c⟩→[t͡s], ⟨ç⟩→[t͡ʃ], ⟨x⟩→[d͡z];
// the 7-vowel system ⟨e⟩→[ɛ], ⟨y⟩→[y], ⟨ë⟩→[ə]. Penultimate stress. Referees: kaikki + epitran sqi-Latn.
describe("Albanian (Shqip) canonical IPA", () => {
    test("the digraph fricatives ⟨dh th sh zh xh⟩", () => {
        expect(phonemizeWord("dhe")).toBe("ˈðɛ"); // 'and/earth' — ⟨dh⟩→ð, ⟨e⟩→ɛ
        expect(phonemizeWord("thikë")).toBe("ˈθikə"); // 'knife' — ⟨th⟩→θ, ⟨ë⟩→ə
        expect(phonemizeWord("xhaxha")).toBe("ˈd͡ʒad͡ʒa"); // 'uncle' — ⟨xh⟩→d͡ʒ
    });

    test("the palatals ⟨gj⟩→ɟ, ⟨q⟩→c, ⟨nj⟩→ɲ; ⟨ll⟩→ɫ, ⟨rr⟩→r", () => {
        expect(phonemizeWord("gjuha")).toBe("ˈɟuha"); // 'the tongue/language' — ⟨gj⟩→ɟ (voiced palatal stop)
        expect(phonemizeWord("shqip")).toBe("ˈʃcip"); // 'Albanian' — ⟨sh⟩→ʃ, ⟨q⟩→c; stress before the whole ⟨ʃc⟩ onset
        expect(phonemizeWord("rrugë")).toBe("ˈruɡə"); // 'street' — ⟨rr⟩→r (trill)
        expect(phonemizeWord("llullë")).toBe("ˈɫuɫə"); // 'pipe' — ⟨ll⟩→ɫ (dark l)
    });

    test("the affricates ⟨c ç x⟩ and the 7-vowel system", () => {
        expect(phonemizeWord("çaj")).toBe("ˈt͡ʃaj"); // 'tea' — ⟨ç⟩→t͡ʃ
        expect(phonemizeWord("xixë")).toBe("ˈd͡zid͡zə"); // 'spark' — ⟨x⟩→d͡z
        expect(phonemizeWord("gjysh")).toBe("ˈɟyʃ"); // 'grandfather' — ⟨y⟩→y (front rounded)
        expect(phonemizeWord("ëmbël")).toBe("ˈəmbəl"); // 'sweet' — ⟨ë⟩→ə (schwa)
    });

    test("penultimate stress + maximal-onset syllabification", () => {
        expect(phonemizeWord("Shqipëri")).toBe("ʃciˈpəɾi"); // 'Albania' — stress on the penult ⟨ë⟩→ə, single ⟨r⟩→ɾ tap
        expect(phonemizeWord("qumësht")).toBe("ˈcuməʃt"); // 'milk'
        expect(phonemizeWord("flamur")).toBe("ˈflamuɾ"); // 'flag' — ˈ before the whole ⟨fl⟩ onset, not fˈl
        expect(phonemizeWord("vendlindja")).toBe("vɛndˈlindja"); // 'birthplace' — ⟨dl⟩ is not an onset, so ˈ before ⟨l⟩ (nd is coda)
    });
});

// CARDINAL NUMBERS (src/languages/albanian/numbers.ts). Source: Newmark, Hubbard & Prifti, *Standard Albanian:
// A Reference Grammar for Students* (1982), the cardinal-numeral section. Decimal and regular; the one thing
// that keeps it off the shared Western composer is the obligatory ⟨e⟩ "and" connector between groups
// (njëzet e një). ⟨njëzet⟩/⟨dyzet⟩ are vigesimal fossils but round-ten words here. Citation form for 3: ⟨tre⟩.
describe("Albanian numbers", () => {
    for (const [n, expected] of [
        [0, "zero"],
        [1, "një"],
        [3, "tre"],                                      // MASCULINE citation form (feminine ⟨tri⟩ unused)
        [4, "katër"],
        [10, "dhjetë"],
        [11, "njëmbëdhjetë"],
        [13, "trembëdhjetë"],
        [20, "njëzet"],
        [21, "njëzet e një"],                            // the obligatory ⟨e⟩ connector
        [30, "tridhjetë"],
        [40, "dyzet"],
        [42, "dyzet e dy"],
        [99, "nëntëdhjetë e nëntë"],
        [100, "njëqind"],                                // round hundreds are FUSED
        [101, "njëqind e një"],
        [300, "treqind"],
        [555, "pesëqind e pesëdhjetë e pesë"],
        [1000, "një mijë"],                              // the "one" is KEPT (no bare *mijë)
        [1001, "një mijë e një"],
        [2000, "dy mijë"],                               // ⟨mijë⟩ is invariant
        [12345, "dymbëdhjetë mijë e treqind e dyzet e pesë"],
        [1000000, "një milion"],
        [2000000, "dy milionë"],                         // ⟨milion⟩ takes the plural ⟨-ë⟩ above one
        [1000000000, "një miliard"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit leak, sentinel or gap across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/u);
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("21", "sq")).toBe("ˈɲəzɛt ˈɛ ˈɲə"); // njëzet e një — ⟨e⟩ is its own word [ˈɛ]
        expect(phonemize("1000000", "sq")).toBe("ˈɲə miˈlion"); // një milion
    });
});
